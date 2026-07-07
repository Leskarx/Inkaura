// ============================================================
// api.ts  —  Complete Fixed Version
// Includes all missing functions for Packaging Dashboard
// ============================================================

import { createClient } from '@supabase/supabase-js';

// ─── Supabase Client ─────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Missing Supabase environment variables.');
}

export const supabase = createClient(
  supabaseUrl || 'https://your-project.supabase.co',
  supabaseKey || 'your-anon-key'
);

// ============================================================
// TYPES
// ============================================================

export type SampleStatus =
  | 'Pending'
  | 'In Progress'
  | 'QC Pending'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Rejected'
  | 'Rework Required'
  | 'Production Created';

export type ProductionStatus =
  | 'Pending'
  | 'In Progress'
  | 'QC Pending'
  | 'Rework Required'
  | 'Completed'
  | 'Packaged'
  | 'Dispatched'
  | 'Failed';

export type Priority = 'High' | 'Medium' | 'Low';
export type QCStatus = 'Pending' | 'Passed' | 'Failed' | 'Rework';
export type QCRating = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'NA';
export type CheckType = 'Pre-Press' | 'During Production' | 'Post Production' | 'Final';

// ─── Role constants ───────────────────────────────────────────
export const QC_SUBMIT_ROLES = ['admin', 'supervisor', 'qc', 'quality', 'qc_team'];
export const QC_APPROVE_ROLES = ['admin', 'supervisor'];

export const hasQCSubmitRole = (role: string) =>
  QC_SUBMIT_ROLES.includes(role.toLowerCase().trim());

export const hasQCApproveRole = (role: string) =>
  QC_APPROVE_ROLES.includes(role.toLowerCase().trim());

// ============================================================
// INTERFACES
// ============================================================

export interface CurrentEmployee {
  employee_id: number;
  full_name: string;
  email: string;
  role: string;
  department?: string;
}

export interface PostDevChecklist {
  client_approval_present: boolean;
  carton_type: string;
  punching_registration: boolean;
  printing_defects_check: boolean;
  finishing_correct: boolean;
  cutting_folding_binding: boolean;
  product_count_verified: boolean;
  carton_pasting_direction: boolean;
  alignment_precision: boolean;
  excess_paper_removed: boolean;
  clean_smooth_edges: boolean;
  correct_labels_applied: boolean;
  legal_compliance_markings: boolean;
  checker_notes: string;
}

export interface QualityCheck {
  qc_id: number;
  production_order_id: string;
  sample_order_id?: string;
  check_type: string;
  check_date: string;
  checked_by: number;
  checked_by_name: string;
  color_accuracy: string;
  print_quality: string;
  binding_quality: string;
  material_quality: string;
  dimensional_accuracy: string;
  finishing_quality: string;
  overall_status: string;
  workflow_status: string;
  qc_cycle: number;
  defect_type?: string;
  defect_quantity: number;
  defect_description?: string;
  rework_required: boolean;
  rework_description?: string;
  rework_completed_date?: string;
  approved_for_dispatch: boolean;
  approved_by_name?: string;
  approved_date?: string;
  notes?: string;
  post_dev_checklist?: PostDevChecklist | null;
  checklist_verified_by?: number | null;
  checklist_verified_by_name?: string;
  checklist_verified_date?: string | null;
  created_at: string;
  customer_name: string;
  product_name: string;
  product_type: string;
  printing_technology: string;
  quantity: number;
}

export interface QCJob {
  order_id: string;
  job_type: 'Production' | 'Sample';
  status: string;
  final_quantity: number;
  quotation_id: string;
  customer_name: string;
  product_name: string;
  product_type: string;
  printing_technology: string;
  hasActiveQC: boolean;
  activeQCStatus?: string;
  activeQCId?: number;
  qc_cycle: number;
  rework_count: number;
}

export interface CreateQualityCheckRequest {
  production_order_id: string;
  sample_order_id?: string;
  job_type?: 'Production' | 'Sample';
  check_type: string;
  color_accuracy: string;
  print_quality: string;
  binding_quality?: string;
  material_quality: string;
  dimensional_accuracy: string;
  finishing_quality: string;
  overall_status: string;
  defect_type?: string;
  defect_quantity?: number;
  defect_description?: string;
  rework_required?: boolean;
  rework_description?: string;
  notes?: string;
}

export interface QCStats {
  pending: number;
  passed: number;
  failed: number;
  rework: number;
  approvalRate: number;
  awaitingApproval: number;
}

export interface SampleJob {
  id: string;
  quotationId: string;
  customer: string;
  product: string;
  sampleQuantity: number;
  sampleCost: number;
  assignedTo: string;
  status: SampleStatus;
  dueDate: string;
  createdDate: string;
  rejectionReason?: string;
  approvedDate?: string;
  productionJobId?: string;
  qcCycle: number;
  reworkCount: number;
  lastQcResult?: string;
  currentQcId?: number;
  reworkReason?: string;
  reworkInstructions?: string;
}

export interface ProductionJob {
  id: string;
  quotationId: string;
  customer: string;
  product: string;
  quantity: number;
  assignedTo: string;
  machine: string;
  priority: Priority;
  status: ProductionStatus;
  progress: number;
  dueDate: string;
  createdDate: string;
  value: number;
  qcCycle: number;
  reworkCount: number;
  lastQcResult?: string;
  currentQcId?: number;
  reworkReason?: string;
  reworkInstructions?: string;
}

export interface QuotationProductSpec {
  material: string;
  gsm: string;
  dimensions: string;
  printingTech: string;
  colors: string;
  lamination: string;
  packaging: string;
}

export interface QuotationProduct {
  desc: string;
  qty: number;
  rate: number;
  total: number;
  specs: QuotationProductSpec;
}

export interface QuotationData {
  id: string;
  customerId: string;
  version: string;
  customer: string;
  date: string;
  validUntil: string;
  status: string;
  owner: string;
  createdBy: string;
  lastUpdatedBy: string;
  sentBy: string | null;
  sentTimestamp: string | null;
  commercials: {
    subtotal: number;
    gst: number;
    total: number;
    advanceRequiredPct: number;
    advanceReceivedAmt: number;
    paymentTerms: string;
  };
  costing: {
    estimatedTotalCost: number;
    expectedMargin: number;
    profitMarginPct: number;
    breakdown: {
      material: number;
      machine: number;
      labor: number;
      finishing: number;
      packaging: number;
    };
  };
  products: QuotationProduct[];
  workflow: {
    sampleOrder: string;
    productionOrder: string;
    dispatch: string;
    invoice: string;
    closure: string;
  };
  sampleJobId?: string;
  activities: Array<{
    type: string;
    timestamp: string;
    user: string;
    note: string;
  }>;
}

export interface CreateSampleJobRequest {
  quotationId: string;
  customerId: string;
  productId: number;
  sampleQuantity: number;
  sampleCost: number;
  assignedTo: string | null;
  dueDate: string;
}

export interface CreateProductionJobRequest {
  quotationId: string;
  deliveryDate: string;
  machineId?: number;
  operatorId?: number;
  priority: Priority;
}

// ============================================================
// SELECT FRAGMENTS
// ============================================================

const QC_SELECT = `
    *,
    checked_by_emp:checked_by (full_name),
    approved_by_emp:approved_by (full_name),
    rework_checked_by_emp:rework_checked_by (full_name)
`;

const PRODUCTION_SELECT = `
    *,
    employees:assigned_to(full_name),
    machines:machine_id(machine_name, machine_id),
    quotations:quotation_id(
        quotation_id,
        customer_id,
        total_payment,
        customers:customer_id(company_name),
        quotation_products(product_name)
    )
`;

const SAMPLE_SELECT = `
    *,
    customers:customer_id(company_name),
    employees:assigned_to(full_name),
    quotation_products:product_id(product_name),
    quotations:quotation_id(
        quotation_id,
        total_payment,
        production_orders(production_order_id)
    )
`;

// ============================================================
// HELPERS
// ============================================================

export const getCurrentEmployeeId = async (): Promise<number> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 1;
    const { data: emp } = await supabase
      .from('employees')
      .select('employee_id')
      .eq('auth_user_id', user.id)
      .single();
    return emp?.employee_id ?? 1;
  } catch {
    return 1;
  }
};

const safeProductName = (name: string | null | undefined): string => {
  if (!name || name.trim() === '') return 'Custom Print Job';
  return name.trim();
};

