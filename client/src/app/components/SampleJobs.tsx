import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search, Plus, Calendar, User, Clock, CheckCircle, X,
  FileText, Eye, RefreshCw, AlertTriangle
} from "lucide-react";
import {
  api,
  SampleJob,
  SampleStatus,
  CreateSampleJobRequest,
  Priority
} from "../server/api";

const statusConfig: Record<SampleStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Pending": { label: "Pending", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: <Clock size={12} /> },
  "In Progress": { label: "In Progress", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: <Clock size={12} /> },
  "Awaiting Approval": { label: "Awaiting Approval", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: <Clock size={12} /> },
  "Approved": { label: "Approved", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
  "Rejected": { label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <X size={12} /> },
  "Production Created": { label: "Production Created", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: <CheckCircle size={12} /> },
};

export function SampleJobs() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sampleJobs, setSampleJobs] = useState<SampleJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | SampleStatus>("All");
  const [selectedSample, setSelectedSample] = useState<SampleJob | null>(null);
  const [showCreateProduction, setShowCreateProduction] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // ✅ FIXED: State for dropdowns with string IDs
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [machines, setMachines] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: number; name: string }[]>([]);
  const [loadingDropdowns, setLoadingDropdowns] = useState(false);

  // Load sample jobs
  const loadSampleJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getSampleJobs();
      setSampleJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sample jobs');
    } finally {
      setLoading(false);
    }
  };

  // Load dropdown data
  const loadDropdownData = async () => {
    try {
      setLoadingDropdowns(true);
      const [employeesData, machinesData, customersData, productsData] = await Promise.all([
        api.getEmployees(),
        api.getMachines(),
        api.getCustomers(),
        api.getProducts(),
      ]);
      setEmployees(employeesData);
      setMachines(machinesData);
      setCustomers(customersData);
      setProducts(productsData);
    } catch (err) {
      console.warn('Failed to load dropdown data:', err);
    } finally {
      setLoadingDropdowns(false);
    }
  };

  useEffect(() => {
    loadSampleJobs();
    loadDropdownData();
  }, []);

  // Handle navigation from Quotation
  useEffect(() => {
    if (location.state?.quotationId) {
      setShowCreateModal(true);
    }
  }, [location.state]);

  const filtered = sampleJobs.filter((job) => {
    const matchesSearch = job.id.toLowerCase().includes(search.toLowerCase()) ||
      job.customer.toLowerCase().includes(search.toLowerCase()) ||
      job.product.toLowerCase().includes(search.toLowerCase()) ||
      job.quotationId.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "All" || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    All: sampleJobs.length,
    Pending: sampleJobs.filter(j => j.status === "Pending").length,
    "In Progress": sampleJobs.filter(j => j.status === "In Progress").length,
    "Awaiting Approval": sampleJobs.filter(j => j.status === "Awaiting Approval").length,
    Approved: sampleJobs.filter(j => j.status === "Approved").length,
    Rejected: sampleJobs.filter(j => j.status === "Rejected").length,
    "Production Created": sampleJobs.filter(j => j.status === "Production Created").length,
  };

  // Approve sample
  const handleApprove = async (job: SampleJob) => {
    try {
      setProcessingId(job.id);
      await api.approveSample(job.id);
      await loadSampleJobs();
      setSelectedSample(job);
      setShowCreateProduction(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve sample');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject sample
  const handleReject = async () => {
    if (!selectedSample || !rejectionReason.trim()) return;

    try {
      setCreating(true);
      await api.rejectSample(selectedSample.id, rejectionReason);
      await loadSampleJobs();
      setShowRejectModal(false);
      setRejectionReason("");
      setSelectedSample(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject sample');
    } finally {
      setCreating(false);
    }
  };

  // Create production job
  const handleCreateProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSample) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const quantity = parseInt(formData.get('quantity') as string);
    const deliveryDate = formData.get('deliveryDate') as string;
    const machineId = formData.get('machineId') as string; // ✅ FIXED: string
    const operatorId = formData.get('operatorId') as string; // ✅ FIXED: string
    const priority = formData.get('priority') as Priority;

    try {
      setCreating(true);
      await api.createProductionJob({
        sampleJobId: selectedSample.id,
        quantity,
        deliveryDate,
        machineId,
        operatorId,
        priority,
      });
      await loadSampleJobs();
      setShowCreateProduction(false);
      setSelectedSample(null);
      navigate('/production-jobs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create production job');
    } finally {
      setCreating(false);
    }
  };

  // Create sample job with dropdown values
  const handleCreateSample = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    try {
      setCreating(true);
      await api.createSampleJob({
        quotationId: formData.get('quotationId') as string,
        customerId: formData.get('customerId') as string, // ✅ FIXED: string
        productId: parseInt(formData.get('productId') as string),
        sampleQuantity: parseInt(formData.get('sampleQuantity') as string),
        sampleCost: parseInt(formData.get('sampleCost') as string),
        assignedTo: formData.get('assignedTo') as string, // ✅ FIXED: string
        dueDate: formData.get('dueDate') as string,
      });
      await loadSampleJobs();
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sample job');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading sample jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Error toast */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900 text-xl font-bold">Sample Jobs</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {sampleJobs.filter(j => j.status === "Awaiting Approval").length} awaiting approval ·
            {sampleJobs.filter(j => j.status === "In Progress").length} in production ·
            {sampleJobs.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSampleJobs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg text-white transition-colors bg-indigo-600 hover:bg-indigo-700 font-medium"
          >
            <Plus size={14} /> New Sample Job
          </button>
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {Object.entries(statusCounts).map(([key, count]) => {
          const label = key === "All" ? "All Samples" : key;
          const active = statusFilter === key;
          const conf = key !== "All" ? statusConfig[key as SampleStatus] : null;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${active
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}
              style={{ fontWeight: active ? 600 : 400 }}
            >
              {conf && !active && <span className={conf.text}>{conf.icon}</span>}
              {label}
              <span className={`px-1.5 rounded-full text-xs ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`} style={{ fontWeight: 600 }}>
                {count}
              </span>
            </button>
          );
        })}

        <div className="flex-1" />
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search samples..."
            className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Sample Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-2">
            <FileText size={48} className="mx-auto" />
          </div>
          <p className="text-slate-500 text-sm">No sample jobs found</p>
          <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((job) => {
            const conf = statusConfig[job.status];
            const isAwaitingApproval = job.status === "Awaiting Approval";
            const isProductionCreated = job.status === "Production Created";
            const isProcessing = processingId === job.id;

            return (
              <div key={job.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
                      <span className="text-xs text-slate-400">|</span>
                      <p className="text-slate-500 text-xs">{job.quotationId}</p>
                      {job.productionJobId && (
                        <>
                          <span className="text-xs text-slate-400">|</span>
                          <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            → {job.productionJobId}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-slate-900 text-sm font-semibold leading-snug">{job.product}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{job.customer}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border flex-shrink-0 ${conf.bg} ${conf.text} ${conf.border}`} style={{ fontWeight: 500 }}>
                    {conf.icon} {conf.label}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Quantity</p>
                    <p className="text-sm text-slate-900 font-semibold">{job.sampleQuantity} pieces</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sample Cost</p>
                    <p className="text-sm text-slate-900 font-semibold">₹{job.sampleCost.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Assigned To</p>
                    <div className="flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      <p className="text-xs text-slate-700 font-medium">{job.assignedTo}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">Due Date</p>
                    <div className="flex items-center gap-1">
                      <Calendar size={12} className="text-slate-400" />
                      <p className="text-xs text-slate-700 font-medium">{new Date(job.dueDate).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {job.status === "Rejected" && job.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                    <p className="text-xs text-red-600">
                      <span className="font-semibold">Rejection Reason:</span> {job.rejectionReason}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  {isAwaitingApproval ? (
                    <>
                      <button
                        onClick={() => handleApprove(job)}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <CheckCircle size={14} />
                        )}
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedSample(job);
                          setShowRejectModal(true);
                        }}
                        disabled={isProcessing}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <X size={14} /> Reject
                      </button>
                    </>
                  ) : isProductionCreated ? (
                    <button
                      onClick={() => navigate('/production-jobs')}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                    >
                      <Eye size={14} /> View Production
                    </button>
                  ) : job.status === "Approved" ? (
                    <button
                      onClick={() => {
                        setSelectedSample(job);
                        setShowCreateProduction(true);
                      }}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                    >
                      <Plus size={14} /> Create Production Job
                    </button>
                  ) : job.status === "Rejected" ? (
                    <button className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg cursor-not-allowed font-medium">
                      <Eye size={14} /> View Details
                    </button>
                  ) : (
                    <button className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium">
                      <Eye size={14} /> View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Sample Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Create Sample Job</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateSample} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Quotation ID *</label>
                <input
                  type="text"
                  name="quotationId"
                  placeholder="QT-XXXX"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              {/* ✅ FIXED: Customer Dropdown with string IDs */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Customer *</label>
                <select
                  name="customerId"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product Dropdown */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Product *</label>
                <select
                  name="productId"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Sample Quantity *</label>
                  <input
                    type="number"
                    name="sampleQuantity"
                    placeholder="Qty"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Sample Cost *</label>
                  <input
                    type="number"
                    name="sampleCost"
                    placeholder="₹"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* ✅ FIXED: Employee Dropdown with string IDs */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Assigned To (Employee) *</label>
                <select
                  name="assignedTo"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Due Date *</label>
                <input
                  type="date"
                  name="dueDate"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating || loadingDropdowns}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Sample Job'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Reject Sample</h3>
            <p className="text-sm text-slate-500 mb-4">
              Reject sample <span className="font-semibold text-slate-700">{selectedSample.id}</span>
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1">Rejection Reason *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || creating}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Rejecting...' : 'Reject Sample'}
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                  setSelectedSample(null);
                }}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Production Modal */}
      {showCreateProduction && selectedSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Create Production Job</h3>
              <button onClick={() => setShowCreateProduction(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              Create a production job from sample <span className="font-semibold text-slate-700">{selectedSample.id}</span>
            </p>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-xs text-slate-500">Customer</p>
              <p className="text-sm font-medium text-slate-900">{selectedSample.customer}</p>
              <p className="text-xs text-slate-500 mt-1">Product</p>
              <p className="text-sm font-medium text-slate-900">{selectedSample.product}</p>
            </div>

            <form onSubmit={handleCreateProduction} className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Production Quantity *</label>
                <input
                  type="number"
                  name="quantity"
                  defaultValue={selectedSample.sampleQuantity * 100}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Delivery Date *</label>
                <input
                  type="date"
                  name="deliveryDate"
                  defaultValue={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>

              {/* ✅ FIXED: Machine Dropdown with string IDs */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Machine *</label>
                <select
                  name="machineId"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Machine</option>
                  {machines.map((machine) => (
                    <option key={machine.id} value={machine.id}>
                      {machine.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ FIXED: Operator Dropdown with string IDs */}
              <div>
                <label className="text-xs text-slate-500 block mb-1">Operator *</label>
                <select
                  name="operatorId"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Operator</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Priority *</label>
                <select
                  name="priority"
                  defaultValue="Medium"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={creating || loadingDropdowns}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Production Job'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateProduction(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}