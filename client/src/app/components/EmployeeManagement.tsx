import { useState, useEffect, useCallback } from "react";
import {
  Users, UserPlus, Search, Filter, Edit2, Trash2, Shield,
  Phone, Mail, Building, CheckCircle, XCircle, Eye, EyeOff,
  ChevronDown, X, AlertTriangle, UserCog, MoreHorizontal
} from "lucide-react";

const API = "http://localhost:5000/api";

const ROLES = [
  { value: "ADMIN", label: "Admin", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  { value: "SALES_EXECUTIVE", label: "Sales Executive", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "SUPERVISOR", label: "Supervisor", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "MACHINE_OPERATOR", label: "Machine Operator", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "INVENTORY_MANAGER", label: "Inventory Manager", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "QC_TEAM", label: "QC Team", color: "bg-sky-100 text-sky-700 border-sky-200" },
  { value: "FINANCE", label: "Finance", color: "bg-rose-100 text-rose-700 border-rose-200" },
  { value: "DISPATCH", label: "Dispatch", color: "bg-orange-100 text-orange-700 border-orange-200" },
  { value: "PACKAGING", label: "Packaging", color: "bg-teal-100 text-teal-700 border-teal-200" },
  { value: "OPERATOR", label: "Operator", color: "bg-slate-100 text-slate-700 border-slate-200" },
];

const DEPARTMENTS = ["Management", "Sales", "Production", "Quality", "Warehouse", "Accounts", "Logistics", "Packaging"];

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  department: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  department: string;
}

const emptyForm: FormData = { name: "", email: "", phone: "", password: "", role: "OPERATOR", department: "" };

function getRoleMeta(role: string) {
  return ROLES.find((r) => r.value === role) || ROLES[ROLES.length - 1];
}

