// backend/src/routes/suppliers.ts - SIMPLIFIED FIX
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v2/inventory/suppliers
router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany({
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
      data: suppliers
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch suppliers' 
    });
  }
});

// GET /api/v2/inventory/suppliers/:id
router.get('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const supplier = await prisma.supplier.findUnique({
      where: { id }
    });

    if (!supplier) {
      res.status(404).json({ 
        success: false, 
        error: 'Supplier not found' 
      });
    } else {
      res.json({
        success: true,
        data: supplier
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch supplier' 
    });
  }
});

// POST /api/v2/inventory/suppliers
router.post('/suppliers', async (req: Request, res: Response) => {
  try {
    const {
      companyName,
      email,
      ...otherData
    } = req.body;

    if (!companyName || !email) {
      res.status(400).json({
        success: false,
        error: 'Company name and email are required'
      });
    } else {
      const supplier = await prisma.supplier.create({
        data: {
          companyName,
          email,
          ...otherData,
          isActive: true
        }
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: supplier
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create supplier' 
    });
  }
});

// PUT /api/v2/inventory/suppliers/:id
router.put('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    delete updateData.id;

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
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to update supplier' 
      });
    }
  }
});

// DELETE /api/v2/inventory/suppliers/:id
router.delete('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: 'Supplier not found'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to delete supplier' 
      });
    }
  }
});

// GET /api/v2/inventory/suppliers/:id/products
router.get('/suppliers/:id/products', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const supplierProducts = await prisma.supplierProduct.findMany({
      where: { 
        supplierId: id
      },
      include: {
        product: true
      }
    });

    res.json({
      success: true,
      data: supplierProducts
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch supplier products' 
    });
  }
});

// POST /api/v2/inventory/suppliers/:id/products
router.post('/suppliers/:id/products', async (req: Request, res: Response) => {
  try {
    const { id: supplierId } = req.params;
    const { productId, costPerUnit, ...otherData } = req.body;

    if (!productId || !costPerUnit) {
      res.status(400).json({
        success: false,
        error: 'Product ID and cost per unit are required'
      });
    } else {
      const existing = await prisma.supplierProduct.findFirst({
        where: { supplierId, productId }
      });

      let supplierProduct;
      
      if (existing) {
        supplierProduct = await prisma.supplierProduct.update({
          where: { id: existing.id },
          data: {
            costPerUnit: parseFloat(costPerUnit),
            ...otherData
          }
        });
      } else {
        supplierProduct = await prisma.supplierProduct.create({
          data: {
            supplierId,
            productId,
            costPerUnit: parseFloat(costPerUnit),
            ...otherData
          }
        });
      }

      res.json({
        success: true,
        message: existing ? 'Product updated' : 'Product added',
        data: supplierProduct
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to manage supplier product' 
    });
  }
});

// DELETE /api/v2/inventory/suppliers/:id/products/:productId
router.delete('/suppliers/:id/products/:productId', async (req: Request, res: Response) => {
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
    } else {
      await prisma.supplierProduct.delete({
        where: { id: supplierProduct.id }
      });

      res.json({
        success: true,
        message: 'Product removed from supplier catalog'
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to remove supplier product' 
    });
  }
});

export default router;
