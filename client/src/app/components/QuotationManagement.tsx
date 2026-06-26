import { useState, useEffect } from "react";
import {
  Plus, FileText, CheckCircle, Clock, XCircle, Printer, Download, Send,
  X, AlertCircle, Calendar, User, DollarSign, Activity, ChevronDown,
  Package, Layers, ArrowRight, Lock, Copy, RefreshCcw, ThumbsUp,
  Settings, Factory, Truck
} from "lucide-react";
import { api, QuotationData, Priority } from "../server/api";
import { useNavigate } from "react-router-dom";

function StatusBadge({ status }: { status: string }) {
  const s: Record<string, string> = {
    "Approved": "bg-green-50 text-green-700 border-green-200",
    "Sent": "bg-blue-50 text-blue-700 border-blue-200",
    "Draft": "bg-slate-100 text-slate-600 border-slate-200",
    "Rejected": "bg-red-50 text-red-700 border-red-200",
    "Pending": "bg-amber-50 text-amber-700 border-amber-200",
    "Revision": "bg-purple-50 text-purple-700 border-purple-200",
    "Expired": "bg-slate-800 text-slate-100 border-slate-700",
    "Cancelled": "bg-slate-100 text-slate-400 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${s[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`} style={{ fontWeight: 500 }}>
      {status}
    </span>
  );
}

const isLocked = (q: QuotationData) => {
  return q.workflow.sampleOrder !== "N/A" || q.workflow.productionOrder !== "N/A";
};

const isCommerciallyCleared = (q: QuotationData) => {
  const required = (q.commercials.total * q.commercials.advanceRequiredPct) / 100;
  return q.commercials.advanceReceivedAmt >= required;
};

interface QuotationDetailProps {
  quotation: QuotationData;
  onClose: () => void;
  onUpdate: () => void;
}

