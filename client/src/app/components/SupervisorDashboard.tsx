import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, CheckCircle, Clock, XCircle, AlertTriangle, User, Calendar,
  Package, Factory, FlaskConical, ChevronRight, RefreshCw, Eye,
  ThumbsUp, ThumbsDown, MessageSquare, Filter, Search, Plus, X,
  Settings, Wrench, Edit, Trash2, Save
} from "lucide-react";
import { api, SampleJob, ProductionJob, QualityCheck, QCProductionOrder } from "../server/api";
import { supabase } from "../server/api";

// Status Config
const statusConfig: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  "Pending": { label: "Pending", bg: "bg-slate-50", text: "text-slate-600", border: "border-slate-200", icon: <Clock size={12} /> },
  "In Progress": { label: "In Progress", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", icon: <Clock size={12} /> },
  "Awaiting Approval": { label: "Awaiting Approval", bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", icon: <Clock size={12} /> },
  "Approved": { label: "Approved", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
  "Rejected": { label: "Rejected", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <XCircle size={12} /> },
  "Production Created": { label: "Production Created", bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", icon: <CheckCircle size={12} /> },
  "Completed": { label: "Completed", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
  "Dispatched": { label: "Dispatched", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: <CheckCircle size={12} /> },
  "QC Pending": { label: "QC Pending", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: <AlertTriangle size={12} /> },
  "Passed": { label: "Passed", bg: "bg-green-50", text: "text-green-700", border: "border-green-200", icon: <CheckCircle size={12} /> },
  "Failed": { label: "Failed", bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: <XCircle size={12} /> },
  "Rework": { label: "Rework", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: <AlertTriangle size={12} /> },
  "Rework Required": { label: "Rework Required", bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", icon: <AlertTriangle size={12} /> },
};

// Sample Card Component
function SampleCard({ job, onUpdate }: { job: SampleJob; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleApprove = async () => {
    try {
      setLoading(true);
      await api.approveSample(job.id);
      onUpdate();
    } catch (err) {
      console.error("Failed to approve sample:", err);
      alert("Failed to approve sample. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }
    try {
      setLoading(true);
      await api.rejectSample(job.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason("");
      onUpdate();
    } catch (err) {
      console.error("Failed to reject sample:", err);
      alert("Failed to reject sample. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const conf = statusConfig[job.status] || statusConfig["Pending"];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Reject Sample</h3>
            <p className="text-sm text-slate-500 mb-4">
              Reject sample <span className="font-semibold text-slate-700">{job.id}</span>
            </p>
            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1">Rejection Reason *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter reason for rejection..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Rejecting..." : "Reject Sample"}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-amber-50 text-amber-700 border border-amber-200">
              <FlaskConical size={10} /> Sample
            </span>
            <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
            <span className="text-xs text-slate-400">|</span>
            <p className="text-slate-500 text-xs">{job.quotationId}</p>
          </div>
          <p className="text-slate-900 text-sm font-semibold">{job.product}</p>
          <p className="text-slate-500 text-xs mt-0.5">{job.customer}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border flex-shrink-0 ${conf.bg} ${conf.text} ${conf.border}`}>
          {conf.icon} {conf.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Quantity</p>
          <p className="text-sm text-slate-900 font-semibold">{job.sampleQuantity} pieces</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Assigned To</p>
          <p className="text-xs text-slate-700 font-medium">{job.assignedTo}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Due Date</p>
          <p className="text-xs text-slate-700 font-medium">{new Date(job.dueDate).toLocaleDateString()}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Cost</p>
          <p className="text-xs text-slate-700 font-medium">₹{job.sampleCost.toLocaleString()}</p>
        </div>
      </div>

      {job.status === "Awaiting Approval" && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50"
          >
            <ThumbsUp size={14} /> Approve
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
          >
            <ThumbsDown size={14} /> Reject
          </button>
        </div>
      )}
    </div>
  );
}

// Production Card Component
function ProductionCard({ job, onUpdate }: { job: ProductionJob; onUpdate: () => void }) {
  const navigate = useNavigate();
  const conf = statusConfig[job.status] || statusConfig["Pending"];

  // Don't show dispatched jobs
  if (job.status === "Dispatched") {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Factory size={10} /> Production
            </span>
            <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
            <span className="text-xs text-slate-400">|</span>
            <p className="text-slate-500 text-xs">{job.quotationId}</p>
          </div>
          <p className="text-slate-900 text-sm font-semibold">{job.product}</p>
          <p className="text-slate-500 text-xs mt-0.5">{job.customer} · {job.machine}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border flex-shrink-0 ${conf.bg} ${conf.text} ${conf.border}`}>
          {conf.icon} {conf.label}
        </span>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-500">Progress</span>
          <span className="text-xs text-slate-700 font-semibold">{job.progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 transition-all"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500">Qty</p>
          <p className="text-xs text-slate-700 font-semibold">{job.quantity.toLocaleString()}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500">Operator</p>
          <p className="text-xs text-slate-700 font-medium">{job.assignedTo}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500">Due</p>
          <p className="text-xs text-slate-700 font-medium">{new Date(job.dueDate).toLocaleDateString()}</p>
        </div>
      </div>

      <button
        onClick={() => navigate(`/production-jobs`)}
        className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
      >
        <Eye size={14} /> View Details
      </button>
    </div>
  );
}

// QC Card Component
function QCCard({ qc, onUpdate }: { qc: QualityCheck; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectData, setRejectData] = useState({
    description: "",
    reworkRequired: false,
    reworkDescription: "",
  });

  const handleApprove = async () => {
    try {
      setLoading(true);
      await api.approveQualityCheck(qc.qc_id);
      onUpdate();
    } catch (err) {
      console.error("Failed to approve QC:", err);
      alert("Failed to approve QC. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectData.description.trim()) {
      alert("Please provide a rejection description");
      return;
    }
    try {
      setLoading(true);
      await api.rejectQualityCheck(
        qc.qc_id,
        rejectData.description,
        rejectData.reworkRequired,
        rejectData.reworkDescription
      );
      setShowRejectModal(false);
      setRejectData({ description: "", reworkRequired: false, reworkDescription: "" });
      onUpdate();
    } catch (err) {
      console.error("Failed to reject QC:", err);
      alert("Failed to reject QC. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const conf = statusConfig[qc.overall_status] || statusConfig["Pending"];

  // Don't show QC reports that have been approved for dispatch (they should be handled in Dispatch page)
  if (qc.approved_for_dispatch) {
    return null;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all">
      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Reject QC Report</h3>
            <p className="text-sm text-slate-500 mb-4">
              Reject QC for production <span className="font-semibold text-slate-700">{qc.production_order_id}</span>
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Rejection Description *</label>
                <textarea
                  value={rejectData.description}
                  onChange={(e) => setRejectData({ ...rejectData, description: e.target.value })}
                  placeholder="Describe why this QC failed..."
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rejectData.reworkRequired}
                    onChange={(e) => setRejectData({ ...rejectData, reworkRequired: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded"
                  />
                  Rework Required
                </label>
              </div>
              {rejectData.reworkRequired && (
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Rework Description</label>
                  <textarea
                    value={rejectData.reworkDescription}
                    onChange={(e) => setRejectData({ ...rejectData, reworkDescription: e.target.value })}
                    placeholder="Describe the rework needed..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
              <button
                onClick={handleReject}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {loading ? "Rejecting..." : "Reject QC"}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectData({ description: "", reworkRequired: false, reworkDescription: "" }); }}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200">
              QC
            </span>
            <p className="text-indigo-600 text-xs font-bold">QC-{qc.qc_id}</p>
            <span className="text-xs text-slate-400">|</span>
            <p className="text-slate-500 text-xs">{qc.production_order_id}</p>
          </div>
          <p className="text-slate-900 text-sm font-semibold">{qc.product_name}</p>
          <p className="text-slate-500 text-xs mt-0.5">{qc.customer_name} · {qc.check_type}</p>
        </div>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border flex-shrink-0 ${conf.bg} ${conf.text} ${conf.border}`}>
          {conf.icon} {qc.overall_status}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500">Color</p>
          <p className="text-xs text-slate-700 font-medium">{qc.color_accuracy}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500">Print</p>
          <p className="text-xs text-slate-700 font-medium">{qc.print_quality}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <p className="text-[10px] text-slate-500">Material</p>
          <p className="text-xs text-slate-700 font-medium">{qc.material_quality}</p>
        </div>
      </div>

      {(qc.overall_status === "Passed" && !qc.approved_for_dispatch) && (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium disabled:opacity-50"
          >
            <CheckCircle size={14} /> Approve for Dispatch
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-50"
          >
            <XCircle size={14} /> Reject
          </button>
        </div>
      )}

      {qc.overall_status === "Failed" && (
        <div className="w-full text-center py-2 px-3 rounded-lg text-xs bg-red-50 text-red-700 border border-red-200">
          ❌ Failed - Sent for Rework
        </div>
      )}

      {qc.overall_status === "Rework" && (
        <div className="w-full text-center py-2 px-3 rounded-lg text-xs bg-orange-50 text-orange-700 border border-orange-200">
          🔄 Rework Required
        </div>
      )}
    </div>
  );
}

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const [samples, setSamples] = useState<SampleJob[]>([]);
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
  const [qcChecks, setQcChecks] = useState<QualityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [view, setView] = useState<"all" | "samples" | "production" | "qc">("all");
  const [stats, setStats] = useState({
    totalSamples: 0,
    pendingSamples: 0,
    totalProduction: 0,
    pendingQC: 0,
    approvedQC: 0,
    totalValue: 0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load all data in parallel
      const [sampleData, productionData, qcData] = await Promise.all([
        api.getSampleJobs(),
        api.getProductionJobs(),
        api.getQualityChecks(),
      ]);

      // Filter out dispatched production jobs (they should be handled in Dispatch page)
      const activeProduction = productionData.filter(job => job.status !== "Dispatched");

      // Filter out QC reports that have been approved for dispatch
      const activeQC = qcData.filter(qc => !qc.approved_for_dispatch);

      setSamples(sampleData);
      setProductionJobs(activeProduction);
      setQcChecks(activeQC);

      // Calculate stats - exclude dispatched jobs and approved QC
      const pendingSamples = sampleData.filter(j => j.status === "Awaiting Approval").length;
      const pendingQC = activeQC.filter(q => q.overall_status === "Passed" && !q.approved_for_dispatch).length;
      const approvedQC = activeQC.filter(q => q.approved_for_dispatch).length;
      const totalValue = activeProduction.reduce((sum, j) => sum + j.value, 0);

      setStats({
        totalSamples: sampleData.length,
        pendingSamples,
        totalProduction: activeProduction.length,
        pendingQC,
        approvedQC,
        totalValue,
      });

    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load dashboard data. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter data based on search and status
  const filteredSamples = samples.filter(job => {
    const s = search.toLowerCase();
    const matchSearch = (job.id || "").toLowerCase().includes(s) ||
      (job.customer || "").toLowerCase().includes(s) ||
      (job.product || "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "All" || job.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredProduction = productionJobs.filter(job => {
    const s = search.toLowerCase();
    const matchSearch = (job.id || "").toLowerCase().includes(s) ||
      (job.customer || "").toLowerCase().includes(s) ||
      (job.product || "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "All" || job.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredQC = qcChecks.filter(qc => {
    const s = search.toLowerCase();
    const matchSearch = (qc.production_order_id || "").toLowerCase().includes(s) ||
      (qc.customer_name || "").toLowerCase().includes(s) ||
      (qc.product_name || "").toLowerCase().includes(s);
    const matchStatus = statusFilter === "All" || qc.overall_status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Get unique statuses for filter dropdown
  const allStatuses = Array.from(new Set([
    ...samples.map(j => j.status),
    ...productionJobs.map(j => j.status),
    ...qcChecks.map(q => q.overall_status),
  ])).filter(Boolean);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <div className="text-red-600 text-lg mb-4">⚠️ {error}</div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900 text-xl font-bold">Supervisor Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {stats.pendingSamples} samples awaiting approval · {stats.pendingQC} QC reports pending
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Samples", value: stats.totalSamples, icon: <FlaskConical size={16} />, color: "text-amber-600 bg-amber-50" },
          { label: "Pending Approval", value: stats.pendingSamples, icon: <Clock size={16} />, color: "text-yellow-600 bg-yellow-50" },
          { label: "Production Jobs", value: stats.totalProduction, icon: <Factory size={16} />, color: "text-indigo-600 bg-indigo-50" },
          { label: "QC Pending", value: stats.pendingQC, icon: <AlertTriangle size={16} />, color: "text-amber-600 bg-amber-50" },
          { label: "Pipeline Value", value: `₹${(stats.totalValue / 100000).toFixed(1)}L`, icon: <Package size={16} />, color: "text-green-600 bg-green-50" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <p className="text-slate-900 text-2xl font-bold">{s.value}</p>
            <p className="text-slate-600 text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        >
          <option value="All">All Statuses</option>
          {allStatuses.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <div className="flex border border-slate-200 rounded-lg overflow-hidden bg-white">
          {[
            { key: "all", label: "All" },
            { key: "samples", label: "Samples" },
            { key: "production", label: "Production" },
            { key: "qc", label: "QC" },
          ].map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key as any)}
              className={`px-3 py-2 text-sm transition-colors ${view === v.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Sections */}
      <div className="space-y-6">
        {/* Samples Section */}
        {(view === "all" || view === "samples") && filteredSamples.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-slate-800 text-sm font-semibold flex items-center gap-2">
              <FlaskConical size={16} className="text-amber-500" />
              Sample Jobs ({filteredSamples.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredSamples.map((job) => (
                <SampleCard key={job.id} job={job} onUpdate={loadData} />
              ))}
            </div>
          </div>
        )}

        {/* Production Section */}
        {(view === "all" || view === "production") && filteredProduction.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-slate-800 text-sm font-semibold flex items-center gap-2">
              <Factory size={16} className="text-indigo-500" />
              Production Jobs ({filteredProduction.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProduction.map((job) => (
                <ProductionCard key={job.id} job={job} onUpdate={loadData} />
              ))}
            </div>
          </div>
        )}

        {/* QC Section */}
        {(view === "all" || view === "qc") && filteredQC.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-slate-800 text-sm font-semibold flex items-center gap-2">
              <CheckCircle size={16} className="text-purple-500" />
              QC Reports ({filteredQC.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredQC.map((qc) => (
                <QCCard key={qc.qc_id} qc={qc} onUpdate={loadData} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {(filteredSamples.length === 0 && filteredProduction.length === 0 && filteredQC.length === 0) && (
          <div className="text-center py-12 bg-card border border-border rounded-xl">
            <div className="text-slate-400 mb-2">
              <FileText size={48} className="mx-auto" />
            </div>
            <p className="text-slate-500 text-sm">No items found</p>
            <p className="text-slate-400 text-xs mt-1">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}