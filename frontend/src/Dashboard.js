// frontend/src/Dashboard.js - REPLACE YOUR ENTIRE FILE WITH THIS
import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, ShoppingCart, DollarSign,
  ArrowUp, ArrowDown, Calendar, Download, RefreshCw,
  Brain, Target, Clock, Activity, ChevronDown, X, Settings
} from 'lucide-react';

/** ====== API base ====== **/
const API_BASE = (process.env.REACT_APP_API_BASE || '').replace(/\/$/, '');
if (!API_BASE) {
  console.warn('REACT_APP_API_BASE is not set. Set it in Vercel → Project → Environment Variables.');
}

async function http(method, path) {
  const res = await fetch(`${API_BASE}${path}`, { method, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(await res.text().catch(() => `Request failed: ${res.status}`));
  return res.json();
}

const Dashboard = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [quickDateFilter, setQuickDateFilter] = useState('7d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [predictionModel, setPredictionModel] = useState('advanced');

  // Live data state
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // FIXED: Date helper functions for proper timezone handling
  const getLocalDateString = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayRange = () => {
    const today = new Date();
    const todayStr = getLocalDateString(today);
    return { start: todayStr, end: todayStr };
  };

  const getYesterdayRange = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);
    return { start: yesterdayStr, end: yesterdayStr };
  };

  /** ====== Loaders ====== **/
  async function loadSummary(range = '7d') {
    setLoading(true); setErr('');
    try {
      // Add platform filtering for summary
      let url = `/api/v1/analytics/dashboard-summary?range=${encodeURIComponent(range)}`;
      if (selectedPlatform !== 'all') {
        url += `&platform=${selectedPlatform}`;
      }
      
      const data = await http('GET', url);
      setSummary(data);
      setTrend(data.salesTrend || []);
      setQuickDateFilter(range);
      setDateRange({ start: '', end: '' });
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomRange(startISO, endISO) {
    setLoading(true); setErr('');
    try {
      // FIXED: Add platform filtering to both API calls
      const platformParam = selectedPlatform !== 'all' ? `&platform=${selectedPlatform}` : '';
      
      // trend for the chart
      const t = await http('GET', `/api/v1/analytics/sales-trend?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}${platformParam}`);
      setTrend(t.data || []);

      // totals for cards
      const m = await http('GET', `/api/v1/analytics/metrics?start_date=${encodeURIComponent(startISO)}&end_date=${encodeURIComponent(endISO)}&platform=${selectedPlatform}`);
      
      // build a "summary-like" object so UI stays consistent
      setSummary({
        success: true,
        range: { start: startISO, end: endISO, days: Math.max(1, (new Date(endISO) - new Date(startISO)) / 86400000 + 1) },
        totalRevenue: m.totalRevenue,
        totalOrders: m.totalOrders,
        avgOrderValue: m.avgOrderValue,
        revenueGrowth: null,
        platformComparison: [],
        salesTrend: t.data || []
      });
      setQuickDateFilter('');
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  /** ====== FIXED UI handlers ====== **/
  const handleQuickDateFilter = async (filter) => {
    setQuickDateFilter(filter);
    
    if (filter === 'today') {
      const range = getTodayRange();
      setDateRange(range);
      await loadCustomRange(range.start, range.end);
    } else if (filter === 'yesterday') {
      const range = getYesterdayRange();
      setDateRange(range);
      await loadCustomRange(range.start, range.end);
    } else if (filter === '7d' || filter === '30d' || filter === '90d') {
      await loadSummary(filter);
    }
  };

  const handleCustomDateChange = async (field, value) => {
    const next = { ...dateRange, [field]: value };
    setDateRange(next);
    setQuickDateFilter('custom');
    if (next.start && next.end) {
      await loadCustomRange(next.start, next.end);
    }
  };

  // FIXED: Platform handler that actually filters data
  const handlePlatformChange = async (platform) => {
    setSelectedPlatform(platform);
    
    // Reload current data with new platform filter
    if (quickDateFilter === 'today') {
      const range = getTodayRange();
      await loadCustomRange(range.start, range.end);
    } else if (quickDateFilter === 'yesterday') {
      const range = getYesterdayRange();
      await loadCustomRange(range.start, range.end);
    } else if (quickDateFilter && quickDateFilter !== 'custom' && quickDateFilter !== '7d') {
      await loadSummary(quickDateFilter);
    } else if (dateRange.start && dateRange.end) {
      await loadCustomRange(dateRange.start, dateRange.end);
    } else {
      // Default case - reload with 7d
      await loadSummary('7d');
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (quickDateFilter === 'today') {
        const range = getTodayRange();
        await loadCustomRange(range.start, range.end);
      } else if (quickDateFilter === 'yesterday') {
        const range = getYesterdayRange();
        await loadCustomRange(range.start, range.end);
      } else if (quickDateFilter && quickDateFilter !== 'custom') {
        await loadSummary(quickDateFilter);
      } else if (dateRange.start && dateRange.end) {
        await loadCustomRange(dateRange.start, dateRange.end);
      } else {
        await loadSummary('7d');
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  /** ====== initial load ====== **/
  useEffect(() => {
    loadSummary('7d');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** ====== Derived UI data ====== **/
  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalOrders  = summary?.totalOrders ?? 0;
  const avgOrderVal  = summary?.avgOrderValue ?? 0;
  const revenueGrowth = summary?.revenueGrowth;

  // pie: platform comparison (when available; empty on custom ranges)
  const platformData = (summary?.platformComparison || []).map(p => ({
    name: p.name,
    sales: p.revenue,
    orders: p.orders,
    color: p.name.toLowerCase().includes('shopify') ? '#96BF47'
         : p.name.toLowerCase().includes('best') ? '#0066CC'
         : '#8B5CF6'
  }));

  // prediction mock (kept from your original UI)
  const generatePredictionData = () => {
    const predictions = [];
    const startDate = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(startDate); date.setDate(date.getDate() + i);
      const predictedTotal = Math.floor((15000 + Math.random() * 4000));
      predictions.push({ date: date.toISOString().slice(0,10), predicted: predictedTotal, confidence: Math.floor(95 - i*0.5) });
    }
    return predictions;
  };
  const predictionData = generatePredictionData();
  const nextMonthPrediction = predictionData.reduce((s, d) => s + d.predicted, 0);

  // Main cards (use only metrics we truly have)
  const mainMetrics = [
    { title: 'Total Revenue', value: `$${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, change: revenueGrowth == null ? '—' : `${revenueGrowth.toFixed(1)}%`, trend: revenueGrowth == null ? 'flat' : (revenueGrowth >= 0 ? 'up' : 'down'), icon: DollarSign, color: 'from-emerald-400 to-teal-600' },
    { title: 'Total Orders',  value: totalOrders.toLocaleString(), change: '—', trend: 'flat', icon: ShoppingCart, color: 'from-blue-400 to-indigo-600' },
    { title: 'Avg Order Value', value: `$${avgOrderVal.toFixed(2)}`, change: '—', trend: 'flat', icon: TrendingUp, color: 'from-orange-400 to-red-500' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Sales Analytics Dashboard
              </h1>
              <p className="text-white/70 mt-2">Real-time insights across all your sales channels</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className={`bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 p-3 rounded-xl transition-all duration-300 ${isRefreshing ? 'animate-spin' : ''}`}
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* IMPROVED Date Controls */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
            {/* Quick Date Filters */}
            <div className="flex flex-wrap gap-3">
              {[
                { id: 'today', name: 'Today' },
                { id: 'yesterday', name: 'Yesterday' },
                { id: '7d', name: 'Last 7 Days' },
                { id: '30d', name: 'Last 30 Days' },
                { id: '90d', name: 'Last 90 Days' }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => handleQuickDateFilter(filter.id)}
                  className={`px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                    quickDateFilter === filter.id
                      ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg scale-105 ring-2 ring-purple-300/50'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:scale-105 border border-white/10'
                  }`}
                >
                  {filter.name}
                </button>
              ))}
            </div>

            {/* IMPROVED Custom Date Range */}
            <div className="relative">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="flex items-center space-x-3 bg-gradient-to-r from-indigo-500/20 to-purple-600/20 backdrop-blur-lg border border-white/30 rounded-xl px-6 py-3 text-white hover:from-indigo-500/30 hover:to-purple-600/30 transition-all duration-300"
              >
                <Calendar className="w-5 h-5 text-indigo-300" />
                <span className="text-sm font-medium">
                  {dateRange.start && dateRange.end 
                    ? `${dateRange.start} to ${dateRange.end}` 
                    : 'Custom Range'
                  }
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showDatePicker ? 'rotate-180' : ''}`} />
              </button>

              {/* Modern Date Picker Dropdown */}
              {showDatePicker && (
                <div className="absolute top-full right-0 mt-2 bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl z-50 min-w-[320px]">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-white font-semibold">Select Date Range</h3>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">Start Date</label>
                      <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => handleCustomDateChange('start', e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-white/70 text-sm font-medium mb-2">End Date</label>
                      <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => handleCustomDateChange('end', e.target.value)}
                        className="w-full bg-slate-700/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all duration-200"
                      />
                    </div>
                    
                    {dateRange.start && dateRange.end && (
                      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                        <p className="text-green-400 text-sm">
                          ✓ Showing data from {dateRange.start} to {dateRange.end}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* IMPROVED Platform Selector */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center">
              <Settings className="w-5 h-5 mr-2" />
              Filter by Platform
            </h3>
            <span className="text-white/60 text-sm">
              {selectedPlatform === 'all' ? 'All Platforms' : selectedPlatform === 'shopify' ? 'Shopify Only' : 'BestBuy Only'}
            </span>
          </div>
          
          <div className="flex space-x-4">
            {[
              { id: 'all', name: 'All Platforms', color: 'from-white to-purple-200', available: true },
              { id: 'shopify', name: 'Shopify', color: 'from-green-400 to-green-600', available: true },
              { id: 'bestbuy', name: 'BestBuy', color: 'from-blue-400 to-blue-600', available: false },
              { id: 'amazon', name: 'Amazon', color: 'from-orange-400 to-yellow-500', available: false }
            ].map(platform => (
              <button
                key={platform.id}
                onClick={() => platform.available && handlePlatformChange(platform.id)}
                disabled={!platform.available}
                className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 relative ${
                  selectedPlatform === platform.id
                    ? `bg-gradient-to-r ${platform.color} text-white shadow-lg scale-105 ring-2 ring-white/30`
                    : platform.available
                      ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:scale-105 border border-white/10'
                      : 'bg-white/5 text-white/40 cursor-not-allowed border border-white/5'
                }`}
              >
                {platform.name}
                {!platform.available && platform.id !== 'all' && platform.id !== 'shopify' && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                    Soon
                  </span>
                )}
              </button>
            ))}
          </div>
          
          {selectedPlatform !== 'all' && (
            <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <p className="text-blue-400 text-sm">
                📊 Showing data filtered by: <strong>{selectedPlatform === 'shopify' ? 'Shopify' : selectedPlatform === 'bestbuy' ? 'BestBuy' : selectedPlatform}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Status / errors */}
        {loading && (
          <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-2xl p-4 border border-white/20">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span className="text-white/80">Loading analytics data...</span>
            </div>
          </div>
        )}
        
        {err && !loading && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 text-red-200 mb-6">
            <div className="flex items-center space-x-2">
              <span className="text-red-400">⚠️</span>
              <span>Error: {err}</span>
            </div>
          </div>
        )}

        {/* Main Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {mainMetrics.map((metric, index) => {
            const Icon = metric.icon;
            const up = metric.trend === 'up';
            const down = metric.trend === 'down';
            return (
              <div key={index} className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-gradient-to-r ${metric.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className={`flex items-center space-x-1 text-sm ${up ? 'text-green-400' : down ? 'text-red-400' : 'text-white/60'}`}>
                    {up ? <ArrowUp className="w-4 h-4" /> : down ? <ArrowDown className="w-4 h-4" /> : null}
                    <span>{metric.change}</span>
                  </div>
                </div>
                <h3 className="text-white/70 text-sm font-medium">{metric.title}</h3>
                <p className="text-3xl font-bold text-white mt-1">{metric.value}</p>
              </div>
            );
          })}
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Sales Trend */}
          <div className="lg:col-span-2 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Sales Performance Trend</h3>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.7)"
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis stroke="rgba(255,255,255,0.7)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)'
                  }}
                  formatter={(value, name) => {
                    if (name === 'revenue') return [`$${Number(value).toFixed(2)}`, 'Revenue'];
                    if (name === 'orders') return [Number(value), 'Orders'];
                    if (name === 'aov') return [`$${Number(value).toFixed(2)}`, 'AOV'];
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="revenue" name="revenue" stroke="#8B5CF6" fill="url(#revenueGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Platform Distribution */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <h3 className="text-2xl font-bold text-white mb-6">Platform Revenue</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  innerRadius={60}
                  paddingAngle={5}
                  dataKey="sales"
                >
                  {platformData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '16px',
                    backdropFilter: 'blur(20px)'
                  }}
                  formatter={(value, name, item) => {
                    const orders = item?.payload?.orders ?? 0;
                    return [`$${Number(value).toFixed(2)} • ${orders} orders`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {!platformData.length && (
              <div className="mt-4 text-sm text-white/70 text-center">
                Platform breakdown available for preset date ranges (7d, 30d, 90d)
              </div>
            )}
          </div>
        </div>

        {/* Top Products Table (placeholder until we expose a /top-products API) */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-white">Top Performing Products</h3>
            <button className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 px-4 py-2 rounded-xl text-white transition-all duration-300">
              <Download className="w-4 h-4 inline mr-2" />
              Export
            </button>
          </div>
          <div className="text-white/70">
            Live product leaderboard coming next. (We'll add an endpoint to aggregate by SKU across orders.)
          </div>
        </div>

        {/* AI Prediction Cards (kept from your original) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Brain className="w-7 h-7 text-cyan-400 mr-3" />
                  AI Sales Prediction
                </h3>
                <p className="text-white/60 mt-1">Next 30-day forecast</p>
              </div>
              <select
                value={predictionModel}
                onChange={(e) => setPredictionModel(e.target.value)}
                className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="basic">Basic ARIMA</option>
                <option value="advanced">Advanced LSTM</option>
                <option value="ensemble">Ensemble Model</option>
                <option value="ml">Machine Learning</option>
              </select>
            </div>

            <div className="space-y-6">
              <div className="text-center p-6 bg-gradient-to-r from-cyan-500/10 to-blue-600/10 rounded-2xl border border-cyan-400/20">
                <div className="text-4xl font-bold text-cyan-400 mb-2">
                  ${nextMonthPrediction.toLocaleString()}
                </div>
                <div className="text-white/80 text-sm">Predicted Revenue (Next 30 Days)</div>
                <div className="text-cyan-400 text-sm mt-1">
                  {summary ? `+${((nextMonthPrediction - totalRevenue) / Math.max(1, totalRevenue) * 100).toFixed(1)}% vs Current Period` : '—'}
                </div>
              </div>

              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={predictionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    stroke="rgba(255,255,255,0.7)"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis stroke="rgba(255,255,255,0.7)" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.9)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(20px)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#22D3EE"
                    strokeWidth={3}
                    strokeDasharray="5 5"
                    dot={{ fill: '#22D3EE', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-white flex items-center">
                  <Target className="w-7 h-7 text-purple-400 mr-3" />
                  Model Performance
                </h3>
                <p className="text-white/60 mt-1">AI accuracy & insights</p>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm font-medium">Active</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <span className="text-white/80">Prediction Accuracy</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-white/20 rounded-full">
                    <div className="w-[89%] h-2 bg-gradient-to-r from-green-400 to-emerald-600 rounded-full"></div>
                  </div>
                  <span className="text-white font-semibold">89%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/80">Model Confidence</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-white/20 rounded-full">
                    <div className="w-[92%] h-2 bg-gradient-to-r from-blue-400 to-cyan-600 rounded-full"></div>
                  </div>
                  <span className="text-white font-semibold">92%</span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-white/80">Data Quality Score</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 h-2 bg-white/20 rounded-full">
                    <div className="w-[95%] h-2 bg-gradient-to-r from-purple-400 to-pink-600 rounded-full"></div>
                  </div>
                  <span className="text-white font-semibold">95%</span>
                </div>
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-purple-500/10 to-pink-600/10 rounded-2xl border border-purple-400/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-purple-400" />
                    <span className="text-white font-medium">Model Status</span>
                  </div>
                  <span className="text-purple-400 text-sm">{predictionModel.toUpperCase()}</span>
                </div>
                <p className="text-white/70 text-sm mb-2">Next training session in 4 hours</p>
                <div className="flex items-center space-x-2 text-xs">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400">Auto-learning enabled</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-white">2.1K</div>
                  <div className="text-white/60 text-xs">Data Points</div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-xl">
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div className="text-white/60 text-xs">Monitoring</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Updates Indicator */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 backdrop-blur-xl bg-white/10 rounded-full px-6 py-3 border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white/70 text-sm">
              {summary ? 'Dashboard connected to live API' : 'Dashboard loaded with sample data'}
            </span>
            <span className="text-white/40 text-sm">•</span>
            <span className="text-white/70 text-sm">Backend: {API_BASE || 'not set'}</span>
            {quickDateFilter && (
              <>
                <span className="text-white/40 text-sm">•</span>
                <span className="text-white/70 text-sm">
                  Filter: {quickDateFilter === 'custom' ? 'Custom Range' : quickDateFilter}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
