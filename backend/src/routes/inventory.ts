// backend/src/routes/inventory.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { inventoryService } from '../services/inventoryService';

const router = express.Router();
const prisma = new PrismaClient();

// Helper function to calculate days until stockout
function calculateDaysUntilStockout(quantity: number, salesVelocity: number): number {
  if (salesVelocity <= 0) return 999;
  return Math.max(0, Math.floor(quantity / salesVelocity));
}

// Helper function to determine risk level
function determineRiskLevel(daysUntilStockout: number): string {
  if (daysUntilStockout <= 1) return 'critical';
  if (daysUntilStockout <= 3) return 'high';
  if (daysUntilStockout <= 7) return 'medium';
  return 'low';
}

/**
 * GET /api/v1/inventory
 * Get all inventory items with metrics
 */
router.get('/', async (req, res) => {
  try {
    const platform = req.query.platform as string || 'all';
    
    // Build where clause for filtering by platform
    const whereClause: any = { active: true };
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ 
        where: { code: platform } 
      });
      if (channel) {
        whereClause.channelId = channel.id;
      }
    }
    
    // Fetch products with inventory and recent sales
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        inventory: true,
        channel: true,
        orderItems: {
          include: {
            order: true
          },
          orderBy: {
            order: {
              createdAt: 'desc'
            }
          },
          take: 100
        }
      }
    });
    
    // Calculate metrics for each product
    const inventoryItems = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const product of products) {
      // Ensure inventory exists
      let inventory = product.inventory;
      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            productId: product.id,
            quantity: 0,
            availableQuantity: 0,
            reservedQuantity: 0,
            incomingQuantity: 0,
            reorderPoint: 20,
            reorderQuantity: 100,
            leadTimeDays: 7,
            safetyStock: 10
          }
        });
      }
      
      // Calculate sales velocity
      const recentSales = product.orderItems.filter(
        item => item.order.createdAt >= thirtyDaysAgo
      );
      const totalSold = recentSales.reduce((sum, item) => sum + item.quantity, 0);
      const salesVelocity = totalSold / 30;
      
      // Get last sale date
      const lastSold = recentSales.length > 0 
        ? recentSales[0].order.createdAt.toISOString()
        : null;
      
      // Calculate stock metrics
      const availableQty = inventory.availableQuantity || inventory.quantity;
      const daysUntilStockout = calculateDaysUntilStockout(availableQty, salesVelocity);
      const stockoutRisk = determineRiskLevel(daysUntilStockout);
      
      inventoryItems.push({
        id: product.id,
        sku: product.sku,
        title: product.title,
        channel: product.channel.name,
        quantity: inventory.quantity,
        available: availableQty,
        reserved: inventory.reservedQuantity || 0,
        incoming: inventory.incomingQuantity || 0,
        reorderPoint: inventory.reorderPoint,
        reorderQuantity: inventory.reorderQuantity,
        leadTime: inventory.leadTimeDays,
        batchSize: inventory.minOrderQuantity || 1,
        stockoutRisk,
        daysUntilStockout,
        lastSold,
        salesVelocity: Math.round(salesVelocity * 10) / 10,
        unitCost: (product.priceCents || 0) / 100,
        totalValue: inventory.quantity * ((product.priceCents || 0) / 100)
      });
    }
    
    // Get active alerts
    const alerts = await prisma.stockAlert.findMany({
      where: {
        isResolved: false
      },
      include: {
        product: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });
    
    // Format alerts for response
    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      type: alert.severity,
      product: alert.product.title,
      message: alert.message,
      time: getRelativeTime(alert.createdAt)
    }));
    
    // Calculate statistics
    const stats = {
      totalProducts: inventoryItems.length,
      totalValue: inventoryItems.reduce((sum, item) => sum + item.totalValue, 0),
      lowStockItems: inventoryItems.filter(item => item.quantity <= item.reorderPoint).length,
      outOfStockItems: inventoryItems.filter(item => item.available <= 0).length,
      criticalItems: inventoryItems.filter(item => item.stockoutRisk === 'critical').length,
      avgTurnoverDays: 14, // This would be calculated from historical data
      totalReserved: inventoryItems.reduce((sum, item) => sum + item.reserved, 0),
      totalIncoming: inventoryItems.reduce((sum, item) => sum + item.incoming, 0),
      stockAccuracy: 98.5 // This would come from cycle counts
    };
    
    res.json({
      success: true,
      items: inventoryItems,
      stats,
      alerts: formattedAlerts
    });
    
  } catch (error: any) {
    console.error('Inventory fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch inventory' 
    });
  }
});

