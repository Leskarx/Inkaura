-- ============================================================
-- ADMIN DASHBOARD RPC FUNCTIONS
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. get_admin_kpis
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_kpis()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_revenue_mtd numeric;
  v_active_jobs bigint;
  v_completed_jobs bigint;
  v_pending_payments numeric;
  v_total_customers bigint;
  v_open_quotations bigint;
  v_revenue_last_month numeric;
  v_revenue_growth numeric;
  v_total_production bigint;
  v_qc_pending bigint;
  v_dispatch_pending bigint;
  v_low_stock_count bigint;
BEGIN
  -- Revenue Month to Date (from payments, current month)
  SELECT COALESCE(SUM(amount), 0)
  INTO v_revenue_mtd
  FROM payments
  WHERE payment_type != 'Refund'
    AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE);

  -- Revenue Last Month
  SELECT COALESCE(SUM(amount), 0)
  INTO v_revenue_last_month
  FROM payments
  WHERE payment_type != 'Refund'
    AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month');

  -- Revenue Growth %
  IF v_revenue_last_month > 0 THEN
    v_revenue_growth := ROUND(((v_revenue_mtd - v_revenue_last_month) / v_revenue_last_month) * 100, 1);
  ELSE
    v_revenue_growth := 0;
  END IF;

  -- Active Jobs (production orders not completed/cancelled)
  SELECT COUNT(*)
  INTO v_active_jobs
  FROM production_orders
  WHERE status IN ('Pending', 'Approved', 'In Progress', 'On Hold');

  -- Completed Jobs (this month)
  SELECT COUNT(*)
  INTO v_completed_jobs
  FROM production_orders
  WHERE status = 'Completed'
    AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE);

  -- Pending Payments (sum of unpaid invoices)
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_pending_payments
  FROM invoices
  WHERE payment_status IN ('Pending', 'Partial');

  -- Total Customers
  SELECT COUNT(*)
  INTO v_total_customers
  FROM customers;

  -- Open Quotations (Draft or Sent)
  SELECT COUNT(*)
  INTO v_open_quotations
  FROM quotations
  WHERE status IN ('Draft', 'Sent');

  -- Total Production Orders
  SELECT COUNT(*)
  INTO v_total_production
  FROM production_orders;

  -- QC Pending
  SELECT COUNT(*)
  INTO v_qc_pending
  FROM quality_checks
  WHERE overall_status = 'Pending';

  -- Dispatch Pending
  SELECT COUNT(*)
  INTO v_dispatch_pending
  FROM dispatches
  WHERE status = 'Pending';

  -- Low Stock Items
  SELECT COUNT(*)
  INTO v_low_stock_count
  FROM material_inventory
  WHERE current_stock < minimum_stock_level;

  SELECT json_build_object(
    'revenue_mtd',        v_revenue_mtd,
    'revenue_last_month', v_revenue_last_month,
    'revenue_growth',     v_revenue_growth,
    'active_jobs',        v_active_jobs,
    'completed_jobs',     v_completed_jobs,
    'pending_payments',   v_pending_payments,
    'total_customers',    v_total_customers,
    'open_quotations',    v_open_quotations,
    'total_production',   v_total_production,
    'qc_pending',         v_qc_pending,
    'dispatch_pending',   v_dispatch_pending,
    'low_stock_count',    v_low_stock_count
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 2. get_admin_pipeline
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_pipeline()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_inquiry bigint;
  v_estimation bigint;
  v_quotation bigint;
  v_sample bigint;
  v_approval bigint;
  v_advance_pmt bigint;
  v_job_order bigint;
  v_production bigint;
  v_qc bigint;
  v_packaging bigint;
  v_dispatch bigint;
  v_invoice bigint;
  v_payment bigint;
  v_closure bigint;
BEGIN
  -- Inquiry = Draft quotations (initial stage)
  SELECT COUNT(*) INTO v_inquiry
  FROM quotations WHERE status = 'Draft';

  -- Estimation = quotations with cost estimations but not sent
  SELECT COUNT(*) INTO v_estimation
  FROM quotations q
  WHERE q.status = 'Draft'
    AND EXISTS (SELECT 1 FROM cost_estimations ce WHERE ce.quotation_id = q.quotation_id);

  -- Quotation = Sent to customer
  SELECT COUNT(*) INTO v_quotation
  FROM quotations WHERE status = 'Sent';

  -- Sample = sample orders in progress
  SELECT COUNT(*) INTO v_sample
  FROM sample_orders WHERE status IN ('Pending', 'In Progress');

  -- Approval = sample orders awaiting approval
  SELECT COUNT(*) INTO v_approval
  FROM sample_orders WHERE status = 'Awaiting Approval';

  -- Advance Payment = production orders pending advance verification
  SELECT COUNT(*) INTO v_advance_pmt
  FROM production_orders WHERE advance_payment_verified = false AND status != 'Cancelled';

  -- Job Order = production orders created but not started
  SELECT COUNT(*) INTO v_job_order
  FROM production_orders WHERE status = 'Approved';

  -- Production = in progress
  SELECT COUNT(*) INTO v_production
  FROM production_orders WHERE status = 'In Progress';

  -- QC = quality checks pending
  SELECT COUNT(*) INTO v_qc
  FROM quality_checks WHERE overall_status IN ('Pending', 'Failed');

  -- Packaging = packaging details pending
  SELECT COUNT(*) INTO v_packaging
  FROM packaging_details WHERE status = 'Pending';

  -- Dispatch = dispatches in transit
  SELECT COUNT(*) INTO v_dispatch
  FROM dispatches WHERE status = 'In Transit';

  -- Invoice = invoices sent
  SELECT COUNT(*) INTO v_invoice
  FROM invoices WHERE status = 'Sent' AND payment_status != 'Paid';

  -- Payment = overdue invoices
  SELECT COUNT(*) INTO v_payment
  FROM invoices
  WHERE payment_status IN ('Pending', 'Partial')
    AND due_date < CURRENT_DATE;

  -- Closure = job financial closures pending
  SELECT COUNT(*) INTO v_closure
  FROM job_financial_closure WHERE status = 'Pending';

  SELECT json_build_array(
    json_build_object('step', 1,  'label', 'Inquiry',     'count', v_inquiry),
    json_build_object('step', 2,  'label', 'Estimation',  'count', v_estimation),
    json_build_object('step', 3,  'label', 'Quotation',   'count', v_quotation),
    json_build_object('step', 4,  'label', 'Sample',      'count', v_sample),
    json_build_object('step', 5,  'label', 'Approval',    'count', v_approval),
    json_build_object('step', 6,  'label', 'Advance Pmt', 'count', v_advance_pmt),
    json_build_object('step', 7,  'label', 'Job Order',   'count', v_job_order),
    json_build_object('step', 8,  'label', 'Production',  'count', v_production),
    json_build_object('step', 9,  'label', 'QC',          'count', v_qc),
    json_build_object('step', 10, 'label', 'Packaging',   'count', v_packaging),
    json_build_object('step', 11, 'label', 'Dispatch',    'count', v_dispatch),
    json_build_object('step', 12, 'label', 'Invoice',     'count', v_invoice),
    json_build_object('step', 13, 'label', 'Payment',     'count', v_payment),
    json_build_object('step', 14, 'label', 'Closure',     'count', v_closure)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 3. get_admin_revenue_trend
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_revenue_trend()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_order)
  INTO result
  FROM (
    SELECT
      TO_CHAR(DATE_TRUNC('month', gs.month_date), 'Mon YY') AS month,
      COALESCE(SUM(p.amount), 0)::numeric AS revenue,
      -- Target = 10% more than previous month revenue (simple target model)
      COALESCE(
        LAG(SUM(p.amount)) OVER (ORDER BY DATE_TRUNC('month', gs.month_date)) * 1.1,
        COALESCE(SUM(p.amount), 0) * 1.1
      )::numeric AS target
    FROM (
      SELECT generate_series(
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '5 months'),
        DATE_TRUNC('month', CURRENT_DATE),
        '1 month'
      ) AS month_date
    ) gs
    LEFT JOIN payments p
      ON DATE_TRUNC('month', p.payment_date) = gs.month_date
      AND p.payment_type != 'Refund'
    GROUP BY gs.month_date
    ORDER BY gs.month_date
  ) row_order;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 4. get_admin_job_status
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_job_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      status AS name,
      COUNT(*)::int AS value
    FROM production_orders
    GROUP BY status
    ORDER BY value DESC
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 5. get_admin_print_types
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_print_types()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      COALESCE(printing_technology, 'Unknown') AS type,
      COUNT(*)::int AS count
    FROM quotation_products
    GROUP BY printing_technology
    ORDER BY count DESC
    LIMIT 8
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 6. get_recent_jobs
-- ============================================================
CREATE OR REPLACE FUNCTION get_recent_jobs()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      po.production_order_id AS id,
      c.company_name AS client,
      COALESCE(qp.product_type, 'Custom Print') AS type,
      'Medium' AS priority,
      po.expected_completion_date::text AS due,
      COALESCE(q.total_payment, 0)::numeric AS value,
      po.status
    FROM production_orders po
    LEFT JOIN quotations q ON q.quotation_id = po.quotation_id
    LEFT JOIN customers c ON c.customer_id = q.customer_id
    LEFT JOIN quotation_products qp ON qp.quotation_id = po.quotation_id
    ORDER BY po.created_at DESC
    LIMIT 10
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 7. get_inventory_alerts
-- ============================================================
CREATE OR REPLACE FUNCTION get_inventory_alerts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      material_name AS item,
      current_stock::numeric AS current,
      minimum_stock_level::numeric AS min,
      COALESCE(reorder_quantity, minimum_stock_level)::numeric AS reorder,
      unit_of_measure AS unit,
      material_category AS category,
      warehouse_location AS location
    FROM material_inventory
    WHERE current_stock < minimum_stock_level
    ORDER BY (current_stock / NULLIF(minimum_stock_level, 0)) ASC
    LIMIT 10
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 8. get_user_role_overview
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role_overview()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_agg(row_data)
  INTO result
  FROM (
    SELECT
      role,
      COUNT(*)::int AS users,
      COUNT(*) FILTER (WHERE is_active = true)::int AS active_users,
      COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '7 days')::int AS recent_logins
    FROM employees
    GROUP BY role
    ORDER BY users DESC
  ) row_data;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- ============================================================
