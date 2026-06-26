-- ==============================================================================
-- DISPATCH DASHBOARD SETUP (SIMPLIFIED)
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. DROP UNUSED TABLES & DATA (Cleanup previous vehicle logic)
DROP TABLE IF EXISTS vehicles;

-- 2. DUMMY DATA INJECTION (So you can test the UI right away)
-- Only injects if the table is empty to prevent duplicating data
DO $$ 
DECLARE
    dummy_customer_id VARCHAR(20) := 'C-DUMMY1';
    dummy_quotation_id VARCHAR(20) := 'Q-DUMMY1';
    dummy_sample_id VARCHAR(20) := 'S-DUMMY1';
    dummy_po_id_1 VARCHAR(20) := 'PO-DUMMY1';
    dummy_po_id_2 VARCHAR(20) := 'PO-DUMMY2';
    emp_id INT;
BEGIN
    -- Get a valid employee ID (assuming at least one exists from default schema)
    SELECT employee_id INTO emp_id FROM employees LIMIT 1;
    
    IF emp_id IS NULL THEN
        -- If no employee exists, create a dummy one
        INSERT INTO employees (first_name, last_name, email, role, department) 
        VALUES ('Admin', 'User', 'admin@printflow.com', 'Admin', 'Management') RETURNING employee_id INTO emp_id;
    END IF;

    -- Insert dummy customer if missing
    IF NOT EXISTS (SELECT 1 FROM customers WHERE customer_id = dummy_customer_id) THEN
        INSERT INTO customers (customer_id, company_name, contact_person, phone_number, email, address)
        VALUES (dummy_customer_id, 'TechPack Industries', 'Raman Gupta', '+91 98765 43210', 'raman@techpack.in', 'Plot 45, MIDC Bhosari, Pune - 411026');
    END IF;

    -- Insert dummy quotation if missing
    IF NOT EXISTS (SELECT 1 FROM quotations WHERE quotation_id = dummy_quotation_id) THEN
        INSERT INTO quotations (quotation_id, customer_id, created_by, total_payment, status, quotation_date)
        VALUES (dummy_quotation_id, dummy_customer_id, emp_id, 50000, 'Approved', CURRENT_DATE);
        
        INSERT INTO quotation_products (quotation_id, product_name, product_type, production_quantity, material_type, width_cm, height_cm, printing_technology, color_sides, color_type)
        VALUES (dummy_quotation_id, 'Corrugated Box', 'Packaging', 2000, 'Paperboard', 10, 10, 'Offset', 'Single', 'CMYK');
    END IF;

    -- Insert dummy sample order
    IF NOT EXISTS (SELECT 1 FROM sample_orders WHERE sample_order_id = dummy_sample_id) THEN
        INSERT INTO sample_orders (sample_order_id, quotation_id, status, approved)
        VALUES (dummy_sample_id, dummy_quotation_id, 'Approved', true);
    END IF;

    -- Insert dummy production orders (One Ready for Dispatch, One Delivered)
    IF NOT EXISTS (SELECT 1 FROM production_orders WHERE production_order_id = dummy_po_id_1) THEN
        -- PO 1: Delivered
        INSERT INTO production_orders (production_order_id, quotation_id, sample_order_id, original_quantity, final_quantity, status)
        VALUES (dummy_po_id_1, dummy_quotation_id, dummy_sample_id, 2000, 2000, 'Completed');
        
        INSERT INTO dispatches (production_order_id, dispatch_by, total_quantity, quantity_dispatched, status)
        VALUES (dummy_po_id_1, emp_id, 2000, 2000, 'Delivered');

        -- PO 2: Ready for Dispatch
        INSERT INTO production_orders (production_order_id, quotation_id, sample_order_id, original_quantity, final_quantity, status)
        VALUES (dummy_po_id_2, dummy_quotation_id, dummy_sample_id, 5000, 5000, 'Completed');
    END IF;
END $$;


-- 3. RPC: GET DISPATCH DASHBOARD (SIMPLIFIED)
CREATE OR REPLACE FUNCTION get_dispatch_dashboard()
RETURNS json AS $$
DECLARE
    ready_for_dispatch_data json;
    delivered_data json;
    kpis_data json;
    result json;
BEGIN
    -- 3a. Get "Ready for Dispatch" (Orders completed but not in dispatches table)
    SELECT COALESCE(json_agg(row_to_json(r)), '[]'::json) INTO ready_for_dispatch_data
    FROM (
        SELECT 
            po.production_order_id as id,
            c.company_name as client,
            c.address,
            qp.product_name || ' (' || po.final_quantity || ' pcs)' as items,
            c.contact_person as contact,
            c.phone_number as phone,
            'Pending' as scheduledTime
        FROM production_orders po
        JOIN quotations q ON po.quotation_id = q.quotation_id
        JOIN customers c ON q.customer_id = c.customer_id
        LEFT JOIN quotation_products qp ON q.quotation_id = qp.quotation_id
        LEFT JOIN dispatches d ON po.production_order_id = d.production_order_id
        WHERE po.status IN ('Completed', 'Dispatched') AND d.dispatch_id IS NULL
        GROUP BY po.production_order_id, c.company_name, c.address, qp.product_name, po.final_quantity, c.contact_person, c.phone_number
    ) r;

    -- 3b. Get "Delivered" (Completed dispatches)
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) INTO delivered_data
    FROM (
        SELECT 
            d.production_order_id as id,
            c.company_name as client,
            TO_CHAR(d.dispatch_date, 'HH12:MI AM') as departed,
            TO_CHAR(d.dispatch_date, 'Mon DD, YYYY') as dispatchDate,
            d.status,
            'Delivered' as location,
            100 as progress
        FROM dispatches d
        JOIN production_orders po ON d.production_order_id = po.production_order_id
        JOIN quotations q ON po.quotation_id = q.quotation_id
        JOIN customers c ON q.customer_id = c.customer_id
        WHERE d.status = 'Delivered' OR d.status = 'In Transit' -- Include previous test data as delivered
    ) t;

    -- 3c. Get KPIs
    SELECT json_build_object(
        'readyCount', (SELECT json_array_length(ready_for_dispatch_data)),
        'deliveredCount', (SELECT json_array_length(delivered_data))
    ) INTO kpis_data;

    -- Build final JSON
    SELECT json_build_object(
        'readyForDispatch', ready_for_dispatch_data,
        'delivered', delivered_data,
        'kpis', kpis_data
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
