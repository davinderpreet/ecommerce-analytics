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

// GET /api/v1/returns/order/:orderNumber - Fetch order details by order number
router.get('/order/:orderNumber', async (req: Request, res: Response) => {
  try {
    const { orderNumber } = req.params;
    
    // Find order with its items and products
    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { number: orderNumber },
          { channelRef: orderNumber }
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
      res.status(404).json({ 
        success: false, 
        error: 'Order not found' 
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
        returnLabelCostCents: returnLabelCostCents || 0,
        notes,
        createdBy,
        items: {
          create: selectedItems.map((item: any) => ({
            orderItemId: item.orderItemId,
            productId: item.productId,
            sku: item.sku,
            productTitle: item.productTitle,
            quantityReturned: item.quantityReturned,
            unitPriceCents: item.unitPriceCents,
            totalValueCents: item.unitPriceCents * item.quantityReturned,
            productCondition: item.productCondition || '100',
            conditionNotes: item.conditionNotes,
            reasonCategory: item.reasonCategory || 'not_specified',
            reasonDetail: item.reasonDetail
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

export default router;
