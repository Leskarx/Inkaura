import { useState, useEffect } from "react";
import {
  Package, CheckCircle, RefreshCw, FileText,
  Save, X, Calendar, User, DollarSign, Send, AlertCircle
} from "lucide-react";
import { supabase, api } from "../server/api";

interface DispatchOrder {
  id: string;
  client: string;
  address: string;
  items: string;
  contact: string;
  phone: string;
  scheduledTime: string;
  quotationId?: string;
  value?: number;
  product?: string;
  quantity?: number;
}

interface DeliveredOrder {
  id: string;
  client: string;
  dispatchDate: string;
  status: string;
  location: string;
  invoiceId?: string;
}

interface DashboardData {
  readyForDispatch: DispatchOrder[];
  delivered: DeliveredOrder[];
  kpis: {
    readyCount: number;
    deliveredCount: number;
  };
}

interface InvoiceFormData {
  customerId: string;
  productionJobId: string;
  customerName: string;
  product: string;
  quantity: number;
  amount: number;
  issueDate: string;
  dueDate: string;
  notes: string;
}

export function DispatchDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DispatchOrder | null>(null);
  const [creatingInvoice, setCreatingInvoice] = useState(false);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>({
    customerId: "",
    productionJobId: "",
    customerName: "",
    product: "",
    quantity: 0,
    amount: 0,
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: "",
  });
  const [invoices, setInvoices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const productionJobs = await api.getProductionJobs();
      const readyJobs = productionJobs.filter(job => job.status === "Packaged");
      const dispatchedJobs = productionJobs.filter(job => job.status === "Dispatched");

      const customersData = await api.getCustomers();
      setCustomers(customersData.map(c => ({ id: c.id, name: c.name })));

      const dispatchOrders: DispatchOrder[] = readyJobs.map(job => ({
        id: job.id,
        client: job.customer,
        address: "",
        items: `${job.product} (${job.quantity.toLocaleString()} pcs)`,
        contact: "",
        phone: "",
        scheduledTime: new Date(job.dueDate).toLocaleDateString(),
        quotationId: job.quotationId,
        value: job.value || 0,
        product: job.product,
        quantity: job.quantity,
      }));

      // Fetch REAL invoice IDs for dispatched jobs from DB
      let invoiceMap: Record<string, string> = {};
      if (dispatchedJobs.length > 0) {
        const dispatchedIds = dispatchedJobs.map(j => j.id);
        const { data: invoicesData } = await supabase
          .from('invoices')
          .select('invoice_id, production_order_id')
          .in('production_order_id', dispatchedIds);

        if (invoicesData) {
          invoicesData.forEach((inv: any) => {
            invoiceMap[inv.production_order_id] = inv.invoice_id;
          });
        }
      }

      const deliveredOrders: DeliveredOrder[] = dispatchedJobs.map(job => ({
        id: job.id,
        client: job.customer,
        dispatchDate: new Date(job.dueDate).toLocaleDateString(),
        status: "Delivered",
        location: "Mumbai, Maharashtra",
        invoiceId: invoiceMap[job.id] || undefined, // REAL invoice ID from DB
      }));

      setData({
        readyForDispatch: dispatchOrders,
        delivered: deliveredOrders,
        kpis: {
          readyCount: dispatchOrders.length,
          deliveredCount: deliveredOrders.length,
        },
      });
    } catch (err) {
      console.error("Error fetching dashboard:", err);
      setError("Failed to load dispatch data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleDispatchClick = (order: DispatchOrder) => {
    setSelectedOrder(order);
    setError(null);

    const customer = customers.find(c => c.name === order.client);
    const autoAmount = order.value || 0;

    setInvoiceForm({
      customerId: customer?.id || "",
      productionJobId: order.id,
      customerName: order.client,
      product: order.product || order.items,
      quantity: order.quantity || 0,
      amount: autoAmount,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      notes: `Dispatch for order ${order.id} - ${order.product}`,
    });

    setShowInvoiceModal(true);
  };

  const handleInvoiceAndDispatch = async () => {
    if (!invoiceForm.customerId) {
      setError("Please select a customer");
      return;
    }
    if (invoiceForm.amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    if (!selectedOrder) {
      setError("No order selected");
      return;
    }

    try {
      setCreatingInvoice(true);
      setError(null);

      const invoiceNumber = await api.getNextInvoiceNumber();
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .insert([{
          invoice_id: invoiceNumber,
          quotation_id: selectedOrder.quotationId || `QT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`,
          production_order_id: selectedOrder.id,
          invoice_number: invoiceNumber,
          invoice_date: invoiceForm.issueDate,
          due_date: invoiceForm.dueDate,
          subtotal: invoiceForm.amount,
          tax_percent: 0,
          tax_amount: 0,
          discount_amount: 0,
          total_amount: invoiceForm.amount,
          currency: 'INR',
          customer_id: invoiceForm.customerId,
          billing_address: null,
          shipping_address: null,
          gst_number: null,
          status: 'Pending',
          payment_status: 'Pending',
          payment_due_days: 30,
          payment_reminder_sent: false,
          last_reminder_date: null,
          notes: invoiceForm.notes,
          created_by: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          amount: invoiceForm.amount,
          issue_date: invoiceForm.issueDate,
          dispatch_date: null,
        }])
        .select()
        .single();

      if (invoiceError) {
        console.error("Invoice creation error:", invoiceError);
        throw new Error(invoiceError.message);
      }

      const emp = await api.getCurrentEmployee();
      const empId = emp?.employee_id || 1;

      await api.dispatchProductionOrder(selectedOrder.id, empId);

      await supabase
        .from('invoices')
        .update({
          status: 'Paid',
          payment_status: 'Paid',
          dispatch_date: new Date().toISOString(),
        })
        .eq('invoice_id', invoiceNumber);

      setInvoices(prev => [...prev, { ...invoiceData, status: 'Paid' }]);

      await fetchDashboardData();

      alert(`✅ Order ${selectedOrder.id} dispatched successfully!\n✅ Invoice ${invoiceNumber} created and marked as Paid.`);

      setShowInvoiceModal(false);
      setSelectedOrder(null);

    } catch (err) {
      console.error("Error processing dispatch:", err);
      setError(err instanceof Error ? err.message : 'Failed to process dispatch');
    } finally {
      setCreatingInvoice(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading dispatch data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full gap-4">
        <AlertCircle size={48} className="text-slate-400" />
        <p className="text-slate-500">No dispatch data available</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Invoice Modal */}
      {showInvoiceModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                Create Invoice & Dispatch
              </h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 flex-1">{error}</p>
                  <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Order Summary */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-2">Order Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-slate-500">Order ID</span>
                    <p className="font-semibold text-slate-900">{selectedOrder.id}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Product</span>
                    <p className="font-semibold text-slate-900">{selectedOrder.items}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500">Delivery Address</span>
                    <p className="font-semibold text-slate-900">{selectedOrder.address}</p>
                  </div>
                  {selectedOrder.value && selectedOrder.value > 0 && (
                    <div className="col-span-2 bg-green-50 rounded-lg p-2 border border-green-200">
                      <span className="text-xs text-slate-500">Order Value</span>
                      <p className="font-semibold text-green-700">₹{selectedOrder.value.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={invoiceForm.customerId}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setInvoiceForm({
                      ...invoiceForm,
                      customerId: e.target.value,
                      customerName: customer?.name || ""
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Amount - Auto-filled */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={invoiceForm.amount || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: parseFloat(e.target.value) || 0 })}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${invoiceForm.amount > 0 ? 'border-green-300 bg-green-50' : 'border-slate-200'
                      }`}
                  />
                  {invoiceForm.amount > 0 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">
                        ✓ Auto-filled
                      </span>
                    </div>
                  )}
                </div>
                {invoiceForm.amount > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ Amount auto-filled from order value: ₹{invoiceForm.amount.toLocaleString()}
                  </p>
                )}
                {invoiceForm.amount === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ No amount set for this order. Please enter manually or check the order.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Issue Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.issueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  placeholder="Add any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                />
              </div>

              {/* Dispatch Summary */}
              <div className={`rounded-xl p-4 border ${invoiceForm.amount > 0
                ? 'bg-indigo-50 border-indigo-200'
                : 'bg-amber-50 border-amber-200'
                }`}>
                <div className="flex items-start gap-3">
                  <DollarSign size={18} className={`flex-shrink-0 mt-0.5 ${invoiceForm.amount > 0 ? 'text-indigo-600' : 'text-amber-600'
                    }`} />
                  <div>
                    <p className={`text-xs font-semibold ${invoiceForm.amount > 0 ? 'text-indigo-800' : 'text-amber-800'
                      }`}>Dispatch Summary</p>
                    {invoiceForm.amount > 0 ? (
                      <>
                        <p className="text-xs text-indigo-600 mt-0.5">
                          Invoice will be created for <strong>₹{invoiceForm.amount.toLocaleString()}</strong>
                          and the order will be marked as <strong>Dispatched</strong>.
                        </p>
                        <p className="text-xs text-indigo-600">
                          Job: {selectedOrder.id} · Customer: {invoiceForm.customerName || selectedOrder.client}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-amber-600 mt-0.5">
                        ⚠️ Please enter an amount before dispatching.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvoiceAndDispatch}
                disabled={creatingInvoice || invoiceForm.amount <= 0}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creatingInvoice ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send size={16} /> Create Invoice & Dispatch
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Dispatch Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage ready orders and deliveries</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchDashboardData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        {[
          { label: "Ready for Dispatch", value: data.kpis.readyCount, icon: <Package size={16} />, color: "text-amber-600 bg-amber-50" },
          { label: "Total Delivered", value: data.kpis.deliveredCount, icon: <CheckCircle size={16} />, color: "text-green-600 bg-green-50" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{s.value}</p>
            <p className="text-slate-600 text-xs" style={{ fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Ready for Dispatch */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Ready for Dispatch</h3>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full" style={{ fontWeight: 600 }}>{data.readyForDispatch.length} orders</span>
          </div>
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {data.readyForDispatch.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No orders waiting for dispatch.</div>
            ) : (
              data.readyForDispatch.map((order) => (
                <div key={order.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{order.id}</p>
                      <p className="text-slate-800 text-xs mt-0.5" style={{ fontWeight: 700 }}>{order.client}</p>
                      <p className="text-slate-500 text-xs">{order.items}</p>
                      {order.value && order.value > 0 && (
                        <p className="text-xs text-green-600 font-medium mt-0.5">
                          Amount: ₹{order.value.toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">Due: {order.scheduledTime}</span>
                  </div>

                  <button
                    onClick={() => handleDispatchClick(order)}
                    disabled={processingId === order.id}
                    className="w-full flex items-center justify-center gap-2 text-xs text-white rounded-lg py-2 transition-colors hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: "#4f46e5", fontWeight: 500 }}
                  >
                    {processingId === order.id ? (
                      <>
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <><FileText size={12} /> Create Invoice & Dispatch</>
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delivered */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-slate-900 text-sm" style={{ fontWeight: 600 }}>Delivered Orders</h3>
          </div>
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {data.delivered.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">No delivered orders found.</div>
            ) : (
              data.delivered.map((delivery) => (
                <div key={delivery.id} className="p-5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{delivery.id}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200" style={{ fontWeight: 500 }}>
                          Delivered
                        </span>
                        {delivery.invoiceId && (
                          <span className="text-xs px-1.5 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200" style={{ fontWeight: 500 }}>
                            {delivery.invoiceId}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-800 text-xs" style={{ fontWeight: 600 }}>{delivery.client}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-slate-400">Date</p>
                      <p className="text-xs text-slate-700" style={{ fontWeight: 600 }}>
                        {delivery.dispatchDate}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-green-600 mt-3 pt-3 border-t border-slate-100">
                    <CheckCircle size={14} />
                    <span style={{ fontWeight: 500 }}>Successfully delivered</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}