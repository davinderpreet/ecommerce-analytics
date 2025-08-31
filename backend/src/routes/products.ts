// backend/src/routes/products.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// GET /api/v1/products - Get all products for dropdowns/selection
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
      search,
      platform,
      page = '1',
      limit = '200'  // Higher limit for dropdown population
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { active: true };
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    if (platform && platform !== 'all') {
      const channel = await prisma.channel.findFirst({
        where: { code: platform as string }
      });
      if (channel) {
        where.channelId = channel.id;
      }
    }

    // Get products with inventory
    const products = await prisma.product.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { title: 'asc' },
      include: {
        channel: true,
        inventory: true
      }
    });

    // Format for frontend compatibility
    const formattedProducts = products.map(product => ({
      id: product.id,
      title: product.title,
      sku: product.sku,
      price: parseFloat(product.price?.toString() || '0'),
      platform: product.channel?.code || 'shopify',
      inventoryQuantity: product.inventory?.quantity || 0,
      available: product.inventory?.available || 0
    }));

    res.json({
      success: true,
      products: formattedProducts,
      total: formattedProducts.length
    });

  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch products',
      products: [] // Return empty array on error
    });
  }
});

// GET /api/v1/products/:id - Get single product details
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        channel: true,
        inventory: true,
        supplierProducts: {
          include: {
            supplier: true
          }
        }
      }
    });

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
      return;
    }

    res.json({
      success: true,
      product: {
        id: product.id,
        title: product.title,
        sku: product.sku,
        price: parseFloat(product.price?.toString() || '0'),
        platform: product.channel?.code || 'shopify',
        inventoryQuantity: product.inventory?.quantity || 0,
        available: product.inventory?.available || 0,
        suppliers: product.supplierProducts
      }
    });

  } catch (error: any) {
    console.error('Error fetching product:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch product' 
    });
  }
});

export default router;
