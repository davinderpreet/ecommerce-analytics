import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Users, Package, RefreshCw, Calendar, Filter } from 'lucide-react';

// API Base URL from environment
const API_BASE = (process.env.REACT_APP_API_BASE || "").replace(/\/$/, "");

// API helper function
async function http(method, path) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Request failed: ${res.status}`);
  }
  return res.json();
}

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [selectedRange, setSelectedRange] = useState('7d');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Debug function to test specific date ranges
  const testDebugEndpoint = async (dateType) => {
    try {
      console.log(`🔍 Testing debug endpoint for ${dateType}`);
      const platformParam = selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : '';
      const data = await http('GET', `/api/v1/debug/orders?dateType=${dateType}${platformParam}`);
      
      console.log(`🔍 Debug results for ${dateType}:`, data);
      
      // Show debug results in an alert for easy viewing
      const summary = data.summary;
      const breakdown = data.dailyBreakdown;
      
      let message = `Debug Results for ${dateType.toUpperCase()}:\n\n`;
      message += `Total: $${summary.totalRevenue} (${summary.totalOrders} orders)\n`;
      message += `Average: $${summary.averageOrderValue}\n`;
      message += `Timezone: ${data.timezone}\n`;
      message += `Current Time: ${data.currentTime}\n\n`;
      
      message += `Daily Breakdown:\n`;
      breakdown.forEach(day => {
        message += `${day.date}: $${day.revenue} (${day.orderCount} orders)\n`;
        day.orders.forEach(order => {
          message += `  - ${order.number}: $${order.total}\n`;
        });
      });
      
      alert(message);
      
    } catch (error) {
      console.error(`🔍 Debug test failed for ${dateType}:`, error);
      alert(`Debug test failed: ${error.message}`);
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await http('GET', `/api/v1/analytics/dashboard-summary?range=${selectedRange}&platform=${selectedPlatform}`);
      
      setDashboardData(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Sync Shopify data
  const handleSync = async () => {
    try {
      setLoading(true);
      await http('POST', '/api/v1/sync/shopify?days=30');
      await fetchDashboardData();
    } catch (err) {
      setError(`Sync failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Load data on component mount and when filters change
  useEffect(() => {
    fetchDashboardData();
  }, [selectedRange, selectedPlatform]);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  // Format percentage
  const formatPercentage = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-white/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 max-w-md">
            <p className="text-red-400 mb-4">Error loading dashboard</p>
            <p className="text-white/70 text-sm mb-4">{error}</p>
            <button 
              onClick={fetchDashboardData}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded text-white"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const metrics = dashboardData || {};
  const salesTrend = metrics.salesTrend || [];
  const platformComparison = metrics.platformComparison || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">E-commerce Analytics</h1>
              <p className="text-white/60">Multi-Platform Dashboard</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Platform Filter */}
              <select 
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="all">All Platforms</option>
                <option value="shopify">Shopify</option>
                <option value="bestbuy">BestBuy</option>
              </select>

              {/* Date Range Filter */}
              <select 
                value={selectedRange}
                onChange={(e) => setSelectedRange(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>

              {/* Debug Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => testDebugEndpoint('today')}
                  className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs"
                  title="Debug Today"
                >
                  Debug Today
                </button>
                <button
                  onClick={() => testDebugEndpoint('yesterday')}
                  className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs"
                  title="Debug Yesterday"
                >
                  Debug Yesterday
                </button>
                <button
                  onClick={() => testDebugEndpoint('7d')}
                  className="bg-blue-500 hover:bg-blue-600 px-3 py-2 rounded text-white text-xs"
                  title="Debug 7 Days"
                >
                  Debug 7d
                </button>
              </div>

              {/* Sync Button */}
              <button
                onClick={handleSync}
                disabled={loading}
                className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 px-4 py-2 rounded-lg text-white flex items-center space-x-2"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync</span>
              </button>
            </div>
          </div>
          
          {lastUpdated && (
            <p className="text-white/40 text-xs mt-2">Last updated: {lastUpdated}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(metrics.totalRevenue)}</p>
                {metrics.revenueGrowth !== null && (
                  <p className={`text-sm flex items-center ${metrics.revenueGrowth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {metrics.revenueGrowth >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    {formatPercentage(metrics.revenueGrowth)}
                  </p>
                )}
              </div>
              <DollarSign className="w-8 h-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Total Orders</p>
                <p className="text-2xl font-bold text-white">{metrics.totalOrders?.toLocaleString() || '0'}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Avg Order Value</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(metrics.avgOrderValue)}</p>
              </div>
              <Package className="w-8 h-8 text-purple-400" />
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-sm">Platforms</p>
                <p className="text-2xl font-bold text-white">{platformComparison.length}</p>
              </div>
              <Users className="w-8 h-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Sales Trend Chart */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-6">Sales Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  formatter={(value, name) => [formatCurrency(value), name]}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Platform Comparison */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-6">Platform Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.6)" />
                <YAxis stroke="rgba(255,255,255,0.6)" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(0,0,0,0.8)', 
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    color: 'white'
                  }}
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(value) : value.toLocaleString(),
                    name
                  ]}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
