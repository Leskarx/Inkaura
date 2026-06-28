import { useState, useEffect, useCallback, useRef } from "react";
import {
  Cog, AlertTriangle, CheckCircle, Clock, Wrench, Activity,
  Calendar, Plus, ChevronRight, X, Save, RotateCcw, Eye, CalendarPlus,
  RefreshCw, WifiOff, Search, Filter, ChevronDown, Edit3
} from "lucide-react";
import { api, supabase } from "../server/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Machine {
  machine_id: number;
  machine_code: string;
  machine_name: string;
  machine_type: string;
  status: string;
  is_operational: boolean;
  current_utilization_percent: number;
  max_production_per_hour: number;
  last_maintenance_date: string;
  next_maintenance_date: string;
  model?: string;
  manufacturer?: string;
  purchase_date?: string;
  installation_date?: string;
  maintenance_notes?: string;
}

interface MaintenanceLog {
  machine: string;
  machineName: string;
  type: "Overdue" | "Due Soon" | "Preventive";
  date: string;
  notes: string;
  daysUntil: number;
}

interface FormErrors {
  machine_name?: string;
  machine_type?: string;
  max_production_per_hour?: string;
  purchase_date?: string;
  installation_date?: string;
}

type ViewMode = "grid" | "table";
type FilterStatus = "All" | "Active" | "Maintenance" | "Setup" | "Inactive";
type SortField = "machine_code" | "machine_name" | "status" | "next_maintenance_date" | "current_utilization_percent";
type SortDir = "asc" | "desc";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  Active: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  Setup: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  Maintenance: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  Inactive: { bg: "bg-slate-100", text: "text-slate-500", border: "border-slate-200", dot: "bg-slate-300" },
};

const STATUS_OPTIONS = ["Active", "Setup", "Maintenance", "Inactive"];

const MACHINE_TYPES = [
  "Offset", "Digital", "Flexo", "Screen", "Gravure",
  "Die Cutting", "Lamination", "Binding", "Folding", "Cutting", "General"
];

const EMPTY_FORM = {
  machine_code: "",
  machine_name: "",
  machine_type: "",
  status: "Active",
  is_operational: true,
  max_production_per_hour: "",
  manufacturer: "",
  model: "",
  purchase_date: "",
  installation_date: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getDaysUntilMaintenance = (dateStr: string): number => {
  if (!dateStr) return 999;
  const next = new Date(dateStr);
  if (isNaN(next.getTime())) return 999;
  return Math.ceil((next.getTime() - Date.now()) / 86400000);
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Invalid date";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const generateMachineCode = (machines: Machine[]): string => {
  const nums = machines
    .map(m => parseInt((m.machine_code || "").replace(/^M-0*/, ""), 10))
    .filter(n => !isNaN(n) && n > 0);
  const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  return `M-${String(next).padStart(3, "0")}`;
};

const today = () => new Date().toISOString().split("T")[0];
const thirtyDaysLater = () => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.Inactive;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium ${sc.bg} ${sc.text} ${sc.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
      {status}
    </span>
  );
}

function UtilizationBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color = clamped > 70 ? "bg-emerald-500" : clamped > 30 ? "bg-amber-500" : "bg-slate-300";
  return (
    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return <RotateCcw size={size} className="animate-spin" />;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-red-500 mt-1">{msg}</p>;
}

// ─── Validate Add Form ────────────────────────────────────────────────────────

function validateForm(form: typeof EMPTY_FORM): FormErrors {
  const errors: FormErrors = {};

  if (!form.machine_name.trim()) {
    errors.machine_name = "Machine name is required.";
  } else if (form.machine_name.trim().length < 2) {
    errors.machine_name = "Must be at least 2 characters.";
  } else if (form.machine_name.trim().length > 100) {
    errors.machine_name = "Must be 100 characters or fewer.";
  }

  if (!form.machine_type.trim()) {
    errors.machine_type = "Machine type is required.";
  }

  const mpp = form.max_production_per_hour;
  if (mpp !== "" && mpp !== undefined) {
    const n = Number(mpp);
    if (isNaN(n) || n < 0) errors.max_production_per_hour = "Must be a non-negative number.";
    else if (n > 1000000) errors.max_production_per_hour = "Value seems too large.";
  }

  if (form.purchase_date && form.installation_date) {
    if (new Date(form.installation_date) < new Date(form.purchase_date)) {
      errors.installation_date = "Installation date cannot be before purchase date.";
    }
  }

  return errors;
}

