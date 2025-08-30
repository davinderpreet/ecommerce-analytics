// frontend/src/Returns.js - ENHANCED VERSION WITH COST TRACKING
import React, { useState, useEffect } from 'react';
import {
  Package, AlertTriangle, TrendingUp, RotateCcw,
  Search, Filter, Plus, Check, X, Clock,
  DollarSign, Truck, AlertCircle, BarChart2,
  FileText, Download, ChevronRight, Calendar,
  TrendingDown, Target, Zap, Eye, ChevronDown,
  RefreshCw
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8080';

const Returns = () => {
  const [returns, setReturns] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [costAnalysis, setCostAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [showCostDetails, setShowCostDetails] = useState(false);
  const [activeView, setActiveView] = useState('returns'); // 'returns', 'analytics', 'pricing'
  const [filters, setFilters] = useState({
    status: 'all',
    reasonCategory: 'all',
    dateRange: '30d'
  });

  // Fetch returns data with cost information
  const fetchReturns = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/returns?${new URLSearchParams(filters)}`);
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

  // Fetch cost analytics
  const fetchCostAnalysis = async () => {
    try {
      const days = parseInt(filters.dateRange);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `${API_BASE}/api/v1/returns/cost-analysis?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();
      
      if (data.success) {
        setCostAnalysis(data);
      }
    } catch (error) {
      console.error('Failed to fetch cost analysis:', error);
    }
  };

  // Fetch metrics
  const fetchMetrics = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/returns/metrics`);
      const data = await response.json();
      
      if (data.success) {
        setMetrics(data);
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
    }
  };

  useEffect(() => {
    fetchReturns();
    fetchMetrics();
    fetchCostAnalysis();
  }, [filters]);

  // Enhanced New Return Form with Cost Awareness
// Replace the NewReturnForm component in Returns.js with this complete version:

// Enhanced New Return Form with Cost Awareness
const NewReturnForm = () => {
  const [formData, setFormData] = useState({
    orderId: '',
    items: [],
    customerEmail: '',
    notes: '',
    searchOrderNumber: ''
  });
  
  const [orderData, setOrderData] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [shippingCost, setShippingCost] = useState('');
  const [returnLabelCost, setReturnLabelCost] = useState('');
  const [searchError, setSearchError] = useState('');
  const [loading, setLoading] = useState(false);

  // Search for order
  const searchOrder = async () => {
    if (!formData.searchOrderNumber.trim()) {
      setSearchError('Please enter an order number');
      return;
    }

    setSearchError('');
    setLoading(true);
    
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/returns/order/${encodeURIComponent(formData.searchOrderNumber)}`
      );
      const data = await response.json();
      
      if (data.success && data.order) {
        setOrderData(data.order);
        setFormData({
          ...formData, 
          orderId: data.order.id, 
          customerEmail: data.order.customerEmail
        });
        
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
      console.error('Order search failed:', error);
      setSearchError('Failed to find order');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const selectedItems = selectedProducts
      .filter(p => p.selected)
      .map(p => ({
        orderItemId: p.id,
        productId: p.productId || p.product?.id,
        sku: p.sku,
        productTitle: p.title,
        quantityReturned: parseInt(p.quantityReturned) || 1,
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.id,
          selectedItems,
          shippingCostCents: Math.round(parseFloat(shippingCost || 0) * 100),
          returnLabelCostCents: Math.round(parseFloat(returnLabelCost || 0) * 100),
          customerEmail: orderData.customerEmail,
          notes: formData.notes,
          createdBy: 'user'
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`Return ${data.return.returnNumber} created successfully!`);
        setShowNewReturn(false);
        fetchReturns();
        // Reset form
        setFormData({
          orderId: '',
          items: [],
          customerEmail: '',
          notes: '',
          searchOrderNumber: ''
        });
        setOrderData(null);
        setSelectedProducts([]);
        setShippingCost('');
        setReturnLabelCost('');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Failed to create return:', error);
      alert('Failed to create return');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
      <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Create New Return</h2>
          <button
            onClick={() => setShowNewReturn(false)}
            className="text-white/60 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Search */}
          <div>
            <label className="block text-white/70 text-sm mb-2">Order Number</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.searchOrderNumber}
                onChange={(e) => setFormData({...formData, searchOrderNumber: e.target.value})}
                className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                placeholder="Enter order number..."
              />
              <button
                type="button"
                onClick={searchOrder}
                disabled={loading}
                className="px-6 py-3 bg-purple-500 hover:bg-purple-600 rounded-xl text-white disabled:opacity-50"
              >
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

          {/* Order Details */}
          {orderData && (
            <>
              {/* Order Info Box */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
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
                    <p className="text-white/60 text-sm">Date</p>
                    <p className="text-white font-medium">
                      {new Date(orderData.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-white/70 text-sm mb-4">
                  Select Products to Return
                </label>
                <div className="space-y-3">
                  {selectedProducts.map((item, index) => (
                    <div 
                      key={item.id} 
                      className={`p-4 bg-white/5 rounded-xl border transition-all ${
                        item.selected ? 'border-purple-500' : 'border-white/10'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={() => toggleProduct(index)}
                          className="mt-1 w-5 h-5 rounded"
                        />
                        
                        <div className="flex-1">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-white font-medium">{item.title}</p>
                              <p className="text-white/60 text-sm">SKU: {item.sku || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-white">
                                ${(item.priceCents / 100).toFixed(2)} × {item.quantity}
                              </p>
                              <p className="text-white/60 text-sm">
                                Total: ${(item.totalCents / 100).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {item.selected && (
                            <div className="space-y-3 mt-3 pt-3 border-t border-white/10">
                              {/* Row 1: Quantity and Condition */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-white/60 text-xs mb-1">
                                    Quantity to Return
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={item.quantity}
                                    value={item.quantityReturned}
                                    onChange={(e) => updateProductCondition(index, 'quantityReturned', parseInt(e.target.value) || 1)}
                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                  />
                                </div>
                                
                                <div>
                                  <label className="block text-white/60 text-xs mb-1">
                                    Product Condition
                                  </label>
                                  <select
                                    value={item.productCondition}
                                    onChange={(e) => updateProductCondition(index, 'productCondition', e.target.value)}
                                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                  >
                                    <option value="100">New - 100%</option>
                                    <option value="80">Like New - 80%</option>
                                    <option value="50">Used - 50%</option>
                                    <option value="20">Damaged - 20%</option>
                                  </select>
                                </div>
                              </div>

                              {/* Row 2: Return Reason */}
                              <div>
                                <label className="block text-white/60 text-xs mb-1">
                                  Return Reason
                                </label>
                                <select
                                  value={item.reasonCategory}
                                  onChange={(e) => updateProductCondition(index, 'reasonCategory', e.target.value)}
                                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm"
                                >
                                  <option value="not_specified">Select a reason...</option>
                                  <option value="damaged">Damaged/Defective</option>
                                  <option value="not_as_described">Not as Described</option>
                                  <option value="wrong_item">Wrong Item Sent</option>
                                  <option value="quality_issue">Quality Issue</option>
                                  <option value="changed_mind">Changed Mind</option>
                                  <option value="no_longer_needed">No Longer Needed</option>
                                  <option value="arrived_too_late">Arrived Too Late</option>
                                </select>
                              </div>
                              
                              {/* Row 3: Condition Notes */}
                              <div>
                                <label className="block text-white/60 text-xs mb-1">
                                  Additional Details (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={item.conditionNotes}
                                  onChange={(e) => updateProductCondition(index, 'conditionNotes', e.target.value)}
                                  placeholder="Describe the issue or reason for return..."
                                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-white/40"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Costs */}
              <div>
                <label className="block text-white/70 text-sm mb-4">
                  Shipping Costs
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/60 text-xs mb-1">
                      Original Shipping Cost ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="number"
                        step="0.01"
                        value={shippingCost}
                        onChange={(e) => setShippingCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-white/60 text-xs mb-1">
                      Return Label Cost ($)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="number"
                        step="0.01"
                        value={returnLabelCost}
                        onChange={(e) => setReturnLabelCost(e.target.value)}
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-white/60 text-sm mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                  placeholder="Any additional information about this return..."
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewReturn(false)}
                  className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedProducts.filter(p => p.selected).length === 0}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium disabled:opacity-50 transition-all"
                >
                  Create Return
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

  // Return Detail Modal with Cost Breakdown
  const ReturnDetailModal = ({ returnData }) => {
    const [costBreakdown, setCostBreakdown] = useState(null);

    useEffect(() => {
      // Fetch cost breakdown for this return
      if (returnData?.id) {
        // Cost data would be included with return
        setCostBreakdown({
          originalShipping: (returnData.order?.shippingCostCents || 0) / 100,
          returnLabel: (returnData.returnLabelCostCents || 0) / 100,
          processing: (returnData.processingCostCents || 0) / 100,
          productLoss: (returnData.productValueLossCents || 0) / 100,
          totalLoss: (returnData.totalActualLossCents || 0) / 100,
          restockingFee: (returnData.restockingFeeCents || 0) / 100
        });
      }
    }, [returnData]);

    if (!returnData) return null;

    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
        <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Return #{returnData.returnNumber}</h2>
              <p className="text-white/60">Created {new Date(returnData.createdAt).toLocaleDateString()}</p>
            </div>
            <button
              onClick={() => setSelectedReturn(null)}
              className="text-white/60 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Return Information */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3">Return Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Status</span>
                    <StatusBadge status={returnData.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Order #</span>
                    <span className="text-white">{returnData.order?.number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Customer</span>
                    <span className="text-white">{returnData.customerEmail}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Return Value</span>
                    <span className="text-white font-medium">
                      ${(returnData.totalReturnValueCents / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3">Items</h3>
                <div className="space-y-2">
                  {returnData.items?.map((item, idx) => (
                    <div key={idx} className="p-2 bg-white/5 rounded-lg">
                      <p className="text-white text-sm font-medium">{item.productTitle}</p>
                      <p className="text-white/60 text-xs">SKU: {item.sku}</p>
                      <div className="flex justify-between mt-1">
                        <span className="text-white/60 text-xs">
                          Qty: {item.quantityReturned} • ${(item.unitPriceCents / 100).toFixed(2)} each
                        </span>
                        <span className="text-orange-400 text-xs">
                          {item.reasonCategory?.replace('_', ' ')}
                        </span>
                      </div>
                      {item.inspectedCondition && (
                        <div className="mt-1">
                          <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                            Condition: {item.inspectedCondition}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cost Analysis */}
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-red-400" />
                  Cost Breakdown
                </h3>
                {costBreakdown ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Original Shipping</span>
                        <span className="text-red-400">-${costBreakdown.originalShipping.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Return Label</span>
                        <span className="text-red-400">-${costBreakdown.returnLabel.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Processing Cost</span>
                        <span className="text-red-400">-${costBreakdown.processing.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/10">
                        <span className="text-white/60">Product Value Loss</span>
                        <span className="text-red-400">-${costBreakdown.productLoss.toFixed(2)}</span>
                      </div>
                      {costBreakdown.restockingFee > 0 && (
                        <div className="flex justify-between py-2 border-b border-white/10">
                          <span className="text-white/60">Restocking Fee</span>
                          <span className="text-green-400">+${costBreakdown.restockingFee.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between py-2 font-bold">
                        <span className="text-white">Total Loss</span>
                        <span className="text-red-500 text-xl">-${costBreakdown.totalLoss.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    {returnData.keepItRefund && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          ⚠️ Keep-It refund was recommended for this return
                        </p>
                      </div>
                    )}

                    {returnData.supplierChargebackCents > 0 && (
                      <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <p className="text-green-400 text-sm">
                          ✓ Supplier chargeback: ${(returnData.supplierChargebackCents / 100).toFixed(2)}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-white/60 text-sm">Cost analysis pending...</p>
                )}
              </div>

              {/* Actions */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-medium mb-3">Actions</h3>
                <div className="space-y-2">
                  {returnData.status === 'pending' && (
                    <>
                      <button className="w-full px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg">
                        Approve Return
                      </button>
                      <button className="w-full px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg">
                        Reject Return
                      </button>
                    </>
                  )}
                  {returnData.status === 'approved' && (
                    <button className="w-full px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                      Mark as Received
                    </button>
                  )}
                  <button className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">
                    Print Label
                  </button>
                  <button className="w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg">
                    Email Customer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Status badge component
  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      received: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      rejected: 'bg-red-500/20 text-red-400 border-red-500/30'
    };

    return (
      <span className={`px-2 py-1 rounded-lg text-xs border ${statusConfig[status] || statusConfig.pending}`}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      {/* Header with Navigation */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
          Returns Management
        </h1>
        <p className="text-white/60 mt-2">Track returns, analyze costs, and optimize pricing</p>
        
        {/* View Toggle */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setActiveView('returns')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'returns' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Returns List
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'analytics' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Cost Analytics
          </button>
          <button
            onClick={() => setActiveView('pricing')}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeView === 'pricing' 
                ? 'bg-purple-500 text-white' 
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            Price Optimization
          </button>
        </div>
      </div>

      {/* Enhanced Metrics with Cost Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Returns</p>
              <p className="text-3xl font-bold text-white mt-1">{returns.length}</p>
              <p className="text-white/40 text-xs mt-1">Last {filters.dateRange}</p>
            </div>
            <Package className="w-10 h-10 text-purple-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Total Loss</p>
              <p className="text-3xl font-bold text-red-400 mt-1">
                ${costAnalysis?.summary?.totalReturnCost?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Actual cost impact</p>
            </div>
            <TrendingDown className="w-10 h-10 text-red-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Avg Cost/Return</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">
                ${costAnalysis?.summary?.avgReturnCost?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Per return loss</p>
            </div>
            <DollarSign className="w-10 h-10 text-orange-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Keep-It Saves</p>
              <p className="text-3xl font-bold text-green-400 mt-1">
                ${costAnalysis?.summary?.potentialKeepItSavings?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Potential savings</p>
            </div>
            <Zap className="w-10 h-10 text-green-400" />
          </div>
        </div>

        <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm">Chargebacks</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">
                ${costAnalysis?.summary?.supplierChargebackPotential?.toFixed(0) || '0'}
              </p>
              <p className="text-white/40 text-xs mt-1">Recoverable</p>
            </div>
            <RefreshCw className="w-10 h-10 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Main Content Based on Active View */}
      {activeView === 'returns' && (
        <>
          {/* Action Bar */}
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setShowNewReturn(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-2xl text-white font-semibold flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              New Return
            </button>

            <div className="flex gap-2">
              <select
                value={filters.status}
                onChange={(e) => setFilters({...filters, status: e.target.value})}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={filters.reasonCategory}
                onChange={(e) => setFilters({...filters, reasonCategory: e.target.value})}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="all">All Reasons</option>
                <option value="defective">Defective</option>
                <option value="not_as_described">Not as Described</option>
                <option value="changed_mind">Changed Mind</option>
                <option value="damaged_in_shipping">Damaged</option>
              </select>

              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
                className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white"
              >
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>
          </div>

          {/* Returns Table with Cost Column */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-white/5 border-b border-white/10">
                  <tr>
                    <th className="text-left p-4 text-white/80">RMA #</th>
                    <th className="text-left p-4 text-white/80">Order</th>
                    <th className="text-left p-4 text-white/80">Customer</th>
                    <th className="text-center p-4 text-white/80">Status</th>
                    <th className="text-center p-4 text-white/80">Items</th>
                    <th className="text-center p-4 text-white/80">Return Value</th>
                    <th className="text-center p-4 text-white/80">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Loss
                      </div>
                    </th>
                    <th className="text-left p-4 text-white/80">Reason</th>
                    <th className="text-center p-4 text-white/80">Date</th>
                    <th className="text-right p-4 text-white/80">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="10" className="text-center py-12 text-white/60">
                        Loading returns...
                      </td>
                    </tr>
                  ) : returns.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="text-center py-12 text-white/60">
                        No returns found
                      </td>
                    </tr>
                  ) : (
                    returns.map(returnItem => (
                      <tr key={returnItem.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="p-4">
                          <p className="text-white font-medium">{returnItem.returnNumber}</p>
                          {returnItem.keepItRefund && (
                            <span className="text-xs text-yellow-400">Keep-it eligible</span>
                          )}
                        </td>
                        <td className="p-4">
                          <p className="text-white">{returnItem.order?.number}</p>
                          <p className="text-white/50 text-sm">{returnItem.order?.channel?.name}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-white/80 text-sm">{returnItem.customerEmail}</p>
                        </td>
                        <td className="p-4 text-center">
                          <StatusBadge status={returnItem.status} />
                        </td>
                        <td className="p-4 text-center">
                          <p className="text-white">{returnItem.items?.length || 0}</p>
                        </td>
                        <td className="p-4 text-center">
                          <p className="text-white font-medium">
                            ${(returnItem.totalReturnValueCents / 100).toFixed(2)}
                          </p>
                        </td>
                        <td className="p-4 text-center">
                          <p className={`font-medium ${
                            returnItem.totalActualLossCents > 5000 ? 'text-red-500' : 'text-orange-400'
                          }`}>
                            ${((returnItem.totalActualLossCents || 0) / 100).toFixed(2)}
                          </p>
                        </td>
                        <td className="p-4">
                          <p className="text-white/80 text-sm">
                            {returnItem.items?.[0]?.reasonCategory?.replace('_', ' ')}
                          </p>
                        </td>
                        <td className="p-4 text-center">
                          <p className="text-white/60 text-sm">
                            {new Date(returnItem.createdAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => setSelectedReturn(returnItem)}
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
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

      {activeView === 'analytics' && (
        <div className="space-y-6">
          {/* Cost Summary Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">Cost Breakdown</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-white/60">Shipping Costs</span>
                  <span className="text-red-400 font-medium">
                    ${costAnalysis?.costBreakdown?.shipping?.toFixed(2) || '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Processing Costs</span>
                  <span className="text-orange-400 font-medium">
                    ${costAnalysis?.costBreakdown?.processing?.toFixed(2) || '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Product Loss</span>
                  <span className="text-yellow-400 font-medium">
                    ${costAnalysis?.costBreakdown?.productLoss?.toFixed(2) || '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Other Costs</span>
                  <span className="text-purple-400 font-medium">
                    ${costAnalysis?.costBreakdown?.other?.toFixed(2) || '0'}
                  </span>
                </div>
                <div className="pt-3 border-t border-white/20">
                  <div className="flex justify-between">
                    <span className="text-white font-bold">Total Loss</span>
                    <span className="text-red-500 font-bold text-lg">
                      ${costAnalysis?.summary?.totalReturnCost?.toFixed(2) || '0'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">Recovery Opportunities</h3>
              <div className="space-y-4">
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 font-medium">Keep-It Refunds</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    ${costAnalysis?.summary?.potentialKeepItSavings?.toFixed(2) || '0'}
                  </p>
                  <p className="text-white/60 text-sm mt-1">
                    {costAnalysis?.summary?.keepItOpportunities || 0} opportunities
                  </p>
                </div>
                <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-400 font-medium">Supplier Chargebacks</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    ${costAnalysis?.summary?.supplierChargebackPotential?.toFixed(2) || '0'}
                  </p>
                  <p className="text-white/60 text-sm mt-1">For defective items</p>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">Return Metrics</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-white/60 text-sm">Total Returns</p>
                  <p className="text-3xl font-bold text-white">
                    {costAnalysis?.summary?.totalReturns || 0}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Avg Cost per Return</p>
                  <p className="text-2xl font-bold text-orange-400">
                    ${costAnalysis?.summary?.avgReturnCost?.toFixed(2) || '0'}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Period</p>
                  <p className="text-white">{filters.dateRange}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Top Costly Products */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Top Loss-Making Products</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="text-left p-3 text-white/60">Product</th>
                    <th className="text-center p-3 text-white/60">Total Loss</th>
                    <th className="text-center p-3 text-white/60">Avg Loss/Return</th>
                    <th className="text-center p-3 text-white/60">Main Reason</th>
                    <th className="text-center p-3 text-white/60">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {costAnalysis?.topCostlyProducts?.map((product, idx) => (
                    <tr key={idx} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3">
                        <p className="text-white font-medium">{product.sku}</p>
                        <p className="text-white/60 text-sm">{product.title}</p>
                      </td>
                      <td className="text-center p-3">
                        <span className="text-red-400 font-medium">${product.totalCost?.toFixed(2)}</span>
                      </td>
                      <td className="text-center p-3">
                        <span className="text-orange-400">${product.avgCostPerReturn?.toFixed(2)}</span>
                      </td>
                      <td className="text-center p-3">
                        <span className="text-white/60 text-sm">{product.mainReason}</span>
                      </td>
                      <td className="text-center p-3">
                        <button 
                          onClick={() => {
                            setActiveView('pricing');
                            setSelectedProduct(product);
                          }}
                          className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm"
                        >
                          Optimize Price
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Target className="w-6 h-6 text-green-400" />
                Immediate Actions
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white font-medium">1. Implement Keep-It Policy</p>
                  <p className="text-white/60 text-sm mt-1">
                    For items under $20 or when return costs exceed 50% of value
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white font-medium">2. Add Restocking Fees</p>
                  <p className="text-white/60 text-sm mt-1">
                    15% for electronics, 20% for furniture to offset costs
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white font-medium">3. Supplier Accountability</p>
                  <p className="text-white/60 text-sm mt-1">
                    Charge back defects exceeding 2% threshold
                  </p>
                </div>
              </div>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-blue-400" />
                Long-term Strategy
              </h3>
              <div className="space-y-3">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white font-medium">Improve Product Descriptions</p>
                  <p className="text-white/60 text-sm mt-1">
                    Reduce "not as described" returns by 30%
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white font-medium">Quality Control</p>
                  <p className="text-white/60 text-sm mt-1">
                    Pre-ship inspection for high-return products
                  </p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white font-medium">Dynamic Pricing</p>
                  <p className="text-white/60 text-sm mt-1">
                    Build return costs into product pricing
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === 'pricing' && (
        <div className="space-y-6">
          {/* Price Optimization Header */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
            <h2 className="text-2xl font-bold text-white mb-2">Price Optimization Recommendations</h2>
            <p className="text-white/60">
              Adjust pricing to account for return costs and maintain target margins
            </p>
          </div>

          {/* Pricing Scenarios */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">Scenario 1: Price Increase</h3>
              <div className="space-y-3">
                <p className="text-white/60 text-sm">Build return costs into pricing</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Average Increase</span>
                    <span className="text-green-400 font-medium">+8-12%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Margin Protection</span>
                    <span className="text-white">100%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Customer Impact</span>
                    <span className="text-orange-400">Medium</span>
                  </div>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg">
                  Apply to All Products
                </button>
              </div>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">Scenario 2: Restocking Fees</h3>
              <div className="space-y-3">
                <p className="text-white/60 text-sm">Charge fees for non-defective returns</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Fee Range</span>
                    <span className="text-blue-400 font-medium">15-20%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Cost Recovery</span>
                    <span className="text-white">60-70%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Customer Impact</span>
                    <span className="text-yellow-400">Low</span>
                  </div>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg">
                  Configure Fees
                </button>
              </div>
            </div>

            <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
              <h3 className="text-lg font-bold text-white mb-4">Scenario 3: Hybrid Approach</h3>
              <div className="space-y-3">
                <p className="text-white/60 text-sm">Combine pricing and policy changes</p>
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Price Increase</span>
                    <span className="text-purple-400 font-medium">+5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Restocking Fee</span>
                    <span className="text-purple-400">10%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Keep-It Threshold</span>
                    <span className="text-purple-400">$25</span>
                  </div>
                </div>
                <button className="w-full mt-4 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg">
                  Recommended
                </button>
              </div>
            </div>
          </div>

          {/* Product-Specific Recommendations */}
          <div className="backdrop-blur-xl bg-white/10 rounded-3xl p-6 border border-white/20">
            <h3 className="text-xl font-bold text-white mb-4">Product-Specific Price Adjustments</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10">
                  <tr>
                    <th className="text-left p-3 text-white/60">Product</th>
                    <th className="text-center p-3 text-white/60">Current Price</th>
                    <th className="text-center p-3 text-white/60">Return Cost/Unit</th>
                    <th className="text-center p-3 text-white/60">Recommended Price</th>
                    <th className="text-center p-3 text-white/60">Increase</th>
                    <th className="text-center p-3 text-white/60">New Margin</th>
                    <th className="text-center p-3 text-white/60">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3 text-white">Example Product</td>
                    <td className="text-center p-3 text-white">$50.00</td>
                    <td className="text-center p-3 text-red-400">$3.75</td>
                    <td className="text-center p-3 text-green-400">$54.50</td>
                    <td className="text-center p-3 text-yellow-400">+$4.50</td>
                    <td className="text-center p-3 text-white">40%</td>
                    <td className="text-center p-3">
                      <button className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg text-sm">
                        Apply
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
              <p className="text-blue-400 font-medium mb-2">💡 Pro Tip</p>
              <p className="text-white/70 text-sm">
                Start with high-return-rate products first. A 5-10% price increase on your top 20% 
                most-returned products can recover 60-70% of your total return costs while minimizing 
                customer impact.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showNewReturn && <NewReturnForm />}
      {selectedReturn && <ReturnDetailModal returnData={selectedReturn} />}
    </div>
  );
};

export default Returns;
