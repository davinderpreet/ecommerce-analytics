import React, { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Minus, AlertTriangle,
  DollarSign, Package, Star, HelpCircle, Zap,
  ArrowUp, ArrowDown, Target, BarChart3
} from 'lucide-react';

const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:8080").replace(/\/$/, "");

const ProductPerformanceMatrix = () => {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setPeriod] = useState('90d');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    fetchPerformanceData();
  }, [selectedPeriod]);

  const fetchPerformanceData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/analytics/product-performance?period=${selectedPeriod}`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.products);
        setSummary(data.summary);
      }
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      // Set mock data for demo
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  const setMockData = () => {
    const mockProducts = [
      {
        id: '1',
        sku: 'IPH15PRO',
        title: 'iPhone 15 Pro',
        performanceScore: 92,
        category: 'Star',
        totalRevenue: 125000,
        totalUnitsSold: 125,
        averageSellingPrice: 1000,
        salesVelocity: 4.2,
        salesTrend: 'growing',
        turnoverRate: 8.5,
        currentPrice: 999,
        optimalPrice: 1049,
        pricePosition: 'underpriced',
        priceElasticity: -1.2,
        grossMargin: 0.42,
        recommendations: [
          'Increase price by 5% to capture additional margin',
          'Maintain high inventory levels to support growth'
        ],
        urgentActions: [],
        projectedImpact: { revenueIncrease: 6250, profitIncrease: 2500 }
      },
      {
        id: '2',
        sku: 'HDPHN-BT',
        title: 'Bluetooth Headphones',
        performanceScore: 78,
        category: 'Cash Cow',
        totalRevenue: 45000,
        totalUnitsSold: 450,
        averageSellingPrice: 100,
        salesVelocity: 5,
        salesTrend: 'stable',
        turnoverRate: 12,
        currentPrice: 99,
        optimalPrice: 99,
        pricePosition: 'optimal',
        priceElasticity: -2.1,
        grossMargin: 0.55,
        recommendations: [
          'Bundle with slower-moving products',
          'Consider volume discounts for bulk orders'
        ],
        urgentActions: [],
        projectedImpact: { revenueIncrease: 0, profitIncrease: 0 }
      },
      {
        id: '3',
        sku: 'CASE-001',
        title: 'Phone Case',
        performanceScore: 45,
        category: 'Dog',
        totalRevenue: 5000,
        totalUnitsSold: 200,
        averageSellingPrice: 25,
        salesVelocity: 0.5,
        salesTrend: 'declining',
        turnoverRate: 2,
        currentPrice: 25,
        optimalPrice: 19,
        pricePosition: 'overpriced',
        priceElasticity: -3.5,
        grossMargin: 0.65,
        recommendations: [
          'Reduce price by 24% to stimulate demand',
          'Consider discontinuing if performance doesn\'t improve'
        ],
        urgentActions: ['High inventory holding costs - reduce stock levels'],
        projectedImpact: { revenueIncrease: -1000, profitIncrease: 200 }
      }
    ];

    setProducts(mockProducts);
    setSummary({
      totalProducts: 3,
      stars: 1,
      cashCows: 1,
      questionMarks: 0,
      dogs: 1,
      averagePerformanceScore: 71.67,
      totalRevenue: 175000,
      pricingOpportunities: {
        underpriced: 1,
        overpriced: 1,
        potentialRevenueIncrease: 5250
      }
    });
  };

  const getCategoryColor = (category) => {
    switch (category) {
      case 'Star': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Cash Cow': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Question Mark': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Dog': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'growing': return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'declining': return <TrendingDown className="w-4 h-4 text-red-400" />;
      default: return <Minus className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getPricePositionColor = (position) => {
    switch (position) {
      case 'underpriced': return 'text-blue-400';
      case 'overpriced': return 'text-orange-400';
      default: return 'text-green-400';
    }
  };

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => p.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="relative z-10">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent mb-2">
            Product Performance Matrix
          </h1>
          <p className="text-white/70">AI-powered insights for pricing and inventory optimization</p>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <Star className="w-8 h-8 text-yellow-400" />
                <span className="text-2xl font-bold text-white">{summary.stars}</span>
              </div>
              <p className="text-white/70">Star Products</p>
              <p className="text-xs text-white/50 mt-1">High growth, high share</p>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <DollarSign className="w-8 h-8 text-green-400" />
                <span className="text-2xl font-bold text-white">{summary.cashCows}</span>
              </div>
              <p className="text-white/70">Cash Cows</p>
              <p className="text-xs text-white/50 mt-1">Stable revenue generators</p>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <Target className="w-8 h-8 text-blue-400" />
                <span className="text-2xl font-bold text-white">
                  ${(summary.pricingOpportunities.potentialRevenueIncrease / 1000).toFixed(1)}k
                </span>
              </div>
              <p className="text-white/70">Revenue Opportunity</p>
              <p className="text-xs text-white/50 mt-1">From price optimization</p>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <BarChart3 className="w-8 h-8 text-purple-400" />
                <span className="text-2xl font-bold text-white">
                  {Math.round(summary.averagePerformanceScore)}
                </span>
              </div>
              <p className="text-white/70">Avg Performance</p>
              <p className="text-xs text-white/50 mt-1">Overall portfolio health</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex flex-wrap gap-4">
            <select
              value={selectedPeriod}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-white"
            >
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="180d">Last 6 Months</option>
              <option value="365d">Last Year</option>
            </select>

            <div className="flex gap-2">
              {['all', 'Star', 'Cash Cow', 'Question Mark', 'Dog'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-2 rounded-xl transition-all ${
                    selectedCategory === cat
                      ? 'bg-purple-500/30 text-white border border-purple-400'
                      : 'bg-white/10 text-white/70 border border-white/20'
                  }`}
                >
                  {cat === 'all' ? 'All Products' : cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Product Table */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="text-left p-4 text-white/80">Product</th>
                  <th className="text-center p-4 text-white/80">Performance</th>
                  <th className="text-center p-4 text-white/80">Sales</th>
                  <th className="text-center p-4 text-white/80">Pricing</th>
                  <th className="text-center p-4 text-white/80">Opportunity</th>
                  <th className="text-right p-4 text-white/80">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-12 text-white/60">
                      Loading performance data...
                    </td>
                  </tr>
                ) : filteredProducts.map(product => (
                  <tr key={product.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-4">
                      <div>
                        <p className="text-white font-medium">{product.title}</p>
                        <p className="text-white/50 text-sm">SKU: {product.sku}</p>
                        <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs border ${getCategoryColor(product.category)}`}>
                          {product.category}
                        </span>
                      </div>
                    </td>
                    
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <div className="text-2xl font-bold text-white mb-1">
                          {product.performanceScore}
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                            style={{ width: `${product.performanceScore}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-center">
                      <div className="space-y-1">
                        <p className="text-white font-medium">
                          ${(product.totalRevenue / 1000).toFixed(1)}k
                        </p>
                        <p className="text-white/60 text-sm">
                          {product.totalUnitsSold} units
                        </p>
                        <div className="flex items-center justify-center gap-1">
                          {getTrendIcon(product.salesTrend)}
                          <span className="text-white/50 text-xs">
                            {product.salesVelocity.toFixed(1)}/day
                          </span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-center">
                      <div className="space-y-1">
                        <p className="text-white">
                          Current: ${product.currentPrice}
                        </p>
                        <p className={`font-medium ${getPricePositionColor(product.pricePosition)}`}>
                          Optimal: ${product.optimalPrice}
                        </p>
                        <p className="text-white/50 text-xs">
                          Elasticity: {product.priceElasticity.toFixed(1)}
                        </p>
                      </div>
                    </td>
                    
                    <td className="p-4 text-center">
                      {product.projectedImpact.revenueIncrease > 0 ? (
                        <div className="space-y-1">
                          <p className="text-green-400 font-medium">
                            +${(product.projectedImpact.revenueIncrease / 1000).toFixed(1)}k
                          </p>
                          <p className="text-white/50 text-xs">potential revenue</p>
                        </div>
                      ) : (
                        <p className="text-white/40">Optimized</p>
                      )}
                      
                      {product.urgentActions.length > 0 && (
                        <div className="mt-2">
                          <AlertTriangle className="w-4 h-4 text-orange-400 mx-auto" />
                        </div>
                      )}
                    </td>
                    
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedProduct(product)}
                        className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg text-white text-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Detail Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-bold text-white mb-4">{selectedProduct.title}</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/60 text-sm mb-1">Performance Score</p>
                    <p className="text-2xl font-bold text-white">{selectedProduct.performanceScore}/100</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-white/60 text-sm mb-1">Category</p>
                    <p className="text-2xl font-bold text-white">{selectedProduct.category}</p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-4">
                  <h4 className="text-white font-semibold mb-3">Recommendations</h4>
                  <ul className="space-y-2">
                    {selectedProduct.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Zap className="w-4 h-4 text-purple-400 mt-0.5" />
                        <span className="text-white/80 text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedProduct.urgentActions.length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                    <h4 className="text-red-400 font-semibold mb-2">Urgent Actions Required</h4>
                    {selectedProduct.urgentActions.map((action, i) => (
                      <p key={i} className="text-white/80 text-sm">{action}</p>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedProduct(null)}
                className="mt-6 w-full px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPerformanceMatrix;