function RoleBadge({ role }: { role: string }) {
  const m = getRoleMeta(role);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${m.color}`} style={{ fontWeight: 500 }}>
      <Shield size={10} /> {m.label}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${active ? "text-green-600" : "text-slate-400"}`} style={{ fontWeight: 500 }}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-green-500" : "bg-slate-300"}`} />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const token = localStorage.getItem("token") || "";

  const headers = useCallback(() => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }), [token]);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`${API}/employees?${params}`, { headers: headers() });
      const json = await res.json();
      if (json.success) {
        setEmployees(json.data);
        setTotal(json.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [search, roleFilter, statusFilter, headers]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  useEffect(() => {
    if (successMsg) { const t = setTimeout(() => setSuccessMsg(""), 3000); return () => clearTimeout(t); }
  }, [successMsg]);

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setError(""); setShowPwd(false); setShowModal(true); };
  const openEdit = (emp: Employee) => {
    setForm({ name: emp.name, email: emp.email, phone: emp.phone || "", password: "", role: emp.role, department: emp.department || "" });
    setEditingId(emp.id); setError(""); setShowPwd(false); setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.email) { setError("Name and email are required."); return; }
    if (!editingId && !form.password) { setError("Password is required for new employees."); return; }
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = { name: form.name, email: form.email, phone: form.phone, role: form.role, department: form.department };
      if (form.password) body.password = form.password;
      const url = editingId ? `${API}/employees/${editingId}` : `${API}/employees`;
      const res = await fetch(url, { method: editingId ? "PUT" : "POST", headers: headers(), body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.success) { setError(json.message); setSaving(false); return; }
      setShowModal(false);
      setSuccessMsg(editingId ? "Employee updated!" : "Employee created!");
      fetchEmployees();
    } catch { setError("Network error."); }
    setSaving(false);
  };

  const handleToggleStatus = async (emp: Employee) => {
    try {
      await fetch(`${API}/employees/${emp.id}`, {
        method: "PUT", headers: headers(),
        body: JSON.stringify({ is_active: !emp.is_active }),
      });
      fetchEmployees();
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API}/employees/${id}`, { method: "DELETE", headers: headers() });
      setDeleteConfirm(null);
      setSuccessMsg("Employee deactivated.");
      fetchEmployees();
    } catch { /* ignore */ }
  };

  const activeCount = employees.filter((e) => e.is_active).length;
  const roleCounts = ROLES.map((r) => ({ ...r, count: employees.filter((e) => e.role === r.value).length })).filter((r) => r.count > 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Employee Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage employees and assign roles</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition-all hover:opacity-90" style={{ background: "#4f46e5", fontWeight: 500 }}>
          <UserPlus size={15} /> Add Employee
        </button>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm animate-in fade-in">
          <CheckCircle size={15} /> {successMsg}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl border border-indigo-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-600"><Users size={16} /></div>
          </div>
          <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.35rem", fontWeight: 700 }}>{total}</p>
          <p className="text-slate-500 text-xs">Total Employees</p>
        </div>
        <div className="bg-card rounded-xl border border-green-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50 text-green-600"><CheckCircle size={16} /></div>
          </div>
          <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.35rem", fontWeight: 700 }}>{activeCount}</p>
          <p className="text-slate-500 text-xs">Active</p>
        </div>
        <div className="bg-card rounded-xl border border-red-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50 text-red-600"><XCircle size={16} /></div>
          </div>
          <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.35rem", fontWeight: 700 }}>{total - activeCount}</p>
          <p className="text-slate-500 text-xs">Inactive</p>
        </div>
        <div className="bg-card rounded-xl border border-purple-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50 text-purple-600"><Shield size={16} /></div>
          </div>
          <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.35rem", fontWeight: 700 }}>{roleCounts.length}</p>
          <p className="text-slate-500 text-xs">Active Roles</p>
        </div>
      </div>

      {/* Role breakdown chips */}
      {roleCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {roleCounts.map((r) => (
            <span key={r.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border ${r.color}`} style={{ fontWeight: 500 }}>
              {r.label} <span style={{ fontWeight: 700 }}>{r.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Search by name, email, phone..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-indigo-400 transition-all" />
          </div>
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}
              className="pl-8 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none appearance-none cursor-pointer">
              <option value="">All Roles</option>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-3 pr-8 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none appearance-none cursor-pointer">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {["Employee", "Contact", "Role", "Department", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-500 px-5 py-3 whitespace-nowrap" style={{ fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">Loading employees...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400 text-sm">No employees found</td></tr>
              ) : employees.map((emp) => (
                <tr key={emp.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: emp.is_active ? "#6366f1" : "#cbd5e1" }}>
                        <span className="text-white text-xs" style={{ fontWeight: 700 }}>{emp.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className="text-slate-800 text-xs whitespace-nowrap" style={{ fontWeight: 600 }}>{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600"><Mail size={11} /> {emp.email}</div>
                      {emp.phone && <div className="flex items-center gap-1.5 text-xs text-slate-400"><Phone size={11} /> {emp.phone}</div>}
                    </div>
                  </td>
                  <td className="px-5 py-3"><RoleBadge role={emp.role} /></td>
                  <td className="px-5 py-3">
                    {emp.department ? (
                      <span className="flex items-center gap-1.5 text-xs text-slate-600"><Building size={11} /> {emp.department}</span>
                    ) : <span className="text-xs text-slate-300">—</span>}
                  </td>
                  <td className="px-5 py-3"><StatusDot active={emp.is_active} /></td>
                  <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {new Date(emp.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(emp)} className="p-1.5 rounded-lg hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-colors" title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleToggleStatus(emp)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                        title={emp.is_active ? "Deactivate" : "Activate"}>
                        {emp.is_active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                      </button>
                      <button onClick={() => setDeleteConfirm(emp.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && employees.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 text-xs text-slate-500">
            <span>Showing {employees.length} of {total} employees</span>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center"><AlertTriangle size={18} className="text-red-500" /></div>
              <div>
                <h3 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>Deactivate Employee?</h3>
                <p className="text-xs text-slate-500 mt-0.5">This will soft-delete the employee.</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="px-3 py-1.5 text-xs rounded-lg text-white bg-red-500 hover:bg-red-600">Deactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserCog size={16} className="text-indigo-600" />
                <h3 className="text-sm text-slate-900" style={{ fontWeight: 700 }}>{editingId ? "Edit Employee" : "Add New Employee"}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"><X size={16} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Full Name *</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Rajesh Kumar"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Email *</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@printflow.com"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Phone</label>
                  <input type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91-9876543210"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>
                    Password {editingId ? "(leave blank to keep)" : "*"}
                  </label>
                  <div className="relative">
                    <input type={showPwd ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••"
                      className="w-full px-3 pr-9 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400" />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Role *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer bg-white">
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-700 mb-1.5" style={{ fontWeight: 500 }}>Department</label>
                  <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-400 appearance-none cursor-pointer bg-white">
                    <option value="">Select department</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 text-xs rounded-lg text-white transition-all disabled:opacity-60" style={{ background: "#4f46e5", fontWeight: 600 }}>
                {saving ? "Saving..." : editingId ? "Update Employee" : "Create Employee"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
