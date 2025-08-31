// backend/src/routes/suppliers.ts - FIXED VERSION
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v2/inventory/suppliers - List all suppliers
router.get('/suppliers', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      isActive = 'true',
      country,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = '1',
      limit = '20'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};
    
    if (isActive !== 'all') {
      where.isActive = isActive === 'true';
    }
    
    if (country) {
      where.country = country;
    }
    
    if (search) {
      where.OR = [
        { companyName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { contactName: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Get total count for pagination
    const totalCount = await prisma.supplier.count({ where });

    // Get suppliers with relations
    const suppliers = await prisma.supplier.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { [sortBy as string]: sortOrder },
      include: {
        _count: {
          select: {
            products: true,
            purchaseOrders: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum)
      }
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch suppliers' 
    });
  }
});

// GET /api/v2/inventory/suppliers/:id - Get single supplier
router.get('/suppliers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              select: {
                id: true,
                title: true,
                sku: true,
                priceCents: true
              }
            }
          }
        },
        purchaseOrders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            poNumber: true,
            status: true,
            totalCost: true,
            createdAt: true,
            expectedDate: true
          }
        },
        _count: {
          select: {
            products: true,
            purchaseOrders: true
          }
        }
      }
    });

    if (!supplier) {
      res.status(404).json({ 
        success: false, 
        error: 'Supplier not found' 
      });
      return;
    }

    res.json({
      success: true,
      data: supplier
    });
  } catch (error: any) {
    console.error('Error fetching supplier:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch supplier' 
    });
  }
});

// POST /api/v2/inventory/suppliers - Create new supplier
router.post('/suppliers', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      country,
      currency = 'USD',
      paymentTerms,
      leadTimeDays = 7,
      minimumOrderValue,
      discountTiers,
      notes,
      bankDetails,
      taxId,
      contractEndDate
    } = req.body;

    // Validate required fields
    if (!companyName || !email) {
      res.status(400).json({
        success: false,
        error: 'Company name and email are required'
      });
      return;
    }

    const supplier = await prisma.supplier.create({
      data: {
        companyName,
        contactName,
        email,
        phone,
        address,
        country,
        currency,
        paymentTerms,
        leadTimeDays,
        minimumOrderValue: minimumOrderValue ? parseFloat(minimumOrderValue) : null,
        discountTiers: discountTiers || null,
        notes,
        bankDetails,
        taxId,
        contractEndDate: contractEndDate ? new Date(contractEndDate) : null,
        rating: 5.0,
        isActive: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Supplier created successfully',
      data: supplier
    });
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create supplier' 
    });
  }
});

// PUT /api/v2/inventory/suppliers/:id - Update supplier
router.put('/suppliers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove id from updateData if present
    delete updateData.id;

    // Convert string values to proper types
    if (updateData.leadTimeDays) {
      updateData.leadTimeDays = parseInt(updateData.leadTimeDays);
    }
    if (updateData.minimumOrderValue) {
      updateData.minimumOrderValue = parseFloat(updateData.minimumOrderValue);
    }
    if (updateData.rating) {
      updateData.rating = parseFloat(updateData.rating);
    }
    if (updateData.contractEndDate) {
      updateData.contractEndDate = new Date(updateData.contractEndDate);
    }

    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: supplier
    });
  } catch (error: any) {
    console.error('Error updating supplier:', error);
    
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
      return;
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to update supplier' 
    });
  }
});

// DELETE /api/v2/inventory/suppliers/:id - Soft delete supplier
router.delete('/suppliers/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if supplier has active POs
    const activePOs = await prisma.purchaseOrder.count({
      where: {
        supplierId: id,
        status: {
          in: ['DRAFT', 'SENT', 'CONFIRMED', 'SHIPPED', 'PARTIAL_RECEIVED']
        }
      }
    });

    if (activePOs > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete supplier with ${activePOs} active purchase orders`
      });
      return;
    }

    // Soft delete - just mark as inactive
    const supplier = await prisma.supplier.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Supplier deactivated successfully',
      data: supplier
    });
  } catch (error: any) {
    console.error('Error deleting supplier:', error);
    
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
      return;
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to delete supplier' 
    });
  }
});

// GET /api/v2/inventory/suppliers/:id/products - Get supplier's product catalog
router.get('/suppliers/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplierProducts = await prisma.supplierProduct.findMany({
      where: { 
        supplierId: id,
        OR: [
          { validUntil: { gte: new Date() } },
          { validUntil: null }
        ]
      },
      include: {
        product: {
          include: {
            inventory: {
              select: {
                quantity: true,
                available: true,
                reserved: true
              }
            }
          }
        }
      },
      orderBy: { isPreferred: 'desc' }
    });

    res.json({
      success: true,
      data: supplierProducts
    });
  } catch (error: any) {
    console.error('Error fetching supplier products:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch supplier products' 
    });
  }
});

// POST /api/v2/inventory/suppliers/:id/products - Add/update product in supplier catalog
router.post('/suppliers/:id/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: supplierId } = req.params;
    const {
      productId,
      supplierSku,
      costPerUnit,
      moq = 1,
      leadTimeOverride,
      bulkPricing,
      validFrom,
      validUntil,
      isPreferred = false
    } = req.body;

    // Validate required fields
    if (!productId || !costPerUnit) {
      res.status(400).json({
        success: false,
        error: 'Product ID and cost per unit are required'
      });
      return;
    }

    // Check if this supplier-product combination already exists
    const existing = await prisma.supplierProduct.findFirst({
      where: { supplierId, productId }
    });

    let supplierProduct;
    
    if (existing) {
      // Update existing
      supplierProduct = await prisma.supplierProduct.update({
        where: { id: existing.id },
        data: {
          supplierSku,
          costPerUnit: parseFloat(costPerUnit),
          moq: parseInt(moq),
          leadTimeOverride: leadTimeOverride ? parseInt(leadTimeOverride) : null,
          bulkPricingJson: bulkPricing || null,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validUntil: validUntil ? new Date(validUntil) : null,
          isPreferred
        }
      });
    } else {
      // Create new
      supplierProduct = await prisma.supplierProduct.create({
        data: {
          supplierId,
          productId,
          supplierSku,
          costPerUnit: parseFloat(costPerUnit),
          moq: parseInt(moq),
          leadTimeOverride: leadTimeOverride ? parseInt(leadTimeOverride) : null,
          bulkPricingJson: bulkPricing || null,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validUntil: validUntil ? new Date(validUntil) : null,
          isPreferred
        }
      });
    }

    res.json({
      success: true,
      message: existing ? 'Product updated in supplier catalog' : 'Product added to supplier catalog',
      data: supplierProduct
    });
  } catch (error: any) {
    console.error('Error managing supplier product:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to manage supplier product' 
    });
  }
});

// DELETE /api/v2/inventory/suppliers/:id/products/:productId - Remove product from supplier catalog
router.delete('/suppliers/:id/products/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id: supplierId, productId } = req.params;

    const supplierProduct = await prisma.supplierProduct.findFirst({
      where: { supplierId, productId }
    });

    if (!supplierProduct) {
      res.status(404).json({
        success: false,
        error: 'Product not found in supplier catalog'
      });
      return;
    }

    await prisma.supplierProduct.delete({
      where: { id: supplierProduct.id }
    });

    res.json({
      success: true,
      message: 'Product removed from supplier catalog'
    });
  } catch (error: any) {
    console.error('Error removing supplier product:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to remove supplier product' 
    });
  }
});

export default router;
