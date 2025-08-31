// backend/src/routes/inventory.ts - FIXED VERSION
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { inventoryService } from '../services/inventoryService';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/inventory - Get all inventory items with metrics
router.get('/', async (req: Request, res: Response) => {
  try {
    const { filter = 'all', sortBy = 'risk' } = req.query;
    
    // Get all active products with inventory
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        inventory: true,
        channel: true,
        orderItems: {
          where: {
            order: {
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
              }
            }
          },
          include: {
            order: true
          }
        }
      }
    });
    
    // Calculate metrics for each product
    const inventoryItems = await Promise.all(products.map(async (product) => {
      const inventory = product.inventory;
      const currentQuantity = inventory?.quantity || 0;
      
      // Calculate sales velocity
      const totalSold = product.orderItems.reduce((sum, item) => sum + item.quantity, 0);
      const salesVelocity = totalSold / 30; // Daily average
      
      // Calculate days until stockout
      const daysUntilStockout = salesVelocity > 0 
        ? Math.floor(currentQuantity / salesVelocity)
        : 999;
      
      // Determine risk level
      let stockoutRisk = 'low';
      if (currentQuantity === 0) stockoutRisk = 'critical';
      else if (daysUntilStockout <= 1) stockoutRisk = 'critical';
      else if (daysUntilStockout <= 3) stockoutRisk = 'high';
      else if (daysUntilStockout <= 7) stockoutRisk = 'medium';
      
      // Calculate reorder info using product fields
      const leadTime = product.leadTimeDays || inventory?.leadTimeDays || 7;
      const safetyStock = product.safetyStockDays || inventory?.safetyStock || 3;
      const reorderPoint = Math.ceil(salesVelocity * (leadTime + safetyStock));
      const shouldReorderNow = currentQuantity <= reorderPoint;
      
      // Calculate reorder date safely
      let reorderDate = null;
      let reorderDateStr = null;
      
      if (shouldReorderNow) {
        reorderDate = new Date();
      } else if (salesVelocity > 0) {
        const daysUntilReorder = Math.max(0, (currentQuantity - reorderPoint) / salesVelocity);
        reorderDate = new Date(Date.now() + daysUntilReorder * 24 * 60 * 60 * 1000);
      }
      
      // Only convert to ISO string if date is valid
      if (reorderDate && !isNaN(reorderDate.getTime())) {
        reorderDateStr = reorderDate.toISOString();
      }
      
      // Calculate next restock date safely
      let nextRestockDateStr = null;
      if (inventory?.nextRestockDate) {
        const nextRestockDate = new Date(inventory.nextRestockDate);
        if (!isNaN(nextRestockDate.getTime())) {
          nextRestockDateStr = nextRestockDate.toISOString();
        }
      }
      
      // Calculate last restock date safely
      let lastRestockDateStr = null;
      if (inventory?.lastRestockDate) {
        const lastRestockDate = new Date(inventory.lastRestockDate);
        if (!isNaN(lastRestockDate.getTime())) {
          lastRestockDateStr = lastRestockDate.toISOString();
        }
      }
      
      return {
        id: product.id,
        sku: product.sku,
        title: product.title,
        platform: product.channel?.name || 'Unknown',
        channelCode: product.channel?.code || 'unknown',
        quantity: currentQuantity,
        available: inventory?.available || 0,
        reserved: inventory?.reserved || 0,
        incoming: inventory?.incoming || 0,
        salesVelocity: Math.round(salesVelocity * 10) / 10,
        daysUntilStockout,
        stockoutRisk,
        reorderPoint,
        reorderQuantity: product.batchSize || inventory?.reorderQuantity || 100,
        shouldReorderNow,
        reorderDate: reorderDateStr,
        leadTime,
        batchSize: product.batchSize || 50,
        moq: product.moq || 100,
        safetyStock,
        supplierName: product.supplierName || 'Default Supplier',
        supplierCountry: product.supplierCountry || 'China',
        shippingMethod: product.shippingMethod || 'Sea',
        lastRestockDate: lastRestockDateStr,
        nextRestockDate: nextRestockDateStr,
        inventoryId: inventory?.id || null
      };
    }));
    
    // Sort based on query parameter
    let sortedItems = [...inventoryItems];
    switch (sortBy) {
      case 'quantity':
        sortedItems.sort((a, b) => a.quantity - b.quantity);
        break;
      case 'days_until_stockout':
        sortedItems.sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);
        break;
      case 'risk':
      default:
        const riskOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
        sortedItems.sort((a, b) => riskOrder[a.stockoutRisk] - riskOrder[b.stockoutRisk]);
    }
    
    // Calculate summary stats
    const stats = {
      totalProducts: inventoryItems.length,
      totalValue: inventoryItems.reduce((sum, item) => sum + (item.quantity * 50), 0), // Placeholder value
      lowStockItems: inventoryItems.filter(item => item.stockoutRisk === 'high' || item.stockoutRisk === 'critical').length,
      criticalItems: inventoryItems.filter(item => item.stockoutRisk === 'critical').length,
      outOfStock: inventoryItems.filter(item => item.quantity === 0).length
    };
    
    res.json({
      success: true,
      data: sortedItems,
      stats,
      alerts: sortedItems.filter(item => item.shouldReorderNow).map(item => ({
        productId: item.id,
        sku: item.sku,
        title: item.title,
        currentStock: item.quantity,
        reorderPoint: item.reorderPoint,
        message: `Time to reorder ${item.title} - Stock at ${item.quantity} units`
      }))
    });
    
  } catch (error: any) {
    console.error('Inventory fetch error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch inventory' 
    });
  }
});

