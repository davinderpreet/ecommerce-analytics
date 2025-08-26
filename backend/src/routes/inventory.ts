// backend/src/routes/inventory.ts - COMPLETE MINIMAL VERSION
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/v1/inventory - Simple inventory list
router.get('/', async (req, res) => {
  try {
    // Get all products with inventory
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        inventory: true,
        channel: true,
        orderItems: {
          include: { order: true },
          orderBy: { order: { createdAt: 'desc' } },
          take: 50
        }
      }
    });
    
    // Calculate simple metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const inventoryItems = products.map(product => {
      const recentSales = product.orderItems.filter(
        item => item.order.createdAt >= thirtyDaysAgo
      );
      const totalSold = recentSales.reduce((sum, item) => sum + item.quantity, 0);
      const salesVelocity = totalSold / 30;
      const currentStock = product.inventory?.quantity || 0;
      const daysUntilStockout = salesVelocity > 0 ? Math.floor(currentStock / salesVelocity) : 999;
      
      let stockoutRisk = 'low';
      if (daysUntilStockout <= 1) stockoutRisk = 'critical';
      else if (daysUntilStockout <= 3) stockoutRisk = 'high';
      else if (daysUntilStockout <= 7) stockoutRisk = 'medium';
      
      return {
        id: product.id,
        sku: product.sku,
        title: product.title,
        channel: product.channel.name,
        quantity: currentStock,
        available: currentStock,
        reserved: 0,
        incoming: 0,
        reorderPoint: 20,
        reorderQuantity: 100,
        leadTime: 7,
        batchSize: 50,
        stockoutRisk,
        daysUntilStockout,
        lastSold: recentSales[0]?.order.createdAt.toISOString() || null,
        salesVelocity: Math.round(salesVelocity * 10) / 10,
        unitCost: (product.priceCents || 0) / 100,
        totalValue: currentStock * ((product.priceCents || 0) / 100)
      };
    });
    
    const stats = {
      totalProducts: inventoryItems.length,
      totalValue: inventoryItems.reduce((sum, item) => sum + item.totalValue, 0),
      lowStockItems: inventoryItems.filter(item => item.quantity <= 20).length,
      outOfStockItems: inventoryItems.filter(item => item.quantity <= 0).length,
      criticalItems: inventoryItems.filter(item => item.stockoutRisk === 'critical').length,
      avgTurnoverDays: 14,
      totalReserved: 0,
      totalIncoming: 0,
      stockAccuracy: 98.5
    };
    
    const alerts = inventoryItems
      .filter(item => item.stockoutRisk === 'critical' || item.stockoutRisk === 'high')
      .slice(0, 5)
      .map((item, index) => ({
        id: String(index + 1),
        type: item.stockoutRisk,
        product: item.title,
        message: item.stockoutRisk === 'critical' 
          ? `Critical: Only ${item.daysUntilStockout} day(s) of stock remaining`
          : `Low stock: ${item.daysUntilStockout} days until stockout`,
        time: '1 hour ago'
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

// POST /api/v1/inventory/:productId/update - Update quantity
router.post('/:productId/update', async (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    
    if (quantity === undefined || quantity < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid quantity'
      });
    }
    
    let inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) {
      inventory = await prisma.inventory.create({
        data: {
          productId,
          quantity: quantity
        }
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: { quantity }
      });
    }
    
    res.json({
      success: true,
      inventory
    });
    
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
