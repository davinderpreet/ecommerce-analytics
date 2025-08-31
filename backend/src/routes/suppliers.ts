// backend/src/routes/suppliers.ts - USING PRISMA SCHEMA FIELD NAMES
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v2/inventory/suppliers
router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const suppliers = await prisma.supplier.findMany();
    
    res.json({
      success: true,
      data: suppliers.map(s => ({
        ...s,
        _count: { products: 0, purchaseOrders: 0 }
      }))
    });
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
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
      contactName,
      email,
      phone,
      address,
      country,
      currency,
      paymentTerms,
      leadTimeDays,
      minimumOrderValue,
      notes,
      bankDetails,
      taxId
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
          contactName,
          email,
          phone,
          address,
          country,
          currency: currency || 'USD',
          paymentTerms,
          leadTimeDays: leadTimeDays || 7,
          minimumOrderValue: minimumOrderValue ? parseFloat(minimumOrderValue) : null,
          notes,
          bankDetails,
          taxId,
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
    console.error('Error creating supplier:', error);
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
    
    // Remove id from update data
    delete updateData.id;
    
    // Convert types if needed
    if (updateData.leadTimeDays) {
      updateData.leadTimeDays = parseInt(updateData.leadTimeDays);
    }
    if (updateData.minimumOrderValue) {
      updateData.minimumOrderValue = parseFloat(updateData.minimumOrderValue);
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

export default router;
