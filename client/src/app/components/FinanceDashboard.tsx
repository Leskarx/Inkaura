import { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, AlertCircle, Download,
  Plus, CheckCircle, Clock, XCircle, RefreshCw, Save, X,
  FileText, Eye, Receipt,
} from "lucide-react";
import { api, supabase } from "../server/api";

// ─── Types ────────────────────────────────────────────────────
interface Invoice {
  id: string;
  invoice_id: string;
  client: string;
  customer_id: string;
  amount: number;
  subtotal: number;
  total_amount: number;
  due: string;
  due_date: string;
  issued: string;
  invoice_date: string;
  status: "Paid" | "Pending" | "Overdue";
  payment_status: string;
  quotationId?: string;
  productionJobId?: string;
  notes?: string;
  created_at: string;
}

interface MonthlyData {
  month: string;
  revenue: number;
  expense: number;
}

interface ExpenseCategory {
  category: string;
  amount: number;
  pct: number;
}

interface AdvancePayment {
  id: number;
  payment_id: string;
  quotation_id: string;
  amount: number;
  payment_type: string;
  payment_method: string;
  payment_date: string;
  notes: string;
  customer_name: string;
  created_at: string;
}

// ─── Constants ────────────────────────────────────────────────
const expenseColors = [
  "bg-indigo-500", "bg-purple-500", "bg-amber-500",
  "bg-green-500", "bg-sky-500", "bg-slate-400",
];

const INVOICE_STATUS_OPTIONS = ["Paid", "Pending", "Overdue"] as const;

// ─── Helpers ──────────────────────────────────────────────────
function resolveInvoiceStatus(inv: any): "Paid" | "Pending" | "Overdue" {
  if (inv.payment_status === "Paid" || inv.status === "Paid") return "Paid";
  if (
    inv.status === "Overdue" ||
    (inv.due_date &&
      new Date(inv.due_date) < new Date() &&
      inv.payment_status !== "Paid")
  )
    return "Overdue";
  return "Pending";
}

