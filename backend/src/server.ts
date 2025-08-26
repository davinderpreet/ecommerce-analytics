// backend/src/server.ts - CLEAN VERSION WITH NO SYNTAX ERRORS
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 8080;
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Timezone configuration
const USER_TIMEZONE = process.env.TZ || 'America/Toronto';

// Type definitions for date ranges
interface DateRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  days: number;
}

interface SingleDateRange {
  start: Date;
  end: Date;
  dateStr: string;
}

// Date utility functions with proper timezone handling
const DateUtils = {
  getCurrentDateInTimezone: (): Date => {
    const now = new Date();
    const userDate = new Date(now.toLocaleString("en-US", { timeZone: USER_TIMEZONE }));
    return userDate;
  },

  parseFilterDate: (dateStr: string | undefined, defaultDate?: Date): SingleDateRange | null => {
    if (!dateStr) {
      if (!defaultDate) return null;
      dateStr = DateUtils.formatDateKey(defaultDate);
    }
    
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    
    const startOfDay = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endOfDay = new Date(year, month - 1, day, 23, 59, 59, 999);
    
    if (isNaN(startOfDay.getTime()) || isNaN(endOfDay.getTime())) {
      throw new Error(`Invalid date format: ${dateStr}. Expected YYYY-MM-DD`);
    }
    
    return {
      start: startOfDay,
      end: endOfDay,
      dateStr: DateUtils.formatDateKey(startOfDay)
    };
  },

  getRelativeDateRange: (days: number): DateRange => {
    const userNow = DateUtils.getCurrentDateInTimezone();
    const end = new Date(userNow.getFullYear(), userNow.getMonth(), userNow.getDate(), 23, 59, 59, 999);
    const start = new Date(userNow.getFullYear(), userNow.getMonth(), userNow.getDate() - (days - 1), 0, 0, 0, 0);
    
    return {
      start,
      end,
      startStr: DateUtils.formatDateKey(start),
      endStr: DateUtils.formatDateKey(end),
      days
    };
  },

  formatDateKey: (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  
  toDollars: (cents: number | null | undefined): number => {
    return ((cents ?? 0) / 100);
  },

  getTodayRange: (): SingleDateRange => {
    const userNow = DateUtils.getCurrentDateInTimezone();
    const today = new Date(userNow.getFullYear(), userNow.getMonth(), userNow.getDate());
    
    return {
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999),
      dateStr: DateUtils.formatDateKey(today)
    };
  },

  getYesterdayRange: (): SingleDateRange => {
    const userNow = DateUtils.getCurrentDateInTimezone();
    const yesterday = new Date(userNow.getFullYear(), userNow.getMonth(), userNow.getDate() - 1);
    
    return {
      start: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0),
      end: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999),
      dateStr: DateUtils.formatDateKey(yesterday)
    };
  },

  debugDateRange: (label: string, startDate: Date, endDate: Date): void => {
    const userNow = DateUtils.getCurrentDateInTimezone();
    console.log(`📅 ${label}:`);
    console.log(`   Current time in ${USER_TIMEZONE}: ${userNow.toLocaleString()}`);
    console.log(`   Start: ${startDate.toISOString()} (${startDate.toLocaleString()})`);
    console.log(`   End: ${endDate.toISOString()} (${endDate.toLocaleString()})`);
    console.log(`   Date Keys: ${DateUtils.formatDateKey(startDate)} to ${DateUtils.formatDateKey(endDate)}`);
  }
};

// Health endpoint
app.get('/api/v1/health', async (req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      api: 'running', 
      database: 'ok', 
      timezone: USER_TIMEZONE,
      ts: new Date().toISOString() 
    });
  } catch (e: any) {
    res.status(500).json({ api: 'running', database: 'error', error: e?.message });
  }
});

