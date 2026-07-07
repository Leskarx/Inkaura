import { useState, useEffect, useCallback } from "react";
import {
  Play, Pause, AlertTriangle, CheckCircle, Clock,
  X, Cpu, RefreshCw, FlaskConical, Factory, Package,
  Eye, RotateCcw, ChevronDown, AlertCircle, Printer, Save
} from "lucide-react";
import { supabase, updateJobStatus, logWorkflowActivity } from "../server/api";

// ============================================================
// TYPES
// ============================================================

interface QCRecord {
  qc_id: number;
  overall_status: string;
  workflow_status: string;
  rework_required: boolean;
  rework_description?: string;
  defect_description?: string;
  approved_for_dispatch: boolean;
  qc_cycle: number;
  checked_by_name?: string;
  check_date?: string;
  color_accuracy?: string;
  print_quality?: string;
  material_quality?: string;
  dimensional_accuracy?: string;
  finishing_quality?: string;
  binding_quality?: string;
  defect_type?: string;
  defect_quantity?: number;
  notes?: string;
}

interface AssignedJob {
  id: string;
  type: "sample" | "production";
  product: string;
  customer: string;
  quantity: number;
  assignedTo: string;
  machine: string;
  priority: "High" | "Medium" | "Low";
  status: string;
  progress: number;
  dueDate: string;
  createdDate: string;
  value: number;
  qcCycle: number;
  reworkCount: number;
  lastQcResult?: string;
  currentQcId?: number;
}

interface InventoryItem {
  id: number;
  item: string;
  category: string;
  current: number;
  min: number;
  max: number;
  unit: string;
  unitcost: number;
  supplier: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const ISSUE_TYPES = [
  "Registration problem",
  "Color inconsistency",
  "Paper jam",
  "Ink drying issue",
  "Machine vibration",
  "Other",
];

const PAUSE_REASONS = [
  "Material shortage",
  "Machine maintenance",
  "Operator break",
  "Quality check",
  "Customer approval needed",
  "Other",
];

// ============================================================
// SAFE SUPABASE INSERT
// ============================================================

async function safeInsert(
  table: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from(table).insert([payload]);
  } catch {
    // Silently ignore — table may not exist yet
  }
}

// ============================================================
// FACTORY SLIP MODAL
// ============================================================

interface FactorySlipModalProps {
  job: AssignedJob;
  onClose: () => void;
  onSave: () => void;
}

function FactorySlipModal({ job, onClose, onSave }: FactorySlipModalProps) {
  const [loading, setLoading] = useState(false);
  const [slipData, setSlipData] = useState({
    // Auto-filled fields
    jobName: job.product || '',
    customer: job.customer || '',
    copies: job.quantity || 0,
    jobSize: '',
    colors: '',
    date: new Date().toISOString().split('T')[0],
    slipNumber: `FS-${job.id}-${Date.now().toString().slice(-4)}`,
    machineMan: job.assignedTo || '',
    supervisor: '',

    // Supervisor fills
    paperName: '',
    paperQuantity: 0,
    additionalSheets: 0,
    boardSheets: 0,
    coverPaper: '',
    remarks: '',
  });

  // Load existing factory slip data if any
  useEffect(() => {
    const loadSlipData = async () => {
      try {
        const { data } = await supabase
          .from('factory_slips')
          .select('*')
          .eq('job_id', job.id)
          .eq('job_type', job.type)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (data) {
          setSlipData({
            jobName: data.job_name || job.product,
            customer: data.customer || job.customer,
            copies: data.copies || job.quantity,
            jobSize: data.job_size || '',
            colors: data.colors || '',
            date: data.slip_date || new Date().toISOString().split('T')[0],
            slipNumber: data.slip_number || `FS-${job.id}-${Date.now().toString().slice(-4)}`,
            machineMan: data.machine_man || job.assignedTo,
            supervisor: data.supervisor || '',
            paperName: data.paper_name || '',
            paperQuantity: data.paper_quantity || 0,
            additionalSheets: data.additional_sheets || 0,
            boardSheets: data.board_sheets || 0,
            coverPaper: data.cover_paper || '',
            remarks: data.remarks || '',
          });
        }
      } catch (error) {
        console.log('No existing slip found, using default values');
      }
    };
    loadSlipData();
  }, [job]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Printer size={20} className="text-indigo-600" />
              Factory Slip - {job.id}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              <span className="text-amber-600 font-medium">📋 Read Only</span> —
              Machine Operator can view and print only. Supervisor fills the details.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6" id="factory-slip-print">
          {/* Job Info - Auto-filled */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-indigo-700 mb-3 flex items-center gap-2">
              <Clock size={14} /> Auto-filled Fields (Read Only)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Job Name</label>
                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900" value={slipData.jobName} readOnly />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Customer</label>
                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900" value={slipData.customer} readOnly />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Copies</label>
                <input type="number" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900" value={slipData.copies} readOnly />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-0.5">Slip Number</label>
                <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900" value={slipData.slipNumber} readOnly />
              </div>
            </div>
          </div>

          {/* More Auto-filled */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Job Size</label>
              <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={slipData.jobSize} readOnly />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Colors</label>
              <input type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={slipData.colors} readOnly />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Date</label>
              <input type="date" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm" value={slipData.date} readOnly />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-0.5">Machine Man</label>
              <input type="text" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900" value={slipData.machineMan} readOnly />
            </div>
          </div>

          {/* Supervisor Section - Read Only */}
          <div className="border-t-2 border-dashed border-amber-300 pt-4">
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">SUPERVISOR SECTION</span>
              <span className="text-xs text-slate-400">— Read Only (View Only)</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">Supervisor Name</label>
                <input type="text" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.supervisor || '—'} readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">Paper Name</label>
                <input type="text" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.paperName || '—'} readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">Paper Quantity</label>
                <input type="number" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.paperQuantity || 0} readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">Additional Sheets</label>
                <input type="number" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.additionalSheets || 0} readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">Board Sheets</label>
                <input type="number" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.boardSheets || 0} readOnly />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-0.5">Cover Paper</label>
                <input type="text" className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.coverPaper || '—'} readOnly />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-0.5">Remarks</label>
              <textarea rows={2} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-700" value={slipData.remarks || '—'} readOnly />
            </div>
          </div>

          {/* Footer note */}
          <div className="text-xs text-slate-400 border-t border-slate-200 pt-4 flex items-center gap-2">
            <Printer size={14} className="text-slate-300" />
            <span>Printed copy goes to: <strong>Inventory</strong> and <strong>Machine Operator</strong></span>
          </div>
        </div>

        {/* Actions - Only Print and Close, NO SAVE button */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors flex items-center gap-2"
          >
            <Printer size={16} /> Print Factory Slip
          </button>
        </div>
      </div>
    </div>
  );
}
// ============================================================
// QC REPORT MODAL
// ============================================================

