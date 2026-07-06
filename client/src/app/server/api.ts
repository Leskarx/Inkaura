// server/api.ts
import { createClient } from '@supabase/supabase-js';

// ─── Supabase Client ──────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing Supabase environment variables.');
}

export const supabase = createClient(
    supabaseUrl || 'https://your-project.supabase.co',
    supabaseKey || 'your-anon-key'
);

// ─── Types ────────────────────────────────────────────────────
export type SampleStatus = "Pending" | "In Progress" | "QC Pending" | "Awaiting Approval" | "Approved" | "Rejected" | "Production Created";
export type ProductionStatus = "Pending" | "In Progress" | "QC Pending" | "Completed" | "Dispatched" | "Rework Required" | "Failed";
export type Priority = "High" | "Medium" | "Low";
export type QCStatus = 'Pending' | 'Passed' | 'Failed' | 'Rework';
export type QCRating = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'NA';
export type CheckType = 'Pre-Press' | 'During Production' | 'Post Production' | 'Final';

// ─── Role constants ───────────────────────────────────────────
export const QC_SUBMIT_ROLES = ['admin', 'supervisor', 'qc', 'quality', 'qc_team'];
export const QC_APPROVE_ROLES = ['admin', 'supervisor'];

// ─── Role check helpers (case-insensitive) ────────────────────
export const hasQCSubmitRole = (role: string) =>
    QC_SUBMIT_ROLES.includes(role.toLowerCase().trim());

export const hasQCApproveRole = (role: string) =>
    QC_APPROVE_ROLES.includes(role.toLowerCase().trim());

// ─── Interfaces ───────────────────────────────────────────────

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
}

export interface CreateQualityCheckRequest {
    production_order_id: string;
    sample_order_id?: string;
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

// ─── Mapper Helpers ───────────────────────────────────────────

const mapToSampleJob = (item: any): SampleJob => {
    let currentStatus = item.status || 'Pending';
    // If a production order exists for this quotation, the sample is done
    if (item.quotations?.production_orders && item.quotations.production_orders.length > 0) {
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
    };
};

const mapToQuotationData = (item: any): QuotationData => {
    const customerName = item.customers?.company_name || 'Unknown';
    const ownerName = item.employees?.full_name || 'System';
    const sampleId = item.sample_orders?.[0]?.sample_order_id ?? "N/A";
    const sampleStatus = item.sample_orders?.[0]?.status ?? "N/A";
    const prodId = item.production_orders?.[0]?.production_order_id ?? "N/A";
    const prodStatus = item.production_orders?.[0]?.status ?? "N/A";

    const products = (item.quotation_products || []).map((p: any) => ({
        desc: p.product_name || 'Product',
        qty: p.production_quantity || 0,
        rate: 0,
        total: 0,
        specs: {
            material: p.material_type || "N/A",
            gsm: p.paper_gsm ? `${p.paper_gsm}gsm` : "N/A",
            dimensions: `${p.width_cm || 0}x${p.height_cm || 0}cm`,
            printingTech: p.printing_technology || "N/A",
            colors: p.color_type || "N/A",
            lamination: p.lamination || "N/A",
            packaging: p.packaging_type || "N/A",
        },
    }));

    const estTotal = (item.cost_estimations || []).reduce(
        (acc: number, c: any) => acc + (c.total_cost || 0), 0
    );
    const totalPayment = Number(item.total_payment) || 0;

    return {
        id: item.quotation_id,
        customerId: item.customer_id || '',
        version: "v1",
        customer: customerName,
        date: new Date(item.quotation_date || item.created_at).toLocaleDateString(),
        validUntil: item.delivery_date
            ? new Date(item.delivery_date).toLocaleDateString()
            : 'N/A',
        status: item.status || "Draft",
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
            desc: "Custom Print Job",
            qty: 1000,
            rate: totalPayment / 1000,
            total: totalPayment,
            specs: {
                material: "Custom",
                gsm: "N/A",
                dimensions: "Custom",
                printingTech: "Custom",
                colors: "Custom",
                lamination: "N/A",
                packaging: "N/A",
            },
        }],
        workflow: {
            sampleOrder: sampleId !== "N/A" ? sampleStatus : "N/A",
            productionOrder: prodId !== "N/A" ? prodStatus : "N/A",
            dispatch: "N/A",
            invoice: "N/A",
            closure: "N/A",
        },
        sampleJobId: sampleId !== "N/A" ? sampleId : undefined,
        activities: [{
            type: "Created",
            timestamp: new Date(item.created_at).toLocaleString(),
            user: ownerName,
            note: item.notes || "Quotation created",
        }],
    };
};

