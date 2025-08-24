import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard metrics
router.get('/metrics', async (req, res) => {
  try {
    const { start_date, end_date, platform } = req.query;
    
    // For now, return sample data structure that matches your frontend
    // TODO: Replace with real database queries
    const sampleMetrics = {
      totalRevenue: 487650,
      revenueGrowth: 12.5,
      totalOrders: 7174,
      totalProducts: 17436,
      totalVisitors: 390120,
      avgOrderValue: 67.95,
      avgConversion: 2.84
    };
    
    res.json({
      success: true,
      data: sampleMetrics,
      filters: {
        start_date: start_date || '2024-07-25',
        end_date: end_date || '2024-08-24',
        platform: platform || 'all'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch metrics'
    });
  }
});

// Get sales trend data
router.get('/sales-trend', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    // Generate sample daily sales data
    const generateSalesData = () => {
      const data = [];
      const startDate = new Date('2024-07-25');
      const endDate = new Date('2024-08-24');
      const currentDate = new Date(startDate);

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay();
        const weekendMultiplier = dayOfWeek === 0 || dayOfWeek === 6 ? 0.8 : 1.2;
        const randomVariation = 0.8 + Math.random() * 0.4;
        
        const baseBestbuy = 8000 + Math.random() * 4000;
        const baseShopify = 6000 + Math.random() * 3000;
        
        const bestbuyRevenue = Math.floor(baseBestbuy * weekendMultiplier * randomVariation);
        const shopifyRevenue = Math.floor(baseShopify * weekendMultiplier * randomVariation);
        
        data.push({
          date: currentDate.toISOString().split('T')[0],
          bestbuy: bestbuyRevenue,
          shopify: shopifyRevenue,
          total: bestbuyRevenue + shopifyRevenue,
          orders: Math.floor((bestbuyRevenue + shopifyRevenue) / 68),
          products: Math.floor((bestbuyRevenue + shopifyRevenue) / 28),
          visitors: Math.floor((bestbuyRevenue + shopifyRevenue) * 0.8),
          conversion: 2.1 + Math.random() * 1.5
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      return data;
    };
    
    res.json({
      success: true,
      data: generateSalesData(),
      filters: {
        start_date: start_date || '2024-07-25',
        end_date: end_date || '2024-08-24'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales trend'
    });
  }
});

// Get platform comparison
router.get('/platform-comparison', async (req, res) => {
  try {
    const platformData = [
      { name: 'Shopify', revenue: 234500, orders: 3450, growth: 15.2, color: '#96f2d7' },
      { name: 'BestBuy', revenue: 253150, orders: 3724, growth: 9.8, color: '#74c0fc' }
    ];
    
    res.json({
      success: true,
      data: platformData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch platform comparison'
    });
  }
});

// Get top products
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 10, platform } = req.query;
    
    const topProducts = [
      { name: 'iPhone 15 Pro', sales: 1250, revenue: 1562500, platform: 'bestbuy' },
      { name: 'MacBook Air M2', sales: 890, revenue: 1068000, platform: 'bestbuy' },
      { name: 'Samsung Galaxy S24', sales: 756, revenue: 680400, platform: 'shopify' },
      { name: 'iPad Pro 12.9"', sales: 645, revenue: 774000, platform: 'shopify' },
      { name: 'AirPods Pro', sales: 1120, revenue: 280000, platform: 'bestbuy' }
    ].slice(0, Number(limit));
    
    res.json({
      success: true,
      data: topProducts,
      filters: {
        limit: Number(limit),
        platform: platform || 'all'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top products'
    });
  }
});

// Get dashboard summary (all data in one call)
router.get('/dashboard-summary', async (req, res) => {
  try {
    const { start_date, end_date, platform } = req.query;
    
    // This endpoint combines all dashboard data for efficiency
    const summary = {
      metrics: {
        totalRevenue: 487650,
        revenueGrowth: 12.5,
        totalOrders: 7174,
        totalProducts: 17436,
        totalVisitors: 390120,
        avgOrderValue: 67.95,
        avgConversion: 2.84
      },
      platformComparison: [
        { name: 'Shopify', revenue: 234500, orders: 3450, growth: 15.2, color: '#96f2d7' },
        { name: 'BestBuy', revenue: 253150, orders: 3724, growth: 9.8, color: '#74c0fc' }
      ],
      topProducts: [
        { name: 'iPhone 15 Pro', sales: 1250, revenue: 1562500, platform: 'bestbuy' },
        { name: 'MacBook Air M2', sales: 890, revenue: 1068000, platform: 'bestbuy' },
        { name: 'Samsung Galaxy S24', sales: 756, revenue: 680400, platform: 'shopify' }
      ]
    };
    
    res.json({
      success: true,
      data: summary,
      filters: {
        start_date: start_date || '2024-07-25',
        end_date: end_date || '2024-08-24',
        platform: platform || 'all'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard summary'
    });
  }
});

export default router;