/**
 * POST /api/v1/inventory/sync
 * Sync inventory from Shopify
 */
router.post('/sync', async (req, res) => {
  try {
    await inventoryService.syncInventoryFromShopify();
    res.json({ 
      success: true, 
      message: 'Inventory sync completed' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/v1/inventory/:productId
 * Get detailed inventory for a specific product
 */
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        inventory: {
          include: {
            movements: {
              orderBy: { createdAt: 'desc' },
              take: 50
            }
          }
        },
        channel: true,
        productSuppliers: {
          include: { supplier: true }
        },
        orderItems: {
          include: { order: true },
          orderBy: { order: { createdAt: 'desc' } },
          take: 30
        }
      }
    });
    
    if (!product) {
      return res.status(404).json({ 
        success: false, 
        error: 'Product not found' 
      });
    }
    
    // Calculate metrics
    const metrics = await inventoryService.calculateInventoryMetrics(productId);
    
    res.json({
      success: true,
      product,
      metrics,
      movements: product.inventory?.movements || [],
      suppliers: product.productSuppliers
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/v1/inventory/:productId/adjust
 * Adjust inventory levels manually
 */
router.post('/:productId/adjust', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, reason, notes } = req.body;
    
    await inventoryService.recordMovement(
      productId,
      quantity,
      'adjustment',
      'manual',
      null,
      `${reason}: ${notes}`
    );
    
    res.json({ 
      success: true, 
      message: 'Inventory adjusted successfully' 
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * POST /api/v1/inventory/reorder
 * Create a purchase order for reordering
 */
router.post('/reorder', async (req, res) => {
  try {
    const { productIds, supplierId } = req.body;
    
    const suggestions = await inventoryService.createPurchaseOrderSuggestion(productIds);
    
    if (suggestions.length === 0) {
      return res.json({
        success: false,
        message: 'No products need reordering'
      });
    }
    
    // Create purchase order
    const orderNumber = `PO-${Date.now()}`;
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        orderNumber,
        supplierId,
        status: 'draft',
        totalItems: suggestions.length,
        totalQuantity: suggestions.reduce((sum: number, s: any) => sum + s.suggestedQuantity, 0),
        subtotalCents: suggestions.reduce((sum: number, s: any) => sum + (s.estimatedCost * 100), 0),
        orderDate: new Date()
      }
    });
    
    // Create purchase order items
    for (const suggestion of suggestions) {
      await prisma.purchaseOrderItem.create({
        data: {
          purchaseOrderId: purchaseOrder.id,
          productId: suggestion.product.id,
          quantityOrdered: suggestion.suggestedQuantity,
          unitCostCents: Math.round(suggestion.estimatedCost * 100 / suggestion.suggestedQuantity)
        }
      });
    }
    
    res.json({
      success: true,
      purchaseOrder,
      suggestions
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * GET /api/v1/inventory/alerts
 * Get all active inventory alerts
 */
router.get('/alerts/active', async (req, res) => {
  try {
    const alerts = await prisma.stockAlert.findMany({
      where: { isResolved: false },
      include: {
        product: true,
        inventory: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    res.json({
      success: true,
      alerts,
      count: alerts.length
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * PUT /api/v1/inventory/alerts/:alertId/resolve
 * Resolve an inventory alert
 */
router.put('/alerts/:alertId/resolve', async (req, res) => {
  try {
    const { alertId } = req.params;
    
    await prisma.stockAlert.update({
      where: { id: alertId },
      data: {
        isResolved: true,
        resolvedAt: new Date()
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Alert resolved' 
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Helper function to get relative time
function getRelativeTime(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  
  return date.toLocaleDateString();
}

export default router;
