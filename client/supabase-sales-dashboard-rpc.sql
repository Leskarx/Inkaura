-- ============================================================
-- SALES DASHBOARD RPC FUNCTIONS
-- Real-world print shop logic:
-- - Advance payments at quotation stage
-- - Invoice payments at delivery stage
-- - Both tracked separately and as total
-- - Materialized view auto-refreshed by app (no manual SQL needed)
-- ============================================================

DROP MATERIALIZED VIEW IF EXISTS sales_dashboard_summary CASCADE;

-- ── 1. Materialized View ─────────────────────────────────────
CREATE MATERIALIZED VIEW sales_dashboard_summary AS
WITH

-- All quotation-level advance payments
quotation_payments AS (
    SELECT
        p.quotation_id,
        SUM(p.amount) FILTER (WHERE p.payment_type != 'Refund') AS advance_collected,
        SUM(p.amount) FILTER (WHERE p.payment_type = 'Refund')  AS advance_refunded
    FROM payments p
    WHERE p.quotation_id IS NOT NULL
    GROUP BY p.quotation_id
),

-- All invoice-level payments
invoice_payments AS (
    SELECT
        p.invoice_id,
        SUM(p.amount) FILTER (WHERE p.payment_type != 'Refund') AS invoice_collected
    FROM payments p
    WHERE p.invoice_id IS NOT NULL
    GROUP BY p.invoice_id
),

-- Base data joining everything
base AS (
    SELECT
        q.created_by,
        q.quotation_id,
        q.status          AS q_status,
        q.total_payment,
        q.customer_id,
        po.production_order_id,
        po.status         AS po_status,
        i.invoice_id,
        i.total_amount,
        i.invoice_date,
        i.due_date,
        i.payment_status,
        COALESCE(qp.advance_collected, 0) AS advance_collected,
        COALESCE(qp.advance_refunded, 0)  AS advance_refunded,
        COALESCE(ip.invoice_collected, 0) AS invoice_collected
    FROM quotations q
    LEFT JOIN production_orders po  ON q.quotation_id = po.quotation_id
    LEFT JOIN invoices i            ON q.quotation_id = i.quotation_id
    LEFT JOIN quotation_payments qp ON q.quotation_id = qp.quotation_id
    LEFT JOIN invoice_payments ip   ON i.invoice_id   = ip.invoice_id
)

SELECT
    created_by,

    -- Customer & Quotation metrics
    COUNT(DISTINCT customer_id)                                                              AS total_customers,
    COUNT(DISTINCT quotation_id)                                                             AS total_quotations,
    COALESCE(SUM(total_payment), 0)                                                          AS quotation_value,
    COUNT(DISTINCT CASE WHEN q_status = 'Approved' THEN quotation_id END)                   AS approved_quotations,
    COUNT(DISTINCT CASE WHEN q_status = 'Sent'     THEN quotation_id END)                   AS sent_quotations,
    COUNT(DISTINCT CASE WHEN q_status = 'Draft'    THEN quotation_id END)                   AS draft_quotations,

    -- Order metrics
    COUNT(DISTINCT production_order_id)                                                      AS total_orders,
    COUNT(DISTINCT CASE WHEN po_status = 'Completed'   THEN production_order_id END)        AS completed_orders,
    COUNT(DISTINCT CASE WHEN po_status = 'In Progress' THEN production_order_id END)        AS active_orders,

    -- Revenue (from invoices)
    COALESCE(SUM(total_amount), 0)                                                           AS revenue,
    COALESCE(SUM(
        CASE WHEN DATE_TRUNC('month', invoice_date) = DATE_TRUNC('month', CURRENT_DATE)
        THEN total_amount ELSE 0 END
    ), 0)                                                                                    AS monthly_revenue,

    -- Payment breakdown
    COALESCE(SUM(DISTINCT advance_collected), 0)                                             AS advance_collected,
    COALESCE(SUM(invoice_collected), 0)                                                      AS invoice_collected,
    COALESCE(SUM(DISTINCT advance_collected), 0) + COALESCE(SUM(invoice_collected), 0)      AS total_collected,

    -- Outstanding (invoice not yet paid)
    COALESCE(SUM(total_amount) - SUM(invoice_collected), 0)                                 AS outstanding_amount,

    -- Overdue
    COALESCE(SUM(
        CASE WHEN due_date < CURRENT_DATE AND payment_status NOT IN ('Paid')
        THEN (total_amount - invoice_collected) ELSE 0 END
    ), 0)                                                                                    AS overdue_amount,
    COUNT(DISTINCT CASE
        WHEN due_date < CURRENT_DATE AND payment_status IN ('Pending','Partial')
        THEN invoice_id END)                                                                 AS overdue_invoices_count

