import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, Clock, AlertTriangle, Eye,
  X, RefreshCw, Plus, BarChart2, ShieldCheck,
  ChevronDown, AlertCircle, Package, Printer,
  ThumbsUp, ThumbsDown, RotateCcw, Search, Lock,
  UserX, ClipboardCheck, Check, FileCheck,
} from "lucide-react";
import {
  api,
  QualityCheck,
  QCJob,
  QCStats,
  CreateQualityCheckRequest,
  CurrentEmployee,
  PostDevChecklist,
  hasQCSubmitRole,
  hasQCApproveRole,
  supabase,
} from "../server/api";

// ─── Constants ────────────────────────────────────────────────
const RATINGS = ["Excellent", "Good", "Fair", "Poor", "NA"] as const;
const CHECK_TYPES = [
  "Pre-Press",
  "During Production",
  "Post Production",
  "Final",
] as const;
const DEFECT_TYPES = [
  "Color Mismatch", "Misregistration", "Hickeys / Spots",
  "Lamination Defect", "Cutting Error", "Barcode Issue",
  "Text Error", "Quantity Shortage", "Scratches / Scuffs",
  "Binding Defect", "Other",
];
const CHECKLIST = [
  { id: "color_accuracy", label: "Color density matches approved proof (±0.05 D)", category: "Color", field: "color_accuracy" },
  { id: "print_quality", label: "No visible hickeys, spots, or mottling", category: "Print Quality", field: "print_quality" },
  { id: "material_quality", label: "Material quality meets specification", category: "Material", field: "material_quality" },
  { id: "dimensional_accuracy", label: "Cutting/die size within ±0.5mm tolerance", category: "Dimensions", field: "dimensional_accuracy" },
  { id: "finishing_quality", label: "Lamination — no bubbles, wrinkles, or peeling", category: "Finishing", field: "finishing_quality" },
  { id: "binding_quality", label: "Binding quality meets specification", category: "Binding", field: "binding_quality" },
] as const;

const POST_DEV_CHECKLIST_ITEMS: {
  id: keyof Omit<PostDevChecklist, "checker_notes" | "carton_type">;
  label: string;
  category: string;
}[] = [
    { id: "client_approval_present", label: "Presence of Client Approval of Artwork", category: "Documentation" },
    { id: "punching_registration", label: "Check Punching Registration on every carton", category: "Registration" },
    { id: "printing_defects_check", label: "Check for printing defects (color consistency, registration, etc.)", category: "Print Quality" },
    { id: "finishing_correct", label: "Confirm correct finishing (lamination, varnish, foil, embossing)", category: "Finishing" },
    { id: "cutting_folding_binding", label: "Ensure proper cutting, folding, and binding (if applicable)", category: "Cutting" },
    { id: "product_count_verified", label: "Verify product count against job order", category: "Counting" },
    { id: "carton_pasting_direction", label: "Carton pasting direction", category: "Assembly" },
    { id: "alignment_precision", label: "Check alignment and precision of final trims", category: "Trimming" },
    { id: "excess_paper_removed", label: "Remove any excess paper or edges", category: "Cleanup" },
    { id: "clean_smooth_edges", label: "Ensure clean and smooth edges", category: "Finishing" },
    { id: "correct_labels_applied", label: "Apply correct labels (barcodes, batch numbers, job IDs)", category: "Labeling" },
    { id: "legal_compliance_markings", label: "Include necessary legal or compliance markings", category: "Compliance" },
  ];
const CARTON_TYPES = ["RTI", "STI", "CLB", "SLB"] as const;
const DEFAULT_CHECKLIST: PostDevChecklist = {
  client_approval_present: false,
  carton_type: "",
  punching_registration: false,
  printing_defects_check: false,
  finishing_correct: false,
  cutting_folding_binding: false,
  product_count_verified: false,
  carton_pasting_direction: false,
  alignment_precision: false,
  excess_paper_removed: false,
  clean_smooth_edges: false,
  correct_labels_applied: false,
  legal_compliance_markings: false,
  checker_notes: "",
};

const canSubmitQC = (role: string) => hasQCSubmitRole(role);
const canApproveQC = (role: string) => hasQCApproveRole(role);
const SUBMIT_ROLE_LABELS = ["Admin", "Supervisor", "QC", "Quality"];
const APPROVE_ROLE_LABELS = ["Admin", "Supervisor"];

