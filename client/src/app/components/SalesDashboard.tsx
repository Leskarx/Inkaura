import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, ComposedChart,
} from "recharts";
import {
  Users, Clock, AlertCircle, FileText,
  CheckCircle, Briefcase, Download,
  Package, Truck, ShieldCheck, IndianRupee,
  RefreshCw, ArrowRight, Wallet, Receipt,
} from "lucide-react";
import { api } from "../server/api";

// ─── Constants ────────────────────────────────────────────────
const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const STATUS_COLORS: Record<string, string> = {
  Draft:           '#94a3b8',
  Sent:            '#3b82f6',
  Approved:        '#10b981',
  Rejected:        '#ef4444',
  'In Production': '#8b5cf6',
  Completed:       '#10b981',
};

// ─── Helpers ──────────────────────────────────────────────────
const fmt = (val: number | null | undefined): string => {
  const v = val || 0;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000)   return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000)     return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
};

// ─── Sub-components ───────────────────────────────────────────

function Spinner() {
  return (
    <div className="w-7 h-7 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  );
}

function SectionLoader() {
  return (
    <div className="h-40 flex items-center justify-center">
      <Spinner />
    </div>
  );
}

function KPICard({ title, value, sub, sub2, icon, color, border }: {
  title:  string;
  value:  string | number;
  sub?:   string;
  sub2?:  string;
  icon:   React.ReactNode;
  color:  string;
  border: string;
}) {
  return (
    <div className={`bg-white rounded-xl border ${border} p-4 shadow-sm hover:shadow-md transition-all`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${color}`}>
        {icon}
      </div>
      <p className="text-slate-900 text-xl font-bold leading-tight">{value}</p>
      {sub  && <p className="text-slate-400 text-xs mt-0.5">{sub}</p>}
      {sub2 && <p className="text-slate-400 text-xs mt-0.5">{sub2}</p>}
      <p className="text-slate-500 text-xs mt-1 leading-tight">{title}</p>
    </div>
  );
}

function ChartCard({ title, loading, children, action, subtitle }: {
  title:     string;
  loading:   boolean;
  children:  React.ReactNode;
  action?:   React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-slate-900 text-sm font-semibold">{title}</h3>
        {action}
      </div>
      {subtitle && <p className="text-xs text-slate-400 mb-4">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {loading ? <SectionLoader /> : children}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-700 mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-600">{entry.name}:</span>
          <span className="font-bold text-slate-900">
            {typeof entry.value === 'number' && entry.value > 0
              ? fmt(entry.value)
              : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
export function SalesDashboard() {
  const navigate = useNavigate();

  const [currentEmployee, setCurrentEmployee] = useState<any>(null);
  const [empId,           setEmpId]           = useState<number | null>(null);
  const [isAdmin,         setIsAdmin]         = useState(false);
  const [initialized,     setInitialized]     = useState(false);

  const [selectedExecId,  setSelectedExecId]  = useState<number | null>(null);
  const [salesExecs,      setSalesExecs]      = useState<any[]>([]);

  const [loadingKPIs,     setLoadingKPIs]     = useState(true);
  const [loadingCharts,   setLoadingCharts]   = useState(true);

  const [kpis,            setKpis]            = useState<any>({});
  const [revenueTrend,    setRevenueTrend]    = useState<any[]>([]);
  const [paymentTrend,    setPaymentTrend]    = useState<any[]>([]);
  const [funnelData,      setFunnelData]      = useState<any[]>([]);
  const [quoteAnalytics,  setQuoteAnalytics]  = useState<any[]>([]);
  const [topCustomers,    setTopCustomers]    = useState<any[]>([]);
  const [agingData,       setAgingData]       = useState<any[]>([]);
  const [orderStatus,     setOrderStatus]     = useState<any>({});
  const [topProducts,     setTopProducts]     = useState<any[]>([]);
  const [empPerformance,  setEmpPerformance]  = useState<any[]>([]);
  const [recentQuotes,    setRecentQuotes]    = useState<any[]>([]);

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const emp = await api.getCurrentEmployee();
      if (emp) {
        setCurrentEmployee(emp);
        setEmpId(emp.employee_id);
        const adminAccess = emp.role.toLowerCase() === 'admin';
        setIsAdmin(adminAccess);
        if (adminAccess) fetchSalesExecs();
      }
      setInitialized(true);
    };
    init();
  }, []);

  const fetchSalesExecs = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_id, full_name, role')
        .eq('is_active', true)
        .order('full_name');
      if (!error) setSalesExecs(data || []);
    } catch (e) {
      console.error('Failed to fetch execs:', e);
    }
  };

  const getTargetEmpId = useCallback((): number | null => {
    if (isAdmin) return selectedExecId;
    return empId;
  }, [isAdmin, selectedExecId, empId]);

  // ── Load KPIs (auto-refreshes materialized view) ──────────
  const loadKPIs = useCallback(async () => {
    setLoadingKPIs(true);
    try {
      await supabase.rpc('refresh_dashboard_mvs');

      const targetId = getTargetEmpId();
      const { data, error } = await supabase.rpc(
        'get_dashboard_summary',
        { emp_id: targetId }
      );

      if (error) {
        const { data: mvData } = await supabase
          .from('sales_dashboard_summary')
          .select('*');

        if (mvData) {
          if (targetId === null) {
            const totals = mvData.reduce((acc: any, row: any) => {
              Object.keys(row).forEach(k => {
                if (k !== 'created_by') {
                  acc[k] = (acc[k] || 0) + (Number(row[k]) || 0);
                }
              });
              return acc;
            }, {});
            setKpis(totals);
          } else {
            setKpis(mvData.find((r: any) => r.created_by === targetId) || {});
          }
        }
        return;
      }

      setKpis(data || {});
    } catch (e) {
      console.error('KPI error:', e);
      setKpis({});
    } finally {
      setLoadingKPIs(false);
    }
  }, [getTargetEmpId]);

  // ── Load Charts ─────────────────────────────────────────────
  const loadCharts = useCallback(async () => {
    setLoadingCharts(true);
    const targetId = getTargetEmpId();

    try {
      const [
        revRes, payRes, colRes, funRes,
        qutRes, custRes, ordRes, prodRes, quotesRes,
      ] = await Promise.allSettled([
        supabase.rpc('get_revenue_summary',      { emp_id: targetId }),
        supabase.rpc('get_payment_trend',         { emp_id: targetId }),
        supabase.rpc('get_collection_summary',   { emp_id: targetId }),
        supabase.rpc('get_funnel_summary',        { emp_id: targetId }),
        supabase.rpc('get_quotation_analytics',  { emp_id: targetId }),
        supabase.rpc('get_top_customers',         { emp_id: targetId }),
        supabase.rpc('get_order_status_summary', { emp_id: targetId }),
        supabase.rpc('get_top_products',          { emp_id: targetId }),
        supabase.rpc('get_recent_quotations',     { emp_id: targetId }),
      ]);

      if (revRes.status    === 'fulfilled' && !revRes.value.error)    setRevenueTrend(revRes.value.data    || []);
      if (payRes.status    === 'fulfilled' && !payRes.value.error)    setPaymentTrend(payRes.value.data    || []);
      if (colRes.status    === 'fulfilled' && !colRes.value.error)    setAgingData(colRes.value.data       || []);
      if (funRes.status    === 'fulfilled' && !funRes.value.error)    setFunnelData(funRes.value.data      || []);
      if (qutRes.status    === 'fulfilled' && !qutRes.value.error)    setQuoteAnalytics(qutRes.value.data  || []);
      if (custRes.status   === 'fulfilled' && !custRes.value.error)   setTopCustomers(custRes.value.data   || []);
      if (ordRes.status    === 'fulfilled' && !ordRes.value.error)    setOrderStatus(ordRes.value.data     || {});
      if (prodRes.status   === 'fulfilled' && !prodRes.value.error)   setTopProducts(prodRes.value.data    || []);
      if (quotesRes.status === 'fulfilled' && !quotesRes.value.error) setRecentQuotes(quotesRes.value.data || []);

      if (isAdmin) {
        const perfRes = await supabase.rpc('get_employee_performance');
        if (!perfRes.error) setEmpPerformance(perfRes.data || []);
      }
    } catch (e) {
      console.error('Chart error:', e);
    } finally {
      setLoadingCharts(false);
    }
  }, [getTargetEmpId, isAdmin]);

  // ── Trigger loads ────────────────────────────────────────────
  useEffect(() => {
    if (!initialized) return;
    loadKPIs();
    loadCharts();
  }, [initialized, empId, isAdmin, selectedExecId]);

  const handleRefresh = () => {
    loadKPIs();
    loadCharts();
  };

  // ── Derived ──────────────────────────────────────────────────
  const conversionRate = kpis.total_quotations
    ? ((kpis.approved_quotations || 0) / kpis.total_quotations * 100).toFixed(1)
    : '0.0';

  const totalCollected = (kpis.advance_collected || 0) + (kpis.invoice_collected || 0);

  const quoteAnalyticsColored = quoteAnalytics.map((item: any) => ({
    ...item,
    fill: STATUS_COLORS[item.name] || '#94a3b8',
  }));

  // ── Action Center items with navigation ──────────────────────
  const actionItems = [
    {
      label: 'Overdue Invoices',
      desc:  `${kpis.overdue_invoices_count || 0} invoices past due date`,
      value: fmt(kpis.overdue_amount),
      show:  (kpis.overdue_invoices_count || 0) > 0,
      nav:   '/finance',
      bg:    'bg-red-50 border-red-100 hover:bg-red-100',
      txt:   'text-red-800',
      sub:   'text-red-600',
      arrow: 'text-red-400',
    },
    {
      label: 'Pending Quotations',
      desc:  `${kpis.sent_quotations || 0} quotes awaiting customer approval`,
      value: `${kpis.sent_quotations || 0}`,
      show:  true,
      nav:   '/quotations',
      bg:    'bg-amber-50 border-amber-100 hover:bg-amber-100',
      txt:   'text-amber-800',
      sub:   'text-amber-600',
      arrow: 'text-amber-400',
    },
    {
      label: 'Draft Quotations',
      desc:  `${kpis.draft_quotations || 0} quotes not yet sent to customer`,
      value: `${kpis.draft_quotations || 0}`,
      show:  true,
      nav:   '/quotations',
      bg:    'bg-slate-50 border-slate-100 hover:bg-slate-100',
      txt:   'text-slate-800',
      sub:   'text-slate-500',
      arrow: 'text-slate-400',
    },
    {
      label: 'Invoice Outstanding',
      desc:  'Total invoice balance not yet collected',
      value: fmt(kpis.outstanding_amount),
      show:  true,
      nav:   '/finance',
      bg:    'bg-orange-50 border-orange-100 hover:bg-orange-100',
      txt:   'text-orange-800',
      sub:   'text-orange-600',
      arrow: 'text-orange-400',
    },
    {
      label: 'Advance Collected',
      desc:  'Advance payments at quotation stage',
      value: fmt(kpis.advance_collected),
      show:  (kpis.advance_collected || 0) > 0,
      nav:   '/finance',
      bg:    'bg-blue-50 border-blue-100 hover:bg-blue-100',
      txt:   'text-blue-800',
      sub:   'text-blue-600',
      arrow: 'text-blue-400',
    },
  ].filter(item => item.show);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="p-5 space-y-5 bg-slate-50 min-h-screen">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-slate-900 text-xl font-bold">Sales Dashboard</h1>
            {currentEmployee && (
              <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                isAdmin ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}>
                {currentEmployee.role}
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs mt-0.5">
            {currentEmployee?.full_name} · {isAdmin ? 'Global View' : 'My Performance'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Users size={13} className="text-slate-400" />
              <select
                value={selectedExecId ?? 'all'}
                onChange={(e) => setSelectedExecId(
                  e.target.value === 'all' ? null : Number(e.target.value)
                )}
                className="text-xs outline-none bg-transparent font-medium text-slate-700"
              >
                <option value="all">All Employees</option>
                {salesExecs.map((e) => (
                  <option key={e.employee_id} value={e.employee_id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200
              rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>

          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-600
              text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* ── Dashboard Content ───────────────────────────────── */}
      {loadingKPIs || loadingCharts ? (
        <div className="h-96 flex flex-col items-center justify-center gap-3">
          <Spinner />
          <p className="text-sm text-slate-500">Loading Dashboard Data...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── KPI Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              title="Invoice Revenue"
              value={fmt(kpis.revenue)}
              sub={`MTD: ${fmt(kpis.monthly_revenue)}`}
              icon={<IndianRupee size={16} />}
              color="bg-green-100 text-green-600"
              border="border-green-100"
            />
            <KPICard
              title="Advance Collected"
              value={fmt(kpis.advance_collected)}
              sub="From quotation-stage payments"
              icon={<Wallet size={16} />}
              color="bg-blue-100 text-blue-600"
              border="border-blue-100"
            />
            <KPICard
              title="Invoice Collected"
              value={fmt(kpis.invoice_collected)}
              sub="Against invoice payments"
              icon={<Receipt size={16} />}
              color="bg-indigo-100 text-indigo-600"
              border="border-indigo-100"
            />
            <KPICard
              title="Total Collected"
              value={fmt(totalCollected)}
              sub="Advance + Invoice"
              icon={<CheckCircle size={16} />}
              color="bg-emerald-100 text-emerald-600"
              border="border-emerald-100"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KPICard
              title="Outstanding"
              value={fmt(kpis.outstanding_amount)}
              sub="Invoice balance unpaid"
              icon={<Clock size={16} />}
              color="bg-amber-100 text-amber-600"
              border="border-amber-100"
            />
            <KPICard
              title="Overdue"
              value={fmt(kpis.overdue_amount)}
              sub={`${kpis.overdue_invoices_count || 0} invoices past due`}
              icon={<AlertCircle size={16} />}
              color="bg-red-100 text-red-600"
              border="border-red-100"
            />
            <KPICard
              title="Quotations"
              value={kpis.total_quotations || 0}
              sub={`Value: ${fmt(kpis.quotation_value)}`}
              sub2={`${conversionRate}% conversion`}
              icon={<FileText size={16} />}
              color="bg-slate-100 text-slate-600"
              border="border-slate-100"
            />
            <KPICard
              title="Orders"
              value={kpis.total_orders || 0}
              sub={`${kpis.active_orders || 0} active · ${kpis.completed_orders || 0} done`}
              icon={<Briefcase size={16} />}
              color="bg-purple-100 text-purple-600"
              border="border-purple-100"
            />
          </div>

      {/* ── Payment Collection Banner ────────────────────────── */}
      {!loadingKPIs && (kpis.advance_collected > 0 || kpis.invoice_collected > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900">Payment Collection Breakdown</h3>
            <span className="text-xs text-slate-400">Advance vs Invoice</span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blue-600 font-medium">Advance ({fmt(kpis.advance_collected)})</span>
              <span className="text-indigo-600 font-medium">Invoice ({fmt(kpis.invoice_collected)})</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden flex">
              {(() => {
                const total  = (kpis.advance_collected || 0) + (kpis.invoice_collected || 0);
                const advPct = total > 0 ? (kpis.advance_collected / total) * 100 : 50;
                const invPct = 100 - advPct;
                return (
                  <>
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{
                        width:        `${advPct}%`,
                        borderRadius: invPct > 0 ? '9999px 0 0 9999px' : '9999px',
                      }}
                    />
                    {invPct > 0 && (
                      <div
                        className="h-full bg-indigo-500 transition-all"
                        style={{ width: `${invPct}%`, borderRadius: '0 9999px 9999px 0' }}
                      />
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex justify-between text-xs mt-1 text-slate-400">
              <span>
                Total collected: <strong className="text-slate-700">{fmt(totalCollected)}</strong>
              </span>
              <span>
                Outstanding: <strong className="text-amber-600">{fmt(kpis.outstanding_amount)}</strong>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Revenue + Payment Trend ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <ChartCard
          title="Invoice Revenue Trend"
          loading={loadingCharts}
          subtitle="Monthly invoiced amounts"
        >
          {revenueTrend.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
              <IndianRupee size={28} className="opacity-30" />
              <p>No invoice data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#4f46e5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone" dataKey="revenue" name="Invoiced"
                  stroke="#4f46e5" strokeWidth={2.5} fill="url(#revGrad)"
                  dot={{ fill: '#4f46e5', r: 3 }} activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Payment Collections Trend"
          loading={loadingCharts}
          subtitle="Advance vs Invoice payments by month"
        >
          {paymentTrend.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
              <Wallet size={28} className="opacity-30" />
              <p>No payment data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={paymentTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => fmt(v)} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="advance" name="Advance" fill="#3b82f6" radius={[3, 3, 0, 0]} stackId="a" />
                <Bar dataKey="invoice" name="Invoice" fill="#10b981" radius={[3, 3, 0, 0]} stackId="a" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Sales Funnel + Quote Analytics ───────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        <ChartCard title="Sales Funnel" loading={loadingCharts} subtitle="Pipeline stages">
          <div className="flex flex-col gap-2.5 py-1">
            {funnelData.length === 0 ? (
              <p className="text-center text-slate-400 text-sm py-8">No data</p>
            ) : (
              funnelData.map((stage: any, i: number) => {
                const maxCount = funnelData[0]?.count || 1;
                const pct      = Math.max((stage.count / maxCount) * 100, 2);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-20 text-right text-xs font-medium text-slate-600 flex-shrink-0">
                      {stage.stage}
                    </div>
                    <div className="flex-1 bg-slate-100 rounded-md h-6 overflow-hidden relative">
                      <div
                        className="h-full rounded-md transition-all"
                        style={{
                          width:      `${pct}%`,
                          background: COLORS[i % COLORS.length],
                          opacity:    0.85,
                        }}
                      />
                      <span className="absolute inset-0 flex items-center px-2 text-xs font-bold text-slate-700">
                        {stage.count}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ChartCard>

        <div className="xl:col-span-2">
          <ChartCard
            title="Quotation Status Breakdown"
            loading={loadingCharts}
            subtitle="Distribution by status"
          >
            {quoteAnalytics.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
                No quotations yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={quoteAnalyticsColored}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={2}
                    dataKey="value" nameKey="name"
                  >
                    {quoteAnalyticsColored.map((entry: any, i: number) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [val, name]}
                    contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                  />
                  <Legend
                    formatter={(value) => (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      </div>

      {/* ── Top Customers + Aging ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <ChartCard title="Top Customers" loading={loadingCharts} subtitle="By invoice revenue">
          {topCustomers.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-400 text-sm">
              No data yet
            </div>
          ) : (
            <div className="space-y-3">
              {topCustomers.map((c: any, i: number) => {
                const maxRev = topCustomers[0]?.revenue || 1;
                const pct    = Math.max((c.revenue / maxRev) * 100, 2);
                return (
                  <div
                    key={i}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate('/customers')}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-600">#{i + 1}</span>
                        <span className="text-xs font-medium text-slate-700 truncate max-w-[140px]">
                          {c.company_name}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{fmt(c.revenue)}</p>
                        {c.advance > 0 && (
                          <p className="text-xs text-blue-500">+{fmt(c.advance)} advance</p>
                        )}
                      </div>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Collections Aging"
          loading={loadingCharts}
          subtitle="Overdue invoice breakdown"
        >
          {agingData.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-slate-400 text-sm gap-1">
              <CheckCircle size={28} className="text-green-400" />
              <p className="text-green-600 font-medium">No overdue invoices</p>
              <p className="text-xs">All payments are up to date</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={agingData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="aging_bucket"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false} tickLine={false}
                  tickFormatter={(v) => fmt(v)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="overdue_amount" name="Overdue" radius={[4, 4, 0, 0]}>
                  {agingData.map((_: any, i: number) => (
                    <Cell
                      key={i}
                      fill={i === 0 ? '#f59e0b' : i === 1 ? '#f97316' : i === 2 ? '#ef4444' : '#b91c1c'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ── Order Status + Top Products ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-slate-900 text-sm font-semibold mb-1 flex items-center gap-2">
            <Truck size={15} className="text-indigo-600" /> Order Status
          </h3>
          <p className="text-xs text-slate-400 mb-4">Production pipeline</p>
          {loadingCharts ? <SectionLoader /> : (
            <div className="space-y-3">
              {[
                { label: 'Pending',     key: 'pending',     color: 'bg-slate-400',  pct_color: '#94a3b8', nav: '/production-jobs' },
                { label: 'In Progress', key: 'in_progress', color: 'bg-indigo-500', pct_color: '#6366f1', nav: '/production-jobs' },
                { label: 'QC Pending',  key: 'qc_pending',  color: 'bg-amber-500',  pct_color: '#f59e0b', nav: '/qc'             },
                { label: 'Completed',   key: 'completed',   color: 'bg-green-500',  pct_color: '#10b981', nav: '/production-jobs' },
                { label: 'Dispatched',  key: 'dispatched',  color: 'bg-purple-500', pct_color: '#8b5cf6', nav: '/dispatch'       },
              ].map((item) => {
                const val   = orderStatus[item.key] || 0;
                const total = Object.values(orderStatus).reduce(
                  (a: any, b: any) => a + b, 0
                ) as number;
                const pct = total > 0 ? (val / total) * 100 : 0;
                return (
                  <div
                    key={item.key}
                    className="cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(item.nav)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-xs text-slate-600">{item.label}</span>
                      </div>
                      <span className="text-xs font-semibold text-slate-900">{val}</span>
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: item.pct_color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-slate-900 text-sm font-semibold mb-1 flex items-center gap-2">
            <Package size={15} className="text-indigo-600" /> Top Products
          </h3>
          <p className="text-xs text-slate-400 mb-4">By quantity ordered</p>
          {loadingCharts ? <SectionLoader /> : (
            <div className="space-y-3">
              {topProducts.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4">No data yet</p>
              ) : (
                topProducts.map((p: any, i: number) => {
                  const maxQty = topProducts[0]?.total_qty || 1;
                  const pct    = Math.max((p.total_qty / maxQty) * 100, 2);
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-indigo-600 flex-shrink-0">
                            #{i + 1}
                          </span>
                          <span className="text-xs text-slate-700 truncate">{p.product_name}</span>
                        </div>
                        <span className="text-xs font-semibold text-slate-500 flex-shrink-0 ml-2">
                          {(p.total_qty || 0).toLocaleString()} pcs
                        </span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Action Center + Recent Quotes ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Action Center — every item now navigates */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-slate-900 text-sm font-semibold mb-4 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-500" /> Action Center
          </h3>
          <div className="space-y-2.5">
            {actionItems.map((item) => (
              <div
                key={item.label}
                onClick={() => navigate(item.nav)}
                className={`p-3 border rounded-lg flex items-center justify-between
                  cursor-pointer transition-all active:scale-[0.98] ${item.bg}`}
              >
                <div>
                  <p className={`text-xs font-semibold ${item.txt}`}>{item.label}</p>
                  <p className={`text-xs mt-0.5 ${item.sub}`}>{item.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${item.txt}`}>{item.value}</span>
                  <ArrowRight size={13} className={item.arrow} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Quotations — clicking navigates to quotation page */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-900 text-sm font-semibold">Recent Quotations</h3>
            <button
              onClick={() => navigate('/quotations')}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              View all
            </button>
          </div>
          {loadingCharts ? <SectionLoader /> : (
            <div className="divide-y divide-slate-50">
              {recentQuotes.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  No quotations yet
                </div>
              ) : (
                recentQuotes.map((q: any) => {
                  const statusColor: Record<string, string> = {
                    Draft:    'bg-slate-100 text-slate-600',
                    Sent:     'bg-blue-100 text-blue-700',
                    Approved: 'bg-green-100 text-green-700',
                    Rejected: 'bg-red-100 text-red-700',
                  };
                  return (
                    <div
                      key={q.quotation_id}
                      onClick={() => navigate('/quotations')}
                      className="flex items-center justify-between px-5 py-3
                        hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-indigo-600 text-xs font-bold font-mono">
                            {q.quotation_id}
                          </p>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium
                            ${statusColor[q.status] || 'bg-slate-100 text-slate-600'}`}>
                            {q.status}
                          </span>
                          {q.advance_paid > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                              {fmt(q.advance_paid)} adv
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 text-xs font-medium truncate">
                          {q.customer_name}
                        </p>
                        <p className="text-slate-400 text-xs">
                          {new Date(q.quotation_date).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short',
                          })}
                          {q.created_by_name && ` · ${q.created_by_name}`}
                        </p>
                      </div>
                      <p className="text-slate-900 text-sm font-bold flex-shrink-0 ml-3">
                        {fmt(q.total_payment)}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Employee Performance (Admin only) ───────────────── */}
      {isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-900 text-sm font-semibold flex items-center gap-2">
              <ShieldCheck size={15} className="text-indigo-600" />
              Employee Performance
            </h3>
            <button
              onClick={() => navigate('/employees')}
              className="text-xs text-indigo-600 hover:underline font-medium"
            >
              Manage
            </button>
          </div>
          {loadingCharts ? <SectionLoader /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Employee', 'Quotations', 'Approved', 'Conversion', 'Advance', 'Invoice Rev', 'Total'].map(h => (
                      <th
                        key={h}
                        className="text-left text-xs text-slate-400 px-4 py-2.5 font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empPerformance.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400 text-sm">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    empPerformance.map((emp: any, i: number) => (
                      <tr
                        key={i}
                        className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate('/employees')}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                              {emp.name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span className="text-xs font-medium text-slate-800">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-700">{emp.quotations || 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-green-600 font-medium">{emp.approved || 0}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-indigo-500"
                                style={{ width: `${Math.min(emp.conversion_rate || 0, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-700">{emp.conversion_rate || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-blue-600 font-medium">{fmt(emp.advance)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-slate-700">{fmt(emp.revenue)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-slate-900">
                            {fmt(emp.total_collected)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
        </div>
      )}
    </div>
  );
}