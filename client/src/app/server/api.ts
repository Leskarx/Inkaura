// server/api.ts
import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.warn('Missing Supabase environment variables.');
}

export const supabase = createClient(
    supabaseUrl || 'https://your-project.supabase.co',
    supabaseKey || 'your-anon-key'
);

// Types
export type SampleStatus = "Pending" | "In Progress" | "Awaiting Approval" | "Approved" | "Rejected" | "Production Created";
export type ProductionStatus = "Pending" | "In Progress" | "QC Pending" | "Completed" | "Dispatched";
export type Priority = "High" | "Medium" | "Low";

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
      breakdown: { material: number; machine: number; labor: number; finishing: number; packaging: number };
    };
    products: QuotationProduct[];
    workflow: {
      sampleOrder: string;
      productionOrder: string;
      dispatch: string;
      invoice: string;
      closure: string;
    };
    activities: Array<{ type: string; timestamp: string; user: string; note: string }>;
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
    sampleJobId: string;
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
    assignedTo: string;
    dueDate: string;
}

export interface CreateProductionJobRequest {
    sampleJobId: string;
    quantity: number;
    deliveryDate: string;
    machineId: string;
    operatorId: string;
    priority: Priority;
}

// ==================== HELPER FUNCTIONS ====================

// Helper function to map database row to SampleJob interface
const mapToSampleJob = (item: any): SampleJob => {
    return {
        id: item.sample_order_id,
        quotationId: item.quotation_id,
        customer: item.customers?.company_name || 'Unknown',
        product: item.quotation_products?.product_name || 'Unknown',
        sampleQuantity: item.sample_quantity || 0,
        sampleCost: item.sample_cost || 0,
        assignedTo: item.employees?.full_name || 'Unassigned',
        status: item.status || 'Pending',
        dueDate: item.due_date || '',
        createdDate: item.created_at || new Date().toISOString(),
        rejectionReason: item.rejection_reason,
        approvedDate: item.approved_date,
        productionJobId: item.production_job_id,
    };
};