// POST /api/v1/inventory/:productId/update - Update inventory quantity
router.post('/:productId/update', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;
    
    const inventory = await inventoryService.updateInventory(productId, quantity);
    
    res.json({
      success: true,
      message: 'Inventory updated successfully',
      data: inventory
    });
    
  } catch (error: any) {
    console.error('Inventory update error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update inventory' 
    });
  }
});

// POST /api/v1/inventory/seed - Seed inventory with test data
router.post('/seed', async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { inventory: true }
    });
    
    let created = 0;
    let updated = 0;
    
    for (const product of products) {
      const randomQuantity = Math.floor(Math.random() * 200) + 50;
      const randomReserved = Math.floor(Math.random() * 20);
      const randomIncoming = Math.floor(Math.random() * 100);
      
      if (!product.inventory) {
        await prisma.inventory.create({
          data: {
            productId: product.id,
            quantity: randomQuantity,
            available: randomQuantity - randomReserved,
            reserved: randomReserved,
            incoming: randomIncoming,
            reorderPoint: 20,
            reorderQuantity: 100,
            leadTimeDays: 7 + Math.floor(Math.random() * 14),
            safetyStock: 10 + Math.floor(Math.random() * 20),
            minOrderQuantity: 50,
            lastRestockDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
            nextRestockDate: new Date(Date.now() + Math.random() * 14 * 24 * 60 * 60 * 1000),
            notes: 'Auto-generated inventory record'
          }
        });
        created++;
      } else {
        await prisma.inventory.update({
          where: { id: product.inventory.id },
          data: {
            quantity: randomQuantity,
            available: randomQuantity - randomReserved,
            reserved: randomReserved,
            incoming: randomIncoming
          }
        });
        updated++;
      }
    }
    
    res.json({
      success: true,
      message: `Inventory seeded: ${created} created, ${updated} updated`
    });
    
  } catch (error: any) {
    console.error('Inventory seed error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to seed inventory' 
    });
  }
});

// POST /api/v1/inventory/sync-shopify - Sync inventory from Shopify
router.post('/sync-shopify', async (req: Request, res: Response) => {
  try {
    const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
    const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
    const API_VER = '2024-07';
    
    // Get channel
    const channel = await prisma.channel.findFirst({
      where: { code: 'shopify' }
    });
    
    if (!channel) {
      res.status(400).json({ 
        success: false, 
        error: 'Shopify channel not found' 
      });
      return;
    }
    
    // Get all products with variants from Shopify
    const query = `
      query {
        products(first: 250) {
          edges {
            node {
              id
              title
              variants(first: 100) {
                edges {
                  node {
                    id
                    sku
                    inventoryQuantity
                    inventoryItem {
                      id
                      tracked
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const response = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN,
      },
      body: JSON.stringify({ query })
    });
    
    const data: any = await response.json();
    const products = data?.data?.products?.edges || [];
    
    let updatedCount = 0;
    const results = [];
    
    for (const edge of products) {
      const product = edge.node;
      
      for (const variantEdge of product.variants.edges) {
        const variant = variantEdge.node;
        
        if (!variant.sku) continue;
        
        // FIXED: Use compound unique constraint for product lookup
        const dbProduct = await prisma.product.findUnique({
          where: {
            channelId_sku: {
              channelId: channel.id,
              sku: variant.sku
            }
          }
        });
        
        if (dbProduct) {
          // Update or create inventory record
          let inventory = await prisma.inventory.findUnique({
            where: { productId: dbProduct.id }
          });
          
          if (!inventory) {
            // FIXED: Add required channelId when creating inventory
            inventory = await prisma.inventory.create({
              data: {
                productId: dbProduct.id,
                quantity: variant.inventoryQuantity,
                reserved: 0,
                available: variant.inventoryQuantity
              }
            });
          } else {
            inventory = await prisma.inventory.update({
              where: { id: inventory.id },
              data: {
                quantity: variant.inventoryQuantity,
                available: variant.inventoryQuantity - (inventory.reserved || 0)
              }
            });
          }
          
          updatedCount++;
          results.push({
            sku: variant.sku,
            quantity: variant.inventoryQuantity,
            tracked: variant.inventoryItem?.tracked
          });
        }
      }
    }
    
    console.log(`✅ Synced ${updatedCount} inventory items`);
    
    res.json({
      success: true,
      message: `Synced ${updatedCount} inventory items from Shopify`,
      results
    });
    
  } catch (error: any) {
    console.error('Shopify inventory sync error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to sync inventory from Shopify' 
    });
  }
});

// GET /api/v1/inventory/low-stock - Get low stock alerts
router.get('/low-stock', async (req: Request, res: Response) => {
  try {
    const threshold = parseInt(req.query.threshold as string) || 20;
    
    const lowStockProducts = await inventoryService.getLowStockProducts(threshold);
    
    res.json({
      success: true,
      threshold,
      count: lowStockProducts.length,
      products: lowStockProducts.map(p => ({
        id: p.id,
        sku: p.sku,
        title: p.title,
        channel: p.channel.name,
        currentStock: p.inventory?.quantity || 0,
        threshold
      }))
    });
    
  } catch (error: any) {
    console.error('Low stock check error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to check low stock' 
    });
  }
});

export default router;
