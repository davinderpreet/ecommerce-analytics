// backend/src/services/inventoryService.ts - SIMPLE VERSION USING EXISTING MODELS
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
          quantity: inventory.quantity - quantity
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
      inventory = await prisma.inventory.create({
        data: {
          productId,
          quantity
        }
      });
    } else {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: inventory.quantity + quantity
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
}

// Export singleton instance
export const inventoryService = new InventoryService();
