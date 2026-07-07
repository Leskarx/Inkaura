import { useState, useEffect } from "react";
import {
  Box, CheckCircle, Clock, Package, Archive, RefreshCw,
  AlertCircle, Loader2, ChevronRight, Tag, User, Calendar,
  ArrowRight, ClipboardCheck
} from "lucide-react";
import { api, ProductionJob, supabase } from "../server/api";

// ── Status config ─────────────────────────────────────────────
const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Completed: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  Packaged: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", dot: "bg-green-500" },
  Dispatched: { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200", dot: "bg-purple-500" },
};

// ── Confirm Modal ─────────────────────────────────────────────
function ConfirmModal({
  job,
  onConfirm,
  onCancel,
  loading,
  cartonType,
  setCartonType,
  cartonTypes,
  isAutoSelected
}: {
  job: ProductionJob;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  cartonType: string;
  setCartonType: (value: string) => void;
  cartonTypes: string[];
  isAutoSelected: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Package size={20} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Mark as Packaged</h3>
              <p className="text-xs text-slate-500 mt-0.5">Confirm packaging is complete for this job</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 mb-5 border border-slate-200 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Order ID</span>
              <span className="font-semibold text-indigo-600">{job.id}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Customer</span>
              <span className="font-semibold text-slate-800">{job.customer}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Product</span>
              <span className="font-semibold text-slate-800 text-right max-w-[60%] truncate">{job.product}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Quantity</span>
              <span className="font-semibold text-slate-800">{job.quantity.toLocaleString()} pcs</span>
            </div>
          </div>

          {/* Carton Type Selection - Auto-selected from QC */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-700">
                Carton Type <span className="text-red-500">*</span>
              </label>
              {isAutoSelected && cartonType && (
                <span className="flex items-center gap-1 text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                  <CheckCircle size={10} /> Auto-selected from QC
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {cartonTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCartonType(type)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${cartonType === type
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400 hover:bg-indigo-50"
                    }`}
                >
                  {type}
                </button>
              ))}
            </div>
            {isAutoSelected && cartonType && (
              <p className="text-[10px] text-slate-500 mt-1.5">
                ✓ Carton type was selected in the Post-Development Checklist during QC approval.
                {!cartonType && " No carton type was selected in QC. Please select one below."}
              </p>
            )}
          </div>

          {/* Flow arrow */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold">Completed</span>
            <ArrowRight size={16} className="text-slate-400" />
            <span className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-semibold">Packaged</span>
            <ArrowRight size={16} className="text-slate-400" />
            <span className="px-3 py-1.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-xs">Dispatch</span>
          </div>

          <p className="text-xs text-slate-500 mb-5 text-center">
            This will move the order to <strong>Dispatch</strong> where an invoice will be generated and the order marked as delivered.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading || !cartonType}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" /> Updating…</>
              ) : (
                <><CheckCircle size={15} /> Confirm Packaged</>
              )}
            </button>
          </div>
          {!cartonType && (
            <p className="text-xs text-red-500 mt-2 text-center">
              {isAutoSelected
                ? "No carton type was selected in QC. Please select one above."
                : "Please select a carton type"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────
export function PackagingDashboard() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmJob, setConfirmJob] = useState<ProductionJob | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [packagingTypes, setPackagingTypes] = useState<Record<string, string>>({});
  const [selectedCartonType, setSelectedCartonType] = useState<string>("");
  const [isAutoSelected, setIsAutoSelected] = useState(false);

  const cartonTypes = ["RTI", "STI", "CLB", "SLB"];

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getPackagingJobs();
      setJobs(data);
      // Fetch packaging_type for each job from quotation_products
      if (data.length > 0) {
        const quotationIds = [...new Set(data.map(j => j.quotationId).filter(Boolean))];
        if (quotationIds.length > 0) {
          const { data: prods } = await supabase
            .from('quotation_products')
            .select('quotation_id, packaging_type')
            .in('quotation_id', quotationIds);
          if (prods) {
            const map: Record<string, string> = {};
            prods.forEach((p: any) => {
              if (p.packaging_type) map[p.quotation_id] = p.packaging_type;
            });
            setPackagingTypes(map);
          }
        }
      }
    } catch (e) {
      setError("Failed to load packaging jobs. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleConfirmPackaged = async () => {
    if (!confirmJob) return;
    if (!selectedCartonType) {
      alert("Please select a carton type.");
      return;
    }
    setProcessingId(confirmJob.id);
    try {
      // Update the job with carton type and status
      await api.markAsPackaged(confirmJob.id, selectedCartonType);
      setSuccessId(confirmJob.id);
      setConfirmJob(null);
      setSelectedCartonType("");
      setIsAutoSelected(false);
      // Remove from list after short delay
      setTimeout(() => {
        setJobs(prev => prev.filter(j => j.id !== confirmJob.id));
        setSuccessId(null);
        setProcessingId(null);
      }, 1800);
    } catch (e) {
      setError("Failed to mark as packaged. Please try again.");
      setProcessingId(null);
      setConfirmJob(null);
    }
  };

  const handleOpenConfirmModal = (job: ProductionJob) => {
    // Pre-fill carton type if available from QC
    const existingType = packagingTypes[job.quotationId] || "";
    setSelectedCartonType(existingType);
    setIsAutoSelected(!!existingType);
    setConfirmJob(job);
  };

  const kpis = [
    {
      label: "Awaiting Packaging",
      value: jobs.length,
      icon: <Box size={16} />,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Ready for Dispatch",
      value: "→",
      icon: <ChevronRight size={16} />,
      color: "text-purple-600 bg-purple-50",
      sub: "Goes to Dispatch tab",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Confirm Modal */}
      {confirmJob && (
        <ConfirmModal
          job={confirmJob}
          onConfirm={handleConfirmPackaged}
          onCancel={() => {
            setConfirmJob(null);
            setSelectedCartonType("");
            setIsAutoSelected(false);
          }}
          loading={!!processingId}
          cartonType={selectedCartonType}
          setCartonType={setSelectedCartonType}
          cartonTypes={cartonTypes}
          isAutoSelected={isAutoSelected}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900 text-xl font-bold">Packaging</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            QC-cleared production orders ready to be packed
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Workflow banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-xl p-4 flex items-center gap-3 text-white overflow-x-auto">
        {[
          { label: "QC Passed", color: "bg-green-500", done: true },
          { label: "Completed", color: "bg-blue-500", done: true },
          { label: "📦 Packaging", color: "bg-indigo-500 ring-2 ring-white", active: true },
          { label: "Dispatch", color: "bg-purple-500", done: false },
          { label: "Delivered", color: "bg-emerald-500", done: false },
        ].map((step, i, arr) => (
          <div key={step.label} className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${step.color}`} />
              <span className={`text-xs font-medium ${step.active ? "text-white" : "text-white/60"}`}>
                {step.label}
              </span>
            </div>
            {i < arr.length - 1 && <ChevronRight size={12} className="text-white/30 flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Box size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">{loading ? "–" : jobs.length}</p>
            <p className="text-xs text-slate-500 font-medium">Orders Awaiting Packaging</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
            <ClipboardCheck size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? "–" : jobs.reduce((s, j) => s + j.quantity, 0).toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 font-medium">Total Units to Pack</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Job List */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3">
          <Loader2 size={22} className="animate-spin text-slate-400" />
          <span className="text-sm text-slate-500">Loading packaging jobs…</span>
        </div>
      ) : jobs.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-14 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <Archive size={28} className="text-slate-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">No jobs ready for packaging</p>
            <p className="text-xs text-slate-400 mt-1">
              Orders will appear here once they pass QC and are marked Completed
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {jobs.map((job) => {
            const isSuccess = successId === job.id;
            const isProcessing = processingId === job.id;
            const existingCartonType = packagingTypes[job.quotationId] || "";
            const hasCartonType = !!existingCartonType;

            return (
              <div
                key={job.id}
                className={`bg-card border rounded-xl p-5 transition-all duration-300 ${isSuccess
                    ? "border-green-400 bg-green-50/50 shadow-md shadow-green-100"
                    : hasCartonType
                      ? "border-indigo-200 shadow-sm shadow-indigo-50"
                      : "border-border hover:shadow-sm"
                  }`}
              >
                {/* Job header */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Box size={16} className="text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-indigo-600 text-xs font-bold">{job.id}</span>
                      <span className={`inline-flex px-2 py-0.5 rounded border text-[10px] font-semibold ${statusConfig["Completed"].bg} ${statusConfig["Completed"].text} ${statusConfig["Completed"].border
                        }`}>
                        Completed
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${job.priority === "High"
                          ? "bg-red-50 text-red-600 border-red-200"
                          : job.priority === "Medium"
                            ? "bg-amber-50 text-amber-600 border-amber-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                        {job.priority}
                      </span>
                      {hasCartonType && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-green-50 text-green-700 border-green-200 font-medium">
                          ✓ Carton: {existingCartonType}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-900 text-sm font-semibold truncate">{job.product}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{job.customer}</p>
                  </div>
                </div>

                {/* Carton Type Display - Show if exists */}
                {existingCartonType && (
                  <div className="mb-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-green-600 flex items-center gap-1.5">
                      <CheckCircle size={12} /> Carton Type from QC
                    </span>
                    <span className="text-sm font-bold text-green-700">{existingCartonType}</span>
                  </div>
                )}

                {!existingCartonType && (
                  <div className="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-xs text-amber-600 flex items-center gap-1.5">
                      <AlertCircle size={12} /> No carton type selected in QC
                    </span>
                    <p className="text-[10px] text-amber-500 mt-0.5">
                      You'll need to select one when marking as packaged
                    </p>
                  </div>
                )}

                {/* Details grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Tag size={10} className="text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Quantity</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">{job.quantity.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <User size={10} className="text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Operator</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 truncate">{job.assignedTo}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar size={10} className="text-slate-400" />
                      <span className="text-[10px] text-slate-400 font-medium">Due</span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      {job.dueDate ? new Date(job.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                    </p>
                  </div>
                </div>

                {/* Value */}
                {job.value > 0 && (
                  <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-emerald-600">Order Value</span>
                    <span className="text-sm font-bold text-emerald-700">₹{job.value.toLocaleString()}</span>
                  </div>
                )}

                {/* Action */}
                {isSuccess ? (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-100 text-green-700 text-sm font-semibold">
                    <CheckCircle size={15} />
                    Marked as Packaged!
                  </div>
                ) : (
                  <button
                    onClick={() => handleOpenConfirmModal(job)}
                    disabled={isProcessing}
                    className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 ${hasCartonType
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                  >
                    {isProcessing ? (
                      <><Loader2 size={14} className="animate-spin" /> Processing…</>
                    ) : (
                      <>
                        <Package size={14} />
                        {hasCartonType ? "Mark as Packaged (Auto)" : "Mark as Packaged"}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info note */}
      {!loading && jobs.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-slate-400 pt-2">
          <Clock size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            Carton types are <strong className="text-green-600">auto-selected</strong> from the QC Post-Development Checklist.
            {Object.values(packagingTypes).filter(Boolean).length === 0 && (
              <span className="text-amber-600"> No carton types found — please ensure QC checklist was completed.</span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}