import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Briefcase, CheckCircle, Clock, DollarSign, AlertTriangle,
  TrendingUp, TrendingDown, Users, ArrowRight, Cog, UserCheck,
  FlaskConical, Package, Truck, FileText, ShieldCheck, Box,
  ClipboardCheck, RefreshCw, BarChart2, IndianRupee,
  Factory, Layers, Star, ChevronRight,
} from "lucide-react";

// ─── Constants ───────────────────────────────────────────────
const CHART_COLORS = [
  "#4f46e5", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#eab308", "#f97316",
];

// ─── Helpers ─────────────────────────────────────────────────
const formatCurrency = (val: number | null | undefined) =>
  `₹${(val || 0).toLocaleString("en-IN")}`;

const formatCurrencyCompact = (val: number) => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000)   return `₹${(val / 100000).toFixed(1)}L`;
  if (val >= 1000)     return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val}`;
};

const getGrowthColor = (val: number) =>
  val > 0 ? "text-emerald-600" : val < 0 ? "text-red-500" : "text-slate-400";

const getGrowthIcon = (val: number) =>
  val > 0
    ? <TrendingUp size={12} className="text-emerald-500" />
    : val < 0
    ? <TrendingDown size={12} className="text-red-400" />
    : null;

// ─── Stage pipeline config ────────────────────────────────────
const STAGE_CONFIG: Record<string, { icon: React.ReactNode; color: string; ring: string }> = {
  Inquiry:     { icon: <Users size={12} />,       color: "bg-slate-400",   ring: "ring-slate-300" },
  Estimation:  { icon: <FileText size={12} />,    color: "bg-indigo-400",  ring: "ring-indigo-300" },
  Quotation:   { icon: <FileText size={12} />,    color: "bg-indigo-500",  ring: "ring-indigo-400" },
  Sample:      { icon: <FlaskConical size={12} />,color: "bg-violet-500",  ring: "ring-violet-400" },
  Approval:    { icon: <CheckCircle size={12} />, color: "bg-violet-600",  ring: "ring-violet-500" },
  "Advance Pmt":{ icon: <IndianRupee size={12} />,color: "bg-blue-500",   ring: "ring-blue-400" },
  "Job Order": { icon: <Briefcase size={12} />,   color: "bg-blue-600",    ring: "ring-blue-500" },
  Production:  { icon: <Cog size={12} />,         color: "bg-cyan-500",    ring: "ring-cyan-400" },
  QC:          { icon: <ShieldCheck size={12} />, color: "bg-teal-500",    ring: "ring-teal-400" },
  Packaging:   { icon: <Box size={12} />,         color: "bg-emerald-500", ring: "ring-emerald-400" },
  Dispatch:    { icon: <Truck size={12} />,       color: "bg-green-500",   ring: "ring-green-400" },
  Invoice:     { icon: <FileText size={12} />,    color: "bg-orange-500",  ring: "ring-orange-400" },
  Payment:     { icon: <DollarSign size={12} />,  color: "bg-rose-400",    ring: "ring-rose-300" },
  Closure:     { icon: <CheckCircle size={12} />, color: "bg-pink-500",    ring: "ring-pink-400" },
};

const ROLE_CONFIG: Record<string, { icon: React.ReactNode; color: string }> = {
  Admin:      { icon: <UserCheck size={12} />,      color: "bg-indigo-100 text-indigo-700" },
  Sales:      { icon: <Users size={12} />,           color: "bg-green-100 text-green-700" },
  Supervisor: { icon: <ClipboardCheck size={12} />,  color: "bg-amber-100 text-amber-700" },
  Operator:   { icon: <Cog size={12} />,             color: "bg-blue-100 text-blue-700" },
  Finance:    { icon: <DollarSign size={12} />,      color: "bg-rose-100 text-rose-700" },
  Inventory:  { icon: <Package size={12} />,         color: "bg-purple-100 text-purple-700" },
  QC:         { icon: <ShieldCheck size={12} />,     color: "bg-sky-100 text-sky-700" },
};

// ─── Sub-components ───────────────────────────────────────────

function Spinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" }[size];
  return (
    <div className={`${s} border-4 border-indigo-500 border-t-transparent rounded-full animate-spin`} />
  );
}

function SectionLoader({ height = "h-48" }: { height?: string }) {
  return (
    <div className={`${height} flex items-center justify-center`}>
      <Spinner />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
      <BarChart2 size={32} className="mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const MAP: Record<string, string> = {
    "In Progress":       "bg-indigo-50 text-indigo-700 border-indigo-200",
    "In Production":     "bg-indigo-50 text-indigo-700 border-indigo-200",
    Completed:           "bg-green-50 text-green-700 border-green-200",
    Delivered:           "bg-emerald-50 text-emerald-700 border-emerald-200",
    "QC Pending":        "bg-amber-50 text-amber-700 border-amber-200",
    Pending:             "bg-slate-100 text-slate-600 border-slate-200",
    Approved:            "bg-blue-50 text-blue-700 border-blue-200",
    Cancelled:           "bg-red-50 text-red-600 border-red-200",
    "On Hold":           "bg-orange-50 text-orange-700 border-orange-200",
    "Dispatch Pending":  "bg-purple-50 text-purple-700 border-purple-200",
    Dispatched:          "bg-teal-50 text-teal-700 border-teal-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border font-medium
        ${MAP[status] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {status || "Unknown"}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  growth?: number;
  icon: React.ReactNode;
  iconBg: string;
  border: string;
  onClick?: () => void;
}

function KpiCard({ label, value, subValue, growth, icon, iconBg, border, onClick }: KpiCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-4 shadow-sm ${border}
        ${onClick ? "cursor-pointer hover:shadow-md active:scale-[0.98]" : ""}
        transition-all duration-150`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        {growth !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${getGrowthColor(growth)}`}>
            {getGrowthIcon(growth)}
            {growth > 0 ? "+" : ""}{growth}%
          </div>
        )}
      </div>
      <p className="text-slate-900 text-xl font-bold leading-tight">{value}</p>
      {subValue && <p className="text-slate-500 text-xs mt-0.5">{subValue}</p>}
      <p className="text-slate-500 text-xs mt-1 leading-tight">{label}</p>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────
const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-bold text-slate-800">
            {typeof entry.value === "number" && entry.value > 999
              ? formatCurrencyCompact(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
export function AdminDashboard() {
  const navigate = useNavigate();

  const [loadingKPIs,    setLoadingKPIs]    = useState(true);
  const [loadingCharts,  setLoadingCharts]  = useState(true);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [lastRefreshed,  setLastRefreshed]  = useState<Date>(new Date());

  const [kpis,           setKpis]           = useState<any>({});
  const [pipeline,       setPipeline]       = useState<any[]>([]);
  const [revenueData,    setRevenueData]    = useState<any[]>([]);
  const [statusDist,     setStatusDist]     = useState<any[]>([]);
  const [printTypes,     setPrintTypes]     = useState<any[]>([]);
  const [recentJobs,     setRecentJobs]     = useState<any[]>([]);
  const [inventoryAlerts,setInventoryAlerts]= useState<any[]>([]);
  const [userRoles,      setUserRoles]      = useState<any[]>([]);
  const [actionCenter,   setActionCenter]   = useState<any>({});
  const [financeSummary, setFinanceSummary] = useState<any>({});
  const [monthlyComp,    setMonthlyComp]    = useState<any>({});

  // ── Fetch KPIs ───────────────────────────────────────────
  const fetchKPIs = useCallback(async () => {
    setLoadingKPIs(true);
    try {
      const { data, error } = await supabase.rpc("get_admin_kpis");
      if (error) throw error;
      setKpis(data || {});
    } catch (e) {
      console.error("KPI fetch error:", e);
    } finally {
      setLoadingKPIs(false);
    }
  }, []);

  // ── Fetch Charts ─────────────────────────────────────────
  const fetchCharts = useCallback(async () => {
    setLoadingCharts(true);
    try {
      const [
        pipeRes, revRes, statRes, printRes,
        jobsRes, invRes, userRes, actRes,
      ] = await Promise.allSettled([
        supabase.rpc("get_admin_pipeline"),
        supabase.rpc("get_admin_revenue_trend"),
        supabase.rpc("get_admin_job_status"),
        supabase.rpc("get_admin_print_types"),
        supabase.rpc("get_recent_jobs"),
        supabase.rpc("get_inventory_alerts"),
        supabase.rpc("get_user_role_overview"),
        supabase.rpc("get_admin_action_center"),
      ]);

      if (pipeRes.status  === "fulfilled") setPipeline(pipeRes.value.data || []);
      if (revRes.status   === "fulfilled") setRevenueData(revRes.value.data || []);
      if (statRes.status  === "fulfilled") setStatusDist(statRes.value.data || []);
      if (printRes.status === "fulfilled") setPrintTypes(printRes.value.data || []);
      if (jobsRes.status  === "fulfilled") setRecentJobs(jobsRes.value.data || []);
      if (invRes.status   === "fulfilled") setInventoryAlerts(invRes.value.data || []);
      if (userRes.status  === "fulfilled") setUserRoles(userRes.value.data || []);
      if (actRes.status   === "fulfilled") setActionCenter(actRes.value.data || {});
    } catch (e) {
      console.error("Chart fetch error:", e);
    } finally {
      setLoadingCharts(false);
    }
  }, []);

  // ── Fetch Finance ────────────────────────────────────────
  const fetchFinance = useCallback(async () => {
    setLoadingFinance(true);
    try {
      const [finRes, compRes] = await Promise.allSettled([
        supabase.rpc("get_admin_financial_summary"),
        supabase.rpc("get_admin_monthly_comparison"),
      ]);
      if (finRes.status  === "fulfilled") setFinanceSummary(finRes.value.data || {});
      if (compRes.status === "fulfilled") setMonthlyComp(compRes.value.data || {});
    } catch (e) {
      console.error("Finance fetch error:", e);
    } finally {
      setLoadingFinance(false);
    }
  }, []);

  // ── Initial Load ─────────────────────────────────────────
  useEffect(() => {
    fetchKPIs();
    fetchCharts();
    fetchFinance();
  }, [fetchKPIs, fetchCharts, fetchFinance]);

  // ── Manual Refresh ───────────────────────────────────────
  const handleRefresh = () => {
    setLastRefreshed(new Date());
    fetchKPIs();
    fetchCharts();
    fetchFinance();
  };

  // ── KPI list config ───────────────────────────────────────
  const kpiList: KpiCardProps[] = [
    {
      label:   "Revenue (MTD)",
      value:   formatCurrencyCompact(kpis.revenue_mtd || 0),
      subValue: `vs ${formatCurrencyCompact(kpis.revenue_last_month || 0)} last month`,
      growth:  kpis.revenue_growth,
      icon:    <IndianRupee size={16} />,
      iconBg:  "bg-purple-100 text-purple-600",
      border:  "border-purple-100",
      onClick: () => navigate("/finance"),
    },
    {
      label:   "Active Jobs",
      value:   kpis.active_jobs || 0,
      subValue: "In production pipeline",
      icon:    <Factory size={16} />,
      iconBg:  "bg-amber-100 text-amber-600",
      border:  "border-amber-100",
      onClick: () => navigate("/production-jobs"),
    },
    {
      label:   "Completed (MTD)",
      value:   kpis.completed_jobs || 0,
      subValue: "Jobs finished this month",
      icon:    <CheckCircle size={16} />,
      iconBg:  "bg-green-100 text-green-600",
      border:  "border-green-100",
      onClick: () => navigate("/production-jobs"),
    },
    {
      label:   "Pending Payments",
      value:   formatCurrencyCompact(kpis.pending_payments || 0),
      subValue: "Unpaid invoices",
      icon:    <AlertTriangle size={16} />,
      iconBg:  "bg-red-100 text-red-600",
      border:  "border-red-100",
      onClick: () => navigate("/finance"),
    },
    {
      label:   "Total Customers",
      value:   kpis.total_customers || 0,
      subValue: "Registered accounts",
      icon:    <Users size={16} />,
      iconBg:  "bg-sky-100 text-sky-600",
      border:  "border-sky-100",
      onClick: () => navigate("/customers"),
    },
    {
      label:   "Open Quotations",
      value:   kpis.open_quotations || 0,
      subValue: "Draft & sent",
      icon:    <FileText size={16} />,
      iconBg:  "bg-indigo-100 text-indigo-600",
      border:  "border-indigo-100",
      onClick: () => navigate("/quotations"),
    },
    {
      label:   "QC Pending",
      value:   kpis.qc_pending || 0,
      subValue: "Awaiting quality check",
      icon:    <ShieldCheck size={16} />,
      iconBg:  "bg-teal-100 text-teal-600",
      border:  "border-teal-100",
      onClick: () => navigate("/qc"),
    },
    {
      label:   "Low Stock Items",
      value:   kpis.low_stock_count || 0,
      subValue: "Below minimum level",
      icon:    <Package size={16} />,
      iconBg:  "bg-orange-100 text-orange-600",
      border:  "border-orange-100",
      onClick: () => navigate("/inventory"),
    },
  ];

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-screen">

      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-slate-900 text-xl font-bold">Global Admin Dashboard</h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Live Company Overview · Last updated {lastRefreshed.toLocaleTimeString("en-IN")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200
              rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            onClick={() => navigate("/reports")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600
              rounded-lg text-white hover:bg-indigo-700 transition-colors"
          >
            <BarChart2 size={12} /> Reports
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────── */}
      {loadingKPIs ? (
        <SectionLoader height="h-32" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          {kpiList.map((card) => (
            <KpiCard key={card.label} {...card} />
          ))}
        </div>
      )}

      {/* ── Financial Quick Summary ───────────────────────── */}
      {!loadingFinance && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Total Invoiced",
              value: formatCurrencyCompact(financeSummary.total_invoiced || 0),
              color: "text-slate-800",
              bg: "bg-white",
            },
            {
              label: "Total Collected",
              value: formatCurrencyCompact(financeSummary.total_collected || 0),
              color: "text-green-700",
              bg: "bg-green-50",
            },
            {
              label: "Total Pending",
              value: formatCurrencyCompact(financeSummary.total_pending || 0),
              color: "text-orange-700",
              bg: "bg-orange-50",
            },
            {
              label: "Overdue Amount",
              value: formatCurrencyCompact(financeSummary.total_overdue || 0),
              color: "text-red-700",
              bg: "bg-red-50",
            },
          ].map((item) => (
            <div
              key={item.label}
              className={`${item.bg} rounded-xl border border-slate-200 px-4 py-3
                flex items-center justify-between shadow-sm`}
            >
              <span className="text-slate-500 text-xs">{item.label}</span>
              <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {loadingCharts ? (
        <SectionLoader height="h-64" />
      ) : (
        <>
          {/* ── Pipeline ──────────────────────────────────── */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-slate-900 text-sm font-bold">Business Workflow Pipeline</h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Live job count at each stage of the production lifecycle
                </p>
              </div>
              <Layers size={16} className="text-slate-300" />
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex items-center gap-0 min-w-max">
                {pipeline.length === 0 ? (
                  <EmptyState message="No pipeline data" />
                ) : (
                  pipeline.map((stage: any, idx: number) => {
                    const cfg = STAGE_CONFIG[stage.label] ?? {
                      icon: <Clock size={12} />,
                      color: "bg-slate-300",
                      ring: "ring-slate-200",
                    };
                    const isHot = stage.count > 0;
                    return (
                      <div key={stage.step} className="flex items-center">
                        <div className="flex flex-col items-center w-[68px] group">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center
                              text-white mb-1 transition-all duration-200
                              ${cfg.color}
                              ${isHot ? `ring-2 ring-offset-1 ${cfg.ring} shadow-md` : "opacity-60"}
                              group-hover:scale-110 group-hover:opacity-100`}
                          >
                            {cfg.icon}
                          </div>
                          <span className="text-slate-900 font-bold text-xs leading-tight text-center">
                            {stage.count}
                          </span>
                          <span
                            className="text-slate-400 text-center leading-tight mt-0.5"
                            style={{ fontSize: "9px", fontWeight: 500 }}
                          >
                            {stage.label}
                          </span>
                        </div>
                        {idx < pipeline.length - 1 && (
                          <div className="flex items-center mb-4 mx-0.5">
                            <div className="w-3 h-px bg-slate-200" />
                            <ChevronRight size={10} className="text-slate-300 -ml-0.5" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ── Revenue + Job Status ─────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Revenue Area Chart */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-slate-900 text-sm font-semibold">Revenue Performance</h3>
                  <p className="text-slate-400 text-xs mt-0.5">Monthly revenue vs target (₹)</p>
                </div>
                <button
                  onClick={() => navigate("/finance")}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  View detail <ArrowRight size={11} />
                </button>
              </div>
              {revenueData.length === 0 ? (
                <EmptyState message="No revenue data yet" />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart
                    data={revenueData}
                    margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="tgtGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#94a3b8" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false}
                      tickFormatter={(v) => formatCurrencyCompact(v)}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Area
                      type="monotone" dataKey="revenue" name="Revenue"
                      stroke="#4f46e5" strokeWidth={2.5}
                      fill="url(#revGradient)"
                      dot={{ fill: "#4f46e5", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Area
                      type="monotone" dataKey="target" name="Target"
                      stroke="#94a3b8" strokeWidth={1.5}
                      fill="url(#tgtGradient)"
                      strokeDasharray="4 4"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Job Status Pie */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="mb-3">
                <h3 className="text-slate-900 text-sm font-semibold">Production Status</h3>
                <p className="text-slate-400 text-xs mt-0.5">Current job distribution</p>
              </div>
              {statusDist.length === 0 ? (
                <EmptyState message="No status data" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={statusDist}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={70}
                        paddingAngle={2}
                        dataKey="value" nameKey="name"
                      >
                        {statusDist.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2 max-h-[100px] overflow-y-auto pr-1">
                    {statusDist.map((item: any, i: number) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="text-slate-600 truncate max-w-[110px]" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                        <span className="text-slate-800 font-semibold">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Print Types + Action Center + Workforce ───── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Print Type Bar Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-slate-900 text-sm font-semibold mb-4">Print Type Analysis</h3>
              {printTypes.length === 0 ? (
                <EmptyState message="No data available" />
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={printTypes}
                    margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="type"
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "#94a3b8" }}
                      axisLine={false} tickLine={false}
                    />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Bar
                      dataKey="count" name="Jobs"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                    >
                      {printTypes.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Action Center */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-slate-900 text-sm font-semibold mb-4 flex items-center gap-2">
                <AlertTriangle size={15} className="text-red-500" />
                Action Center
              </h3>
              <div className="space-y-2.5">
                {[
                  {
                    label:  "Delayed Jobs",
                    count:  actionCenter.delayed_jobs,
                    sub:    "missed delivery date",
                    bg:     "bg-red-50 border-red-100 hover:bg-red-100",
                    txt:    "text-red-800",
                    sub_c:  "text-red-600",
                    arrow:  "text-red-400",
                    nav:    "/production-jobs",
                  },
                  {
                    label:  "Sample Approvals",
                    count:  actionCenter.sample_approvals,
                    sub:    "waiting for approval",
                    bg:     "bg-violet-50 border-violet-100 hover:bg-violet-100",
                    txt:    "text-violet-800",
                    sub_c:  "text-violet-600",
                    arrow:  "text-violet-400",
                    nav:    "/sample-jobs",
                  },
                  {
                    label:  "Pending Approvals",
                    count:  actionCenter.pending_approvals,
                    sub:    "workflow approvals",
                    bg:     "bg-amber-50 border-amber-100 hover:bg-amber-100",
                    txt:    "text-amber-800",
                    sub_c:  "text-amber-600",
                    arrow:  "text-amber-400",
                    nav:    "/production",
                  },
                  {
                    label:  "Open Quotations",
                    count:  actionCenter.pending_quotations,
                    sub:    "need review",
                    bg:     "bg-indigo-50 border-indigo-100 hover:bg-indigo-100",
                    txt:    "text-indigo-800",
                    sub_c:  "text-indigo-600",
                    arrow:  "text-indigo-400",
                    nav:    "/quotations",
                  },
                  {
                    label:  "Overdue Collections",
                    count:  actionCenter.overdue_invoices,
                    sub:    "unpaid invoices past due",
                    bg:     "bg-rose-50 border-rose-100 hover:bg-rose-100",
                    txt:    "text-rose-800",
                    sub_c:  "text-rose-600",
                    arrow:  "text-rose-400",
                    nav:    "/finance",
                  },
                  {
                    label:  "Unverified Advances",
                    count:  actionCenter.unverified_payments,
                    sub:    "advance not verified",
                    bg:     "bg-orange-50 border-orange-100 hover:bg-orange-100",
                    txt:    "text-orange-800",
                    sub_c:  "text-orange-600",
                    arrow:  "text-orange-400",
                    nav:    "/finance",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={() => navigate(item.nav)}
                    className={`p-2.5 border rounded-lg flex justify-between items-center
                      cursor-pointer transition-colors ${item.bg}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className={`text-xs font-semibold ${item.txt}`}>{item.label}</p>
                        {(item.count || 0) > 0 && (
                          <span className={`text-xs font-bold ${item.txt}
                            bg-white rounded-full px-1.5 py-0 border`}>
                            {item.count}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs mt-0.5 ${item.sub_c}`}>
                        {item.count || 0} {item.sub}
                      </p>
                    </div>
                    <ArrowRight size={13} className={item.arrow} />
                  </div>
                ))}
              </div>
            </div>

            {/* Workforce Overview */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-900 text-sm font-semibold">Workforce Overview</h3>
                <button
                  onClick={() => navigate("/employees")}
                  className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                >
                  Manage <ArrowRight size={11} />
                </button>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {userRoles.length === 0 ? (
                  <EmptyState message="No employee data" />
                ) : (
                  userRoles.map((r: any) => {
                    const cfg = ROLE_CONFIG[r.role] ?? {
                      icon: <Users size={12} />,
                      color: "bg-slate-100 text-slate-700",
                    };
                    const maxUsers = Math.max(...userRoles.map((x: any) => x.users), 1);
                    return (
                      <div
                        key={r.role}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border
                          border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => navigate("/employees")}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center
                          flex-shrink-0 ${cfg.color}`}>
                          {cfg.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-slate-700 truncate">
                              {r.role}
                            </span>
                            <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                              {r.users} users
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-all"
                              style={{ width: `${(r.users / maxUsers) * 100}%` }}
                            />
                          </div>
                          {r.recent_logins > 0 && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              {r.recent_logins} active this week
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {userRoles.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between text-xs">
                  <span className="text-slate-500">Total active employees</span>
                  <span className="text-slate-900 font-bold">
                    {userRoles.reduce((a: number, r: any) => a + r.users, 0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Recent Jobs + Inventory Alerts ────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

            {/* Recent Jobs Table */}
            <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-slate-900 text-sm font-semibold">Recent Production Jobs</h3>
                <button
                  onClick={() => navigate("/production-jobs")}
                  className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                >
                  View all <ArrowRight size={11} />
                </button>
              </div>

              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {["Job ID", "Client", "Type", "Delivery", "Value", "Status"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-slate-400 pb-2 pr-3 whitespace-nowrap font-medium"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentJobs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          No jobs found
                        </td>
                      </tr>
                    ) : (
                      recentJobs.map((job: any) => (
                        <tr
                          key={job.id}
                          onClick={() => navigate("/production-jobs")}
                          className="border-b border-slate-50 hover:bg-slate-50/60
                            transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 pr-3 text-indigo-600 font-semibold font-mono">
                            {job.id}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-800 font-medium whitespace-nowrap max-w-[120px] truncate">
                            {job.client || "Unknown"}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                            {job.type || "—"}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">
                            {job.due
                              ? new Date(job.due).toLocaleDateString("en-IN", {
                                  day: "2-digit", month: "short",
                                })
                              : "TBD"}
                          </td>
                          <td className="py-2.5 pr-3 text-slate-800 font-semibold">
                            {formatCurrencyCompact(job.value || 0)}
                          </td>
                          <td className="py-2.5">
                            <StatusBadge status={job.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory Alerts */}
            <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                <h3 className="text-slate-900 text-sm font-semibold">Low Stock Alerts</h3>
                <span className="ml-auto text-xs text-amber-700 bg-amber-50
                  border border-amber-200 px-2 py-0.5 rounded font-medium">
                  {inventoryAlerts.length} items
                </span>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                {inventoryAlerts.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-400">
                    <Star size={28} className="mb-2 text-green-400" />
                    <p className="text-sm font-medium text-green-600">All levels healthy</p>
                    <p className="text-xs mt-0.5">No low stock alerts</p>
                  </div>
                ) : (
                  inventoryAlerts.map((item: any, idx: number) => {
                    const pct = Math.min(
                      Math.round((item.current / Math.max(item.min, 1)) * 100),
                      100
                    );
                    const isVeryLow = pct < 25;
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg border
                          ${isVeryLow
                            ? "bg-red-50 border-red-100"
                            : "bg-amber-50 border-amber-100"}`}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="min-w-0">
                            <p className="text-slate-800 text-xs font-semibold truncate">
                              {item.item}
                            </p>
                            <p className="text-slate-500 text-xs">{item.category}</p>
                          </div>
                          <span
                            className={`text-xs font-bold ml-2 flex-shrink-0
                              ${isVeryLow ? "text-red-700" : "text-amber-700"}`}
                          >
                            {item.current} {item.unit}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="flex-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all
                                ${isVeryLow ? "bg-red-500" : "bg-amber-500"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-slate-400 text-xs flex-shrink-0">
                            Min: {item.min}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 text-xs">
                            {item.location || "Warehouse"}
                          </span>
                          <button
                            onClick={() => navigate("/inventory")}
                            className={`text-xs border px-2 py-0.5 rounded transition-colors font-medium
                              ${isVeryLow
                                ? "text-red-700 border-red-300 hover:bg-red-100"
                                : "text-amber-700 border-amber-300 hover:bg-amber-100"}`}
                          >
                            Reorder ({item.reorder} {item.unit})
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {inventoryAlerts.length > 0 && (
                <button
                  onClick={() => navigate("/inventory")}
                  className="mt-3 w-full text-xs text-center text-amber-700
                    border border-amber-200 rounded-lg py-2 hover:bg-amber-50 transition-colors font-medium"
                >
                  View All Inventory
                </button>
              )}
            </div>
          </div>

          {/* ── Monthly Comparison ────────────────────────── */}
          {!loadingFinance && monthlyComp.current_month && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-slate-900 text-sm font-semibold mb-4">
                Month-over-Month Comparison
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { label: "Revenue",       key: "revenue",        format: (v: number) => formatCurrencyCompact(v) },
                  { label: "New Customers", key: "new_customers",  format: (v: number) => v.toString() },
                  { label: "Quotations",    key: "new_quotations", format: (v: number) => v.toString() },
                  { label: "Completed Jobs",key: "completed_jobs", format: (v: number) => v.toString() },
                  { label: "New Invoices",  key: "new_invoices",   format: (v: number) => v.toString() },
                ].map((metric) => {
                  const curr = monthlyComp.current_month?.[metric.key] || 0;
                  const prev = monthlyComp.previous_month?.[metric.key] || 0;
                  const change = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
                  return (
                    <div key={metric.label} className="text-center p-3 rounded-lg bg-slate-50 border border-slate-100">
                      <p className="text-slate-500 text-xs mb-1">{metric.label}</p>
                      <p className="text-slate-900 text-lg font-bold">{metric.format(curr)}</p>
                      <p className="text-slate-400 text-xs mt-0.5">
                        prev: {metric.format(prev)}
                      </p>
                      {prev > 0 && (
                        <div className={`flex items-center justify-center gap-1 mt-1 text-xs font-semibold ${getGrowthColor(change)}`}>
                          {getGrowthIcon(change)}
                          {change > 0 ? "+" : ""}{change}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}