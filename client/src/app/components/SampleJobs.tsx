import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Search, Plus, Calendar, User, Clock, CheckCircle, X,
  FileText, Eye, RefreshCw, AlertTriangle, FlaskConical, Factory,
  Wrench, Settings, Edit
} from "lucide-react";
import {
  api,
  SampleJob,
  SampleStatus,
  Priority,
  supabase
} from "../server/api";

// Status configuration
const statusConfig: Record<SampleStatus, { label: string; bg: string; text: string; border: string; icon: React.ReactElement }> = {
  "Pending": {
    label: "Pending",
    bg: "bg-slate-50",
    text: "text-slate-600",
    border: "border-slate-200",
    icon: React.createElement(Clock, { size: 12 })
  },
  "In Progress": {
    label: "In Progress",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: React.createElement(Clock, { size: 12 })
  },
  "QC Pending": {
    label: "QC Pending",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: React.createElement(AlertTriangle, { size: 12 })
  },
  "Awaiting Approval": {
    label: "Awaiting Approval",
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    border: "border-yellow-200",
    icon: React.createElement(Clock, { size: 12 })
  },
  "Approved": {
    label: "Approved",
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
    icon: React.createElement(CheckCircle, { size: 12 })
  },
  "Rejected": {
    label: "Rejected",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    icon: React.createElement(X, { size: 12 })
  },
  "Production Created": {
    label: "Production Created",
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    icon: React.createElement(CheckCircle, { size: 12 })
  },
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
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // State for Assign/Edit Machine Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignSample, setAssignSample] = useState<SampleJob | null>(null);
  const [assignForm, setAssignForm] = useState({
    machineId: 0,
    operatorId: 0,
  });
  const [isEditing, setIsEditing] = useState(false);

  // State for dropdowns
  const [employees, setEmployees] = useState<{ id: number; name: string; role: string }[]>([]);
  const [machines, setMachines] = useState<{ id: number; name: string; type: string; status: string }[]>([]);
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
      const [employeesData, machinesData] = await Promise.all([
        api.getEmployees(),
        api.getMachines(),
      ]);
      setEmployees(employeesData);
      setMachines(machinesData);
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

  const filtered = sampleJobs.filter((job) => {
    // Hide "Production Created" from the main "All" view
    if (statusFilter === "All" && job.status === "Production Created") {
      return false;
    }

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

  // Open Assign Modal for new assignment
  const handleOpenAssign = (job: SampleJob) => {
    setAssignSample(job);
    setAssignForm({
      machineId: 0,
      operatorId: 0,
    });
    setIsEditing(false);
    setShowAssignModal(true);
  };

  // Open Edit Modal for existing assignment
  const handleOpenEdit = (job: SampleJob) => {
    setAssignSample(job);
    setAssignForm({
      machineId: 0,
      operatorId: 0,
    });
    setIsEditing(true);
    setShowAssignModal(true);
  };

  // Handle Assign/Edit Machine and Operator
  const handleAssign = async () => {
    if (!assignSample) {
      console.error('No sample selected for assignment');
      alert("No sample selected");
      return;
    }

    console.log('Assign Sample:', assignSample);
    console.log('Assign Form:', assignForm);

    if (assignForm.machineId === 0) {
      alert("Please select a machine");
      return;
    }
    if (assignForm.operatorId === 0) {
      alert("Please select an operator");
      return;
    }

    try {
      setCreating(true);

      const updateData = {
        machine_id: assignForm.machineId,
        assigned_to: assignForm.operatorId,
        status: 'In Progress'
      };

      console.log('Updating with data:', updateData);
      console.log('Where sample_order_id =', assignSample.id);

      const { data, error: updateError } = await supabase
        .from('sample_orders')
        .update(updateData)
        .eq('sample_order_id', assignSample.id)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        throw updateError;
      }

      console.log('Update successful, returned data:', data);

      await loadSampleJobs();
      setShowAssignModal(false);
      setAssignSample(null);
      alert(isEditing ? "Assignment updated successfully!" : "Machine and Operator assigned successfully!");
    } catch (err) {
      console.error('Failed to assign:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to assign machine and operator';
      setError(errorMessage);
      alert(`Error: ${errorMessage}`);
    } finally {
      setCreating(false);
    }
  };

  // Approve sample
  const handleApprove = async (job: SampleJob) => {
    try {
      setProcessingId(job.id);
      await api.approveSample(job.id);
      await loadSampleJobs();
      alert("✅ Sample approved successfully! Sales person can now send to production from Quotation page.");
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
      {/* Assign/Edit Machine/Operator Modal */}
      {showAssignModal && assignSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                {isEditing ? (
                  <Edit size={18} className="text-indigo-600" />
                ) : (
                  <Settings size={18} className="text-indigo-600" />
                )}
                {isEditing ? "Edit Assignment" : "Assign Machine & Operator"}
              </h3>
              <button onClick={() => setShowAssignModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              {isEditing ? "Update machine and operator for" : "Assign machine and operator for"} <span className="font-semibold text-slate-700">{assignSample.id}</span>
            </p>

            <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-1">
              <p className="text-xs text-slate-500">Product</p>
              <p className="text-sm font-medium text-slate-900">{assignSample.product}</p>
              <p className="text-xs text-slate-500 mt-1">Customer</p>
              <p className="text-sm font-medium text-slate-900">{assignSample.customer}</p>
              <p className="text-xs text-slate-500 mt-1">Quantity</p>
              <p className="text-sm font-medium text-slate-900">{assignSample.sampleQuantity} pieces</p>
              <p className="text-xs text-slate-500 mt-1">Current Status</p>
              <p className="text-sm font-medium text-slate-900">{assignSample.status}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 block mb-1">Machine *</label>
                <select
                  value={assignForm.machineId}
                  onChange={(e) => setAssignForm({ ...assignForm, machineId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="0">Select Machine</option>
                  {machines
                    .filter(m => m.status === 'Active' || m.status === 'Setup') // Only show Active and Setup machines
                    .map((machine) => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} {machine.type ? `(${machine.type})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-500 block mb-1">Operator *</label>
                <select
                  value={assignForm.operatorId}
                  onChange={(e) => setAssignForm({ ...assignForm, operatorId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="0">Select Operator</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name} {employee.role ? `(${employee.role})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                onClick={handleAssign}
                disabled={creating || loadingDropdowns}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  isEditing ? 'Update Assignment' : 'Assign Machine & Operator'
                )}
              </button>
              <button
                onClick={() => setShowAssignModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
            {sampleJobs.filter(j => j.status !== "Production Created").length} active
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
        </div>
      </div>

      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-4">
        {Object.entries(statusCounts).map(([key, count]) => {
          const label = key === "All" ? "All Samples" : key;
          const active = statusFilter === key;
          const conf = key !== "All" ? statusConfig[key as SampleStatus] : null;
          // Only show Production Created filter if there are jobs with that status
          if (key === "Production Created" && count === 0) return null;
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
            const isApproved = job.status === "Approved";
            const isRejected = job.status === "Rejected";
            const isPending = job.status === "Pending";
            const isInProgress = job.status === "In Progress";
            const isQCPending = job.status === "QC Pending";
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

                {isRejected && job.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                    <p className="text-xs text-red-600">
                      <span className="font-semibold">Rejection Reason:</span> {job.rejectionReason}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Assign Machine button for pending jobs */}
                  {isPending && (
                    <button
                      onClick={() => handleOpenAssign(job)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors font-medium"
                    >
                      <Wrench size={14} /> Assign Machine
                    </button>
                  )}

                  {isInProgress && (
                    <button
                      onClick={() => handleOpenEdit(job)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-xs bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors font-medium"
                    >
                      <Edit size={14} /> Edit Assignment
                    </button>
                  )}

                  {isQCPending && (
                    <div className="w-full text-center py-2 px-3 rounded-lg text-xs bg-orange-50 text-orange-700 border border-orange-200">
                      Waiting for QC Inspection
                    </div>
                  )}

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
                      <Factory size={14} /> View Production
                    </button>
                  ) : isApproved ? (
                    <div className="w-full text-center py-2 px-3 rounded-lg text-xs bg-green-50 text-green-700 border border-green-200">
                      ✅ Sample Approved - Ready for Production
                    </div>
                  ) : isRejected ? (
                    <button
                      onClick={() => {
                        setSelectedSample(job);
                      }}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                    >
                      <Eye size={14} /> View Details
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedSample(job);
                      }}
                      className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                    >
                      <Eye size={14} /> View Details
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedSample && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <X size={18} className="text-red-500" /> Reject Sample
            </h3>
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
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Sample'
                )}
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
    </div>
  );
}