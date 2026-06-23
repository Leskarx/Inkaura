import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  TrendingUp, Users, Clock, AlertCircle, FileText, CheckCircle, Briefcase, Activity, Calendar, Download, ChevronRight, PieChart as PieChartIcon, Package, Truck, ShieldCheck
} from "lucide-react";

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export function SalesDashboard() {
  const [role, setRole] = useState("Sales Executive");
  const [empId, setEmpId] = useState("");
  const [loadingKPIs, setLoadingKPIs] = useState(true);

  // SECTION 1: Global Filters
  const [dateRange, setDateRange] = useState("This Month");
  const [salesExecs, setSalesExecs] = useState<any[]>([]);
  const [selectedExec, setSelectedExec] = useState<string>("all");

  // SECTION 2: KPIs
  const [kpis, setKpis] = useState<any>({});
  
  // Lazy Loaded Sections
  const [loadingCharts, setLoadingCharts] = useState(true);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [quoteAnalytics, setQuoteAnalytics] = useState<any[]>([]);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [agingData, setAgingData] = useState<any[]>([]);

  useEffect(() => {
    // RBAC Initialization
    const uStr = localStorage.getItem("user");
    let currentRole = "Sales Executive";
    if (uStr) {
      try {
        const u = JSON.parse(uStr);
        currentRole = u.role || "Sales Executive";
        setRole(currentRole);
        setEmpId(u.id || "EMP001");
      } catch (e) {}
    }

    if (currentRole?.toLowerCase() === "admin") {
      fetchSalesExecs();
    }
  }, []);

  useEffect(() => {
    // Fast Initial Load whenever filters change
    fetchKPIs();
  }, [dateRange, selectedExec, empId]); // Re-fetch if selected exec changes

  const fetchSalesExecs = async () => {
    try {
      // Select all to handle schema differences (id vs employee_id, name vs full_name)
      const { data, error } = await supabase.from("users").select("*");
      if (error) throw error;
      
      // Filter out only the sales execs if there's a role column, otherwise return all to be safe
      const execs = data ? data.filter(u => u.role !== "Admin" && u.role?.toLowerCase() !== "admin") : [];
      setSalesExecs(execs.length > 0 ? execs : data || []);
    } catch (e) {
      console.warn("Failed to fetch execs", e);
    }
  };

  const getFilterEmpId = () => {
    return role?.toLowerCase() === "admin" ? (selectedExec === "all" ? null : selectedExec) : empId;
  };

  const fetchKPIs = async () => {
    if (!empId && role?.toLowerCase() !== "admin") return;
    
    setLoadingKPIs(true);
    try {
      // Calls the highly optimized RPC endpoint
      const { data, error } = await supabase.rpc("get_dashboard_summary", { emp_id: getFilterEmpId() });
      if (error) throw error;
      setKpis(data || {});
    } catch (e) {
      console.warn("RPC failed, ensure the SQL setup script was run.", e);
      // Fallback zero data
      setKpis({});
    } finally {
      setLoadingKPIs(false);
      lazyLoadCharts();
    }
  };

  const lazyLoadCharts = async () => {
    setLoadingCharts(true);
    try {
      // Parallelize fetching charts
      const targetEmpId = getFilterEmpId();
      const [revRes, colRes, funRes, qutRes, custRes] = await Promise.all([
        supabase.rpc("get_revenue_summary", { emp_id: targetEmpId }),
        supabase.rpc("get_collection_summary", { emp_id: targetEmpId }),
        supabase.rpc("get_funnel_summary", { emp_id: targetEmpId }),
        supabase.rpc("get_quotation_analytics", { emp_id: targetEmpId }),
        supabase.rpc("get_top_customers", { emp_id: targetEmpId })
      ]);
      
      setRevenueTrend(revRes.data?.length ? revRes.data : [{ month: 'Jan', revenue: 0 }]);
      setAgingData(colRes.data?.length ? colRes.data : [{ aging_bucket: '0-30 Days', overdue_amount: 0 }]);
      setFunnelData(funRes.data?.length ? funRes.data : [{ stage: "Customers", count: 0 }, { stage: "Quotations", count: 0 }, { stage: "Orders", count: 0 }, { stage: "Invoices", count: 0 }, { stage: "Payments", count: 0 }]);
      setQuoteAnalytics(qutRes.data?.length ? qutRes.data : [{ name: 'No Data', value: 0 }]);
      setTopCustomers(custRes.data?.length ? custRes.data : [{ company_name: "No Data", revenue: 0 }]);

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCharts(false);
    }
  };

  const formatCurrency = (val: number) => `₹${(val || 0).toLocaleString()}`;

  const handleExport = () => {
    alert("Exporting CSV...");
  };

  return (
    <div className="p-6 space-y-8 bg-slate-50 min-h-screen pb-20">
      {/* SECTION 1: GLOBAL FILTER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200 sticky top-0 z-10">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales Analytics</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-semibold">{role}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
            <Calendar size={14} className="text-slate-400" />
            <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="text-sm outline-none bg-transparent font-medium text-slate-700">
              <option>Today</option><option>This Week</option><option>This Month</option><option>This Quarter</option><option>This Year</option>
            </select>
          </div>
          {role?.toLowerCase() === "admin" && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Users size={14} className="text-slate-400" />
              <select 
                value={selectedExec}
                onChange={e => setSelectedExec(e.target.value)}
                className="text-sm outline-none bg-transparent font-medium text-slate-700 max-w-[150px] truncate"
              >
                <option value="all">All Sales Execs</option>
                {salesExecs.map(exec => {
                  const execId = exec.id || exec.employee_id;
                  const execName = exec.name || exec.full_name || exec.email;
                  return <option key={execId} value={execId}>{execName}</option>;
                })}
              </select>
            </div>
          )}
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {loadingKPIs ? (
        <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* SECTION 2: KPI CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <KPICard title={role?.toLowerCase() === "admin" ? "Total Revenue" : "My Revenue"} value={formatCurrency(kpis.revenue)} icon={<TrendingUp />} color="bg-green-50 text-green-600" />
            <KPICard title="Outstanding" value={formatCurrency(kpis.outstanding_amount)} icon={<Clock />} color="bg-amber-50 text-amber-600" />
            <KPICard title="Total Quotations" value={kpis.total_quotations || 0} icon={<FileText />} color="bg-indigo-50 text-indigo-600" />
            <KPICard title="Quotation Value" value={formatCurrency(kpis.quotation_value)} icon={<DollarSign />} color="bg-blue-50 text-blue-600" />
            <KPICard title="Orders Won" value={kpis.total_orders || 0} icon={<Briefcase />} color="bg-purple-50 text-purple-600" />
            <KPICard title="Conversion Rate" value={`${kpis.total_quotations ? (((kpis.approved_quotations || 0) / kpis.total_quotations) * 100).toFixed(1) : 0}%`} icon={<Activity />} color="bg-emerald-50 text-emerald-600" />
            <KPICard title="Active Customers" value={kpis.total_customers || 0} icon={<Users />} color="bg-cyan-50 text-cyan-600" />
            <KPICard title="Overdue Invoices" value={kpis.overdue_amount || 0} icon={<AlertCircle />} color="bg-red-50 text-red-600" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* SECTION 3: REVENUE ANALYTICS */}
            <div className="xl:col-span-2">
              <ChartCard title="Revenue Trend" loading={loadingCharts}>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={revenueTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} tickFormatter={v => `₹${v/1000}k`} />
                    <Tooltip formatter={(v:number) => formatCurrency(v)} />
                    <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={3} dot={{r:4}} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* SECTION 4: SALES FUNNEL */}
            <ChartCard title="Sales Funnel" loading={loadingCharts}>
              <div className="flex flex-col gap-3 py-2">
                {funnelData.map((stage, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 text-right text-xs font-medium text-slate-600">{stage.stage}</div>
                    <div className="flex-1 bg-slate-100 rounded-r-md h-6 overflow-hidden relative group cursor-pointer hover:bg-slate-200 transition-colors">
                      <div className="bg-indigo-500 h-full transition-all" style={{ width: `${Math.max((stage.count / Math.max(funnelData[0]?.count || 1, 1)) * 100, 2)}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-slate-700">{stage.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SECTION 5: QUOTATION ANALYTICS */}
            <ChartCard title="Quotation Analytics" loading={loadingCharts}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={quoteAnalytics} cx="50%" cy="50%" innerRadius={60} outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}>
                    {quoteAnalytics.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* SECTION 6: CUSTOMER ANALYTICS */}
            <ChartCard title="Top Customers" loading={loadingCharts}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topCustomers} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickFormatter={v => `₹${v/1000}k`} />
                  <YAxis type="category" dataKey="company_name" tick={{fontSize: 10}} width={120} />
                  <Tooltip formatter={(v:number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* SECTION 7, 8, 9: COMBINED VIEW FOR BREVITY */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ChartCard title="Collections Aging Analysis" loading={loadingCharts}>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={agingData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="aging_bucket" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} tickFormatter={v => `₹${v/1000}k`} />
                    <Tooltip formatter={(v:number) => formatCurrency(v)} />
                    <Bar dataKey="overdue_amount" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="flex flex-col gap-6">
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Truck size={16} className="text-indigo-600"/> Order Status</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-slate-600">Pending</span><span className="font-medium">0</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">In Production</span><span className="font-medium">0</span></div>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">Dispatched</span><span className="font-medium">0</span></div>
                  </div>
               </div>
               
               <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Package size={16} className="text-indigo-600"/> Top Products</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-600">No Data</span><span className="font-semibold text-indigo-600">0 qty</span></div>
                  </div>
               </div>
            </div>
          </div>

          {/* SECTION 10 & 11: ACTION CENTER & ADMIN VIEWS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><AlertCircle size={18} className="text-red-500" /> Action Center</h3>
              <div className="space-y-3">
                <div className="p-3 bg-red-50 border border-red-100 rounded-lg flex justify-between items-center cursor-pointer hover:bg-red-100 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-red-800">Overdue Invoices</p>
                    <p className="text-xs text-red-600 mt-0.5">{kpis.overdue_invoices || 0} invoices require immediate follow-up</p>
                  </div>
                  <ChevronRight size={16} className="text-red-400" />
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex justify-between items-center cursor-pointer hover:bg-amber-100 transition-colors">
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Pending Quotes</p>
                    <p className="text-xs text-amber-600 mt-0.5">0 quotes awaiting customer approval</p>
                  </div>
                  <ChevronRight size={16} className="text-amber-400" />
                </div>
              </div>
            </div>

            {role?.toLowerCase() === "admin" && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><ShieldCheck size={18} className="text-indigo-600" /> Employee Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr><th className="px-3 py-2">Rep</th><th className="px-3 py-2">Quotes</th><th className="px-3 py-2">Revenue</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-500">No data available</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}

// Icons
function DollarSign() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>; }

// Subcomponents
function KPICard({ title, value, icon, color }: { title: string, value: string|number, icon: React.ReactNode, color: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color} [&>svg]:w-4 [&>svg]:h-4`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-900 text-lg font-bold truncate leading-tight">{value}</p>
        <p className="text-slate-500 text-[11px] font-medium leading-tight mt-0.5">{title}</p>
      </div>
    </div>
  );
}

function ChartCard({ title, loading, children }: { title: string, loading: boolean, children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-4">{title}</h3>
      {loading ? (
        <div className="h-[200px] flex items-center justify-center"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        children
      )}
    </div>
  );
}
