// backend/src/server.ts - Updated for Railway
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Import your route handlers (we'll use them directly)
import { syncShopifyOrders } from './integrations/shopify';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Health endpoint
app.get('/api/v1/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ api: 'running', database: 'ok', ts: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ api: 'running', database: 'error', error: e?.message });
  }
});

// Sync endpoints
app.all('/api/v1/sync/shopify', async (req, res) => {
  const days = Number(req.query.days ?? 7);
  try {
    console.log('🔄 Starting Shopify sync for', days, 'days');
    await syncShopifyOrders(days);
    console.log('✅ Shopify sync completed');
    res.json({ ok: true, source: 'shopify', days });
  } catch (e: any) {
    console.error('❌ Shopify sync failed:', e);
    res.status(500).json({ ok: false, source: 'shopify', error: e?.message || 'sync_failed' });
  }
});

// Analytics endpoints
app.get('/api/v1/analytics/dashboard-summary', async (req, res) => {
  try {
    const range = String(req.query.range ?? '7d');
    const days = Number(range.replace('d', '')) || 7;

    const end = new Date(); end.setHours(23,59,59,999);
    const start = new Date(end); start.setHours(0,0,0,0); start.setDate(end.getDate() - (days - 1));

    const channels = await prisma.channel.findMany();
    const orders = await prisma.order.findMany({ 
      where: { createdAt: { gte: start, lte: end } } 
    });

    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const totalRevenue = revenueCents / 100;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // Build sales trend
    const trendMap = new Map();
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

// Root endpoint
app.get('/', (req, res) => {
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

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log('📊 E-commerce Analytics API ready');
});

export default app;