-- 9. get_admin_action_center
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_action_center()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
  v_delayed_jobs bigint;
  v_pending_approvals bigint;
  v_pending_quotations bigint;
  v_overdue_invoices bigint;
  v_low_stock bigint;
  v_open_delays bigint;
  v_pending_qc bigint;
  v_pending_dispatch bigint;
  v_unverified_payments bigint;
  v_sample_approvals bigint;
BEGIN
  -- Delayed production jobs
  SELECT COUNT(*) INTO v_delayed_jobs
  FROM production_orders
  WHERE expected_completion_date < CURRENT_DATE
    AND status NOT IN ('Completed', 'Cancelled', 'Dispatched');

  -- Pending workflow approvals
  SELECT COUNT(*) INTO v_pending_approvals
  FROM workflow_approvals
  WHERE status = 'Pending';

  -- Pending quotations (Draft or Sent)
  SELECT COUNT(*) INTO v_pending_quotations
  FROM quotations
  WHERE status IN ('Draft', 'Sent');

  -- Overdue invoices
  SELECT COUNT(*) INTO v_overdue_invoices
  FROM invoices
  WHERE due_date < CURRENT_DATE
    AND payment_status IN ('Pending', 'Partial');

  -- Low stock materials
  SELECT COUNT(*) INTO v_low_stock
  FROM material_inventory
  WHERE current_stock < minimum_stock_level;

  -- Open delay logs
  SELECT COUNT(*) INTO v_open_delays
  FROM delay_logs
  WHERE status = 'Open';

  -- Pending QC checks
  SELECT COUNT(*) INTO v_pending_qc
  FROM quality_checks
  WHERE overall_status IN ('Pending', 'Failed');

  -- Pending dispatches
  SELECT COUNT(*) INTO v_pending_dispatch
  FROM dispatches
  WHERE status = 'Pending';

  -- Production orders where advance not verified
  SELECT COUNT(*) INTO v_unverified_payments
  FROM production_orders
  WHERE advance_payment_verified = false
    AND production_approved = true
    AND status != 'Cancelled';

  -- Sample orders awaiting approval
  SELECT COUNT(*) INTO v_sample_approvals
  FROM sample_orders
  WHERE status = 'Awaiting Approval';

  SELECT json_build_object(
    'delayed_jobs',         v_delayed_jobs,
    'pending_approvals',    v_pending_approvals,
    'pending_quotations',   v_pending_quotations,
    'overdue_invoices',     v_overdue_invoices,
    'low_stock',            v_low_stock,
    'open_delays',          v_open_delays,
    'pending_qc',           v_pending_qc,
    'pending_dispatch',     v_pending_dispatch,
    'unverified_payments',  v_unverified_payments,
    'sample_approvals',     v_sample_approvals
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 10. get_admin_financial_summary
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_financial_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_invoiced',     COALESCE((SELECT SUM(total_amount) FROM invoices WHERE status != 'Cancelled'), 0),
    'total_collected',    COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type != 'Refund'), 0),
    'total_refunded',     COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type = 'Refund'), 0),
    'total_pending',      COALESCE((SELECT SUM(total_amount) FROM invoices WHERE payment_status IN ('Pending', 'Partial')), 0),
    'total_overdue',      COALESCE((SELECT SUM(total_amount) FROM invoices WHERE due_date < CURRENT_DATE AND payment_status IN ('Pending', 'Partial')), 0),
    'total_expenses',     COALESCE((SELECT SUM(total_amount) FROM sundry_expenses WHERE status = 'Approved'), 0),
    'advance_collected',  COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type = 'Advance'), 0),
    'balance_collected',  COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type = 'Balance'), 0)
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- 11. get_admin_monthly_comparison
-- Returns current vs previous month comparison
-- ============================================================
CREATE OR REPLACE FUNCTION get_admin_monthly_comparison()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'current_month', json_build_object(
      'revenue',          COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type != 'Refund' AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE)), 0),
      'new_customers',    COALESCE((SELECT COUNT(*) FROM customers WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)), 0),
      'new_quotations',   COALESCE((SELECT COUNT(*) FROM quotations WHERE DATE_TRUNC('month', quotation_date::timestamp) = DATE_TRUNC('month', CURRENT_DATE)), 0),
      'completed_jobs',   COALESCE((SELECT COUNT(*) FROM production_orders WHERE status = 'Completed' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE)), 0),
      'new_invoices',     COALESCE((SELECT COUNT(*) FROM invoices WHERE DATE_TRUNC('month', invoice_date::timestamp) = DATE_TRUNC('month', CURRENT_DATE)), 0)
    ),
    'previous_month', json_build_object(
      'revenue',          COALESCE((SELECT SUM(amount) FROM payments WHERE payment_type != 'Refund' AND DATE_TRUNC('month', payment_date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0),
      'new_customers',    COALESCE((SELECT COUNT(*) FROM customers WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0),
      'new_quotations',   COALESCE((SELECT COUNT(*) FROM quotations WHERE DATE_TRUNC('month', quotation_date::timestamp) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0),
      'completed_jobs',   COALESCE((SELECT COUNT(*) FROM production_orders WHERE status = 'Completed' AND DATE_TRUNC('month', updated_at) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0),
      'new_invoices',     COALESCE((SELECT COUNT(*) FROM invoices WHERE DATE_TRUNC('month', invoice_date::timestamp) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')), 0)
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================
GRANT EXECUTE ON FUNCTION get_admin_kpis() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_pipeline() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_revenue_trend() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_job_status() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_print_types() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_recent_jobs() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_inventory_alerts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_overview() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_action_center() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_financial_summary() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_admin_monthly_comparison() TO anon, authenticated;