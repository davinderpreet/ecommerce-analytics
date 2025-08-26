// backend/src/services/inventoryService.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface InventoryMetrics {
  stockoutRisk: 'critical' | 'high' | 'medium' | 'low';
  daysUntilStockout: number;
  salesVelocity: number;
  shouldReorder: boolean;
  suggestedReorderQuantity: number;
  estimatedReorderDate: Date | null;
}

export class InventoryService {
  
  /**
   * Sync inventory from Shopify and update local inventory
   */
  async syncInventoryFromShopify(days: number = 1): Promise<void> {
    console.log('🔄 Syncing inventory levels from Shopify...');
    
    // This would connect to Shopify's Inventory API
    // For now, we'll calculate based on orders
    await this.recalculateInventoryFromOrders();
  }
  
  /**
   * Recalculate inventory based on orders
   */
  async recalculateInventoryFromOrders(): Promise<void> {
    const products = await prisma.product.findMany({
      include: {
        inventory: true,
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
    
    for (const product of products) {
      // Ensure inventory record exists
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
      
      // Calculate metrics
      const metrics = await this.calculateInventoryMetrics(product.id);
      
      // Check if we need to create an alert
      await this.checkAndCreateAlerts(product.id, inventory.id, metrics);
    }
  }
  
  /**
   * Calculate inventory metrics for a product
   */
  async calculateInventoryMetrics(productId: string): Promise<InventoryMetrics> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
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
    const totalSold30Days = recentOrders.reduce((sum, item) => sum + item.quantity, 0);
    const salesVelocity = totalSold30Days / 30;
    
    // Get recent week sales for trend
    const recentWeekOrders = recentOrders.filter(
      item => item.order.createdAt >= sevenDaysAgo
    );
    const weekSales = recentWeekOrders.reduce((sum, item) => sum + item.quantity, 0);
    const weekVelocity = weekSales / 7;
    
    // Use the higher velocity (conservative approach)
    const effectiveVelocity = Math.max(salesVelocity, weekVelocity);
    
    // Get current inventory
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) {
      return {
        stockoutRisk: 'critical',
        daysUntilStockout: 0,
        salesVelocity: effectiveVelocity,
        shouldReorder: true,
        suggestedReorderQuantity: 100,
        estimatedReorderDate: new Date()
      };
    }
    
    // Calculate days until stockout
    const availableStock = inventory.availableQuantity || inventory.quantity;
    const daysUntilStockout = effectiveVelocity > 0 
      ? Math.floor(availableStock / effectiveVelocity)
      : 999;
    
    // Determine stockout risk
    let stockoutRisk: 'critical' | 'high' | 'medium' | 'low';
    if (daysUntilStockout <= 1) {
      stockoutRisk = 'critical';
    } else if (daysUntilStockout <= 3) {
      stockoutRisk = 'high';
    } else if (daysUntilStockout <= 7) {
      stockoutRisk = 'medium';
    } else {
      stockoutRisk = 'low';
    }
    
    // Calculate reorder requirements
    const shouldReorder = availableStock <= inventory.reorderPoint;
    const daysOfStock = inventory.reorderQuantity / effectiveVelocity;
    const suggestedReorderQuantity = Math.ceil(
      Math.max(
        inventory.reorderQuantity,
        effectiveVelocity * (inventory.leadTimeDays + inventory.safetyStock)
      )
    );
    
    // Calculate when to reorder
    const daysUntilReorderPoint = inventory.reorderPoint / effectiveVelocity;
    const estimatedReorderDate = daysUntilReorderPoint > 0
      ? new Date(Date.now() + daysUntilReorderPoint * 86400000)
      : new Date();
    
    return {
      stockoutRisk,
      daysUntilStockout,
      salesVelocity: effectiveVelocity,
      shouldReorder,
      suggestedReorderQuantity,
      estimatedReorderDate
    };
  }
  
  /**
   * Check and create inventory alerts
   */
  async checkAndCreateAlerts(
    productId: string, 
    inventoryId: string, 
    metrics: InventoryMetrics
  ): Promise<void> {
    // Check for unresolved alerts
    const existingAlerts = await prisma.stockAlert.findMany({
      where: {
        productId,
        isResolved: false
      }
    });
    
    const inventory = await prisma.inventory.findUnique({
      where: { id: inventoryId }
    });
    
    if (!inventory) return;
    
    const availableStock = inventory.availableQuantity || inventory.quantity;
    
    // Critical stockout alert
    if (metrics.stockoutRisk === 'critical') {
      const existingCritical = existingAlerts.find(
        a => a.alertType === 'out_of_stock' || a.alertType === 'low_stock'
      );
      
      if (!existingCritical) {
        await prisma.stockAlert.create({
          data: {
            productId,
            inventoryId,
            alertType: availableStock <= 0 ? 'out_of_stock' : 'low_stock',
            severity: 'critical',
            thresholdValue: 5,
            currentValue: availableStock,
            message: `Critical: Only ${metrics.daysUntilStockout} days of stock remaining`
          }
        });
      }
    }
    
    // Reorder point alert
    if (metrics.shouldReorder) {
      const existingReorder = existingAlerts.find(
        a => a.alertType === 'reorder_point'
      );
      
      if (!existingReorder) {
        await prisma.stockAlert.create({
          data: {
            productId,
            inventoryId,
            alertType: 'reorder_point',
            severity: 'medium',
            thresholdValue: inventory.reorderPoint,
            currentValue: availableStock,
            message: `Reorder point reached. Suggest ordering ${metrics.suggestedReorderQuantity} units`
          }
        });
      }
    }
    
    // Resolve alerts if conditions improved
    for (const alert of existingAlerts) {
      let shouldResolve = false;
      
      if (alert.alertType === 'low_stock' && metrics.stockoutRisk === 'low') {
        shouldResolve = true;
      } else if (alert.alertType === 'reorder_point' && !metrics.shouldReorder) {
        shouldResolve = true;
      }
      
      if (shouldResolve) {
        await prisma.stockAlert.update({
          where: { id: alert.id },
          data: {
            isResolved: true,
            resolvedAt: new Date()
          }
        });
      }
    }
  }
  
  /**
   * Record inventory movement
   */
  async recordMovement(
    productId: string,
    quantity: number,
    type: string,
    referenceType?: string,
    referenceId?: string,
    notes?: string
  ): Promise<void> {
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    });
    