// ─── StatusBadge ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Paid: "bg-green-50 text-green-700 border-green-200",
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    Overdue: "bg-red-50 text-red-700 border-red-200",
  };
  const icons: Record<string, React.ReactNode> = {
    Paid: <CheckCircle size={10} />,
    Pending: <Clock size={10} />,
    Overdue: <XCircle size={10} />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium ${styles[status] || "bg-slate-50 text-slate-600 border-slate-200"
        }`}
    >
      {icons[status]} {status}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────
export function FinanceDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [revenueMonthly, setRevenueMonthly] = useState<MonthlyData[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<ExpenseCategory[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [advancePayments, setAdvancePayments] = useState<AdvancePayment[]>([]);
  const [productionJobs, setProductionJobs] = useState<
    {
      id: string;
      product: string;
      customer: string;
      value: number;
      quantity: number;
      status: string;
      quotationId: string;
    }[]
  >([]);

  // KPI stats
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [netProfit, setNetProfit] = useState(0);
  const [margin, setMargin] = useState("0");
  const [pendingAmount, setPendingAmount] = useState(0);
  const [overdueAmount, setOverdueAmount] = useState(0);
  const [totalAdvanceReceived, setTotalAdvanceReceived] = useState(0);

  // Create invoice modal
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    customerId: "",
    productionJobId: "",
    amount: 0,
    issueDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    notes: "",
    manualAmount: false,
  });

  // View invoice modal
  const [showViewInvoice, setShowViewInvoice] = useState(false);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);

  // Status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ─── Load finance data ──────────────────────────────────────
  const loadFinanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      const customersData = await api.getCustomers();
      setCustomers(customersData.map((c) => ({ id: c.id, name: c.name })));

      const customerMap: Record<string, string> = {};
      customersData.forEach((c) => {
        customerMap[c.id] = c.name;
      });

      // Fetch invoices
      const { data: invoicesData, error: invoicesError } = await supabase
        .from("invoices")
        .select("*")
        .order("created_at", { ascending: false });

      if (invoicesError) {
        console.error("Error fetching invoices:", invoicesError);
      }

      // ── Fetch Advance Payments ──────────────────────────────
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .eq("payment_type", "advance")
        .order("created_at", { ascending: false });

      if (paymentsError) {
        console.error("Error fetching advance payments:", paymentsError);
      }

      // Map advance payments with customer names
      const mappedPayments: AdvancePayment[] = (paymentsData || []).map((p: any) => ({
        ...p,
        customer_name: customerMap[p.customer_id] || 'Unknown',
        payment_id: p.payment_id?.toString() || `PAY-${p.id}`,
      }));
      setAdvancePayments(mappedPayments);

      // Calculate total advance received
      const totalAdvance = mappedPayments.reduce((sum, p) => sum + p.amount, 0);
      setTotalAdvanceReceived(totalAdvance);

      // ── Monthly revenue/expense from invoices ──────────────
      const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
      ];
      const monthlyMap: Record<string, { revenue: number; expense: number }> = {};
      months.forEach((m) => {
        monthlyMap[m] = { revenue: 0, expense: 0 };
      });

      (invoicesData || []).forEach((inv: any) => {
        const date = new Date(inv.invoice_date || inv.created_at);
        const monthName = months[date.getMonth()];
        const amount = inv.total_amount || inv.amount || 0;
        if (monthlyMap[monthName]) {
          monthlyMap[monthName].revenue += amount;
          monthlyMap[monthName].expense += amount * 0.6;
        }
      });

      // Also add advance payments to revenue
      (paymentsData || []).forEach((p: any) => {
        const date = new Date(p.payment_date);
        const monthName = months[date.getMonth()];
        if (monthlyMap[monthName]) {
          monthlyMap[monthName].revenue += p.amount;
          monthlyMap[monthName].expense += p.amount * 0.6;
        }
      });

      // Last 6 months
      const currentMonth = new Date().getMonth();
      const last6Months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        last6Months.push(months[(currentMonth - i + 12) % 12]);
      }

      const monthlyData: MonthlyData[] = last6Months.map((month) => ({
        month,
        revenue: Math.round(monthlyMap[month]?.revenue || 0),
        expense: Math.round(monthlyMap[month]?.expense || 0),
      }));

      setRevenueMonthly(monthlyData);

      const rev = monthlyData.reduce((s, m) => s + m.revenue, 0);
      const exp = monthlyData.reduce((s, m) => s + m.expense, 0);
      const profit = rev - exp;

      setTotalRevenue(rev);
      setTotalExpense(exp);
      setNetProfit(profit);
      setMargin(rev > 0 ? ((profit / rev) * 100).toFixed(1) : "0");

      // ── Map invoices ────────────────────────────────────────
      const mappedInvoices: Invoice[] = (invoicesData || []).map((inv: any) => {
        const amount = inv.total_amount || inv.amount || 0;
        const status = resolveInvoiceStatus(inv);
        return {
          id: inv.invoice_id,
          invoice_id: inv.invoice_id,
          client: customerMap[inv.customer_id] || inv.customer_name || "Unknown",
          customer_id: inv.customer_id,
          amount,
          subtotal: inv.subtotal || 0,
          total_amount: amount,
          due: inv.due_date
            ? new Date(inv.due_date).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })
            : "N/A",
          due_date: inv.due_date,
          issued: inv.invoice_date
            ? new Date(inv.invoice_date).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            })
            : new Date(inv.created_at).toLocaleDateString("en-US", {
              month: "short", day: "numeric", year: "numeric",
            }),
          invoice_date: inv.invoice_date,
          status,
          payment_status: inv.payment_status || inv.status || "Pending",
          quotationId: inv.quotation_id,
          productionJobId: inv.production_order_id,
          notes: inv.notes,
          created_at: inv.created_at,
        };
      });

      setInvoices(mappedInvoices);

      const pending = mappedInvoices
        .filter((i) => i.status === "Pending")
        .reduce((s, i) => s + i.amount, 0);
      const overdue = mappedInvoices
        .filter((i) => i.status === "Overdue")
        .reduce((s, i) => s + i.amount, 0);

      setPendingAmount(pending);
      setOverdueAmount(overdue);

      // ── Expense breakdown ───────────────────────────────────
      if (exp > 0) {
        const cats: ExpenseCategory[] = [
          { category: "Raw Materials", amount: Math.round(exp * 0.48), pct: 0 },
          { category: "Labour", amount: Math.round(exp * 0.24), pct: 0 },
          { category: "Electricity", amount: Math.round(exp * 0.10), pct: 0 },
          { category: "Maintenance", amount: Math.round(exp * 0.075), pct: 0 },
          { category: "Transport", amount: Math.round(exp * 0.05), pct: 0 },
          { category: "Others", amount: Math.round(exp * 0.055), pct: 0 },
        ];
        cats.forEach((c) => {
          c.pct = Math.round((c.amount / exp) * 100);
        });
        setExpenses(cats);
      } else {
        setExpenses([
          { category: "Raw Materials", amount: 82000, pct: 48 },
          { category: "Labour", amount: 41000, pct: 24 },
          { category: "Electricity", amount: 17100, pct: 10 },
          { category: "Maintenance", amount: 12825, pct: 8 },
          { category: "Transport", amount: 8550, pct: 5 },
          { category: "Others", amount: 9525, pct: 5 },
        ]);
      }
    } catch (err) {
      console.error("Failed to load finance data:", err);
      setError("Failed to load financial data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── Load dropdown data for create invoice ──────────────────
  const loadDropdownData = async () => {
    try {
      const customersData = await api.getCustomers();
      setCustomers(customersData.map((c) => ({ id: c.id, name: c.name })));

      const jobsData = await api.getProductionJobs();
      setProductionJobs(
        jobsData.map((j) => ({
          id: j.id,
          product: j.product,
          customer: j.customer,
          value: j.value || 0,
          quantity: j.quantity || 0,
          status: j.status,
          quotationId: j.quotationId,
        }))
      );
    } catch (err) {
      console.error("Failed to load dropdown data:", err);
    }
  };

  // ─── Invoice form helpers ───────────────────────────────────
  const calculateEstimatedAmount = (job: any): number => {
    if (job.value && job.value > 0) return job.value;
    if (job.quantity && job.quantity > 0) return job.quantity * 50;
    return 0;
  };

  const handleCustomerChange = (customerId: string) => {
    setInvoiceForm({
      ...invoiceForm,
      customerId,
      productionJobId: "",
      amount: 0,
      manualAmount: false,
    });
  };

  const handleJobChange = (jobId: string) => {
    const job = productionJobs.find((j) => j.id === jobId);
    setInvoiceForm({
      ...invoiceForm,
      productionJobId: jobId,
      amount: job ? calculateEstimatedAmount(job) : 0,
      manualAmount: false,
    });
  };

  const handleAmountChange = (value: number) => {
    setInvoiceForm({ ...invoiceForm, amount: value, manualAmount: true });
  };

  const getFilteredJobs = () => {
    if (!invoiceForm.customerId) return productionJobs;
    const customer = customers.find((c) => c.id === invoiceForm.customerId);
    return productionJobs.filter((j) => j.customer === customer?.name);
  };

  // ─── Create invoice ─────────────────────────────────────────
  const handleCreateInvoice = async () => {
    if (!invoiceForm.customerId) { alert("Please select a customer"); return; }
    if (!invoiceForm.productionJobId) { alert("Please select a production job"); return; }
    if (invoiceForm.amount <= 0) { alert("Please enter a valid amount"); return; }

    try {
      setCreating(true);

      const invoiceNumber = `INV-${String(1500 + invoices.length + 1).padStart(4, '0')}`;
      const customer = customers.find((c) => c.id === invoiceForm.customerId);
      const job = productionJobs.find((j) => j.id === invoiceForm.productionJobId);

      const { error: invoiceError } = await supabase
        .from("invoices")
        .insert([
          {
            invoice_id: invoiceNumber,
            quotation_id: job?.quotationId || null,
            production_order_id: invoiceForm.productionJobId,
            invoice_number: invoiceNumber,
            invoice_date: invoiceForm.issueDate,
            due_date: invoiceForm.dueDate,
            subtotal: invoiceForm.amount,
            tax_percent: 0,
            tax_amount: 0,
            discount_amount: 0,
            total_amount: invoiceForm.amount,
            currency: "INR",
            customer_id: invoiceForm.customerId,
            billing_address: null,
            shipping_address: null,
            gst_number: null,
            status: "Pending",
            payment_status: "Pending",
            payment_due_days: 30,
            payment_reminder_sent: false,
            last_reminder_date: null,
            notes: invoiceForm.notes || `Invoice for ${job?.product}`,
            created_by: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            amount: invoiceForm.amount,
            issue_date: invoiceForm.issueDate,
            dispatch_date: null,
          },
        ]);

      if (invoiceError) throw new Error(invoiceError.message);

      setInvoiceForm({
        customerId: "",
        productionJobId: "",
        amount: 0,
        issueDate: new Date().toISOString().split("T")[0],
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        notes: "",
        manualAmount: false,
      });
      setShowCreateInvoice(false);
      alert(`✅ Invoice ${invoiceNumber} created successfully for ${customer?.name}!`);
      await loadFinanceData();
    } catch (err) {
      console.error("Failed to create invoice:", err);
      alert("Failed to create invoice. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  // ─── Status update (silent — used by dropdown) ──────────────
  const updateInvoiceStatus = async (
    invoiceId: string,
    newStatus: "Paid" | "Pending" | "Overdue"
  ) => {
    try {
      setUpdatingStatus(true);
      const { error } = await supabase
        .from("invoices")
        .update({
          status: newStatus,
          payment_status: newStatus === "Paid" ? "Paid" : newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("invoice_id", invoiceId);

      if (error) throw error;

      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? {
              ...inv,
              status: newStatus,
              payment_status: newStatus === "Paid" ? "Paid" : newStatus,
            }
            : inv
        )
      );
      await loadFinanceData();
    } catch (err) {
      console.error("Failed to update invoice status:", err);
      alert("Failed to update invoice status. Please try again.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ─── Status update with confirm (used by buttons) ───────────
  const handleInvoiceStatusUpdateWithConfirm = async (
    invoiceId: string,
    newStatus: "Paid" | "Pending" | "Overdue"
  ) => {
    if (!confirm(`Change invoice ${invoiceId} status to "${newStatus}"?`)) return;
    await updateInvoiceStatus(invoiceId, newStatus);
    alert(`✅ Invoice ${invoiceId} status updated to ${newStatus}`);
  };

  const openViewInvoice = (invoice: Invoice) => {
    setViewingInvoice(invoice);
    setShowViewInvoice(true);
  };

  const openCreateInvoice = () => {
    loadDropdownData();
    setShowCreateInvoice(true);
  };

  useEffect(() => {
    loadFinanceData();
  }, []);

  // ─── Loading / error states ─────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500">Loading financial data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <div className="text-red-600 text-lg">⚠️ {error}</div>
        <button
          onClick={loadFinanceData}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const filteredJobs = getFilteredJobs();
  const selectedJob = productionJobs.find((j) => j.id === invoiceForm.productionJobId);
  const estimatedAmount = selectedJob ? calculateEstimatedAmount(selectedJob) : 0;

  // ─── Render ─────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* ── View Invoice Modal ─────────────────────────────── */}
      {showViewInvoice && viewingInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" /> Invoice Details
              </h3>
              <button
                onClick={() => setShowViewInvoice(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-2xl font-bold text-indigo-600">{viewingInvoice.id}</p>
                    <StatusBadge status={viewingInvoice.status} />
                  </div>
                  <p className="text-sm text-slate-500 mt-1">Client: {viewingInvoice.client}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500">Amount</p>
                  <p className="text-2xl font-bold text-slate-900">
                    ₹{viewingInvoice.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Invoice ID", value: viewingInvoice.id },
                  { label: "Client", value: viewingInvoice.client },
                  { label: "Amount", value: `₹${viewingInvoice.amount.toLocaleString()}` },
                  { label: "Issue Date", value: viewingInvoice.issued },
                  {
                    label: "Due Date",
                    value: viewingInvoice.due,
                    className: viewingInvoice.status === "Overdue" ? "text-red-600" : "text-slate-900",
                  },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className={`text-sm font-semibold ${item.className || "text-slate-900"}`}>
                      {item.value}
                    </p>
                  </div>
                ))}
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Status</p>
                  <StatusBadge status={viewingInvoice.status} />
                </div>
              </div>

              {viewingInvoice.notes && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="text-sm text-slate-700 mt-1">{viewingInvoice.notes}</p>
                </div>
              )}

              {viewingInvoice.productionJobId && (
                <div className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">Production Job Reference</p>
                  <p className="text-sm font-semibold text-indigo-600 mt-1">
                    {viewingInvoice.productionJobId}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-700 mb-2">Update Status</p>
                <div className="flex flex-wrap gap-2">
                  {INVOICE_STATUS_OPTIONS.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        setShowViewInvoice(false);
                        handleInvoiceStatusUpdateWithConfirm(viewingInvoice.id, status);
                      }}
                      disabled={status === viewingInvoice.status || updatingStatus}
                      className={`px-3 py-1.5 text-xs rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${status === viewingInvoice.status
                        ? "bg-slate-100 text-slate-500 border-slate-200 cursor-default"
                        : status === "Paid"
                          ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                          : status === "Pending"
                            ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                            : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        }`}
                    >
                      Mark as {status}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Invoice Modal ───────────────────────────── */}
      {showCreateInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" /> Create Invoice
              </h3>
              <button
                onClick={() => setShowCreateInvoice(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer <span className="text-red-500">*</span>
                </label>
                <select
                  value={invoiceForm.customerId}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Production Job */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Production Job <span className="text-red-500">*</span>
                </label>
                <select
                  value={invoiceForm.productionJobId}
                  onChange={(e) => handleJobChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                >
                  <option value="">Select Production Job</option>
                  {filteredJobs.length === 0 ? (
                    <option value="" disabled>No jobs found for this customer</option>
                  ) : (
                    filteredJobs.map((j) => {
                      const est = calculateEstimatedAmount(j);
                      return (
                        <option key={j.id} value={j.id}>
                          {j.id} – {j.product}
                          {est > 0 ? ` (Est. ₹${est.toLocaleString()})` : " (No value set)"}
                          – {j.status}
                        </option>
                      );
                    })
                  )}
                </select>
                {invoiceForm.customerId && filteredJobs.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No production jobs found for this customer
                  </p>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={invoiceForm.amount || ""}
                    onChange={(e) => handleAmountChange(parseFloat(e.target.value) || 0)}
                    placeholder={
                      invoiceForm.productionJobId
                        ? "Amount auto-filled from job"
                        : "Select a job to auto-fill amount"
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                  {invoiceForm.productionJobId && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${invoiceForm.manualAmount
                          ? "text-blue-600 bg-blue-50"
                          : "text-green-600 bg-green-50"
                          }`}
                      >
                        {invoiceForm.manualAmount ? "Manual" : "Auto-filled"}
                      </span>
                    </div>
                  )}
                </div>
                {invoiceForm.productionJobId && (
                  <div className="mt-1">
                    {estimatedAmount > 0 && !invoiceForm.manualAmount && (
                      <p className="text-xs text-green-600">
                        ✅ Estimated amount: ₹{estimatedAmount.toLocaleString()}
                      </p>
                    )}
                    {estimatedAmount > 0 && invoiceForm.manualAmount && (
                      <p className="text-xs text-slate-400">
                        💡 Estimated: ₹{estimatedAmount.toLocaleString()}
                        <button
                          className="text-indigo-600 hover:text-indigo-800 ml-1 underline"
                          onClick={() =>
                            setInvoiceForm({
                              ...invoiceForm,
                              amount: estimatedAmount,
                              manualAmount: false,
                            })
                          }
                        >
                          Use estimated
                        </button>
                      </p>
                    )}
                    {estimatedAmount === 0 && (
                      <p className="text-xs text-amber-600">
                        ⚠️ No value set for this job. Please enter amount manually.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Issue Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.issueDate}
                    onChange={(e) =>
                      setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) =>
                      setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={invoiceForm.notes}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, notes: e.target.value })
                  }
                  placeholder="Add any additional notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none"
                />
              </div>

              {/* Job details preview */}
              {selectedJob && (
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <p className="text-xs font-medium text-slate-700 mb-2">Job Details</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { label: "Job ID", value: selectedJob.id },
                      { label: "Product", value: selectedJob.product },
                      { label: "Quantity", value: selectedJob.quantity?.toLocaleString() || "N/A" },
                      { label: "Status", value: selectedJob.status },
                    ].map((item) => (
                      <div key={item.label}>
                        <span className="text-slate-500">{item.label}:</span>
                        <span className="text-slate-700 font-medium ml-1">{item.value}</span>
                      </div>
                    ))}
                    <div className="col-span-2">
                      <span className="text-slate-500">Quotation:</span>
                      <span className="text-slate-700 font-medium ml-1">
                        {selectedJob.quotationId || "N/A"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Estimated Amount:</span>
                      <span className="text-indigo-600 font-medium ml-1">
                        ₹{calculateEstimatedAmount(selectedJob).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-3">
              <button
                onClick={() => setShowCreateInvoice(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={creating}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <><Save size={16} /> Create Invoice</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-slate-900 text-xl font-bold">Finance & Reports</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time financial overview</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadFinanceData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
            <Download size={12} /> Export P&L
          </button>
          <button
            onClick={openCreateInvoice}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 transition-colors font-medium"
          >
            <Plus size={12} /> Create Invoice
          </button>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Revenue",
            value: `₹${(totalRevenue / 100000).toFixed(1)}L`,
            change: `${invoices.length} invoices`,
            up: true,
            icon: <TrendingUp size={16} />,
            color: "text-indigo-600 bg-indigo-50",
          },
          {
            label: "Net Profit",
            value: `₹${(netProfit / 100000).toFixed(1)}L`,
            change: `${margin}% margin`,
            up: Number(margin) > 0,
            icon: <DollarSign size={16} />,
            color: "text-green-600 bg-green-50",
          },
          {
            label: "Pending Invoices",
            value: `₹${(pendingAmount / 100000).toFixed(1)}L`,
            change: `${invoices.filter((i) => i.status === "Pending").length} invoices`,
            up: false,
            icon: <Clock size={16} />,
            color: "text-amber-600 bg-amber-50",
          },
          {
            label: "Overdue Amount",
            value: `₹${(overdueAmount / 100000).toFixed(1)}L`,
            change: `${invoices.filter((i) => i.status === "Overdue").length} invoices`,
            up: false,
            icon: <AlertCircle size={16} />,
            color: "text-red-600 bg-red-50",
          },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.color}`}>
                {s.icon}
              </div>
              {s.up ? (
                <TrendingUp size={13} className="text-green-500" />
              ) : (
                <TrendingDown size={13} className="text-red-400" />
              )}
            </div>
            <p className="text-slate-900 text-xl font-bold mb-0.5">{s.value}</p>
            <p className="text-slate-700 text-xs font-medium">{s.label}</p>
            <p className={`text-xs mt-0.5 font-medium ${s.up ? "text-green-600" : "text-red-500"}`}>
              {s.change}
            </p>
          </div>
        ))}
      </div>

      {/* ── Charts Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Revenue vs Expenses */}
        <div className="xl:col-span-2 bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-slate-900 text-sm font-semibold">Revenue vs Expenses</h3>
              <p className="text-slate-400 text-xs mt-0.5">Monthly comparison (₹)</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-indigo-600 inline-block" /> Revenue
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 rounded bg-red-400 inline-block" /> Expenses
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={revenueMonthly}
              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{ fontSize: "12px", borderRadius: "8px" }}
                formatter={(v: number) => [`₹${(v / 1000).toFixed(1)}k`, ""]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#revGrad)"
                name="Revenue"
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#expGrad)"
                name="Expenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-slate-900 text-sm font-semibold mb-4">Expense Breakdown</h3>
          <div className="space-y-3">
            {expenses.map((exp, i) => (
              <div key={exp.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-600">{exp.category}</span>
                  <span className="text-xs text-slate-800 font-semibold">
                    ₹{(exp.amount / 1000).toFixed(0)}k ({exp.pct}%)
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${expenseColors[i]}`}
                    style={{ width: `${Math.min(exp.pct * 2, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 font-medium">Total Expenses</span>
              <span className="text-slate-900 font-bold">
                ₹{(totalExpense / 1000).toFixed(0)}k
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-600 font-medium">Net Profit</span>
              <span className="text-green-600 font-bold">
                ₹{(netProfit / 1000).toFixed(0)}k ({margin}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Advance Payments Section ────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-slate-900 text-sm font-semibold flex items-center gap-2">
            <Receipt size={16} className="text-green-600" />
            Advance Payments Received
          </h3>
          <span className="text-xs text-green-600 font-semibold">
            Total: ₹{totalAdvanceReceived.toLocaleString()}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {["Payment ID", "Quotation", "Customer", "Amount", "Date", "Method", "Notes"].map((h) => (
                  <th key={h} className="text-left text-xs text-slate-500 px-5 py-2.5 whitespace-nowrap font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {advancePayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                    No advance payments recorded yet.
                  </td>
                </tr>
              ) : (
                advancePayments.map((payment) => (
                  <tr key={payment.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3 text-indigo-600 text-xs font-medium">{payment.payment_id}</td>
                    <td className="px-5 py-3 text-slate-700 text-xs">{payment.quotation_id}</td>
                    <td className="px-5 py-3 text-slate-800 text-xs font-medium">{payment.customer_name}</td>
                    <td className="px-5 py-3 text-slate-900 text-xs font-bold">₹{payment.amount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{new Date(payment.payment_date).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{payment.payment_method || 'N/A'}</td>
                    <td className="px-5 py-3 text-slate-500 text-xs max-w-[150px] truncate">{payment.notes || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-border">
          <div className="flex items-center gap-6 text-xs">
            <span className="text-slate-500">
              Total Advance:{" "}
              <span className="text-green-700 font-bold">
                ₹{totalAdvanceReceived.toLocaleString()}
              </span>
            </span>
            <span className="text-slate-500">
              Total Invoices:{" "}
              <span className="text-slate-800 font-bold">
                {invoices.length} invoices
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Invoice Management Table ────────────────────────── */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-slate-900 text-sm font-semibold">Invoice Management</h3>
          <div className="flex gap-3">
            {[
              { s: "Paid", c: "text-green-600" },
              { s: "Pending", c: "text-amber-600" },
              { s: "Overdue", c: "text-red-600" },
            ].map(({ s, c }) => (
              <span key={s} className={`text-xs font-semibold ${c}`}>
                {invoices.filter((i) => i.status === s).length} {s}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-border">
                {["Invoice #", "Client", "Amount", "Issue Date", "Due Date", "Status", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left text-xs text-slate-500 px-5 py-2.5 whitespace-nowrap font-medium"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                    No invoices found. Create invoices from the Dispatch page or click "Create Invoice".
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-indigo-600 text-xs font-semibold">{inv.id}</td>
                    <td className="px-5 py-3 text-slate-800 text-xs font-medium">{inv.client}</td>
                    <td className="px-5 py-3 text-slate-900 text-xs font-bold">
                      ₹{inv.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs">{inv.issued}</td>
                    <td
                      className={`px-5 py-3 text-xs ${inv.status === "Overdue"
                        ? "text-red-600 font-semibold"
                        : "text-slate-500"
                        }`}
                    >
                      {inv.due}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {/* Dropdown — silent update, no confirm */}
                        <select
                          value={inv.status}
                          onChange={(e) =>
                            updateInvoiceStatus(
                              inv.id,
                              e.target.value as "Paid" | "Pending" | "Overdue"
                            )
                          }
                          className="text-xs border border-slate-200 rounded px-1.5 py-1 bg-white hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 max-w-[90px]"
                          disabled={updatingStatus}
                        >
                          {INVOICE_STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>

                        <button
                          onClick={() => openViewInvoice(inv)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 font-medium"
                        >
                          <Eye size={12} /> View
                        </button>

                        {/* Record Payment — with confirm */}
                        {inv.status !== "Paid" && (
                          <button
                            onClick={() =>
                              handleInvoiceStatusUpdateWithConfirm(inv.id, "Paid")
                            }
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                          >
                            Record Payment
                          </button>
                        )}

                        <button className="text-xs text-slate-500 hover:text-slate-600">
                          <Download size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer totals */}
        <div className="px-5 py-3 bg-slate-50 border-t border-border">
          <div className="flex items-center gap-6 text-xs">
            <span className="text-slate-500">
              Total Billed:{" "}
              <span className="text-slate-800 font-bold">
                ₹{invoices.reduce((a, i) => a + i.amount, 0).toLocaleString()}
              </span>
            </span>
            <span className="text-slate-500">
              Collected:{" "}
              <span className="text-green-700 font-bold">
                ₹{invoices
                  .filter((i) => i.status === "Paid")
                  .reduce((a, i) => a + i.amount, 0)
                  .toLocaleString()}
              </span>
            </span>
            <span className="text-slate-500">
              Outstanding:{" "}
              <span className="text-red-600 font-bold">
                ₹{(pendingAmount + overdueAmount).toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}