// ─── Small UI helpers ─────────────────────────────────────────
function RatingBadge({ rating }: { rating: string }) {
  const map: Record<string, string> = {
    Excellent: "bg-green-100 text-green-700 border-green-200",
    Good: "bg-blue-100 text-blue-700 border-blue-200",
    Fair: "bg-amber-100 text-amber-700 border-amber-200",
    Poor: "bg-red-100 text-red-700 border-red-200",
    NA: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${map[rating] ?? map.NA}`}>
      {rating}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Passed: "bg-green-50 text-green-700 border-green-200",
    Failed: "bg-red-50 text-red-700 border-red-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Rework: "bg-orange-50 text-orange-700 border-orange-200",
    "Rework Required": "bg-orange-50 text-orange-700 border-orange-200",
    "Awaiting Approval": "bg-blue-50 text-blue-700 border-blue-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
  };
  const icons: Record<string, React.ReactNode> = {
    Passed: <CheckCircle size={11} />,
    Failed: <XCircle size={11} />,
    Pending: <Clock size={11} />,
    Rework: <RotateCcw size={11} />,
    "Rework Required": <RotateCcw size={11} />,
    "Awaiting Approval": <ShieldCheck size={11} />,
    Approved: <CheckCircle size={11} />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${map[status] ?? map.Pending}`}>
      {icons[status]} {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string }) {
  const r = role.toLowerCase();
  let style = "bg-slate-100 text-slate-600";
  if (r === "admin") style = "bg-red-100 text-red-700";
  else if (r === "supervisor") style = "bg-purple-100 text-purple-700";
  else if (r === "qc" || r === "quality" || r === "qc_team") style = "bg-blue-100 text-blue-700";
  else if (r === "sales" || r === "sales_executive") style = "bg-green-100 text-green-700";
  else if (r === "finance") style = "bg-orange-100 text-orange-700";
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${style}`}>
      {role}
    </span>
  );
}

function AccessDenied({ role, requiredRoles, action }: {
  role: string; requiredRoles: string[]; action: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
      <UserX size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-800">Access Restricted</p>
        <p className="text-xs text-red-700 mt-0.5">
          Your role <RoleBadge role={role} /> cannot {action}.
        </p>
        <p className="text-xs text-red-600 mt-1">
          Required:{" "}
          {requiredRoles.map((r) => (
            <span key={r} className="inline-flex mx-0.5 px-1.5 py-0.5 bg-red-100 rounded text-xs font-semibold">
              {r}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function RatingSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-7 py-1.5 text-xs border border-slate-200
          rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20
          focus:border-indigo-400 bg-white"
      >
        {RATINGS.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ─── Post Dev Checklist Panel ─────────────────────────────────
function PostDevChecklistPanel({
  checklist, onChange, readOnly = false,
}: {
  checklist: PostDevChecklist;
  onChange: (c: PostDevChecklist) => void;
  readOnly?: boolean;
}) {
  const completed = POST_DEV_CHECKLIST_ITEMS.filter((i) => checklist[i.id]).length + (checklist.carton_type ? 1 : 0);
  const total = POST_DEV_CHECKLIST_ITEMS.length + 1;
  const allDone = completed === total;
  const pct = Math.round((completed / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <ClipboardCheck size={14} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Post Press New Development Checklist</p>
            <p className="text-[10px] text-slate-400">All items must be verified before approval</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${allDone ? "text-green-600" : "text-amber-600"}`}>
            {completed}/{total}
          </span>
          {allDone && (
            <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-semibold">
              <Check size={10} /> Complete
            </span>
          )}
        </div>
      </div>

      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-green-500" : pct > 50 ? "bg-amber-500" : "bg-orange-400"
            }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Carton Type */}
      <div className={`flex items-center justify-between p-3 rounded-lg border transition-all ${checklist.carton_type ? "bg-green-50/50 border-green-200" : "bg-slate-50/50 border-slate-100"
        }`}>
        <div className="flex-1 min-w-0 mr-4">
          <p className="text-xs text-slate-700 font-medium">Carton Type (RTI, STI, CLB, SLB)</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Registration</p>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          {CARTON_TYPES.map((type) => (
            <button
              key={type}
              disabled={readOnly}
              onClick={() => onChange({ ...checklist, carton_type: checklist.carton_type === type ? "" : type })}
              className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-all ${checklist.carton_type === type
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                } ${readOnly ? "cursor-default opacity-70" : "cursor-pointer"}`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {POST_DEV_CHECKLIST_ITEMS.map((item, idx) => {
          const checked = checklist[item.id];
          return (
            <div
              key={item.id}
              onClick={() => { if (!readOnly) onChange({ ...checklist, [item.id]: !checked }); }}
              className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${checked
                  ? "bg-green-50/50 border-green-200"
                  : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50/50"
                } ${readOnly ? "cursor-default" : "cursor-pointer"}`}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition-all ${checked ? "bg-green-500 border-green-500 text-white" : "bg-white border-slate-300"
                }`}>
                {checked && <Check size={12} strokeWidth={3} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs leading-relaxed ${checked ? "text-green-800" : "text-slate-700"}`}>
                  <span className="text-slate-400 font-mono text-[10px] mr-1.5">{idx + 1}.</span>
                  {item.label}
                </p>
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 ${checked ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                }`}>
                {item.category}
              </span>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div>
          <label className="block text-xs text-slate-600 mb-1 font-medium">Checker Notes (optional)</label>
          <textarea
            value={checklist.checker_notes}
            onChange={(e) => onChange({ ...checklist, checker_notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg
              resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400"
            placeholder="Any observations during checklist verification..."
          />
        </div>
      )}
      {readOnly && checklist.checker_notes && (
        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-lg">
          <p className="text-[10px] text-slate-400 mb-0.5 font-semibold">Checker Notes</p>
          <p className="text-xs text-slate-600">{checklist.checker_notes}</p>
        </div>
      )}
    </div>
  );
}

// ─── QC History for a job ─────────────────────────────────────
function QCHistoryPanel({ jobId, jobType }: { jobId: string; jobType: "Production" | "Sample" }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const col = jobType === "Production" ? "production_order_id" : "sample_order_id";
    supabase
      .from("quality_checks")
      .select("qc_id, qc_cycle, overall_status, workflow_status, checked_by_emp:checked_by(full_name), created_at, rework_required, approved_for_dispatch")
      .eq(col, jobId)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setHistory(data || []);
        setLoading(false);
      });
  }, [jobId, jobType]);

  if (loading) return <p className="text-xs text-slate-400 py-2">Loading history...</p>;
  if (history.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-slate-700 mb-2">QC Cycle History</p>
      <div className="space-y-1.5">
        {history.map((h) => (
          <div key={h.qc_id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg border border-slate-100 text-xs">
            <span className="text-indigo-600 font-bold">Cycle {h.qc_cycle}</span>
            <StatusBadge status={h.approved_for_dispatch ? "Approved" : h.overall_status} />
            <span className="text-slate-500">{h.checked_by_emp?.full_name || "Unknown"}</span>
            <span className="text-slate-400 ml-auto">
              {new Date(h.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New QC Modal ─────────────────────────────────────────────
interface NewQCModalProps {
  jobs: QCJob[];
  preSelectedOrderId?: string;
  currentEmployee: CurrentEmployee | null;
  onClose: () => void;
  onSubmit: (payload: CreateQualityCheckRequest) => Promise<void>;
}

function NewQCModal({ jobs, preSelectedOrderId = "", currentEmployee, onClose, onSubmit }: NewQCModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateQualityCheckRequest & { job_type?: "Production" | "Sample" }>({
    production_order_id: preSelectedOrderId,
    job_type: jobs.find((j) => j.order_id === preSelectedOrderId)?.job_type || "Production",
    check_type: "Post Production",
    color_accuracy: "Good",
    print_quality: "Good",
    binding_quality: "Good",
    material_quality: "Good",
    dimensional_accuracy: "Good",
    finishing_quality: "Good",
    overall_status: "Pending",
    defect_quantity: 0,
    rework_required: false,
  });

  const userRole = currentEmployee?.role || "";
  const hasSubmitPerm = canSubmitQC(userRole);

  // Auto-calculate overall status
  useEffect(() => {
    const ratings = [
      form.color_accuracy, form.print_quality,
      form.material_quality, form.dimensional_accuracy,
      form.finishing_quality,
    ];
    const hasPoor = ratings.some((r) => r === "Poor");
    const hasFair = ratings.some((r) => r === "Fair");
    setForm((f) => ({
      ...f,
      overall_status: hasPoor ? "Failed" : hasFair ? "Pending" : "Passed",
    }));
  }, [
    form.color_accuracy, form.print_quality,
    form.material_quality, form.dimensional_accuracy,
    form.finishing_quality,
  ]);

  const handleSubmit = async () => {
    if (!form.production_order_id) { setSubmitError("Please select a job"); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (e: any) {
      setSubmitError(e?.message || "Failed to submit QC report");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedJob = jobs.find((j) => j.order_id === form.production_order_id);
  const selectedJobHasActiveQC = selectedJob?.hasActiveQC ?? false;
  const selectedJobQCStatus = selectedJob?.activeQCStatus;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-slate-900 text-sm font-bold">QC Inspection Report</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-slate-400 text-xs">Inspector submits · Supervisor approves separately</p>
              {currentEmployee && <RoleBadge role={currentEmployee.role} />}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {!hasSubmitPerm && (
            <AccessDenied role={userRole} requiredRoles={SUBMIT_ROLE_LABELS} action="submit QC inspection reports" />
          )}

          {submitError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">{submitError}</p>
            </div>
          )}

          {hasSubmitPerm && (
            <>
              {/* Job Select */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Select Job *
                </label>
                <div className="relative">
                  <select
                    value={form.production_order_id}
                    onChange={(e) => {
                      setSubmitError(null);
                      const selected = jobs.find((j) => j.order_id === e.target.value);
                      setForm((f) => ({
                        ...f,
                        production_order_id: e.target.value,
                        job_type: selected?.job_type,
                      }));
                    }}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200
                      rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20
                      focus:border-indigo-400 bg-white"
                  >
                    <option value="">Select job...</option>
                    {jobs.map((j) => (
                      <option key={j.order_id} value={j.order_id} disabled={j.hasActiveQC}>
                        {j.order_id} ({j.job_type}) — {j.customer_name} · {j.product_name}
                        {j.qc_cycle > 0 ? ` [Cycle ${j.qc_cycle + 1}]` : ""}
                        {j.hasActiveQC ? ` 🔒 ${j.activeQCStatus}` : ""}
                        {j.rework_count > 0 ? ` ↩ ${j.rework_count}x rework` : ""}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {/* Rework info banner */}
              {selectedJob && selectedJob.rework_count > 0 && !selectedJobHasActiveQC && (
                <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <RotateCcw size={15} className="text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-orange-800">
                      Rework Inspection — Cycle {(selectedJob.qc_cycle || 0) + 1}
                    </p>
                    <p className="text-xs text-orange-700 mt-0.5">
                      This job has been reworked {selectedJob.rework_count} time(s).
                      This QC report will be cycle {(selectedJob.qc_cycle || 0) + 1}.
                    </p>
                  </div>
                </div>
              )}

              {/* Locked */}
              {selectedJobHasActiveQC && (
                <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Lock size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-800">
                      QC Already Submitted — {selectedJobQCStatus}
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      {selectedJobQCStatus === "Awaiting Approval"
                        ? "This job's QC report is awaiting supervisor approval."
                        : "This job has already been approved."}
                    </p>
                  </div>
                </div>
              )}

              {/* Job info */}
              {selectedJob && !selectedJobHasActiveQC && (
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-indigo-400 mb-0.5">Customer</p>
                    <p className="text-indigo-800 font-semibold">{selectedJob.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-indigo-400 mb-0.5">Product</p>
                    <p className="text-indigo-800 font-semibold truncate">{selectedJob.product_name}</p>
                  </div>
                  <div>
                    <p className="text-indigo-400 mb-0.5">Quantity</p>
                    <p className="text-indigo-800 font-semibold">{selectedJob.final_quantity.toLocaleString()} pcs</p>
                  </div>
                </div>
              )}

              {/* Show QC history inline */}
              {selectedJob && !selectedJobHasActiveQC && selectedJob.qc_cycle > 0 && (
                <QCHistoryPanel jobId={selectedJob.order_id} jobType={selectedJob.job_type} />
              )}

              {/* Form */}
              {!selectedJobHasActiveQC && (
                <>
                  {/* Check Type */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Check Type</label>
                    <div className="flex flex-wrap gap-2">
                      {CHECK_TYPES.map((type) => (
                        <button
                          key={type}
                          onClick={() => setForm((f) => ({ ...f, check_type: type }))}
                          className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${form.check_type === type
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                            }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Quality Ratings */}
                  <div>
                    <p className="text-xs font-medium text-slate-700 mb-3">Quality Ratings</p>
                    <div className="space-y-2">
                      {CHECKLIST.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50"
                        >
                          <div className="flex-1 min-w-0 mr-4">
                            <p className="text-xs text-slate-700 leading-relaxed">{item.label}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                          </div>
                          <div className="w-32 flex-shrink-0">
                            <RatingSelect
                              value={(form as any)[item.field] || "Good"}
                              onChange={(v) => setForm((f) => ({ ...f, [item.field]: v }))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Auto-calculated result */}
                  <div className={`flex items-center justify-between p-3 rounded-lg border ${form.overall_status === "Passed"
                      ? "bg-green-50 border-green-200"
                      : form.overall_status === "Failed"
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200"
                    }`}>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Auto-calculated Result</p>
                      {form.overall_status === "Passed" && (
                        <p className="text-[10px] text-green-600 font-medium mt-0.5">
                          ✓ Will go to Supervisor for {selectedJob?.job_type === "Sample" ? "sample approval" : "dispatch approval"}
                        </p>
                      )}
                      {form.overall_status === "Failed" && (
                        <p className="text-xs text-red-600 mt-0.5">
                          ✗ Job will be sent back to machine operator for rework
                        </p>
                      )}
                    </div>
                    <StatusBadge status={form.overall_status} />
                  </div>

                  {/* Defects */}
                  {form.overall_status === "Failed" && (
                    <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs font-semibold text-red-800">Defect Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Defect Type</label>
                          <div className="relative">
                            <select
                              value={form.defect_type || ""}
                              onChange={(e) => setForm((f) => ({ ...f, defect_type: e.target.value }))}
                              className="w-full appearance-none pl-3 pr-7 py-1.5 text-xs border
                                border-slate-200 rounded-lg bg-white focus:outline-none"
                            >
                              <option value="">Select type...</option>
                              {DEFECT_TYPES.map((d) => <option key={d}>{d}</option>)}
                            </select>
                            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Defect Quantity</label>
                          <input
                            type="number" min="0"
                            value={form.defect_quantity || 0}
                            onChange={(e) => setForm((f) => ({ ...f, defect_quantity: parseInt(e.target.value) || 0 }))}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Defect Description *</label>
                        <textarea
                          value={form.defect_description || ""}
                          onChange={(e) => setForm((f) => ({ ...f, defect_description: e.target.value }))}
                          rows={2}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none"
                          placeholder="Describe the defects found..."
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.rework_required || false}
                          onChange={(e) => setForm((f) => ({ ...f, rework_required: e.target.checked }))}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600"
                        />
                        <span className="text-xs font-medium text-slate-700">Rework Required</span>
                      </label>
                      {form.rework_required && (
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Rework Instructions for Operator</label>
                          <textarea
                            value={form.rework_description || ""}
                            onChange={(e) => setForm((f) => ({ ...f, rework_description: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg resize-none focus:outline-none"
                            placeholder="Tell the operator exactly what needs to be fixed..."
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {form.overall_status === "Passed" && (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                      <ShieldCheck size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-800">Supervisor / Admin Approval Required</p>
                        <p className="text-xs text-blue-600 mt-0.5">
                          This report will be saved as Passed. A Supervisor or Admin must still review
                          and {selectedJob?.job_type === "Sample" ? "approve the sample" : "approve for dispatch"}.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">Inspector Notes</label>
                    <textarea
                      value={form.notes || ""}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg resize-none
                        focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                      placeholder="Add any additional notes..."
                    />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-100">
          <button
            onClick={handleSubmit}
            disabled={submitting || !form.production_order_id || selectedJobHasActiveQC || !hasSubmitPerm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white
              bg-indigo-600 hover:bg-indigo-700 transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? "Submitting..."
              : !hasSubmitPerm
                ? "No Permission"
                : selectedJobHasActiveQC
                  ? "QC Already Submitted"
                  : "Submit QC Report"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-600
              bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QC Detail Modal ──────────────────────────────────────────
interface QCDetailModalProps {
  qc: QualityCheck;
  currentEmployee: CurrentEmployee | null;
  onClose: () => void;
  onApprove: (id: number, notes?: string, checklist?: PostDevChecklist) => Promise<void>;
  onReject: (id: number, desc: string, rework: boolean, reworkDesc?: string) => Promise<void>;
}

function QCDetailModal({ qc, currentEmployee, onClose, onApprove, onReject }: QCDetailModalProps) {
  const [action, setAction] = useState<"" | "approve" | "reject">("");
  const [notes, setNotes] = useState("");
  const [defectDesc, setDefectDesc] = useState(qc.defect_description || "");
  const [rework, setRework] = useState(qc.rework_required);
  const [reworkDesc, setReworkDesc] = useState(qc.rework_description || "");
  const [submitting, setSubmitting] = useState(false);
  const [checklist, setChecklist] = useState<PostDevChecklist>(
    qc.post_dev_checklist || { ...DEFAULT_CHECKLIST }
  );
  const [showChecklist, setShowChecklist] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const userRole = currentEmployee?.role || "";
  const hasApprovePerm = canApproveQC(userRole);

  // Can act = report is Passed and NOT yet approved
  const canAct = qc.overall_status === "Passed" && !qc.approved_for_dispatch;

  const checklistDone =
    POST_DEV_CHECKLIST_ITEMS.filter((i) => checklist[i.id]).length +
    (checklist.carton_type ? 1 : 0) ===
    POST_DEV_CHECKLIST_ITEMS.length + 1;

  const handleAction = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      if (action === "approve") {
        await onApprove(qc.qc_id, notes, checklist);
      } else if (action === "reject") {
        if (!defectDesc.trim()) { setActionError("Please enter a rejection reason"); setSubmitting(false); return; }
        await onReject(qc.qc_id, defectDesc, rework, reworkDesc);
      }
      onClose();
    } catch (e: any) {
      setActionError(e?.message || "Action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const ratings = [
    { label: "Color Accuracy", value: qc.color_accuracy },
    { label: "Print Quality", value: qc.print_quality },
    { label: "Material Quality", value: qc.material_quality },
    { label: "Dimensional Accuracy", value: qc.dimensional_accuracy },
    { label: "Finishing Quality", value: qc.finishing_quality },
    { label: "Binding Quality", value: qc.binding_quality },
  ];

  const isSample = !!qc.sample_order_id;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-slate-900 text-sm font-bold">QC Report #{qc.qc_id}</h2>
              {qc.qc_cycle > 1 && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                  Cycle {qc.qc_cycle}
                </span>
              )}
              {isSample && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                  Sample
                </span>
              )}
              <StatusBadge status={
                qc.approved_for_dispatch ? "Approved" :
                  qc.overall_status === "Passed" ? "Awaiting Approval" :
                    qc.overall_status
              } />
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              {qc.sample_order_id || qc.production_order_id} · {qc.customer_name}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Job info */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ["Product", qc.product_name],
              ["Customer", qc.customer_name],
              ["Check Type", qc.check_type],
              ["Quantity", `${qc.quantity.toLocaleString()} pcs`],
              ["Inspector", qc.checked_by_name],
              ["Check Date", new Date(qc.check_date).toLocaleDateString("en-IN")],
            ].map(([l, v]) => (
              <div key={l} className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-slate-400 mb-0.5">{l}</p>
                <p className="text-slate-800 font-semibold truncate">{v}</p>
              </div>
            ))}
          </div>

          {/* Ratings */}
          <div>
            <p className="text-xs font-semibold text-slate-700 mb-2">Quality Ratings</p>
            <div className="grid grid-cols-2 gap-2">
              {ratings.map((r) => (
                <div key={r.label} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="text-xs text-slate-600">{r.label}</span>
                  <RatingBadge rating={r.value} />
                </div>
              ))}
            </div>
          </div>

          {/* Defects */}
          {(qc.defect_description || qc.defect_quantity > 0) && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg space-y-1.5">
              <p className="text-xs font-semibold text-red-800">Defects Found</p>
              {qc.defect_type && (
                <p className="text-xs text-red-700">Type: <span className="font-medium">{qc.defect_type}</span></p>
              )}
              {qc.defect_quantity > 0 && (
                <p className="text-xs text-red-700">Quantity: <span className="font-medium">{qc.defect_quantity} pcs</span></p>
              )}
              {qc.defect_description && (
                <p className="text-xs text-red-700">{qc.defect_description}</p>
              )}
            </div>
          )}

          {/* Rework instructions */}
          {qc.rework_required && qc.rework_description && (
            <div className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
              <p className="text-xs font-semibold text-orange-800 mb-1">🔧 Rework Instructions</p>
              <p className="text-xs text-orange-700 whitespace-pre-wrap">{qc.rework_description}</p>
            </div>
          )}

          {/* Notes */}
          {qc.notes && (
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
              <p className="text-xs font-semibold text-slate-700 mb-1">Inspector Notes</p>
              <p className="text-xs text-slate-600">{qc.notes}</p>
            </div>
          )}

          {/* QC Cycle History */}
          {(qc.sample_order_id || qc.production_order_id) && (
            <QCHistoryPanel
              jobId={qc.sample_order_id || qc.production_order_id}
              jobType={qc.sample_order_id ? "Sample" : "Production"}
            />
          )}

          {/* Error */}
          {actionError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-medium">{actionError}</p>
            </div>
          )}

          {/* Supervisor Action Area */}
          {canAct && (
            <>
              {!hasApprovePerm ? (
                <AccessDenied
                  role={userRole}
                  requiredRoles={APPROVE_ROLE_LABELS}
                  action="approve or reject QC reports"
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <ShieldCheck size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                      Inspector <span className="font-semibold text-slate-900">{qc.checked_by_name}</span> marked
                      this job as Passed. Review ratings and{" "}
                      {isSample ? "approve the sample" : "approve for dispatch"} or send back for rework.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setAction("approve"); setActionError(null); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                        text-sm transition-all font-semibold ${action === "approve"
                          ? "bg-green-600 text-white"
                          : "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100"
                        }`}
                    >
                      <ThumbsUp size={15} />
                      {isSample ? "Approve Sample" : "Approve for Dispatch"}
                    </button>
                    <button
                      onClick={() => { setAction("reject"); setActionError(null); }}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                        text-sm transition-all font-semibold ${action === "reject"
                          ? "bg-red-600 text-white"
                          : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        }`}
                    >
                      <ThumbsDown size={15} /> Reject & Rework
                    </button>
                  </div>

                  {/* Approve form */}
                  {action === "approve" && (
                    <div className="space-y-4">
                      <div className={`p-4 rounded-xl border-2 transition-all ${checklistDone
                          ? "border-green-200 bg-green-50/30"
                          : "border-amber-200 bg-amber-50/30"
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                          <button
                            onClick={() => setShowChecklist(!showChecklist)}
                            className="flex items-center gap-2 text-left"
                          >
                            <FileCheck size={16} className={checklistDone ? "text-green-600" : "text-amber-600"} />
                            <div>
                              <p className="text-xs font-bold text-slate-800">
                                Post Press Development Checklist
                                {!checklistDone && <span className="text-red-500 ml-1">*</span>}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {checklistDone
                                  ? "All items verified — ready to approve"
                                  : "Complete all items to approve"}
                              </p>
                            </div>
                          </button>
                          <button
                            onClick={() => setShowChecklist(!showChecklist)}
                            className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-all ${showChecklist
                                ? "bg-slate-800 text-white border-slate-800"
                                : checklistDone
                                  ? "bg-green-100 text-green-700 border-green-200"
                                  : "bg-amber-100 text-amber-700 border-amber-200"
                              }`}
                          >
                            {showChecklist ? "Collapse" : checklistDone ? "Review" : "Open Checklist"}
                          </button>
                        </div>
                        {showChecklist && (
                          <PostDevChecklistPanel
                            checklist={checklist}
                            onChange={setChecklist}
                            readOnly={false}
                          />
                        )}
                        {!showChecklist && !checklistDone && (
                          <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <AlertCircle size={13} className="text-amber-500 flex-shrink-0" />
                            <p className="text-[11px] text-amber-700">
                              You must complete the checklist before approving.
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Approval Notes (optional)</label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg
                            resize-none focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
                          placeholder="Add approval notes..."
                        />
                      </div>
                    </div>
                  )}

                  {/* Reject form */}
                  {action === "reject" && (
                    <div className="space-y-3 p-4 bg-red-50 border border-red-100 rounded-lg">
                      <p className="text-xs font-semibold text-red-800">Rejection Details</p>
                      <div>
                        <label className="block text-xs text-slate-600 mb-1">Rejection Reason *</label>
                        <textarea
                          value={defectDesc}
                          onChange={(e) => setDefectDesc(e.target.value)}
                          rows={2}
                          className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg
                            resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                          placeholder="Describe the issues that need to be corrected..."
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rework}
                          onChange={(e) => setRework(e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className="text-xs text-slate-700 font-medium">Rework Required</span>
                      </label>
                      {rework && (
                        <div>
                          <label className="block text-xs text-slate-600 mb-1">Rework Instructions for Operator</label>
                          <textarea
                            value={reworkDesc}
                            onChange={(e) => setReworkDesc(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg
                              resize-none focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-400"
                            placeholder="Tell the operator exactly what needs to be fixed and how..."
                          />
                        </div>
                      )}
                      <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                        <p className="text-[11px] text-orange-700">
                          ⚠️ The machine operator will immediately see this rejection with your instructions.
                          The job status will change to <strong>Rework Required</strong>.
                        </p>
                      </div>
                    </div>
                  )}

                  {action && (
                    <button
                      onClick={handleAction}
                      disabled={
                        submitting ||
                        (action === "approve" && !checklistDone) ||
                        (action === "reject" && !defectDesc.trim())
                      }
                      className={`w-full py-2.5 rounded-xl text-sm font-semibold text-white
                        transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action === "approve" && !checklistDone
                          ? "bg-amber-500 hover:bg-amber-600"
                          : action === "approve"
                            ? "bg-green-600 hover:bg-green-700"
                            : "bg-red-600 hover:bg-red-700"
                        }`}
                    >
                      {submitting
                        ? "Processing..."
                        : action === "approve" && !checklistDone
                          ? "Complete Checklist First"
                          : action === "approve"
                            ? isSample ? "✓ Approve Sample" : "✓ Approve for Dispatch"
                            : "✗ Confirm Rejection & Send for Rework"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}

          {/* Already approved */}
          {qc.approved_for_dispatch && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-green-800">
                    {isSample ? "Sample Approved" : "Approved for Dispatch"}
                  </p>
                  {qc.approved_by_name && (
                    <p className="text-xs text-green-700">Approved by {qc.approved_by_name}</p>
                  )}
                  {qc.approved_date && (
                    <p className="text-xs text-green-600">
                      {new Date(qc.approved_date).toLocaleDateString("en-IN")}
                    </p>
                  )}
                </div>
              </div>
              {qc.post_dev_checklist && (
                <div className="p-4 bg-green-50/30 border border-green-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <FileCheck size={14} className="text-green-600" />
                    <p className="text-xs font-bold text-green-800">Post Press Checklist ✓ Verified</p>
                  </div>
                  <PostDevChecklistPanel
                    checklist={qc.post_dev_checklist}
                    onChange={() => { }}
                    readOnly={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Failed */}
          {qc.overall_status === "Failed" && !canAct && !qc.approved_for_dispatch && (
            <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
              <XCircle size={18} className="text-red-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-red-800">QC Failed — Sent for Rework</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Job has been sent back to the machine operator for rework.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function QualityControl() {
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [jobs, setJobs] = useState<QCJob[]>([]);
  const [stats, setStats] = useState<QCStats>({
    pending: 0, passed: 0, failed: 0, rework: 0, approvalRate: 0, awaitingApproval: 0,
  });
  const [currentEmployee, setCurrentEmployee] = useState<CurrentEmployee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedQC, setSelectedQC] = useState<QualityCheck | null>(null);
  const [preSelectedPO, setPreSelectedPO] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [checksData, jobsData, statsData, empData] = await Promise.allSettled([
        api.getQualityChecks(),
        api.getJobsForQC(),
        api.getQCStats(),
        api.getCurrentEmployee(),
      ]);
      if (checksData.status === "fulfilled") setChecks(checksData.value);
      if (jobsData.status === "fulfilled") setJobs(jobsData.value);
      if (statsData.status === "fulfilled") setStats(statsData.value);
      if (empData.status === "fulfilled") setCurrentEmployee(empData.value);
    } catch {
      setError("Failed to load QC data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time updates
  useEffect(() => {
    const channel = supabase
      .channel("qc_realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "quality_checks",
      }, () => { loadData(); })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "production_orders",
      }, () => { loadData(); })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "sample_orders",
      }, () => { loadData(); })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [loadData]);

  const handleCreate = async (payload: CreateQualityCheckRequest) => {
    await api.createQualityCheck(payload);
    await loadData();
  };

  const handleApprove = async (id: number, notes?: string, checklist?: PostDevChecklist) => {
    // Save the full checklist including carton_type
    await api.approveQualityCheck(id, notes, checklist);
    await loadData();
  };

  const handleReject = async (id: number, desc: string, rework: boolean, reworkDesc?: string) => {
    await api.rejectQualityCheck(id, desc, rework, reworkDesc);
    await loadData();
  };

  const openNewModal = (preSelectId = "") => {
    setPreSelectedPO(preSelectId);
    setShowNewModal(true);
  };

  const filtered = checks.filter((qc) => {
    const s = search.toLowerCase();
    const matchesSearch =
      search === "" ||
      (qc.sample_order_id || qc.production_order_id || "").toLowerCase().includes(s) ||
      (qc.customer_name || "").toLowerCase().includes(s) ||
      (qc.product_name || "").toLowerCase().includes(s);

    let matchStatus = true;
    if (statusFilter === "Awaiting Approval") {
      matchStatus = qc.overall_status === "Passed" && !qc.approved_for_dispatch;
    } else if (statusFilter === "Approved") {
      matchStatus = qc.approved_for_dispatch === true;
    } else if (statusFilter !== "All") {
      matchStatus = qc.overall_status === statusFilter;
    }
    return matchesSearch && matchStatus;
  });

  const userRole = currentEmployee?.role || "";
  const hasSubmitPerm = canSubmitQC(userRole);
  const hasApprovePerm = canApproveQC(userRole);

  const pendingJobs = jobs.filter((j) => j.status === "QC Pending" && !j.hasActiveQC);
  const awaitingApprovalChecks = checks.filter(
    (qc) => qc.overall_status === "Passed" && !qc.approved_for_dispatch
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading QC data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">

      {/* Modals */}
      {showNewModal && (
        <NewQCModal
          jobs={jobs}
          preSelectedOrderId={preSelectedPO}
          currentEmployee={currentEmployee}
          onClose={() => { setShowNewModal(false); setPreSelectedPO(""); }}
          onSubmit={handleCreate}
        />
      )}
      {selectedQC && (
        <QCDetailModal
          qc={selectedQC}
          currentEmployee={currentEmployee}
          onClose={() => setSelectedQC(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-slate-900 text-xl font-bold">Quality Control</h1>
            {currentEmployee && <RoleBadge role={currentEmployee.role} />}
          </div>
          <p className="text-slate-500 text-sm mt-0.5">
            {stats.pending} pending · {stats.awaitingApproval} awaiting approval · {stats.approvalRate}% approval rate
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200
              rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          {hasSubmitPerm && (
            <button
              onClick={() => openNewModal()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600
                text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              <Plus size={12} /> New QC Check
            </button>
          )}
        </div>
      </div>

      {/* Role Banner */}
      {currentEmployee && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs ${hasApprovePerm
            ? "bg-purple-50 border-purple-200 text-purple-800"
            : hasSubmitPerm
              ? "bg-blue-50 border-blue-200 text-blue-800"
              : "bg-slate-50 border-slate-200 text-slate-700"
          }`}>
          <ShieldCheck size={14} className="flex-shrink-0" />
          <div>
            <span className="font-semibold">{currentEmployee.full_name}</span>
            {" · "}
            <RoleBadge role={currentEmployee.role} />
            {" — "}
            {hasApprovePerm
              ? "You can submit QC reports AND approve / reject them."
              : hasSubmitPerm
                ? "You can submit QC reports. A Supervisor or Admin will approve."
                : "You have view-only access to QC records."}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: "Pending Inspection", value: stats.pending, icon: <Clock size={15} />, color: "text-amber-600 bg-amber-50", border: "border-amber-100" },
          { label: "Awaiting Approval", value: stats.awaitingApproval, icon: <ShieldCheck size={15} />, color: "text-blue-600 bg-blue-50", border: "border-blue-100" },
          { label: "Approved (MTD)", value: stats.passed, icon: <CheckCircle size={15} />, color: "text-green-600 bg-green-50", border: "border-green-100" },
          { label: "Failed (MTD)", value: stats.failed, icon: <XCircle size={15} />, color: "text-red-600 bg-red-50", border: "border-red-100" },
          { label: "Rework Required", value: stats.rework, icon: <RotateCcw size={15} />, color: "text-orange-600 bg-orange-50", border: "border-orange-100" },
          { label: "Approval Rate", value: `${stats.approvalRate}%`, icon: <ShieldCheck size={15} />, color: "text-indigo-600 bg-indigo-50", border: "border-indigo-100" },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-xl border ${s.border} p-4 shadow-sm`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              {s.icon}
            </div>
            <p className="text-slate-900 text-xl font-bold">{s.value}</p>
            <p className="text-slate-500 text-xs mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Step 1 — Pending Inspections */}
      {hasSubmitPerm && pendingJobs.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-amber-100 bg-amber-50/50">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <div>
                <h3 className="text-slate-900 text-sm font-semibold">Step 1 — Pending QC Inspection</h3>
                <p className="text-slate-400 text-xs">Jobs waiting for inspector to submit QC ratings</p>
              </div>
            </div>
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
              {pendingJobs.length} jobs
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {pendingJobs.map((po) => (
              <div key={po.order_id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Package size={15} className="text-amber-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                        {po.job_type}
                      </span>
                      <p className="text-indigo-600 text-xs font-bold">{po.order_id}</p>
                      {po.rework_count > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                          ↩ Rework #{po.rework_count}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 text-sm font-semibold truncate">{po.product_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-slate-500 text-xs">{po.customer_name}</p>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Printer size={10} /> {po.printing_technology}
                      </span>
                      <span className="text-xs text-slate-400">
                        {po.final_quantity.toLocaleString()} pcs
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => openNewModal(po.order_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-indigo-600
                    border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors
                    font-medium flex-shrink-0"
                >
                  <Eye size={12} />
                  {po.rework_count > 0 ? "Inspect Rework" : "Start Inspection"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2 — Awaiting Approval */}
      {hasApprovePerm && awaitingApprovalChecks.length > 0 && (
        <div className="bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100 bg-blue-50/50">
            <div className="flex items-center gap-2">
              <ShieldCheck size={15} className="text-blue-500" />
              <div>
                <h3 className="text-slate-900 text-sm font-semibold">Step 2 — Awaiting Your Approval</h3>
                <p className="text-slate-400 text-xs">
                  QC passed — you ({currentEmployee?.role}) must approve
                </p>
              </div>
            </div>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              {awaitingApprovalChecks.length} reports
            </span>
          </div>
          <div className="divide-y divide-slate-50">
            {awaitingApprovalChecks.map((qc) => (
              <div key={qc.qc_id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={15} className="text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <p className="text-indigo-600 text-xs font-bold">QC #{qc.qc_id}</p>
                      <span className="text-slate-300">·</span>
                      <p className="text-slate-500 text-xs">{qc.sample_order_id || qc.production_order_id}</p>
                      {qc.qc_cycle > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                          Cycle {qc.qc_cycle}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-800 text-sm font-semibold truncate">{qc.product_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <p className="text-slate-500 text-xs">{qc.customer_name}</p>
                      <span className="text-xs text-slate-400">by {qc.checked_by_name}</span>
                      <span className="text-xs text-green-600 font-medium">All ratings ✓</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedQC(qc)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600
                    border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors
                    font-medium flex-shrink-0"
                >
                  <Eye size={12} /> Review & Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info for non-approve roles */}
      {!hasApprovePerm && awaitingApprovalChecks.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <ShieldCheck size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            <span className="font-semibold">{awaitingApprovalChecks.length} QC report(s)</span> are
            awaiting approval by a Supervisor or Admin.
            Your role ({currentEmployee?.role}) cannot approve.
          </p>
        </div>
      )}

      {/* QC History Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-wrap gap-3">
          <h3 className="text-slate-900 text-sm font-semibold">QC History</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1">
              {["All", "Awaiting Approval", "Approved", "Failed", "Pending"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-colors ${statusFilter === s
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="pl-7 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-36
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <BarChart2 size={36} className="text-slate-200 mb-3" />
            <p className="text-sm font-medium text-slate-500">No QC records found</p>
            <p className="text-xs text-slate-400 mt-1">
              {checks.length === 0
                ? "Submit your first QC inspection to see records here"
                : "Try adjusting your search or filter"}
            </p>
            {checks.length === 0 && hasSubmitPerm && (
              <button
                onClick={() => openNewModal()}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 text-xs bg-indigo-600
                  text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                <Plus size={12} /> New QC Check
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[
                    "QC ID", "Cycle", "Job", "Customer", "Product",
                    "Check Type", "Inspector", "Date",
                    "Color", "Print", "Material", "Dimensions",
                    "QC Result", "Supervisor", "Actions",
                  ].map((h) => (
                    <th key={h} className="text-left text-xs text-slate-400 px-4 py-2.5 whitespace-nowrap font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((qc) => (
                  <tr key={qc.qc_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-indigo-600 text-xs font-bold">#{qc.qc_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${qc.qc_cycle > 1
                          ? "bg-orange-100 text-orange-700"
                          : "bg-slate-100 text-slate-500"
                        }`}>
                        {qc.qc_cycle}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono text-slate-700 font-medium">
                          {qc.sample_order_id || qc.production_order_id}
                        </span>
                        {qc.sample_order_id && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                            Sample
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 whitespace-nowrap">{qc.customer_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-700 font-medium truncate max-w-[120px] block">
                        {qc.product_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 whitespace-nowrap">{qc.check_type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-600 whitespace-nowrap">{qc.checked_by_name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(qc.check_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      </span>
                    </td>
                    <td className="px-4 py-3"><RatingBadge rating={qc.color_accuracy} /></td>
                    <td className="px-4 py-3"><RatingBadge rating={qc.print_quality} /></td>
                    <td className="px-4 py-3"><RatingBadge rating={qc.material_quality} /></td>
                    <td className="px-4 py-3"><RatingBadge rating={qc.dimensional_accuracy} /></td>
                    <td className="px-4 py-3">
                      <StatusBadge status={
                        qc.approved_for_dispatch ? "Approved" :
                          qc.overall_status === "Passed" ? "Awaiting Approval" :
                            qc.overall_status
                      } />
                    </td>
                    <td className="px-4 py-3">
                      {qc.approved_for_dispatch ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                          <CheckCircle size={11} /> {qc.approved_by_name || "Approved"}
                        </span>
                      ) : qc.overall_status === "Passed" ? (
                        <span className="text-xs text-blue-500 font-medium">Pending review</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelectedQC(qc)}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-slate-100
                          text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                      >
                        <Eye size={11} />
                        {qc.overall_status === "Passed" && !qc.approved_for_dispatch && hasApprovePerm
                          ? "Approve"
                          : "View"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}//qc