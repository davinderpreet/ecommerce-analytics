// backend/src/routes/returns-complete.ts
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

// GET /api/v1/orders/search - Search for order by number
router.get('/orders/search', async (req, res) => {
  try {
    const { number } = req.query;
    
    if (!number) {
      res.status(400).json({ error: 'Order number required' });
      return;
    }
    
    const order = await prisma.order.findFirst({
      where: { 
        number: String(number)
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
    
    // Add shipping cost if not present (estimate based on total)
    if (!order.shippingCostCents) {
      // Estimate shipping: $10 base + $2 per $50 of order value
      const baseShipping = 1000; // $10
      const valueBasedShipping = Math.floor(order.totalCents / 5000) * 200; // $2 per $50
      order.shippingCostCents = baseShipping + valueBasedShipping;
    }
    
    res.json({
      success: true,
      order: {
        ...order,
        items: order.items.map(item => ({
          ...item,
          title: item.product?.title || item.title,
          sku: item.product?.sku || item.sku
        }))
      }
    });
    
  } catch (error: any) {
    console.error('Order search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v1/returns/create-with-cost - Create return with cost calculation
router.post('/create-with-cost', async (req, res) => {
  try {
    const { 
      orderId, 
      items, 
      customerEmail,
      notes,
      autoApprove = false
    } = req.body;
    
    // Validate order exists and get shipping info
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

    // Calculate initial return value
    const totalReturnValue = items.reduce((sum: number, item: any) => {
      return sum + (item.unitPriceCents * item.quantityReturned);
    }, 0);

    // Estimate costs
    const originalShippingCost = order.shippingCostCents || 1200; // Default $12
    const returnLabelCost = 1500; // $15 for return label
    const processingCost = 500; // $5 processing
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

    // Create return record with cost awareness
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber: generateRMANumber(),
        orderId,
        channelId: order.channelId,
        customerEmail: customerEmail || order.customerEmail,
        status: autoApprove ? 'approved' : 'pending',
        totalReturnValueCents: totalReturnValue,
        returnLabelCostCents: returnLabelCost,
        processingCostCents: processingCost,
        totalActualLossCents: estimatedTotalCost, // Will be updated after inspection
        keepItRefund: shouldOfferKeepIt,
        notes,
        createdBy: 'system',
        items: {
          create: items.map((item: any) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            sku: item.sku,
            productTitle: item.productTitle,
            quantityReturned: item.quantityReturned,
            quantityRestockable: 0, // Set after inspection
            quantityDamaged: 0, // Set after inspection
            unitPriceCents: item.unitPriceCents,
            totalValueCents: item.unitPriceCents * item.quantityReturned,
            reasonCategory: item.reasonCategory,
            reasonDetail: item.reasonDetail,
            batchNumber: item.batchNumber,
            condition: 'pending_inspection',
            originalCondition: 'new'
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
      return: returnRecord,
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
    const { items } = req.body; // Array of { itemId, condition, restockable, damaged, notes }

    let totalProductLoss = 0;

    // Update each item's condition and calculate loss
    for (const item of items) {
      const returnItem = await prisma.returnItem.findUnique({
        where: { id: item.itemId }
      });

      if (!returnItem) continue;

      // Calculate value loss based on condition
      const conditionImpact: Record<string, number> = {
        'new_unopened': 0,      // No loss
        'opened_unused': 0.10,  // 10% loss
        'like_new': 0.15,       // 15% loss
        'good': 0.30,           // 30% loss
        'fair': 0.50,           // 50% loss
        'poor': 0.70,           // 70% loss
        'damaged': 0.90,        // 90% loss
        'defective': 1.00       // 100% loss
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

      await prisma.returnItem.update({
        where: { id: item.itemId },
        data: {
          inspectedCondition: item.condition,
          inspectionNotes: item.notes,
          quantityRestockable: item.restockable || 0,
          quantityDamaged: item.damaged || 0,
          resaleValueCents: resaleValue,
          resaleChannel,
          disposalRequired: lossPercent === 1
        }
      });
    }

    // Update return with final cost calculation
    const returnData = await prisma.return.findUnique({
      where: { id },
      include: { order: true }
    });

    if (!returnData) {
      res.status(404).json({ error: 'Return not found' });
      return;
    }

    const originalShipping = returnData.order.shippingCostCents || 1200;
    const totalActualLoss = 
      originalShipping + 
      returnData.returnLabelCostCents + 
      returnData.processingCostCents + 
      totalProductLoss -
      returnData.restockingFeeCents;

    await prisma.return.update({
      where: { id },
      data: {
        productValueLossCents: totalProductLoss,
        totalActualLossCents: totalActualLoss,
        status: 'inspected'
      }
    });

    res.json({
      success: true,
      costBreakdown: {
        originalShipping: originalShipping / 100,
        returnLabel: returnData.returnLabelCostCents / 100,
        processing: returnData.processingCostCents / 100,
        productValueLoss: totalProductLoss / 100,
        restockingFee: returnData.restockingFeeCents / 100,
        totalActualLoss: totalActualLoss / 100
      }
    });

  } catch (error: any) {
    console.error('Inspect return error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns - List returns with filters (ENHANCED)
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
    
    // Build the where clause
    const where: Prisma.ReturnWhereInput = {};
    
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }
    
    if (reasonCategory && typeof reasonCategory === 'string' && reasonCategory !== 'all') {
      // This would need to filter by items
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

// GET /api/v1/returns/cost-analysis - Get return cost analytics
router.get('/cost-analysis', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Get all returns in period
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
        }
      }
    });

    // Calculate aggregate metrics
    const totalReturns = returns.length;
    const totalReturnCost = returns.reduce((sum, ret) => sum + (ret.totalActualLossCents || 0), 0);
    const avgReturnCost = totalReturns > 0 ? totalReturnCost / totalReturns : 0;
    
    // Keep-it refund opportunities
    const keepItOpportunities = returns.filter(r => r.keepItRefund).length;
    const keepItSavings = keepItOpportunities * 2500; // Estimated $25 per keep-it

    // Supplier chargeback opportunities
    const chargebackAmount = returns.reduce((sum, ret) => sum + (ret.supplierChargebackCents || 0), 0);

    // Group by product for top costly products
    const productCosts = new Map<string, any>();
    
    returns.forEach(ret => {
      ret.items.forEach(item => {
        const key = item.productId;
        if (!productCosts.has(key)) {
          productCosts.set(key, {
            productId: item.productId,
            sku: item.sku,
            title: item.productTitle,
            returnCount: 0,
            totalCost: 0,
            totalUnits: 0,
            reasons: new Map()
          });
        }
        
        const product = productCosts.get(key);
        product.returnCount++;
        product.totalUnits += item.quantityReturned;
        product.totalCost += (ret.totalActualLossCents || 0) / ret.items.length; // Allocate cost
        
        // Track reasons
        const reasonCount = product.reasons.get(item.reasonCategory) || 0;
        product.reasons.set(item.reasonCategory, reasonCount + 1);
      });
    });

    // Convert to array and sort by cost
    const topCostlyProducts = Array.from(productCosts.values())
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10)
      .map(p => {
        // Find the main reason
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
          returnRate: '0%', // Would need sales data to calculate
          totalCost: p.totalCost / 100,
          avgCostPerReturn: p.totalCost / p.returnCount / 100,
          mainReason: mainReason.replace('_', ' ')
        };
      });

    res.json({
      success: true,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      summary: {
        totalReturns,
        totalReturnCost: totalReturnCost / 100,
        avgReturnCost: avgReturnCost / 100,
        keepItOpportunities,
        potentialKeepItSavings: keepItSavings / 100,
        supplierChargebackPotential: chargebackAmount / 100
      },
      topCostlyProducts,
      costBreakdown: {
        shipping: Math.round(totalReturnCost * 0.4) / 100,
        processing: Math.round(totalReturnCost * 0.2) / 100,
        productLoss: Math.round(totalReturnCost * 0.35) / 100,
        other: Math.round(totalReturnCost * 0.05) / 100
      },
      recommendations: {
        priceAdjustments: [] // Would need product metrics table
      }
    });

  } catch (error: any) {
    console.error('Cost analysis error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v1/returns/metrics - Return metrics
router.get('/metrics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate && typeof startDate === 'string' 
      ? new Date(startDate) 
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate && typeof endDate === 'string' 
      ? new Date(endDate) 
      : new Date();
    
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
    
    res.json({
      success: true,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      dailyMetrics: Object.values(dailyMetrics),
      summary: {
        totalReturns: returns.length,
        totalUnits: returns.reduce((sum, r) => 
          sum + r.items.reduce((s, i) => s + i.quantityReturned, 0), 0
        ),
        totalValue: returns.reduce((sum, r) => 
          sum + r.totalReturnValueCents, 0) / 100
      }
    });
    
  } catch (error: any) {
    console.error('Return metrics error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