// ─── Log workflow activity ────────────────────────────────────
export const logWorkflowActivity = async (
  jobType: 'sample' | 'production',
  jobId: string,
  activity: string,
  remarks?: string,
  qcId?: number,
): Promise<void> => {
  try {
    const empId = await getCurrentEmployeeId();
    await supabase.from('workflow_activity_log').insert([{
      job_type: jobType,
      job_id: jobId,
      qc_id: qcId || null,
      activity,
      performed_by: empId,
      remarks: remarks || null,
      created_at: new Date().toISOString(),
    }]);
  } catch (err) {
    console.warn('Activity log failed (non-fatal):', err);
  }
};

// ─── Update job status helper ─────────────────────────────────
export const updateJobStatus = async (
  jobType: 'sample' | 'production',
  jobId: string,
  updates: Record<string, unknown>,
): Promise<void> => {
  const table = jobType === 'sample' ? 'sample_orders' : 'production_orders';
  const column = jobType === 'sample' ? 'sample_order_id' : 'production_order_id';

  const { error } = await supabase
    .from(table)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq(column, jobId);

  if (error) throw error;
};

// ─── Get latest QC for a job ──────────────────────────────────
export const getLatestQCForJob = async (
  jobId: string,
  jobType: 'sample' | 'production',
): Promise<{
  qc_id: number;
  overall_status: string;
  workflow_status: string;
  rework_required: boolean;
  rework_description?: string;
  defect_description?: string;
  approved_for_dispatch: boolean;
  qc_cycle: number;
} | null> => {
  try {
    const column = jobType === 'sample'
      ? 'sample_order_id'
      : 'production_order_id';

    const { data, error } = await supabase
      .from('quality_checks')
      .select(`
                qc_id,
                overall_status,
                workflow_status,
                rework_required,
                rework_description,
                defect_description,
                approved_for_dispatch,
                qc_cycle
            `)
      .eq(column, jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
};

// ─── Check active QC for a job ────────────────────────────────
export const getActiveQCForOrder = async (
  orderId: string,
  jobType: 'Production' | 'Sample' = 'Production',
): Promise<{
  hasActive: boolean;
  activeQCStatus?: string;
  activeQCId?: number;
}> => {
  try {
    const column = jobType === 'Production'
      ? 'production_order_id'
      : 'sample_order_id';

    const { data } = await supabase
      .from('quality_checks')
      .select('qc_id, overall_status, workflow_status, approved_for_dispatch')
      .eq(column, orderId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return { hasActive: false };

    const latest = data[0];

    if (latest.approved_for_dispatch) {
      return {
        hasActive: true,
        activeQCStatus: 'Approved',
        activeQCId: latest.qc_id,
      };
    }

    if (latest.overall_status === 'Passed' && !latest.approved_for_dispatch) {
      return {
        hasActive: true,
        activeQCStatus: 'Awaiting Approval',
        activeQCId: latest.qc_id,
      };
    }

    if (latest.overall_status === 'Failed') {
      return {
        hasActive: false,
        activeQCStatus: 'Failed',
        activeQCId: latest.qc_id,
      };
    }

    return { hasActive: false };
  } catch {
    return { hasActive: false };
  }
};

// ============================================================
// MAPPERS
// ============================================================

const mapToSampleJob = (item: any): SampleJob => {
  let currentStatus: SampleStatus = item.status || 'Pending';

  if (
    item.quotations?.production_orders &&
    item.quotations.production_orders.length > 0
  ) {
    currentStatus = 'Production Created';
  }

  return {
    id: item.sample_order_id,
    quotationId: item.quotation_id,
    customer: item.customers?.company_name || 'Unknown',
    product: item.quotation_products?.product_name || 'Unknown',
    sampleQuantity: item.sample_quantity || 0,
    sampleCost: item.sample_cost || 0,
    assignedTo: item.employees?.full_name || 'Unassigned',
    status: currentStatus,
    dueDate: item.due_date || '',
    createdDate: item.created_at || new Date().toISOString(),
    rejectionReason: item.rejection_reason,
    approvedDate: item.approved_date,
    productionJobId: item.production_job_id,
    qcCycle: item.qc_cycle || 0,
    reworkCount: item.rework_count || 0,
    lastQcResult: item.last_qc_result || undefined,
    currentQcId: item.current_qc_id || undefined,
    reworkReason: item.rework_reason || undefined,
    reworkInstructions: item.rework_instructions || undefined,
  };
};

const mapToProductionJob = (item: any): ProductionJob => {
  const quotation = item.quotations || {};
  const customer = quotation.customers || {};
  const products = quotation.quotation_products || [];
  const productName = products.length > 0
    ? (products[0].product_name || 'Unknown Product')
    : 'Unknown Product';

  return {
    id: item.production_order_id,
    quotationId: item.quotation_id || '',
    customer: customer.company_name || 'Unknown',
    product: productName,
    quantity: item.final_quantity || item.original_quantity || 0,
    assignedTo: item.employees?.full_name || 'Unassigned',
    machine: item.machines?.machine_name || 'Unassigned',
    priority: item.priority || 'Medium',
    status: item.status || 'Pending',
    progress: item.progress || 0,
    dueDate: item.delivery_date || '',
    createdDate: item.created_at || new Date().toISOString(),
    value: item.value || 0,
    qcCycle: item.qc_cycle || 0,
    reworkCount: item.rework_count || 0,
    lastQcResult: item.last_qc_result || undefined,
    currentQcId: item.current_qc_id || undefined,
    reworkReason: item.rework_reason || undefined,
    reworkInstructions: item.rework_instructions || undefined,
  };
};

const mapToQuotationData = (item: any): QuotationData => {
  const customerName = item.customers?.company_name || 'Unknown';
  const ownerName = item.employees?.full_name || 'System';
  const sampleId = item.sample_orders?.[0]?.sample_order_id ?? 'N/A';
  const sampleStatus = item.sample_orders?.[0]?.status ?? 'N/A';
  const prodId = item.production_orders?.[0]?.production_order_id ?? 'N/A';
  const prodStatus = item.production_orders?.[0]?.status ?? 'N/A';

  const products = (item.quotation_products || []).map((p: any) => ({
    desc: p.product_name || 'Product',
    qty: p.production_quantity || 0,
    rate: 0,
    total: 0,
    specs: {
      material: p.material_type || 'N/A',
      gsm: p.paper_gsm ? `${p.paper_gsm}gsm` : 'N/A',
      dimensions: `${p.width_cm || 0}x${p.height_cm || 0}cm`,
      printingTech: p.printing_technology || 'N/A',
      colors: p.color_type || 'N/A',
      lamination: p.lamination || 'N/A',
      packaging: p.packaging_type || 'N/A',
    },
  }));

  const estTotal = (item.cost_estimations || [])
    .reduce((acc: number, c: any) => acc + (c.total_cost || 0), 0);
  const totalPayment = Number(item.total_payment) || 0;

  return {
    id: item.quotation_id,
    customerId: item.customer_id || '',
    version: 'v1',
    customer: customerName,
    date: new Date(item.quotation_date || item.created_at).toLocaleDateString(),
    validUntil: item.delivery_date
      ? new Date(item.delivery_date).toLocaleDateString()
      : 'N/A',
    status: item.status || 'Draft',
    owner: ownerName,
    createdBy: ownerName,
    lastUpdatedBy: ownerName,
    sentBy: null,
    sentTimestamp: null,
    commercials: {
      subtotal: totalPayment,
      gst: totalPayment * 0.18,
      total: totalPayment * 1.18,
      advanceRequiredPct: Number(item.advance_percentage) || 30,
      advanceReceivedAmt: 0,
      paymentTerms: `${item.advance_percentage || 30}% Advance`,
    },
    costing: {
      estimatedTotalCost: estTotal,
      expectedMargin: totalPayment - estTotal,
      profitMarginPct: estTotal > 0 && totalPayment
        ? Math.round(((totalPayment - estTotal) / totalPayment) * 100)
        : 0,
      breakdown: {
        material: estTotal * 0.4,
        machine: estTotal * 0.3,
        labor: estTotal * 0.2,
        finishing: estTotal * 0.05,
        packaging: estTotal * 0.05,
      },
    },
    products: products.length > 0 ? products : [{
      desc: 'Custom Print Job',
      qty: 1000,
      rate: totalPayment / 1000,
      total: totalPayment,
      specs: {
        material: 'Custom',
        gsm: 'N/A',
        dimensions: 'Custom',
        printingTech: 'Custom',
        colors: 'Custom',
        lamination: 'N/A',
        packaging: 'N/A',
      },
    }],
    workflow: {
      sampleOrder: sampleId !== 'N/A' ? sampleStatus : 'N/A',
      productionOrder: prodId !== 'N/A' ? prodStatus : 'N/A',
      dispatch: 'N/A',
      invoice: 'N/A',
      closure: 'N/A',
    },
    sampleJobId: sampleId !== 'N/A' ? sampleId : undefined,
    activities: [{
      type: 'Created',
      timestamp: new Date(item.created_at).toLocaleString(),
      user: ownerName,
      note: item.notes || 'Quotation created',
    }],
  };
};

// ─── QC mapper ────────────────────────────────────────────────
const mapToQualityCheck = (item: any): QualityCheck => ({
  qc_id: item.qc_id,
  production_order_id: item.production_order_id || '',
  sample_order_id: item.sample_order_id,
  check_type: item.check_type,
  check_date: item.check_date,
  checked_by: item.checked_by,
  checked_by_name: item.checked_by_emp?.full_name || 'Unknown',
  color_accuracy: item.color_accuracy || 'NA',
  print_quality: item.print_quality || 'NA',
  binding_quality: item.binding_quality || 'NA',
  material_quality: item.material_quality || 'NA',
  dimensional_accuracy: item.dimensional_accuracy || 'NA',
  finishing_quality: item.finishing_quality || 'NA',
  overall_status: item.overall_status,
  workflow_status: item.workflow_status || 'Pending',
  qc_cycle: item.qc_cycle || 1,
  defect_type: item.defect_type,
  defect_quantity: item.defect_quantity || 0,
  defect_description: item.defect_description,
  rework_required: item.rework_required || false,
  rework_description: item.rework_description,
  rework_completed_date: item.rework_completed_date,
  approved_for_dispatch: item.approved_for_dispatch || false,
  approved_by_name: item.approved_by_emp?.full_name,
  approved_date: item.approved_date,
  notes: item.notes,
  post_dev_checklist: item.post_dev_checklist || null,
  checklist_verified_by: item.checklist_verified_by || null,
  checklist_verified_by_name: item.approved_by_emp?.full_name || undefined,
  checklist_verified_date: item.checklist_verified_date || null,
  created_at: item.created_at,
  customer_name: 'Unknown',
  product_name: 'Unknown Product',
  product_type: 'Custom',
  printing_technology: 'N/A',
  quantity: 0,
});

// ─── Enrich QC with customer/product info ─────────────────────
const enrichQualityCheck = async (qc: QualityCheck): Promise<QualityCheck> => {
  try {
    const orderId = qc.production_order_id || qc.sample_order_id;
    const isSample = !qc.production_order_id || qc.production_order_id === '';

    if (!orderId) return qc;

    let quotationId: string | null = null;
    let quantity = 0;

    if (!isSample) {
      const { data: po } = await supabase
        .from('production_orders')
        .select('final_quantity, quotation_id')
        .eq('production_order_id', orderId)
        .single();

      if (!po) return qc;
      quantity = po.final_quantity || 0;
      quotationId = po.quotation_id;
    } else {
      const { data: so } = await supabase
        .from('sample_orders')
        .select('sample_quantity, quotation_id')
        .eq('sample_order_id', orderId)
        .single();

      if (!so) return qc;
      quantity = so.sample_quantity || 0;
      quotationId = so.quotation_id;
    }

    qc.quantity = quantity;

    if (quotationId) {
      const { data: quotation } = await supabase
        .from('quotations')
        .select('customers:customer_id(company_name)')
        .eq('quotation_id', quotationId)
        .single();

      const qt = quotation as any;
      qc.customer_name = qt?.customers?.company_name || 'Unknown';

      const { data: products } = await supabase
        .from('quotation_products')
        .select('product_name, product_type, printing_technology')
        .eq('quotation_id', quotationId)
        .limit(1);

      const qp = products?.[0];
      qc.product_name = safeProductName(qp?.product_name);
      qc.product_type = qp?.product_type || 'Custom';
      qc.printing_technology = qp?.printing_technology || 'N/A';
    }

    return qc;
  } catch {
    return qc;
  }
};

// ============================================================
// API OBJECT — Complete with all functions
// ============================================================

export const api = {

  // ──────────────────────────────────────────────────────────
  // CURRENT EMPLOYEE
  // ──────────────────────────────────────────────────────────

  getCurrentEmployee: async (): Promise<CurrentEmployee | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: emp, error } = await supabase
        .from('employees')
        .select('employee_id, full_name, email, role, department')
        .eq('auth_user_id', user.id)
        .single();

      if (error || !emp) return null;

      return {
        employee_id: emp.employee_id,
        full_name: emp.full_name,
        email: emp.email,
        role: emp.role,
        department: emp.department,
      };
    } catch {
      return null;
    }
  },

  // ──────────────────────────────────────────────────────────
  // QUOTATIONS
  // ──────────────────────────────────────────────────────────

  getQuotations: async (): Promise<QuotationData[]> => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
                    *,
                    customers:customer_id(company_name),
                    employees:created_by(full_name),
                    quotation_products(*),
                    cost_estimations(*),
                    sample_orders(sample_order_id, status),
                    production_orders(production_order_id, status)
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];
      return data.map(mapToQuotationData);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      throw error;
    }
  },

  getQuotationById: async (id: string): Promise<QuotationData | null> => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`
                    *,
                    customers:customer_id(company_name),
                    employees:created_by(full_name),
                    quotation_products(*),
                    cost_estimations(*),
                    sample_orders(sample_order_id, status),
                    production_orders(production_order_id, status)
                `)
        .eq('quotation_id', id)
        .single();

      if (error) throw error;
      if (!data) return null;
      return mapToQuotationData(data);
    } catch (error) {
      console.error('Error fetching quotation by id:', error);
      throw error;
    }
  },

  getQuotationForEdit: async (id: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('quotations')
        .select(`*, quotation_products(*)`)
        .eq('quotation_id', id)
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching quotation for edit:', error);
      throw error;
    }
  },

  createQuotation: async (payload: {
    customer_id: string;
    quotation_date: string;
    total_payment: number;
    advance_percentage: number;
    notes?: string;
    created_by: number;
    products: any[];
  }): Promise<void> => {
    try {
      const qId = `QT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;

      const { error: qError } = await supabase
        .from('quotations')
        .insert([{
          quotation_id: qId,
          customer_id: payload.customer_id,
          quotation_date: payload.quotation_date,
          total_payment: payload.total_payment,
          advance_percentage: payload.advance_percentage,
          notes: payload.notes,
          created_by: payload.created_by,
          status: 'Draft',
        }]);
      if (qError) throw qError;

      if (payload.products?.length > 0) {
        const productsToInsert = payload.products.map((p) => ({
          quotation_id: qId,
          product_name: p.product_name,
          product_type: p.product_type || 'Custom',
          production_quantity: p.production_quantity,
          material_type: p.material_type || 'Standard',
          paper_gsm: p.paper_gsm || 0,
          width_cm: p.width_cm || 0,
          height_cm: p.height_cm || 0,
          printing_technology: p.printing_technology || 'Offset',
          color_sides: p.color_sides || 'Single',
          color_type: p.color_type || 'CMYK',
        }));
        const { error: pError } = await supabase
          .from('quotation_products')
          .insert(productsToInsert);
        if (pError) throw pError;
      }
    } catch (error) {
      console.error('Error creating quotation:', error);
      throw error;
    }
  },

  updateQuotation: async (id: string, payload: {
    customer_id: string;
    quotation_date: string;
    total_payment: number;
    advance_percentage: number;
    notes?: string;
    created_by: number;
    products: any[];
  }): Promise<void> => {
    try {
      const { error: qError } = await supabase
        .from('quotations')
        .update({
          customer_id: payload.customer_id,
          quotation_date: payload.quotation_date,
          total_payment: payload.total_payment,
          advance_percentage: payload.advance_percentage,
          notes: payload.notes,
          created_by: payload.created_by,
        })
        .eq('quotation_id', id);
      if (qError) throw qError;

      const { error: delError } = await supabase
        .from('quotation_products')
        .delete()
        .eq('quotation_id', id);
      if (delError) throw delError;

      if (payload.products?.length > 0) {
        const productsToInsert = payload.products.map((p) => ({
          quotation_id: id,
          product_name: p.product_name,
          product_type: p.product_type || 'Custom',
          production_quantity: p.production_quantity,
          material_type: p.material_type || 'Standard',
          paper_gsm: p.paper_gsm || 0,
          width_cm: p.width_cm || 0,
          height_cm: p.height_cm || 0,
          printing_technology: p.printing_technology || 'Offset',
          color_sides: p.color_sides || 'Single',
          color_type: p.color_type || 'CMYK',
        }));
        const { error: pError } = await supabase
          .from('quotation_products')
          .insert(productsToInsert);
        if (pError) throw pError;
      }
    } catch (error) {
      console.error('Error updating quotation:', error);
      throw error;
    }
  },

  updateQuotationStatus: async (id: string, status: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('quotations')
        .update({ status })
        .eq('quotation_id', id);
      if (error) throw error;
    } catch (error) {
      console.error('Error updating quotation status:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // SAMPLE JOBS
  // ──────────────────────────────────────────────────────────

  getSampleJobs: async (): Promise<SampleJob[]> => {
    try {
      const { data, error } = await supabase
        .from('sample_orders')
        .select(SAMPLE_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];
      return data.map(mapToSampleJob);
    } catch (error) {
      console.error('Error fetching sample jobs:', error);
      throw error;
    }
  },

  createSampleJob: async (data: CreateSampleJobRequest): Promise<SampleJob> => {
    const sampleId = `SMP-${Date.now().toString().slice(-6)}`;

    const { data: result, error } = await supabase
      .from('sample_orders')
      .insert([{
        sample_order_id: sampleId,
        quotation_id: data.quotationId,
        customer_id: data.customerId,
        product_id: data.productId,
        sample_quantity: data.sampleQuantity,
        sample_cost: data.sampleCost,
        assigned_to: data.assignedTo || null,
        due_date: data.dueDate,
        status: 'Pending',
        qc_cycle: 0,
        rework_count: 0,
        created_at: new Date().toISOString(),
      }])
      .select(SAMPLE_SELECT)
      .single();

    if (error) throw new Error(error.message);

    await logWorkflowActivity(
      'sample',
      sampleId,
      'Created',
      'Sample job created',
    );

    return mapToSampleJob(result);
  },

  approveSample: async (id: string): Promise<SampleJob> => {
    const { data, error } = await supabase
      .from('sample_orders')
      .update({
        status: 'Approved',
        approved: true,
        approved_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('sample_order_id', id)
      .select(SAMPLE_SELECT)
      .single();

    if (error) throw new Error(error.message);

    await logWorkflowActivity('sample', id, 'Sample Approved', 'Sample approved by supervisor');

    return mapToSampleJob(data);
  },

  rejectSample: async (id: string, reason: string): Promise<SampleJob> => {
    const { data, error } = await supabase
      .from('sample_orders')
      .update({
        status: 'Rejected',
        rejection_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('sample_order_id', id)
      .select(SAMPLE_SELECT)
      .single();

    if (error) throw new Error(error.message);

    await logWorkflowActivity('sample', id, 'Sample Rejected', reason);

    return mapToSampleJob(data);
  },

  updateSampleStatus: async (id: string, status: SampleStatus): Promise<SampleJob> => {
    const { data, error } = await supabase
      .from('sample_orders')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('sample_order_id', id)
      .select(SAMPLE_SELECT)
      .single();

    if (error) throw new Error(error.message);

    await logWorkflowActivity('sample', id, `Status → ${status}`);

    return mapToSampleJob(data);
  },

  // ──────────────────────────────────────────────────────────
  // PRODUCTION JOBS
  // ──────────────────────────────────────────────────────────

  getProductionJobs: async (): Promise<ProductionJob[]> => {
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select(PRODUCTION_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];
      return data.map(mapToProductionJob);
    } catch (error) {
      console.error('Error fetching production jobs:', error);
      throw error;
    }
  },

  // ══════════════════════════════════════════════════════════
  // PACKAGING — NEW FUNCTIONS ADDED
  // ══════════════════════════════════════════════════════════

  getPackagingJobs: async (): Promise<ProductionJob[]> => {
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select(PRODUCTION_SELECT)
        .eq('status', 'Completed')
        .order('delivery_date', { ascending: true });

      if (error) throw error;
      if (!data || data.length === 0) return [];
      return data.map(mapToProductionJob);
    } catch (error) {
      console.error('Error fetching packaging jobs:', error);
      throw error;
    }
  },

  markAsPackaged: async (jobId: string, cartonType: string): Promise<void> => {
    try {
      // Update the production order status
      const { error: updateError } = await supabase
        .from('production_orders')
        .update({
          status: 'Packaged',
          packaged_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('production_order_id', jobId);

      if (updateError) throw updateError;

      // Store carton type in packaging_details table
      const { error: packagingError } = await supabase
        .from('packaging_details')
        .insert([{
          production_order_id: jobId,
          packaging_type: cartonType,
          status: 'Completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (packagingError) {
        console.warn('Could not save carton type to packaging_details:', packagingError);
        // Don't throw - the job is still marked as packaged
      }

      await logWorkflowActivity(
        'production',
        jobId,
        'Marked as Packaged',
        `Carton type: ${cartonType}`,
      );
    } catch (error) {
      console.error('Error marking as packaged:', error);
      throw error;
    }
  },



  createProductionJob: async (data: any): Promise<ProductionJob> => {
    try {
      if (data.sampleJobId) {
        const { data: sampleData, error: sampleError } = await supabase
          .from('sample_orders')
          .select(`
                        *,
                        quotations:quotation_id(quotation_id, total_payment),
                        quotation_products:product_id(product_name, production_quantity)
                    `)
          .eq('sample_order_id', data.sampleJobId)
          .single();

        if (sampleError) throw new Error('Sample job not found');

        const poId = `PO-${Date.now().toString().slice(-6)}`;
        const estimatedValue =
          sampleData.quotations?.total_payment ||
          (data.quantity * sampleData.sample_cost) ||
          0;

        const { data: result, error: prodError } = await supabase
          .from('production_orders')
          .insert([{
            production_order_id: poId,
            sample_order_id: data.sampleJobId,
            quotation_id: sampleData.quotation_id,
            original_quantity: data.quantity || sampleData.sample_quantity || 0,
            final_quantity: data.quantity || sampleData.sample_quantity || 0,
            assigned_to: null,
            machine_id: null,
            priority: data.priority || 'Medium',
            status: 'Pending',
            progress: 0,
            qc_cycle: 0,
            rework_count: 0,
            delivery_date: data.deliveryDate,
            created_at: new Date().toISOString(),
            value: estimatedValue,
          }])
          .select(PRODUCTION_SELECT)
          .single();

        if (prodError) throw new Error(prodError.message);

        await supabase
          .from('sample_orders')
          .update({
            production_job_id: poId,
            status: 'Production Created',
            updated_at: new Date().toISOString(),
          })
          .eq('sample_order_id', data.sampleJobId);

        await logWorkflowActivity(
          'production',
          poId,
          'Created',
          `Created from sample ${data.sampleJobId}`,
        );

        return mapToProductionJob(result);
      }

      const { data: quotation, error: quoteError } = await supabase
        .from('quotations')
        .select(`*, quotation_products(*), customers:customer_id(company_name)`)
        .eq('quotation_id', data.quotationId)
        .single();

      if (quoteError) throw new Error('Quotation not found');

      let product = quotation.quotation_products?.[0];
      let productQuantity = 1000;

      if (!product) {
        const { data: newProduct, error: insertError } = await supabase
          .from('quotation_products')
          .insert([{
            quotation_id: data.quotationId,
            product_name: 'Custom Print Job',
            product_type: 'Custom',
            production_quantity: 1000,
            material_type: 'Standard',
            paper_gsm: 0,
            width_cm: 0,
            height_cm: 0,
            printing_technology: 'Offset',
            color_sides: 'Single',
            color_type: 'CMYK',
          }])
          .select()
          .single();

        if (!insertError && newProduct) {
          product = newProduct;
          productQuantity = newProduct.production_quantity || 1000;
        }
      } else {
        productQuantity = product.production_quantity || 1000;
      }

      const poId = `PO-${Date.now().toString().slice(-6)}`;

      const { data: result, error: prodError } = await supabase
        .from('production_orders')
        .insert([{
          production_order_id: poId,
          quotation_id: quotation.quotation_id,
          original_quantity: productQuantity,
          final_quantity: productQuantity,
          assigned_to: null,
          machine_id: null,
          priority: data.priority || 'Medium',
          status: 'Pending',
          progress: 0,
          qc_cycle: 0,
          rework_count: 0,
          delivery_date: data.deliveryDate,
          created_at: new Date().toISOString(),
          value: quotation.total_payment || 0,
        }])
        .select(PRODUCTION_SELECT)
        .single();

      if (prodError) throw new Error(prodError.message);

      await logWorkflowActivity(
        'production',
        poId,
        'Created',
        `Created from quotation ${data.quotationId}`,
      );

      return mapToProductionJob(result);

    } catch (error) {
      console.error('Error creating production job:', error);
      throw error;
    }
  },

  updateProductionProgress: async (
    id: string,
    progress: number,
  ): Promise<ProductionJob> => {
    const { data, error } = await supabase
      .from('production_orders')
      .update({
        progress,
        status: progress === 100 ? 'Completed' : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('production_order_id', id)
      .select(PRODUCTION_SELECT)
      .single();

    if (error) throw new Error(error.message);
    return mapToProductionJob(data);
  },

  updateProductionStatus: async (
    id: string,
    status: ProductionStatus,
  ): Promise<ProductionJob> => {
    const { data, error } = await supabase
      .from('production_orders')
      .update({
        status,
        progress: status === 'Completed' ? 100 : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq('production_order_id', id)
      .select(PRODUCTION_SELECT)
      .single();

    if (error) throw new Error(error.message);

    await logWorkflowActivity('production', id, `Status → ${status}`);

    return mapToProductionJob(data);
  },

  // ──────────────────────────────────────────────────────────
  // DISPATCH
  // ──────────────────────────────────────────────────────────

  dispatchProductionOrder: async (
    productionOrderId: string,
    employeeId: number,
  ): Promise<void> => {
    try {
      const { data: productionOrder, error: fetchError } = await supabase
        .from('production_orders')
        .select('sample_order_id, quotation_id, final_quantity')
        .eq('production_order_id', productionOrderId)
        .single();

      if (fetchError) throw fetchError;

      const qty = productionOrder?.final_quantity || 1;

      const { error: dispatchError } = await supabase
        .from('dispatches')
        .insert({
          production_order_id: productionOrderId,
          dispatch_by: employeeId,
          total_quantity: qty,
          quantity_dispatched: qty,
          status: 'Delivered',
          notes: 'Direct Delivery',
          dispatch_date: new Date().toISOString(),
        });

      if (dispatchError) throw dispatchError;

      const { error: updateError } = await supabase
        .from('production_orders')
        .update({
          status: 'Dispatched',
          updated_at: new Date().toISOString(),
        })
        .eq('production_order_id', productionOrderId);

      if (updateError) throw updateError;

      if (productionOrder?.sample_order_id) {
        await supabase
          .from('sample_orders')
          .update({
            status: 'Production Created',
            updated_at: new Date().toISOString(),
          })
          .eq('sample_order_id', productionOrder.sample_order_id);
      }

      await logWorkflowActivity(
        'production',
        productionOrderId,
        'Dispatched',
        `Dispatched by employee ${employeeId}`,
      );
    } catch (error) {
      console.error('Error dispatching production order:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // DROPDOWN DATA
  // ──────────────────────────────────────────────────────────

  getEmployees: async (): Promise<{
    id: number;
    name: string;
    role: string;
  }[]> => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('employee_id, full_name, role')
        .order('full_name');

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((emp: any) => ({
        id: emp.employee_id,
        name: emp.full_name,
        role: emp.role,
      }));
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  getMachines: async (): Promise<{
    id: number;
    name: string;
    type: string;
    status: string;
    code?: string;
    isOperational?: boolean;
  }[]> => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('machine_id, machine_code, machine_name, machine_type, status, is_operational')
        .order('machine_name');

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((m: any) => ({
        id: m.machine_id,
        code: m.machine_code,
        name: m.machine_name,
        type: m.machine_type,
        status: m.status || 'Active',
        isOperational: m.is_operational !== undefined ? m.is_operational : true,
      }));
    } catch (error) {
      console.error('Error fetching machines:', error);
      throw error;
    }
  },

  getCustomers: async (): Promise<{
    id: string;
    name: string;
    email: string;
    contact_person?: string;
  }[]> => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('customer_id, company_name, contact_person, email')
        .order('company_name');

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((c: any) => ({
        id: c.customer_id,
        name: c.company_name,
        contact_person: c.contact_person,
        email: c.email,
      }));
    } catch (error) {
      console.error('Error fetching customers:', error);
      throw error;
    }
  },

  getProducts: async (): Promise<{
    id: number;
    name: string;
    price: number;
  }[]> => {
    try {
      const { data, error } = await supabase
        .from('quotation_products')
        .select('line_item_id, product_name')
        .order('product_name');

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((p: any) => ({
        id: p.line_item_id,
        name: p.product_name,
        price: 0,
      }));
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('invoice_id')
        .like('invoice_id', 'INV-%')
        .order('invoice_id', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) return 'INV-1001';

      const lastNum = parseInt(data[0].invoice_id.replace('INV-', ''), 10);
      const nextNum = isNaN(lastNum) ? 1001 : lastNum + 1;
      return `INV-${String(nextNum).padStart(4, '0')}`;
    } catch {
      return 'INV-1001';
    }
  },

  // ──────────────────────────────────────────────────────────
  // QUALITY CHECKS
  // ──────────────────────────────────────────────────────────

  getQualityChecks: async (): Promise<QualityCheck[]> => {
    try {
      const { data, error } = await supabase
        .from('quality_checks')
        .select(QC_SELECT)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      const enriched = await Promise.all(
        data.map((item) => enrichQualityCheck(mapToQualityCheck(item)))
      );
      return enriched;
    } catch (error) {
      console.error('Error fetching quality checks:', error);
      throw error;
    }
  },

  getQualityCheckById: async (id: number): Promise<QualityCheck | null> => {
    try {
      const { data, error } = await supabase
        .from('quality_checks')
        .select(QC_SELECT)
        .eq('qc_id', id)
        .single();

      if (error) throw error;
      if (!data) return null;
      return await enrichQualityCheck(mapToQualityCheck(data));
    } catch (error) {
      console.error('Error fetching quality check:', error);
      throw error;
    }
  },

  getJobsForQC: async (): Promise<QCJob[]> => {
    try {
      const enriched: QCJob[] = [];

      const { data: pOrders, error: pError } = await supabase
        .from('production_orders')
        .select(`
                    production_order_id,
                    status,
                    final_quantity,
                    quotation_id,
                    qc_cycle,
                    rework_count
                `)
        .in('status', ['QC Pending', 'Completed', 'Rework Required'])
        .order('created_at', { ascending: false });

      if (pError) throw pError;

      for (const po of (pOrders || [])) {
        if (po.status !== 'QC Pending') continue;

        const { data: quotation } = await supabase
          .from('quotations')
          .select('quotation_id, customers:customer_id(company_name)')
          .eq('quotation_id', po.quotation_id)
          .single();

        const { data: products } = await supabase
          .from('quotation_products')
          .select('product_name, product_type, printing_technology')
          .eq('quotation_id', po.quotation_id)
          .limit(1);

        const qcStatus = await getActiveQCForOrder(
          po.production_order_id,
          'Production',
        );

        const qp = products?.[0];
        const qt = quotation as any;

        enriched.push({
          order_id: po.production_order_id,
          job_type: 'Production',
          status: po.status,
          final_quantity: po.final_quantity || 0,
          quotation_id: po.quotation_id,
          customer_name: qt?.customers?.company_name || 'Unknown',
          product_name: safeProductName(qp?.product_name),
          product_type: qp?.product_type || 'Custom',
          printing_technology: qp?.printing_technology || 'N/A',
          hasActiveQC: qcStatus.hasActive,
          activeQCStatus: qcStatus.activeQCStatus,
          activeQCId: qcStatus.activeQCId,
          qc_cycle: po.qc_cycle || 0,
          rework_count: po.rework_count || 0,
        });
      }

      const { data: sOrders, error: sError } = await supabase
        .from('sample_orders')
        .select(`
                    sample_order_id,
                    status,
                    sample_quantity,
                    quotation_id,
                    qc_cycle,
                    rework_count
                `)
        .in('status', [
          'QC Pending',
          'Awaiting Approval',
          'Approved',
        ])
        .order('created_at', { ascending: false });

      if (sError) throw sError;

      for (const so of (sOrders || [])) {
        if (so.status !== 'QC Pending') continue;

        const { data: quotation } = await supabase
          .from('quotations')
          .select('quotation_id, customers:customer_id(company_name)')
          .eq('quotation_id', so.quotation_id)
          .single();

        const { data: products } = await supabase
          .from('quotation_products')
          .select('product_name, product_type, printing_technology')
          .eq('quotation_id', so.quotation_id)
          .limit(1);

        const qcStatus = await getActiveQCForOrder(
          so.sample_order_id,
          'Sample',
        );

        const qp = products?.[0];
        const qt = quotation as any;

        enriched.push({
          order_id: so.sample_order_id,
          job_type: 'Sample',
          status: so.status,
          final_quantity: so.sample_quantity || 0,
          quotation_id: so.quotation_id,
          customer_name: qt?.customers?.company_name || 'Unknown',
          product_name: safeProductName(qp?.product_name),
          product_type: qp?.product_type || 'Custom',
          printing_technology: qp?.printing_technology || 'N/A',
          hasActiveQC: qcStatus.hasActive,
          activeQCStatus: qcStatus.activeQCStatus,
          activeQCId: qcStatus.activeQCId,
          qc_cycle: so.qc_cycle || 0,
          rework_count: so.rework_count || 0,
        });
      }

      return enriched;
    } catch (error) {
      console.error('Error fetching jobs for QC:', error);
      throw error;
    }
  },

  createQualityCheck: async (
    payload: CreateQualityCheckRequest & { job_type?: 'Production' | 'Sample' }
  ): Promise<QualityCheck> => {
    try {
      const employee = await api.getCurrentEmployee();
      if (employee && !hasQCSubmitRole(employee.role)) {
        throw new Error(
          `Your role (${employee.role}) cannot submit QC reports. ` +
          `Allowed roles: Admin, Supervisor, QC, Quality.`
        );
      }

      const jobType = payload.job_type || 'Production';
      const isSample = jobType === 'Sample';
      const orderId = payload.production_order_id;

      const existingQC = await getActiveQCForOrder(orderId, jobType);
      if (existingQC.hasActive) {
        throw new Error(
          existingQC.activeQCStatus === 'Awaiting Approval'
            ? 'This job already has a QC report awaiting supervisor approval.'
            : 'This job has already been approved.'
        );
      }

      const checkedBy = await getCurrentEmployeeId();

      const table = isSample ? 'sample_orders' : 'production_orders';
      const column = isSample ? 'sample_order_id' : 'production_order_id';

      const { data: jobData } = await supabase
        .from(table)
        .select('qc_cycle, rework_count')
        .eq(column, orderId)
        .single();

      const currentCycle = (jobData?.qc_cycle || 0) + 1;

      const workflowStatus =
        payload.overall_status === 'Passed'
          ? 'Awaiting Approval'
          : 'Rejected';

      const { data, error } = await supabase
        .from('quality_checks')
        .insert([{
          production_order_id: isSample ? null : orderId,
          sample_order_id: isSample ? orderId : null,
          check_type: payload.check_type,
          checked_by: checkedBy,
          color_accuracy: payload.color_accuracy,
          print_quality: payload.print_quality,
          binding_quality: payload.binding_quality || null,
          material_quality: payload.material_quality,
          dimensional_accuracy: payload.dimensional_accuracy,
          finishing_quality: payload.finishing_quality,
          overall_status: payload.overall_status,
          workflow_status: workflowStatus,
          qc_cycle: currentCycle,
          defect_type: payload.defect_type || null,
          defect_quantity: payload.defect_quantity || 0,
          defect_description: payload.defect_description || null,
          rework_required: payload.rework_required || false,
          rework_description: payload.rework_description || null,
          approved_for_dispatch: false,
          closed: false,
          notes: payload.notes || null,
          check_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select(QC_SELECT)
        .single();

      if (error) throw error;

      const qcId = data.qc_id;

      if (payload.overall_status === 'Failed') {
        await supabase
          .from(table)
          .update({
            status: 'Rework Required',
            last_qc_result: 'Failed',
            current_qc_id: qcId,
            updated_at: new Date().toISOString(),
          })
          .eq(column, orderId);

        await logWorkflowActivity(
          isSample ? 'sample' : 'production',
          orderId,
          'QC Failed — Rework Required',
          payload.defect_description
            ? `Defects: ${payload.defect_description}`
            : 'QC failed',
          qcId,
        );

      } else if (payload.overall_status === 'Passed') {
        await supabase
          .from(table)
          .update({
            last_qc_result: 'Passed',
            current_qc_id: qcId,
            updated_at: new Date().toISOString(),
          })
          .eq(column, orderId);

        await logWorkflowActivity(
          isSample ? 'sample' : 'production',
          orderId,
          'QC Passed — Awaiting Supervisor Approval',
          'QC inspector marked as passed',
          qcId,
        );
      }

      return await enrichQualityCheck(mapToQualityCheck(data));
    } catch (error) {
      console.error('Error creating quality check:', error);
      throw error;
    }
  },

  approveQualityCheck: async (
    qcId: number,
    notes?: string,
    checklist?: PostDevChecklist,
  ): Promise<void> => {
    try {
      const employee = await api.getCurrentEmployee();
      if (employee && !hasQCApproveRole(employee.role)) {
        throw new Error(
          `Your role (${employee.role}) cannot approve QC reports. ` +
          `Only Admin and Supervisor can approve.`
        );
      }

      const approvedBy = await getCurrentEmployeeId();

      const { data: qc, error: fetchError } = await supabase
        .from('quality_checks')
        .select('production_order_id, sample_order_id, qc_cycle')
        .eq('qc_id', qcId)
        .single();

      if (fetchError) throw fetchError;

      const isSample = !!qc.sample_order_id && !qc.production_order_id;

      const qcUpdate: Record<string, unknown> = {
        approved_for_dispatch: true,
        approved_by: approvedBy,
        approved_date: new Date().toISOString(),
        workflow_status: 'Approved',
        closed: true,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };

      if (checklist) {
        qcUpdate.post_dev_checklist = checklist;
        qcUpdate.checklist_verified_by = approvedBy;
        qcUpdate.checklist_verified_date = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('quality_checks')
        .update(qcUpdate)
        .eq('qc_id', qcId);

      if (updateError) throw updateError;

      if (!isSample && qc.production_order_id) {
        await supabase
          .from('production_orders')
          .update({
            status: 'Completed',
            last_qc_result: 'Approved',
            updated_at: new Date().toISOString(),
          })
          .eq('production_order_id', qc.production_order_id);

        await logWorkflowActivity(
          'production',
          qc.production_order_id,
          'QC Approved — Ready for Packaging',
          notes || 'Approved by supervisor',
          qcId,
        );

      } else if (isSample && qc.sample_order_id) {
        await supabase
          .from('sample_orders')
          .update({
            status: 'Awaiting Approval',
            last_qc_result: 'Approved',
            customer_feedback: null,
            updated_at: new Date().toISOString(),
          })
          .eq('sample_order_id', qc.sample_order_id);

        await logWorkflowActivity(
          'sample',
          qc.sample_order_id,
          'QC Approved — Awaiting Final Sample Approval',
          notes || 'QC approved by supervisor',
          qcId,
        );
      }
    } catch (error) {
      console.error('Error approving QC:', error);
      throw error;
    }
  },

  rejectQualityCheck: async (
    qcId: number,
    defectDescription: string,
    reworkRequired: boolean,
    reworkDescription?: string,
  ): Promise<void> => {
    try {
      const employee = await api.getCurrentEmployee();
      if (employee && !hasQCApproveRole(employee.role)) {
        throw new Error(
          `Your role (${employee.role}) cannot reject QC reports. ` +
          `Only Admin and Supervisor can reject.`
        );
      }

      const rejectedBy = await getCurrentEmployeeId();

      const { data: qc, error: fetchError } = await supabase
        .from('quality_checks')
        .select('production_order_id, sample_order_id, qc_cycle')
        .eq('qc_id', qcId)
        .single();

      if (fetchError) throw fetchError;

      const isSample = !!qc.sample_order_id && !qc.production_order_id;

      const { error: qcUpdateError } = await supabase
        .from('quality_checks')
        .update({
          overall_status: 'Failed',
          workflow_status: reworkRequired ? 'Rework Required' : 'Rejected',
          defect_description: defectDescription,
          rework_required: reworkRequired,
          rework_description: reworkDescription || null,
          approved_for_dispatch: false,
          closed: false,
          updated_at: new Date().toISOString(),
        })
        .eq('qc_id', qcId);

      if (qcUpdateError) throw qcUpdateError;

      if (!isSample && qc.production_order_id) {
        if (reworkRequired) {
          await supabase
            .from('production_orders')
            .update({
              status: 'Rework Required',
              last_qc_result: 'Failed',
              current_qc_id: qcId,
              progress: 0,
              updated_at: new Date().toISOString(),
            })
            .eq('production_order_id', qc.production_order_id);

          await logWorkflowActivity(
            'production',
            qc.production_order_id,
            'QC Rejected by Supervisor — Rework Required',
            defectDescription,
            qcId,
          );
        } else {
          await supabase
            .from('production_orders')
            .update({
              status: 'Failed',
              last_qc_result: 'Failed',
              current_qc_id: qcId,
              updated_at: new Date().toISOString(),
            })
            .eq('production_order_id', qc.production_order_id);

          await logWorkflowActivity(
            'production',
            qc.production_order_id,
            'QC Rejected — Job Failed',
            defectDescription,
            qcId,
          );
        }

      } else if (isSample && qc.sample_order_id) {
        if (reworkRequired) {
          await supabase
            .from('sample_orders')
            .update({
              status: 'Rework Required',
              last_qc_result: 'Failed',
              current_qc_id: qcId,
              customer_feedback: null,
              updated_at: new Date().toISOString(),
            })
            .eq('sample_order_id', qc.sample_order_id);

          await logWorkflowActivity(
            'sample',
            qc.sample_order_id,
            'QC Rejected by Supervisor — Rework Required',
            defectDescription,
            qcId,
          );
        } else {
          await supabase
            .from('sample_orders')
            .update({
              status: 'Rejected',
              rejection_reason: `QC Failed: ${defectDescription}`,
              last_qc_result: 'Failed',
              current_qc_id: qcId,
              customer_feedback: null,
              updated_at: new Date().toISOString(),
            })
            .eq('sample_order_id', qc.sample_order_id);

          await logWorkflowActivity(
            'sample',
            qc.sample_order_id,
            'QC Rejected — Sample Failed',
            defectDescription,
            qcId,
          );
        }
      }
    } catch (error) {
      console.error('Error rejecting QC:', error);
      throw error;
    }
  },

  getQCStats: async (): Promise<QCStats> => {
    try {
      const { data, error } = await supabase
        .from('quality_checks')
        .select('overall_status, approved_for_dispatch, rework_required, created_at');

      if (error) throw error;
      if (!data) return {
        pending: 0, passed: 0, failed: 0,
        rework: 0, approvalRate: 0, awaitingApproval: 0,
      };

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonth = data.filter((d) => new Date(d.created_at) >= monthStart);

      const passed = thisMonth.filter(
        (d) => d.overall_status === 'Passed' && d.approved_for_dispatch
      ).length;

      const failed = thisMonth.filter(
        (d) => d.overall_status === 'Failed'
      ).length;

      const awaitingApproval = thisMonth.filter(
        (d) => d.overall_status === 'Passed' && !d.approved_for_dispatch
      ).length;

      const rework = thisMonth.filter(
        (d) => d.rework_required
      ).length;

      const total = passed + failed;

      const [{ count: prodPending }, { count: samplePending }] = await Promise.all([
        supabase
          .from('production_orders')
          .select('production_order_id', { count: 'exact', head: true })
          .eq('status', 'QC Pending'),
        supabase
          .from('sample_orders')
          .select('sample_order_id', { count: 'exact', head: true })
          .eq('status', 'QC Pending'),
      ]);

      return {
        pending: (prodPending || 0) + (samplePending || 0),
        passed,
        failed,
        rework,
        approvalRate: total > 0
          ? Math.round((passed / total) * 1000) / 10
          : 0,
        awaitingApproval,
      };
    } catch (error) {
      console.error('Error fetching QC stats:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // WORKFLOW ACTIVITY LOG
  // ──────────────────────────────────────────────────────────

  getWorkflowActivity: async (
    jobId: string,
    jobType: 'sample' | 'production',
  ): Promise<{
    activity_id: number;
    activity: string;
    remarks?: string;
    created_at: string;
    performed_by_name?: string;
  }[]> => {
    try {
      const { data, error } = await supabase
        .from('workflow_activity_log')
        .select(`
                    activity_id,
                    activity,
                    remarks,
                    created_at,
                    performed_by_emp:performed_by(full_name)
                `)
        .eq('job_id', jobId)
        .eq('job_type', jobType)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!data || data.length === 0) return [];

      return data.map((row: any) => ({
        activity_id: row.activity_id,
        activity: row.activity,
        remarks: row.remarks,
        created_at: row.created_at,
        performed_by_name: row.performed_by_emp?.full_name || 'System',
      }));
    } catch (error) {
      console.error('Error fetching workflow activity:', error);
      return [];
    }
  },

  // ──────────────────────────────────────────────────────────
  // SAMPLE APPROVAL HISTORY
  // ──────────────────────────────────────────────────────────

  getSampleApprovalHistory: async (
    sampleOrderId: string,
  ): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('sample_approval_history')
        .select(`
                    *,
                    performed_by_emp:performed_by(full_name)
                `)
        .eq('sample_order_id', sampleOrderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sample approval history:', error);
      return [];
    }
  },

  addSampleApprovalHistory: async (payload: {
    sample_order_id: string;
    action_type: string;
    performed_by: number;
    feedback?: string;
    rejection_reason?: string;
    rework_required?: boolean;
    rework_description?: string;
    production_order_id?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase
        .from('sample_approval_history')
        .insert([{
          sample_order_id: payload.sample_order_id,
          action_type: payload.action_type,
          performed_by: payload.performed_by,
          feedback: payload.feedback || null,
          rejection_reason: payload.rejection_reason || null,
          rework_required: payload.rework_required || false,
          rework_description: payload.rework_description || null,
          production_order_id: payload.production_order_id || null,
          action_date: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error adding sample approval history:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // INVENTORY
  // ──────────────────────────────────────────────────────────

  getInventory: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*')
        .order('item');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return [];
    }
  },

  updateInventoryItem: async (
    id: number,
    updates: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('inventory')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating inventory:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // MACHINES — full CRUD
  // ──────────────────────────────────────────────────────────

  getMachineById: async (id: number): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('machines')
        .select('*')
        .eq('machine_id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching machine:', error);
      return null;
    }
  },

  createMachine: async (payload: {
    machine_code: string;
    machine_name: string;
    machine_type: string;
    model?: string;
    manufacturer?: string;
    status?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase
        .from('machines')
        .insert([{
          machine_code: payload.machine_code,
          machine_name: payload.machine_name,
          machine_type: payload.machine_type,
          model: payload.model || null,
          manufacturer: payload.manufacturer || null,
          status: payload.status || 'Available',
          is_operational: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating machine:', error);
      throw error;
    }
  },

  updateMachine: async (
    id: number,
    updates: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('machines')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('machine_id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating machine:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // CUSTOMERS — full CRUD
  // ──────────────────────────────────────────────────────────

  getCustomerById: async (id: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('customer_id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching customer:', error);
      return null;
    }
  },

  createCustomer: async (payload: {
    company_name: string;
    contact_person: string;
    phone_number: string;
    email: string;
    gst_number?: string;
    address?: string;
  }): Promise<string> => {
    try {
      const customerId = `CUST-${Date.now().toString().slice(-6)}`;

      const { error } = await supabase
        .from('customers')
        .insert([{
          customer_id: customerId,
          company_name: payload.company_name,
          contact_person: payload.contact_person,
          phone_number: payload.phone_number,
          email: payload.email,
          gst_number: payload.gst_number || null,
          address: payload.address || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) throw error;
      return customerId;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  },

  updateCustomer: async (
    id: string,
    updates: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('customers')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('customer_id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error;
    }
  },

  deleteCustomer: async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('customer_id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // EMPLOYEES — full CRUD
  // ──────────────────────────────────────────────────────────

  getEmployeeById: async (id: number): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching employee:', error);
      return null;
    }
  },

  getAllEmployees: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('full_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all employees:', error);
      return [];
    }
  },

  updateEmployee: async (
    id: number,
    updates: Record<string, unknown>,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('employees')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('employee_id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // INVOICES
  // ──────────────────────────────────────────────────────────

  getInvoices: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
                    *,
                    customers:customer_id(company_name, contact_person, email),
                    invoice_items(*)
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      return [];
    }
  },

  getInvoiceById: async (id: string): Promise<any | null> => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
                    *,
                    customers:customer_id(company_name, contact_person, email, address, gst_number),
                    invoice_items(*)
                `)
        .eq('invoice_id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching invoice:', error);
      return null;
    }
  },

  createInvoice: async (payload: {
    customer_id: string;
    quotation_id?: string;
    production_order_id?: string;
    invoice_number: string;
    invoice_date: string;
    due_date: string;
    subtotal: number;
    tax_percent: number;
    tax_amount: number;
    discount_amount: number;
    total_amount: number;
    notes?: string;
    items: any[];
    created_by: number;
  }): Promise<string> => {
    try {
      const invoiceId = `INV-${Date.now().toString().slice(-6)}`;

      const { error: invError } = await supabase
        .from('invoices')
        .insert([{
          invoice_id: invoiceId,
          customer_id: payload.customer_id,
          quotation_id: payload.quotation_id || null,
          production_order_id: payload.production_order_id || null,
          invoice_number: payload.invoice_number,
          invoice_date: payload.invoice_date,
          due_date: payload.due_date,
          subtotal: payload.subtotal,
          tax_percent: payload.tax_percent,
          tax_amount: payload.tax_amount,
          discount_amount: payload.discount_amount,
          total_amount: payload.total_amount,
          notes: payload.notes || null,
          status: 'Draft',
          payment_status: 'Pending',
          created_by: payload.created_by,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (invError) throw invError;

      if (payload.items && payload.items.length > 0) {
        const itemsToInsert = payload.items.map((item: any) => ({
          invoice_id: invoiceId,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          tax_percent: item.tax_percent || payload.tax_percent,
          tax_amount: item.tax_amount || 0,
          notes: item.notes || null,
          created_at: new Date().toISOString(),
        }));

        const { error: itemsError } = await supabase
          .from('invoice_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return invoiceId;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  },

  updateInvoiceStatus: async (
    id: string,
    status: string,
  ): Promise<void> => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('invoice_id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // PAYMENTS
  // ──────────────────────────────────────────────────────────

  getPayments: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
                    *,
                    quotations:quotation_id(
                        quotation_id,
                        customers:customer_id(company_name)
                    ),
                    received_by_emp:received_by(full_name)
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payments:', error);
      return [];
    }
  },

  createPayment: async (payload: {
    quotation_id: string;
    sample_order_id?: string;
    production_order_id?: string;
    invoice_id?: string;
    payment_type: string;
    amount: number;
    payment_date: string;
    payment_method?: string;
    reference_number?: string;
    received_by: number;
    notes?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase
        .from('payments')
        .insert([{
          quotation_id: payload.quotation_id,
          sample_order_id: payload.sample_order_id || null,
          production_order_id: payload.production_order_id || null,
          invoice_id: payload.invoice_id || null,
          payment_type: payload.payment_type,
          amount: payload.amount,
          payment_date: payload.payment_date,
          payment_method: payload.payment_method || null,
          reference_number: payload.reference_number || null,
          received_by: payload.received_by,
          notes: payload.notes || null,
          created_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating payment:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // DISPATCHES
  // ──────────────────────────────────────────────────────────

  getDispatches: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('dispatches')
        .select(`
                    *,
                    production_orders:production_order_id(
                        production_order_id,
                        quotations:quotation_id(
                            customers:customer_id(company_name),
                            quotation_products(product_name)
                        )
                    ),
                    dispatch_by_emp:dispatch_by(full_name)
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      return [];
    }
  },

  // ──────────────────────────────────────────────────────────
  // DELAY LOGS
  // ──────────────────────────────────────────────────────────

  getDelayLogs: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('delay_logs')
        .select(`
                    *,
                    reported_by_emp:reported_by(full_name),
                    resolved_by_emp:resolved_by(full_name)
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching delay logs:', error);
      return [];
    }
  },

  createDelayLog: async (payload: {
    production_order_id: string;
    delay_type: string;
    reported_by: number;
    delay_start_time: string;
    impact_description?: string;
    estimated_extra_days?: number;
    notes?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase
        .from('delay_logs')
        .insert([{
          production_order_id: payload.production_order_id,
          delay_type: payload.delay_type,
          reported_by: payload.reported_by,
          delay_date: new Date().toISOString(),
          delay_start_time: payload.delay_start_time,
          impact_description: payload.impact_description || null,
          estimated_extra_days: payload.estimated_extra_days || null,
          notes: payload.notes || null,
          status: 'Open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating delay log:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // PACKAGING DETAILS
  // ──────────────────────────────────────────────────────────

  getPackagingDetails: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('packaging_details')
        .select(`
                    *,
                    production_orders:production_order_id(
                        production_order_id,
                        quotations:quotation_id(
                            customers:customer_id(company_name),
                            quotation_products(product_name)
                        )
                    )
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching packaging details:', error);
      return [];
    }
  },

  createPackagingDetail: async (payload: {
    production_order_id: string;
    packaging_type: string;
    packaging_material?: string;
    units_per_package: number;
    number_of_packages: number;
    total_weight_kg?: number;
    notes?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase
        .from('packaging_details')
        .insert([{
          production_order_id: payload.production_order_id,
          packaging_type: payload.packaging_type,
          packaging_material: payload.packaging_material || null,
          units_per_package: payload.units_per_package,
          number_of_packages: payload.number_of_packages,
          total_weight_kg: payload.total_weight_kg || null,
          notes: payload.notes || null,
          status: 'Pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating packaging detail:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // SUNDRY EXPENSES
  // ──────────────────────────────────────────────────────────

  getSundryExpenses: async (): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('sundry_expenses')
        .select(`
                    *,
                    customers:customer_id(company_name),
                    created_by_emp:created_by(full_name),
                    approved_by_emp:approved_by(full_name)
                `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching sundry expenses:', error);
      return [];
    }
  },

  createSundryExpense: async (payload: {
    quotation_id: string;
    production_order_id?: string;
    customer_id: string;
    expense_date: string;
    expense_category: string;
    amount: number;
    total_amount: number;
    description: string;
    created_by: number;
    vendor_name?: string;
    payment_method?: string;
    notes?: string;
  }): Promise<void> => {
    try {
      const { error } = await supabase
        .from('sundry_expenses')
        .insert([{
          quotation_id: payload.quotation_id,
          production_order_id: payload.production_order_id || null,
          customer_id: payload.customer_id,
          expense_date: payload.expense_date,
          expense_category: payload.expense_category,
          amount: payload.amount,
          total_amount: payload.total_amount,
          gst_amount: 0,
          gst_applicable: false,
          description: payload.description,
          created_by: payload.created_by,
          vendor_name: payload.vendor_name || null,
          payment_method: payload.payment_method || null,
          status: 'Pending',
          is_approved: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating sundry expense:', error);
      throw error;
    }
  },

  // ──────────────────────────────────────────────────────────
  // COST ESTIMATIONS
  // ──────────────────────────────────────────────────────────

  getCostEstimations: async (quotationId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('cost_estimations')
        .select('*')
        .eq('quotation_id', quotationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cost estimations:', error);
      return [];
    }
  },

  createCostEstimation: async (payload: {
    quotation_id: string;
    line_item_id: number;
    estimation_type: string;
    sample_order_id?: string;
    production_order_id?: string;
    paper_cost?: number;
    ink_cost?: number;
    plate_cost?: number;
    machine_cost?: number;
    setup_cost?: number;
    lamination_cost?: number;
    binding_cost?: number;
    labor_cost?: number;
    packaging_cost?: number;
    profit_margin_percent?: number;
    total_cost?: number;
    final_price?: number;
    quantity_used: number;
  }): Promise<void> => {
    try {
      const totalCost =
        (payload.paper_cost || 0) +
        (payload.ink_cost || 0) +
        (payload.plate_cost || 0) +
        (payload.machine_cost || 0) +
        (payload.setup_cost || 0) +
        (payload.lamination_cost || 0) +
        (payload.binding_cost || 0) +
        (payload.labor_cost || 0) +
        (payload.packaging_cost || 0);

      const margin = (payload.profit_margin_percent || 15) / 100;
      const finalPrice = payload.final_price || totalCost * (1 + margin);

      const { error } = await supabase
        .from('cost_estimations')
        .insert([{
          quotation_id: payload.quotation_id,
          line_item_id: payload.line_item_id,
          estimation_type: payload.estimation_type,
          sample_order_id: payload.sample_order_id || null,
          production_order_id: payload.production_order_id || null,
          paper_cost: payload.paper_cost || 0,
          ink_cost: payload.ink_cost || 0,
          plate_cost: payload.plate_cost || 0,
          machine_cost: payload.machine_cost || 0,
          setup_cost: payload.setup_cost || 0,
          lamination_cost: payload.lamination_cost || 0,
          binding_cost: payload.binding_cost || 0,
          labor_cost: payload.labor_cost || 0,
          packaging_cost: payload.packaging_cost || 0,
          profit_margin_percent: payload.profit_margin_percent || 15,
          total_cost: payload.total_cost || totalCost,
          final_price: finalPrice,
          quantity_used: payload.quantity_used,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Error creating cost estimation:', error);
      throw error;
    }
  },

};

