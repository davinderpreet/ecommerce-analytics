// backend/src/services/inventoryService.ts - COMPLETE FIXED VERSION
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class InventoryService {
  
  /**
   * Calculate inventory metrics for a product
   */
  async calculateMetrics(productId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Get recent sales
    const recentOrders = await prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        }
      },
      include: {
        order: true
      }
    });
    
    // Calculate sales velocity
    const totalSold = recentOrders.reduce((sum, item) => sum + item.quantity, 0);
    const salesVelocity = totalSold / 30;
    
    // Get current inventory
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    const currentStock = inventory?.quantity || 0;
    const daysUntilStockout = salesVelocity > 0 
      ? Math.floor(currentStock / salesVelocity)
      : 999;
    
    // Determine risk level
    let stockoutRisk = 'low';
    if (daysUntilStockout <= 1) stockoutRisk = 'critical';
    else if (daysUntilStockout <= 3) stockoutRisk = 'high';
    else if (daysUntilStockout <= 7) stockoutRisk = 'medium';
    
    return {
      salesVelocity,
      daysUntilStockout,
      stockoutRisk,
      currentStock,
      shouldReorder: currentStock <= 20, // Default reorder point
      suggestedReorderQuantity: 100 // Default quantity
    };
  }
  
  /**
   * Update inventory after a sale
   */
  async recordSale(productId: string, quantity: number) {
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (inventory && inventory.quantity >= quantity) {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: inventory.quantity - quantity,
          available: Math.max(0, inventory.available - quantity)
        }
      });
    }
  }
  
  /**
   * Restock inventory
   */
  async restock(productId: string, quantity: number) {
    let inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) {
      // FIXED: Get product to get channelId
      const product = await prisma.product.findUnique({
        where: { id: productId }
      });
      
      if (!product) {
        throw new Error('Product not found');
      }
      
      // FIXED: Add required channelId when creating inventory
      inventory = await prisma.inventory.create({
        data: {
          productId,
          channelId: product.channelId,
          quantity,
          reserved: 0,
          available: quantity
        }
      });
    } else {
      inventory = await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: inventory.quantity + quantity,
          available: inventory.available + quantity
        }
      });
    }
    
    return inventory;
  }
  
  /**
   * Get low stock products
   */
  async getLowStockProducts(threshold: number = 20) {
    const products = await prisma.product.findMany({
      where: {
        active: true
      },
      include: {
        inventory: true,
        channel: true
      }
    });
    
    return products.filter(p => {
      const stock = p.inventory?.quantity || 0;
      return stock <= threshold;
    });
  }
  
  /**
   * Reserve inventory for an order
   */
  async reserveInventory(productId: string, quantity: number) {
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory || inventory.available < quantity) {
      throw new Error('Insufficient inventory available');
    }
    
    return await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        reserved: inventory.reserved + quantity,
        available: inventory.available - quantity
      }
    });
  }
  
  /**
   * Release reserved inventory
   */
  async releaseReservedInventory(productId: string, quantity: number) {
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) {
      throw new Error('Inventory record not found');
    }
    
    return await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        reserved: Math.max(0, inventory.reserved - quantity),
        available: inventory.available + quantity
      }
    });
  }
  
  /**
   * Commit reserved inventory (convert reserved to sold)
   */
  async commitReservedInventory(productId: string, quantity: number) {
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory || inventory.reserved < quantity) {
      throw new Error('Insufficient reserved inventory');
    }
    
    return await prisma.inventory.update({
      where: { id: inventory.id },
      data: {
        reserved: inventory.reserved - quantity,
        quantity: inventory.quantity - quantity
      }
    });
  }
  
  /**
   * Get inventory summary stats
   */
  async getInventoryStats() {
    const products = await prisma.product.findMany({
      where: { active: true },
      include: { inventory: true }
    });
    
    const totalProducts = products.length;
    const outOfStock = products.filter(p => (p.inventory?.quantity || 0) === 0).length;
    const lowStock = products.filter(p => {
      const qty = p.inventory?.quantity || 0;
      return qty > 0 && qty <= 20;
    }).length;
    
    const totalValue = products.reduce((sum, p) => {
      const qty = p.inventory?.quantity || 0;
      const cost = p.costCents || 0;
      return sum + (qty * cost);
    }, 0);
    
    return {
      totalProducts,
      outOfStock,
      lowStock,
      totalValue: totalValue / 100,
      inStock: totalProducts - outOfStock
    };
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