function QuotationDetail({ quotation: q, onClose, onUpdate }: QuotationDetailProps) {
  const navigate = useNavigate();
  const locked = isLocked(q);
  const cleared = isCommerciallyCleared(q);
  const requiredAdvance = (q.commercials.total * q.commercials.advanceRequiredPct) / 100;

  // State for Create Production Job modal
  const [showCreateProductionModal, setShowCreateProductionModal] = useState(false);
  const [machines, setMachines] = useState<{ id: string, name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string, name: string }[]>([]);
  const [productionForm, setProductionForm] = useState({
    machineId: "",
    operatorId: "",
    priority: "Medium" as Priority,
    deliveryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    productId: q.products[0]?.id || 0,
  });
  const [creating, setCreating] = useState(false);

  // Fetch dropdown data when modal opens
  useEffect(() => {
    if (showCreateProductionModal) {
      api.getMachines().then(m => {
        setMachines(m.map(x => ({ id: x.id, name: x.name })));
      });
      api.getEmployees().then(e => {
        setEmployees(e.map(x => ({ id: x.id, name: x.name })));
      });
    }
  }, [showCreateProductionModal]);

  const handleUpdateStatus = async (status: string) => {
    try {
      await api.updateQuotationStatus(q.id, status);
      onUpdate();
      onClose();
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status");
    }
  };

  const handleCreateProduction = async () => {
    if (!productionForm.machineId) {
      alert("Please select a machine");
      return;
    }
    if (!productionForm.operatorId) {
      alert("Please select an operator");
      return;
    }

    try {
      setCreating(true);
      await api.createProductionJob({
        quotationId: q.id,
        productId: productionForm.productId,
        deliveryDate: productionForm.deliveryDate,
        machineId: productionForm.machineId,
        operatorId: productionForm.operatorId,
        priority: productionForm.priority,
      });
      onUpdate();
      setShowCreateProductionModal(false);
      alert("Production job created successfully!");
    } catch (err) {
      console.error("Failed to create production job:", err);
      alert("Failed to create production job. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white/95 backdrop-blur z-10">
            <div className="flex items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-slate-900 text-lg" style={{ fontWeight: 700 }}>{q.id}</h2>
                  <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{q.version}</span>
                  {locked && <Lock size={14} className="text-amber-500" title="Locked by downstream workflow" />}
                </div>
                <p className="text-slate-500 text-sm mt-0.5">{q.customer}</p>
              </div>
              <div className="h-8 w-px bg-slate-200 mx-2" />
              <div className="flex flex-col gap-1">
                <StatusBadge status={q.status} />
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <User size={10} /> Owner: {q.owner}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium">
                <Download size={14} /> PDF
              </button>
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto bg-slate-50/50">

            {/* Main Column */}
            <div className="lg:col-span-2 space-y-6">

              {/* Downstream Workflow Tracker */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" /> Downstream Workflow
                </h3>
                <div className="flex items-center justify-between relative">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-slate-100" />
                  {[
                    { label: "Sample", status: q.workflow.sampleOrder },
                    { label: "Production", status: q.workflow.productionOrder },
                    { label: "Dispatch", status: q.workflow.dispatch },
                    { label: "Invoice", status: q.workflow.invoice },
                    { label: "Closure", status: q.workflow.closure }
                  ].map((step, i) => (
                    <div key={i} className="relative z-10 flex flex-col items-center gap-2 bg-white px-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 text-xs font-bold
                        ${step.status !== "N/A" && step.status !== "Pending" ? "bg-indigo-50 border-indigo-500 text-indigo-700" : "bg-white border-slate-200 text-slate-400"}
                      `}>
                        {i + 1}
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-medium text-slate-700">{step.label}</p>
                        <p className="text-[10px] text-slate-500">{step.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Product Specifications */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                  <Package size={16} className="text-slate-500" />
                  <h3 className="text-sm font-semibold text-slate-900">Quotation Products & Specs</h3>
                </div>
                <div className="divide-y divide-slate-100">
                  {q.products.map((item, i) => (
                    <div key={i} className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.desc}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{item.qty.toLocaleString()} units @ ₹{item.rate.toFixed(2)}</p>
                        </div>
                        <p className="text-sm font-bold text-slate-900">₹{item.total.toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs">
                        <div><span className="text-slate-400 block mb-0.5">Material</span><span className="font-medium text-slate-700">{item.specs.material}</span></div>
                        <div><span className="text-slate-400 block mb-0.5">GSM</span><span className="font-medium text-slate-700">{item.specs.gsm}</span></div>
                        <div><span className="text-slate-400 block mb-0.5">Dimensions</span><span className="font-medium text-slate-700">{item.specs.dimensions}</span></div>
                        <div><span className="text-slate-400 block mb-0.5">Printing</span><span className="font-medium text-slate-700">{item.specs.printingTech}</span></div>
                        <div><span className="text-slate-400 block mb-0.5">Colors</span><span className="font-medium text-slate-700">{item.specs.colors}</span></div>
                        <div><span className="text-slate-400 block mb-0.5">Lamination</span><span className="font-medium text-slate-700">{item.specs.lamination}</span></div>
                        <div className="col-span-2"><span className="text-slate-400 block mb-0.5">Packaging</span><span className="font-medium text-slate-700">{item.specs.packaging}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">

              {/* Commercial Readiness Block */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="bg-slate-900 px-5 py-4 text-white">
                  <p className="text-xs text-slate-400 mb-1">Quotation Total (Inc. GST)</p>
                  <h3 className="text-2xl font-bold">₹{q.commercials.total.toLocaleString()}</h3>
                </div>
                <div className="p-5 space-y-4 text-sm">
                  <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                    <span className="text-slate-500">Payment Terms</span>
                    <span className="font-semibold text-slate-800 text-right">{q.commercials.paymentTerms}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Advance Required ({q.commercials.advanceRequiredPct}%)</span>
                    <span className="font-semibold text-slate-800">₹{requiredAdvance.toLocaleString()}</span>
                  </div>

                  <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${cleared ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    {cleared ? <CheckCircle size={16} className="text-green-600 mt-0.5" /> : <AlertCircle size={16} className="text-amber-600 mt-0.5" />}
                    <div>
                      <p className={`font-semibold ${cleared ? 'text-green-800' : 'text-amber-800'}`}>
                        {cleared ? "Commercially Cleared" : "Advance Pending"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Internal Costing Summary */}
              <div className="bg-amber-50/50 border border-amber-200 rounded-xl shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                <div className="px-5 py-3 border-b border-amber-100 flex items-center gap-2">
                  <DollarSign size={16} className="text-amber-600" />
                  <h3 className="text-sm font-semibold text-amber-900">Internal Costing Summary</h3>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-amber-700/80">Est. Total Cost</span>
                    <span className="font-bold text-amber-900">₹{q.costing.estimatedTotalCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-700/80">Expected Margin</span>
                    <span className="font-bold text-amber-900">₹{q.costing.expectedMargin.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Quick Action - Create Production Job */}
              {q.workflow.productionOrder === "N/A" && q.status === "Approved" && (
                <button
                  onClick={() => setShowCreateProductionModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-semibold text-sm shadow-sm"
                >
                  <Factory size={18} /> Create Production Job
                </button>
              )}
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center shrink-0">
            <button onClick={() => navigate(`/quotations/edit/${q.id}`)} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
              Edit Quotation
            </button>
            <div className="flex gap-2">
              <button onClick={() => handleUpdateStatus('Rejected')} className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
                Mark Rejected
              </button>
              <button onClick={() => handleUpdateStatus('Approved')} className="px-4 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors">
                Mark Approved
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Production Job Modal */}
      {showCreateProductionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Factory size={20} className="text-indigo-600" /> Create Production Job
              </h3>
              <button
                onClick={() => setShowCreateProductionModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Quotation Info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <p className="text-xs text-slate-500 mb-1">Quotation</p>
                <p className="font-semibold text-slate-900">{q.id}</p>
                <p className="text-sm text-slate-600">{q.customer}</p>
                <p className="text-sm font-bold text-indigo-600 mt-1">₹{q.commercials.total.toLocaleString()}</p>
              </div>

              {/* Product */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  value={productionForm.productId}
                  onChange={(e) => setProductionForm({ ...productionForm, productId: Number(e.target.value) })}
                >
                  {q.products.map((p, i) => (
                    <option key={i} value={p.id || i + 1}>{p.desc}</option>
                  ))}
                </select>
              </div>

              {/* Machine */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Machine</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  value={productionForm.machineId}
                  onChange={(e) => setProductionForm({ ...productionForm, machineId: e.target.value })}
                >
                  <option value="">Select Machine</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* Operator */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Operator</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  value={productionForm.operatorId}
                  onChange={(e) => setProductionForm({ ...productionForm, operatorId: e.target.value })}
                >
                  <option value="">Select Operator</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  value={productionForm.priority}
                  onChange={(e) => setProductionForm({ ...productionForm, priority: e.target.value as Priority })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              {/* Delivery Date */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Expected Delivery Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  value={productionForm.deliveryDate}
                  onChange={(e) => setProductionForm({ ...productionForm, deliveryDate: e.target.value })}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowCreateProductionModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProduction}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Factory size={16} /> Create Production Job
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function QuotationManagement() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<QuotationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<QuotationData | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const data = await api.getQuotations();
      setQuotations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const filtered = quotations.filter((q) => statusFilter === "All" || q.status === statusFilter);

  // Advanced ERP Stats
  const stats = {
    total: quotations.length,
    approved: quotations.filter((q) => q.status === "Approved").length,
    convertedToSample: quotations.filter((q) => q.workflow.sampleOrder !== "N/A").length,
    convertedToProduction: quotations.filter((q) => q.workflow.productionOrder !== "N/A").length,
    totalValue: quotations.reduce((a, q) => a + q.commercials.total, 0),
  };

  const conversionRate = stats.total > 0 ? Math.round(((stats.convertedToSample + stats.convertedToProduction) / stats.total) * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {selected && <QuotationDetail quotation={selected} onClose={() => setSelected(null)} onUpdate={fetchQuotations} />}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.5rem", fontWeight: 700 }}>Quotation & Estimation</h1>
          <p className="text-slate-500 text-sm mt-1">Manage print estimations, client approvals, and downstream production pipelines.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/quotations/create")}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg text-white transition-colors shadow-sm"
            style={{ background: "#4f46e5", fontWeight: 600 }}
          >
            <Plus size={16} /> Create Quotation
          </button>
        </div>
      </div>

      {/* Pipeline Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-indigo-600 bg-indigo-50"><FileText size={16} /></div>
          <p className="text-slate-900 text-2xl font-bold mb-0.5">{stats.total}</p>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Total Quotes</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-blue-600 bg-blue-50"><DollarSign size={16} /></div>
          <p className="text-slate-900 text-2xl font-bold mb-0.5">₹{(stats.totalValue / 100000).toFixed(1)}L</p>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Pipeline Value</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-amber-600 bg-amber-50"><Layers size={16} /></div>
          <p className="text-slate-900 text-2xl font-bold mb-0.5">{stats.convertedToSample}</p>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Samples Created</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-emerald-600 bg-emerald-50"><Package size={16} /></div>
          <p className="text-slate-900 text-2xl font-bold mb-0.5">{stats.convertedToProduction}</p>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Production Jobs</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3 text-purple-600 bg-purple-50"><Activity size={16} /></div>
          <p className="text-slate-900 text-2xl font-bold mb-0.5">{conversionRate}%</p>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">Conversion Rate</p>
        </div>
      </div>

      {/* Global Filters & Quotation List */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Filters Bar */}
        <div className="flex items-center gap-4 p-4 border-b border-slate-100 bg-slate-50/50 flex-wrap">
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 outline-none focus:border-indigo-500"
            >
              <option value="All">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending Review</option>
              <option value="Sent">Sent to Customer</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <div className="col-span-3">Quotation & Customer</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Value & Advance</div>
          <div className="col-span-2">Validity & Owner</div>
          <div className="col-span-3 text-right">Downstream Workflow</div>
        </div>

        {/* Table Body */}
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading quotations...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No quotations found.</div>
        ) : (
          <div className="divide-y divide-slate-100 bg-white">
            {filtered.map((q) => {
              const locked = isLocked(q);
              const cleared = isCommerciallyCleared(q);
              return (
                <div key={q.id} className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50/80 transition-colors cursor-pointer group" onClick={() => setSelected(q)}>

                  {/* ID & Customer */}
                  <div className="col-span-3 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-slate-900 font-bold text-sm">{q.id}</p>
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{q.version}</span>
                      {locked && <Lock size={12} className="text-amber-500" />}
                    </div>
                    <p className="text-slate-500 text-xs truncate mt-0.5">{q.customer}</p>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    <StatusBadge status={q.status} />
                  </div>

                  {/* Value & Advance */}
                  <div className="col-span-2">
                    <p className="text-slate-900 font-bold text-sm">₹{q.commercials.total.toLocaleString()}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${cleared ? 'bg-green-500' : 'bg-amber-500'}`} />
                      <p className="text-[10px] text-slate-500">{cleared ? 'Advance Cleared' : 'Advance Pending'}</p>
                    </div>
                  </div>

                  {/* Validity & Owner */}
                  <div className="col-span-2">
                    <p className={`text-xs font-medium ${q.status === 'Expired' ? 'text-red-600' : 'text-slate-700'}`}>Exp: {q.validUntil}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1"><User size={10} /> {q.owner}</p>
                  </div>

                  {/* Downstream */}
                  <div className="col-span-3 flex justify-end">
                    {q.workflow.productionOrder !== "N/A" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <Package size={12} /> Prod: {q.workflow.productionOrder}
                      </span>
                    ) : q.workflow.sampleOrder !== "N/A" ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                        <Layers size={12} /> Sample: {q.workflow.sampleOrder}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">Not Converted</span>
                    )}
                    <ChevronDown size={16} className="text-slate-300 ml-4 -rotate-90 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}