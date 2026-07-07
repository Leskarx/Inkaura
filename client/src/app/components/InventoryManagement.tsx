import { useState, useEffect } from "react";
import { AlertTriangle, Package, Plus, Search, TrendingDown, BarChart2, RefreshCw, Edit, Trash2, Save, X, CheckCircle, XCircle, FileText, Printer, Calendar, Download, TrendingUp, Filter } from "lucide-react";
import { supabase } from "../server/api";

type Category = "All" | "Plate & Master" | "Inks & Chemicals" | "Printer Accessories" | "Gum & Glues" | "Rubber Blankets & Lamination Rolls" | "Binding Accessories" | "Engineering Accessories" | "Other";

const INVENTORY_CATEGORIES: Exclude<Category, "All">[] = [
  "Plate & Master",
  "Inks & Chemicals",
  "Printer Accessories",
  "Gum & Glues",
  "Rubber Blankets & Lamination Rolls",
  "Binding Accessories",
  "Engineering Accessories",
  "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Plate & Master": "bg-sky-50 text-sky-700",
  "Inks & Chemicals": "bg-purple-50 text-purple-700",
  "Printer Accessories": "bg-indigo-50 text-indigo-700",
  "Gum & Glues": "bg-amber-50 text-amber-700",
  "Rubber Blankets & Lamination Rolls": "bg-emerald-50 text-emerald-700",
  "Binding Accessories": "bg-rose-50 text-rose-700",
  "Engineering Accessories": "bg-teal-50 text-teal-700",
  "Other": "bg-slate-100 text-slate-600",
};

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
  opening_balance: number;
  received: number;
  issued: number;
  requirement: number;
  remarks: string;
  lastorder?: string;
  created_at?: string;
  updated_at?: string;
}

interface MaterialUsageLog {
  id: number;
  job_id: string;
  job_type: string;
  inventory_item_id: number;
  quantity_used: number;
  quantity_waste: number;
  notes: string;
  timestamp: string;
  created_at: string;
  inventory_item?: InventoryItem;
}

interface ToastMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

function getStockStatus(current: number, min: number) {
  const pct = current / min;
  if (current === 0) return { label: "Out of Stock", color: "bg-red-100 text-red-700 border-red-200", barColor: "bg-red-500" };
  if (pct < 0.5) return { label: "Critical Low", color: "bg-red-50 text-red-700 border-red-200", barColor: "bg-red-500" };
  if (pct < 1) return { label: "Low Stock", color: "bg-amber-50 text-amber-700 border-amber-200", barColor: "bg-amber-500" };
  return { label: "In Stock", color: "bg-green-50 text-green-700 border-green-200", barColor: "bg-green-500" };
}

