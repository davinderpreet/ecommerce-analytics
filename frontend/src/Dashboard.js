// Copy the entire Dashboard component code from our artifact here
// I'll provide a simplified version to start with:

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, ShoppingCart, DollarSign, Package, Users, ArrowUp, ArrowDown, Calendar, Download, RefreshCw, Brain, Target } from 'lucide-react';

const Dashboard = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sample data for testing
  const salesData = [
    { date: '2024-08-17', bestbuy: 12450, shopify: 8230, total: 20680 },
    { date: '2024-08-18', bestbuy: 15670, shopify: 9450, total: 25120 },
    { date: '2024-08-19', bestbuy: 18290, shopify: 11200, total: 29490 },
    { date: '2024-08-20', bestbuy: 14890, shopify: 10800, total: 25690 },
    { date: '2024-08-21', bestbuy: 21340, shopify: 13450, total: 34790 },
    { date: '2024-08-22', bestbuy: 19780, shopify: 12900, total: 32680 },
    { date: '2024-08-23', bestbuy: 23450, shopify: 15670, total: 39120 },
    { date: '2024-08-24', bestbuy: 26890, shopify: 17230, total: 44120 }
  ];

  const metrics = [
    { 
      title: 'Total Revenue (7d)', 
      value: '$231,870', 
      change: '+12.5%', 
      trend: 'up', 
      icon: DollarSign,
      color: 'from-emerald-400 to-teal-600'
    },
    { 
      title: 'Total Orders', 
      value: '3,407', 
      change: '+8.2%', 
      trend: 'up', 
      icon: ShoppingCart,
      color: 'from-blue-400 to-indigo-600'
    },
    { 
      title: 'Products Sold', 
      value: '7,842', 
      change: '+15.7%', 
      trend: 'up', 
      icon: Package,
      color: 'from-purple-400 to-pink-600'
    }
  ];

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
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
            <button 
              onClick={handleRefresh}
              className={`bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 p-3 rounded-xl transition-all duration-300 ${isRefreshing ? 'animate-spin' : ''}`}
            >
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Platform Selector */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex space-x-4">
            {[
              { id: 'all', name: 'All Platforms', color: 'from-white to-purple-200' },
              { id: 'bestbuy', name: 'BestBuy', color: 'from-blue-400 to-blue-600' },
              { id: 'shopify', name: 'Shopify', color: 'from-green-400 to-green-600' }
            ].map(platform => (
              <button
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                  selectedPlatform === platform.id 
                    ? `bg-gradient-to-r ${platform.color} text-white shadow-lg scale-105` 
                    : 'bg-white/10 text-white/80 hover:bg-white/20 hover:scale-105'
                }`}
              >
                {platform.name}
              </button>
            ))}
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl hover:bg-white/15 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl bg-gradient-to-r ${metric.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-green-400">
                    <ArrowUp className="w-4 h-4" />
                    <span>{metric.change}</span>
                  </div>
                </div>
                <h3 className="text-white/70 text-sm font-medium">{metric.title}</h3>
                <p className="text-3xl font-bold text-white mt-1">{metric.value}</p>
              </div>
            );
          })}
        </div>

        {/* Chart */}
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl mb-8">
          <h3 className="text-2xl font-bold text-white mb-6">Sales Performance Trend</h3>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="date" stroke="rgba(255,255,255,0.7)" />
              <YAxis stroke="rgba(255,255,255,0.7)" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                  border: '1px solid rgba(255,255,255,0.2)', 
                  borderRadius: '16px'
                }} 
              />
              <Area type="monotone" dataKey="total" stroke="#8B5CF6" fill="url(#totalGradient)" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status */}
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 backdrop-blur-xl bg-white/10 rounded-full px-4 py-2 border border-white/20">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-white/70 text-sm">Dashboard loaded successfully</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
