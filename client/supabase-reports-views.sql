-- =====================================================================================
-- PrintFlow ERP — Reports & Analytics Aggregation Layer
-- Designed to run directly on the existing schema without creating new tables.
-- Run this script in the Supabase SQL Editor.
-- =====================================================================================

-- Helper to calculate start date based on range
CREATE OR REPLACE FUNCTION get_filter_start_date(p_range TEXT) RETURNS TIMESTAMPTZ AS $$
BEGIN
    IF p_range = 'month' THEN RETURN date_trunc('month', CURRENT_DATE);
    ELSIF p_range = 'quarter' THEN RETURN date_trunc('quarter', CURRENT_DATE);
    ELSIF p_range = 'ytd' THEN RETURN date_trunc('year', CURRENT_DATE);
    ELSE RETURN '1900-01-01'::TIMESTAMPTZ; END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- -------------------------------------------------------------------------------------
-- 0. Top Executive KPIs RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_top_kpis(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT json_build_object(
        'net_revenue', COALESCE((SELECT SUM(COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0))
            FROM production_orders po
            LEFT JOIN job_financial_closure jfc ON po.id = jfc.production_order_id
            LEFT JOIN quotations q ON po.quotation_id = q.id
            LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM invoices GROUP BY production_order_id) inv ON po.id = inv.production_order_id
            WHERE po.created_at >= sd
            AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
            AND (p_status = 'ALL' OR po.status = p_status)
        ), 0),
        'total_cost', COALESCE((SELECT SUM(COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0))
            FROM production_orders po
            LEFT JOIN job_financial_closure jfc ON po.id = jfc.production_order_id
            LEFT JOIN (SELECT production_order_id, SUM(cost) as total_cost FROM cost_estimations GROUP BY production_order_id) ce ON po.id = ce.production_order_id
            LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM sundry_expenses GROUP BY production_order_id) se ON po.id = se.production_order_id
            LEFT JOIN quotations q ON po.quotation_id = q.id
            WHERE po.created_at >= sd
            AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
            AND (p_status = 'ALL' OR po.status = p_status)
        ), 0),
        'outstanding_receivables', COALESCE((
            SELECT SUM(i.amount - COALESCE(i.paid_amount, 0)) 
            FROM invoices i
            JOIN production_orders po ON i.production_order_id = po.id
            LEFT JOIN quotations q ON po.quotation_id = q.id
            WHERE i.status != 'PAID' AND i.created_at >= sd
            AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
            AND (p_status = 'ALL' OR po.status = p_status)
        ), 0),
        'otif_rate', COALESCE((
            SELECT (COUNT(CASE WHEN d.dispatch_date <= po.delivery_date THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric(10,1)
            FROM dispatches d JOIN production_orders po ON d.production_order_id = po.id
            LEFT JOIN quotations q ON po.quotation_id = q.id
            WHERE po.created_at >= sd
            AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
            AND (p_status = 'ALL' OR po.status = p_status)
        ), 100.0),
        'avg_turnaround', COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (COALESCE(actual_completion_date, CURRENT_TIMESTAMP) - created_at))/86400)::numeric(10,1)
            FROM production_orders po
            LEFT JOIN quotations q ON po.quotation_id = q.id
            WHERE actual_completion_date IS NOT NULL AND po.created_at >= sd
            AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
            AND (p_status = 'ALL' OR po.status = p_status)
        ), 0),
        'production_completion', COALESCE((
            SELECT (COUNT(CASE WHEN po.status = 'Completed' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric(10,1)
            FROM production_orders po
            LEFT JOIN quotations q ON po.quotation_id = q.id
            WHERE po.created_at >= sd
            AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
        ), 0),
        'avg_machine_util', COALESCE((
            SELECT (SUM(allocated_hours)::float / NULLIF((COUNT(DISTINCT machine_id) * 40), 0) * 100)::numeric(10,1)
            FROM production_capacity
            WHERE (p_machine_id IS NULL OR machine_id = p_machine_id)
            AND created_at >= sd
        ), 0),
        'maintenance_costs', COALESCE((SELECT SUM(maintenance_cost_ytd) FROM machines WHERE (p_machine_id IS NULL OR id = p_machine_id)), 0),
        'qc_failure_rate', COALESCE((
            SELECT (COUNT(CASE WHEN status = 'FAIL' THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric(10,1)
            FROM quality_checks
            WHERE created_at >= sd
        ), 0)
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------------------
-- 1. Financial Analytics RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_finance_kpis(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT json_build_object(
        'revenue_trend', (
            SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
            FROM (
                SELECT 
                    TO_CHAR(COALESCE(jfc.created_at, po.created_at), 'Mon') as month,
                    SUM(COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0)) as revenue,
                    SUM(COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0)) as cost,
                    SUM(COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0)) - 
                    SUM(COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0)) as profit
                FROM production_orders po
                LEFT JOIN job_financial_closure jfc ON po.id = jfc.production_order_id
                LEFT JOIN quotations q ON po.quotation_id = q.id
                LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM invoices GROUP BY production_order_id) inv ON po.id = inv.production_order_id
                LEFT JOIN (SELECT production_order_id, SUM(cost) as total_cost FROM cost_estimations GROUP BY production_order_id) ce ON po.id = ce.production_order_id
                LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM sundry_expenses GROUP BY production_order_id) se ON po.id = se.production_order_id
                WHERE po.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY month
                ORDER BY MIN(COALESCE(jfc.created_at, po.created_at))
            ) t
        ),
        'receivables_aging', (
            SELECT COALESCE(json_agg(row_to_json(ra)), '[]'::json)
            FROM (
                SELECT 
                    CASE 
                        WHEN CURRENT_DATE - i.due_date <= 30 THEN '0-30 Days'
                        WHEN CURRENT_DATE - i.due_date <= 60 THEN '31-60 Days'
                        WHEN CURRENT_DATE - i.due_date <= 90 THEN '61-90 Days'
                        ELSE '90+ Days'
                    END as bucket,
                    SUM(i.amount - COALESCE(i.paid_amount, 0)) as amount
                FROM invoices i
                JOIN production_orders po ON i.production_order_id = po.id
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE i.status != 'PAID' AND i.due_date IS NOT NULL AND i.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY bucket
            ) ra
        ),
        'expense_breakdown', (
            SELECT COALESCE(json_agg(row_to_json(eb)), '[]'::json)
            FROM (
                SELECT se.expense_category as name, SUM(se.amount) as value 
                FROM sundry_expenses se
                JOIN production_orders po ON se.production_order_id = po.id
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE se.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY se.expense_category
            ) eb
        ),
        'customer_profitability', (
            SELECT COALESCE(json_agg(row_to_json(cp)), '[]'::json)
            FROM (
                SELECT 
                    c.name as customer,
                    SUM(COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0)) as revenue,
                    SUM(COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0)) - 
                    SUM(COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0)) as profit
                FROM production_orders po
                LEFT JOIN quotations q ON po.quotation_id = q.id
                LEFT JOIN customers c ON q.customer_id = c.id
                LEFT JOIN job_financial_closure jfc ON po.id = jfc.production_order_id
                LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM invoices GROUP BY production_order_id) inv ON po.id = inv.production_order_id
                LEFT JOIN (SELECT production_order_id, SUM(cost) as total_cost FROM cost_estimations GROUP BY production_order_id) ce ON po.id = ce.production_order_id
                LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM sundry_expenses GROUP BY production_order_id) se ON po.id = se.production_order_id
                WHERE c.name IS NOT NULL AND po.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY c.id, c.name
                ORDER BY revenue DESC
                LIMIT 5
            ) cp
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------------------
-- 2. Production & Operations RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_production_kpis(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT json_build_object(
        'status_breakdown', (
            SELECT COALESCE(json_agg(row_to_json(sb)), '[]'::json)
            FROM (
                SELECT po.status as stage, COUNT(*) as count 
                FROM production_orders po
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE po.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY po.status
            ) sb
        ),
        'turnaround_data', (
            SELECT COALESCE(json_agg(row_to_json(td)), '[]'::json)
            FROM (
                SELECT 
                    'Average' as type,
                    AVG(EXTRACT(EPOCH FROM (po.expected_completion_date - po.created_at))/86400)::numeric(10,1) as planned,
                    AVG(EXTRACT(EPOCH FROM (COALESCE(po.actual_completion_date, CURRENT_TIMESTAMP) - po.created_at))/86400)::numeric(10,1) as actual
                FROM production_orders po
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE po.actual_completion_date IS NOT NULL AND po.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
            ) td
        ),
        'delay_analysis', (
            SELECT COALESCE(json_agg(row_to_json(da)), '[]'::json)
            FROM (
                SELECT dl.delay_type as issue, COUNT(*) as count 
                FROM delay_logs dl
                JOIN production_orders po ON dl.production_order_id = po.id
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE dl.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY dl.delay_type
            ) da
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------------------
-- 3. Machine & Capacity RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_machine_kpis(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT json_build_object(
        'capacity_load', (
            SELECT COALESCE(json_agg(row_to_json(cl)), '[]'::json)
            FROM (
                SELECT 
                    m.name as machine, 
                    SUM(pc.allocated_hours) as booked,
                    (40 - COALESCE(SUM(pc.allocated_hours), 0)) as available 
                FROM machines m
                LEFT JOIN production_capacity pc ON m.id = pc.machine_id AND pc.created_at >= sd
                WHERE (p_machine_id IS NULL OR m.id = p_machine_id)
                GROUP BY m.id, m.name
            ) cl
        ),
        'machine_roi', (
            SELECT COALESCE(json_agg(row_to_json(mr)), '[]'::json)
            FROM (
                SELECT 
                    m.name as machine,
                    SUM(COALESCE(jfc.total_income, 0)) as revenueGen,
                    SUM(COALESCE(m.maintenance_cost_ytd, 0)) as maintenance,
                    (SUM(COALESCE(pc.allocated_hours, 0)) / 40.0) * 100 as util
                FROM machines m
                LEFT JOIN operator_assignments oa ON m.id = oa.machine_id
                LEFT JOIN production_orders po ON oa.production_order_id = po.id
                LEFT JOIN job_financial_closure jfc ON po.id = jfc.production_order_id
                LEFT JOIN production_capacity pc ON m.id = pc.machine_id
                WHERE (p_machine_id IS NULL OR m.id = p_machine_id)
                GROUP BY m.id, m.name
            ) mr
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------------------
-- 4. Quality & Delivery RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_quality_kpis(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT json_build_object(
        'defect_analysis', (
            SELECT COALESCE(json_agg(row_to_json(da)), '[]'::json)
            FROM (
                SELECT qc.defect_type as issue, COUNT(*) as count 
                FROM quality_checks qc
                JOIN production_orders po ON qc.production_order_id = po.id
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE qc.status = 'FAIL' AND qc.defect_type IS NOT NULL AND qc.created_at >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY qc.defect_type
            ) da
        ),
        'otif_trend', (
            SELECT COALESCE(json_agg(row_to_json(ot)), '[]'::json)
            FROM (
                SELECT 
                    TO_CHAR(d.dispatch_date, 'Mon') as month,
                    (COUNT(CASE WHEN d.dispatch_date <= po.delivery_date THEN 1 END)::float / NULLIF(COUNT(*), 0) * 100)::numeric(10,1) as score
                FROM dispatches d
                JOIN production_orders po ON d.production_order_id = po.id
                LEFT JOIN quotations q ON po.quotation_id = q.id
                WHERE d.dispatch_date >= sd
                AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
                AND (p_status = 'ALL' OR po.status = p_status)
                GROUP BY month
                ORDER BY MIN(d.dispatch_date)
            ) ot
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------------------
-- 5. Customer & Sales RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_customer_kpis(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT json_build_object(
        'conversion_funnel', (
            SELECT COALESCE(json_agg(row_to_json(cf)), '[]'::json)
            FROM (
                SELECT 'Quotations' as stage, (SELECT COUNT(*) FROM quotations WHERE created_at >= sd AND (p_customer_id IS NULL OR customer_id = p_customer_id)) as value
                UNION ALL
                SELECT 'Samples Requested', (SELECT COUNT(so.*) FROM sample_orders so JOIN quotations q ON so.quotation_id = q.id WHERE so.created_at >= sd AND (p_customer_id IS NULL OR q.customer_id = p_customer_id))
                UNION ALL
                SELECT 'Production Started', (SELECT COUNT(po.*) FROM production_orders po JOIN quotations q ON po.quotation_id = q.id WHERE po.created_at >= sd AND (p_customer_id IS NULL OR q.customer_id = p_customer_id))
                UNION ALL
                SELECT 'Jobs Completed', (SELECT COUNT(po.*) FROM production_orders po JOIN quotations q ON po.quotation_id = q.id WHERE po.status = 'Completed' AND po.created_at >= sd AND (p_customer_id IS NULL OR q.customer_id = p_customer_id))
            ) cf
        )
    ) INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- -------------------------------------------------------------------------------------
-- 6. Job Profitability Deep Dive RPC
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_reports_job_profitability(
    p_date_range TEXT DEFAULT 'ALL',
    p_customer_id UUID DEFAULT NULL,
    p_machine_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'ALL'
) RETURNS JSON AS $$
DECLARE
    result JSON;
    sd TIMESTAMPTZ := get_filter_start_date(p_date_range);
BEGIN
    SELECT COALESCE(json_agg(row_to_json(jd)), '[]'::json)
    FROM (
        SELECT 
            po.id as id,
            c.name as client,
            COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0) as rev,
            COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0) as cost,
            (COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0) - COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0)) as profit,
            CASE WHEN COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0) > 0 THEN 
                ((COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 0) - COALESCE(jfc.total_cost, ce.total_cost, se.total_amount, po.additional_cost, 0)) / COALESCE(jfc.total_income, inv.total_amount, q.total_amount, 1) * 100)::numeric(10,1) || '%'
            ELSE '0%' END as margin,
            COALESCE((SELECT SUM(estimated_extra_days) FROM delay_logs WHERE production_order_id = po.id), 0) as delay,
            po.status as status
        FROM production_orders po
        LEFT JOIN quotations q ON po.quotation_id = q.id
        LEFT JOIN customers c ON q.customer_id = c.id
        LEFT JOIN job_financial_closure jfc ON po.id = jfc.production_order_id
        LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM invoices GROUP BY production_order_id) inv ON po.id = inv.production_order_id
        LEFT JOIN (SELECT production_order_id, SUM(cost) as total_cost FROM cost_estimations GROUP BY production_order_id) ce ON po.id = ce.production_order_id
        LEFT JOIN (SELECT production_order_id, SUM(amount) as total_amount FROM sundry_expenses GROUP BY production_order_id) se ON po.id = se.production_order_id
        WHERE po.created_at >= sd
        AND (p_customer_id IS NULL OR q.customer_id = p_customer_id)
        AND (p_status = 'ALL' OR po.status = p_status)
        ORDER BY po.created_at DESC
        LIMIT 50
    ) jd INTO result;
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
