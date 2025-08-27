// backend/src/routes/product-analytics.ts - FIXED VERSION
import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

interface ProductPerformance {
  id: string;
  sku: string;
  title: string;
  
  // Performance Metrics
  performanceScore: number; // 0-100 overall score
  category: 'Star' | 'Cash Cow' | 'Question Mark' | 'Dog'; // BCG Matrix
  
  // Sales Metrics
  totalRevenue: number;
  totalUnitsSold: number;
  averageSellingPrice: number;
  salesVelocity: number; // units/day
  salesTrend: 'growing' | 'stable' | 'declining';
  seasonalityIndex: number; // 1 = normal, >1 = seasonal peak
  
  // Inventory Metrics
  turnoverRate: number; // times per year
  stockoutDays: number; // days out of stock in period
  averageInventory: number;
  holdingCostPerYear: number;
  
  // Profitability (if cost data available)
  grossMargin: number;
  contributionMargin: number;
  profitabilityRank: number;
  
  // Pricing Intelligence
  priceElasticity: number; // How demand changes with price
  optimalPrice: number; // Suggested price for max profit
  currentPrice: number;
  pricePosition: 'underpriced' | 'optimal' | 'overpriced';
  competitorPriceIndex: number; // 1 = market average
  
  // Recommendations
  recommendations: string[];
  urgentActions: string[];
  projectedImpact: {
    revenueIncrease: number;
    profitIncrease: number;
  };
}

// Add the missing calculateSalesMetrics function
interface SalesMetrics {
  dailySales: Record<string, { units: number; revenue: number }>;
  totalUnits: number;
  totalRevenue: number;
}

function calculateSalesMetrics(orderItems: any[]): SalesMetrics {
  return orderItems.reduce((acc, item) => {
    const date = item.order.createdAt.toISOString().split('T')[0];
    if (!acc.dailySales[date]) {
      acc.dailySales[date] = { units: 0, revenue: 0 };
    }
    acc.dailySales[date].units += item.quantity;
    acc.dailySales[date].revenue += item.totalCents / 100;
    acc.totalUnits += item.quantity;
    acc.totalRevenue += item.totalCents / 100;
    return acc;
  }, {
    dailySales: {} as Record<string, { units: number; revenue: number }>,
    totalUnits: 0,
    totalRevenue: 0
  });
}