    if (!inventory) return;
    
    await prisma.inventoryMovement.create({
      data: {
        inventoryId: inventory.id,
        productId,
        movementType: type,
        quantity,
        referenceType,
        referenceId,
        notes
      }
    });
    
    // Update inventory quantities based on movement type
    const updates: any = {};
    
    if (type === 'sale') {
      updates.quantity = inventory.quantity - Math.abs(quantity);
      updates.availableQuantity = (inventory.availableQuantity || inventory.quantity) - Math.abs(quantity);
    } else if (type === 'restock') {
      updates.quantity = inventory.quantity + Math.abs(quantity);
      updates.availableQuantity = (inventory.availableQuantity || 0) + Math.abs(quantity);
      updates.lastRestockDate = new Date();
    } else if (type === 'reserved') {
      updates.availableQuantity = (inventory.availableQuantity || inventory.quantity) - Math.abs(quantity);
      updates.reservedQuantity = (inventory.reservedQuantity || 0) + Math.abs(quantity);
    } else if (type === 'unreserved') {
      updates.availableQuantity = (inventory.availableQuantity || 0) + Math.abs(quantity);
      updates.reservedQuantity = Math.max(0, (inventory.reservedQuantity || 0) - Math.abs(quantity));
    }
    
    if (Object.keys(updates).length > 0) {
      await prisma.inventory.update({
        where: { id: inventory.id },
        data: updates
      });
    }
  }
  
  /**
   * Create purchase order suggestion
   */
  async createPurchaseOrderSuggestion(productIds: string[]): Promise<any> {
    const suggestions = [];
    
    for (const productId of productIds) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        include: {
          inventory: true,
          productSuppliers: {
            include: {
              supplier: true
            },
            where: {
              isPreferred: true
            }
          }
        }
      });
      
      if (!product || !product.inventory) continue;
      
      const metrics = await this.calculateInventoryMetrics(productId);
      
      if (metrics.shouldReorder) {
        suggestions.push({
          product: {
            id: product.id,
            sku: product.sku,
            title: product.title
          },
          currentStock: product.inventory.quantity,
          reorderPoint: product.inventory.reorderPoint,
          suggestedQuantity: metrics.suggestedReorderQuantity,
          supplier: product.productSuppliers[0]?.supplier || null,
          estimatedCost: (product.priceCents || 0) * metrics.suggestedReorderQuantity / 100,
          urgency: metrics.stockoutRisk
        });
      }
    }
    
    return suggestions;
  }
}

// Export singleton instance
export const inventoryService = new InventoryService();
