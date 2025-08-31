import React, { useState, useEffect } from 'react';
import SupplierManagement from './components/SupplierManagement';
import { 
  Package, AlertTriangle, TrendingDown, ShoppingCart,
  RefreshCw, Download, Upload, Search, Filter, 
  Plus, Edit2, Bell, Clock, Truck, ChevronRight,
  BarChart2, AlertCircle, CheckCircle, XCircle,
  ArrowUp, ArrowDown, Settings, Calendar, Info,
  Save, X, Edit, Boxes, Timer,
  // New imports for tabs
  Users, FileText, TrendingUp, DollarSign, Building2,
  Phone, Mail, Globe, CreditCard, MapPin, BarChart3
} from 'lucide-react';

// Configuration
const API_BASE = (process.env.REACT_APP_API_BASE || "http://localhost:8080").replace(/\/$/, "");

// Product Edit Modal Component
const ProductEditModal = ({ show, onClose, product, onSave }) => {
  const [formData, setFormData] = useState({
    leadTimeDays: 30,
    moq: 100,
    batchSize: 50,
    safetyStockDays: 14,
    supplierName: '',
    supplierCountry: 'China',
    shippingMethod: 'Sea'
  });

  useEffect(() => {
    if (product) {
      setFormData({
        leadTimeDays: product.leadTimeDays || 30,
        moq: product.moq || 100,
        batchSize: product.batchSize || 50,
        safetyStockDays: product.safetyStockDays || 14,
        supplierName: product.supplierName || '',
        supplierCountry: product.supplierCountry || 'China',
        shippingMethod: product.shippingMethod || 'Sea'
      });
    }
  }, [product]);

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory/${product.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        onSave(formData);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save product settings:', error);
    }
  };

  if (!show || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold text-white">Edit Product Settings</h3>
            <p className="text-white/60 mt-1">{product.title} - SKU: {product.sku}</p>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Lead Time & Ordering */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Clock className="w-5 h-5 mr-2" />
              Lead Time & Ordering
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Lead Time (days)</label>
                <input
                  type="number"
                  value={formData.leadTimeDays}
                  onChange={(e) => setFormData({...formData, leadTimeDays: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Safety Stock Days</label>
                <input
                  type="number"
                  value={formData.safetyStockDays}
                  onChange={(e) => setFormData({...formData, safetyStockDays: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          </div>

          {/* Batch & MOQ Settings */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Boxes className="w-5 h-5 mr-2" />
              Batch & Quantity Settings
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Batch Size</label>
                <input
                  type="number"
                  value={formData.batchSize}
                  onChange={(e) => setFormData({...formData, batchSize: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
                <p className="text-white/40 text-xs mt-1">Units per batch for ordering</p>
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Min Order Quantity (MOQ)</label>
                <input
                  type="number"
                  value={formData.moq}
                  onChange={(e) => setFormData({...formData, moq: parseInt(e.target.value) || 0})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
                <p className="text-white/40 text-xs mt-1">Minimum units per order</p>
              </div>
            </div>
          </div>

          {/* Supplier Information */}
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
              <Truck className="w-5 h-5 mr-2" />
              Supplier Information
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Supplier Name</label>
                <input
                  type="text"
                  value={formData.supplierName}
                  onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  placeholder="Enter supplier name"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-white/70 text-sm block mb-2">Country</label>
                  <select
                    value={formData.supplierCountry}
                    onChange={(e) => setFormData({...formData, supplierCountry: e.target.value})}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="China">China</option>
                    <option value="USA">USA</option>
                    <option value="India">India</option>
                    <option value="Vietnam">Vietnam</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-white/70 text-sm block mb-2">Shipping Method</label>
                  <select
                    value={formData.shippingMethod}
                    onChange={(e) => setFormData({...formData, shippingMethod: e.target.value})}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  >
                    <option value="Sea">Sea Freight</option>
                    <option value="Air">Air Freight</option>
                    <option value="Express">Express</option>
                    <option value="Rail">Rail</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Calculated Info */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
            <p className="text-blue-400 text-sm font-medium mb-2">Reorder Calculations</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/60">Reorder Point:</p>
                <p className="text-white font-medium">
                  {Math.ceil((product.salesVelocity || 0) * (formData.leadTimeDays + formData.safetyStockDays))} units
                </p>
              </div>
              <div>
                <p className="text-white/60">Optimal Order Qty:</p>
                <p className="text-white font-medium">
                  {Math.max(formData.moq, Math.ceil((product.salesVelocity || 0) * 60 / formData.batchSize) * formData.batchSize)} units
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium flex items-center justify-center space-x-2"
          >
            <Save className="w-5 h-5" />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Settings Modal Component
const SettingsModal = ({ show, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-2xl font-bold text-white">Global Settings</h3>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-white/5 rounded-xl p-6 border border-white/10">
            <h4 className="text-lg font-semibold text-white mb-4">Default Values</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-white/70 text-sm block mb-2">Default Lead Time</label>
                <input
                  type="number"
                  value={localSettings.defaultLeadTime}
                  onChange={(e) => setLocalSettings({...localSettings, defaultLeadTime: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-white/70 text-sm block mb-2">Default Batch Size</label>
                <input
                  type="number"
                  value={localSettings.defaultBatchSize}
                  onChange={(e) => setLocalSettings({...localSettings, defaultBatchSize: parseInt(e.target.value)})}
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-white font-medium"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// Reorder Modal Component
const ReorderModal = ({ show, onClose, product, onConfirm }) => {
  const [quantity, setQuantity] = useState(100);
  const [expectedDate, setExpectedDate] = useState('');

  useEffect(() => {
    if (product) {
      setQuantity(product.reorderQuantity || 100);
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + (product.leadTime || 7));
      setExpectedDate(futureDate.toISOString().split('T')[0]);
    }
  }, [product]);

  if (!show || !product) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-slate-800/95 backdrop-blur-xl border border-white/20 rounded-3xl p-8 max-w-md w-full mx-4">
        <h3 className="text-2xl font-bold text-white mb-4">Create Purchase Order</h3>
        <div className="space-y-4">
          <div>
            <p className="text-white/70 text-sm mb-2">Product</p>
            <p className="text-white font-medium">{product.title}</p>
            <p className="text-white/50 text-sm">SKU: {product.sku}</p>
          </div>
          
          <div>
            <label className="text-white/70 text-sm block mb-2">Order Quantity</label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
            />
            <p className="text-white/40 text-xs mt-1">
              Batch Size: {product.batchSize || 50} | MOQ: {product.moq || 100}
            </p>
          </div>
          
          <div>
            <label className="text-white/70 text-sm block mb-2">Expected Delivery</label>
            <input
              type="date"
              value={expectedDate}
              onChange={(e) => setExpectedDate(e.target.value)}
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
            />
          </div>
          
          <div className="flex space-x-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-white font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm({ productId: product.id, quantity, expectedDate })}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl text-white font-medium"
            >
              Create Order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Inventory Component
const Inventory = () => {
  const [inventory, setInventory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('stockout_risk');
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProductEditModal, setShowProductEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [activeTab, setActiveTab] = useState('inventory'); // New state for tabs
  
  const [settings, setSettings] = useState({
    defaultLeadTime: 7,
    defaultBatchSize: 50,
    showAlerts: true,
    showMetrics: true
  });

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory${selectedPlatform !== 'all' ? `?platform=${selectedPlatform}` : ''}`);
      const data = await response.json();
      
      if (data.success) {
        setInventory(data.items || []);
        setStats(data.stats || {});
        setAlerts(data.alerts || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      setMockData();
    } finally {
      setLoading(false);
    }
  };

  const setMockData = () => {
    setInventory([
      {
        id: '1',
        sku: 'IPH15PRO',
        title: 'iPhone 15 Pro',
        channel: 'Shopify',
        quantity: 12,
        available: 10,
        reserved: 2,
        incoming: 50,
        reorderPoint: 20,
        reorderQuantity: 100,
        leadTime: 7,
        leadTimeDays: 7,
        batchSize: 50,
        moq: 100,
        safetyStockDays: 3,
        stockoutRisk: 'high',
        daysUntilStockout: 3,
        salesVelocity: 4.2,
        unitCost: 899.99,
        totalValue: 10799.88,
        shouldReorderNow: true
      }
    ]);
    
    setStats({
      totalProducts: 1,
      totalValue: 10799.88,
      lowStockItems: 1,
      criticalItems: 0
    });
    
    setAlerts([{
      id: '1',
      type: 'high',
      product: 'iPhone 15 Pro',
      message: 'Low stock: 3 days until stockout'
    }]);
  };

  const updateInventory = async (productId, newQuantity) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory/${productId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: Number(newQuantity) })
      });
      
      if (response.ok) {
        setEditingItem(null);
        await fetchInventory();
      }
    } catch (error) {
      console.error('Failed to update inventory:', error);
    }
  };

  const saveProductSettings = (productData) => {
    // Update local state
    setInventory(prev => prev.map(item => 
      item.id === selectedProduct.id 
        ? { ...item, ...productData }
        : item
    ));
    fetchInventory(); // Refresh from server
  };

  const createPurchaseOrder = async (orderData) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/inventory/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });
      
      if (response.ok) {
        setShowReorderModal(false);
        await fetchInventory();
      }
    } catch (error) {
      console.error('Failed to create purchase order:', error);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedPlatform]);

  const processedInventory = inventory
    .filter(item => {
      const matchesSearch = item.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           item.sku?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterStatus === 'all' || item.stockoutRisk === filterStatus;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      switch (sortBy) {
        case 'stockout_risk':
          return riskOrder[a.stockoutRisk] - riskOrder[b.stockoutRisk];
        case 'quantity':
          return a.quantity - b.quantity;
        case 'days_until_stockout':
          return a.daysUntilStockout - b.daysUntilStockout;
        default:
          return 0;
      }
    });

  const getRiskBadgeColor = (risk) => {
    switch (risk) {
      case 'critical': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
      </div>

      <div className="relative z-10 p-8">
        {/* Header */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20 shadow-2xl">
          <div className="flex justify-between items-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
              Inventory Management
            </h1>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
                title="Global Settings"
              >
                <Settings className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={fetchInventory}
                className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 p-3 rounded-xl"
              >
                <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8 backdrop-blur-xl bg-white/10 rounded-3xl p-2 border border-white/20">
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`flex-1 px-6 py-3 rounded-2xl font-medium transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'inventory'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Package className="w-5 h-5" />
              <span>Inventory</span>
            </button>
            <button
              onClick={() => setActiveTab('suppliers')}
              className={`flex-1 px-6 py-3 rounded-2xl font-medium transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'suppliers'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <Users className="w-5 h-5" />
              <span>Suppliers</span>
            </button>
            <button
              onClick={() => setActiveTab('purchase-orders')}
              className={`flex-1 px-6 py-3 rounded-2xl font-medium transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'purchase-orders'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <FileText className="w-5 h-5" />
              <span>Purchase Orders</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex-1 px-6 py-3 rounded-2xl font-medium transition-all flex items-center justify-center space-x-2 ${
                activeTab === 'analytics'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-lg'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>Analytics</span>
            </button>
          </div>
        </div>

        {/* Conditional Content Based on Active Tab */}
        {activeTab === 'inventory' && (
          <>
            {/* Metrics */}
            {settings.showMetrics && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
                  <p className="text-3xl font-bold text-white">{stats?.totalProducts || 0}</p>
                  <p className="text-white/70 text-sm">Total Products</p>
                </div>
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
                  <p className="text-3xl font-bold text-white">${(stats?.totalValue || 0).toFixed(2)}</p>
                  <p className="text-white/70 text-sm">Total Value</p>
                </div>
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
                  <p className="text-3xl font-bold text-orange-400">{stats?.lowStockItems || 0}</p>
                  <p className="text-white/70 text-sm">Low Stock</p>
                </div>
                <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
                  <p className="text-3xl font-bold text-red-400">{stats?.criticalItems || 0}</p>
                  <p className="text-white/70 text-sm">Critical</p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="mb-6 backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <div className="flex flex-col lg:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                >
                  <option value="all">All Status</option>
                  <option value="critical">Critical</option>
                  <option value="high">High Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="low">Low Risk</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
                >
                  <option value="stockout_risk">Sort by Risk</option>
                  <option value="quantity">Sort by Quantity</option>
                  <option value="days_until_stockout">Days to Stockout</option>
                </select>
              </div>
            </div>

            {/* Inventory Table */}
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5 border-b border-white/10">
                    <tr>
                      <th className="text-left p-4 text-white/80">Product</th>
                      <th className="text-center p-4 text-white/80">Stock</th>
                      <th className="text-center p-4 text-white/80">Status</th>
                      <th className="text-center p-4 text-white/80">Batch/Lead</th>
                      <th className="text-center p-4 text-white/80">Velocity</th>
                      <th className="text-center p-4 text-white/80">Days Left</th>
                      <th className="text-right p-4 text-white/80">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12">
                          <RefreshCw className="w-8 h-8 text-white/40 animate-spin mx-auto" />
                          <p className="text-white/60 mt-4">Loading inventory...</p>
                        </td>
                      </tr>
                    ) : processedInventory.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-12">
                          <Package className="w-8 h-8 text-white/40 mx-auto" />
                          <p className="text-white/60 mt-4">No products found</p>
                        </td>
                      </tr>
                    ) : (
                      processedInventory.map(item => (
                        <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="p-4">
                            <p className="text-white font-medium">{item.title}</p>
                            <p className="text-white/50 text-sm">SKU: {item.sku}</p>
                          </td>
                          <td className="p-4 text-center">
                            {editingItem === item.id ? (
                              <div className="flex items-center justify-center space-x-2">
                                <input
                                  type="number"
                                  value={editQuantity}
                                  onChange={(e) => setEditQuantity(e.target.value)}
                                  className="w-20 px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-center"
                                  autoFocus
                                />
                                <button
                                  onClick={() => updateInventory(item.id, editQuantity)}
                                  className="p-1 bg-green-500/20 rounded"
                                >
                                  <CheckCircle className="w-4 h-4 text-green-400" />
                                </button>
                                <button
                                  onClick={() => setEditingItem(null)}
                                  className="p-1 bg-red-500/20 rounded"
                                >
                                  <XCircle className="w-4 h-4 text-red-400" />
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => {
                                  setEditingItem(item.id);
                                  setEditQuantity(String(item.quantity));
                                }}
                                className="cursor-pointer hover:bg-white/5 rounded p-2"
                              >
                                <p className="text-2xl font-bold text-white">{item.quantity}</p>
                                <p className="text-white/50 text-xs">Click to edit</p>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getRiskBadgeColor(item.stockoutRisk)}`}>
                              {item.stockoutRisk?.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <div className="text-sm">
                              <div className="flex items-center justify-center space-x-1 text-white/70">
                                <Boxes className="w-4 h-4" />
                                <span>{item.batchSize || 50}</span>
                              </div>
                              <div className="flex items-center justify-center space-x-1 text-white/70 mt-1">
                                <Timer className="w-4 h-4" />
                                <span>{item.leadTimeDays || item.leadTime || 7}d</span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <span className="text-white">{item.salesVelocity?.toFixed(1) || 0}</span>
                            <span className="text-white/50 text-sm"> /day</span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-bold text-lg ${
                              item.daysUntilStockout <= 3 ? 'text-red-400' :
                              item.daysUntilStockout <= 7 ? 'text-orange-400' :
                              'text-green-400'
                            }`}>
                              {item.daysUntilStockout || 0}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => {
                                  setSelectedProduct(item);
                                  setShowProductEditModal(true);
                                }}
                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors group relative"
                                title="Edit Product Settings"
                              >
                                <Edit2 className="w-4 h-4 text-white/60 group-hover:text-white" />
                                <span className="absolute -top-8 right-0 bg-black/80 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                                  Edit Settings
                                </span>
                              </button>
                              {item.shouldReorderNow && (
                                <button
                                  onClick={() => {
                                    setSelectedProduct(item);
                                    setShowReorderModal(true);
                                  }}
                                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 px-3 py-2 rounded-lg text-white text-sm flex items-center space-x-1"
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                  <span>Reorder</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Suppliers Tab Content */}
    {activeTab === 'suppliers' && (
  <SupplierManagement API_BASE={API_BASE} />
)}


        {/* Purchase Orders Tab Content */}
        {activeTab === 'purchase-orders' && (
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-12 border border-white/20 text-center">
            <FileText className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Purchase Orders</h2>
            <p className="text-white/60">Coming soon - Create and track purchase orders</p>
          </div>
        )}

        {/* Analytics Tab Content */}
        {activeTab === 'analytics' && (
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-12 border border-white/20 text-center">
            <BarChart3 className="w-16 h-16 text-white/40 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Inventory Analytics</h2>
            <p className="text-white/60">Coming soon - Advanced inventory insights and forecasting</p>
          </div>
        )}
      </div>

      {/* Modals */}
      <ProductEditModal
        show={showProductEditModal}
        onClose={() => setShowProductEditModal(false)}
        product={selectedProduct}
        onSave={saveProductSettings}
      />
      
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onSave={(newSettings) => setSettings(newSettings)}
      />
      
      <ReorderModal
        show={showReorderModal}
        onClose={() => setShowReorderModal(false)}
        product={selectedProduct}
        onConfirm={createPurchaseOrder}
      />
    </div>
  );
};

export default Inventory;