FROM base
GROUP BY created_by;

CREATE UNIQUE INDEX idx_sales_dashboard_summary_emp
    ON sales_dashboard_summary (created_by);

-- ── 2. get_dashboard_summary ─────────────────────────────────
DROP FUNCTION IF EXISTS get_dashboard_summary(INT);
CREATE OR REPLACE FUNCTION get_dashboard_summary(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    IF emp_id IS NULL THEN
        SELECT json_build_object(
            'total_customers',        COALESCE(SUM(total_customers), 0),
            'total_quotations',       COALESCE(SUM(total_quotations), 0),
            'quotation_value',        COALESCE(SUM(quotation_value), 0),
            'approved_quotations',    COALESCE(SUM(approved_quotations), 0),
            'sent_quotations',        COALESCE(SUM(sent_quotations), 0),
            'draft_quotations',       COALESCE(SUM(draft_quotations), 0),
            'total_orders',           COALESCE(SUM(total_orders), 0),
            'completed_orders',       COALESCE(SUM(completed_orders), 0),
            'active_orders',          COALESCE(SUM(active_orders), 0),
            'revenue',                COALESCE(SUM(revenue), 0),
            'monthly_revenue',        COALESCE(SUM(monthly_revenue), 0),
            'advance_collected',      COALESCE(SUM(advance_collected), 0),
            'invoice_collected',      COALESCE(SUM(invoice_collected), 0),
            'total_collected',        COALESCE(SUM(total_collected), 0),
            'outstanding_amount',     COALESCE(SUM(outstanding_amount), 0),
            'overdue_amount',         COALESCE(SUM(overdue_amount), 0),
            'overdue_invoices_count', COALESCE(SUM(overdue_invoices_count), 0)
        ) INTO result
        FROM sales_dashboard_summary;
    ELSE
        SELECT json_build_object(
            'total_customers',        COALESCE(total_customers, 0),
            'total_quotations',       COALESCE(total_quotations, 0),
            'quotation_value',        COALESCE(quotation_value, 0),
            'approved_quotations',    COALESCE(approved_quotations, 0),
            'sent_quotations',        COALESCE(sent_quotations, 0),
            'draft_quotations',       COALESCE(draft_quotations, 0),
            'total_orders',           COALESCE(total_orders, 0),
            'completed_orders',       COALESCE(completed_orders, 0),
            'active_orders',          COALESCE(active_orders, 0),
            'revenue',                COALESCE(revenue, 0),
            'monthly_revenue',        COALESCE(monthly_revenue, 0),
            'advance_collected',      COALESCE(advance_collected, 0),
            'invoice_collected',      COALESCE(invoice_collected, 0),
            'total_collected',        COALESCE(total_collected, 0),
            'outstanding_amount',     COALESCE(outstanding_amount, 0),
            'overdue_amount',         COALESCE(overdue_amount, 0),
            'overdue_invoices_count', COALESCE(overdue_invoices_count, 0)
        ) INTO result
        FROM sales_dashboard_summary
        WHERE created_by = emp_id;
    END IF;
    RETURN COALESCE(result, '{}'::json);
END;
$$;

-- ── 3. get_revenue_summary (FIXED) ───────────────────────────
DROP FUNCTION IF EXISTS get_revenue_summary(INT);
CREATE OR REPLACE FUNCTION get_revenue_summary(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(row_data ORDER BY month_date)
    INTO result
    FROM (
        SELECT
            DATE_TRUNC('month', i.invoice_date)        AS month_date,
            TO_CHAR(i.invoice_date, 'Mon YY')          AS month,
            COALESCE(SUM(i.total_amount), 0)::numeric  AS revenue,
            COALESCE(SUM(
                CASE WHEN p.payment_type != 'Refund'
                THEN p.amount ELSE 0 END
            ), 0)::numeric                             AS invoice_collected
        FROM invoices i
        JOIN quotations q ON i.quotation_id = q.quotation_id
        LEFT JOIN payments p ON p.invoice_id = i.invoice_id
            AND p.payment_type != 'Refund'
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY
            DATE_TRUNC('month', i.invoice_date),
            TO_CHAR(i.invoice_date, 'Mon YY')
        ORDER BY DATE_TRUNC('month', i.invoice_date)
    ) row_data;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 4. get_payment_trend ──────────────────────────────────────
DROP FUNCTION IF EXISTS get_payment_trend(INT);
CREATE OR REPLACE FUNCTION get_payment_trend(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(row_data ORDER BY month_date)
    INTO result
    FROM (
        SELECT
            DATE_TRUNC('month', p.payment_date)         AS month_date,
            TO_CHAR(p.payment_date, 'Mon YY')           AS month,
            COALESCE(SUM(
                CASE WHEN p.invoice_id IS NULL THEN p.amount ELSE 0 END
            ), 0)::numeric                              AS advance,
            COALESCE(SUM(
                CASE WHEN p.invoice_id IS NOT NULL THEN p.amount ELSE 0 END
            ), 0)::numeric                              AS invoice
        FROM payments p
        JOIN quotations q ON p.quotation_id = q.quotation_id
        WHERE p.payment_type != 'Refund'
          AND (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY
            DATE_TRUNC('month', p.payment_date),
            TO_CHAR(p.payment_date, 'Mon YY')
        ORDER BY DATE_TRUNC('month', p.payment_date)
    ) row_data;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 5. get_collection_summary ─────────────────────────────────
DROP FUNCTION IF EXISTS get_collection_summary(INT);
CREATE OR REPLACE FUNCTION get_collection_summary(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(row_data)
    INTO result
    FROM (
        SELECT
            CASE
                WHEN CURRENT_DATE - i.due_date BETWEEN 0  AND 30 THEN '0-30 Days'
                WHEN CURRENT_DATE - i.due_date BETWEEN 31 AND 60 THEN '31-60 Days'
                WHEN CURRENT_DATE - i.due_date BETWEEN 61 AND 90 THEN '61-90 Days'
                ELSE '90+ Days'
            END                                         AS aging_bucket,
            COALESCE(SUM(
                i.total_amount - COALESCE(p_paid.paid, 0)
            ), 0)::numeric                              AS overdue_amount,
            COUNT(DISTINCT i.invoice_id)::int           AS invoice_count
        FROM invoices i
        JOIN quotations q ON i.quotation_id = q.quotation_id
        LEFT JOIN (
            SELECT invoice_id, SUM(amount) AS paid
            FROM payments
            WHERE payment_type != 'Refund'
            GROUP BY invoice_id
        ) p_paid ON p_paid.invoice_id = i.invoice_id
        WHERE i.payment_status IN ('Pending', 'Partial')
          AND i.due_date < CURRENT_DATE
          AND (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY 1
        ORDER BY MIN(CURRENT_DATE - i.due_date)
    ) row_data;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 6. get_funnel_summary ─────────────────────────────────────
DROP FUNCTION IF EXISTS get_funnel_summary(INT);
CREATE OR REPLACE FUNCTION get_funnel_summary(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(stage_data) INTO result FROM (
        SELECT 'Customers' AS stage,
               COUNT(DISTINCT q.customer_id)::int AS count
        FROM quotations q
        WHERE (emp_id IS NULL OR q.created_by = emp_id)

        UNION ALL
        SELECT 'Quotations', COUNT(*)::int
        FROM quotations q
        WHERE (emp_id IS NULL OR q.created_by = emp_id)

        UNION ALL
        SELECT 'Approved', COUNT(*)::int
        FROM quotations q
        WHERE q.status = 'Approved'
          AND (emp_id IS NULL OR q.created_by = emp_id)

        UNION ALL
        SELECT 'Orders', COUNT(*)::int
        FROM production_orders po
        JOIN quotations q ON po.quotation_id = q.quotation_id
        WHERE (emp_id IS NULL OR q.created_by = emp_id)

        UNION ALL
        SELECT 'Invoices', COUNT(*)::int
        FROM invoices i
        JOIN quotations q ON i.quotation_id = q.quotation_id
        WHERE (emp_id IS NULL OR q.created_by = emp_id)

        UNION ALL
        SELECT 'Paid', COUNT(*)::int
        FROM invoices i
        JOIN quotations q ON i.quotation_id = q.quotation_id
        WHERE i.payment_status = 'Paid'
          AND (emp_id IS NULL OR q.created_by = emp_id)
    ) stage_data;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 7. get_quotation_analytics ────────────────────────────────
DROP FUNCTION IF EXISTS get_quotation_analytics(INT);
CREATE OR REPLACE FUNCTION get_quotation_analytics(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(json_build_object('name', status, 'value', cnt))
    INTO result
    FROM (
        SELECT status, COUNT(*)::int AS cnt
        FROM quotations q
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY status
        ORDER BY cnt DESC
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 8. get_top_customers ──────────────────────────────────────
DROP FUNCTION IF EXISTS get_top_customers(INT);
CREATE OR REPLACE FUNCTION get_top_customers(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(json_build_object(
        'company_name', company_name,
        'revenue',      total_revenue,
        'advance',      advance_amt,
        'orders',       order_count,
        'quotations',   quotation_count
    ))
    INTO result
    FROM (
        SELECT
            c.company_name,
            COALESCE(SUM(i.total_amount), 0)::numeric           AS total_revenue,
            COALESCE(SUM(p_adv.amount), 0)::numeric             AS advance_amt,
            COUNT(DISTINCT po.production_order_id)::int         AS order_count,
            COUNT(DISTINCT q.quotation_id)::int                 AS quotation_count
        FROM customers c
        JOIN quotations q              ON c.customer_id   = q.customer_id
        LEFT JOIN invoices i           ON q.quotation_id  = i.quotation_id
        LEFT JOIN production_orders po ON q.quotation_id  = po.quotation_id
        LEFT JOIN payments p_adv       ON q.quotation_id  = p_adv.quotation_id
            AND p_adv.invoice_id IS NULL
            AND p_adv.payment_type != 'Refund'
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY c.company_name
        ORDER BY total_revenue DESC, advance_amt DESC
        LIMIT 5
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 9. get_order_status_summary ───────────────────────────────
DROP FUNCTION IF EXISTS get_order_status_summary(INT);
CREATE OR REPLACE FUNCTION get_order_status_summary(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_build_object(
        'pending',     COUNT(*) FILTER (WHERE po.status = 'Pending'),
        'in_progress', COUNT(*) FILTER (WHERE po.status = 'In Progress'),
        'qc_pending',  COUNT(*) FILTER (WHERE po.status = 'QC Pending'),
        'completed',   COUNT(*) FILTER (WHERE po.status = 'Completed'),
        'dispatched',  COUNT(*) FILTER (WHERE po.status = 'Dispatched')
    ) INTO result
    FROM production_orders po
    JOIN quotations q ON po.quotation_id = q.quotation_id
    WHERE (emp_id IS NULL OR q.created_by = emp_id);
    RETURN COALESCE(result, '{}'::json);
END;
$$;

-- ── 10. get_top_products ──────────────────────────────────────
DROP FUNCTION IF EXISTS get_top_products(INT);
CREATE OR REPLACE FUNCTION get_top_products(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(json_build_object(
        'product_name', product_name,
        'total_qty',    total_qty,
        'order_count',  order_count
    ))
    INTO result
    FROM (
        SELECT
            qp.product_name,
            COALESCE(SUM(qp.production_quantity), 0)::int AS total_qty,
            COUNT(*)::int                                  AS order_count
        FROM quotation_products qp
        JOIN quotations q ON qp.quotation_id = q.quotation_id
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        GROUP BY qp.product_name
        ORDER BY total_qty DESC
        LIMIT 5
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 11. get_employee_performance ─────────────────────────────
DROP FUNCTION IF EXISTS get_employee_performance();
CREATE OR REPLACE FUNCTION get_employee_performance()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(json_build_object(
        'name',            full_name,
        'quotations',      quotation_count,
        'approved',        approved_count,
        'revenue',         invoice_revenue,
        'advance',         advance_revenue,
        'total_collected', invoice_revenue + advance_revenue,
        'conversion_rate', CASE
                               WHEN quotation_count > 0
                               THEN ROUND((approved_count::numeric / quotation_count) * 100, 1)
                               ELSE 0
                           END
    ) ORDER BY (invoice_revenue + advance_revenue) DESC)
    INTO result
    FROM (
        SELECT
            e.full_name,
            COUNT(DISTINCT q.quotation_id)::int                                         AS quotation_count,
            COUNT(DISTINCT CASE WHEN q.status='Approved' THEN q.quotation_id END)::int AS approved_count,
            COALESCE(SUM(i.total_amount), 0)::numeric                                   AS invoice_revenue,
            COALESCE((
                SELECT SUM(p2.amount)
                FROM payments p2
                WHERE p2.quotation_id IN (
                    SELECT q2.quotation_id FROM quotations q2
                    WHERE q2.created_by = e.employee_id
                )
                AND p2.payment_type != 'Refund'
                AND p2.invoice_id IS NULL
            ), 0)::numeric                                                               AS advance_revenue
        FROM employees e
        LEFT JOIN quotations q ON e.employee_id = q.created_by
        LEFT JOIN invoices i   ON q.quotation_id = i.quotation_id
        WHERE e.is_active = true
        GROUP BY e.employee_id, e.full_name
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 12. get_recent_quotations ─────────────────────────────────
DROP FUNCTION IF EXISTS get_recent_quotations(INT);
CREATE OR REPLACE FUNCTION get_recent_quotations(emp_id INT DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE result json;
BEGIN
    SELECT json_agg(row_data)
    INTO result
    FROM (
        SELECT json_build_object(
            'quotation_id',    q.quotation_id,
            'customer_name',   c.company_name,
            'total_payment',   q.total_payment,
            'status',          q.status,
            'payment_status',  q.payment_status,
            'quotation_date',  q.quotation_date,
            'created_by_name', e.full_name,
            'advance_paid',    COALESCE((
                SELECT SUM(p.amount)
                FROM payments p
                WHERE p.quotation_id = q.quotation_id
                  AND p.payment_type != 'Refund'
                  AND p.invoice_id IS NULL
            ), 0)
        ) AS row_data
        FROM quotations q
        JOIN customers c ON q.customer_id = c.customer_id
        JOIN employees e ON q.created_by  = e.employee_id
        WHERE (emp_id IS NULL OR q.created_by = emp_id)
        ORDER BY q.created_at DESC
        LIMIT 8
    ) sub;
    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ── 13. Refresh (called automatically by app) ─────────────────
-- Users never need to run this manually.
-- The SalesDashboard.tsx calls this automatically on every load.
CREATE OR REPLACE FUNCTION refresh_dashboard_mvs()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sales_dashboard_summary;
END;
$$;

-- ── GRANT PERMISSIONS ─────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_dashboard_summary(INT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_revenue_summary(INT)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_payment_trend(INT)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_collection_summary(INT)      TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_funnel_summary(INT)          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_quotation_analytics(INT)     TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_customers(INT)           TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_status_summary(INT)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_top_products(INT)            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_employee_performance()       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recent_quotations(INT)       TO anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_mvs()          TO anon, authenticated;
GRANT SELECT ON sales_dashboard_summary                    TO anon, authenticated;