import { useState, useEffect, useCallback } from "react";
import { api, supabase } from "../server/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Download,
  CheckCircle, Clock, XCircle, RefreshCw, FileText,
  CreditCard, PieChart as PieChartIcon, Search, Eye, Edit, Plus, X
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f59e0b", "#10b981", "#06b6d4"];

// ─── Helpers ──────────────────────────────────────────────────
const formatCurrency = (val: number) => `₹${(val || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
const formatCompact = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val || 0}`;
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Paid: "bg-green-50 text-green-700 border-green-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Overdue: "bg-red-50 text-red-700 border-red-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${styles[status] || "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function FinanceDashboard() {
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState("year");
  const [customerId, setCustomerId] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState("");
  const [search, setSearch] = useState("");

  // Data States
  const [kpis, setKpis] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [expenseData, setExpenseData] = useState<any>(null);
  const [invoiceAnalytics, setInvoiceAnalytics] = useState<any>(null);
  
  // Tables Data
  const [invoices, setInvoices] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [sundry, setSundry] = useState<any[]>([]);
  
  // Lookups
  const [customers, setCustomers] = useState<{id: string, name: string}[]>([]);
  // Create Invoice Modal State
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [productionJobs, setProductionJobs] = useState<any[]>([]);
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: "",
    productionJobId: "",
    quotationId: "",
    amount: 0,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    notes: "",
  });
  const [fallbackQuotationId, setFallbackQuotationId] = useState("");

  // Fetch production jobs when customer changes
  useEffect(() => {
    if (invoiceForm.customerId) {
      supabase.from("production_orders")
        .select("production_order_id, quotation_id, delivery_date, quotations!inner(customer_id, total_payment)")
        .eq("quotations.customer_id", invoiceForm.customerId)
        .then(({ data, error }) => {
          if (error) console.error("Error fetching production jobs:", error);
          setProductionJobs(data || []);
        });

      // Fetch a fallback quotation ID for standalone invoices
      supabase.from("quotations")
        .select("quotation_id")
        .eq("customer_id", invoiceForm.customerId)
        .order("created_at", { ascending: false })
        .limit(1)
        .then(({ data }) => {
          if (data && data.length > 0) setFallbackQuotationId(data[0].quotation_id);
          else setFallbackQuotationId("");
        });
    } else {
      setProductionJobs([]);
      setFallbackQuotationId("");
    }
  }, [invoiceForm.customerId]);

  // Auto-fill when production job is selected
  const handleProductionJobChange = (jobId: string) => {
    const job = productionJobs.find(j => j.production_order_id === jobId);
    if (job) {
      setInvoiceForm(prev => ({
        ...prev,
        productionJobId: jobId,
        quotationId: job.quotation_id || "",
        amount: job.quotations?.total_payment || 0,
        dueDate: job.delivery_date ? new Date(new Date(job.delivery_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0] : prev.dueDate
      }));
    } else {
      setInvoiceForm(prev => ({ ...prev, productionJobId: jobId }));
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load Customers for Dropdown
      if (customers.length === 0) {
        const custs = await api.getCustomers();
        if (custs) setCustomers(custs);
      }

      // RPC Params
      const params = { p_date_range: dateRange, p_customer_id: customerId || null };
      const kpiParams = { ...params, p_invoice_status: invoiceStatus || null, p_payment_status: null };

      // Fetch RPCs
      const [kpiRes, trendRes, expRes, invRes] = await Promise.all([
        supabase.rpc("get_finance_top_kpis", kpiParams),
        supabase.rpc("get_finance_trend_charts", params),
        supabase.rpc("get_finance_expense_analytics", { p_date_range: dateRange }),
        supabase.rpc("get_finance_invoice_analytics", { p_date_range: dateRange }),
      ]);

      setKpis(kpiRes.data || {});
      setTrendData(trendRes.data || []);
      setExpenseData(expRes.data || {});
      setInvoiceAnalytics(invRes.data || {});

      // Fetch Raw Table Data for the 3 Data Tables
      let invQuery = supabase.from("invoices").select("*, customers(name)").order("created_at", { ascending: false }).limit(20);
      if (customerId) invQuery = invQuery.eq("customer_id", customerId);
      if (invoiceStatus) invQuery = invQuery.eq("status", invoiceStatus);

      let advQuery = supabase.from("payments").select("*, customers(name)").eq("payment_type", "Advance").order("created_at", { ascending: false }).limit(20);
      if (customerId) advQuery = advQuery.eq("customer_id", customerId);

      let sundryQuery = supabase.from("sundry_expenses").select("*").order("expense_date", { ascending: false }).limit(20);
      if (customerId) sundryQuery = sundryQuery.eq("customer_id", customerId);

      const [invTable, advTable, sunTable] = await Promise.all([invQuery, advQuery, sundryQuery]);
      
      setInvoices(invTable.data || []);
      setAdvances(advTable.data || []);
      setSundry(sunTable.data || []);

    } catch (err) {
      console.error("Error loading finance data", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customerId, invoiceStatus, customers.length]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived KPI logic to match operational spec
  const pendingAmount = invoices.filter(i => i.status === 'Pending').reduce((sum, i) => sum + i.total_amount, 0);
  const overdueAmount = invoices.filter(i => i.status === 'Overdue').reduce((sum, i) => sum + i.total_amount, 0);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceForm.customerId) {
      alert("Please select a customer.");
      return;
    }
    if (invoiceForm.amount <= 0) {
      alert("Amount must be greater than 0.");
      return;
    }
    
    const finalQuotationId = invoiceForm.quotationId || fallbackQuotationId;
    if (!finalQuotationId) {
      alert("Cannot create invoice: No valid Quotation exists for this customer in the database, which is strictly required by the system.");
      return;
    }

    setCreating(true);
    try {
      // Get the next invoice ID format
      const { data: lastInv } = await supabase
        .from('invoices')
        .select('invoice_id')
        .like('invoice_id', 'INV-%')
        .order('invoice_id', { ascending: false })
        .limit(1);
      
      let nextNum = 1001;
      if (lastInv && lastInv.length > 0) {
        const lastNum = parseInt(lastInv[0].invoice_id.replace('INV-', ''), 10);
        if (!isNaN(lastNum)) nextNum = lastNum + 1;
      }
      const invoiceId = `INV-${String(nextNum).padStart(4, '0')}`;

      const { error } = await supabase.from('invoices').insert({
        invoice_id: invoiceId,
        invoice_number: invoiceId, // required
        quotation_id: finalQuotationId, // required
        customer_id: invoiceForm.customerId,
        production_order_id: invoiceForm.productionJobId || null,
        invoice_date: invoiceForm.issueDate,
        due_date: invoiceForm.dueDate,
        subtotal: invoiceForm.amount,
        tax_amount: 0, // required
        total_amount: invoiceForm.amount,
        status: 'Pending',
        notes: invoiceForm.notes
      });
      if (error) throw error;
      
      setShowCreateInvoice(false);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Failed to create invoice');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      
      {/* ─── Header & Global Filters ─── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex-shrink-0 z-10 sticky top-0 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Finance Operations</h1>
            <p className="text-sm text-slate-500">Day-to-day financial tracking and invoicing</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowCreateInvoice(true)} className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5 shadow-sm">
              <Plus size={14} /> Create Invoice
            </button>
            <button onClick={loadData} className="px-3 py-1.5 text-sm font-medium border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 text-slate-600">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button className="px-3 py-1.5 text-sm font-medium border border-slate-200 bg-white text-slate-600 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-sm">
              <Download size={14} /> Export PDF
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-w-[140px]">
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="ytd">Year to Date</option>
            <option value="all">All Time</option>
          </select>

          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-w-[180px]">
            <option value="">All Customers</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={invoiceStatus} onChange={e => setInvoiceStatus(e.target.value)} className="px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500">
            <option value="">All Invoice Status</option>
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Crunching financial data...</p>
          </div>
        ) : (
          <>
            {/* ─── Top KPI Cards ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KPICard title="Total Revenue" value={formatCurrency(kpis?.total_revenue)} icon={<DollarSign size={18} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
              <KPICard title="Pending Invoices" value={formatCurrency(pendingAmount)} icon={<Clock size={18} />} color="text-amber-600 bg-amber-50 border-amber-100" />
              <KPICard title="Overdue Invoices" value={formatCurrency(overdueAmount)} icon={<AlertCircle size={18} />} color="text-rose-600 bg-rose-50 border-rose-100" />
              <KPICard title="Total Expenses" value={formatCurrency(kpis?.total_sundry)} icon={<TrendingDown size={18} />} color="text-slate-600 bg-slate-50 border-slate-200" />
              <KPICard title="Net Profit" value={formatCurrency(kpis?.net_profit)} icon={<TrendingUp size={18} />} color="text-indigo-600 bg-indigo-50 border-indigo-100" />
            </div>

            {/* ─── Charts ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><PieChartIcon size={16} className="text-indigo-500"/> Invoice Status</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={invoiceAnalytics?.status_distribution || []} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={5}>
                        {COLORS.map((color, i) => <Cell key={`cell-${i}`} fill={color} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-1 border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><CreditCard size={16} className="text-rose-500"/> Expense Breakdown</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expenseData?.categories || []} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name">
                        {COLORS.map((color, i) => <Cell key={`cell-${i}`} fill={color} />)}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrency(val)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="lg:col-span-1 border border-slate-200 rounded-xl p-5 bg-white shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-emerald-500"/> Revenue vs Expense</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                      <YAxis tickFormatter={formatCompact} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" name="Revenue" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ─── Data Tables ─── */}
            <div className="space-y-6">
              
              {/* Invoices Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><FileText size={16} className="text-indigo-500"/> Invoice Management</h3>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..." className="pl-9 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Invoice #</th>
                        <th className="px-5 py-3 font-medium">Customer</th>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Due Date</th>
                        <th className="px-5 py-3 font-medium">Total</th>
                        <th className="px-5 py-3 font-medium">Outstanding</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                        <th className="px-5 py-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-semibold text-indigo-600">{inv.invoice_id}</td>
                          <td className="px-5 py-3 font-medium text-slate-700">{inv.customers?.name || inv.customer_id}</td>
                          <td className="px-5 py-3 text-slate-500">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-slate-500">{new Date(inv.due_date).toLocaleDateString()}</td>
                          <td className="px-5 py-3 font-semibold text-slate-700">{formatCurrency(inv.total_amount)}</td>
                          <td className="px-5 py-3 text-slate-600">{formatCurrency(inv.total_amount - (inv.amount_paid || 0))}</td>
                          <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                          <td className="px-5 py-3 text-right">
                            <button className="text-slate-400 hover:text-indigo-600 p-1"><Eye size={16} /></button>
                          </td>
                        </tr>
                      ))}
                      {invoices.length === 0 && (
                        <tr><td colSpan={8} className="text-center py-8 text-slate-400">No invoices found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Advance Payments Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><CreditCard size={16} className="text-green-500"/> Advance Payments</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Customer</th>
                        <th className="px-5 py-3 font-medium">Quotation</th>
                        <th className="px-5 py-3 font-medium">Amount</th>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Method</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {advances.map((adv, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-slate-700">{adv.customers?.name || adv.customer_id}</td>
                          <td className="px-5 py-3 text-indigo-600 font-medium">{adv.quotation_id}</td>
                          <td className="px-5 py-3 font-semibold text-emerald-600">{formatCurrency(adv.amount)}</td>
                          <td className="px-5 py-3 text-slate-500">{new Date(adv.payment_date).toLocaleDateString()}</td>
                          <td className="px-5 py-3 text-slate-600">{adv.payment_method}</td>
                          <td className="px-5 py-3"><StatusBadge status="Paid" /></td>
                        </tr>
                      ))}
                      {advances.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-8 text-slate-400">No advance payments found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sundry Expenses Table */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><CreditCard size={16} className="text-rose-500"/> Sundry Expenses</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-medium">Category</th>
                        <th className="px-5 py-3 font-medium">Vendor</th>
                        <th className="px-5 py-3 font-medium">Amount</th>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sundry.map((exp, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3 font-medium text-slate-700">{exp.expense_category}</td>
                          <td className="px-5 py-3 text-slate-600">{exp.vendor_name || 'N/A'}</td>
                          <td className="px-5 py-3 font-semibold text-rose-600">{formatCurrency(exp.total_amount)}</td>
                          <td className="px-5 py-3 text-slate-500">{new Date(exp.expense_date).toLocaleDateString()}</td>
                          <td className="px-5 py-3"><StatusBadge status={exp.is_approved ? "Approved" : "Pending"} /></td>
                        </tr>
                      ))}
                      {sundry.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-8 text-slate-400">No sundry expenses found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          </>
        )}
      </div>

      {/* ─── Create Invoice Modal ─── */}
      {showCreateInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 sticky top-0">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" /> Create New Invoice
              </h2>
              <button onClick={() => setShowCreateInvoice(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateInvoice} className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Customer <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={invoiceForm.customerId}
                    onChange={e => setInvoiceForm({...invoiceForm, customerId: e.target.value, productionJobId: "", quotationId: "", amount: 0})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  >
                    <option value="">Select Customer</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Production Job (Optional)</label>
                  <select
                    value={invoiceForm.productionJobId}
                    onChange={e => handleProductionJobChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    disabled={!invoiceForm.customerId}
                  >
                    <option value="">Standalone Invoice</option>
                    {productionJobs.map(j => <option key={j.production_order_id} value={j.production_order_id}>{j.production_order_id}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Issue Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.issueDate}
                    onChange={e => setInvoiceForm({...invoiceForm, issueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
                <div className="col-span-2 md:col-span-1 space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">Due Date <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.dueDate}
                    onChange={e => setInvoiceForm({...invoiceForm, dueDate: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Invoice Amount (₹) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                  <input
                    type="number"
                    required
                    min="1"
                    value={invoiceForm.amount || ''}
                    onChange={e => setInvoiceForm({...invoiceForm, amount: Number(e.target.value)})}
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">Notes / Remarks</label>
                <textarea
                  rows={3}
                  value={invoiceForm.notes}
                  onChange={e => setInvoiceForm({...invoiceForm, notes: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  placeholder="Optional payment terms or notes..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setShowCreateInvoice(false)}
                  className="px-4 py-2 font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-6 py-2 font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {creating ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  Generate Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) {
  return (
    <div className={`p-4 rounded-xl border bg-white shadow-sm`}>
      <div className="flex justify-between items-start mb-2">
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${color}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
    </div>
  );
}