// Test logging endpoint
app.get('/api/v1/test-log', (req: Request, res: Response) => {
  console.log('🧪 TEST LOG - This endpoint was hit!');
  console.log('🧪 Environment variables:');
  console.log('  SHOPIFY_SHOP_DOMAIN:', process.env.SHOPIFY_SHOP_DOMAIN);
  console.log('  SHOPIFY_ADMIN_ACCESS_TOKEN exists:', !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  console.log('  USER_TIMEZONE:', USER_TIMEZONE);
  
  const userNow = DateUtils.getCurrentDateInTimezone();
  console.log('  Current time in user timezone:', userNow.toLocaleString());
  
  res.json({
    message: 'Test endpoint hit - check Railway logs',
    shop: process.env.SHOPIFY_SHOP_DOMAIN,
    tokenExists: !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    timezone: USER_TIMEZONE,
    currentTime: userNow.toLocaleString()
  });
});

// Debug endpoint
app.get('/api/v1/debug/orders', async (req: Request, res: Response) => {
  try {
    console.log('🔍 Debug orders endpoint hit');
    
    const platform = String(req.query.platform ?? 'all');
    const dateType = String(req.query.dateType ?? '7d');
    
    // Get date range based on type
    let dateRange: DateRange | SingleDateRange;
    let queryDateStr: string;
    
    if (dateType === 'today') {
      dateRange = DateUtils.getTodayRange();
      queryDateStr = dateRange.dateStr;
    } else if (dateType === 'yesterday') {
      dateRange = DateUtils.getYesterdayRange();
      queryDateStr = dateRange.dateStr;
    } else {
      const days = Number(dateType.replace('d', '')) || 7;
      dateRange = DateUtils.getRelativeDateRange(days);
      queryDateStr = `${dateRange.startStr} to ${dateRange.endStr}`;
    }
    
    DateUtils.debugDateRange(`Debug Orders Range (${dateType})`, dateRange.start, dateRange.end);
    
    // Build where clause
    let whereClause: any = {
      createdAt: { gte: dateRange.start, lte: dateRange.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) whereClause.channelId = channel.id;
    }
    
    // Get detailed order information
    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        channel: true,
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log('🔍 Found orders for debug:', orders.length);
    
    // Calculate totals and show daily breakdown
    const ordersByDate = new Map<string, any[]>();
    let totalRevenueCents = 0;
    
    orders.forEach(order => {
      const dateKey = DateUtils.formatDateKey(order.createdAt);
      if (!ordersByDate.has(dateKey)) {
        ordersByDate.set(dateKey, []);
      }
      ordersByDate.get(dateKey)!.push(order);
      totalRevenueCents += (order.totalCents || 0);
    });
    
    // Create daily breakdown
    const dailyBreakdown = Array.from(ordersByDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, orders]) => {
        const dayRevenue = orders.reduce((sum, o) => sum + (o.totalCents || 0), 0);
        return {
          date,
          orderCount: orders.length,
          revenue: DateUtils.toDollars(dayRevenue),
          orders: orders.map(o => ({
            number: o.number,
            channelRef: o.channelRef,
            total: DateUtils.toDollars(o.totalCents || 0),
            createdAt: o.createdAt.toISOString(),
            createdAtLocal: o.createdAt.toLocaleString(),
            itemCount: o.items.length,
            subtotal: DateUtils.toDollars(o.subtotalCents || 0),
            tax: DateUtils.toDollars(o.taxCents || 0),
            shipping: DateUtils.toDollars(o.shippingCents || 0)
          }))
        };
      });
    
    res.json({
      success: true,
      dateType,
      queryRange: {
        start: dateRange.start.toISOString(),
        end: dateRange.end.toISOString(),
        dateStr: queryDateStr
      },
      timezone: USER_TIMEZONE,
      currentTime: DateUtils.getCurrentDateInTimezone().toLocaleString(),
      summary: {
        totalOrders: orders.length,
        totalRevenue: DateUtils.toDollars(totalRevenueCents),
        averageOrderValue: orders.length > 0 ? DateUtils.toDollars(Math.round(totalRevenueCents / orders.length)) : 0
      },
      dailyBreakdown,
      allOrdersFlat: orders.map(o => ({
        number: o.number,
        channelRef: o.channelRef,
        total: DateUtils.toDollars(o.totalCents || 0),
        dateKey: DateUtils.formatDateKey(o.createdAt),
        createdAt: o.createdAt.toISOString(),
        createdAtLocal: o.createdAt.toLocaleString()
      }))
    });
    
  } catch (e: any) {
    console.error('🔍 Debug endpoint error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Shopify sync endpoint
app.all('/api/v1/sync/shopify', async (req: Request, res: Response) => {
  console.log('🧪 SYNC ENDPOINT HIT - Starting debug');
  
  const days = Number(req.query.days ?? 7);
  console.log('🧪 Days:', days);
  console.log('🧪 Shop domain:', process.env.SHOPIFY_SHOP_DOMAIN);
  console.log('🧪 Token exists:', !!process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
  console.log('🧪 User timezone:', USER_TIMEZONE);
  
  try {
    console.log('🧪 Starting inline Shopify sync...');
    
    const SHOP = process.env.SHOPIFY_SHOP_DOMAIN!;
    const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
    const API_VER = '2024-07';
    
    if (!SHOP || !TOKEN) {
      res.status(400).json({ ok: false, error: 'Missing Shopify credentials' });
      return;
    }
    
    console.log('🧪 About to ensure channel...');
    
    // Ensure shopify channel exists
    let channel = await prisma.channel.findUnique({ where: { code: 'shopify' } });
    if (!channel) {
      console.log('🧪 Creating shopify channel...');
      channel = await prisma.channel.create({ data: { name: 'Shopify', code: 'shopify' } });
    }
    console.log('🧪 Channel ID:', channel.id);
    
    // Calculate date range using improved date utilities with proper timezone
    const dateRange = DateUtils.getRelativeDateRange(days);
    console.log('🧪 Fetching orders since:', dateRange.start.toISOString());
    DateUtils.debugDateRange('Sync Date Range', dateRange.start, dateRange.end);
    
    // GraphQL query
    const sinceDate = dateRange.start.toISOString();
    const query = `
      query {
        orders(first: 50, query: "created_at:>=${sinceDate}", reverse: true) {
          edges {
            node {
              id name createdAt currencyCode
              totalPriceSet { shopMoney { amount } }
              subtotalPriceSet { shopMoney { amount } }
              totalTaxSet { shopMoney { amount } }
              totalShippingPriceSet { shopMoney { amount } }
            }
          }
        }
      }`;
    
    console.log('🧪 About to make GraphQL request...');
    
    // Make API call
    const response = await fetch(`https://${SHOP}/admin/api/${API_VER}/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': TOKEN,
      },
      body: JSON.stringify({ query }),
    });
    
    console.log('🧪 GraphQL response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('🧪 GraphQL request failed:', errorText);
      res.status(500).json({ ok: false, error: `Shopify API error: ${response.status}` });
      return;
    }
    
    const data: any = await response.json();
    console.log('🧪 GraphQL response received');
    
    if (data.errors) {
      console.error('🧪 GraphQL errors:', data.errors);
      res.status(500).json({ ok: false, error: 'GraphQL errors', details: data.errors });
      return;
    }
    
    const orders = data?.data?.orders?.edges ?? [];
    console.log('🧪 Found orders:', orders.length);
    
    let processedCount = 0;
    for (const edge of orders) {
      const order = edge.node;
      const orderCreatedAt = new Date(order.createdAt);
      console.log('🧪 Processing order:', order.name, 'Total:', order.totalPriceSet.shopMoney.amount, 'Date:', order.createdAt);
      console.log('🧪 Order date parsed:', orderCreatedAt.toISOString(), '(', orderCreatedAt.toLocaleString(), ')');
      console.log('🧪 Order date key:', DateUtils.formatDateKey(orderCreatedAt));
      
      const totalCents = Math.round(parseFloat(order.totalPriceSet.shopMoney.amount) * 100);
      const subtotalCents = Math.round(parseFloat(order.subtotalPriceSet.shopMoney.amount) * 100);
      const taxCents = Math.round(parseFloat(order.totalTaxSet.shopMoney.amount) * 100);
      const shippingCents = Math.round(parseFloat(order.totalShippingPriceSet.shopMoney.amount) * 100);
      
      try {
        const savedOrder = await prisma.order.upsert({
          where: { channelRef: order.id },
          update: {
            number: order.name,
            createdAt: orderCreatedAt,
            currency: order.currencyCode,
            subtotalCents,
            taxCents,
            shippingCents,
            totalCents,
            customerEmail: null,
          },
          create: {
            channelId: channel.id,
            channelRef: order.id,
            number: order.name,
            createdAt: orderCreatedAt,
            currency: order.currencyCode,
            subtotalCents,
            taxCents,
            shippingCents,
            totalCents,
            customerEmail: null,
          },
        });
        
        console.log('🧪 Saved order:', savedOrder.number, 'ID:', savedOrder.id, 'Created:', savedOrder.createdAt);
        processedCount++;
        
      } catch (dbError: any) {
        console.error('🧪 Database error:', dbError.message);
      }
    }
    
    console.log('🧪 Sync complete! Processed:', processedCount, 'orders');
    
    res.json({ ok: true, source: 'shopify', days, found: orders.length, processed: processedCount });
    
  } catch (error: any) {
    console.error('🧪 Sync failed:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Today's data endpoint
app.get('/api/v1/analytics/today', async (req: Request, res: Response) => {
  try {
    console.log('📅 Today endpoint hit');
    const platform = String(req.query.platform ?? 'all');
    const todayRange = DateUtils.getTodayRange();
    
    DateUtils.debugDateRange('Today Query Range', todayRange.start, todayRange.end);
    
    let whereClause: any = {
      createdAt: { gte: todayRange.start, lte: todayRange.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) whereClause.channelId = channel.id;
    }
    
    const orders = await prisma.order.findMany({ where: whereClause });
    console.log('📅 Today orders found:', orders.length);
    
    orders.forEach(o => {
      console.log(`📅 Today order: ${o.number} - ${DateUtils.formatDateKey(o.createdAt)} (${o.createdAt.toLocaleString()}) - $${DateUtils.toDollars(o.totalCents)}`);
    });
    
    const totalRevenue = DateUtils.toDollars(orders.reduce((s, o) => s + (o.totalCents || 0), 0));
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    
    res.json({
      success: true,
      date: todayRange.dateStr,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      debug: {
        queryRange: {
          start: todayRange.start.toISOString(),
          end: todayRange.end.toISOString(),
          dateStr: todayRange.dateStr
        },
        timezone: USER_TIMEZONE,
        currentTime: DateUtils.getCurrentDateInTimezone().toLocaleString(),
        orderDetails: orders.map(o => ({
          number: o.number,
          total: DateUtils.toDollars(o.totalCents || 0),
          dateKey: DateUtils.formatDateKey(o.createdAt),
          createdAt: o.createdAt.toISOString(),
          createdAtLocal: o.createdAt.toLocaleString()
        }))
      }
    });
  } catch (e: any) {
    console.error('📅 Today endpoint error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Yesterday's data endpoint
app.get('/api/v1/analytics/yesterday', async (req: Request, res: Response) => {
  try {
    console.log('📅 Yesterday endpoint hit');
    const platform = String(req.query.platform ?? 'all');
    const yesterdayRange = DateUtils.getYesterdayRange();
    
    DateUtils.debugDateRange('Yesterday Query Range', yesterdayRange.start, yesterdayRange.end);
    
    let whereClause: any = {
      createdAt: { gte: yesterdayRange.start, lte: yesterdayRange.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) whereClause.channelId = channel.id;
    }
    
    const orders = await prisma.order.findMany({ where: whereClause });
    console.log('📅 Yesterday orders found:', orders.length);
    
    orders.forEach(o => {
      console.log(`📅 Yesterday order: ${o.number} - ${DateUtils.formatDateKey(o.createdAt)} (${o.createdAt.toLocaleString()}) - $${DateUtils.toDollars(o.totalCents)}`);
    });
    
    const totalRevenue = DateUtils.toDollars(orders.reduce((s, o) => s + (o.totalCents || 0), 0));
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;
    
    res.json({
      success: true,
      date: yesterdayRange.dateStr,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      debug: {
        queryRange: {
          start: yesterdayRange.start.toISOString(),
          end: yesterdayRange.end.toISOString(),
          dateStr: yesterdayRange.dateStr
        },
        timezone: USER_TIMEZONE,
        currentTime: DateUtils.getCurrentDateInTimezone().toLocaleString(),
        orderDetails: orders.map(o => ({
          number: o.number,
          total: DateUtils.toDollars(o.totalCents || 0),
          dateKey: DateUtils.formatDateKey(o.createdAt),
          createdAt: o.createdAt.toISOString(),
          createdAtLocal: o.createdAt.toLocaleString()
        }))
      }
    });
  } catch (e: any) {
    console.error('📅 Yesterday endpoint error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Dashboard summary endpoint
app.get('/api/v1/analytics/dashboard-summary', async (req: Request, res: Response) => {
  try {
    console.log('📊 Dashboard summary request:', req.query);
    
    const range = String(req.query.range ?? '7d');
    const platform = String(req.query.platform ?? 'all');
    const days = Number(range.replace('d', '')) || 7;
    
    const dateRange = DateUtils.getRelativeDateRange(days);
    DateUtils.debugDateRange('Dashboard Summary Range', dateRange.start, dateRange.end);
    
    let whereClause: any = {
      createdAt: { gte: dateRange.start, lte: dateRange.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) {
        whereClause.channelId = channel.id;
      }
    }
    
    const [channels, orders] = await Promise.all([
      prisma.channel.findMany(),
      prisma.order.findMany({ where: whereClause })
    ]);
    
    console.log('📊 Found orders:', orders.length);
    
    const ordersByDate = new Map<string, number>();
    orders.forEach(o => {
      const dateKey = DateUtils.formatDateKey(o.createdAt);
      ordersByDate.set(dateKey, (ordersByDate.get(dateKey) || 0) + 1);
      console.log(`📊 Order: ${o.number} - ${dateKey} (${o.createdAt.toLocaleString()}) - $${DateUtils.toDollars(o.totalCents)}`);
    });
    
    const totalOrders = orders.length;
    const revenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const totalRevenue = DateUtils.toDollars(revenueCents);
    const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

    // Build platform comparison
    const channelMap = new Map(channels.map(c => [c.id, c]));
    const platformStats = new Map<string, { revenueCents: number; orders: number }>();
    
    for (const order of orders) {
      const channelId = order.channelId;
      const stats = platformStats.get(channelId) || { revenueCents: 0, orders: 0 };
      stats.revenueCents += (order.totalCents || 0);
      stats.orders += 1;
      platformStats.set(channelId, stats);
    }
    
    const platformComparison = Array.from(platformStats.entries()).map(([channelId, stats]) => ({
      name: channelMap.get(channelId)?.name || 'Unknown',
      revenue: DateUtils.toDollars(stats.revenueCents),
      orders: stats.orders,
      color: channelMap.get(channelId)?.name.toLowerCase().includes('shopify') ? '#96BF47' : '#0066CC'
    }));

    // Build sales trend
    const trendMap = new Map<string, { revenueCents: number; orders: number }>();
    for (let i = 0; i < days; i++) {
      const d = new Date(dateRange.start);
      d.setDate(dateRange.start.getDate() + i);
      const dateKey = DateUtils.formatDateKey(d);
      trendMap.set(dateKey, { revenueCents: 0, orders: 0 });
    }
    
    for (const order of orders) {
      const dateKey = DateUtils.formatDateKey(order.createdAt);
      const trend = trendMap.get(dateKey);
      if (trend) {
        trend.revenueCents += (order.totalCents || 0);
        trend.orders += 1;
      }
    }

    const salesTrend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: DateUtils.toDollars(v.revenueCents),
        orders: v.orders,
        aov: v.orders ? DateUtils.toDollars(Math.round(v.revenueCents / v.orders)) : 0
      }));

    res.json({
      success: true,
      range: { start: dateRange.startStr, end: dateRange.endStr, days },
      totalRevenue,
      totalOrders,
      avgOrderValue,
      revenueGrowth: null,
      platformComparison,
      salesTrend,
      debug: {
        queryRange: {
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString()
        },
        timezone: USER_TIMEZONE,
        currentTime: DateUtils.getCurrentDateInTimezone().toLocaleString(),
        ordersFound: orders.length,
        ordersByDate: Array.from(ordersByDate.entries())
      }
    });
  } catch (e: any) {
    console.error('📊 Dashboard summary error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Metrics endpoint
app.get('/api/v1/analytics/metrics', async (req: Request, res: Response) => {
  try {
    const platform = String(req.query.platform ?? 'all');
    const startDateStr = req.query.start_date as string;
    const endDateStr = req.query.end_date as string;
    
    if (!startDateStr || !endDateStr) {
      res.status(400).json({ 
        success: false, 
        error: 'start_date and end_date are required' 
      });
      return;
    }
    
    const startDate = DateUtils.parseFilterDate(startDateStr);
    const endDate = DateUtils.parseFilterDate(endDateStr);
    
    if (!startDate || !endDate) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
      return;
    }
    
    let whereClause: any = {
      createdAt: { gte: startDate.start, lte: endDate.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) {
        whereClause.channelId = channel.id;
      }
    }
    
    const orders = await prisma.order.findMany({ 
      where: whereClause,
      select: { totalCents: true, createdAt: true, number: true }
    });
    
    const totalOrders = orders.length;
    const totalRevenueCents = orders.reduce((s, o) => s + (o.totalCents || 0), 0);
    const avgOrderValueCents = totalOrders ? Math.round(totalRevenueCents / totalOrders) : 0;

    res.json({
      success: true,
      filters: { 
        start_date: startDate.dateStr, 
        end_date: endDate.dateStr, 
        platform 
      },
      totalRevenue: DateUtils.toDollars(totalRevenueCents),
      totalOrders,
      avgOrderValue: DateUtils.toDollars(avgOrderValueCents),
      debug: {
        queryRange: {
          start: startDate.start.toISOString(),
          end: endDate.end.toISOString()
        },
        timezone: USER_TIMEZONE
      }
    });
    
  } catch (e: any) {
    console.error('📈 Metrics error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Sales trend endpoint
app.get('/api/v1/analytics/sales-trend', async (req: Request, res: Response) => {
  try {
    const startDateStr = req.query.start_date as string;
    const endDateStr = req.query.end_date as string;
    const platform = String(req.query.platform ?? 'all');
    
    if (!startDateStr || !endDateStr) {
      res.status(400).json({ 
        success: false, 
        error: 'start_date and end_date are required' 
      });
      return;
    }
    
    const startDate = DateUtils.parseFilterDate(startDateStr);
    const endDate = DateUtils.parseFilterDate(endDateStr);
    
    if (!startDate || !endDate) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid date format. Use YYYY-MM-DD' 
      });
      return;
    }
    
    let whereClause: any = {
      createdAt: { gte: startDate.start, lte: endDate.end }
    };
    
    if (platform !== 'all') {
      const channel = await prisma.channel.findUnique({ where: { code: platform } });
      if (channel) {
        whereClause.channelId = channel.id;
      }
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      select: { createdAt: true, totalCents: true, number: true },
    });

    // Create day buckets for the entire range
    const dayMap = new Map<string, { revenueCents: number; orders: number }>();
    
    for (let d = new Date(startDate.start); d <= endDate.end; d = new Date(d.getTime() + 86_400_000)) {
      const dateKey = DateUtils.formatDateKey(d);
      dayMap.set(dateKey, { revenueCents: 0, orders: 0 });
    }
    
    // Fill in actual data
    for (const order of orders) {
      const dateKey = DateUtils.formatDateKey(order.createdAt);
      const agg = dayMap.get(dateKey);
      if (agg) {
        agg.revenueCents += (order.totalCents || 0);
        agg.orders += 1;
      }
    }

    const trend = Array.from(dayMap.entries())
      .sort(([a], [b]) => a < b ? -1 : 1)
      .map(([date, v]) => ({
        date,
        revenue: DateUtils.toDollars(v.revenueCents),
        orders: v.orders,
        aov: v.orders ? DateUtils.toDollars(Math.round(v.revenueCents / v.orders)) : 0
      }));

    res.json({ 
      success: true, 
      start: startDate.dateStr, 
      end: endDate.dateStr, 
      data: trend,
      debug: {
        queryRange: {
          start: startDate.start.toISOString(),
          end: endDate.end.toISOString()
        },
        timezone: USER_TIMEZONE
      }
    });
  } catch (e: any) {
    console.error('📉 Sales trend error:', e);
    res.status(500).json({ success: false, error: e?.message });
  }
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'E-commerce Analytics API',
    version: '2.4.0',
    status: 'running',
    features: ['Multi-platform support', 'FIXED timezone handling', 'Real-time sync', 'Debug endpoints', 'Clean TypeScript'],
    timezone: USER_TIMEZONE,
    currentTime: DateUtils.getCurrentDateInTimezone().toLocaleString(),
    endpoints: [
      'GET /api/v1/health',
      'GET /api/v1/test-log',
      'GET /api/v1/sync/shopify?days=7',
      'GET /api/v1/analytics/today?platform=all',
      'GET /api/v1/analytics/yesterday?platform=all',
      'GET /api/v1/analytics/dashboard-summary?range=7d&platform=all',
      'GET /api/v1/analytics/metrics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&platform=all',
      'GET /api/v1/analytics/sales-trend?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&platform=all',
      'GET /api/v1/debug/orders?dateType=yesterday&platform=all'
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
  console.log('📊 E-commerce Analytics API v2.4 ready');
  console.log('🔧 Features: Multi-platform + FIXED timezone handling + Debug endpoints + Clean TypeScript');
  console.log('📅 All dates now use consistent timezone logic');
  console.log('🌍 Timezone:', USER_TIMEZONE);
  console.log('⏰ Current time:', DateUtils.getCurrentDateInTimezone().toLocaleString());
});

export default app;
