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
                      <p className="text-white/60 text-sm">Date</p>
                      <p className="text-white font-medium">
                        {new Date(orderData.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 2: Select Products */}
                <div className="mb-6">
                  <label className="block text-white/70 text-sm mb-4">
                    Step 2: Select Products to Return
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
                                <p className="text-white/60 text-sm">SKU: {item.sku}</p>
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

                {/* Step 3 & 4: Shipping Costs */}
                <div className="mb-6">
                  <label className="block text-white/70 text-sm mb-4">
                    Step 3 & 4: Shipping Costs
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
                <div className="mb-6">
                  <label className="block text-white/60 text-sm mb-2">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Any additional information about this return..."
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowNewReturn(false)}
                    className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createReturn}
                    disabled={selectedProducts.filter(p => p.selected).length === 0}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                  >
                    <Save className="w-5 h-5" />
                    Create Return
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Returns List */}
      <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-6 py-4 text-left text-white/70 font-medium">Return #</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Order #</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Customer</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Products</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Value</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Costs</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Status</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Date</th>
              <th className="px-6 py-4 text-left text-white/70 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((ret) => (
              <tr key={ret.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="px-6 py-4 text-white font-medium">
                  {ret.returnNumber}
                </td>
                <td className="px-6 py-4 text-white/80">
                  {ret.order?.number || '-'}
                </td>
                <td className="px-6 py-4 text-white/80">
                  {ret.customerEmail}
                </td>
                <td className="px-6 py-4 text-white/80">
                  {ret.items?.length || 0} items
                </td>
                <td className="px-6 py-4 text-white/80">
                  ${((ret.totalReturnValueCents || 0) / 100).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-white/80">
                  <div className="text-sm">
                    <div>Ship: ${((ret.returnShippingCostCents || 0) / 100).toFixed(2)}</div>
                    <div>Label: ${((ret.returnlabelcostcents || 0) / 100).toFixed(2)}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={ret.status} />
                </td>
                <td className="px-6 py-4 text-white/80">
                  {new Date(ret.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedReturn(ret)}
                    className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white/60 hover:text-white transition-all"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {returns.length === 0 && (
          <div className="px-6 py-12 text-center text-white/60">
            No returns found. Click "Log New Return" to create one.
          </div>
        )}
      </div>

      {/* Return Details Modal */}
      {selectedReturn && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 rounded-3xl p-8 max-w-3xl w-full max-h-[80vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">
                Return {selectedReturn.returnNumber}
              </h2>
              <button
                onClick={() => setSelectedReturn(null)}
                className="text-white/60 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Return Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-white/60 text-sm">Status</p>
                  <StatusBadge status={selectedReturn.status} />
                </div>
                <div>
                  <p className="text-white/60 text-sm">Created</p>
                  <p className="text-white">
                    {new Date(selectedReturn.createdAt).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Order</p>
                  <p className="text-white">{selectedReturn.order?.number}</p>
                </div>
                <div>
                  <p className="text-white/60 text-sm">Customer</p>
                  <p className="text-white">{selectedReturn.customerEmail}</p>
                </div>
              </div>

              {/* Products */}
              <div>
                <h3 className="text-white font-medium mb-3">Returned Products</h3>
                <div className="space-y-2">
                  {selectedReturn.items?.map((item) => (
                    <div key={item.id} className="p-3 bg-white/5 rounded-lg border border-white/10">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white font-medium">{item.productTitle}</p>
                          <p className="text-white/60 text-sm">
                            SKU: {item.sku} | Qty: {item.quantityReturned}
                          </p>
                          <p className="text-white/60 text-sm">
                            Condition: {item.productCondition}% 
                            {item.conditionNotes && ` - ${item.conditionNotes}`}
                          </p>
                          <p className="text-white/60 text-sm">
                            Reason: {item.reasonCategory?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        <p className="text-white">
                          ${((item.totalValueCents || 0) / 100).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Summary */}
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <h3 className="text-white font-medium mb-3">Cost Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-white/60">Return Value</span>
                    <span className="text-white">
                      ${((selectedReturn.totalReturnValueCents || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Shipping Cost</span>
                    <span className="text-white">
                      ${((selectedReturn.returnShippingCostCents || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/60">Return Label Cost</span>
                    <span className="text-white">
                      ${((selectedReturn.returnlabelcostcents || 0) / 100).toFixed(2)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex justify-between font-medium">
                    <span className="text-white">Total Cost</span>
                    <span className="text-red-400">
                      ${(
                        ((selectedReturn.returnShippingCostCents || 0) + 
                         (selectedReturn.returnlabelcostcents || 0)) / 100
                      ).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {selectedReturn.notes && (
                <div>
                  <h3 className="text-white font-medium mb-2">Notes</h3>
                  <p className="text-white/80 p-3 bg-white/5 rounded-lg">
                    {selectedReturn.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReturnLog;
