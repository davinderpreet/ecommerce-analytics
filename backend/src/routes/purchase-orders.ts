// backend/src/routes/purchase-orders.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();
const prisma = new PrismaClient();

// Helper function to convert Decimal to number
const toNumber = (value: Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return parseFloat(value.toString());
};

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

    // Convert Decimal values to numbers for JSON serialization
    const serializedPOs = purchaseOrders.map(po => ({
      ...po,
      subtotal: toNumber(po.subtotal),
      freightCost: toNumber(po.freightCost),
      insuranceCost: toNumber(po.insuranceCost),
      customsDuty: toNumber(po.customsDuty),
      otherFees: toNumber(po.otherFees),
      handlingFee: toNumber((po as any).handlingFee),
      airShippingFee: toNumber((po as any).airShippingFee),
      amazonShippingFee: toNumber((po as any).amazonShippingFee),
      miscellaneousFee: toNumber((po as any).miscellaneousFee),
      totalCost: toNumber(po.totalCost),
      exchangeRate: toNumber(po.exchangeRate),
      items: po.items.map(item => ({
        ...item,
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.unitCost) * item.quantityOrdered,
        freightAllocation: toNumber(item.freightAllocation),
        dutyAllocation: toNumber(item.dutyAllocation),
        otherCostAllocation: toNumber(item.otherCostAllocation),
        landedUnitCost: toNumber(item.landedUnitCost)
      }))
    }));

    res.json({
      success: true,
      data: serializedPOs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      },
      stats: {
        totalPending: stats._count || 0,
        totalValue: toNumber(stats._sum.totalCost) || 0
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
      return;
    }

    // Convert Decimal values to numbers for JSON serialization
    const serializedPO = {
      ...purchaseOrder,
      subtotal: toNumber(purchaseOrder.subtotal),
      freightCost: toNumber(purchaseOrder.freightCost),
      insuranceCost: toNumber(purchaseOrder.insuranceCost),
      customsDuty: toNumber(purchaseOrder.customsDuty),
      otherFees: toNumber(purchaseOrder.otherFees),
      handlingFee: toNumber((purchaseOrder as any).handlingFee),
      airShippingFee: toNumber((purchaseOrder as any).airShippingFee),
      amazonShippingFee: toNumber((purchaseOrder as any).amazonShippingFee),
      miscellaneousFee: toNumber((purchaseOrder as any).miscellaneousFee),
      costAllocationMethods: (purchaseOrder as any).costAllocationMethods,
      totalCost: toNumber(purchaseOrder.totalCost),
      exchangeRate: toNumber(purchaseOrder.exchangeRate),
      items: purchaseOrder.items.map(item => ({
        ...item,
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.unitCost) * item.quantityOrdered,
        freightAllocation: toNumber(item.freightAllocation),
        dutyAllocation: toNumber(item.dutyAllocation),
        otherCostAllocation: toNumber(item.otherCostAllocation),
        landedUnitCost: toNumber(item.landedUnitCost)
      }))
    };

    res.json({
      success: true,
      data: serializedPO
    });
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
      shippingMethod,
      // NEW: Accept individual cost fields
      handlingFee = 0,
      airShippingFee = 0,
      amazonShippingFee = 0,
      miscellaneousFee = 0,
      costAllocationMethods = {}
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

    // Process all cost fields
    const freightCostNum = parseFloat(freightCost) || 0;
    const handlingFeeNum = parseFloat(handlingFee) || 0;
    const airShippingFeeNum = parseFloat(airShippingFee) || 0;
    const amazonShippingFeeNum = parseFloat(amazonShippingFee) || 0;
    const miscellaneousFeeNum = parseFloat(miscellaneousFee) || 0;
    
    // Calculate total including all costs
    const totalCost = subtotal + freightCostNum + handlingFeeNum + 
                     airShippingFeeNum + amazonShippingFeeNum + miscellaneousFeeNum;
    
    // Calculate allocations for items
    const itemsWithAllocation = processedItems.map((item: any) => {
      const itemValueRatio = subtotal > 0 ? item.totalCost / subtotal : 0;
      const totalQuantity = processedItems.reduce((sum: number, i: any) => sum + parseFloat(i.quantity || 0), 0);
      const itemQuantityRatio = totalQuantity > 0 ? parseFloat(item.quantity || 0) / totalQuantity : 0;
      const validItemCount = processedItems.filter((i: any) => i.productId && i.quantity > 0).length;
      const equalRatio = validItemCount > 0 ? 1 / validItemCount : 0;
      
      // Calculate allocations based on methods
      let totalAllocation = 0;
      
      // Freight allocation (always by value for now)
      const freightAllocation = freightCostNum * itemValueRatio;
      totalAllocation += freightAllocation;
      
      // Additional costs allocations
      const additionalCosts = [
        { amount: handlingFeeNum, method: costAllocationMethods.handling || 'BY_VALUE' },
        { amount: airShippingFeeNum, method: costAllocationMethods.air || 'BY_VALUE' },
        { amount: amazonShippingFeeNum, method: costAllocationMethods.amazon || 'BY_VALUE' },
        { amount: miscellaneousFeeNum, method: costAllocationMethods.misc || 'BY_VALUE' }
      ];
      
      let otherAllocation = 0;
      additionalCosts.forEach(cost => {
        if (cost.amount > 0) {
          switch (cost.method) {
            case 'BY_QUANTITY':
              otherAllocation += cost.amount * itemQuantityRatio;
              break;
            case 'EQUAL':
              otherAllocation += cost.amount * equalRatio;
              break;
            default: // BY_VALUE
              otherAllocation += cost.amount * itemValueRatio;
          }
        }
      });
      totalAllocation += otherAllocation;
      
      return {
        productId: item.productId,
        supplierSku: item.supplierSku || null,
        quantityOrdered: item.quantity,
        quantityReceived: 0,
        unitCost: item.unitCost,
        freightAllocation: freightAllocation,
        dutyAllocation: 0, // Not using customs duty for now
        otherCostAllocation: otherAllocation,
        landedUnitCost: item.unitCost + (item.quantity > 0 ? totalAllocation / item.quantity : 0)
      };
    });

    // Generate PO number
    const poNumber = await generatePONumber();

    // Create PO with items
    const purchaseOrder = await prisma.purchaseOrder.create({
      data: {
        orderNumber: poNumber,
        poNumber: poNumber,
        supplierId,
        status: 'DRAFT',
        orderDate: new Date(),
        subtotal,
        freightCost: freightCostNum,
        insuranceCost: 0, // Not using these old fields
        customsDuty: 0,   // Not using these old fields
        otherFees: 0,     // Not using these old fields
        handlingFee: handlingFeeNum,
        airShippingFee: airShippingFeeNum,
        amazonShippingFee: amazonShippingFeeNum,
        miscellaneousFee: miscellaneousFeeNum,
        costAllocationMethods: costAllocationMethods,
        totalCost,
        currency: 'USD',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        notes: notes || '',
        shippingMethod: shippingMethod || '',
        items: {
          create: itemsWithAllocation
        }
      } as any, // Type assertion to handle new fields
      include: {
        supplier: true,
        items: {
          include: {
            product: true
          }
        }
      }
    });

    // Convert Decimal values to numbers for JSON serialization
    const serializedPO = {
      ...purchaseOrder,
      poNumber: purchaseOrder.orderNumber || purchaseOrder.poNumber,
      subtotal: toNumber(purchaseOrder.subtotal),
      freightCost: toNumber(purchaseOrder.freightCost),
      insuranceCost: toNumber(purchaseOrder.insuranceCost),
      customsDuty: toNumber(purchaseOrder.customsDuty),
      otherFees: toNumber(purchaseOrder.otherFees),
      handlingFee: toNumber((purchaseOrder as any).handlingFee),
      airShippingFee: toNumber((purchaseOrder as any).airShippingFee),
      amazonShippingFee: toNumber((purchaseOrder as any).amazonShippingFee),
      miscellaneousFee: toNumber((purchaseOrder as any).miscellaneousFee),
      costAllocationMethods: (purchaseOrder as any).costAllocationMethods,
      totalCost: toNumber(purchaseOrder.totalCost),
      items: purchaseOrder.items.map(item => ({
        ...item,
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.unitCost) * item.quantityOrdered,
        freightAllocation: toNumber(item.freightAllocation),
        dutyAllocation: toNumber(item.dutyAllocation || 0),
        otherCostAllocation: toNumber(item.otherCostAllocation || 0),
        landedUnitCost: toNumber(item.landedUnitCost)
      }))
    };

    res.status(201).json({
      success: true,
      message: 'Purchase order created successfully',
      data: serializedPO
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

    // Convert Decimal values to numbers for JSON serialization
    const serializedPO = {
      ...purchaseOrder,
      subtotal: toNumber(purchaseOrder.subtotal),
      freightCost: toNumber(purchaseOrder.freightCost),
      insuranceCost: toNumber(purchaseOrder.insuranceCost),
      customsDuty: toNumber(purchaseOrder.customsDuty),
      otherFees: toNumber(purchaseOrder.otherFees),
      handlingFee: toNumber((purchaseOrder as any).handlingFee),
      airShippingFee: toNumber((purchaseOrder as any).airShippingFee),
      amazonShippingFee: toNumber((purchaseOrder as any).amazonShippingFee),
      miscellaneousFee: toNumber((purchaseOrder as any).miscellaneousFee),
      totalCost: toNumber(purchaseOrder.totalCost),
      exchangeRate: toNumber(purchaseOrder.exchangeRate),
      items: purchaseOrder.items.map(item => ({
        ...item,
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.unitCost) * item.quantityOrdered,
        freightAllocation: toNumber(item.freightAllocation),
        dutyAllocation: toNumber(item.dutyAllocation),
        otherCostAllocation: toNumber(item.otherCostAllocation),
        landedUnitCost: toNumber(item.landedUnitCost)
      }))
    };

    res.json({
      success: true,
      message: 'Purchase order updated successfully',
      data: serializedPO
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
          const landedCostNum = toNumber(poItem.landedUnitCost);
          await tx.inventoryMovement.create({
            data: {
              productId: poItem.productId,
              movementType: 'RECEIPT',
              quantity: item.quantityReceived,
              reason: `PO Receipt: ${purchaseOrder.poNumber}`,
              referenceType: 'po',
              referenceId: id,
              costImpact: landedCostNum ? landedCostNum * item.quantityReceived : null
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

    // Convert Decimal values to numbers for JSON serialization
    const serializedPO = {
      ...result,
      subtotal: toNumber(result.subtotal),
      freightCost: toNumber(result.freightCost),
      insuranceCost: toNumber(result.insuranceCost),
      customsDuty: toNumber(result.customsDuty),
      otherFees: toNumber(result.otherFees),
      handlingFee: toNumber((result as any).handlingFee),
      airShippingFee: toNumber((result as any).airShippingFee),
      amazonShippingFee: toNumber((result as any).amazonShippingFee),
      miscellaneousFee: toNumber((result as any).miscellaneousFee),
      totalCost: toNumber(result.totalCost),
      exchangeRate: toNumber(result.exchangeRate),
      items: result.items.map(item => ({
        ...item,
        unitCost: toNumber(item.unitCost),
        totalCost: toNumber(item.unitCost) * item.quantityOrdered,
        freightAllocation: toNumber(item.freightAllocation),
        dutyAllocation: toNumber(item.dutyAllocation),
        otherCostAllocation: toNumber(item.otherCostAllocation),
        landedUnitCost: toNumber(item.landedUnitCost)
      }))
    };

    res.json({
      success: true,
      message: 'Purchase order received successfully',
      data: serializedPO
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

    // Convert Decimal values to numbers
    const serializedSupplierProducts = supplierProducts.map(sp => ({
      ...sp,
      costPerUnit: toNumber(sp.costPerUnit),
      moq: sp.moq || 0
    }));

    res.json({
      success: true,
      data: serializedSupplierProducts
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch suppliers for product' 
    });
  }
});

export default router;
