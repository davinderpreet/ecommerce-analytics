// backend/src/routes/returns.ts - WORKING VERSION WITH EXISTING SCHEMA
import express from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Generate RMA number
function generateRMANumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `RMA-${year}-${random}`;
}

// Cost calculation helper (stored in memory/cache since not in DB)
const returnCostCache = new Map<string, any>();

// GET /api/v1/returns/orders/search - Search for order by number
router.get('/orders/search', async (req, res) => {
  try {
    const { number } = req.query;
    
    if (!number || typeof number !== 'string') {
      res.status(400).json({ error: 'Order number required' });
      return;
    }
    
    const order = await prisma.order.findFirst({
      where: { 
        number: number
      },
      include: {
        channel: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    // Use shippingCents from the schema
    const shippingCost = order.shippingCents || 1200; // Default $12 if not set
    
    res.json({
      success: true,
      order: {
        ...order,
        shippingCostCents: shippingCost, // Add this for frontend compatibility
        items: order.items.map(item => ({
          ...item,
          title: item.product?.title || item.title,
          sku: item.product?.sku || item.sku,
          priceCents: item.priceCents
        }))
      }
    });
    
  } catch (error: any) {
    console.error('Order search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/returns/create-with-cost - Create return with cost awareness
router.post('/create-with-cost', async (req, res) => {
  try {
    const { 
      orderId, 
      items, 
      customerEmail,
      notes,
      autoApprove = false
    } = req.body;
    
    if (!orderId || !items || !Array.isArray(items)) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    
    // Validate order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        channel: true, 
        items: {
          include: { product: true }
        }
      }
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    // Calculate return value
    const totalReturnValue = items.reduce((sum: number, item: any) => {
      return sum + (item.unitPriceCents * item.quantityReturned);
    }, 0);

    // Estimate costs (since not in DB schema)
    const originalShippingCost = order.shippingCents || 1200;
    const returnLabelCost = 1500; // $15
    const processingCost = 500; // $5
    const estimatedTotalCost = originalShippingCost + returnLabelCost + processingCost;

    // Check if we should offer "keep it" refund
    const shouldOfferKeepIt = estimatedTotalCost > (totalReturnValue * 0.5);

    if (shouldOfferKeepIt && !autoApprove) {
      return res.json({
        success: true,
        offerKeepIt: true,
        message: 'Return costs exceed 50% of product value. Consider offering customer to keep the item.',
        estimatedSavings: estimatedTotalCost / 100,
        returnValue: totalReturnValue / 100,
        estimatedCost: estimatedTotalCost / 100
      });
    }

    // Create return record using existing schema
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber: generateRMANumber(),
        orderId,
        channelId: order.channelId,
        customerEmail: customerEmail || order.customerEmail || '',
        status: autoApprove ? 'approved' : 'pending',
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
            quantityRestockable: 0,
            quantityDamaged: 0,
            unitPriceCents: item.unitPriceCents,
            totalValueCents: item.unitPriceCents * item.quantityReturned,
            reasonCategory: item.reasonCategory || 'not_specified',
            reasonDetail: item.reasonDetail,
            batchNumber: item.batchNumber,
            condition: 'pending_inspection'
          }))
        }
      },
      include: {
        items: true,
        order: true
      }
    });

    // Store cost estimate in cache (since not in DB)
    returnCostCache.set(returnRecord.id, {
      originalShipping: originalShippingCost,
      returnLabel: returnLabelCost,
      processing: processingCost,
      totalEstimatedLoss: estimatedTotalCost,
      keepItRecommended: shouldOfferKeepIt
    });

    res.json({
      success: true,
      return: {
        ...returnRecord,
        // Add cost info for frontend
        returnLabelCostCents: returnLabelCost,
        processingCostCents: processingCost,
        totalActualLossCents: estimatedTotalCost,
        keepItRefund: shouldOfferKeepIt
      },
      costEstimate: {
        originalShipping: originalShippingCost / 100,
        returnLabel: returnLabelCost / 100,
        processing: processingCost / 100,
        totalEstimatedLoss: estimatedTotalCost / 100,
        keepItRecommended: shouldOfferKeepIt
      }
    });
    
  } catch (error: any) {
    console.error('Create return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/returns/:id/inspect - Update return after inspection
router.post('/:id/inspect', async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      res.status(400).json({ error: 'Items array required' });
      return;
    }

    let totalProductLoss = 0;

    // Update each item's condition
    for (const item of items) {
      const returnItem = await prisma.returnItem.findUnique({
        where: { id: item.itemId }
      });

      if (!returnItem) continue;

      // Calculate value loss based on condition
      const conditionImpact: Record<string, number> = {
        'new_unopened': 0,
        'opened_unused': 0.10,
        'like_new': 0.15,
        'good': 0.30,
        'fair': 0.50,
        'poor': 0.70,
        'damaged': 0.90,
        'defective': 1.00
      };

      const lossPercent = conditionImpact[item.condition] || 0.30;
      const itemValueLoss = Math.round(returnItem.totalValueCents * lossPercent);
      const resaleValue = returnItem.totalValueCents - itemValueLoss;

      totalProductLoss += itemValueLoss;

      // Determine resale channel
      let resaleChannel = 'new';
      if (lossPercent > 0 && lossPercent <= 0.15) resaleChannel = 'open-box';
      else if (lossPercent > 0.15 && lossPercent <= 0.50) resaleChannel = 'refurbished';
      else if (lossPercent > 0.50 && lossPercent < 1) resaleChannel = 'clearance';
      else if (lossPercent === 1) resaleChannel = 'scrap';

      // Update with existing schema fields
      await prisma.returnItem.update({
        where: { id: item.itemId },
        data: {
          condition: item.condition,
          quantityRestockable: item.restockable || 0,
          quantityDamaged: item.damaged || 0,
          // Store additional data in reasonDetail as JSON string
          reasonDetail: JSON.stringify({
            inspectionNotes: item.notes,
            resaleValue: resaleValue,
            resaleChannel: resaleChannel,
            valueLoss: itemValueLoss
          })
        }
      });
    }

    // Get return and calculate final costs
    const returnData = await prisma.return.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!returnData) {
      res.status(404).json({ error: 'Return not found' });
      return;
    }

    const originalShipping = returnData.order.shippingCents || 1200;
    const returnLabelCost = 1500;
    const processingCost = 500;
    const restockingFee = returnData.restockingFeeCents || 0;
    const totalActualLoss = 
      originalShipping + 
      returnLabelCost + 
      processingCost + 
      totalProductLoss -
      restockingFee;

    // Update return status
    await prisma.return.update({
      where: { id },
      data: {
        status: 'inspected'
      }
    });

    // Update cost cache
    returnCostCache.set(id, {
      originalShipping,
      returnLabel: returnLabelCost,
      processing: processingCost,
      productValueLoss: totalProductLoss,
      totalActualLoss,
      restockingFee
    });

    res.json({
      success: true,
      costBreakdown: {
        originalShipping: originalShipping / 100,
        returnLabel: returnLabelCost / 100,
        processing: processingCost / 100,
        productValueLoss: totalProductLoss / 100,
        restockingFee: restockingFee / 100,
        totalActualLoss: totalActualLoss / 100
      }
    });

  } catch (error: any) {
    console.error('Inspect return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns - List returns with cost info
router.get('/', async (req, res) => {
  try {
    const { 
      status, 
      reasonCategory,
      page = 1,
      limit = 50
    } = req.query;
    
    const where: Prisma.ReturnWhereInput = {};
    
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }
    
    const returns = await prisma.return.findMany({
      where,
      include: {
        items: true,
        order: {
          include: { channel: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit)
    });
    
    // Add cost info from cache
    const returnsWithCosts = returns.map(ret => {
      const costs = returnCostCache.get(ret.id) || {
        totalActualLoss: 2500 // Default $25 estimate
      };
      
      return {
        ...ret,
        totalActualLossCents: costs.totalActualLoss || 2500,
        keepItRefund: costs.keepItRecommended || false
      };
    });
    
    const total = await prisma.return.count({ where });
    
    res.json({
      success: true,
      returns: returnsWithCosts,
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

// GET /api/v1/returns/cost-analysis - Cost analytics
router.get('/cost-analysis', async (req, res) => {
  try {
    const { dateRange = '30d' } = req.query;
    const days = parseInt(dateRange.toString().replace('d', ''));
    
    const start = new Date();
    start.setDate(start.getDate() - days);
    const end = new Date();

    const returns = await prisma.return.findMany({
      where: {
        createdAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        order: true
      }
    });

    // Calculate metrics
    const totalReturns = returns.length;
    let totalReturnCost = 0;
    let keepItOpportunities = 0;
    
    const productCosts = new Map<string, any>();
    
    returns.forEach(ret => {
      // Get cost from cache or estimate
      const costs = returnCostCache.get(ret.id);
      const estimatedCost = costs?.totalActualLoss || 
        (ret.order.shippingCents || 1200) + 2000; // Estimate if not cached
      
      totalReturnCost += estimatedCost;
      
      if (estimatedCost > ret.totalReturnValueCents * 0.5) {
        keepItOpportunities++;
      }
      
      // Group by product
      ret.items.forEach(item => {
        const key = item.productId || item.sku;
        if (!productCosts.has(key)) {
          productCosts.set(key, {
            productId: item.productId,
            sku: item.sku,
            title: item.productTitle,
            returnCount: 0,
            totalCost: 0,
            reasons: new Map()
          });
        }
        
        const product = productCosts.get(key);
        product.returnCount++;
        product.totalCost += estimatedCost / ret.items.length;
        
        const reasonCount = product.reasons.get(item.reasonCategory) || 0;
        product.reasons.set(item.reasonCategory, reasonCount + 1);
      });
    });

    const avgReturnCost = totalReturns > 0 ? totalReturnCost / totalReturns : 0;
    const keepItSavings = keepItOpportunities * 2500;

    // Top costly products
    const topCostlyProducts = Array.from(productCosts.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)
      .map(p => {
        let mainReason = 'Unknown';
        let maxCount = 0;
        p.reasons.forEach((count: number, reason: string) => {
          if (count > maxCount) {
            maxCount = count;
            mainReason = reason;
          }
        });
        
        return {
          productId: p.productId,
          sku: p.sku,
          title: p.title,
          totalCost: p.totalCost / 100,
          avgCostPerReturn: (p.totalCost / p.returnCount) / 100,
          mainReason: mainReason?.replace('_', ' ') || 'Not specified'
        };
      });

    res.json({
      success: true,
      summary: {
        totalReturns,
        totalReturnCost: totalReturnCost / 100,
        avgReturnCost: avgReturnCost / 100,
        keepItOpportunities,
        potentialKeepItSavings: keepItSavings / 100,
        supplierChargebackPotential: 0 // Would need defect tracking
      },
      topCostlyProducts,
      costBreakdown: {
        shipping: Math.round(totalReturnCost * 0.4) / 100,
        processing: Math.round(totalReturnCost * 0.2) / 100,
        productLoss: Math.round(totalReturnCost * 0.35) / 100,
        other: Math.round(totalReturnCost * 0.05) / 100
      }
    });

  } catch (error: any) {
    console.error('Cost analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns/metrics - Basic metrics
router.get('/metrics', async (req, res) => {
  try {
    const returns = await prisma.return.findMany({
      include: {
        items: true
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    const totalUnits = returns.reduce((sum, r) => 
      sum + r.items.reduce((s, i) => s + i.quantityReturned, 0), 0
    );
    
    const totalValue = returns.reduce((sum, r) => 
      sum + r.totalReturnValueCents, 0
    );
    
    res.json({
      success: true,
      summary: {
        totalReturns: returns.length,
        totalUnits,
        totalValue: totalValue / 100
      }
    });
    
  } catch (error: any) {
    console.error('Return metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Existing routes remain the same...
// POST /api/v1/returns - Original create endpoint
router.post('/', async (req, res) => {
  try {
    const { 
      orderId, 
      items, 
      customerEmail,
      notes 
    } = req.body;
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { channel: true, items: true }
    });
    
    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const totalReturnValue = items.reduce((sum: number, item: any) => {
      return sum + (item.unitPriceCents * item.quantityReturned);
    }, 0);
    
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber: generateRMANumber(),
        orderId,
        channelId: order.channelId,
        customerEmail: customerEmail || order.customerEmail || '',
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
    
    res.json({
      success: true,
      return: returnRecord
    });
    
  } catch (error: any) {
    console.error('Create return error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
