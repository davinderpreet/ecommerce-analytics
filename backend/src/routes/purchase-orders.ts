// backend/src/routes/purchase-orders.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Generate PO number
const generatePONumber = async (): Promise<string> => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  // Get count of POs this month
  const startOfMonth = new Date(year, date.getMonth(), 1);
  const count = await prisma.purchaseOrder.count({
    where: {
      createdAt: {
        gte: startOfMonth
      }
    }
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `PO-${year}${month}-${sequence}`;
};

// GET /api/v2/inventory/purchase-orders - List all POs
router.get('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      supplierId, 
      search,
      startDate,
      endDate,
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (supplierId) {
      where.supplierId = supplierId;
    }
    
    if (search) {
      where.OR = [
        { poNumber: { contains: search as string, mode: 'insensitive' } },
        { trackingNumber: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate as string);
      if (endDate) where.orderDate.lte = new Date(endDate as string);
    }

    // Get total count
    const totalCount = await prisma.purchaseOrder.count({ where });

    // Get POs with relations
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        },
        _count: {
          select: {
            items: true
          }
        }
      }
    });

    // Calculate summary stats
    const stats = await prisma.purchaseOrder.aggregate({
      where: {
        status: {
          in: ['DRAFT', 'SENT', 'CONFIRMED', 'SHIPPED']
        }
      },
      _sum: {
        totalCost: true
      },
      _count: true
    });

    res.json({
      success: true,
      data: purchaseOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      stats: {
        totalPending: stats._count || 0,
        totalValue: stats._sum.totalCost || 0
      }
    });
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch purchase orders' 
    });
  }
});

// GET /api/v2/inventory/purchase-orders/:id - Get single PO
router.get('/purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              include: {
                inventory: true
              }
            }
          }
        }
      }
    });

    if (!purchaseOrder) {
      res.status(404).json({ 
        success: false, 
        error: 'Purchase order not found' 
      });
    } else {
      res.json({
        success: true,
        data: purchaseOrder
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch purchase order' 
    });
  }
});

// POST /api/v2/inventory/purchase-orders - Create new PO
router.post('/purchase-orders', async (req: Request, res: Response) => {
  try {
    const {
      supplierId,
      items, // Array of { productId, quantity, unitCost }
      expectedDate,
      freightCost = 0,
      notes,
      shippingMethod
    } = req.body;

    if (!supplierId || !items || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Supplier and items are required'
      });
      return;
    }

    // Calculate totals
    let subtotal = 0;
    const processedItems = items.map((item: any) => {
      const totalCost = item.quantity * item.unitCost;
      subtotal += totalCost;
      return {
        ...item,
        totalCost
      };
    });

    const totalCost = subtotal + (parseFloat(freightCost) || 0);
    
    // Allocate freight cost proportionally
    const itemsWithAllocation = processedItems.map((item: any) => ({
      productId: item.productId,
      supplierSku: item.supplierSku || null,
      quantityOrdered: item.quantity,
      quantityReceived: 0,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      freightAllocation: subtotal > 0 ? (item.totalCost / subtotal) * freightCost : 0,
      landedUnitCost: item.unitCost + (subtotal > 0 ? ((item.totalCost / subtotal) * freightCost) / item.quantity : 0)
    }));

    // Generate PO number
    const poNumber = await generatePONumber();

    // Create PO with items
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        status: 'DRAFT',
        subtotal,
        freightCost: parseFloat(freightCost) || 0,
        totalCost,
        currency: 'USD',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes,
        shippingMethod,
        items: {
          create: itemsWithAllocation
        }
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: purchaseOrder
    });
  } catch (error: any) {
    console.error('Error creating purchase order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create purchase order' 
    });
  }
});

// PUT /api/v2/inventory/purchase-orders/:id - Update PO
router.put('/purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check current status - only DRAFT can be edited
    const currentPO = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!currentPO) {
      res.status(404).json({
        success: false,
        error: 'Purchase order not found'
      });
      return;
    }

    if (currentPO.status !== 'DRAFT' && !updateData.status) {
      res.status(400).json({
        success: false,
        error: 'Only draft purchase orders can be edited'
      });
      return;
    }

    // Update PO
    const purchaseOrder = await prisma.purchaseOrder.update({
      where: { id },
      data: updateData,
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: purchaseOrder
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update purchase order' 
    });
  }
});