export function InventoryManagement() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>("All");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUsageReport, setShowUsageReport] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [formData, setFormData] = useState({
    item: "",
    category: "Plate & Master" as Category,
    current: 0,
    min: 0,
    max: 0,
    unit: "",
    unitcost: 0,
    supplier: "",
    lastorder: "",
    opening_balance: 0,
    received: 0,
    issued: 0,
    requirement: 0,
    remarks: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Date range filter for usage report
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [jobTypeFilter, setJobTypeFilter] = useState<'all' | 'production' | 'sample'>('all');
  const [materialFilter, setMaterialFilter] = useState<string>('all');

  // Load inventory from Supabase
  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('item');

      if (error) throw error;
      if (data) {
        setInventory(data);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setError("Failed to load inventory. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Load material usage logs with filters - FIXED
  const loadMaterialUsage = async () => {
    try {
      // First, get the material usage logs
      let query = supabase
        .from('material_usage_logs')
        .select('*')
        .order('timestamp', { ascending: false });

      // Apply date range filters
      if (dateRange.from) {
        query = query.gte('timestamp', dateRange.from);
      }
      if (dateRange.to) {
        query = query.lte('timestamp', dateRange.to);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        // Get all inventory items in one query
        const inventoryIds = [...new Set(data.map(log => log.inventory_item_id))];
        const { data: inventoryData, error: inventoryError } = await supabase
          .from('inventory')
          .select('id, item, unit')
          .in('id', inventoryIds);

        if (inventoryError) throw inventoryError;

        // Create a map for quick lookup
        const inventoryMap: Record<number, InventoryItem> = {};
        if (inventoryData) {
          inventoryData.forEach((item: any) => {
            inventoryMap[item.id] = item;
          });
        }

        // Combine the data
        let combinedData = data.map(log => ({
          ...log,
          inventory_item: inventoryMap[log.inventory_item_id] || null
        }));

        // Apply job type filter
        if (jobTypeFilter !== 'all') {
          combinedData = combinedData.filter(log => log.job_type === jobTypeFilter);
        }

        // Apply material filter
        if (materialFilter !== 'all') {
          combinedData = combinedData.filter(log =>
            log.inventory_item?.item === materialFilter ||
            String(log.inventory_item_id) === materialFilter
          );
        }

        setMaterialUsage(combinedData);
      } else {
        setMaterialUsage([]);
      }
    } catch (err) {
      console.error("Failed to load material usage:", err);
      // Don't set error here to avoid breaking the UI
      setMaterialUsage([]);
    }
  };

  useEffect(() => {
    loadInventory();
    loadMaterialUsage();
  }, [dateRange, jobTypeFilter, materialFilter]);

  // Subscribe to real-time changes
  useEffect(() => {
    const subscription = supabase
      .channel('inventory_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
        },
        () => {
          loadInventory();
        }
      )
      .subscribe();

    const usageSubscription = supabase
      .channel('usage_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'material_usage_logs',
        },
        () => {
          loadMaterialUsage();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      usageSubscription.unsubscribe();
    };
  }, []);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const filtered = inventory.filter(
    (item) =>
      (category === "All" || item.category === category) &&
      item.item.toLowerCase().includes(search.toLowerCase())
  );

  // Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filtered.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const lowStockCount = inventory.filter((i) => i.current < i.min).length;
  const outOfStockCount = inventory.filter((i) => i.current === 0).length;
  const totalValue = inventory.reduce((a, i) => a + i.current * i.unitcost, 0);

  // Usage stats
  const totalUsed = materialUsage.reduce((sum, log) => sum + log.quantity_used, 0);
  const totalWaste = materialUsage.reduce((sum, log) => sum + log.quantity_waste, 0);
  const wastePercentage = totalUsed > 0 ? Math.round((totalWaste / totalUsed) * 100) : 0;

  // Get unique materials for filter dropdown
  const uniqueMaterials = Array.from(
    new Set(
      materialUsage
        .map(log => log.inventory_item?.item)
        .filter(Boolean)
    )
  );

  // Handle Add/Update Inventory
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.item.trim()) {
      setToast({ type: 'error', message: "Please enter the item name" });
      return;
    }
    if (!formData.unit.trim()) {
      setToast({ type: 'error', message: "Please enter the unit" });
      return;
    }
    if (formData.current < 0) {
      setToast({ type: 'error', message: "Current stock cannot be negative" });
      return;
    }

    try {
      setSubmitting(true);

      const total = formData.opening_balance + formData.received;
      const closing_balance = total - formData.issued;

      const payload = {
        item: formData.item.trim(),
        category: formData.category,
        current: closing_balance,
        min: formData.min,
        max: formData.max,
        unit: formData.unit.trim(),
        unitcost: formData.unitcost,
        supplier: formData.supplier?.trim() || null,
        lastorder: formData.lastorder || null,
        opening_balance: formData.opening_balance,
        received: formData.received,
        issued: formData.issued,
        requirement: formData.requirement,
        remarks: formData.remarks?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (editingItem) {
        const { error } = await supabase
          .from('inventory')
          .update(payload)
          .eq('id', editingItem.id);

        if (error) throw error;
        setToast({ type: 'success', message: "✅ Inventory item updated successfully!" });
      } else {
        const { error } = await supabase
          .from('inventory')
          .insert([{
            ...payload,
            created_at: new Date().toISOString(),
          }]);

        if (error) throw error;
        setToast({ type: 'success', message: "✅ Inventory item added successfully!" });
      }

      resetForm();
      await loadInventory();
    } catch (err) {
      console.error("Failed to save inventory item:", err);
      setToast({ type: 'error', message: "❌ Failed to save inventory item. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this inventory item? This action cannot be undone.")) return;

    try {
      const { error } = await supabase
        .from('inventory')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setToast({ type: 'success', message: "✅ Inventory item deleted successfully!" });
      await loadInventory();
    } catch (err) {
      console.error("Failed to delete inventory item:", err);
      setToast({ type: 'error', message: "❌ Failed to delete inventory item. Please try again." });
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      item: item.item,
      category: item.category as Category,
      current: item.current,
      min: item.min,
      max: item.max,
      unit: item.unit,
      unitcost: item.unitcost,
      supplier: item.supplier || "",
      lastorder: item.lastorder || "",
      opening_balance: item.opening_balance || 0,
      received: item.received || 0,
      issued: item.issued || 0,
      requirement: item.requirement || 0,
      remarks: item.remarks || "",
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      item: "",
      category: "Plate & Master",
      current: 0,
      min: 0,
      max: 0,
      unit: "",
      unitcost: 0,
      supplier: "",
      lastorder: "",
      opening_balance: 0,
      received: 0,
      issued: 0,
      requirement: 0,
      remarks: "",
    });
    setEditingItem(null);
    setShowAddModal(false);
  };

  // Reset filters
  const resetFilters = () => {
    setDateRange({ from: '', to: '' });
    setJobTypeFilter('all');
    setMaterialFilter('all');
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Item', 'Category', 'Unit', 'Op/Balance', 'Received', 'Total', 'Issued', 'C/L Balance', 'Requirement', 'Unit Cost', 'Supplier', 'Remarks'];
    const rows = filtered.map(item => {
      const opBal = item.opening_balance || 0;
      const recv = item.received || 0;
      const iss = item.issued || 0;
      return [
        item.item,
        item.category,
        item.unit,
        opBal,
        recv,
        opBal + recv,
        iss,
        (opBal + recv) - iss,
        item.requirement || 0,
        item.unitcost,
        item.supplier,
        item.remarks || ''
      ];
    });

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setToast({ type: 'success', message: "✅ Inventory exported successfully!" });
  };

  // Export Usage Report to CSV
  const handleExportUsageReport = () => {
    const headers = ['Date', 'Job ID', 'Job Type', 'Material', 'Quantity Used', 'Waste', 'Notes'];
    const rows = materialUsage.map(log => [
      new Date(log.timestamp).toLocaleDateString(),
      log.job_id,
      log.job_type,
      log.inventory_item?.item || 'Unknown',
      `${log.quantity_used} ${log.inventory_item?.unit || ''}`,
      `${log.quantity_waste} ${log.inventory_item?.unit || ''}`,
      log.notes || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `material_usage_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    setToast({ type: 'success', message: "✅ Usage report exported successfully!" });
  };

  // Calculate total usage by material
  const usageByMaterial = materialUsage.reduce((acc, log) => {
    const name = log.inventory_item?.item || 'Unknown';
    if (!acc[name]) {
      acc[name] = { used: 0, waste: 0, unit: log.inventory_item?.unit || '' };
    }
    acc[name].used += log.quantity_used;
    acc[name].waste += log.quantity_waste;
    return acc;
  }, {} as Record<string, { used: number; waste: number; unit: string }>);

  // Get top 5 most used materials
  const topMaterials = Object.entries(usageByMaterial)
    .sort((a, b) => b[1].used - a[1].used)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${toast.type === 'success' ? 'bg-green-50 border border-green-200' :
          toast.type === 'error' ? 'bg-red-50 border border-red-200' :
            'bg-blue-50 border border-blue-200'
          }`}>
          {toast.type === 'success' && <CheckCircle size={20} className="text-green-600" />}
          {toast.type === 'error' && <XCircle size={20} className="text-red-600" />}
          {toast.type === 'info' && <AlertTriangle size={20} className="text-blue-600" />}
          <span className={`text-sm ${toast.type === 'success' ? 'text-green-800' :
            toast.type === 'error' ? 'text-red-800' :
              'text-blue-800'
            }`}>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Add/Edit Modal - Same as before */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package size={20} className="text-indigo-600" />
                {editingItem ? "Edit Inventory Item" : "Add New Inventory Item"}
              </h3>
              <button onClick={resetForm} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Item Name <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.item} onChange={(e) => setFormData({ ...formData, item: e.target.value })} placeholder="e.g., Art Paper 130gsm" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category <span className="text-red-500">*</span></label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" required>
                    {INVENTORY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit <span className="text-red-500">*</span></label>
                  <input type="text" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g., reams, kg, pcs" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" required />
                </div>

                {/* Stock Register Fields */}
                <div className="md:col-span-2 mt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Stock Register</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Opening Balance</label>
                  <input type="number" value={formData.opening_balance} onChange={(e) => setFormData({ ...formData, opening_balance: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Received</label>
                  <input type="number" value={formData.received} onChange={(e) => setFormData({ ...formData, received: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Issued</label>
                  <input type="number" value={formData.issued} onChange={(e) => setFormData({ ...formData, issued: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Requirement</label>
                  <input type="number" value={formData.requirement} onChange={(e) => setFormData({ ...formData, requirement: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" min="0" />
                </div>

                {/* Computed Values Display */}
                <div className="md:col-span-2 bg-slate-50 rounded-lg p-3 flex gap-6">
                  <div>
                    <p className="text-xs text-slate-500">Total (Op.Bal + Received)</p>
                    <p className="text-sm font-bold text-slate-800">{formData.opening_balance + formData.received} {formData.unit}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Closing Balance (Total - Issued)</p>
                    <p className="text-sm font-bold text-indigo-600">{(formData.opening_balance + formData.received) - formData.issued} {formData.unit}</p>
                  </div>
                </div>

                {/* Other Details */}
                <div className="md:col-span-2 mt-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3 border-b border-slate-100 pb-2">Other Details</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost (₹)</label>
                  <input type="number" value={formData.unitcost} onChange={(e) => setFormData({ ...formData, unitcost: parseFloat(e.target.value) || 0 })} placeholder="0" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" min="0" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Supplier</label>
                  <input type="text" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} placeholder="e.g., ITC Papercrafts" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Remarks</label>
                  <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} placeholder="Any additional notes..." rows={2} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none" />
                </div>
              </div>

              <div className="flex gap-2 pt-4 mt-4 border-t border-slate-100">
                <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                  {submitting ? "Saving..." : editingItem ? "Update Item" : "Add Item"}
                </button>
                <button type="button" onClick={resetForm} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors text-sm font-medium">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Inventory Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">{inventory.length} items · {lowStockCount} low stock alerts</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowUsageReport(!showUsageReport)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white transition-colors"
            style={{ background: showUsageReport ? "#4f46e5" : "#8b5cf6", fontWeight: 500 }}
          >
            <FileText size={12} /> {showUsageReport ? "Hide Usage Report" : "View Usage Report"}
          </button>
          <button onClick={loadInventory} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <BarChart2 size={12} /> Export CSV
          </button>
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white transition-colors hover:bg-indigo-700" style={{ background: "#4f46e5", fontWeight: 500 }}>
            <Plus size={12} /> Add Item
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: "Total Items", value: inventory.length, icon: <Package size={16} />, color: "text-indigo-600 bg-indigo-50" },
          { label: "Low Stock Alerts", value: lowStockCount, icon: <AlertTriangle size={16} />, color: "text-amber-600 bg-amber-50" },
          { label: "Out of Stock", value: outOfStockCount, icon: <TrendingDown size={16} />, color: "text-red-600 bg-red-50" },
          { label: "Inventory Value", value: `₹${(totalValue / 100000).toFixed(1)}L`, icon: <BarChart2 size={16} />, color: "text-green-600 bg-green-50" },
          { label: "Total Used", value: `${totalUsed}`, icon: <TrendingUp size={16} />, color: "text-blue-600 bg-blue-50" },
          { label: "Waste %", value: `${wastePercentage}%`, icon: <AlertTriangle size={16} />, color: "text-orange-600 bg-orange-50" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>{s.icon}</div>
            <p className="text-slate-900 mb-0.5" style={{ fontSize: "1.25rem", fontWeight: 700 }}>{s.value}</p>
            <p className="text-slate-600 text-xs" style={{ fontWeight: 500 }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Usage Report Section */}
      {showUsageReport && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-indigo-50/50">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-indigo-600" />
              <h2 className="text-slate-800 text-sm font-semibold">Material Usage Report</h2>
              <span className="text-xs text-slate-400 ml-2">
                {materialUsage.length} records
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors bg-white"
              >
                <RefreshCw size={10} /> Reset Filters
              </button>
              <button
                onClick={handleExportUsageReport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors bg-white"
              >
                <Download size={12} /> Export Report
              </button>
              <button
                onClick={() => loadMaterialUsage()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors bg-white"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-slate-400" />
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="From"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="To"
              />
            </div>

            <select
              value={jobTypeFilter}
              onChange={(e) => setJobTypeFilter(e.target.value as any)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Job Types</option>
              <option value="production">Production</option>
              <option value="sample">Sample</option>
            </select>

            <select
              value={materialFilter}
              onChange={(e) => setMaterialFilter(e.target.value)}
              className="px-2 py-1 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Materials</option>
              {uniqueMaterials.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            {(dateRange.from || dateRange.to || jobTypeFilter !== 'all' || materialFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
              >
                <X size={12} /> Clear Filters
              </button>
            )}
          </div>

          {/* Usage Summary - Top Materials */}
          {topMaterials.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border-b border-slate-100">
              {topMaterials.map(([name, data]) => (
                <div key={name} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500 font-medium truncate">{name}</p>
                  <p className="text-sm font-bold text-slate-800">{data.used} {data.unit}</p>
                  <p className="text-xs text-red-500">Waste: {data.waste} {data.unit}</p>
                </div>
              ))}
            </div>
          )}

          {/* Usage Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-border">
                  {["Date", "Job ID", "Job Type", "Material", "Quantity Used", "Waste", "Notes"].map((h) => (
                    <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materialUsage.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                      {dateRange.from || dateRange.to || jobTypeFilter !== 'all' || materialFilter !== 'all'
                        ? "No records match your filters"
                        : "No material usage records found"}
                    </td>
                  </tr>
                ) : (
                  materialUsage.map((log) => (
                    <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-600">{new Date(log.timestamp).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-indigo-600 font-semibold">{log.job_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${log.job_type === 'production' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                          {log.job_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">{log.inventory_item?.item || 'Unknown'}</td>
                      <td className="px-4 py-3 text-xs text-green-600 font-semibold">{log.quantity_used} {log.inventory_item?.unit || ''}</td>
                      <td className="px-4 py-3 text-xs text-red-500 font-semibold">{log.quantity_waste} {log.inventory_item?.unit || ''}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{log.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          {materialUsage.length > 0 && (
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                Total: {materialUsage.length} records
              </span>
              <span className="text-slate-600">
                Used: <span className="font-semibold text-green-600">{totalUsed}</span> ·
                Waste: <span className="font-semibold text-red-500">{totalWaste}</span> ·
                Waste %: <span className={`font-semibold ${wastePercentage > 10 ? 'text-red-500' : wastePercentage > 5 ? 'text-amber-500' : 'text-green-500'}`}>
                  {wastePercentage}%
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Low stock alert strip */}
      {lowStockCount > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
          <p className="text-amber-800 text-sm flex-1">
            <span style={{ fontWeight: 600 }}>{lowStockCount} items</span> are below minimum stock level. Consider reordering immediately.
          </p>
          <button
            onClick={() => {
              const lowStockItems = inventory.filter(i => i.current < i.min);
              alert(`Items to reorder:\n${lowStockItems.map(i => `- ${i.item}: ${i.current} ${i.unit} (Min: ${i.min})`).join('\n')}`);
            }}
            className="text-xs text-amber-700 border border-amber-300 px-3 py-1 rounded-lg hover:bg-amber-100 transition-colors flex-shrink-0"
            style={{ fontWeight: 500 }}
          >
            View Reorder List
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Inventory Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-border flex-wrap">
          <div className="relative flex-1 min-w-44">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search inventory..."
              className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 bg-white min-w-[180px]"
            style={{ fontWeight: 500 }}
          >
            <option value="All">All Categories</option>
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-xs text-slate-400 ml-auto">
            Showing {filtered.length} items
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {["Item", "Category", "Op/Blnce", "Received", "Total", "Issue", "C/L Bal", "Requirement", "Remarks", "Actions"].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-500 px-4 py-2.5 whitespace-nowrap" style={{ fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentItems.map((item) => {
                const opBal = item.opening_balance || 0;
                const recv = item.received || 0;
                const iss = item.issued || 0;
                const total = opBal + recv;
                const closingBal = total - iss;
                return (
                  <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-slate-800 text-xs" style={{ fontWeight: 500 }}>{item.item}</p>
                      <p className="text-slate-400 text-xs">#{item.id} · {item.unit}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded ${CATEGORY_COLORS[item.category] || "bg-slate-100 text-slate-600"}`} style={{ fontWeight: 500 }}>{item.category}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700 text-xs" style={{ fontWeight: 600 }}>{opBal}</td>
                    <td className="px-4 py-3 text-green-600 text-xs" style={{ fontWeight: 600 }}>{recv > 0 ? `+${recv}` : recv}</td>
                    <td className="px-4 py-3 text-slate-800 text-xs" style={{ fontWeight: 700 }}>{total}</td>
                    <td className="px-4 py-3 text-red-500 text-xs" style={{ fontWeight: 600 }}>{iss > 0 ? `-${iss}` : iss}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${closingBal <= 0 ? 'bg-red-50 text-red-700' : closingBal < (item.requirement || 0) ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                        {closingBal}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-indigo-600 text-xs" style={{ fontWeight: 600 }}>{item.requirement || 0}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate" title={item.remarks || '-'}>{item.remarks || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleEdit(item)} className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition-colors" title="Edit">
                          <Edit size={14} />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-border">
          <p className="text-xs text-slate-500">
            Showing {indexOfFirstItem + 1} - {Math.min(indexOfLastItem, filtered.length)} of {filtered.length} items
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages || 1}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}