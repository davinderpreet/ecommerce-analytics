import { VercelRequest, VercelResponse } from '@vercel/node';

// Sample data for the API
const sampleMetrics = {
  totalRevenue: 487650,
  revenueGrowth: 12.5,
  totalOrders: 7174,
  totalProducts: 17436,
  totalVisitors: 390120,
  avgOrderValue: 67.95,
  avgConversion: 2.84
};

const platformComparison = [
  { name: 'Shopify', revenue: 234500, orders: 3450, growth: 15.2, color: '#96f2d7' },
  { name: 'BestBuy', revenue: 253150, orders: 3724, growth: 9.8, color: '#74c0fc' }
];

const topProducts = [
  { name: 'iPhone 15 Pro', sales: 1250, revenue: 1562500, platform: 'bestbuy' },
  { name: 'MacBook Air M2', sales: 890, revenue: 1068000, platform: 'bestbuy' },
  { name: 'Samsung Galaxy S24', sales: 756, revenue: 680400, platform: 'shopify' }
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { url } = req;

  // Health endpoint
  if (url === '/api/v1/health') {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0'
    });
  }

  // Dashboard summary endpoint
  if (url === '/api/v1/analytics/dashboard-summary') {
    const summary = {
      metrics: sampleMetrics,
      platformComparison,
      topProducts
    };
    
    return res.json({
      success: true,
      data: summary,
      filters: {
        start_date: '2024-07-25',
        end_date: '2024-08-24',
        platform: 'all'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Metrics endpoint
  if (url === '/api/v1/analytics/metrics') {
    return res.json({
      success: true,
      data: sampleMetrics,
      filters: {
        start_date: '2024-07-25',
        end_date: '2024-08-24',
        platform: 'all'
      }
    });
  }

  // Sales trend endpoint
  if (url === '/api/v1/analytics/sales-trend') {
    // Generate sample daily sales data
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
    
    return res.json({
      success: true,
      data: data,
      filters: {
        start_date: '2024-07-25',
        end_date: '2024-08-24'
      }
    });
  }

  // Root API endpoint
  if (url === '/api' || url === '/api/') {
    return res.json({ 
      message: 'E-commerce Analytics API',
      version: '1.0.0',
      status: 'running',
      endpoints: [
        '/api/v1/health',
        '/api/v1/analytics/dashboard-summary',
        '/api/v1/analytics/metrics',
        '/api/v1/analytics/sales-trend'
      ]
    });
  }

  // Default 404
  res.status(404).json({ error: 'Endpoint not found' });
}
