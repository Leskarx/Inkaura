-- ============================================================
-- QUALITY CONTROL OPTIMIZED RPCS
-- ============================================================

-- Function to efficiently fetch jobs pending QC without N+1 queries
CREATE OR REPLACE FUNCTION get_jobs_for_qc()
RETURNS TABLE (
    order_id VARCHAR(20),
    job_type VARCHAR(20),
    status VARCHAR(30),
    final_quantity INT,
    quotation_id VARCHAR(20),
    customer_name VARCHAR(255),
    product_name VARCHAR(255),
    product_type VARCHAR(100),
    printing_technology VARCHAR(30),
    has_active_qc BOOLEAN,
    active_qc_status VARCHAR(20),
    active_qc_id INT
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_qc AS (
        SELECT
            qc_id,
            COALESCE(production_order_id, sample_order_id) as target_order_id,
            overall_status,
            approved_for_dispatch,
            ROW_NUMBER() OVER (PARTITION BY COALESCE(production_order_id, sample_order_id) ORDER BY created_at DESC) as rn
        FROM quality_checks
    ),
    active_qcs AS (
        SELECT * FROM latest_qc WHERE rn = 1
    )
    SELECT
        po.production_order_id AS order_id,
        'Production'::VARCHAR(20) AS job_type,
        po.status,
        po.final_quantity,
        po.quotation_id,
        c.company_name AS customer_name,
        qp.product_name,
        qp.product_type,
        qp.printing_technology,
        (aqc.qc_id IS NOT NULL AND (aqc.approved_for_dispatch = true OR aqc.overall_status = 'Passed')) AS has_active_qc,
        CASE
            WHEN aqc.approved_for_dispatch = true THEN 'Approved'::VARCHAR(20)
            WHEN aqc.overall_status = 'Passed' THEN 'Awaiting Approval'::VARCHAR(20)
            WHEN aqc.overall_status = 'Failed' THEN 'Failed'::VARCHAR(20)
            ELSE NULL
        END AS active_qc_status,
        aqc.qc_id AS active_qc_id
    FROM production_orders po
    JOIN quotations q ON po.quotation_id = q.quotation_id
    JOIN customers c ON q.customer_id = c.customer_id
    LEFT JOIN LATERAL (
        SELECT qp_sub.product_name, qp_sub.product_type, qp_sub.printing_technology
        FROM quotation_products qp_sub
        WHERE qp_sub.quotation_id = po.quotation_id
        LIMIT 1
    ) qp ON true
    LEFT JOIN active_qcs aqc ON po.production_order_id = aqc.target_order_id
    WHERE po.status IN ('QC Pending', 'Completed')

    UNION ALL

    SELECT
        so.sample_order_id AS order_id,
        'Sample'::VARCHAR(20) AS job_type,
        so.status,
        so.sample_quantity AS final_quantity,
        so.quotation_id,
        c.company_name AS customer_name,
        qp.product_name,
        qp.product_type,
        qp.printing_technology,
        (aqc.qc_id IS NOT NULL AND (aqc.approved_for_dispatch = true OR aqc.overall_status = 'Passed')) AS has_active_qc,
        CASE
            WHEN aqc.approved_for_dispatch = true THEN 'Approved'::VARCHAR(20)
            WHEN aqc.overall_status = 'Passed' THEN 'Awaiting Approval'::VARCHAR(20)
            WHEN aqc.overall_status = 'Failed' THEN 'Failed'::VARCHAR(20)
            ELSE NULL
        END AS active_qc_status,
        aqc.qc_id AS active_qc_id
    FROM sample_orders so
    JOIN quotations q ON so.quotation_id = q.quotation_id
    JOIN customers c ON q.customer_id = c.customer_id
    LEFT JOIN LATERAL (
        SELECT qp_sub.product_name, qp_sub.product_type, qp_sub.printing_technology
        FROM quotation_products qp_sub
        WHERE qp_sub.quotation_id = so.quotation_id
        LIMIT 1
    ) qp ON true
    LEFT JOIN active_qcs aqc ON so.sample_order_id = aqc.target_order_id
    WHERE so.status IN ('QC Pending', 'Awaiting Approval', 'Approved', 'Production Created')
    ORDER BY order_id DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function to efficiently fetch enriched quality checks without N+1 queries
CREATE OR REPLACE FUNCTION get_quality_checks_enriched()
RETURNS TABLE (
    qc_id INT,
    production_order_id VARCHAR(20),
    sample_order_id VARCHAR(20),
    check_type VARCHAR(30),
    check_date TIMESTAMPTZ,
    checked_by INT,
    checked_by_name VARCHAR,
    color_accuracy VARCHAR(20),
    print_quality VARCHAR(20),
    binding_quality VARCHAR(20),
    material_quality VARCHAR(20),
    dimensional_accuracy VARCHAR(20),
    finishing_quality VARCHAR(20),
    overall_status VARCHAR(20),
    defect_type VARCHAR(50),
    defect_quantity INT,
    defect_description TEXT,
    rework_required BOOLEAN,
    rework_description TEXT,
    rework_completed_date TIMESTAMPTZ,
    approved_for_dispatch BOOLEAN,
    approved_by_name VARCHAR,
    approved_date TIMESTAMPTZ,
    notes TEXT,
    post_dev_checklist JSONB,
    checklist_verified_by INT,
    checklist_verified_by_name VARCHAR,
    checklist_verified_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    customer_name VARCHAR,
    product_name VARCHAR,
    product_type VARCHAR,
    printing_technology VARCHAR,
    quantity INT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        qc.qc_id,
        qc.production_order_id,
        qc.sample_order_id,
        qc.check_type,
        qc.check_date,
        qc.checked_by,
        checker.full_name AS checked_by_name,
        qc.color_accuracy,
        qc.print_quality,
        qc.binding_quality,
        qc.material_quality,
        qc.dimensional_accuracy,
        qc.finishing_quality,
        qc.overall_status,
        qc.defect_type,
        qc.defect_quantity,
        qc.defect_description,
        qc.rework_required,
        qc.rework_description,
        qc.rework_completed_date,
        qc.approved_for_dispatch,
        approver.full_name AS approved_by_name,
        qc.approved_date,
        qc.notes,
        qc.post_dev_checklist,
        (CASE WHEN qc.checklist_verified_date IS NOT NULL THEN qc.approved_by ELSE NULL END) AS checklist_verified_by,
        (CASE WHEN qc.checklist_verified_date IS NOT NULL THEN approver.full_name ELSE NULL END)::VARCHAR AS checklist_verified_by_name,
        qc.checklist_verified_date,
        qc.created_at,
        c.company_name::VARCHAR AS customer_name,
        qp.product_name::VARCHAR,
        qp.product_type::VARCHAR,
        qp.printing_technology::VARCHAR,
        COALESCE(po.final_quantity, so.sample_quantity, 0) AS quantity
    FROM quality_checks qc
    LEFT JOIN employees checker ON qc.checked_by = checker.employee_id
    LEFT JOIN employees approver ON qc.approved_by = approver.employee_id
    LEFT JOIN production_orders po ON qc.production_order_id = po.production_order_id
    LEFT JOIN sample_orders so ON qc.sample_order_id = so.sample_order_id
    LEFT JOIN quotations q ON q.quotation_id = COALESCE(po.quotation_id, so.quotation_id)
    LEFT JOIN customers c ON q.customer_id = c.customer_id
    LEFT JOIN LATERAL (
        SELECT qp_sub.product_name, qp_sub.product_type, qp_sub.printing_technology
        FROM quotation_products qp_sub
        WHERE qp_sub.quotation_id = q.quotation_id
        LIMIT 1
    ) qp ON true
    ORDER BY qc.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