// POST /api/v2/inventory/purchase-orders/:id/receive - Receive shipment
router.post('/purchase-orders/:id/receive', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      items, // Array of { poItemId, quantityReceived, quantityRejected }
      receivedDate = new Date(),
      notes 
    } = req.body;

    // Get PO with items
    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!purchaseOrder) {
      res.status(404).json({
        success: false,
        error: 'Purchase order not found'
      });
      return;
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update PO items
      for (const item of items) {
        const poItem = purchaseOrder.items.find(i => i.id === item.poItemId);
        if (!poItem) continue;

        // Update POItem
        await tx.pOItem.update({
          where: { id: item.poItemId },
          data: {
            quantityReceived: item.quantityReceived || 0,
            quantityRejected: item.quantityRejected || 0,
            receivedDate: new Date(receivedDate)
          }
        });

        // Update inventory
        if (item.quantityReceived > 0) {
          const inventory = await tx.inventory.findUnique({
            where: { productId: poItem.productId }
          });

          if (inventory) {
            await tx.inventory.update({
              where: { productId: poItem.productId },
              data: {
                quantity: inventory.quantity + item.quantityReceived,
                available: (inventory.available || 0) + item.quantityReceived,
                lastRestockDate: new Date(receivedDate)
              }
            });
          } else {
            // Create inventory record if doesn't exist
            await tx.inventory.create({
              data: {
                productId: poItem.productId,
                quantity: item.quantityReceived,
                available: item.quantityReceived,
                reserved: 0,
                lastRestockDate: new Date(receivedDate)
              }
            });
          }

          // Create inventory movement record
          await tx.inventoryMovement.create({
            data: {
              productId: poItem.productId,
              movementType: 'RECEIPT',
              quantity: item.quantityReceived,
              reason: `PO Receipt: ${purchaseOrder.poNumber}`,
              referenceType: 'po',
              referenceId: id,
              costImpact: poItem.landedUnitCost ? poItem.landedUnitCost * item.quantityReceived : null
            }
          });
        }
      }

      // Check if fully received
      const updatedItems = await tx.pOItem.findMany({
        where: { poId: id }
      });

      const allReceived = updatedItems.every(item => 
        item.quantityReceived + item.quantityRejected >= item.quantityOrdered
      );
      const partialReceived = updatedItems.some(item => 
        item.quantityReceived > 0 || item.quantityRejected > 0
      );

      // Update PO status
      const newStatus = allReceived ? 'RECEIVED' : partialReceived ? 'PARTIAL_RECEIVED' : purchaseOrder.status;

      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: allReceived ? new Date(receivedDate) : null,
          notes: notes ? `${purchaseOrder.notes || ''}\n${notes}` : purchaseOrder.notes
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      return updatedPO;
    });

    res.json({
      success: true,
      message: 'Purchase order received successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Error receiving purchase order:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to receive purchase order' 
    });
  }
});

// DELETE /api/v2/inventory/purchase-orders/:id - Cancel PO
router.delete('/purchase-orders/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id },
      select: { status: true }
    });

    if (!purchaseOrder) {
      res.status(404).json({
        success: false,
        error: 'Purchase order not found'
      });
      return;
    }

    if (purchaseOrder.status === 'RECEIVED' || purchaseOrder.status === 'PARTIAL_RECEIVED') {
      res.status(400).json({
        success: false,
        error: 'Cannot cancel a received purchase order'
      });
      return;
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    res.json({
      success: true,
      message: 'Purchase order cancelled successfully',
      data: updated
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to cancel purchase order' 
    });
  }
});

// GET /api/v2/inventory/purchase-orders/products/:productId/suppliers
// Get suppliers and pricing for a product (for reorder)
router.get('/purchase-orders/products/:productId/suppliers', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;

    const supplierProducts = await prisma.supplierProduct.findMany({
      where: { 
        productId,
        supplier: {
          isActive: true
        }
      },
      include: {
        supplier: true
      },
      orderBy: [
        { isPreferred: 'desc' },
        { costPerUnit: 'asc' }
      ]
    });

    res.json({
      success: true,
      data: supplierProducts
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch suppliers for product' 
    });
  }
});

export default router;
