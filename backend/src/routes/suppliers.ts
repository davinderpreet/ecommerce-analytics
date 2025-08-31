// backend/src/routes/suppliers.ts - FIXED WITH CORRECT FIELD NAMES
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
        id: s.id,
        companyName: s.name, // Map 'name' to 'companyName' for frontend
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        address: s.address,
        website: s.website,
        country: null, // Not in current DB
        currency: 'USD',
        paymentTerms: s.paymentTerms,
        leadTimeDays: s.leadTimeDays || 7,
        isActive: s.isActive,
        notes: s.notes,
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
        data: {
          id: supplier.id,
          companyName: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          website: supplier.website,
          paymentTerms: supplier.paymentTerms,
          leadTimeDays: supplier.leadTimeDays,
          isActive: supplier.isActive,
          notes: supplier.notes
        }
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
      companyName, // Frontend sends companyName
      contactName,
      email,
      phone,
      address,
      paymentTerms,
      leadTimeDays,
      notes
    } = req.body;

    if (!companyName || !email) {
      res.status(400).json({
        success: false,
        error: 'Company name and email are required'
      });
    } else {
      const supplier = await prisma.supplier.create({
        data: {
          name: companyName, // Map to 'name' for database
          contactName,
          email,
          phone,
          address,
          paymentTerms,
          leadTimeDays: leadTimeDays || 7,
          notes,
          isActive: true
        }
      });

      res.status(201).json({
        success: true,
        message: 'Supplier created successfully',
        data: {
          id: supplier.id,
          companyName: supplier.name,
          contactName: supplier.contactName,
          email: supplier.email,
          phone: supplier.phone,
          address: supplier.address,
          paymentTerms: supplier.paymentTerms,
          leadTimeDays: supplier.leadTimeDays,
          isActive: supplier.isActive
        }
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
    const {
      companyName,
      contactName,
      email,
      phone,
      address,
      paymentTerms,
      leadTimeDays,
      notes
    } = req.body;

    const updateData: any = {};
    if (companyName !== undefined) updateData.name = companyName;
    if (contactName !== undefined) updateData.contactName = contactName;
    if (email !== undefined) updateData.email = email;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
    if (leadTimeDays !== undefined) updateData.leadTimeDays = parseInt(leadTimeDays);
    if (notes !== undefined) updateData.notes = notes;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Supplier updated successfully',
      data: {
        id: supplier.id,
        companyName: supplier.name,
        contactName: supplier.contactName,
        email: supplier.email,
        phone: supplier.phone,
        address: supplier.address,
        paymentTerms: supplier.paymentTerms,
        leadTimeDays: supplier.leadTimeDays,
        isActive: supplier.isActive
      }
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