// GET /api/v1/analytics/product-performance
router.get('/product-performance', async (req, res) => {
  try {
    const { period = '90d', category = 'all' } = req.query;
    
    // Calculate date range
    const days = parseInt(period.toString().replace('d', ''));
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Fetch all products with their complete history
    const products = await prisma.product.findMany({
      where: { active: true },
      include: {
        orderItems: {
          include: { order: true },
          where: {
            order: {
              createdAt: { gte: startDate, lte: endDate }
            }
          }
        },
        inventory: true
      }
    });
    
    const performanceData: ProductPerformance[] = [];
    
    for (const product of products) {
      // Calculate sales metrics using the fixed function
      const salesData = calculateSalesMetrics(product.orderItems);
      
      // Calculate performance metrics
      const daysInPeriod = days;
      const salesDays = Object.keys(salesData.dailySales).length;
      const salesVelocity = salesData.totalUnits / daysInPeriod;
      const averageSellingPrice = salesData.totalUnits > 0 
        ? salesData.totalRevenue / salesData.totalUnits 
        : 0;
      
      // Calculate inventory turnover
      const currentInventory = product.inventory?.quantity || 0;
      const averageInventory = currentInventory; // Simplified - should track over time
      const turnoverRate = averageInventory > 0 
        ? (salesData.totalUnits / averageInventory) * (365 / days)
        : 0;
      
      // Calculate sales trend (simple linear regression)
      const salesTrend = calculateSalesTrend(salesData.dailySales);
      
      // Price elasticity calculation (simplified)
      const priceElasticity = calculatePriceElasticity(product.orderItems);
      
      // Calculate optimal price
      const currentPrice = (product.priceCents || 0) / 100;
      const optimalPrice = calculateOptimalPrice(
        currentPrice,
        priceElasticity,
        salesVelocity
      );
      
      // Categorize product (BCG Matrix)
      const category = categorizeProduct(
        salesData.totalRevenue,
        salesVelocity,
        salesTrend,
        turnoverRate
      );
      
      // Calculate performance score (0-100)
      const performanceScore = calculatePerformanceScore({
        revenue: salesData.totalRevenue,
        velocity: salesVelocity,
        turnover: turnoverRate,
        trend: salesTrend
      });
      
      // Generate recommendations
      const recommendations = generateRecommendations({
        category,
        priceElasticity,
        currentPrice,
        optimalPrice,
        currentInventory,
        salesVelocity,
        turnoverRate
      });
      
      performanceData.push({
        id: product.id,
        sku: product.sku,
        title: product.title,
        
        // Performance
        performanceScore,
        category,
        
        // Sales
        totalRevenue: salesData.totalRevenue,
        totalUnitsSold: salesData.totalUnits,
        averageSellingPrice,
        salesVelocity,
        salesTrend,
        seasonalityIndex: 1, // TODO: Calculate seasonal patterns
        
        // Inventory
        turnoverRate,
        stockoutDays: daysInPeriod - salesDays,
        averageInventory,
        holdingCostPerYear: averageInventory * currentPrice * 0.25, // 25% holding cost assumption
        
        // Profitability
        grossMargin: 0.4, // Placeholder - need cost data
        contributionMargin: 0.3,
        profitabilityRank: 0,
        
        // Pricing
        priceElasticity,
        optimalPrice,
        currentPrice,
        pricePosition: getPricePosition(currentPrice, optimalPrice),
        competitorPriceIndex: 1, // Placeholder
        
        // Recommendations
        recommendations: recommendations.actions,
        urgentActions: recommendations.urgent,
        projectedImpact: recommendations.impact
      });
    }
    
    // Sort by performance score
    performanceData.sort((a, b) => b.performanceScore - a.performanceScore);
    
    // Add profitability rank
    performanceData.forEach((product, index) => {
      product.profitabilityRank = index + 1;
    });
    
    // Calculate summary statistics
    const summary = {
      totalProducts: performanceData.length,
      stars: performanceData.filter(p => p.category === 'Star').length,
      cashCows: performanceData.filter(p => p.category === 'Cash Cow').length,
      questionMarks: performanceData.filter(p => p.category === 'Question Mark').length,
      dogs: performanceData.filter(p => p.category === 'Dog').length,
      
      averagePerformanceScore: performanceData.length > 0 
        ? performanceData.reduce((sum, p) => sum + p.performanceScore, 0) / performanceData.length
        : 0,
      totalRevenue: performanceData.reduce((sum, p) => sum + p.totalRevenue, 0),
      
      pricingOpportunities: {
        underpriced: performanceData.filter(p => p.pricePosition === 'underpriced').length,
        overpriced: performanceData.filter(p => p.pricePosition === 'overpriced').length,
        potentialRevenueIncrease: performanceData.reduce((sum, p) => sum + p.projectedImpact.revenueIncrease, 0)
      }
    };
    
    res.json({
      success: true,
      period,
      summary,
      products: performanceData
    });
    
  } catch (error: any) {
    console.error('Product performance error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to calculate product performance' 
    });
  }
});

// Helper functions
function calculateSalesTrend(dailySales: Record<string, { units: number; revenue: number }>): 'growing' | 'stable' | 'declining' {
  const dates = Object.keys(dailySales).sort();
  if (dates.length < 7) return 'stable';
  
  // Compare last 7 days to previous 7 days
  const recent = dates.slice(-7);
  const previous = dates.slice(-14, -7);
  
  const recentAvg = recent.reduce((sum, date) => sum + dailySales[date].units, 0) / 7;
  const previousAvg = previous.reduce((sum, date) => sum + (dailySales[date]?.units || 0), 0) / 7;
  
  const change = previousAvg > 0 ? (recentAvg - previousAvg) / previousAvg : 0;
  
  if (change > 0.2) return 'growing';
  if (change < -0.2) return 'declining';
  return 'stable';
}

function calculatePriceElasticity(orderItems: any[]): number {
  // Simplified price elasticity
  // In reality, you'd analyze how quantity changes with price changes
  // For now, return a typical retail elasticity
  return -1.5; // Elastic demand (1% price increase = 1.5% demand decrease)
}

