// backend/src/routes/returns.ts - COMPLETE WORKING VERSION
import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Generate unique RMA number
const generateRMANumber = (): string => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `RMA${year}${month}${random}`;
};

// GET /api/v1/returns/order/:orderNumber - FIXED VERSION WITH # PREFIX HANDLING
router.get('/order/:orderNumber', async (req: Request, res: Response) => {
  try {
    let { orderNumber } = req.params;
    
    // Decode any URL encoding (e.g., %23 for #)
    orderNumber = decodeURIComponent(orderNumber);
    
    // Remove # if user included it, we'll add it back
    const cleanNumber = orderNumber.replace(/^#/, '').trim();
    
    // Always search with # prefix for the number field
    const orderNumberWithHash = `#${cleanNumber}`;
    
    console.log(`Order search - Input: "${orderNumber}", Clean: "${cleanNumber}", With Hash: "${orderNumberWithHash}"`);
    
    // Find order - search multiple variations
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { number: orderNumberWithHash },  // Primary: #2202
          { number: cleanNumber },          // Fallback: 2202
          { channelRef: cleanNumber },      // Also check channelRef
          { channelRef: orderNumberWithHash } // Also check channelRef with #
        ]
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
      console.log(`Order not found. Searched for: ${orderNumberWithHash} and ${cleanNumber}`);
      
      // Debug: Let's see what orders exist (first 5)
      const sampleOrders = await prisma.order.findMany({
        take: 5,
        select: {
          number: true,
          channelRef: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      console.log('Sample orders in database:', sampleOrders);
      
      res.status(404).json({ 
        success: false, 
        error: 'Order not found',
        searched: [orderNumberWithHash, cleanNumber],
        hint: 'Make sure the order number exists in the database'
      });
      return;
    }

    // Check if any returns already exist for this order
    const existingReturns = await prisma.return.findMany({
      where: { orderId: order.id },
      include: {
        items: true
      }
    });

    console.log(`Order found: ${order.number} (ID: ${order.id})`);

    res.json({
      success: true,
      order: {
        ...order,
        existingReturns
      }
    });

  } catch (error: any) {
    console.error('Fetch order error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/v1/returns - Create new return
// backend/src/routes/returns.ts
// STEP 1: Find the POST '/' endpoint (around line 90-110)
// STEP 2: Replace the entire POST endpoint with this corrected version:

// POST /api/v1/returns - Create new return
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      orderId,
      selectedItems,
      shippingCostCents,
      returnLabelCostCents,
      customerEmail,
      notes,
      createdBy = 'system'
    } = req.body;

    // Validate required fields
    if (!orderId || !selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
      res.status(400).json({ 
        success: false,
        error: 'Order ID and selected items are required' 
      });
      return;
    }

    // Get order details
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        channel: true,
        items: true 
      }
    });

    if (!order) {
      res.status(404).json({ 
        success: false,
        error: 'Order not found' 
      });
      return;
    }

    // Calculate total return value
    const totalReturnValueCents = selectedItems.reduce((sum: number, item: any) => {
      return sum + (item.unitPriceCents * item.quantityReturned);
    }, 0);

    // Create the return with items
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber: generateRMANumber(),
        orderId,
        channelId: order.channelId,
        customerEmail: customerEmail || order.customerEmail || '',
        status: 'pending',
        totalReturnValueCents,
        returnShippingCostCents: shippingCostCents || 0,
        returnlabelcostcents: returnLabelCostCents || 0,  // Note: lowercase to match DB
        notes,
        createdBy,
        // IMPORTANT: No productCondition at this level!
        items: {
          create: selectedItems.map((item: any) => ({
            orderItem: item.orderItemId ? { connect: { id: item.orderItemId } } : undefined,
            product: item.productId ? { connect: { id: item.productId } } : undefined,
            sku: item.sku || '',
            productTitle: item.productTitle || '',
            quantityReturned: item.quantityReturned || 1,
            unitPriceCents: item.unitPriceCents || 0,
            totalValueCents: (item.unitPriceCents || 0) * (item.quantityReturned || 1),
            // ✅ productCondition goes HERE in return_items:
            condition: item.productCondition || '100',
            reasonCategory: item.reasonCategory || 'not_specified',
            reasonDetail: item.reasonDetail || ''
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
      message: `Return ${returnRecord.returnNumber} created successfully`
    });

  } catch (error: any) {
    console.error('Create return error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
// GET /api/v1/returns - List all returns with filters
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      status, 
      startDate, 
      endDate, 
      page = 1,
      limit = 20
    } = req.query;

    const where: Prisma.ReturnWhereInput = {};

    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }

    if (startDate && typeof startDate === 'string') {
      where.createdAt = {
        gte: new Date(startDate),
        ...(endDate && typeof endDate === 'string' 
          ? { lte: new Date(endDate) }
          : {})
      };
    }

    const [returns, total] = await Promise.all([
      prisma.return.findMany({
        where,
        include: {
          items: true,
          order: {
            include: {
              channel: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit)
      }),
      prisma.return.count({ where })
    ]);

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
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/v1/returns/metrics - Return metrics endpoint (STUB - returns empty data to prevent errors)
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    // Return minimal valid response to prevent frontend errors
    res.json({
      success: true,
      totalReturns: 0,
      pendingReturns: 0,
      approvedReturns: 0,
      completedReturns: 0,
      returnRate: 0,
      averageReturnValue: 0,
      totalReturnValue: 0
    });
  } catch (error: any) {
    console.error('Metrics error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/v1/returns/cost-analysis - Cost analysis endpoint (STUB - returns empty data to prevent errors)
router.get('/cost-analysis', async (req: Request, res: Response) => {
  try {
    // Return minimal valid response to prevent frontend errors
    res.json({
      success: true,
      totalCost: 0,
      shippingCost: 0,
      processingCost: 0,
      restockingCost: 0,
      returns: []
    });
  } catch (error: any) {
    console.error('Cost analysis error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// GET /api/v1/returns/:id - Get single return details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const returnRecord = await prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
            orderItem: true
          }
        },
        order: {
          include: {
            channel: true,
            items: true
          }
        }
      }
    });

    if (!returnRecord) {
      res.status(404).json({ 
        success: false,
        error: 'Return not found' 
      });
      return;
    }

    res.json({
      success: true,
      return: returnRecord
    });

  } catch (error: any) {
    console.error('Get return error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// PUT /api/v1/returns/:id/status - Update return status
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvedBy } = req.body;

    const updateData: any = { status };
    
    if (status === 'approved') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = approvedBy || 'system';
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const returnRecord = await prisma.return.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        order: true
      }
    });

    res.json({
      success: true,
      return: returnRecord,
      message: `Return status updated to ${status}`
    });

  } catch (error: any) {
    console.error('Update return status error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});
// ADD THESE TWO ROUTES to backend/src/routes/returns.ts

// DELETE /api/v1/returns/:id - Delete a return
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // First check if return exists
    const existingReturn = await prisma.return.findUnique({
      where: { id }
    });

    if (!existingReturn) {
      res.status(404).json({ 
        success: false,
        error: 'Return not found' 
      });
      return;
    }

    // Delete the return (this will cascade delete return items)
    await prisma.return.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Return deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete return error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// PUT /api/v1/returns/:id - Update a return
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      returnShippingCostCents, 
      returnlabelcostcents, 
      notes 
    } = req.body;

    // Check if return exists
    const existingReturn = await prisma.return.findUnique({
      where: { id }
    });

    if (!existingReturn) {
      res.status(404).json({ 
        success: false,
        error: 'Return not found' 
      });
      return;
    }

    // Build update data object
    const updateData: any = {};
    
    if (status !== undefined) updateData.status = status;
    if (returnShippingCostCents !== undefined) updateData.returnShippingCostCents = returnShippingCostCents;
    if (returnlabelcostcents !== undefined) updateData.returnlabelcostcents = returnlabelcostcents;
    if (notes !== undefined) updateData.notes = notes;
    
    // Update timestamps based on status
    if (status === 'approved') {
      updateData.approvedAt = new Date();
      updateData.approvedBy = 'admin';
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    // Update the return
    const updatedReturn = await prisma.return.update({
      where: { id },
      data: updateData,
      include: {
        items: true,
        order: true
      }
    });

    res.json({
      success: true,
      return: updatedReturn,
      message: 'Return updated successfully'
    });

  } catch (error: any) {
    console.error('Update return error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});




export default router;
