// backend/src/routes/inventory.ts - CORRECT VERSION USING DB INVENTORY
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/v1/inventory - Get actual inventory from database
router.get('/', async (req, res) => {
  try {
    // Get all products with their actual inventory from DB
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        inventory: true,  // This gets the ACTUAL inventory from inventory table
        channel: true,
        orderItems: {
          include: { order: true },
          orderBy: { order: { createdAt: 'desc' } },
          take: 50
        }
      }
    });
    
    // Calculate sales metrics for velocity only (not for inventory quantity)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const inventoryItems = products.map(product => {
      // Get ACTUAL inventory quantity from database
      const actualQuantity = product.inventory?.quantity || 0;
      
      // Calculate sales velocity for prediction only
      const recentSales = product.orderItems.filter(
        item => item.order.createdAt >= thirtyDaysAgo
      );
      const totalSold = recentSales.reduce((sum, item) => sum + item.quantity, 0);
      const salesVelocity = totalSold / 30;
      
      // Calculate days until stockout based on actual inventory and velocity
      const daysUntilStockout = salesVelocity > 0 
        ? Math.floor(actualQuantity / salesVelocity)
        : 999;
      
      // Determine risk level based on actual inventory
      let stockoutRisk = 'low';
      if (actualQuantity === 0) stockoutRisk = 'critical';
      else if (daysUntilStockout <= 3) stockoutRisk = 'high';
      else if (daysUntilStockout <= 7) stockoutRisk = 'medium';
      
      return {
        id: product.id,
        sku: product.sku,
        title: product.title,
        channel: product.channel.name,
        quantity: actualQuantity,  // ACTUAL from DB
        available: actualQuantity,  // ACTUAL from DB
        reserved: 0,
        incoming: 0,
        reorderPoint: 20,
        reorderQuantity: 100,
        leadTime: 7,
        batchSize: 50,
        stockoutRisk,
        daysUntilStockout: daysUntilStockout > 999 ? 999 : daysUntilStockout,
        lastSold: recentSales[0]?.order.createdAt.toISOString() || null,
        salesVelocity: Math.round(salesVelocity * 10) / 10,
        unitCost: (product.priceCents || 0) / 100,
        totalValue: actualQuantity * ((product.priceCents || 0) / 100)
      };
    });
    
    // Calculate stats based on actual inventory
    const stats = {
      totalProducts: inventoryItems.length,
      totalValue: inventoryItems.reduce((sum, item) => sum + item.totalValue, 0),
      lowStockItems: inventoryItems.filter(item => item.quantity <= 20 && item.quantity > 0).length,
      outOfStockItems: inventoryItems.filter(item => item.quantity === 0).length,
      criticalItems: inventoryItems.filter(item => item.stockoutRisk === 'critical' || item.stockoutRisk === 'high').length,
      avgTurnoverDays: 14,
      totalReserved: 0,
      totalIncoming: 0,
      stockAccuracy: 98.5
    };
    
    // Generate alerts based on actual inventory levels
    const alerts = inventoryItems
      .filter(item => item.stockoutRisk === 'critical' || item.stockoutRisk === 'high')
      .slice(0, 5)
      .map((item, index) => ({
        id: String(index + 1),
        type: item.stockoutRisk,
        product: item.title,
        message: item.quantity === 0 
          ? `Out of stock!`
          : item.stockoutRisk === 'critical' 
          ? `Critical: Only ${item.quantity} units left (${item.daysUntilStockout} days remaining)`
          : `Low stock: ${item.quantity} units (${item.daysUntilStockout} days until stockout)`,
        time: 'Real-time'
      }));
    
    res.json({
      success: true,
      items: inventoryItems,
      stats,
      alerts
    });
    
  } catch (error: any) {
    console.error('Inventory fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch inventory' 
    });
  }
});

// POST /api/v1/inventory/seed - Initialize inventory with realistic quantities
router.post('/seed', async (req, res) => {
  try {
    // Get all products
    const products = await prisma.product.findMany({
      include: {
        orderItems: {
          include: { order: true },
          orderBy: { order: { createdAt: 'desc' } },
          take: 30
        }
      }
    });
    
    const results = [];
    
    for (const product of products) {
      // Calculate a realistic initial quantity based on sales history
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSales = product.orderItems.filter(
        item => item.order.createdAt >= thirtyDaysAgo
      );
      const avgMonthlySales = recentSales.reduce((sum, item) => sum + item.quantity, 0);
      
      // Set initial inventory to 2-3 months of average sales
      // If no sales history, set a default of 50 units
      let initialQuantity = 50;
      if (avgMonthlySales > 0) {
        initialQuantity = Math.floor(avgMonthlySales * 2.5); // 2.5 months of stock
      }
      
      // Ensure minimum of 10 units
      initialQuantity = Math.max(10, initialQuantity);
      
      // Check if inventory record exists
      let inventory = await prisma.inventory.findUnique({
        where: { productId: product.id }
      });
      
      if (!inventory) {
        inventory = await prisma.inventory.create({
          data: {
            productId: product.id,
            quantity: initialQuantity
          }
        });
      } else {
        inventory = await prisma.inventory.update({
          where: { id: inventory.id },
          data: { quantity: initialQuantity }
        });
      }
      
      results.push({
        sku: product.sku,
        title: product.title,
        quantity: initialQuantity,
        monthlySales: avgMonthlySales
      });
    }
    
    res.json({
      success: true,
      message: `Set inventory for ${results.length} products based on sales history`,
      results
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/v1/inventory/:productId/update - Update inventory quantity
router.post('/:productId/update', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    
    if (quantity === undefined || quantity < 0) {
      res.status(400).json({
        success: false,
        error: 'Invalid quantity'
      });
      return;
    }
    
    // Update or create inventory record
    let inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          productId,
          quantity: Number(quantity)
        }
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: Number(quantity) }
      });
    }
    
    res.json({
      success: true,
      inventory,
      message: `Inventory updated to ${quantity} units`
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/v1/inventory/:productId/adjust - Adjust inventory (add/subtract)
router.post('/:productId/adjust', async (req, res) => {
  try {
    const { productId } = req.params;
    const { adjustment, reason } = req.body;
    
    if (!adjustment || isNaN(adjustment)) {
      res.status(400).json({
        success: false,
        error: 'Invalid adjustment amount'
      });
      return;
    }
    
    // Get current inventory
    let inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) {
      // Create with adjustment as initial quantity
      inventory = await prisma.inventory.create({
        data: {
          productId,
          quantity: Math.max(0, Number(adjustment))
        }
      });
    } else {
      // Adjust existing quantity
      const newQuantity = Math.max(0, inventory.quantity + Number(adjustment));
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity: newQuantity }
      });
    }
    
    res.json({
      success: true,
      inventory,
      adjustment: Number(adjustment),
      reason,
      message: `Inventory ${adjustment > 0 ? 'increased' : 'decreased'} by ${Math.abs(adjustment)} units`
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
