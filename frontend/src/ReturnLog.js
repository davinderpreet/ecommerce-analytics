import React, { useState, useEffect } from 'react';
import {
  Package, Search, Plus, Check, X, DollarSign,
  ChevronDown, AlertCircle, Save, Eye
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

const ReturnLog = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  
  // Form state
  const [orderNumber, setOrderNumber] = useState('');
  const [orderData, setOrderData] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [shippingCost, setShippingCost] = useState('');
  const [returnLabelCost, setReturnLabelCost] = useState('');
  const [notes, setNotes] = useState('');
  const [searchError, setSearchError] = useState('');

  // Fetch returns list
  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/returns`);
      const data = await response.json();
      
      if (data.success) {
        setReturns(data.returns);
      }
    } catch (error) {
      console.error('Failed to fetch returns:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  // Search for order by number
  const searchOrder = async () => {
    if (!orderNumber.trim()) {
      setSearchError('Please enter an order number');
      return;
    }

    setSearchError('');
    setLoading(true);
    
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/returns/order/${encodeURIComponent(orderNumber)}`
      );
      const data = await response.json();
      
      if (data.success && data.order) {
        setOrderData(data.order);
        // Initialize selected products with all order items
        setSelectedProducts(
          data.order.items.map(item => ({
            ...item,
            selected: true,
            quantityReturned: item.quantity,
            productCondition: '100',
            conditionNotes: '',
            reasonCategory: 'not_specified'
          }))
        );
      } else {
        setSearchError('Order not found');
        setOrderData(null);
        setSelectedProducts([]);
      }
    } catch (error) {
      console.error('Order search error:', error);
      setSearchError('Failed to search order');
    } finally {
      setLoading(false);
    }
  };

  // Toggle product selection
  const toggleProduct = (index) => {
    const updated = [...selectedProducts];
    updated[index].selected = !updated[index].selected;
    setSelectedProducts(updated);
  };

  // Update product condition
  const updateProductCondition = (index, field, value) => {
    const updated = [...selectedProducts];
    updated[index][field] = value;
    setSelectedProducts(updated);
  };

  // Create return
  const createReturn = async () => {
    const selectedItems = selectedProducts
      .filter(p => p.selected)
      .map(p => ({
        orderItemId: p.id,
        productId: p.productId,
        sku: p.sku,
        productTitle: p.title,
        quantityReturned: p.quantityReturned,
        unitPriceCents: p.priceCents,
        productCondition: p.productCondition,
        conditionNotes: p.conditionNotes,
        reasonCategory: p.reasonCategory,
        reasonDetail: p.conditionNotes
      }));

    if (selectedItems.length === 0) {
      alert('Please select at least one product to return');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/v1/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: orderData.id,
          selectedItems,
          shippingCostCents: Math.round(parseFloat(shippingCost || 0) * 100),
          returnLabelCostCents: Math.round(parseFloat(returnLabelCost || 0) * 100),
          customerEmail: orderData.customerEmail,
          notes,
          createdBy: 'admin'
        })
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`Return ${data.return.returnNumber} created successfully!`);
        resetForm();
        fetchReturns();
        setShowNewReturn(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Create return error:', error);
      alert('Failed to create return');
    }
  };

  // Reset form
  const resetForm = () => {
    setOrderNumber('');
    setOrderData(null);
    setSelectedProducts([]);
    setShippingCost('');
    setReturnLabelCost('');
    setNotes('');
    setSearchError('');
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const colors = {
      pending: 'bg-yellow-500/20 text-yellow-400',
      approved: 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400'
    };

    return (
      <span className={`px-2 py-1 rounded-lg text-xs ${colors[status] || colors.pending}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">Return Management</h1>
        <p className="text-white/60">Log and track product returns</p>
      </div>

      {/* Action Bar */}
      <div className="mb-6 flex justify-between items-center">
        <button
          onClick={() => setShowNewReturn(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl text-white font-medium flex items-center gap-2 hover:from-purple-600 hover:to-pink-700 transition-all"
        >
          <Plus className="w-5 h-5" />
          Log New Return
        </button>
        
        <button
          onClick={fetchReturns}
          className="px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition-all"
        >
          Refresh
        </button>
      </div>

      {/* New Return Form Modal */}
      {showNewReturn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Log New Return</h2>
              <button
                onClick={() => setShowNewReturn(false)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Step 1: Order Search */}
            <div className="mb-8">
              <label className="block text-white/70 text-sm mb-2">
                Step 1: Enter Order Number
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchOrder()}
                  placeholder="Enter order number..."
                  className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                />
                <button
                  onClick={searchOrder}
                  disabled={loading}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white flex items-center gap-2 disabled:opacity-50"
                >
                  <Search className="w-5 h-5" />
                  Search
                </button>
              </div>
              {searchError && (
                <p className="mt-2 text-red-400 text-sm flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {searchError}
                </p>
              )}
            </div>

            {/* Order Details & Product Selection */}
            {orderData && (
              <>
                {/* Order Info */}
                <div className="mb-6 p-4 bg-white/5 rounded-xl border border-white/10">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-white/60 text-sm">Order #</p>
                      <p className="text-white font-medium">{orderData.number}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Customer</p>
                      <p className="text-white font-medium">{orderData.customerEmail}</p>
                    </div>
                    <div>
                      <p className="text-white/60 text-sm">Total</p>
                      <p className="text-white font-medium">
                        ${(orderData.totalCents / 100).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p
