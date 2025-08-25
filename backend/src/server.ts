// backend/src/server.ts - Complete file
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import your sync function
import { syncShopifyOrders } from './integrations/shopify';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/api/v1/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ api: 'running', database: 'ok', ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ api: 'running', database: 'error', error: e?.message });
  }
});

// Shopify sync endpoint with detailed debugging
app.all('/api/v1/sync/shopify', async (req: Request, res: Response) => {
  const days = Number(req.query.days ?? 7);
  
  console.log('🔄 Starting Shopify sync for', days, 'days');
  console.log('📊 SHOPIFY_SHOP_DOMAIN:', process.env.SHOPIFY_SHOP_DOMAIN);
  console.log('🔑 SHOPIFY_ADMIN_ACCESS_TOKEN exists:', !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  console.log('🗄️ DATABASE_URL exists:', !!process.env.DATABASE_URL);
  
  try {
    // Test database connection first
    console.log('🔄 Testing database connection...');
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connected');
    
    // Test Shopify credentials
    const shop = process.env.SHOPIFY_SHOP_DOMAIN;
    const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
    
    if (!shop || !token) {
      const error = `Missing credentials: shop=${!!shop}, token=${!!token}`;
      console.error('❌', error);
      res.status(400).json({ ok: false, error });
      return;
    }
    
    console.log('🔄 Testing Shopify connection...');
    const testResponse = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token,
      },
      body: JSON.stringify({ query: '{ shop { name } }' }),
    });
    
    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('❌ Shopify connection failed:', testResponse.status, errorText);
      res.status(500).json({ ok: false, error: `Shopify API error: ${testResponse.status}` });
      return;
    }
    
    const testData: any = await testResponse.json();
    console.log('✅ Shopify connected to shop:', testData.data?.shop?.name);
    
    if (testData.errors) {
      console.error('❌ Shopify GraphQL errors:', testData.errors);
      res.status(500).json({ ok: false, error: 'Shopify GraphQL errors', details: testData.errors });
      return;
    }
    
    // Now try the actual sync
    console.log('🔄 Running syncShopifyOrders...');
    await syncShopifyOrders(days);
    
    console.log('✅ Shopify sync completed');
    res.json({ ok: true, source: 'shopify', days });
    
  } catch (error: any) {
    console.error('❌ Shopify sync failed with error:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ 
      ok: false, 
      source: 'shopify', 
      error: error?.message || 'sync_failed',
      stack: error?.stack 
    });
  }
});

// Analytics endpoints
app.get('/api/v1/analytics/dashboard-summary', async (req: Request, res: Response) => {
  try {
    const range = String(req.query.range ?? '7d');
    const days = Number(range.replace('d', '')) || 7;

    const end = new Date(); 
    end.setHours(23,59,59,999);
    const start = new Date(end); 
    start.setHours(0,0,0,0); 
    start.setDate(end.getDate() - (days - 1));

    const channels = await prisma.channel.findMany();
    const orders = await prisma.order.findMany({ 
      where: { createdAt: { gte: start, lte: end } } 
    });

    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const totalRevenue = revenueCents / 100;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // Build sales trend
    const trendMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(start); 
      d.setDate(start.getDate() + i);
      const dateKey = d.toISOString().slice(0,10);
      trendMap.set(dateKey, { revenueCents: 0, orders: 0 });
    }
    
    for (const o of orders) {
      const dateKey = o.createdAt.toISOString().slice(0,10);
      const trend = trendMap.get(dateKey);
      if (trend) {
        trend.revenueCents += (o.totalCents || 0);
        trend.orders += 1;
      }
    }

    const salesTrend = Array.from(trendMap.entries())
      .sort(([a],[b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: v.revenueCents / 100,
        orders: v.orders,
        aov: v.orders ? (v.revenueCents / 100) / v.orders : 0
      }));

    res.json({
      success: true,
      range: { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10), days },
      totalRevenue,
      totalOrders,
      avgOrderValue,
      revenueGrowth: null,
      platformComparison: [],
      salesTrend,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

app.get('/api/v1/analytics/metrics', async (req: Request, res: Response) => {
  try {
    const platform = String(req.query.platform ?? 'all');
    const today = new Date();
    const start = new Date(req.query.start_date as string || today.toISOString().slice(0,10));
    const end = new Date(req.query.end_date as string || today.toISOString().slice(0,10));

    const orders = await prisma.order.findMany({ 
      where: { createdAt: { gte: start, lte: end } },
      select: { totalCents: true }
    });
    
    const totalOrders = orders.length;
    const totalRevenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const avgOrderValueCents = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0;

    res.json({
      success: true,
      filters: { 
        start_date: start.toISOString().slice(0,10), 
        end_date: end.toISOString().slice(0,10), 
        platform 
      },
      totalRevenue: totalRevenueCents / 100,
      totalOrders,
      avgOrderValue: avgOrderValueCents / 100,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

app.get('/api/v1/analytics/sales-trend', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const start = new Date(req.query.start_date as string || new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0,10));
    const end = new Date(req.query.end_date as string || today.toISOString().slice(0,10));

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true, totalCents: true },
    });

    const dayMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let d = new Date(start); d <= end; d = new Date(d.getTime() + 86_400_000)) {
      dayMap.set(d.toISOString().slice(0,10), { revenueCents: 0, orders: 0 });
    }
    
    for (const o of orders) {
      const dateKey = o.createdAt.toISOString().slice(0,10);
      const agg = dayMap.get(dateKey);
      if (agg) {
        agg.revenueCents += (o.totalCents || 0);
        agg.orders += 1;
      }
    }

    const trend = Array.from(dayMap.entries())
      .sort(([a],[b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: v.revenueCents / 100,
        orders: v.orders,
        aov: v.orders ? (v.revenueCents / 100) / v.orders : 0
      }));

    res.json({ 
      success: true, 
      start: start.toISOString().slice(0,10), 
      end: end.toISOString().slice(0,10), 
      data: trend 
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'E-commerce Analytics API',
    version: '1.0.0',
    status: 'running',
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/sync/shopify?days=7',
      'GET /api/v1/analytics/dashboard-summary?range=7d'
    ]
  });
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err?.stack || err);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('📊 E-commerce Analytics API ready');
});

export default app;