interface QCReportModalProps {
  qc: QCRecord;
  job: AssignedJob;
  onClose: () => void;
  onStartRework: (note: string) => Promise<void>;
  updating: boolean;
}

function QCReportModal({
  qc, job, onClose, onStartRework, updating,
}: QCReportModalProps) {
  const [reworkNote, setReworkNote] = useState("");
  const isSample = job.type === "sample";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <AlertTriangle size={20} className="text-red-500" />
              QC Report #{qc.qc_id}
              {qc.qc_cycle > 1 && (
                <span className="ml-1 px-2 py-0.5 rounded text-xs bg-orange-100 text-orange-700 border border-orange-200 font-bold">
                  Cycle {qc.qc_cycle}
                </span>
              )}
              {isSample && (
                <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700 border border-amber-200 font-bold">
                  Sample
                </span>
              )}
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              {job.id} · {job.customer} · {job.product}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Rework Banner */}
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              Rework Required — Job sent back by QC
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Please read the QC feedback below carefully before starting rework.
            </p>
          </div>
        </div>

        {/* Job Summary */}
        <div className="grid grid-cols-3 gap-3 text-xs mb-4">
          {[
            ["Job ID", job.id],
            ["Quantity", `${job.quantity.toLocaleString()} pcs`],
            ["QC Cycle", String(qc.qc_cycle)],
            ["Inspector", qc.checked_by_name || "QC Team"],
            ["Date", qc.check_date
              ? new Date(qc.check_date).toLocaleDateString("en-IN")
              : "—"],
            ["Result", "Failed — Rework Required"],
          ].map(([l, v]) => (
            <div key={l} className="bg-slate-50 rounded-lg p-2.5">
              <p className="text-slate-400 mb-0.5">{l}</p>
              <p className="text-slate-800 font-semibold">{v}</p>
            </div>
          ))}
        </div>

        {/* Quality Ratings */}
        {(qc.color_accuracy || qc.print_quality) && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Quality Ratings</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Color Accuracy", value: qc.color_accuracy || "NA" },
                { label: "Print Quality", value: qc.print_quality || "NA" },
                { label: "Material Quality", value: qc.material_quality || "NA" },
                { label: "Dimensional Accuracy", value: qc.dimensional_accuracy || "NA" },
                { label: "Finishing Quality", value: qc.finishing_quality || "NA" },
                { label: "Binding Quality", value: qc.binding_quality || "NA" },
              ].map((r) => (
                <RatingBadge key={r.label} label={r.label} value={r.value} />
              ))}
            </div>
          </div>
        )}

        {/* Defect Details */}
        {(qc.defect_description || (qc.defect_quantity && qc.defect_quantity > 0)) && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg mb-4 space-y-1.5">
            <p className="text-xs font-semibold text-red-800">Defects Found</p>
            {qc.defect_type && (
              <p className="text-xs text-red-700">
                Type: <span className="font-medium">{qc.defect_type}</span>
              </p>
            )}
            {qc.defect_quantity && qc.defect_quantity > 0 && (
              <p className="text-xs text-red-700">
                Quantity: <span className="font-medium">{qc.defect_quantity} pcs</span>
              </p>
            )}
            {qc.defect_description && (
              <p className="text-xs text-red-700 whitespace-pre-wrap">
                {qc.defect_description}
              </p>
            )}
          </div>
        )}

        {/* Rework Instructions */}
        {qc.rework_description && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg mb-4">
            <p className="text-xs font-semibold text-orange-800 mb-1.5 flex items-center gap-1">
              <RotateCcw size={12} /> Rework Instructions from QC
            </p>
            <p className="text-xs text-orange-700 whitespace-pre-wrap leading-relaxed">
              {qc.rework_description}
            </p>
          </div>
        )}

        {/* Inspector Notes */}
        {qc.notes && (
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg mb-4">
            <p className="text-xs font-semibold text-slate-700 mb-1">Inspector Notes</p>
            <p className="text-xs text-slate-600">{qc.notes}</p>
          </div>
        )}

        {/* Operator Rework Note */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Your Rework Notes (Optional)
          </label>
          <textarea
            value={reworkNote}
            onChange={(e) => setReworkNote(e.target.value)}
            placeholder="Describe how you will address the QC issues..."
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20
              focus:border-indigo-400 resize-none"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onStartRework(reworkNote)}
            disabled={updating}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg
              hover:bg-indigo-700 transition-colors text-sm font-semibold
              disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {updating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Play size={16} />}
            {updating ? "Processing..." : "Acknowledge & Start Rework"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg
              hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SEND TO QC MODAL
// ============================================================

interface SendToQCModalProps {
  job: AssignedJob;
  isRework: boolean;
  onClose: () => void;
  onConfirm: (note: string) => Promise<void>;
  updating: boolean;
}

function SendToQCModal({
  job, isRework, onClose, onConfirm, updating,
}: SendToQCModalProps) {
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <CheckCircle size={20} className="text-green-500" />
            {isRework ? "Send Rework to QC" : "Send to QC"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {isRework && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
            <p className="text-xs font-semibold text-amber-800">Rework Submission</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You are submitting this job after rework. QC will re-inspect
              it as Cycle {(job.qcCycle || 0) + 1}.
            </p>
          </div>
        )}

        <div className="bg-slate-50 rounded-lg p-3 mb-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Job ID</span>
            <span className="font-semibold text-slate-800">{job.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Product</span>
            <span className="font-semibold text-slate-800 truncate ml-4">
              {job.product}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Quantity</span>
            <span className="font-semibold text-slate-800">
              {job.quantity.toLocaleString()} units
            </span>
          </div>
          {job.reworkCount > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Rework Count</span>
              <span className="font-semibold text-orange-700">
                {job.reworkCount}x rework
              </span>
            </div>
          )}
        </div>

        <div className="mb-4">
          <label className="text-xs font-medium text-slate-700 block mb-1">
            Completion Notes (Optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add any notes for the QC inspector..."
            rows={2}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs
              focus:outline-none focus:ring-2 focus:ring-indigo-500/20
              focus:border-indigo-400 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onConfirm(note)}
            disabled={updating}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg
              hover:bg-green-700 transition-colors text-sm font-semibold
              disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {updating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <CheckCircle size={16} />}
            {updating ? "Processing..." : "Confirm — Send to QC"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg
              hover:bg-slate-200 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// RATING BADGE
// ============================================================

function RatingBadge({ label, value }: { label: string; value: string }) {
  const map: Record<string, string> = {
    Excellent: "bg-green-100 text-green-700",
    Good: "bg-blue-100 text-blue-700",
    Fair: "bg-amber-100 text-amber-700",
    Poor: "bg-red-100 text-red-700",
    NA: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg border border-slate-100">
      <span className="text-xs text-slate-600">{label}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${map[value] ?? map.NA}`}>
        {value}
      </span>
    </div>
  );
}

// ============================================================
// PAUSE MODAL
// ============================================================

interface PauseModalProps {
  onClose: () => void;
  onConfirm: (reason: string, note: string) => Promise<void>;
  updating: boolean;
}

function PauseModal({ onClose, onConfirm, updating }: PauseModalProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Pause size={18} className="text-amber-500" />
            Pause Job
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Reason for Pausing *
            </label>
            <div className="relative">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs border
                  border-slate-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 bg-white"
              >
                <option value="">Select reason...</option>
                {PAUSE_REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Any additional notes..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg
                resize-none focus:outline-none focus:ring-2
                focus:ring-amber-500/20 focus:border-amber-400"
            />
          </div>

          <button
            onClick={() => onConfirm(reason, note)}
            disabled={!reason || updating}
            className="w-full py-2.5 bg-amber-500 text-white rounded-lg
              hover:bg-amber-600 transition-colors text-sm font-semibold
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {updating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Pause size={14} />}
            {updating ? "Pausing..." : "Confirm Pause"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MATERIAL MODAL
// ============================================================

interface MaterialModalProps {
  inventoryItems: InventoryItem[];
  onClose: () => void;
  onConfirm: (itemId: string, used: number, waste: number, note: string) => Promise<void>;
  updating: boolean;
}

function MaterialModal({
  inventoryItems, onClose, onConfirm, updating,
}: MaterialModalProps) {
  const [selectedItem, setSelectedItem] = useState("");
  const [used, setUsed] = useState(0);
  const [waste, setWaste] = useState(0);
  const [note, setNote] = useState("");

  const item = inventoryItems.find((i) => String(i.id) === selectedItem);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Package size={18} className="text-green-500" />
            Record Material Usage
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Material *</label>
            <div className="relative">
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs border
                  border-slate-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-green-500/20 focus:border-green-400 bg-white"
              >
                <option value="">Select material...</option>
                {inventoryItems
                  .filter((i) => i.current > 0)
                  .map((i) => (
                    <option key={i.id} value={String(i.id)}>
                      {i.item} ({i.current} {i.unit} available)
                    </option>
                  ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {item && (
            <div className="p-2.5 bg-green-50 border border-green-100 rounded-lg text-xs">
              <p className="text-green-700 font-medium">{item.item}</p>
              <p className="text-green-600 mt-0.5">
                Available: {item.current} {item.unit} · Min: {item.min} {item.unit}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Quantity Used *</label>
              <input
                type="number" min="0"
                value={used}
                onChange={(e) => setUsed(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">Waste</label>
              <input
                type="number" min="0"
                value={waste}
                onChange={(e) => setWaste(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg
                  focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
              />
            </div>
          </div>

          {item && used > item.current && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={13} className="text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-600">
                Not enough stock. Available: {item.current} {item.unit}
              </p>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Notes</label>
            <input
              type="text" value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional notes..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-400"
            />
          </div>

          <button
            onClick={() => onConfirm(selectedItem, used, waste, note)}
            disabled={!selectedItem || used <= 0 || (item ? used > item.current : false) || updating}
            className="w-full py-2.5 bg-green-600 text-white rounded-lg
              hover:bg-green-700 transition-colors text-sm font-semibold
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {updating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Package size={14} />}
            {updating ? "Recording..." : "Record Usage"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ISSUE MODAL
// ============================================================

interface IssueModalProps {
  onClose: () => void;
  onConfirm: (type: string, desc: string) => Promise<void>;
  updating: boolean;
}

function IssueModal({ onClose, onConfirm, updating }: IssueModalProps) {
  const [type, setType] = useState("");
  const [desc, setDesc] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-500" />
            Report Issue
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Issue Type *</label>
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-xs border
                  border-slate-200 rounded-lg focus:outline-none
                  focus:ring-2 focus:ring-red-500/20 focus:border-red-400 bg-white"
              >
                <option value="">Select type...</option>
                {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1">Description *</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows={3}
              placeholder="Describe the issue in detail..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg
                resize-none focus:outline-none focus:ring-2
                focus:ring-red-500/20 focus:border-red-400"
            />
          </div>

          <button
            onClick={() => onConfirm(type, desc)}
            disabled={!type || !desc.trim() || updating}
            className="w-full py-2.5 bg-red-600 text-white rounded-lg
              hover:bg-red-700 transition-colors text-sm font-semibold
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {updating
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <AlertTriangle size={14} />}
            {updating ? "Submitting..." : "Submit Issue Report"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// JOB CARD
// ============================================================

interface JobCardProps {
  job: AssignedJob;
  onStatusUpdate: () => void;
  inventoryItems: InventoryItem[];
  onInventoryUpdate: () => void;
  currentEmployeeId: number;
  currentEmployeeName: string;
}

function JobCard({
  job,
  onStatusUpdate,
  inventoryItems,
  onInventoryUpdate,
  currentEmployeeId,
  currentEmployeeName,
}: JobCardProps) {
  const [updating, setUpdating] = useState(false);
  const [latestQC, setLatestQC] = useState<QCRecord | null>(null);
  const [loadingQC, setLoadingQC] = useState(false);
  const [activeModal, setActiveModal] = useState<
    "" | "qcReport" | "sendToQC" | "pause" | "material" | "issue" | "factorySlip"
  >("");

  const isSample = job.type === "sample";
  const isProduction = job.type === "production";

  // ── Derived booleans ──────────────────────────────────────────
  const isReworkRequired = job.status === "Rework Required";
  const isPending = job.status === "Pending";
  const isRunning = job.status === "In Progress";
  const isQCPending = job.status === "QC Pending";
  const isCompleted = job.status === "Completed";
  const isApproved = job.status === "Approved" || job.status === "Awaiting Approval";
  const isDispatched = job.status === "Dispatched";

  const canStart = isPending;
  const canPause = isRunning;
  const canSendToQC = isRunning;
  const canStartRework = isReworkRequired;
  const canFactorySlip = isRunning || isReworkRequired;

  // ── Auto-load QC when rework required ────────────────────────
  useEffect(() => {
    if (isReworkRequired) {
      setLoadingQC(true);
      fetchLatestQC().finally(() => setLoadingQC(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id, job.status]);

  const fetchLatestQC = async (): Promise<void> => {
    try {
      const column = isSample ? "sample_order_id" : "production_order_id";

      const { data, error } = await supabase
        .from("quality_checks")
        .select(`
          qc_id,
          overall_status,
          workflow_status,
          rework_required,
          rework_description,
          defect_description,
          defect_type,
          defect_quantity,
          approved_for_dispatch,
          qc_cycle,
          notes,
          check_date,
          color_accuracy,
          print_quality,
          material_quality,
          dimensional_accuracy,
          finishing_quality,
          binding_quality,
          checked_by_emp:checked_by(full_name)
        `)
        .eq(column, job.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return;

      setLatestQC({
        qc_id: data.qc_id,
        overall_status: data.overall_status,
        workflow_status: data.workflow_status || "Rejected",
        rework_required: data.rework_required || false,
        rework_description: data.rework_description,
        defect_description: data.defect_description,
        defect_type: data.defect_type,
        defect_quantity: data.defect_quantity || 0,
        approved_for_dispatch: data.approved_for_dispatch || false,
        qc_cycle: data.qc_cycle || 1,
        notes: data.notes,
        check_date: data.check_date,
        checked_by_name: (data as any).checked_by_emp?.full_name || "QC Team",
        color_accuracy: data.color_accuracy,
        print_quality: data.print_quality,
        material_quality: data.material_quality,
        dimensional_accuracy: data.dimensional_accuracy,
        finishing_quality: data.finishing_quality,
        binding_quality: data.binding_quality,
      });
    } catch (err) {
      console.error("Failed to fetch latest QC:", err);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────

  const handleStartWork = async () => {
    try {
      setUpdating(true);
      await updateJobStatus(job.type, job.id, { status: "In Progress" });
      await logWorkflowActivity(
        job.type, job.id,
        "Started",
        "Job started by operator",
      );
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to start:", err);
      alert("Failed to start job. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handlePauseWork = async (reason: string, note: string) => {
    try {
      setUpdating(true);
      await updateJobStatus(job.type, job.id, { status: "Pending" });
      await logWorkflowActivity(
        job.type, job.id,
        "Paused",
        `Reason: ${reason}${note ? ` | ${note}` : ""}`,
      );
      setActiveModal("");
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to pause:", err);
      alert("Failed to pause job. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleSendToQC = async (note: string) => {
    try {
      setUpdating(true);

      const table = isSample ? "sample_orders" : "production_orders";
      const column = isSample ? "sample_order_id" : "production_order_id";

      const { data: current } = await supabase
        .from(table)
        .select("qc_cycle, rework_count")
        .eq(column, job.id)
        .single();

      const currentCycle = current?.qc_cycle || 0;
      const reworkCount = current?.rework_count || 0;

      const updatePayload: Record<string, unknown> = {
        status: "QC Pending",
        qc_cycle: currentCycle,
        rework_count: reworkCount,
      };

      // customer_feedback only exists on sample_orders
      if (isSample) {
        updatePayload.customer_feedback = null;
      }

      await updateJobStatus(job.type, job.id, updatePayload);
      await logWorkflowActivity(
        job.type, job.id,
        isReworkRequired ? "Sent to QC (Rework)" : "Sent to QC",
        note || undefined,
      );

      setActiveModal("");
      onStatusUpdate();
    } catch (err) {
      console.error("Failed to send to QC:", err);
      alert("Failed to send to QC. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleStartRework = async (note: string) => {
    try {
      setUpdating(true);

      const table = isSample ? "sample_orders" : "production_orders";
      const column = isSample ? "sample_order_id" : "production_order_id";

      const { data: current } = await supabase
        .from(table)
        .select("rework_count, qc_cycle")
        .eq(column, job.id)
        .single();

      const newReworkCount = (current?.rework_count || 0) + 1;
      const newQCCycle = (current?.qc_cycle || 0) + 1;

      const reworkPayload: Record<string, unknown> = {
        status: "In Progress",
        rework_count: newReworkCount,
        qc_cycle: newQCCycle,
      };

      if (isSample) {
        reworkPayload.customer_feedback = null;
      } else {
        reworkPayload.progress = 0;
      }

      await updateJobStatus(job.type, job.id, reworkPayload);

      if (latestQC) {
        await supabase
          .from("quality_checks")
          .update({ closed: true, workflow_status: "Rework Started" })
          .eq("qc_id", latestQC.qc_id);
      }

      await logWorkflowActivity(
        job.type, job.id,
        "Rework Started",
        note
          ? `Operator notes: ${note}`
          : `Rework #${newReworkCount} started`,
        latestQC?.qc_id,
      );

      setLatestQC(null);
      setActiveModal("");
      onStatusUpdate();

      alert(
        `✅ Rework started!\n\n` +
        `Please address all QC feedback and send back to QC when done.`
      );
    } catch (err) {
      console.error("Failed to start rework:", err);
      alert("Failed to start rework. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleMaterialUsage = async (
    itemId: string,
    used: number,
    waste: number,
    note: string,
  ) => {
    try {
      setUpdating(true);

      const inventoryItem = inventoryItems.find((i) => String(i.id) === itemId);
      if (!inventoryItem) throw new Error("Item not found");
      if (inventoryItem.current < used) throw new Error("Insufficient stock");

      await supabase
        .from("inventory")
        .update({
          current: inventoryItem.current - used,
          updated_at: new Date().toISOString(),
        })
        .eq("id", inventoryItem.id);

      await safeInsert("material_usage_logs", {
        job_id: job.id,
        job_type: job.type,
        inventory_item_id: inventoryItem.id,
        quantity_used: used,
        quantity_waste: waste || 0,
        notes: note,
        timestamp: new Date().toISOString(),
      });

      setActiveModal("");
      onInventoryUpdate();
      alert(
        `✅ Material recorded!\n` +
        `Used: ${used} ${inventoryItem.unit}\n` +
        `Waste: ${waste || 0} ${inventoryItem.unit}`
      );
    } catch (err: any) {
      console.error("Material usage failed:", err);
      alert(err.message || "Failed to record material usage.");
    } finally {
      setUpdating(false);
    }
  };

  const handleIssueReport = async (type: string, desc: string) => {
    try {
      setUpdating(true);

      await safeInsert("job_issue_logs", {
        job_id: job.id,
        job_type: job.type,
        issue_type: type,
        description: desc,
        reported_by: currentEmployeeName,
        timestamp: new Date().toISOString(),
      });

      await logWorkflowActivity(
        job.type, job.id,
        "Issue Reported",
        `${type}: ${desc}`,
      );

      setActiveModal("");
      alert("✅ Issue reported successfully.");
    } catch (err) {
      console.error("Issue report failed:", err);
      alert("Failed to report issue.");
    } finally {
      setUpdating(false);
    }
  };

  // ── Status helpers ────────────────────────────────────────────

  const getStatusStyle = () => {
    if (isReworkRequired) return "bg-red-50 text-red-700 border-red-200";
    if (isRunning) return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (isQCPending) return "bg-amber-50 text-amber-700 border-amber-200";
    if (isCompleted) return "bg-green-50 text-green-700 border-green-200";
    if (isApproved) return "bg-green-50 text-green-700 border-green-200";
    if (isDispatched) return "bg-slate-100 text-slate-600 border-slate-200";
    return "bg-slate-100 text-slate-600 border-slate-200";
  };

  const getStatusLabel = () => {
    if (isReworkRequired) return "⚠️ Rework Required";
    if (isQCPending) return "🔍 QC Pending";
    if (isRunning) return "▶ Running";
    if (isPending) return "Pending";
    return job.status;
  };

  const getProgressColor = () => {
    if (isReworkRequired) return "bg-red-400";
    if (isRunning) return "bg-indigo-500";
    if (isCompleted) return "bg-green-500";
    return "bg-slate-400";
  };

  const getBorderColor = () => {
    if (isReworkRequired) return "border-red-200";
    if (isRunning) return "border-indigo-200";
    if (isQCPending) return "border-amber-200";
    return "border-slate-200";
  };

  const getTopBarColor = () => {
    if (isReworkRequired) return "bg-red-500";
    if (isRunning) return "bg-indigo-600";
    if (isQCPending) return "bg-amber-400";
    if (isCompleted) return "bg-green-500";
    return "bg-transparent";
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      {/* Modals */}
      {activeModal === "qcReport" && latestQC && (
        <QCReportModal
          qc={latestQC}
          job={job}
          onClose={() => setActiveModal("")}
          onStartRework={handleStartRework}
          updating={updating}
        />
      )}
      {activeModal === "sendToQC" && (
        <SendToQCModal
          job={job}
          isRework={isReworkRequired}
          onClose={() => setActiveModal("")}
          onConfirm={handleSendToQC}
          updating={updating}
        />
      )}
      {activeModal === "pause" && (
        <PauseModal
          onClose={() => setActiveModal("")}
          onConfirm={handlePauseWork}
          updating={updating}
        />
      )}
      {activeModal === "material" && (
        <MaterialModal
          inventoryItems={inventoryItems}
          onClose={() => setActiveModal("")}
          onConfirm={handleMaterialUsage}
          updating={updating}
        />
      )}
      {activeModal === "issue" && (
        <IssueModal
          onClose={() => setActiveModal("")}
          onConfirm={handleIssueReport}
          updating={updating}
        />
      )}
      {activeModal === "factorySlip" && (
        <FactorySlipModal
          job={job}
          onClose={() => setActiveModal("")}
          onSave={onStatusUpdate}
        />
      )}

      {/* Card */}
      <div className={`bg-white border rounded-xl overflow-hidden ${getBorderColor()}`}>
        <div className={`h-1 ${getTopBarColor()}`} />

        <div className="p-5">

          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {isSample ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                    bg-amber-50 text-amber-700 border border-amber-200">
                    <FlaskConical size={10} /> Sample
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                    bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Factory size={10} /> Production
                  </span>
                )}
                <p className="text-indigo-600 text-xs font-bold">{job.id}</p>
                <PriorityBadge priority={job.priority} />
                {isReworkRequired && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                    bg-red-100 text-red-700 border border-red-200 font-semibold">
                    <RotateCcw size={10} />
                    Rework #{job.reworkCount + 1}
                  </span>
                )}
                {isRunning && job.reworkCount > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                    bg-orange-100 text-orange-700 border border-orange-200">
                    <RotateCcw size={10} /> Rework #{job.reworkCount}
                  </span>
                )}
              </div>
              <h3 className="text-slate-900 text-sm font-bold truncate">{job.product}</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                {job.customer} · {job.machine}
              </p>
            </div>
            <span className={`inline-flex px-2 py-0.5 rounded border text-xs
              flex-shrink-0 font-medium ${getStatusStyle()}`}>
              {getStatusLabel()}
            </span>
          </div>

          {/* Rework Alert Banner */}
          {isReworkRequired && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-red-800">
                    QC Rejected — Rework Required (Cycle {job.qcCycle})
                  </p>
                  {latestQC?.rework_description && (
                    <p className="text-xs text-red-700 mt-1 line-clamp-2">
                      {latestQC.rework_description}
                    </p>
                  )}
                  {latestQC?.defect_description && !latestQC.rework_description && (
                    <p className="text-xs text-red-700 mt-1 line-clamp-2">
                      {latestQC.defect_description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Running Rework Info */}
          {isRunning && job.reworkCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-xs font-semibold text-orange-800 flex items-center gap-1">
                <RotateCcw size={12} />
                Rework in progress — Cycle {job.qcCycle}
              </p>
              <p className="text-xs text-orange-700 mt-0.5">
                Address all QC feedback then send to QC for re-inspection.
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">Progress</span>
              <span className="text-xs text-slate-800 font-bold">
                {job.quantity.toLocaleString()} units
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${Math.min(job.progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Job ID", value: job.id },
              { label: "Quantity", value: job.quantity.toLocaleString() },
              { label: "Machine", value: job.machine },
              { label: "Operator", value: job.assignedTo },
            ].map((item) => (
              <div key={item.label} className="bg-slate-50 rounded-lg p-2.5">
                <p className="text-slate-400 text-xs mb-0.5">{item.label}</p>
                <p className="text-slate-700 text-xs font-semibold truncate">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-4 text-xs text-slate-500 mb-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Created:
              <span className="text-slate-700 font-medium ml-1">
                {new Date(job.createdDate).toLocaleDateString()}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              Due:
              <span className="text-slate-700 font-medium ml-1">
                {new Date(job.dueDate).toLocaleDateString()}
              </span>
            </span>
            {job.reworkCount > 0 && (
              <span className="flex items-center gap-1 text-orange-600">
                <RotateCcw size={11} />
                {job.reworkCount}x reworked
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">

            {/* Factory Slip Button - Shows for running jobs */}
            {canFactorySlip && (
              <button
                onClick={() => setActiveModal("factorySlip")}
                className="flex items-center justify-center gap-1.5 px-3 py-2
                  rounded-lg text-xs text-slate-700 border border-slate-300
                  bg-white hover:bg-slate-50 transition-colors font-medium"
              >
                <Printer size={13} /> Factory Slip
              </button>
            )}

            {/* REWORK REQUIRED */}
            {canStartRework && (
              <button
                onClick={() => {
                  if (!latestQC) {
                    setLoadingQC(true);
                    fetchLatestQC()
                      .then(() => setActiveModal("qcReport"))
                      .finally(() => setLoadingQC(false));
                  } else {
                    setActiveModal("qcReport");
                  }
                }}
                disabled={updating || loadingQC}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                  rounded-lg text-xs text-white bg-red-600 hover:bg-red-700
                  transition-colors font-semibold disabled:opacity-50"
              >
                {loadingQC
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Eye size={13} />}
                {loadingQC ? "Loading QC Report..." : "View QC Report & Start Rework"}
              </button>
            )}

            {/* PENDING */}
            {canStart && (
              <button
                onClick={handleStartWork}
                disabled={updating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5
                  rounded-lg text-xs text-white bg-indigo-600 hover:bg-indigo-700
                  transition-colors font-semibold disabled:opacity-50"
              >
                {updating
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Play size={13} />}
                {updating ? "Starting..." : "Start Job"}
              </button>
            )}

            {/* IN PROGRESS — Pause */}
            {canPause && (
              <button
                onClick={() => setActiveModal("pause")}
                disabled={updating}
                className="flex items-center justify-center gap-2 px-3 py-2.5
                  rounded-lg text-xs text-amber-700 border border-amber-200
                  bg-amber-50 hover:bg-amber-100 transition-colors font-medium
                  disabled:opacity-50"
              >
                <Pause size={13} /> Pause
              </button>
            )}

            {/* IN PROGRESS — Material */}
            {canPause && (
              <button
                onClick={() => setActiveModal("material")}
                disabled={updating}
                className="flex items-center justify-center gap-2 px-3 py-2.5
                  rounded-lg text-xs text-green-700 border border-green-200
                  bg-green-50 hover:bg-green-100 transition-colors font-medium
                  disabled:opacity-50"
              >
                <Package size={13} /> Material
              </button>
            )}

            {/* IN PROGRESS — Issue */}
            {canPause && (
              <button
                onClick={() => setActiveModal("issue")}
                disabled={updating}
                className="flex items-center justify-center gap-2 px-3 py-2.5
                  rounded-lg text-xs text-red-600 border border-red-200
                  hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
              >
                <AlertTriangle size={13} /> Issue
              </button>
            )}

            {/* IN PROGRESS — Send to QC */}
            {canSendToQC && (
              <button
                onClick={() => setActiveModal("sendToQC")}
                disabled={updating}
                className="flex items-center justify-center gap-2 px-3 py-2.5
                  rounded-lg text-xs text-green-700 border border-green-200
                  bg-green-50 hover:bg-green-100 transition-colors font-semibold
                  disabled:opacity-50"
              >
                <CheckCircle size={13} />
                {job.reworkCount > 0 ? "Send Rework to QC" : "Send to QC"}
              </button>
            )}

            {/* QC PENDING */}
            {isQCPending && (
              <div className="flex-1 text-center py-2.5 px-3 rounded-lg text-xs
                bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                🔍 In Quality Control — Awaiting Inspection
                {job.reworkCount > 0 && (
                  <span className="ml-1 text-amber-600">
                    (Cycle {job.qcCycle})
                  </span>
                )}
              </div>
            )}

            {/* AWAITING APPROVAL — samples */}
            {isSample && job.status === "Awaiting Approval" && (
              <div className="flex-1 text-center py-2.5 px-3 rounded-lg text-xs
                bg-yellow-50 text-yellow-700 border border-yellow-200 font-medium">
                ⏳ Sent to Supervisor for Final Approval
              </div>
            )}

            {/* APPROVED — samples */}
            {isSample && job.status === "Approved" && (
              <div className="flex-1 text-center py-2.5 px-3 rounded-lg text-xs
                bg-green-50 text-green-700 border border-green-200 font-medium">
                ✅ Sample Approved — Ready for Production
              </div>
            )}

            {/* COMPLETED — production */}
            {isProduction && isCompleted && (
              <div className="flex-1 text-center py-2.5 px-3 rounded-lg text-xs
                bg-green-50 text-green-700 border border-green-200 font-medium">
                ✅ Completed & Approved for Dispatch
              </div>
            )}

            {/* DISPATCHED */}
            {isDispatched && (
              <div className="flex-1 text-center py-2.5 px-3 rounded-lg text-xs
                bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                📦 Dispatched
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ============================================================
// PRIORITY BADGE
// ============================================================

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    High: "bg-red-50 text-red-700 border-red-200",
    Medium: "bg-amber-50 text-amber-700 border-amber-200",
    Low: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded border text-xs font-medium ${map[priority] ?? map.Medium}`}>
      {priority} Priority
    </span>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function MachineOperator() {
  const [assignedJobs, setAssignedJobs] = useState<AssignedJob[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState("Loading...");
  const [operatorMachine, setOperatorMachine] = useState("—");
  const [currentEmployeeId, setCurrentEmployeeId] = useState(0);
  const [currentEmployeeName, setCurrentEmployeeName] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from("inventory")
        .select("*")
        .order("item");
      if (data) setInventoryItems(data);
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      let empId = 0;
      let empName = "Admin User";

      if (user) {
        const { data: emp } = await supabase
          .from("employees")
          .select("employee_id, full_name, department")
          .eq("auth_user_id", user.id)
          .single();

        if (emp) {
          empId = emp.employee_id;
          empName = emp.full_name || "Admin User";
          setCurrentEmployeeId(empId);
          setCurrentEmployeeName(empName);
          setOperatorName(empName);
        }
      }

      await loadInventory();

      const combined: AssignedJob[] = [];

      // ── Production orders ──────────────────────────────────────
      const { data: prodData, error: prodError } = await supabase
        .from("production_orders")
        .select(`
          production_order_id,
          status,
          progress,
          final_quantity,
          original_quantity,
          delivery_date,
          created_at,
          priority,
          qc_cycle,
          rework_count,
          last_qc_result,
          current_qc_id,
          employees:assigned_to(full_name),
          machines:machine_id(machine_name),
          quotations:quotation_id(
            quotation_id,
            total_payment,
            customers:customer_id(company_name),
            quotation_products(product_name)
          )
        `)
        .not("status", "in", '("Dispatched","Packaged")')
        .order("created_at", { ascending: false });

      if (prodError) throw prodError;

      (prodData || []).forEach((po: any) => {
        const products = po.quotations?.quotation_products || [];
        combined.push({
          id: po.production_order_id,
          type: "production",
          product: products[0]?.product_name || "Custom Print Job",
          customer: po.quotations?.customers?.company_name || "Unknown",
          quantity: po.final_quantity || po.original_quantity || 0,
          assignedTo: po.employees?.full_name || "Unassigned",
          machine: po.machines?.machine_name || "Unassigned",
          priority: po.priority || "Medium",
          status: po.status || "Pending",
          progress: po.progress || 0,
          dueDate: po.delivery_date || "",
          createdDate: po.created_at || new Date().toISOString(),
          value: po.quotations?.total_payment || 0,
          qcCycle: po.qc_cycle || 0,
          reworkCount: po.rework_count || 0,
          lastQcResult: po.last_qc_result || undefined,
          currentQcId: po.current_qc_id || undefined,
        });
      });

      // ── Sample orders ──────────────────────────────────────────
      const { data: sampleData, error: sampleError } = await supabase
        .from("sample_orders")
        .select(`
          sample_order_id,
          status,
          sample_quantity,
          sample_cost,
          due_date,
          created_at,
          qc_cycle,
          rework_count,
          last_qc_result,
          current_qc_id,
          employees:assigned_to(full_name),
          quotations:quotation_id(
            quotation_id,
            customers:customer_id(company_name),
            quotation_products(product_name),
            production_orders(production_order_id)
          )
        `)
        .not("status", "in", '("Production Created","Dispatched")')
        .order("created_at", { ascending: false });

      if (sampleError) throw sampleError;

      (sampleData || []).forEach((so: any) => {
        const hasProduction =
          so.quotations?.production_orders &&
          so.quotations.production_orders.length > 0;

        if (hasProduction && so.status === "Production Created") return;

        const products = so.quotations?.quotation_products || [];
        combined.push({
          id: so.sample_order_id,
          type: "sample",
          product: products[0]?.product_name || "Unknown",
          customer: so.quotations?.customers?.company_name || "Unknown",
          quantity: so.sample_quantity || 0,
          assignedTo: so.employees?.full_name || "Unassigned",
          machine: "Sample",
          priority: "Medium",
          status: so.status || "Pending",
          progress: so.status === "Approved" ? 100 : 0,
          dueDate: so.due_date || "",
          createdDate: so.created_at || new Date().toISOString(),
          value: so.sample_cost || 0,
          qcCycle: so.qc_cycle || 0,
          reworkCount: so.rework_count || 0,
          lastQcResult: so.last_qc_result || undefined,
          currentQcId: so.current_qc_id || undefined,
        });
      });

      setAssignedJobs(combined);

      const firstProd = combined.find((j) => j.type === "production");
      if (firstProd) setOperatorMachine(firstProd.machine);

    } catch (err) {
      console.error("Failed to load jobs:", err);
      setError("Failed to load jobs. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [loadInventory]);

  useEffect(() => {
    loadJobs();

    const channel = supabase
      .channel("operator_realtime")
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "production_orders",
      }, () => loadJobs())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "sample_orders",
      }, () => loadJobs())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "inventory",
      }, () => loadInventory())
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [loadJobs, loadInventory]);

  // ── Stats ──────────────────────────────────────────────────────
  const totalJobs = assignedJobs.length;
  const runningJobs = assignedJobs.filter((j) => j.status === "In Progress").length;
  const pendingJobs = assignedJobs.filter((j) => j.status === "Pending").length;
  const reworkJobs = assignedJobs.filter((j) => j.status === "Rework Required").length;
  const totalUnits = assignedJobs.reduce((s, j) => s + j.quantity, 0);
  const completedUnits = assignedJobs.reduce((s, j) => s + j.quantity * (j.progress / 100), 0);
  const avgProgress = assignedJobs.length > 0
    ? Math.round(assignedJobs.reduce((s, j) => s + j.progress, 0) / assignedJobs.length)
    : 0;

  const sampleJobs = assignedJobs.filter((j) => j.type === "sample");
  const productionJobs = assignedJobs.filter((j) => j.type === "production");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading jobs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96">
        <AlertCircle size={40} className="text-red-400 mb-3" />
        <p className="text-red-600 text-sm mb-4">{error}</p>
        <button
          onClick={loadJobs}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
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
          <h1 className="text-slate-900 text-xl font-bold">Machine Operator</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {operatorName} · {operatorMachine} · Morning Shift
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadJobs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border
              border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          <div className="flex items-center gap-1.5 text-xs text-green-700
            bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Machine Online
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "My Jobs Today",
            value: totalJobs,
            sub: `${runningJobs} running, ${pendingJobs} pending`,
            color: "text-indigo-600 bg-indigo-50",
          },
          {
            label: "Units Completed",
            value: Math.round(completedUnits).toLocaleString(),
            sub: `of ${totalUnits.toLocaleString()} total`,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Avg Progress",
            value: `${avgProgress}%`,
            sub: "Across all jobs",
            color: "text-purple-600 bg-purple-50",
          },
          {
            label: "Rework Required",
            value: reworkJobs,
            sub: "Jobs needing rework",
            color: reworkJobs > 0
              ? "text-red-600 bg-red-50"
              : "text-slate-500 bg-slate-50",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
              <Cpu size={16} />
            </div>
            <p className="text-slate-900 text-xl font-bold mb-0.5">{s.value}</p>
            <p className="text-slate-700 text-xs font-medium">{s.label}</p>
            <p className="text-slate-400 text-xs mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Rework Alert Banner */}
      {reworkJobs > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {reworkJobs} job{reworkJobs > 1 ? "s" : ""}{" "}
              need{reworkJobs === 1 ? "s" : ""} rework
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Click "View QC Report & Start Rework" on the job card to see
              QC feedback and begin rework.
            </p>
          </div>
        </div>
      )}

      {/* Sample Jobs */}
      {sampleJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-700 text-sm font-semibold flex items-center gap-2">
              <FlaskConical size={16} className="text-amber-500" />
              Sample Jobs
            </h2>
            <span className="text-xs text-slate-400">{sampleJobs.length} jobs</span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {sampleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStatusUpdate={loadJobs}
                inventoryItems={inventoryItems}
                onInventoryUpdate={loadInventory}
                currentEmployeeId={currentEmployeeId}
                currentEmployeeName={currentEmployeeName}
              />
            ))}
          </div>
        </div>
      )}

      {/* Production Jobs */}
      {productionJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-slate-700 text-sm font-semibold flex items-center gap-2">
              <Factory size={16} className="text-indigo-500" />
              Production Jobs
            </h2>
            <span className="text-xs text-slate-400">
              {productionJobs.length} jobs
            </span>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {productionJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStatusUpdate={loadJobs}
                inventoryItems={inventoryItems}
                onInventoryUpdate={loadInventory}
                currentEmployeeId={currentEmployeeId}
                currentEmployeeName={currentEmployeeName}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {sampleJobs.length === 0 && productionJobs.length === 0 && (
        <div className="text-center py-12 bg-white border border-slate-200 rounded-xl">
          <Cpu size={48} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm font-medium">No jobs assigned</p>
          <p className="text-slate-400 text-xs mt-1">
            Check back later for new assignments
          </p>
        </div>
      )}
    </div>
  );
}