// Helper function to map database row to ProductionJob interface
const mapToProductionJob = (item: any): ProductionJob => {
    const sampleOrder = item.sample_orders || {};

    return {
        id: item.production_order_id,
        sampleJobId: item.sample_order_id,
        quotationId: sampleOrder.quotation_id || item.quotation_id || '',
        customer: sampleOrder.customers?.company_name || 'Unknown',
        product: sampleOrder.quotation_products?.product_name || 'Unknown',
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
    // Safely extract nested properties
    const customerName = item.customers?.company_name || 'Unknown';
    const ownerName = item.employees?.full_name || 'System';
    const sampleStatus = item.sample_orders && item.sample_orders.length > 0 ? item.sample_orders[0].status : "N/A";
    const sampleId = item.sample_orders && item.sample_orders.length > 0 ? item.sample_orders[0].sample_order_id : "N/A";
    const prodStatus = item.production_orders && item.production_orders.length > 0 ? item.production_orders[0].status : "N/A";
    const prodId = item.production_orders && item.production_orders.length > 0 ? item.production_orders[0].production_order_id : "N/A";
    
    // Map products
    const products = (item.quotation_products || []).map((p: any) => ({
      desc: p.product_name || 'Product',
      qty: p.production_quantity || 0,
      rate: 0, // Rate might come from cost_estimations or is derived
      total: 0, // Total might come from cost_estimations
      specs: {
        material: p.material_type || "N/A",
        gsm: p.paper_gsm ? `${p.paper_gsm}gsm` : "N/A",
        dimensions: `${p.width_cm || 0}x${p.height_cm || 0}cm`,
        printingTech: p.printing_technology || "N/A",
        colors: p.color_type || "N/A",
        lamination: p.lamination || "N/A",
        packaging: p.packaging_type || "N/A"
      }
    }));

    // Map costing (if available)
    let estTotal = 0;
    if (item.cost_estimations && item.cost_estimations.length > 0) {
      estTotal = item.cost_estimations.reduce((acc: number, c: any) => acc + (c.total_cost || 0), 0);
    }

    return {
        id: item.quotation_id,
        version: "v1", // No versioning in DB yet
        customer: customerName,
        date: new Date(item.quotation_date || item.created_at).toLocaleDateString(),
        validUntil: item.delivery_date ? new Date(item.delivery_date).toLocaleDateString() : 'N/A',
        status: item.status || "Draft",
        owner: ownerName,
        createdBy: ownerName,
        lastUpdatedBy: ownerName,
        sentBy: null,
        sentTimestamp: null,
        commercials: {
            subtotal: Number(item.total_payment) || 0,
            gst: (Number(item.total_payment) || 0) * 0.18, // Dummy GST calculation
            total: (Number(item.total_payment) || 0) * 1.18,
            advanceRequiredPct: Number(item.advance_percentage) || 30,
            advanceReceivedAmt: 0, // Need to join payments table if tracking this
            paymentTerms: `${item.advance_percentage || 30}% Advance`
        },
        costing: {
            estimatedTotalCost: estTotal,
            expectedMargin: (Number(item.total_payment) || 0) - estTotal,
            profitMarginPct: estTotal > 0 && item.total_payment ? Math.round((((Number(item.total_payment) || 0) - estTotal) / (Number(item.total_payment) || 0)) * 100) : 0,
            breakdown: { material: estTotal * 0.4, machine: estTotal * 0.3, labor: estTotal * 0.2, finishing: estTotal * 0.05, packaging: estTotal * 0.05 } // Mock breakdown based on total
        },
        products: products.length > 0 ? products : [{
            desc: "Custom Print Job", qty: 1000, rate: (Number(item.total_payment) || 0) / 1000, total: Number(item.total_payment) || 0,
            specs: { material: "Custom", gsm: "N/A", dimensions: "Custom", printingTech: "Custom", colors: "Custom", lamination: "N/A", packaging: "N/A" }
        }],
        workflow: {
            sampleOrder: sampleId !== "N/A" ? sampleStatus : "N/A",
            productionOrder: prodId !== "N/A" ? prodStatus : "N/A",
            dispatch: "N/A",
            invoice: "N/A",
            closure: "N/A"
        },
        activities: [
            { type: "Created", timestamp: new Date(item.created_at).toLocaleString(), user: ownerName, note: item.notes || "Quotation created" }
        ]
    };
};

// ==================== API FUNCTIONS ====================

export const api = {
    // ==================== QUOTATIONS ====================

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
            // Generate ID
            const qId = `QT-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
            
            // Insert Quotation
            const { error: qError } = await supabase.from('quotations').insert([{
                quotation_id: qId,
                customer_id: payload.customer_id,
                quotation_date: payload.quotation_date,
                total_payment: payload.total_payment,
                advance_percentage: payload.advance_percentage,
                notes: payload.notes,
                created_by: payload.created_by,
                status: 'Draft'
            }]);
            
            if (qError) throw qError;

            // Insert Products
            if (payload.products && payload.products.length > 0) {
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
                    color_type: p.color_type || 'CMYK'
                }));
                const { error: pError } = await supabase.from('quotation_products').insert(productsToInsert);
                if (pError) throw pError;
            }
        } catch (error) {
            console.error('Error creating quotation:', error);
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
            // Update Quotation
            const { error: qError } = await supabase.from('quotations').update({
                customer_id: payload.customer_id,
                quotation_date: payload.quotation_date,
                total_payment: payload.total_payment,
                advance_percentage: payload.advance_percentage,
                notes: payload.notes,
                created_by: payload.created_by,
            }).eq('quotation_id', id);
            
            if (qError) throw qError;

            // Delete old products
            const { error: delError } = await supabase.from('quotation_products').delete().eq('quotation_id', id);
            if (delError) throw delError;

            // Insert new Products
            if (payload.products && payload.products.length > 0) {
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
                    color_type: p.color_type || 'CMYK'
                }));
                const { error: pError } = await supabase.from('quotation_products').insert(productsToInsert);
                if (pError) throw pError;
            }
        } catch (error) {
            console.error('Error updating quotation:', error);
            throw error;
        }
    },

    // ==================== SAMPLE JOBS ====================

    getSampleJobs: async (): Promise<SampleJob[]> => {
        try {
            const { data, error } = await supabase
                .from('sample_orders')
                .select(`
                    *,
                    customers:customer_id(company_name),
                    employees:assigned_to(full_name),
                    quotation_products:product_id(product_name),
                    quotations:quotation_id(quotation_id, total_payment)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                return [];
            }

            return data.map(mapToSampleJob);
        } catch (error) {
            console.error('Error fetching sample jobs:', error);
            throw error;
        }
    },

    createSampleJob: async (data: CreateSampleJobRequest): Promise<SampleJob> => {
        const { data: result, error } = await supabase
            .from('sample_orders')
            .insert([{
                quotation_id: data.quotationId,
                customer_id: data.customerId,
                product_id: data.productId,
                sample_quantity: data.sampleQuantity,
                sample_cost: data.sampleCost,
                assigned_to: data.assignedTo,
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

        if (error) {
            console.error('Error creating sample job:', error);
            throw new Error(error.message);
        }

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

        if (error) {
            console.error('Error approving sample:', error);
            throw new Error(error.message);
        }

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

        if (error) {
            console.error('Error rejecting sample:', error);
            throw new Error(error.message);
        }

        return mapToSampleJob(data);
    },

    // ==================== PRODUCTION JOBS ====================

    getProductionJobs: async (): Promise<ProductionJob[]> => {
        try {
            const { data, error } = await supabase
                .from('production_orders')
                .select(`
                    *,
                    employees:assigned_to(full_name),
                    machines:machine_id(machine_name),
                    sample_orders:sample_order_id(
                        sample_order_id,
                        quotation_id,
                        customer_id,
                        product_id,
                        customers:customer_id(company_name),
                        quotation_products:product_id(product_name),
                        quotations:quotation_id(quotation_id, total_payment)
                    )
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!data || data.length === 0) {
                return [];
            }

            return data.map(mapToProductionJob);
        } catch (error) {
            console.error('Error fetching production jobs:', error);
            throw error;
        }
    },

    createProductionJob: async (data: CreateProductionJobRequest): Promise<ProductionJob> => {
        // Get the sample job with its quotation data
        const { data: sampleData, error: sampleError } = await supabase
            .from('sample_orders')
            .select(`
                *,
                quotations:quotation_id(quotation_id, total_payment)
            `)
            .eq('sample_order_id', data.sampleJobId)
            .single();

        if (sampleError) {
            console.error('Error fetching sample job:', sampleError);
            throw new Error('Sample job not found');
        }

        // Calculate value from quotation total or estimate
        const estimatedValue = sampleData.quotations?.total_payment ||
            (data.quantity * sampleData.sample_cost) || 0;

        const { data: result, error } = await supabase
            .from('production_orders')
            .insert([{
                sample_order_id: data.sampleJobId,
                quotation_id: sampleData.quotation_id,
                original_quantity: data.quantity,
                final_quantity: data.quantity,
                assigned_to: data.operatorId,
                machine_id: data.machineId,
                priority: data.priority,
                status: 'Pending',
                progress: 0,
                delivery_date: data.deliveryDate,
                created_at: new Date().toISOString(),
                value: estimatedValue,
            }])
            .select(`
                *,
                employees:assigned_to(full_name),
                machines:machine_id(machine_name),
                sample_orders:sample_order_id(
                    sample_order_id,
                    quotation_id,
                    customer_id,
                    product_id,
                    customers:customer_id(company_name),
                    quotation_products:product_id(product_name),
                    quotations:quotation_id(quotation_id, total_payment)
                )
            `)
            .single();

        if (error) {
            console.error('Error creating production job:', error);
            throw new Error(error.message);
        }

        // Use 'Production Created' status
        try {
            await supabase
                .from('sample_orders')
                .update({
                    production_job_id: result.production_order_id,
                    status: 'Production Created',
                })
                .eq('sample_order_id', data.sampleJobId);
        } catch (updateError) {
            console.warn('Could not update sample with production_job_id:', updateError);
        }

        return mapToProductionJob(result);
    },

    updateProductionProgress: async (id: string, progress: number): Promise<ProductionJob> => {
        const { data, error } = await supabase
            .from('production_orders')
            .update({
                progress: progress,
                status: progress === 100 ? 'Completed' : undefined,
            })
            .eq('production_order_id', id)
            .select(`
                *,
                employees:assigned_to(full_name),
                machines:machine_id(machine_name),
                sample_orders:sample_order_id(
                    sample_order_id,
                    quotation_id,
                    customer_id,
                    product_id,
                    customers:customer_id(company_name),
                    quotation_products:product_id(product_name),
                    quotations:quotation_id(quotation_id, total_payment)
                )
            `)
            .single();

        if (error) {
            console.error('Error updating progress:', error);
            throw new Error(error.message);
        }

        return mapToProductionJob(data);
    },

    updateProductionStatus: async (id: string, status: ProductionStatus): Promise<ProductionJob> => {
        const { data, error } = await supabase
            .from('production_orders')
            .update({
                status: status,
                progress: status === 'Completed' ? 100 : undefined,
            })
            .eq('production_order_id', id)
            .select(`
                *,
                employees:assigned_to(full_name),
                machines:machine_id(machine_name),
                sample_orders:sample_order_id(
                    sample_order_id,
                    quotation_id,
                    customer_id,
                    product_id,
                    customers:customer_id(company_name),
                    quotation_products:product_id(product_name),
                    quotations:quotation_id(quotation_id, total_payment)
                )
            `)
            .single();

        if (error) {
            console.error('Error updating status:', error);
            throw new Error(error.message);
        }

        return mapToProductionJob(data);
    },

    // ==================== DROPDOWN DATA ====================

    getEmployees: async (): Promise<{ id: string; name: string; role: string }[]> => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('employee_id, full_name, role')
                .order('full_name');

            if (error) throw error;

            if (!data || data.length === 0) {
                return [];
            }

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

    getMachines: async (): Promise<{ id: string; name: string; type: string; status: string }[]> => {
        try {
            const { data, error } = await supabase
                .from('machines')
                .select('machine_id, machine_name, machine_type, status')
                .order('machine_name');

            if (error) throw error;

            if (!data || data.length === 0) {
                return [];
            }

            return data.map((machine: any) => ({
                id: machine.machine_id,
                name: machine.machine_name,
                type: machine.machine_type,
                status: machine.status,
            }));
        } catch (error) {
            console.error('Error fetching machines:', error);
            throw error;
        }
    },

    getCustomers: async (): Promise<{ id: string; name: string; email: string }[]> => {
        try {
            const { data, error } = await supabase
                .from('customers')
                .select('customer_id, company_name, contact_person, email')
                .order('company_name');

            if (error) throw error;

            if (!data || data.length === 0) {
                return [];
            }

            return data.map((customer: any) => ({
                id: customer.customer_id,
                name: customer.company_name,
                contact_person: customer.contact_person,
                email: customer.email,
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

            if (!data || data.length === 0) {
                return [];
            }

            return data.map((product: any) => ({
                id: product.line_item_id,
                name: product.product_name,
                price: 0,
            }));
        } catch (error) {
            console.error('Error fetching products:', error);
            throw error;
        }
    },
};