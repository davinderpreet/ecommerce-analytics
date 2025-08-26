import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, 
  Package, Users, RefreshCw, Calendar, Filter, AlertCircle
} from 'lucide-react';
import { api } from './lib/api';

// MetricCard Component
const MetricCard = ({ title, value, icon: Icon, change, color = 'purple' }) => {
  const isPositive = change > 0;
  const colorClasses = {
    purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
    blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
    green: 'from-green-500/20 to-green-600/20 border-green-500/30',
    pink: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-lg rounded-2xl p-6 border hover:scale-105 transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {change !== undefined && change !== null && (
            <div className={`flex items-center mt-2 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
              {isPositive ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-gradient-to-br from-${color}-500/30 to-${color}-600/30`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

// Main Dashboard Component
function Dashboard() {
  // State Management
  const [dashboardData, setDashboardData] = useState(null);
  const [salesTrendData, setSalesTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  // Format currency
  const formatCurrency = (value) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value?.toFixed(2) || '0'}`;
  };

  // Format number
  const formatNumber = (value) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value?.toString() || '0';
  };

  // Fetch Dashboard Data
  const fetchDashboardData = useCallback(async () => {
    try {
      console.log('Fetching dashboard data...');
      setError(null);
      
      // Fetch dashboard summary with selected time range
      const summary = await api.dashboardSummary(timeRange);
      console.log('Dashboard summary:', summary);
      
      // Calculate dates for sales trend
      const endDate = new Date();
      const startDate = new Date();
      const days = parseInt(timeRange.replace('d', ''));
      startDate.setDate(endDate.getDate() - days + 1);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      // Fetch sales trend data
      const trendResponse = await api.salesTrend(startDateStr, endDateStr);
      console.log('Sales trend:', trendResponse);
      
      // Process and set dashboard data
      setDashboardData({
        totalRevenue: summary.totalRevenue || 0,
        revenueGrowth: summary.revenueGrowth || 0,
        totalOrders: summary.totalOrders || 0,
        avgOrderValue: summary.avgOrderValue || 0,
        platformComparison: summary.platformComparison || [],
        topProducts: [] // We'll add this later when you have product data
      });
      
      // Process sales trend data
      const trendData = trendResponse.data || trendResponse.salesTrend || [];
      setSalesTrendData(trendData.map(item => ({
        date: item.date,
        revenue: item.revenue || 0,
        orders: item.orders || 0,
        aov: item.aov || 0
      })));
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange]);

  // Initial data load
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  // Handle sync Shopify data
  const handleSyncShopify = async () => {
    try {
      setRefreshing(true);
      const days = parseInt(timeRange.replace('d', ''));
      await api.syncShopify(days);
      await fetchDashboardData();
    } catch (err) {
      console.error('Error syncing Shopify:', err);
      setError('Failed to sync Shopify data');
    }
  };

  // Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white/70">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error State
  if (error && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <p className="text-white mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Chart colors
  const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">E-commerce Analytics</h1>
            <p className="text-gray-400">Real-time multi-platform insights</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-white/10 backdrop-blur-lg text-white px-4 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-purple-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            
            {/* Platform Filter */}
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="bg-white/10 backdrop-blur-lg text-white px-4 py-2 rounded-lg border border-white/20 focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Platforms</option>
              <option value="shopify">Shopify</option>
              <option value="bestbuy">BestBuy</option>
            </select>
            
            {/* Sync Button */}
            <button
              onClick={handleSyncShopify}
              disabled={refreshing}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
            >
              <Package className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync Shopify</span>
            </button>
            
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-300 px-4 py-3 rounded-lg mb-6 flex items-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value={formatCurrency(dashboardData?.totalRevenue || 0)}
            icon={DollarSign}
            change={dashboardData?.revenueGrowth}
            color="purple"
          />
          <MetricCard
            title="Total Orders"
            value={formatNumber(dashboardData?.totalOrders || 0)}
            icon={ShoppingCart}
            color="blue"
          />
          <MetricCard
            title="Average Order Value"
            value={formatCurrency(dashboardData?.avgOrderValue || 0)}
            icon={TrendingUp}
            color="green"
          />
          <MetricCard
            title="Active Products"
            value={formatNumber(dashboardData?.totalProducts || 0)}
            icon={Package}
            color="pink"
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Sales Trend Chart */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4">Sales Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesTrendData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: 'white' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8b5cf6" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Platform Comparison */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold text-white mb-4">Platform Comparison</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dashboardData?.platformComparison || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                  labelStyle={{ color: 'white' }}
                />
                <Bar dataKey="revenue" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                <Bar dataKey="orders" fill="#3b82f6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by Day Chart */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
          <h3 className="text-xl font-semibold text-white mb-4">Orders by Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: 'none', borderRadius: '8px' }}
                labelStyle={{ color: 'white' }}
              />
              <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              <Line type="monotone" dataKey="aov" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// IMPORTANT: Export the Dashboard component as default
export default Dashboard;