function calculateOptimalPrice(currentPrice: number, elasticity: number, velocity: number): number {
  // Simplified optimal pricing
  // P* = MC * (e / (e + 1)) where e is elasticity, MC is marginal cost
  
  const estimatedCost = currentPrice * 0.6; // Assume 40% margin
  const markup = Math.abs(elasticity) / (Math.abs(elasticity) - 1);
  const optimal = estimatedCost * markup;
  
  // Don't suggest changes more than 20%
  const maxChange = currentPrice * 0.2;
  if (optimal > currentPrice + maxChange) return currentPrice + maxChange;
  if (optimal < currentPrice - maxChange) return currentPrice - maxChange;
  
  return optimal;
}

function categorizeProduct(
  revenue: number,
  velocity: number,
  trend: string,
  turnover: number
): 'Star' | 'Cash Cow' | 'Question Mark' | 'Dog' {
  
  // High growth + High share = Star
  if (trend === 'growing' && velocity > 2) return 'Star';
  
  // Low growth + High share = Cash Cow  
  if (trend === 'stable' && velocity > 2) return 'Cash Cow';
  
  // High growth + Low share = Question Mark
  if (trend === 'growing' && velocity <= 2) return 'Question Mark';
  
  // Low growth + Low share = Dog
  return 'Dog';
}

function calculatePerformanceScore(metrics: any): number {
  // Weighted scoring: Revenue (40%), Velocity (30%), Turnover (20%), Trend (10%)
  let score = 0;
  
  // Revenue score (0-40)
  score += Math.min(40, (metrics.revenue / 10000) * 40); // Normalized to $10k
  
  // Velocity score (0-30)
  score += Math.min(30, (metrics.velocity / 5) * 30); // Normalized to 5 units/day
  
  // Turnover score (0-20)
  score += Math.min(20, (metrics.turnover / 12) * 20); // Normalized to 12x/year
  
  // Trend score (0-10)
  if (metrics.trend === 'growing') score += 10;
  else if (metrics.trend === 'stable') score += 5;
  
  return Math.min(100, Math.round(score));
}

function getPricePosition(current: number, optimal: number): 'underpriced' | 'optimal' | 'overpriced' {
  const difference = (current - optimal) / optimal;
  
  if (difference < -0.05) return 'underpriced';
  if (difference > 0.05) return 'overpriced';
  return 'optimal';
}

function generateRecommendations(params: any): { actions: string[], urgent: string[], impact: any } {
  const actions: string[] = [];
  const urgent: string[] = [];
  let revenueIncrease = 0;
  let profitIncrease = 0;
  
  // Pricing recommendations
  if (params.currentPrice < params.optimalPrice * 0.95) {
    actions.push(`Increase price by ${Math.round((params.optimalPrice - params.currentPrice) / params.currentPrice * 100)}% to maximize profit`);
    revenueIncrease += (params.optimalPrice - params.currentPrice) * params.salesVelocity * 30;
  }
  
  // Inventory recommendations
  if (params.turnoverRate < 6) {
    actions.push('Reduce order quantities to improve cash flow');
    urgent.push('High inventory holding costs detected');
  }
  
  if (params.currentInventory < params.salesVelocity * 7) {
    urgent.push('Low stock - reorder immediately');
  }
  
  // Category-based recommendations
  switch (params.category) {
    case 'Star':
      actions.push('Invest in marketing to maintain growth');
      actions.push('Ensure inventory availability');
      break;
    case 'Cash Cow':
      actions.push('Maintain current strategy');
      actions.push('Consider bundling with Question Marks');
      break;
    case 'Question Mark':
      actions.push('Test promotional pricing');
      actions.push('Analyze customer feedback');
      break;
    case 'Dog':
      urgent.push('Consider discontinuing or liquidating');
      actions.push('Reduce inventory levels');
      break;
  }
  
  return {
    actions,
    urgent,
    impact: {
      revenueIncrease: Math.round(revenueIncrease),
      profitIncrease: Math.round(profitIncrease * 0.4) // Assume 40% margin
    }
  };
}

export default router;
