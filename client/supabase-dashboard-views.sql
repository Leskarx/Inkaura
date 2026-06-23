-- ==============================================================================
-- Enterprise Sales Dashboard Performance Views & Aggregations
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. MATERIALIZED VIEWS
-- We use these to avoid querying raw tables and causing N+1 on dashboard load

DROP MATERIALIZED VIEW IF EXISTS sales_dashboard_summary CASCADE;
CREATE MATERIALIZED VIEW sales_dashboard_summary AS
WITH base_data AS (
    SELECT 
        q.created_by,
        q.quotation_id,
        q.status as q_status,
        q.total_payment,
        q.customer_id,
        po.production_order_id,
        po.status as po_status,
        i.invoice_id,
        i.total_amount,
        i.invoice_date,
        i.due_date,
        i.payment_status,
        COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.invoice_id), 0) as paid_amount
    FROM quotations q
    LEFT JOIN production_orders po ON q.quotation_id = po.quotation_id
    LEFT JOIN invoices i ON q.quotation_id = i.quotation_id
)
SELECT 
    created_by,
    COUNT(DISTINCT customer_id) as total_customers,
    COUNT(DISTINCT quotation_id) as total_quotations,
    SUM(total_payment) as quotation_value,
    COUNT(DISTINCT CASE WHEN q_status = 'Approved' THEN quotation_id END) as approved_quotations,
    COUNT(DISTINCT production_order_id) as total_orders,
    COUNT(DISTINCT CASE WHEN po_status = 'Completed' THEN production_order_id END) as completed_orders,
    SUM(total_amount) as revenue,
    SUM(CASE WHEN date_trunc('month', invoice_date) = date_trunc('month', CURRENT_DATE) THEN total_amount ELSE 0 END) as monthly_revenue,
    SUM(paid_amount) as collected_amount,
    SUM(total_amount) - SUM(paid_amount) as outstanding_amount,
    SUM(CASE WHEN due_date < CURRENT_DATE AND payment_status != 'Paid' THEN (total_amount - paid_amount) ELSE 0 END) as overdue_amount
FROM base_data
GROUP BY created_by;


-- 2. RPC ENDPOINTS (API Layer)
-- These functions act as our Dashboard API and handle RBAC natively via parameter.

CREATE OR REPLACE FUNCTION get_dashboard_summary(emp_id UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    IF emp_id IS NULL THEN
        -- Admin: Global Summary
        SELECT json_build_object(
            'total_customers', SUM(total_customers),
            'total_quotations', SUM(total_quotations),
            'quotation_value', SUM(quotation_value),
            'approved_quotations', SUM(approved_quotations),
            'total_orders', SUM(total_orders),
            'completed_orders', SUM(completed_orders),
            'revenue', SUM(revenue),
            'monthly_revenue', SUM(monthly_revenue),
            'collected_amount', SUM(collected_amount),
            'outstanding_amount', SUM(outstanding_amount),
            'overdue_amount', SUM(overdue_amount)
        ) INTO result
        FROM sales_dashboard_summary;
    ELSE
        -- Sales Exec: Filtered Summary
        SELECT json_build_object(
            'total_customers', total_customers,
            'total_quotations', total_quotations,
            'quotation_value', quotation_value,
            'approved_quotations', approved_quotations,
            'total_orders', total_orders,
            'completed_orders', completed_orders,
            'revenue', revenue,
            'monthly_revenue', monthly_revenue,
            'collected_amount', collected_amount,
            'outstanding_amount', outstanding_amount,
            'overdue_amount', overdue_amount
        ) INTO result
        FROM sales_dashboard_summary
        WHERE created_by = emp_id;
    END IF;
    
    RETURN COALESCE(result, '{}'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_revenue_summary(emp_id UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(json_build_object('month', TO_CHAR(month, 'Mon YYYY'), 'revenue', total))
    INTO result
    FROM (
        SELECT date_trunc('month', invoice_date) as month, SUM(total_amount) as total
        FROM invoices i
        JOIN quotations q ON i.quotation_id = q.quotation_id
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY 1
        ORDER BY 1
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_collection_summary(emp_id UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(json_build_object('aging_bucket', bucket, 'overdue_amount', amt))
    INTO result
    FROM (
        SELECT 
            CASE 
                WHEN CURRENT_DATE - i.due_date <= 30 THEN '0-30 Days'
                WHEN CURRENT_DATE - i.due_date <= 60 THEN '31-60 Days'
                WHEN CURRENT_DATE - i.due_date <= 90 THEN '61-90 Days'
                ELSE '90+ Days'
            END as bucket,
            SUM(i.total_amount - COALESCE((SELECT SUM(amount) FROM payments WHERE invoice_id = i.invoice_id), 0)) as amt
        FROM invoices i
        JOIN quotations q ON i.quotation_id = q.quotation_id
        WHERE i.payment_status != 'Paid' AND i.due_date < CURRENT_DATE
        AND (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY 1
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. REFRESH CRON JOB
-- Setup this function in Supabase to refresh materialized views regularly.
CREATE OR REPLACE FUNCTION refresh_dashboard_mvs()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY sales_dashboard_summary;
END;
$$ LANGUAGE plpgsql;

-- 4. ADDITIONAL RPC ENDPOINTS FOR DASHBOARD SECTIONS
CREATE OR REPLACE FUNCTION get_funnel_summary(emp_id UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(stage_data) INTO result FROM (
        SELECT 'Customers' as stage, COUNT(DISTINCT customer_id) as count FROM customers
        UNION ALL
        SELECT 'Quotations', COUNT(*) FROM quotations WHERE (emp_id IS NULL OR created_by = emp_id)
        UNION ALL
        SELECT 'Orders', COUNT(*) FROM production_orders po JOIN quotations q ON po.quotation_id = q.quotation_id WHERE (emp_id IS NULL OR q.created_by = emp_id)
        UNION ALL
        SELECT 'Invoices', COUNT(*) FROM invoices i JOIN quotations q ON i.quotation_id = q.quotation_id WHERE (emp_id IS NULL OR q.created_by = emp_id)
        UNION ALL
        SELECT 'Payments', COUNT(DISTINCT p.invoice_id) FROM payments p JOIN invoices i ON p.invoice_id = i.invoice_id JOIN quotations q ON i.quotation_id = q.quotation_id WHERE (emp_id IS NULL OR q.created_by = emp_id)
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_quotation_analytics(emp_id UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(json_build_object('name', status, 'value', cnt)) INTO result FROM (
        SELECT status, COUNT(*) as cnt FROM quotations
        WHERE (emp_id IS NULL OR created_by = emp_id)
        GROUP BY status
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION get_top_customers(emp_id UUID DEFAULT NULL)
RETURNS json AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(json_build_object('company_name', company_name, 'revenue', total_revenue)) INTO result FROM (
        SELECT c.company_name, COALESCE(SUM(i.total_amount), 0) as total_revenue
        FROM customers c
        JOIN quotations q ON c.customer_id = q.customer_id
        JOIN invoices i ON q.quotation_id = i.quotation_id
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY c.company_name
        ORDER BY total_revenue DESC
        LIMIT 5
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

