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
    
    // Create return record
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber: generateRMANumber(),
        orderId,
        channelId: order.channelId,
        customerEmail: customerEmail || order.customerEmail,
        status: 'pending',
        totalReturnValueCents: totalReturnValue,
        notes,
        createdBy: req.user?.id || 'system',
        
        // Create return items
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
    
    // Update inventory if auto-restock
    for (const item of items) {
      if (item.quantityRestockable > 0 && item.condition === 'new') {
        await updateInventoryForReturn(item.productId, item.quantityRestockable, 'restock');
      }
    }
    
    // Log inventory movement
    await createInventoryMovement(returnRecord);
    
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
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();
    
    // Get return metrics
    const metrics = await prisma.$queryRaw`
      SELECT 
        DATE(r.created_at) as date,
        COUNT(DISTINCT r.id) as return_count,
        COUNT(DISTINCT ri.id) as return_item_count,
        SUM(ri.quantity_returned) as total_units_returned,
        SUM(ri.total_value_cents) / 100.0 as total_return_value,
        
        -- Reason breakdown
        SUM(CASE WHEN ri.reason_category = 'defective' THEN ri.quantity_returned ELSE 0 END) as defective_units,
        SUM(CASE WHEN ri.reason_category = 'damaged_in_shipping' THEN ri.quantity_returned ELSE 0 END) as shipping_damaged_units,
        SUM(CASE WHEN ri.reason_category = 'not_as_described' THEN ri.quantity_returned ELSE 0 END) as not_as_described_units,
        SUM(CASE WHEN ri.reason_category = 'wrong_item' THEN ri.quantity_returned ELSE 0 END) as wrong_item_units,
        SUM(CASE WHEN ri.reason_category = 'unwanted' THEN ri.quantity_returned ELSE 0 END) as unwanted_units,
        
        -- Financial impact
        SUM(r.refund_amount_cents) / 100.0 as total_refunded,
        SUM(r.restocking_fee_cents) / 100.0 as total_restocking_fees,
        SUM(r.return_shipping_cost_cents) / 100.0 as total_return_shipping_costs
        
      FROM returns r
      LEFT JOIN return_items ri ON r.id = ri.return_id
      WHERE r.created_at BETWEEN ${start} AND ${end}
      GROUP BY DATE(r.created_at)
      ORDER BY date DESC
    `;
    
    // Get top returned products
    const topReturned = await prisma.$queryRaw`
      SELECT 
        ri.sku,
        ri.product_title,
        COUNT(DISTINCT ri.return_id) as return_count,
        SUM(ri.quantity_returned) as total_units_returned,
        SUM(ri.total_value_cents) / 100.0 as total_return_value,
        ri.reason_category as top_reason
      FROM return_items ri
      JOIN returns r ON ri.return_id = r.id
      WHERE r.created_at BETWEEN ${start} AND ${end}
      GROUP BY ri.sku, ri.product_title, ri.reason_category
      ORDER BY total_units_returned DESC
      LIMIT 10
    `;
    
    res.json({
      success: true,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      dailyMetrics: metrics,
      topReturnedProducts: topReturned
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
        approvedBy: req.user?.id || 'system',
        refundAmountCents: refundAmount * 100,
        restockingFeeCents: restockingFee * 100,
        notes: approvalNotes
      },
      include: { items: true }
    });
    
    // Process refund (integrate with payment system)
    await processRefund(returnRecord);
    
    res.json({
      success: true,
      return: returnRecord
    });
    
  } catch (error: any) {
    console.error('Approve return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
async function updateInventoryForReturn(productId: string, quantity: number, type: string) {
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
  }
}

async function createInventoryMovement(returnRecord: any) {
  for (const item of returnRecord.items) {
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: item.productId, // You might need to look this up
        productId: item.productId,
        movementType: 'RETURN',
        quantity: item.quantityReturned,
        referenceType: 'RETURN',
        referenceId: returnRecord.id,
        notes: `Return ${returnRecord.returnNumber}: ${item.reasonCategory}`,
        createdBy: 'system'
      }
    });
  }
}

async function processRefund(returnRecord: any) {
  // Integrate with payment gateway
  // This is a placeholder for actual refund processing
  console.log(`Processing refund of $${returnRecord.refundAmountCents / 100} for return ${returnRecord.returnNumber}`);
}

export default router;
