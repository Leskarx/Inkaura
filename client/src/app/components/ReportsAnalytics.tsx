import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, ComposedChart
} from "recharts";
import {
  TrendingUp, Users, Briefcase, Cpu, Download, Target, DollarSign,
  Clock, Wrench, Filter, RefreshCw, ChevronDown, CheckCircle, ShieldAlert,
  Activity, BarChart2, Package, XCircle
} from "lucide-react";
import { supabase } from "@/lib/supabase";

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full flex items-center justify-center text-slate-400 text-sm py-10">
      {message}
    </div>
  );
}

export function ReportsAnalytics() {
  const [activeTab, setActiveTab] = useState("Finance");
  const [loading, setLoading] = useState(true);

  // Filters State
  const [dateRange, setDateRange] = useState("ALL");
  const [customerId, setCustomerId] = useState("ALL");
  const [machineId, setMachineId] = useState("ALL");
  const [status, setStatus] = useState("ALL");

  // Dropdown Options
  const [customers, setCustomers] = useState<any[]>([]);
  const [machines, setMachines] = useState<any[]>([]);
  const statuses = ["Pending", "In Progress", "In Production", "QC Pending", "Dispatch Pending", "Completed", "Delivered"];

  // Dashboard Data State
  const [topKpis, setTopKpis] = useState<any>({});
  const [financeData, setFinanceData] = useState<any>({});
  const [productionData, setProductionData] = useState<any>({});
  const [machineData, setMachineData] = useState<any>({});
  const [qualityData, setQualityData] = useState<any>({});
  const [customerData, setCustomerData] = useState<any>({});
  const [jobProfitability, setJobProfitability] = useState<any[]>([]);

  const tabs = ["Finance", "Production", "Machine & Capacity", "Quality & Delivery", "Customer & Sales", "Inventory", "Job Profitability"];

  // Fetch filter options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      const [{ data: cData }, { data: mData }] = await Promise.all([
        supabase.from('customers').select('id, name').order('name'),
        supabase.from('machines').select('id, name').order('name')
      ]);
      if (cData) setCustomers(cData);
      if (mData) setMachines(mData);
    };
    fetchOptions();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        p_date_range: dateRange,
        p_customer_id: customerId === "ALL" ? null : customerId,
        p_machine_id: machineId === "ALL" ? null : machineId,
        p_status: status
      };

      const [
        { data: top },
        { data: fin },
        { data: prod },
        { data: mach },
        { data: qual },
        { data: cust },
        { data: jobs }
      ] = await Promise.all([
        supabase.rpc("get_reports_top_kpis", params),
        supabase.rpc("get_reports_finance_kpis", params),
        supabase.rpc("get_reports_production_kpis", params),
        supabase.rpc("get_reports_machine_kpis", params),
        supabase.rpc("get_reports_quality_kpis", params),
        supabase.rpc("get_reports_customer_kpis", params),
        supabase.rpc("get_reports_job_profitability", params)
      ]);

      setTopKpis(top || {});
      setFinanceData(fin || { revenue_trend: [], receivables_aging: [], expense_breakdown: [], customer_profitability: [] });
      setProductionData(prod || { status_breakdown: [], turnaround_data: [], delay_analysis: [] });
      setMachineData(mach || { capacity_load: [], machine_roi: [] });
      setQualityData(qual || { defect_analysis: [], otif_trend: [] });
      setCustomerData(cust || { conversion_funnel: [] });
      setJobProfitability(jobs || []);
    } catch (err) {
      console.error("Error fetching reports data", err);
    } finally {
      setLoading(false);
    }
  }, [dateRange, customerId, machineId, status]);

  // Fetch data whenever filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetFilters = () => {
    setDateRange("ALL");
    setCustomerId("ALL");
    setMachineId("ALL");
    setStatus("ALL");
  };

  const handleExport = () => {
    window.print(); // Simple PDF export trigger via browser print dialog
  };

  const formatCurrency = (val: number) => `$${(val || 0).toLocaleString()}`;
  const formatPercent = (val: number) => `${(val || 0)}%`;

  const kpiList = [
    { label: "Net Revenue", value: formatCurrency(topKpis.net_revenue), trend: "--", up: true, icon: <DollarSign size={16} />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Total Cost", value: formatCurrency(topKpis.total_cost), trend: "--", up: false, icon: <TrendingUp size={16} />, color: "text-blue-600 bg-blue-50" },
    { label: "Outstanding Receivables", value: formatCurrency(topKpis.outstanding_receivables), trend: "--", up: false, icon: <Clock size={16} />, color: "text-red-600 bg-red-50" },
    { label: "OTIF Rate", value: formatPercent(topKpis.otif_rate), trend: "--", up: topKpis.otif_rate >= 90, icon: <Target size={16} />, color: "text-indigo-600 bg-indigo-50" },
    { label: "Avg Turnaround", value: `${topKpis.avg_turnaround || 0} Days`, trend: "--", up: true, icon: <Clock size={16} />, color: "text-purple-600 bg-purple-50" },
    { label: "Production Completion", value: formatPercent(topKpis.production_completion), trend: "--", up: true, icon: <CheckCircle size={16} />, color: "text-teal-600 bg-teal-50" },
    { label: "Avg Machine Util.", value: formatPercent(topKpis.avg_machine_util), trend: "--", up: true, icon: <Cpu size={16} />, color: "text-cyan-600 bg-cyan-50" },
    { label: "Maintenance Costs", value: formatCurrency(topKpis.maintenance_costs), trend: "--", up: false, icon: <Wrench size={16} />, color: "text-amber-600 bg-amber-50" },
    { label: "QC Failure Rate", value: formatPercent(topKpis.qc_failure_rate), trend: "--", up: topKpis.qc_failure_rate < 5, icon: <ShieldAlert size={16} />, color: "text-rose-600 bg-rose-50" },
  ];

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen print:p-0 print:bg-white">
      
      {/* 1. Header & Global Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h1 className="text-slate-900" style={{ fontSize: "1.25rem", fontWeight: 700 }}>Reports & Analytics</h1>
            <p className="text-slate-500 text-sm mt-0.5">Executive operational and financial performance dashboard</p>
          </div>
          <div className="flex gap-2">
            <button onClick={resetFilters} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              <XCircle size={13} /> Reset Filters
            </button>
            <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white" style={{ background: "#4f46e5", fontWeight: 500 }}>
              <Download size={13} /> Export Report
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
          {/* Date Range */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setDateRange("month")} className={`px-3 py-1 rounded text-xs font-semibold ${dateRange === 'month' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>This Month</button>
            <button onClick={() => setDateRange("quarter")} className={`px-3 py-1 rounded text-xs font-semibold ${dateRange === 'quarter' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>Quarter</button>
            <button onClick={() => setDateRange("ytd")} className={`px-3 py-1 rounded text-xs font-semibold ${dateRange === 'ytd' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>YTD</button>
            <button onClick={() => setDateRange("ALL")} className={`px-3 py-1 rounded text-xs font-semibold ${dateRange === 'ALL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>All Time</button>
          </div>
          
          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />
          
          {/* Customers Dropdown */}
          <div className="relative">
            <Filter size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <select 
              value={customerId} 
              onChange={(e) => setCustomerId(e.target.value)}
              className="pl-7 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-indigo-500 appearance-none min-w-[140px]"
            >
              <option value="ALL">All Customers</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Machines Dropdown */}
          <div className="relative">
            <Cpu size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <select 
              value={machineId} 
              onChange={(e) => setMachineId(e.target.value)}
              className="pl-7 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-indigo-500 appearance-none min-w-[140px]"
            >
              <option value="ALL">All Machines</option>
              {machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <CheckCircle size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              className="pl-7 pr-8 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 outline-none focus:border-indigo-500 appearance-none min-w-[140px]"
            >
              <option value="ALL">All Statuses</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Loading Indicator */}
          {loading && <RefreshCw size={14} className="animate-spin text-indigo-500 ml-2" />}
        </div>
      </div>

      {/* 2. Top Executive KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-9 gap-3">
        {kpiList.map((kpi, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow cursor-default">
            <div className="absolute bottom-0 right-0 opacity-10 transform translate-x-4 translate-y-4">
              <Activity size={64} className={kpi.up ? "text-emerald-500" : "text-red-500"} />
            </div>
            
            <div className="flex justify-between items-start mb-2 relative z-10">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.color}`}>{kpi.icon}</div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${kpi.up ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                {kpi.trend}
              </span>
            </div>
            <p className="text-slate-900 mb-0.5 relative z-10" style={{ fontSize: "1.1rem", fontWeight: 700 }}>{loading ? "..." : kpi.value}</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide relative z-10 font-semibold">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 3. Tabbed Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto custom-scrollbar print:hidden">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${activeTab === tab ? "border-indigo-600 text-indigo-700 bg-indigo-50/50" : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* --- TAB CONTENT --- */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
           <RefreshCw size={24} className="animate-spin text-indigo-500" />
        </div>
      ) : (
        <div className="print:block">
          {/* SECTION A: FINANCE */}
          {(activeTab === "Finance") && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-in fade-in duration-300 print:mb-8">
              
              <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Revenue vs Cost vs Profit Trend</h3>
                {!financeData.revenue_trend || financeData.revenue_trend.length === 0 ? <EmptyState message="No revenue data available for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={financeData.revenue_trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} formatter={(value: number) => [`$${value.toLocaleString()}`]} />
                      <Bar dataKey="revenue" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Gross Revenue" barSize={24} />
                      <Bar dataKey="cost" fill="#f87171" radius={[4, 4, 0, 0]} name="Total Cost" barSize={24} />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 4 }} name="Net Profit" />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Receivables Aging Summary</h3>
                {!financeData.receivables_aging || financeData.receivables_aging.length === 0 ? <EmptyState message="No aging data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart layout="vertical" data={financeData.receivables_aging} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="bucket" type="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar dataKey="amount" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                
                <h3 className="text-slate-900 text-sm mt-6 mb-4 font-semibold">Expense Breakdown</h3>
                {!financeData.expense_breakdown || financeData.expense_breakdown.length === 0 ? <EmptyState message="No expense data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={140}>
                    <PieChart>
                      <Pie data={financeData.expense_breakdown} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value" nameKey="name">
                        {financeData.expense_breakdown?.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={['#4f46e5', '#10b981', '#f59e0b', '#ec4899', '#94a3b8'][index % 5]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="xl:col-span-3 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Customer Profitability (Revenue vs Profit)</h3>
                {!financeData.customer_profitability || financeData.customer_profitability.length === 0 ? <EmptyState message="No customer profitability data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={financeData.customer_profitability} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="customer" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                      <YAxis yAxisId="right" orientation="right" hide />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar yAxisId="left" dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} name="Revenue" barSize={32} />
                      <Bar yAxisId="left" dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Profit" barSize={32} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* SECTION B: PRODUCTION */}
          {(activeTab === "Production") && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in duration-300 print:mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Production Status Breakdown</h3>
                {!productionData.status_breakdown || productionData.status_breakdown.length === 0 ? <EmptyState message="No status data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={productionData.status_breakdown} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="stage" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Planned vs Actual Turnaround (Days)</h3>
                {!productionData.turnaround_data || productionData.turnaround_data.length === 0 ? <EmptyState message="No turnaround data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={productionData.turnaround_data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar dataKey="planned" fill="#94a3b8" radius={[4, 4, 0, 0]} name="Planned" barSize={30} />
                      <Bar dataKey="actual" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Actual" barSize={30} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* SECTION C: MACHINE & CAPACITY */}
          {(activeTab === "Machine & Capacity") && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in duration-300 print:mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Machine Profitability / ROI</h3>
                {!machineData.machine_roi || machineData.machine_roi.length === 0 ? <EmptyState message="No machine ROI data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <ComposedChart data={machineData.machine_roi} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="machine" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar yAxisId="left" dataKey="revenueGen" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Revenue" barSize={24} />
                      <Bar yAxisId="left" dataKey="maintenance" fill="#ef4444" radius={[4, 4, 0, 0]} name="Maint. Cost" barSize={24} />
                      <Line yAxisId="right" type="monotone" dataKey="util" stroke="#8b5cf6" strokeWidth={2} name="Utilization %" dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Capacity Load View (Hrs)</h3>
                {!machineData.capacity_load || machineData.capacity_load.length === 0 ? <EmptyState message="No capacity load data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={machineData.capacity_load} margin={{ top: 0, right: 0, left: -20, bottom: 0 }} stackOffset="sign">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="machine" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar dataKey="booked" fill="#3b82f6" stackId="a" name="Booked Hrs" barSize={32} />
                      <Bar dataKey="available" fill="#10b981" stackId="a" name="Available Hrs" barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* SECTION D: QUALITY & DELIVERY */}
          {(activeTab === "Quality & Delivery") && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in duration-300 print:mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Defect Analysis (Pareto)</h3>
                {!qualityData.defect_analysis || qualityData.defect_analysis.length === 0 ? <EmptyState message="No defect data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart layout="vertical" data={qualityData.defect_analysis} margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="issue" type="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">OTIF Trend Over Time</h3>
                {!qualityData.otif_trend || qualityData.otif_trend.length === 0 ? <EmptyState message="No OTIF data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={qualityData.otif_trend} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ fill: "#10b981", r: 4 }} name="OTIF %" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* SECTION E: CUSTOMER & SALES */}
          {(activeTab === "Customer & Sales") && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 animate-in fade-in duration-300 print:mb-8">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <h3 className="text-slate-900 text-sm mb-4 font-semibold">Quotation Conversion Funnel</h3>
                {!customerData.conversion_funnel || customerData.conversion_funnel.length === 0 ? <EmptyState message="No funnel data for selected filters" /> : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart layout="vertical" data={customerData.conversion_funnel} margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="stage" type="category" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ fontSize: "12px", borderRadius: "8px" }} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* SECTION F: INVENTORY */}
          {(activeTab === "Inventory") && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-in fade-in duration-300 h-64 flex items-center justify-center print:mb-8">
              <div className="text-center">
                <Package size={40} className="text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Inventory Analytics</p>
                <p className="text-slate-400 text-xs mt-1">Stock trends derived from real-time material inventory tables</p>
              </div>
            </div>
          )}

          {/* SECTION G: JOB PROFITABILITY DEEP DIVE */}
          {(activeTab === "Job Profitability") && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm animate-in fade-in duration-300 print:mb-8">
              <h3 className="text-slate-900 text-sm mb-4 font-semibold">Job Profitability & Closure Deep Dive</h3>
              <div className="overflow-x-auto">
                {!jobProfitability || jobProfitability.length === 0 ? <EmptyState message="No job profitability records found for selected filters" /> : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Job ID</th>
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Customer</th>
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Revenue</th>
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Cost</th>
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Profit</th>
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Margin</th>
                        <th className="text-left text-xs text-slate-400 pb-2 pr-4 font-semibold">Delay</th>
                        <th className="text-left text-xs text-slate-400 pb-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobProfitability.map((job: any) => (
                        <tr key={job.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer">
                          <td className="py-2.5 pr-4 text-indigo-600 text-xs font-semibold">{job.id}</td>
                          <td className="py-2.5 pr-4 text-slate-800 text-xs font-medium">{job.client}</td>
                          <td className="py-2.5 pr-4 text-slate-600 text-xs">${job.rev.toLocaleString()}</td>
                          <td className="py-2.5 pr-4 text-slate-600 text-xs">${job.cost.toLocaleString()}</td>
                          <td className={`py-2.5 pr-4 text-xs font-bold ${job.profit < 0 ? 'text-red-600' : 'text-emerald-600'}`}>${job.profit.toLocaleString()}</td>
                          <td className={`py-2.5 pr-4 text-xs font-bold ${job.profit < 0 ? 'text-red-600' : 'text-slate-700'}`}>{job.margin}</td>
                          <td className={`py-2.5 pr-4 text-xs font-semibold ${job.delay > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{job.delay}d</td>
                          <td className="py-2.5 text-xs text-slate-500">{job.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