// ─── Add Machine Modal ────────────────────────────────────────────────────────

interface AddModalProps {
  machines: Machine[];
  onClose: () => void;
  onSuccess: () => void;
}

function AddMachineModal({ machines, onClose, onSuccess }: AddModalProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM, machine_code: generateMachineCode(machines) });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const set = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
    setSubmitError(null);
  };

  const handleSubmit = async () => {
    const errs = validateForm(form);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    try {
      setSubmitting(true);
      setSubmitError(null);

      const payload = {
        machine_code: form.machine_code,
        machine_name: form.machine_name.trim(),
        machine_type: form.machine_type.trim(),
        status: form.status,
        is_operational: form.status === "Inactive" ? false : true,
        max_production_per_hour: form.max_production_per_hour !== "" ? Number(form.max_production_per_hour) : null,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        purchase_date: form.purchase_date || null,
        installation_date: form.installation_date || null,
        current_utilization_percent: 0,
        last_maintenance_date: today(),
        next_maintenance_date: thirtyDaysLater(),
      };

      const { error } = await supabase.from("machines").insert([payload]).select();

      if (error) {
        if (error.code === "23505") {
          const newCode = generateMachineCode(machines);
          const retryPayload = { ...payload, machine_code: newCode };
          const { error: retryError } = await supabase.from("machines").insert([retryPayload]).select();
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      onSuccess();
    } catch (err: any) {
      console.error("Add machine error:", err);
      setSubmitError(err?.message || "Failed to add machine. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Cog size={20} className="text-indigo-600" /> Add New Machine
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {submitError && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Machine Code <span className="text-emerald-500 text-xs font-normal">(Auto-generated)</span>
              </label>
              <div className="relative">
                <input type="text" value={form.machine_code} readOnly
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Auto</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Machine Name <span className="text-red-500">*</span>
              </label>
              <input ref={nameRef} type="text" value={form.machine_name}
                onChange={e => set("machine_name", e.target.value)}
                placeholder="e.g., Heidelberg SM 52"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${errors.machine_name ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
              <FieldError msg={errors.machine_name} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Machine Type <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="text" list="machine-type-list" value={form.machine_type}
                  onChange={e => set("machine_type", e.target.value)}
                  placeholder="e.g., Offset, Digital, Flexo"
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${errors.machine_type ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
                <datalist id="machine-type-list">
                  {MACHINE_TYPES.map(t => <option key={t} value={t} />)}
                </datalist>
              </div>
              <FieldError msg={errors.machine_type} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer</label>
              <input type="text" value={form.manufacturer}
                onChange={e => set("manufacturer", e.target.value)}
                placeholder="e.g., Heidelberg, Komori"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
              <input type="text" value={form.model}
                onChange={e => set("model", e.target.value)}
                placeholder="e.g., SM 52-4"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Max Production (units/hr)</label>
              <input type="number" min="0" value={form.max_production_per_hour}
                onChange={e => set("max_production_per_hour", e.target.value)}
                placeholder="e.g., 15000"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${errors.max_production_per_hour ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
              <FieldError msg={errors.max_production_per_hour} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Initial Status</label>
              <select value={form.status} onChange={e => set("status", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Purchase Date</label>
              <input type="date" value={form.purchase_date} max={today()}
                onChange={e => set("purchase_date", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Installation Date</label>
              <input type="date" value={form.installation_date} max={today()}
                min={form.purchase_date || undefined}
                onChange={e => set("installation_date", e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 ${errors.installation_date ? "border-red-300 bg-red-50" : "border-slate-200"}`} />
              <FieldError msg={errors.installation_date} />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
            {submitting ? <><Spinner size={15} /> Adding…</> : <><Save size={15} /> Add Machine</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Details Modal ────────────────────────────────────────────────────────────

interface DetailsModalProps {
  machine: Machine;
  onClose: () => void;
  onSchedulePM: (m: Machine) => void;
  onRefresh?: () => void;
}

function DetailsModal({ machine: m, onClose, onSchedulePM, onRefresh }: DetailsModalProps) {
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(m.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const days = getDaysUntilMaintenance(m.next_maintenance_date);
  const isOverdue = days < 0;
  const isDueSoon = days >= 0 && days <= 7;

  const handleStatusUpdate = async () => {
    if (selectedStatus === m.status) {
      setEditingStatus(false);
      return;
    }

    try {
      setUpdatingStatus(true);

      const { error } = await supabase
        .from("machines")
        .update({
          status: selectedStatus,
          is_operational: selectedStatus === "Inactive" ? false : true,
          updated_at: new Date().toISOString()
        })
        .eq("machine_id", m.machine_id);

      if (error) throw error;

      alert(`✅ Status updated to "${selectedStatus}" for ${m.machine_code}`);
      setEditingStatus(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Failed to update status:", err);
      alert("Failed to update status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Cog size={20} className="text-indigo-600" /> Machine Details
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {(isOverdue || m.status === "Inactive") && (
            <div className={`flex items-start gap-2 text-sm rounded-lg px-4 py-3 border ${isOverdue ? "bg-red-50 border-red-200 text-red-700" : m.status === "Inactive" ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{m.status === "Inactive" ? "This machine is currently inactive." : `Maintenance overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}.`}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Machine Code", value: m.machine_code, highlight: true },
              {
                label: "Status",
                value: editingStatus ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="px-2 py-1 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleStatusUpdate}
                      disabled={updatingStatus}
                      className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      {updatingStatus ? "..." : "Save"}
                    </button>
                    <button
                      onClick={() => { setEditingStatus(false); setSelectedStatus(m.status); }}
                      className="px-2 py-1 text-xs bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status} />
                    <button
                      onClick={() => setEditingStatus(true)}
                      className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                      title="Edit Status"
                    >
                      <Edit3 size={14} />
                    </button>
                  </div>
                )
              },
              { label: "Machine Name", value: m.machine_name },
              { label: "Machine Type", value: m.machine_type },
              { label: "Manufacturer", value: m.manufacturer || "—" },
              { label: "Model", value: m.model || "—" },
              { label: "Max Output", value: m.max_production_per_hour ? `${m.max_production_per_hour.toLocaleString()}/hr` : "—" },
              {
                label: "Operational",
                value: m.is_operational ? "✅ Yes" : "❌ No",
                valueClass: m.is_operational ? "text-emerald-600" : "text-red-600"
              },
              { label: "Last Maintenance", value: formatDate(m.last_maintenance_date) },
              {
                label: "Next Maintenance",
                value: formatDate(m.next_maintenance_date),
                valueClass: isOverdue ? "text-red-600 font-semibold" : isDueSoon ? "text-amber-600 font-semibold" : undefined
              },
              ...(m.purchase_date ? [{ label: "Purchase Date", value: formatDate(m.purchase_date) }] : []),
              ...(m.installation_date ? [{ label: "Installation Date", value: formatDate(m.installation_date) }] : []),
            ].map(({ label, value, highlight, valueClass }) => (
              <div key={label} className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                {typeof value === "string"
                  ? <p className={`text-sm font-semibold ${highlight ? "text-indigo-700" : "text-slate-900"} ${valueClass ?? ""}`}>{value}</p>
                  : value}
              </div>
            ))}
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <div className="flex justify-between mb-2">
              <p className="text-xs text-slate-500">Current Utilization</p>
              <p className="text-xs font-semibold text-slate-700">{m.current_utilization_percent}%</p>
            </div>
            <UtilizationBar value={m.current_utilization_percent} />
          </div>

          {m.maintenance_notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-xs text-amber-600 font-medium mb-1">Maintenance Notes</p>
              <p className="text-sm text-slate-700">{m.maintenance_notes}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            Close
          </button>
          <button onClick={() => { onClose(); onSchedulePM(m); }}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2">
            <CalendarPlus size={15} /> Schedule PM
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule PM Modal ────────────────────────────────────────────────────────

interface ScheduleModalProps {
  machine: Machine;
  onClose: () => void;
  onSuccess: () => void;
}

function SchedulePMModal({ machine, onClose, onSuccess }: ScheduleModalProps) {
  const [date, setDate] = useState(machine.next_maintenance_date || thirtyDaysLater());
  const [notes, setNotes] = useState(machine.maintenance_notes || "");
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSchedule = async () => {
    if (!date) { setError("Please select a maintenance date."); return; }
    setError(null);

    try {
      setScheduling(true);

      const updatePayload: any = {
        next_maintenance_date: date,
        maintenance_notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (updateStatus) {
        updatePayload.status = 'Maintenance';
        updatePayload.is_operational = false;
      }

      let { data, error } = await supabase
        .from("machines")
        .update(updatePayload)
        .eq("machine_id", machine.machine_id)
        .select();

      if (error || !data || data.length === 0) {
        const result = await supabase
          .from("machines")
          .update(updatePayload)
          .eq("machine_code", machine.machine_code)
          .select();

        if (result.error) throw result.error;
        data = result.data;
      }

      if (!data || data.length === 0) {
        throw new Error(`Machine ${machine.machine_code} not found.`);
      }

      if (updateStatus) {
        alert(`✅ Maintenance scheduled for ${machine.machine_code} and status updated to "Maintenance"`);
      } else {
        alert(`✅ Maintenance scheduled for ${machine.machine_code}`);
      }

      onSuccess();
    } catch (err: any) {
      console.error("[SchedulePM] Error:", err);
      setError(err?.message || "Failed to schedule maintenance. Please try again.");
    } finally {
      setScheduling(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <CalendarPlus size={20} className="text-amber-600" /> Schedule Maintenance
          </h3>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500">Machine</p>
            <p className="font-semibold text-slate-900 text-sm">{machine.machine_code} — {machine.machine_name}</p>
            <p className="text-xs text-slate-500 mt-1">Current status: <span className="font-medium">{machine.status}</span></p>
            <p className="text-xs text-slate-500 mt-1">Current next PM: {formatDate(machine.next_maintenance_date)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">New Maintenance Date <span className="text-red-500">*</span></label>
            <input type="date" value={date} onChange={e => { setDate(e.target.value); setError(null); }}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Enter maintenance notes…"
              rows={3} maxLength={500}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
          </div>

          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <input
              type="checkbox"
              id="updateStatus"
              checked={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.checked)}
              className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500"
            />
            <label htmlFor="updateStatus" className="text-sm text-amber-800 font-medium cursor-pointer">
              Update machine status to <span className="font-bold">"Maintenance"</span>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
            <button onClick={onClose} disabled={scheduling}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSchedule} disabled={scheduling}
              className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2">
              {scheduling ? <><Spinner size={15} /> Scheduling…</> : <><Save size={15} /> Schedule</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastProps { message: string; type: "success" | "error"; onDone: () => void; }
function Toast({ message, type, onDone }: ToastProps) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all ${type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
      {type === "success" ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
      {message}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MachineManagement() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<FilterStatus>("All");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("machine_code");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [scheduleMachine, setScheduleMachine] = useState<Machine | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
  }, []);

  // ── Load machines ──────────────────────────────────────────────────────────
  const loadMachines = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const { data: machinesData, error: machinesError } = await supabase
        .from("machines")
        .select("*")
        .order("machine_code");

      if (machinesError) throw machinesError;

      if (!machinesData || machinesData.length === 0) {
        setMachines([]);
        setLoading(false);
        return;
      }

      const mapped: Machine[] = machinesData.map((m: any) => ({
        machine_id: m.machine_id,
        machine_code: m.machine_code,
        machine_name: m.machine_name,
        machine_type: m.machine_type,
        status: m.status || "Active",
        is_operational: m.is_operational !== undefined ? m.is_operational : true,
        current_utilization_percent: m.current_utilization_percent || 0,
        max_production_per_hour: m.max_production_per_hour || 0,
        manufacturer: m.manufacturer,
        model: m.model,
        purchase_date: m.purchase_date,
        installation_date: m.installation_date,
        last_maintenance_date: m.last_maintenance_date,
        next_maintenance_date: m.next_maintenance_date,
        maintenance_notes: m.maintenance_notes,
      }));

      setMachines(mapped);
    } catch (err: any) {
      console.error("Load machines error:", err);
      setLoadError(err?.message || "Failed to load machine data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMachines(); }, [loadMachines]);

  // ── Maintenance logs ──────────────────────────────────────────────────────
  useEffect(() => {
    const logs: MaintenanceLog[] = [];
    for (const m of machines) {
      const days = getDaysUntilMaintenance(m.next_maintenance_date);
      if (days < 0) {
        logs.push({ machine: m.machine_code, machineName: m.machine_name, type: "Overdue", date: m.next_maintenance_date, notes: `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? "s" : ""}`, daysUntil: days });
      } else if (days <= 3) {
        logs.push({ machine: m.machine_code, machineName: m.machine_name, type: "Due Soon", date: m.next_maintenance_date, notes: days === 0 ? "Due today" : `Due in ${days} day${days !== 1 ? "s" : ""}`, daysUntil: days });
      } else if (days <= 14) {
        logs.push({ machine: m.machine_code, machineName: m.machine_name, type: "Preventive", date: m.next_maintenance_date, notes: `Due in ${days} days`, daysUntil: days });
      }
    }
    logs.sort((a, b) => a.daysUntil - b.daysUntil);
    setMaintenanceLogs(logs.slice(0, 6));
  }, [machines]);

  // ── Derived values ────────────────────────────────────────────────────────
  const runningCount = machines.filter(m => m.status === "Active").length;
  const setupCount = machines.filter(m => m.status === "Setup").length;
  const maintCount = machines.filter(m => m.status === "Maintenance").length;
  const inactiveCount = machines.filter(m => m.status === "Inactive").length;

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = machines
    .filter(m => filter === "All" || m.status === filter)
    .filter(m => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return m.machine_code.toLowerCase().includes(q)
        || m.machine_name.toLowerCase().includes(q)
        || m.machine_type.toLowerCase().includes(q)
        || (m.manufacturer || "").toLowerCase().includes(q)
        || (m.model || "").toLowerCase().includes(q);
    })
    .sort((a, b) => {
      let va: any = a[sortField as keyof Machine] ?? "";
      let vb: any = b[sortField as keyof Machine] ?? "";
      if (sortField === "next_maintenance_date") { va = new Date(va).getTime() || 0; vb = new Date(vb).getTime() || 0; }
      if (typeof va === "string") va = va.toLowerCase();
      if (typeof vb === "string") vb = vb.toLowerCase();
      return sortDir === "asc" ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });

  const handleAddSuccess = useCallback(async () => {
    setShowAddModal(false);
    showToast("Machine added successfully!", "success");
    await loadMachines();
  }, [loadMachines, showToast]);

  const handleScheduleSuccess = useCallback(async () => {
    setScheduleMachine(null);
    showToast("Maintenance scheduled successfully!", "success");
    await loadMachines();
  }, [loadMachines, showToast]);

  const SortIndicator = ({ field }: { field: SortField }) => (
    <span className={`ml-1 inline-block transition-opacity ${sortField === field ? "opacity-100" : "opacity-0"}`}>
      {sortDir === "asc" ? "↑" : "↓"}
    </span>
  );

  const ThSort = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th onClick={() => handleSort(field)}
      className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium cursor-pointer hover:text-slate-800 select-none">
      {children}<SortIndicator field={field} />
    </th>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading machines…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
          <WifiOff size={24} className="text-red-500" />
        </div>
        <div className="text-center">
          <p className="text-slate-800 font-semibold mb-1">Failed to load machines</p>
          <p className="text-slate-500 text-sm max-w-xs">{loadError}</p>
        </div>
        <button onClick={loadMachines}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {showAddModal && (
        <AddMachineModal machines={machines} onClose={() => setShowAddModal(false)} onSuccess={handleAddSuccess} />
      )}
      {selectedMachine && (
        <DetailsModal
          machine={selectedMachine}
          onClose={() => setSelectedMachine(null)}
          onSchedulePM={m => { setSelectedMachine(null); setScheduleMachine(m); }}
          onRefresh={loadMachines}
        />
      )}
      {scheduleMachine && (
        <SchedulePMModal machine={scheduleMachine} onClose={() => setScheduleMachine(null)} onSuccess={handleScheduleSuccess} />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900 text-xl font-bold">Machine Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Fleet of {machines.length} machine{machines.length !== 1 ? "s" : ""} · {runningCount} currently running</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadMachines}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium">
            <Plus size={13} /> Add Machine
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Running", value: runningCount, icon: <Activity size={16} />, color: "text-emerald-600 bg-emerald-50", onClick: () => setFilter("Active") },
          { label: "Setup", value: setupCount, icon: <Clock size={16} />, color: "text-sky-600 bg-sky-50", onClick: () => setFilter("Setup") },
          { label: "Maintenance", value: maintCount, icon: <Wrench size={16} />, color: "text-amber-600 bg-amber-50", onClick: () => setFilter("Maintenance") },
          { label: "Inactive", value: inactiveCount, icon: <AlertTriangle size={16} />, color: "text-red-600 bg-red-50", onClick: () => setFilter("Inactive") },
        ].map(s => (
          <div key={s.label} onClick={s.onClick}
            className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-sm transition-all">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <p className="text-slate-900 text-xl font-bold mb-0.5">{s.value}</p>
            <p className="text-slate-600 text-xs font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters, search, view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
          {(["All", "Active", "Setup", "Maintenance", "Inactive"] as FilterStatus[]).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs transition-colors ${filter === f ? "bg-indigo-600 text-white font-semibold" : "text-slate-600 hover:bg-slate-50"}`}>
              {f}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search machines…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex border border-slate-200 rounded-lg overflow-hidden shrink-0">
          <button onClick={() => setView("grid")} className={`px-3 py-1.5 text-xs transition-colors ${view === "grid" ? "bg-slate-100 text-slate-800 font-medium" : "text-slate-500 hover:bg-slate-50"}`}>Grid</button>
          <button onClick={() => setView("table")} className={`px-3 py-1.5 text-xs transition-colors ${view === "table" ? "bg-slate-100 text-slate-800 font-medium" : "text-slate-500 hover:bg-slate-50"}`}>Table</button>
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl py-16 flex flex-col items-center gap-3 text-slate-400">
          <Cog size={32} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {machines.length === 0 ? "No machines added yet" : "No machines match your filters"}
          </p>
          {machines.length === 0 ? (
            <button onClick={() => setShowAddModal(true)}
              className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-colors font-medium">
              <Plus size={13} /> Add your first machine
            </button>
          ) : (
            <button onClick={() => { setFilter("All"); setSearch(""); }}
              className="mt-1 text-xs text-indigo-600 hover:underline">Clear filters</button>
          )}
        </div>
      )}

      {/* Grid view */}
      {view === "grid" && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filtered.map(m => {
            const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.Inactive;
            const days = getDaysUntilMaintenance(m.next_maintenance_date);
            const isOverdue = days < 0;
            const isDueSoon = days >= 0 && days <= 7;
            const isAlert = isOverdue || m.status === "Inactive";

            return (
              <div key={m.machine_id}
                className={`bg-white border rounded-xl p-4 flex flex-col gap-3 hover:shadow-sm transition-all ${isAlert ? "border-red-200" : isDueSoon ? "border-amber-200" : "border-slate-200"}`}>

                {isAlert && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-100 px-2.5 py-1.5 rounded-lg">
                    <AlertTriangle size={11} />
                    {m.status === "Inactive" ? "Machine is inactive" : `Maintenance overdue ${Math.abs(days)}d`}
                  </div>
                )}
                {!isAlert && isDueSoon && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                    <Clock size={11} />
                    {days === 0 ? "Maintenance due today" : `Maintenance due in ${days} day${days !== 1 ? "s" : ""}`}
                  </div>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-slate-900 text-sm font-bold truncate">{m.machine_code}</p>
                    <p className="text-slate-600 text-xs truncate">{m.machine_name}</p>
                    <p className="text-slate-400 text-xs">{m.machine_type}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Utilization</span>
                    <span className="text-xs text-slate-700 font-semibold">{m.current_utilization_percent}%</span>
                  </div>
                  <UtilizationBar value={m.current_utilization_percent} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400 mb-0.5">Max Output</p>
                    <p className="text-slate-700 font-semibold">{m.max_production_per_hour ? m.max_production_per_hour.toLocaleString() + "/hr" : "—"}</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="text-slate-400 mb-0.5">Operational</p>
                    <p className={`font-semibold ${m.is_operational ? "text-emerald-600" : "text-red-600"}`}>
                      {m.is_operational ? "✅ Yes" : "❌ No"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Calendar size={10} />
                  <span>Next PM: <span className={`font-medium ${isOverdue ? "text-red-600" : isDueSoon ? "text-amber-600" : "text-slate-700"}`}>{formatDate(m.next_maintenance_date)}</span></span>
                </div>

                <div className="flex gap-1.5 pt-1 border-t border-slate-50">
                  <button onClick={() => setSelectedMachine(m)}
                    className="flex-1 text-xs border border-slate-200 rounded-lg py-1.5 text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1">
                    <Eye size={12} /> Details
                  </button>
                  <button onClick={() => setScheduleMachine(m)}
                    className="flex-1 text-xs border border-amber-200 rounded-lg py-1.5 text-amber-700 hover:bg-amber-50 transition-colors flex items-center justify-center gap-1">
                    <CalendarPlus size={12} /> Schedule PM
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table view */}
      {view === "table" && filtered.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <ThSort field="machine_code">Code</ThSort>
                  <ThSort field="machine_name">Machine</ThSort>
                  <th className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium">Type</th>
                  <ThSort field="status">Status</ThSort>
                  <ThSort field="current_utilization_percent">Utilization</ThSort>
                  <th className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium">Max Output</th>
                  <th className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium">Operational</th>
                  <ThSort field="next_maintenance_date">Next PM</ThSort>
                  <th className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(m => {
                  const days = getDaysUntilMaintenance(m.next_maintenance_date);
                  const isOverdue = days < 0;
                  const isDueSoon = days >= 0 && days <= 7;

                  return (
                    <tr key={m.machine_id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-4 py-3 text-indigo-600 text-xs font-bold whitespace-nowrap">{m.machine_code}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800 text-xs font-semibold">{m.machine_name}</p>
                        {(m.manufacturer || m.model) && (
                          <p className="text-slate-400 text-xs">{[m.manufacturer, m.model].filter(Boolean).join(" · ")}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{m.machine_type}</td>
                      <td className="px-4 py-3"><StatusBadge status={m.status} /></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-14"><UtilizationBar value={m.current_utilization_percent} /></div>
                          <span className="text-xs text-slate-600 font-semibold">{m.current_utilization_percent}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                        {m.max_production_per_hour ? m.max_production_per_hour.toLocaleString() + "/hr" : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-semibold ${m.is_operational ? "text-emerald-600" : "text-red-600"}`}>
                          {m.is_operational ? "✅ Yes" : "❌ No"}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs font-medium ${isOverdue ? "text-red-600" : isDueSoon ? "text-amber-600" : "text-slate-500"}`}>
                          {formatDate(m.next_maintenance_date)}
                        </span>
                        {isOverdue && <span className="ml-1 text-xs text-red-400">({Math.abs(days)}d overdue)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setSelectedMachine(m)}
                            className="px-2 py-1 text-xs bg-slate-100 text-slate-600 rounded hover:bg-slate-200 transition-colors flex items-center gap-1">
                            <Eye size={10} /> View
                          </button>
                          <button onClick={() => setScheduleMachine(m)}
                            className="px-2 py-1 text-xs bg-amber-50 text-amber-700 rounded hover:bg-amber-100 transition-colors flex items-center gap-1">
                            <CalendarPlus size={10} /> PM
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400">{filtered.length} machine{filtered.length !== 1 ? "s" : ""} {filter !== "All" || search ? `(filtered from ${machines.length})` : ""}</p>
          </div>
        </div>
      )}

      {/* Maintenance Schedule */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-slate-900 text-sm font-semibold flex items-center gap-2">
            <Calendar size={15} className="text-indigo-500" /> Maintenance Schedule
          </h3>
          <span className="text-xs text-slate-400">{maintenanceLogs.length} upcoming</span>
        </div>
        <div className="divide-y divide-slate-50">
          {maintenanceLogs.length > 0 ? maintenanceLogs.map((log, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${log.type === "Overdue" ? "bg-red-50 text-red-600" :
                log.type === "Due Soon" ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"
                }`}>
                <Wrench size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-indigo-600 text-xs font-semibold">{log.machine}</p>
                  <p className="text-slate-600 text-xs truncate">{log.machineName}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${log.type === "Overdue" ? "bg-red-50 text-red-700" :
                    log.type === "Due Soon" ? "bg-amber-50 text-amber-700" : "bg-indigo-50 text-indigo-700"
                    }`}>{log.type}</span>
                </div>
                <p className="text-slate-500 text-xs mt-0.5">{log.notes}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-700 text-xs font-medium">{formatDate(log.date)}</p>
                <button onClick={() => {
                  const machine = machines.find(m => m.machine_code === log.machine);
                  if (machine) setScheduleMachine(machine);
                }} className="text-indigo-600 text-xs hover:underline mt-0.5">Schedule</button>
              </div>
            </div>
          )) : (
            <div className="px-5 py-10 text-center">
              <CheckCircle size={24} className="text-emerald-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">All machines are up to date</p>
              <p className="text-slate-400 text-xs mt-1">No maintenance due in the next 14 days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}