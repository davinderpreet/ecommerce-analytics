import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Generate RMA number
function generateRMANumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `RMA-${year}-${random}`;
}

// POST /api/v1/returns - Create new return
router.post('/', async (req, res) => {
  try {
    const { 
      orderId, 
      items, 
      customerEmail,
      notes 
    } = req.body;
    
    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { channel: true, items: true }
    });
    
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    
    // Calculate total return value
    const totalReturnValue = items.reduce((sum: number, item: any) => {
      return sum + (item.unitPriceCents * item.quantityReturned);
    }, 0);
    
    // Create return record with items
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber: generateRMANumber(),
        orderId,
        channelId: order.channelId,
        customerEmail: customerEmail || order.customerEmail,
        status: 'pending',
        totalReturnValueCents: totalReturnValue,
        notes,
        createdBy: 'system',
        items: {
          create: items.map((item: any) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            sku: item.sku,
            productTitle: item.productTitle,
            quantityReturned: item.quantityReturned,
            quantityRestockable: item.quantityRestockable || 0,
            quantityDamaged: item.quantityDamaged || 0,
            unitPriceCents: item.unitPriceCents,
            totalValueCents: item.unitPriceCents * item.quantityReturned,
            reasonCategory: item.reasonCategory,
            reasonDetail: item.reasonDetail,
            batchNumber: item.batchNumber,
            condition: item.condition || 'pending_inspection'
          }))
        }
      },
      include: {
        items: true,
        order: true
      }
    });
    
    // Update inventory for restockable items
    for (const item of items) {
      if (item.quantityRestockable > 0 && item.condition === 'new' && item.productId) {
        await updateInventoryForReturn(item.productId, item.quantityRestockable);
      }
    }
    
    res.json({
      success: true,
      return: returnRecord
    });
    
  } catch (error: any) {
    console.error('Create return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns - List returns with filters
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      startDate, 
      endDate, 
      sku, 
      reasonCategory,
      page = 1,
      limit = 50
    } = req.query;
    
    const where: any = {};
    
    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }
    
    const returns = await prisma.return.findMany({
      where,
      include: {
        items: {
          where: {
            ...(sku && { sku }),
            ...(reasonCategory && { reasonCategory })
          }
        },
        order: {
          include: { channel: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });
    
    const total = await prisma.return.count({ where });
    
    res.json({
      success: true,
      returns,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error: any) {
    console.error('List returns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns/by-product/:productId - Get returns for product
router.get('/by-product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { days = 30 } = req.query;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - Number(days));
    
    const returnItems = await prisma.returnItem.findMany({
      where: {
        productId,
        createdAt: { gte: startDate }
      },
      include: {
        return: true
      }
    });
    
    // Calculate metrics
    const metrics = {
      totalReturned: returnItems.reduce((sum, item) => sum + item.quantityReturned, 0),
      totalRestockable: returnItems.reduce((sum, item) => sum + item.quantityRestockable, 0),
      totalDamaged: returnItems.reduce((sum, item) => sum + item.quantityDamaged, 0),
      returnValue: returnItems.reduce((sum, item) => sum + item.totalValueCents, 0) / 100,
      
      // Reason breakdown
      reasonBreakdown: returnItems.reduce((acc: any, item) => {
        acc[item.reasonCategory] = (acc[item.reasonCategory] || 0) + item.quantityReturned;
        return acc;
      }, {}),
      
      // Batch analysis
      problemBatches: [...new Set(returnItems
        .filter(item => item.batchNumber && item.reasonCategory === 'defective')
        .map(item => item.batchNumber))]
    };
    
    res.json({
      success: true,
      productId,
      period: `${days} days`,
      returns: returnItems,
      metrics
    });
    
  } catch (error: any) {
    console.error('Product returns error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns/metrics - Return analytics
router.get('/metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Get aggregated metrics
    const returns = await prisma.return.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: true
      }
    });
    
    // Process metrics by day
    const dailyMetrics = returns.reduce((acc: any, ret) => {
      const date = ret.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          return_count: 0,
          total_units_returned: 0,
          total_return_value: 0,
          defective_units: 0,
          damaged_units: 0
        };
      }
      
      acc[date].return_count++;
      ret.items.forEach(item => {
        acc[date].total_units_returned += item.quantityReturned;
        acc[date].total_return_value += item.totalValueCents / 100;
        if (item.reasonCategory === 'defective') {
          acc[date].defective_units += item.quantityReturned;
        }
        if (item.reasonCategory === 'damaged_in_shipping') {
          acc[date].damaged_units += item.quantityReturned;
        }
      });
      
      return acc;
    }, {});
    
    // Get top returned products
    const productReturns = await prisma.returnItem.groupBy({
      by: ['sku', 'productTitle'],
      where: {
        return: {
          createdAt: {
            gte: start,
            lte: end
          }
        }
      },
      _count: {
        id: true
      },
      _sum: {
        quantityReturned: true,
        totalValueCents: true
      },
      orderBy: {
        _sum: {
          quantityReturned: 'desc'
        }
      },
      take: 10
    });
    
    const topReturnedProducts = productReturns.map(p => ({
      sku: p.sku,
      product_title: p.productTitle,
      return_count: p._count.id,
      total_units_returned: p._sum.quantityReturned || 0,
      total_return_value: (p._sum.totalValueCents || 0) / 100
    }));
    
    res.json({
      success: true,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      dailyMetrics: Object.values(dailyMetrics),
      topReturnedProducts
    });
    
  } catch (error: any) {
    console.error('Return metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/returns/:id/approve - Approve return
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { refundAmount, restockingFee, approvalNotes } = req.body;
    
    const returnRecord = await prisma.return.update({
      where: { id },
      data: {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: 'system',
        refundAmountCents: Math.round((refundAmount || 0) * 100),
        restockingFeeCents: Math.round((restockingFee || 0) * 100),
        notes: approvalNotes
      },
      include: { items: true }
    });
    
    res.json({
      success: true,
      return: returnRecord
    });
    
  } catch (error: any) {
    console.error('Approve return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v1/returns/:id/complete - Complete return
router.put('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    const returnRecord = await prisma.return.update({
      where: { id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    });
    
    res.json({
      success: true,
      return: returnRecord
    });
    
  } catch (error: any) {
    console.error('Complete return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update inventory
async function updateInventoryForReturn(productId: string, quantity: number) {
  const inventory = await prisma.inventory.findUnique({
    where: { productId }
  });
  
  if (inventory) {
    await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        quantity: inventory.quantity + quantity,
        updatedAt: new Date()
      }
    });
    
    console.log(`Updated inventory for product ${productId}: +${quantity} units`);
  }
}

export default router;
