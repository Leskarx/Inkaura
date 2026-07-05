-- supabase-finance-views.sql

-- Helper: We need to filter based on:
-- Date Range (p_date_range), Customer (p_customer_id), Invoice Status (p_invoice_status), 
-- Payment Status (p_payment_status), Expense Category (p_expense_category), Payment Method (p_payment_method)

CREATE OR REPLACE FUNCTION get_finance_top_kpis(
  p_date_range text,
  p_customer_id text,
  p_invoice_status text,
  p_payment_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
  v_total_revenue numeric := 0;
  v_net_profit numeric := 0;
  v_outstanding_receivables numeric := 0;
  v_overdue_invoices numeric := 0;
  v_advance_payments numeric := 0;
  v_total_sundry numeric := 0;
  v_avg_invoice numeric := 0;
  v_collection_rate numeric := 0;
  v_jobs_closed int := 0;
  v_sundry_recovered numeric := 0;
  v_sundry_total_closed numeric := 0;
BEGIN
  -- Date filtering logic
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2000-01-01'::date;
  END IF;

  -- Total Revenue & Net Profit (From Job Financial Closure)
  SELECT 
    COALESCE(SUM(total_amount_received), 0),
    COALESCE(SUM(net_profit_loss), 0),
    COUNT(*)
  INTO v_total_revenue, v_net_profit, v_jobs_closed
  FROM job_financial_closure
  WHERE closure_date >= v_start_date
    AND (p_customer_id IS NULL OR invoice_id IN (SELECT invoice_id FROM invoices WHERE customer_id = p_customer_id));

  -- Outstanding & Overdue Invoices
  SELECT 
    COALESCE(SUM(total_amount - (total_amount * COALESCE(discount_amount, 0) / 100)), 0), -- Simplified outstanding
    COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND payment_status != 'Paid' THEN total_amount ELSE 0 END), 0)
  INTO v_outstanding_receivables, v_overdue_invoices
  FROM invoices
  WHERE invoice_date >= v_start_date
    AND status != 'Draft'
    AND payment_status != 'Paid'
    AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_invoice_status IS NULL OR status = p_invoice_status)
    AND (p_payment_status IS NULL OR payment_status = p_payment_status);

  -- Avg Invoice Value (Only Issued/Approved)
  SELECT COALESCE(AVG(total_amount), 0)
  INTO v_avg_invoice
  FROM invoices
  WHERE invoice_date >= v_start_date
    AND status != 'Draft'
    AND (p_customer_id IS NULL OR customer_id = p_customer_id)
    AND (p_invoice_status IS NULL OR status = p_invoice_status);

  -- Advance Payments
  SELECT COALESCE(SUM(amount), 0)
  INTO v_advance_payments
  FROM payments
  WHERE payment_date >= v_start_date
    AND payment_type = 'Advance'
    AND (p_customer_id IS NULL OR quotation_id IN (SELECT quotation_id FROM quotations WHERE customer_id = p_customer_id));

  -- Total Sundry Expenses & Recovery Calculation
  SELECT COALESCE(SUM(total_amount), 0)
  INTO v_total_sundry
  FROM sundry_expenses
  WHERE expense_date >= v_start_date
    AND (p_customer_id IS NULL OR customer_id = p_customer_id);

  SELECT 
    COALESCE(SUM(sundry_expenses_recovered), 0),
    COALESCE(SUM(total_sundry_expenses), 0)
  INTO v_sundry_recovered, v_sundry_total_closed
  FROM job_financial_closure
  WHERE closure_date >= v_start_date;

  -- Build final JSON
  v_result := json_build_object(
    'total_revenue', v_total_revenue,
    'net_profit', v_net_profit,
    'profit_margin', CASE WHEN v_total_revenue > 0 THEN (v_net_profit / v_total_revenue) * 100 ELSE 0 END,
    'outstanding_receivables', v_outstanding_receivables,
    'overdue_invoices', v_overdue_invoices,
    'advance_payments', v_advance_payments,
    'total_sundry', v_total_sundry,
    'expense_recovery_pct', CASE WHEN v_sundry_total_closed > 0 THEN (v_sundry_recovered / v_sundry_total_closed) * 100 ELSE 0 END,
    'avg_invoice_value', v_avg_invoice,
    'jobs_closed', v_jobs_closed
  );

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION get_finance_trend_charts(
  p_date_range text,
  p_customer_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
BEGIN
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2023-01-01'::date; -- some default past date
  END IF;

  WITH monthly_data AS (
    SELECT 
      to_char(closure_date, 'YYYY-MM') as month,
      SUM(total_income) as revenue,
      SUM(total_cost) as cost,
      SUM(net_profit_loss) as profit
    FROM job_financial_closure
    WHERE closure_date >= v_start_date
      AND (p_customer_id IS NULL OR quotation_id IN (SELECT quotation_id FROM quotations WHERE customer_id = p_customer_id))
    GROUP BY to_char(closure_date, 'YYYY-MM')
    ORDER BY month
  )
  SELECT json_agg(row_to_json(monthly_data)) INTO v_result FROM monthly_data;

  RETURN COALESCE(v_result, '[]'::json);
END;
$$;


CREATE OR REPLACE FUNCTION get_finance_expense_analytics(
  p_date_range text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
BEGIN
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2000-01-01'::date;
  END IF;

  WITH category_breakdown AS (
    SELECT expense_category as name, SUM(total_amount) as value
    FROM sundry_expenses
    WHERE expense_date >= v_start_date
    GROUP BY expense_category
  ),
  recoverable_breakdown AS (
    SELECT CASE WHEN is_recoverable THEN 'Recoverable' ELSE 'Non-Recoverable' END as name, SUM(total_amount) as value
    FROM sundry_expenses
    WHERE expense_date >= v_start_date
    GROUP BY is_recoverable
  ),
  approval_breakdown AS (
    SELECT CASE WHEN is_approved THEN 'Approved' ELSE 'Pending' END as name, SUM(total_amount) as value
    FROM sundry_expenses
    WHERE expense_date >= v_start_date
    GROUP BY is_approved
  )
  
  SELECT json_build_object(
    'categories', (SELECT json_agg(row_to_json(category_breakdown)) FROM category_breakdown),
    'recoverable', (SELECT json_agg(row_to_json(recoverable_breakdown)) FROM recoverable_breakdown),
    'approval', (SELECT json_agg(row_to_json(approval_breakdown)) FROM approval_breakdown)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION get_finance_invoice_analytics(
  p_date_range text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
BEGIN
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2000-01-01'::date;
  END IF;

  WITH status_dist AS (
    SELECT status as name, COUNT(*) as value, SUM(total_amount) as amount
    FROM invoices
    WHERE invoice_date >= v_start_date
    GROUP BY status
  ),
  aging_buckets AS (
    SELECT 
      CASE 
        WHEN due_date >= CURRENT_DATE THEN 'Current'
        WHEN CURRENT_DATE - due_date BETWEEN 1 AND 30 THEN '1-30 Days'
        WHEN CURRENT_DATE - due_date BETWEEN 31 AND 60 THEN '31-60 Days'
        WHEN CURRENT_DATE - due_date BETWEEN 61 AND 90 THEN '61-90 Days'
        ELSE '90+ Days'
      END as name,
      SUM(total_amount) as value
    FROM invoices
    WHERE invoice_date >= v_start_date AND payment_status != 'Paid' AND status != 'Draft'
    GROUP BY 1
  ),
  collection_trend AS (
    SELECT to_char(payment_date, 'YYYY-MM') as month, SUM(amount) as value
    FROM payments
    WHERE payment_date >= v_start_date
    GROUP BY 1 ORDER BY 1
  )
  
  SELECT json_build_object(
    'status_distribution', COALESCE((SELECT json_agg(row_to_json(status_dist)) FROM status_dist), '[]'::json),
    'aging_buckets', COALESCE((SELECT json_agg(row_to_json(aging_buckets)) FROM aging_buckets), '[]'::json),
    'collection_trend', COALESCE((SELECT json_agg(row_to_json(collection_trend)) FROM collection_trend), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION get_finance_payment_analytics(
  p_date_range text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
BEGIN
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2000-01-01'::date;
  END IF;

  WITH method_dist AS (
    SELECT COALESCE(payment_method, 'Unknown') as name, SUM(amount) as value
    FROM payments
    WHERE payment_date >= v_start_date
    GROUP BY payment_method
  ),
  type_dist AS (
    SELECT payment_type as name, SUM(amount) as value
    FROM payments
    WHERE payment_date >= v_start_date
    GROUP BY payment_type
  )
  
  SELECT json_build_object(
    'methods', COALESCE((SELECT json_agg(row_to_json(method_dist)) FROM method_dist), '[]'::json),
    'types', COALESCE((SELECT json_agg(row_to_json(type_dist)) FROM type_dist), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION get_finance_profitability_analytics(
  p_date_range text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
BEGIN
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2000-01-01'::date;
  END IF;

  WITH top_profitable AS (
    SELECT production_order_id, net_profit_loss as profit, profit_margin_percent as margin
    FROM job_financial_closure
    WHERE closure_date >= v_start_date
    ORDER BY net_profit_loss DESC NULLS LAST
    LIMIT 5
  ),
  least_profitable AS (
    SELECT production_order_id, net_profit_loss as profit, profit_margin_percent as margin
    FROM job_financial_closure
    WHERE closure_date >= v_start_date
    ORDER BY net_profit_loss ASC NULLS LAST
    LIMIT 5
  )
  
  SELECT json_build_object(
    'top_jobs', COALESCE((SELECT json_agg(row_to_json(top_profitable)) FROM top_profitable), '[]'::json),
    'least_jobs', COALESCE((SELECT json_agg(row_to_json(least_profitable)) FROM least_profitable), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;


CREATE OR REPLACE FUNCTION get_finance_cost_analytics(
  p_date_range text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
  v_start_date date;
BEGIN
  IF p_date_range = 'month' THEN v_start_date := date_trunc('month', CURRENT_DATE);
  ELSIF p_date_range = 'quarter' THEN v_start_date := date_trunc('quarter', CURRENT_DATE);
  ELSIF p_date_range = 'ytd' THEN v_start_date := date_trunc('year', CURRENT_DATE);
  ELSE v_start_date := '2000-01-01'::date;
  END IF;

  WITH cost_breakdown AS (
    SELECT 
      SUM(total_material_cost) as material,
      SUM(total_machine_cost) as machine,
      SUM(total_labor_cost) as labour,
      SUM(total_setup_cost) as setup,
      SUM(total_sundry_expenses) as sundry
    FROM job_financial_closure
    WHERE closure_date >= v_start_date
  )
  SELECT json_build_object(
    'breakdown', (SELECT row_to_json(cost_breakdown) FROM cost_breakdown)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