// ── QC mapper ─────────────────────────────────────────────────
const mapToQualityCheck = (item: any): QualityCheck => ({
    qc_id: item.qc_id,
    production_order_id: item.production_order_id,
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

// ─── Select Fragments ─────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────

const getCurrentEmployeeId = async (): Promise<number> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 1;
        const { data: emp } = await supabase
            .from('employees')
            .select('employee_id')
            .eq('auth_user_id', user.id)
            .maybeSingle();
        return emp?.employee_id ?? 1;
    } catch {
        return 1;
    }
};

const safeProductName = (name: string | null | undefined): string => {
    if (!name || name.trim() === '') return 'Custom Print Job';
    return name.trim();
};

const enrichQualityCheck = async (qc: QualityCheck): Promise<QualityCheck> => {
    try {
        if (qc.production_order_id) {
            const { data: po } = await supabase
                .from('production_orders')
                .select('final_quantity, quotation_id')
                .eq('production_order_id', qc.production_order_id)
                .single();

            if (!po) return qc;
            qc.quantity = po.final_quantity || 0;

            const { data: quotation } = await supabase
                .from('quotations')
                .select('customers:customer_id(company_name)')
                .eq('quotation_id', po.quotation_id)
                .single();

            const qt = quotation as any;
            qc.customer_name = qt?.customers?.company_name || 'Unknown';

            const { data: products } = await supabase
                .from('quotation_products')
                .select('product_name, product_type, printing_technology')
                .eq('quotation_id', po.quotation_id)
                .limit(1);

            const qp = products?.[0];
            qc.product_name = safeProductName(qp?.product_name);
            qc.product_type = qp?.product_type || 'Custom';
            qc.printing_technology = qp?.printing_technology || 'N/A';
        } else if (qc.sample_order_id) {
            const { data: so } = await supabase
                .from('sample_orders')
                .select('sample_quantity, quotation_id')
                .eq('sample_order_id', qc.sample_order_id)
                .single();

            if (!so) return qc;
            qc.quantity = so.sample_quantity || 0;

            const { data: quotation } = await supabase
                .from('quotations')
                .select('customers:customer_id(company_name)')
                .eq('quotation_id', so.quotation_id)
                .single();

            const qt = quotation as any;
            qc.customer_name = qt?.customers?.company_name || 'Unknown';

            const { data: products } = await supabase
                .from('quotation_products')
                .select('product_name, product_type, printing_technology')
                .eq('quotation_id', so.quotation_id)
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

// ── Check active QC for a production order ────────────────────
const getActiveQCForOrder = async (
    orderId: string,
    jobType: 'Production' | 'Sample' = 'Production'
): Promise<{ hasActive: boolean; activeQCStatus?: string; activeQCId?: number }> => {
    try {
        const column = jobType === 'Production' ? 'production_order_id' : 'sample_order_id';
        const { data } = await supabase
            .from('quality_checks')
            .select('qc_id, overall_status, approved_for_dispatch')
            .eq(column, orderId)
            .order('created_at', { ascending: false })
            .limit(1);

        if (!data || data.length === 0) return { hasActive: false };

        const latest = data[0];

        if (latest.approved_for_dispatch) {
            return { hasActive: true, activeQCStatus: 'Approved', activeQCId: latest.qc_id };
        }
        if (latest.overall_status === 'Passed') {
            return { hasActive: true, activeQCStatus: 'Awaiting Approval', activeQCId: latest.qc_id };
        }
        if (latest.overall_status === 'Failed') {
            return { hasActive: false, activeQCStatus: 'Failed' };
        }

        return { hasActive: false };
    } catch {
        return { hasActive: false };
    }
};

// =====================================================
// API OBJECT
// =====================================================
export const api = {

    // ─── CURRENT EMPLOYEE ─────────────────────────────────────

    getCurrentEmployee: async (): Promise<CurrentEmployee | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data: emp, error } = await supabase
                .from('employees')
                .select('employee_id, full_name, email, role, department')
                .eq('auth_user_id', user.id)
                .maybeSingle();

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

    // ─── QUOTATIONS ───────────────────────────────────────────

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
                const productsToInsert = payload.products.map(p => ({
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
                const productsToInsert = payload.products.map(p => ({
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

    // ─── SAMPLE JOBS ──────────────────────────────────────────

    getSampleJobs: async (): Promise<SampleJob[]> => {
        try {
            const { data, error } = await supabase
                .from('sample_orders')
                .select(`
                    *,
                    customers:customer_id(company_name),
                    employees:assigned_to(full_name),
                    quotation_products:product_id(product_name),
                    quotations:quotation_id(quotation_id, total_payment, production_orders(production_order_id))
                `)
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
                created_at: new Date().toISOString(),
            }])
            .select(`
                *,
                customers:customer_id(company_name),
                employees:assigned_to(full_name),
                quotation_products:product_id(product_name),
                quotations:quotation_id(quotation_id, total_payment)
            `)
            .single();

        if (error) throw new Error(error.message);
        return mapToSampleJob(result);
    },

    approveSample: async (id: string): Promise<SampleJob> => {
        const { data, error } = await supabase
            .from('sample_orders')
            .update({
                status: 'Approved',
                approved_date: new Date().toISOString(),
            })
            .eq('sample_order_id', id)
            .select(`
                *,
                customers:customer_id(company_name),
                employees:assigned_to(full_name),
                quotation_products:product_id(product_name),
                quotations:quotation_id(quotation_id, total_payment)
            `)
            .single();

        if (error) throw new Error(error.message);
        return mapToSampleJob(data);
    },

    rejectSample: async (id: string, reason: string): Promise<SampleJob> => {
        const { data, error } = await supabase
            .from('sample_orders')
            .update({
                status: 'Rejected',
                rejection_reason: reason,
            })
            .eq('sample_order_id', id)
            .select(`
                *,
                customers:customer_id(company_name),
                employees:assigned_to(full_name),
                quotation_products:product_id(product_name),
                quotations:quotation_id(quotation_id, total_payment)
            `)
            .single();

        if (error) throw new Error(error.message);
        return mapToSampleJob(data);
    },

    updateSampleStatus: async (id: string, status: SampleStatus): Promise<SampleJob> => {
        const { data, error } = await supabase
            .from('sample_orders')
            .update({
                status: status,
            })
            .eq('sample_order_id', id)
            .select(`
                *,
                customers:customer_id(company_name),
                employees:assigned_to(full_name),
                quotation_products:product_id(product_name),
                quotations:quotation_id(quotation_id, total_payment)
            `)
            .single();

        if (error) {
            console.error('Error updating sample status:', error);
            throw new Error(error.message);
        }
        return mapToSampleJob(data);
    },

    // ─── PRODUCTION JOBS ──────────────────────────────────────

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

                if (sampleError) {
                    console.error('Error fetching sample job:', sampleError);
                    throw new Error('Sample job not found');
                }

                const poId = `PO-${Date.now().toString().slice(-6)}`;
                const estimatedValue = sampleData.quotations?.total_payment ||
                    (data.quantity * sampleData.sample_cost) || 0;

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
                    })
                    .eq('sample_order_id', data.sampleJobId);

                return mapToProductionJob(result);
            } else {
                const { data: quotation, error: quoteError } = await supabase
                    .from('quotations')
                    .select(`
                        *,
                        quotation_products(*),
                        customers:customer_id(company_name)
                    `)
                    .eq('quotation_id', data.quotationId)
                    .single();

                if (quoteError) {
                    console.error('Error fetching quotation:', quoteError);
                    throw new Error('Quotation not found');
                }

                let product = quotation.quotation_products?.[0];
                let productQuantity = 1000;

                if (!product) {
                    const defaultProduct = {
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
                    };

                    const { data: newProduct, error: insertError } = await supabase
                        .from('quotation_products')
                        .insert([defaultProduct])
                        .select()
                        .single();

                    if (insertError) {
                        console.warn('Could not create default product, using fallback values:', insertError);
                        productQuantity = 1000;
                    } else {
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
                        delivery_date: data.deliveryDate,
                        created_at: new Date().toISOString(),
                        value: quotation.total_payment || 0,
                    }])
                    .select(PRODUCTION_SELECT)
                    .single();

                if (prodError) {
                    console.error('Error creating production order:', prodError);
                    throw new Error(prodError.message);
                }
                return mapToProductionJob(result);
            }
        } catch (error) {
            console.error('Error creating production job:', error);
            throw error;
        }
    },

    updateProductionProgress: async (id: string, progress: number): Promise<ProductionJob> => {
        const { data, error } = await supabase
            .from('production_orders')
            .update({
                progress,
                status: progress === 100 ? 'Completed' : undefined,
            })
            .eq('production_order_id', id)
            .select(PRODUCTION_SELECT)
            .single();

        if (error) throw new Error(error.message);
        return mapToProductionJob(data);
    },

    updateProductionStatus: async (id: string, status: ProductionStatus): Promise<ProductionJob> => {
        const { data, error } = await supabase
            .from('production_orders')
            .update({
                status,
                progress: status === 'Completed' ? 100 : undefined,
            })
            .eq('production_order_id', id)
            .select(PRODUCTION_SELECT)
            .single();

        if (error) throw new Error(error.message);
        return mapToProductionJob(data);
    },

    // ─── DISPATCH ─────────────────────────────────────────────

    dispatchProductionOrder: async (productionOrderId: string, employeeId: number): Promise<void> => {
        try {
            const { data: productionOrder, error: fetchError } = await supabase
                .from('production_orders')
                .select('sample_order_id, quotation_id')
                .eq('production_order_id', productionOrderId)
                .single();

            if (fetchError) {
                console.error('Error fetching production order:', fetchError);
                throw fetchError;
            }

            const { error: dispatchError } = await supabase
                .from('dispatches')
                .insert({
                    production_order_id: productionOrderId,
                    dispatch_by: employeeId,
                    total_quantity: 1,
                    quantity_dispatched: 1,
                    status: 'Delivered',
                    notes: 'Direct Delivery',
                    dispatch_date: new Date().toISOString(),
                });

            if (dispatchError) throw dispatchError;

            const { error: updateError } = await supabase
                .from('production_orders')
                .update({ status: 'Dispatched' })
                .eq('production_order_id', productionOrderId);

            if (updateError) throw updateError;

            if (productionOrder?.sample_order_id) {
                await supabase
                    .from('sample_orders')
                    .update({ status: 'Production Created' })
                    .eq('sample_order_id', productionOrder.sample_order_id);
            }
        } catch (error) {
            console.error('Error dispatching production order:', error);
            throw error;
        }
    },

    // ─── QUALITY CONTROL ──────────────────────────────────────

    getQualityChecks: async (): Promise<QualityCheck[]> => {
        try {
            const { data, error } = await supabase.rpc('get_quality_checks_enriched');

            if (error) throw error;
            if (!data || data.length === 0) return [];

            return data as QualityCheck[];
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
            const { data, error } = await supabase.rpc('get_jobs_for_qc');

            if (error) throw error;
            if (!data || data.length === 0) return [];

            return data.map((job: any) => ({
                order_id: job.order_id,
                job_type: job.job_type,
                status: job.status,
                final_quantity: job.final_quantity,
                quotation_id: job.quotation_id,
                customer_name: job.customer_name || 'Unknown',
                product_name: safeProductName(job.product_name),
                product_type: job.product_type || 'Custom',
                printing_technology: job.printing_technology || 'N/A',
                hasActiveQC: job.has_active_qc,
                activeQCStatus: job.active_qc_status,
                activeQCId: job.active_qc_id,
            }));
        } catch (error) {
            console.error('Error fetching jobs for QC:', error);
            throw error;
        }
    },

    createQualityCheck: async (payload: CreateQualityCheckRequest & { job_type?: 'Production' | 'Sample' }): Promise<QualityCheck> => {
        try {
            const employee = await api.getCurrentEmployee();
            if (employee && !hasQCSubmitRole(employee.role)) {
                throw new Error(
                    `Your role (${employee.role}) cannot submit QC reports. ` +
                    `Allowed: Admin, Supervisor, QC, Quality.`
                );
            }

            const existingQC = await getActiveQCForOrder(payload.production_order_id, payload.job_type);
            if (existingQC.hasActive) {
                throw new Error(
                    existingQC.activeQCStatus === 'Awaiting Approval'
                        ? 'This job already has a QC report awaiting supervisor approval.'
                        : 'This job has already been approved for dispatch.'
                );
            }

            const checkedBy = await getCurrentEmployeeId();

            const { data, error } = await supabase
                .from('quality_checks')
                .insert([{
                    production_order_id: payload.job_type === 'Sample' ? null : payload.production_order_id,
                    sample_order_id: payload.job_type === 'Sample' ? payload.production_order_id : null,
                    check_type: payload.check_type,
                    checked_by: checkedBy,
                    color_accuracy: payload.color_accuracy,
                    print_quality: payload.print_quality,
                    binding_quality: payload.binding_quality || null,
                    material_quality: payload.material_quality,
                    dimensional_accuracy: payload.dimensional_accuracy,
                    finishing_quality: payload.finishing_quality,
                    overall_status: payload.overall_status,
                    defect_type: payload.defect_type || null,
                    defect_quantity: payload.defect_quantity || 0,
                    defect_description: payload.defect_description || null,
                    rework_required: payload.rework_required || false,
                    rework_description: payload.rework_description || null,
                    approved_for_dispatch: false,
                    notes: payload.notes || null,
                }])
                .select(QC_SELECT)
                .single();

            if (error) throw error;

            // Update production order status based on QC result
            if (payload.overall_status === 'Failed') {
                if (payload.job_type === 'Sample') {
                    await supabase
                        .from('sample_orders')
                        .update({ status: 'In Progress' })
                        .eq('sample_order_id', payload.production_order_id);
                } else {
                    await supabase
                        .from('production_orders')
                        .update({ status: 'Rework Required', progress: 0 })
                        .eq('production_order_id', payload.production_order_id);
                }
            } else if (payload.overall_status === 'Passed') {
                // If passed, it stays in QC Pending (Awaiting Supervisor Approval)
            }

            return await enrichQualityCheck(mapToQualityCheck(data));
        } catch (error) {
            console.error('Error creating quality check:', error);
            throw error;
        }
    },

    approveQualityCheck: async (qcId: number, notes?: string, checklist?: PostDevChecklist): Promise<void> => {
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
                .select('production_order_id, sample_order_id')
                .eq('qc_id', qcId)
                .single();
            if (fetchError) throw fetchError;

            const updatePayload: any = {
                approved_for_dispatch: true,
                approved_by: approvedBy,
                approved_date: new Date().toISOString(),
                notes: notes || null,
            };

            // Store checklist data if provided
            if (checklist) {
                updatePayload.post_dev_checklist = checklist;
                updatePayload.checklist_verified_date = new Date().toISOString();
            }

            const { error } = await supabase
                .from('quality_checks')
                .update(updatePayload)
                .eq('qc_id', qcId);
            if (error) throw error;

            if (qc.production_order_id) {
                await supabase
                    .from('production_orders')
                    .update({ status: 'Completed' })
                    .eq('production_order_id', qc.production_order_id);
            } else if (qc.sample_order_id) {
                await supabase
                    .from('sample_orders')
                    .update({ status: 'Awaiting Approval' }) // Send to Sample Jobs for final approval
                    .eq('sample_order_id', qc.sample_order_id);
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

            const { data: qc, error: fetchError } = await supabase
                .from('quality_checks')
                .select('production_order_id, sample_order_id')
                .eq('qc_id', qcId)
                .single();
            if (fetchError) throw fetchError;

            const { error } = await supabase
                .from('quality_checks')
                .update({
                    overall_status: 'Failed',
                    defect_description: defectDescription,
                    rework_required: reworkRequired,
                    rework_description: reworkDescription || null,
                    approved_for_dispatch: false,
                })
                .eq('qc_id', qcId);
            if (error) throw error;

            // Update production order status based on rework requirement
            if (qc.production_order_id) {
                if (reworkRequired) {
                    await supabase
                        .from('production_orders')
                        .update({ status: 'Rework Required', progress: 0 })
                        .eq('production_order_id', qc.production_order_id);
                } else {
                    await supabase
                        .from('production_orders')
                        .update({ status: 'Failed' })
                        .eq('production_order_id', qc.production_order_id);
                }
            } else if (qc.sample_order_id) {
                // If sample job QC fails, send it back to "In Progress" for rework
                await supabase
                    .from('sample_orders')
                    .update({ status: 'In Progress' })
                    .eq('sample_order_id', qc.sample_order_id);
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

            const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
            const thisMonth = data.filter(d => new Date(d.created_at) >= monthStart);
            const passed = thisMonth.filter(d => d.overall_status === 'Passed' && d.approved_for_dispatch).length;
            const failed = thisMonth.filter(d => d.overall_status === 'Failed').length;
            const awaitingApproval = thisMonth.filter(d => d.overall_status === 'Passed' && !d.approved_for_dispatch).length;
            const total = passed + failed;

            const { count: pendingCount } = await supabase
                .from('production_orders')
                .select('production_order_id', { count: 'exact', head: true })
                .eq('status', 'QC Pending');

            return {
                pending: pendingCount || 0,
                passed,
                failed,
                rework: thisMonth.filter(d => d.rework_required).length,
                approvalRate: total > 0 ? Math.round((passed / total) * 1000) / 10 : 0,
                awaitingApproval,
            };
        } catch (error) {
            console.error('Error fetching QC stats:', error);
            throw error;
        }
    },

    // ─── DROPDOWN DATA ────────────────────────────────────────

    getEmployees: async (): Promise<{ id: number; name: string; role: string }[]> => {
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

    getMachines: async (): Promise<{ id: number; name: string; type: string; status: string; code?: string; isOperational?: boolean }[]> => {
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

    getCustomers: async (): Promise<{ id: string; name: string; email: string; contact_person?: string }[]> => {
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

    getProducts: async (): Promise<{ id: number; name: string; price: number }[]> => {
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

            if (error || !data || data.length === 0) {
                return 'INV-1001';
            }

            const lastId = data[0].invoice_id; // e.g. "INV-1501"
            const lastNum = parseInt(lastId.replace('INV-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1001 : lastNum + 1;
            return `INV-${String(nextNum).padStart(4, '0')}`;
        } catch {
            return 'INV-1001';
        }
    },
};