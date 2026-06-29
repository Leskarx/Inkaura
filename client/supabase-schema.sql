-- ============================================================
-- STEP 1: CREATE EMPLOYEES TABLE FIRST
-- ============================================================
DROP TABLE IF EXISTS employees CASCADE;

CREATE TABLE employees (
    employee_id SERIAL PRIMARY KEY,
    auth_user_id UUID UNIQUE REFERENCES users(id),
    employee_code VARCHAR(20) UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role VARCHAR(30) NOT NULL,
    department VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    hire_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "employees_select" ON employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_insert" ON employees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "employees_update" ON employees FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "employees_delete" ON employees FOR DELETE TO authenticated USING (true);

-- ============================================================
-- STEP 2: INSERT ADMIN USER INTO EMPLOYEES
-- ============================================================
INSERT INTO employees (auth_user_id, employee_code, full_name, email, role, phone)
SELECT 
    u.id, 
    'EMP001', 
    u.name, 
    u.email, 
    u.role, 
    u.phone
FROM users u
WHERE u.email = 'admin@printflow.com'
ON CONFLICT (email) DO NOTHING;

-- ============================================================
-- STEP 3: CREATE ALL OTHER TABLES
-- ============================================================

-- 1. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
    customer_id VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    email VARCHAR(100) NOT NULL,
    gst_number VARCHAR(20) UNIQUE,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated USING (true);

-- 2. QUOTATIONS
CREATE TABLE IF NOT EXISTS quotations (
    quotation_id VARCHAR(20) PRIMARY KEY,
    customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
    quotation_date DATE NOT NULL,
    delivery_date DATE,
    total_payment DECIMAL(15,2),
    advance_required DECIMAL(15,2),
    advance_percentage DECIMAL(5,2) DEFAULT 30.00,
    payment_status VARCHAR(20) DEFAULT 'Pending',
    status VARCHAR(20) DEFAULT 'Draft',
    created_by INT REFERENCES employees(employee_id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotations_customer ON quotations(customer_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_payment_status ON quotations(payment_status);
CREATE INDEX idx_quotations_date ON quotations(quotation_date);

ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotations_select" ON quotations FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotations_insert" ON quotations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quotations_update" ON quotations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quotations_delete" ON quotations FOR DELETE TO authenticated USING (true);

-- 3. QUOTATION PRODUCTS
CREATE TABLE IF NOT EXISTS quotation_products (
    line_item_id SERIAL PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    product_name VARCHAR(255) NOT NULL,
    product_type VARCHAR(100) NOT NULL,
    production_quantity INT NOT NULL,
    sample_quantity INT DEFAULT 5,
    material_type VARCHAR(50) NOT NULL,
    paper_type VARCHAR(100),
    paper_gsm INT,
    material_thickness VARCHAR(20),
    width_cm DECIMAL(10,2) NOT NULL,
    height_cm DECIMAL(10,2) NOT NULL,
    depth_cm DECIMAL(10,2),
    printing_technology VARCHAR(30) NOT NULL,
    color_sides VARCHAR(10) NOT NULL,
    color_type VARCHAR(20) NOT NULL,
    spot_color_count INT DEFAULT 0,
    lamination VARCHAR(30),
    binding_type VARCHAR(30),
    folding_type VARCHAR(30),
    is_die_cut BOOLEAN DEFAULT false,
    coating VARCHAR(30),
    packaging_type VARCHAR(100),
    no_of_cartons INT,
    artwork_provided BOOLEAN DEFAULT false,
    design_required BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_quotation ON quotation_products(quotation_id);

ALTER TABLE quotation_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quotation_products_select" ON quotation_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "quotation_products_insert" ON quotation_products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quotation_products_update" ON quotation_products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quotation_products_delete" ON quotation_products FOR DELETE TO authenticated USING (true);

-- 4. SAMPLE ORDERS
CREATE TABLE IF NOT EXISTS sample_orders (
    sample_order_id VARCHAR(20) PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    sample_cost DECIMAL(15,2) DEFAULT 0,
    sample_sent_date DATE,
    status VARCHAR(20) DEFAULT 'Pending',
    customer_feedback TEXT,
    approved BOOLEAN DEFAULT false,
    approved_date DATE,
    rejected_date DATE,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sample_quotation ON sample_orders(quotation_id);
CREATE INDEX idx_sample_status ON sample_orders(status);

ALTER TABLE sample_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sample_orders_select" ON sample_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "sample_orders_insert" ON sample_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sample_orders_update" ON sample_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sample_orders_delete" ON sample_orders FOR DELETE TO authenticated USING (true);

-- 5. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
    payment_id SERIAL PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    sample_order_id VARCHAR(20) REFERENCES sample_orders(sample_order_id),
    production_order_id VARCHAR(20),
    invoice_id VARCHAR(20),
    payment_type VARCHAR(30) NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50),
    reference_number VARCHAR(100),
    received_by INT REFERENCES employees(employee_id),
    notes TEXT,
    refund_reason TEXT,
    refund_approved_by INT REFERENCES employees(employee_id),
    refund_processed_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_quotation ON payments(quotation_id);
CREATE INDEX idx_payments_sample ON payments(sample_order_id);
CREATE INDEX idx_payments_production ON payments(production_order_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_type ON payments(payment_type);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments_insert" ON payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payments_update" ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "payments_delete" ON payments FOR DELETE TO authenticated USING (true);

-- 6. PAYMENT ALLOCATIONS
CREATE TABLE IF NOT EXISTS payment_allocations (
    allocation_id SERIAL PRIMARY KEY,
    payment_id INT NOT NULL REFERENCES payments(payment_id),
    reference_type VARCHAR(30) NOT NULL,
    reference_id VARCHAR(20) NOT NULL,
    allocated_amount DECIMAL(15,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX idx_alloc_type ON payment_allocations(reference_type);
CREATE INDEX idx_alloc_reference ON payment_allocations(reference_id);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_allocations_select" ON payment_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "payment_allocations_insert" ON payment_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "payment_allocations_update" ON payment_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "payment_allocations_delete" ON payment_allocations FOR DELETE TO authenticated USING (true);

-- 7. PRODUCTION ORDERS
CREATE TABLE IF NOT EXISTS production_orders (
    production_order_id VARCHAR(20) PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    sample_order_id VARCHAR(20) NOT NULL REFERENCES sample_orders(sample_order_id),
    original_quantity INT NOT NULL,
    final_quantity INT NOT NULL,
    quantity_change_reason TEXT,
    production_start_date DATE,
    expected_completion_date DATE,
    actual_completion_date DATE,
    delivery_date DATE,
    status VARCHAR(30) DEFAULT 'Pending',
    production_approved BOOLEAN DEFAULT false,
    approved_by INT REFERENCES employees(employee_id),
    approved_date TIMESTAMPTZ,
    advance_payment_verified BOOLEAN DEFAULT false,
    additional_cost DECIMAL(15,2) DEFAULT 0,
    revised_total_payment DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_production_quotation ON production_orders(quotation_id);
CREATE INDEX idx_production_sample ON production_orders(sample_order_id);
CREATE INDEX idx_production_status ON production_orders(status);

ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_orders_select" ON production_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "production_orders_insert" ON production_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "production_orders_update" ON production_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_orders_delete" ON production_orders FOR DELETE TO authenticated USING (true);

-- 8. COST ESTIMATIONS
CREATE TABLE IF NOT EXISTS cost_estimations (
    estimation_id SERIAL PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    line_item_id INT NOT NULL REFERENCES quotation_products(line_item_id),
    estimation_type VARCHAR(20) NOT NULL,
    sample_order_id VARCHAR(20) REFERENCES sample_orders(sample_order_id),
    production_order_id VARCHAR(20) REFERENCES production_orders(production_order_id),
    paper_cost DECIMAL(15,2) DEFAULT 0,
    ink_cost DECIMAL(15,2) DEFAULT 0,
    plate_cost DECIMAL(15,2) DEFAULT 0,
    machine_cost DECIMAL(15,2) DEFAULT 0,
    setup_cost DECIMAL(15,2) DEFAULT 0,
    lamination_cost DECIMAL(15,2) DEFAULT 0,
    binding_cost DECIMAL(15,2) DEFAULT 0,
    die_cut_cost DECIMAL(15,2) DEFAULT 0,
    labor_cost DECIMAL(15,2) DEFAULT 0,
    packaging_cost DECIMAL(15,2) DEFAULT 0,
    delivery_cost DECIMAL(15,2) DEFAULT 0,
    profit_margin_percent DECIMAL(5,2) DEFAULT 15.00,
    total_cost DECIMAL(15,2),
    final_price DECIMAL(15,2),
    quantity_used INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_quotation ON cost_estimations(quotation_id);
CREATE INDEX idx_cost_lineitem ON cost_estimations(line_item_id);
CREATE INDEX idx_cost_sample ON cost_estimations(sample_order_id);
CREATE INDEX idx_cost_production ON cost_estimations(production_order_id);
CREATE INDEX idx_cost_type ON cost_estimations(estimation_type);

ALTER TABLE cost_estimations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cost_estimations_select" ON cost_estimations FOR SELECT TO authenticated USING (true);
CREATE POLICY "cost_estimations_insert" ON cost_estimations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cost_estimations_update" ON cost_estimations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "cost_estimations_delete" ON cost_estimations FOR DELETE TO authenticated USING (true);

-- 9. SAMPLE APPROVAL HISTORY
CREATE TABLE IF NOT EXISTS sample_approval_history (
    approval_id SERIAL PRIMARY KEY,
    sample_order_id VARCHAR(20) NOT NULL REFERENCES sample_orders(sample_order_id),
    action_type VARCHAR(20) NOT NULL,
    action_date TIMESTAMPTZ DEFAULT NOW(),
    performed_by INT REFERENCES employees(employee_id),
    feedback TEXT,
    rejection_reason TEXT,
    rework_required BOOLEAN DEFAULT false,
    rework_description TEXT,
    production_order_id VARCHAR(20) REFERENCES production_orders(production_order_id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_sample ON sample_approval_history(sample_order_id);
CREATE INDEX idx_sample_approval_production ON sample_approval_history(production_order_id);
CREATE INDEX idx_approval_action ON sample_approval_history(action_type);

ALTER TABLE sample_approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sample_approval_history_select" ON sample_approval_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "sample_approval_history_insert" ON sample_approval_history FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sample_approval_history_update" ON sample_approval_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sample_approval_history_delete" ON sample_approval_history FOR DELETE TO authenticated USING (true);

-- 10. WORKFLOW APPROVALS
CREATE TABLE IF NOT EXISTS workflow_approvals (
    approval_id SERIAL PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    production_order_id VARCHAR(20) REFERENCES production_orders(production_order_id),
    approval_type VARCHAR(30) NOT NULL,
    approved_by INT NOT NULL REFERENCES employees(employee_id),
    approved_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) NOT NULL,
    remarks TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wf_approval_quotation ON workflow_approvals(quotation_id);
CREATE INDEX idx_wf_approval_production ON workflow_approvals(production_order_id);
CREATE INDEX idx_wf_approval_type ON workflow_approvals(approval_type);
CREATE INDEX idx_wf_approval_status ON workflow_approvals(status);

ALTER TABLE workflow_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_approvals_select" ON workflow_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "workflow_approvals_insert" ON workflow_approvals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "workflow_approvals_update" ON workflow_approvals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "workflow_approvals_delete" ON workflow_approvals FOR DELETE TO authenticated USING (true);

-- 11. ACTIVITY LOGS
CREATE TABLE IF NOT EXISTS activity_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES employees(employee_id),
    action_type VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id VARCHAR(20) NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_logs_user ON activity_logs(user_id);
CREATE INDEX idx_logs_table ON activity_logs(table_name);
CREATE INDEX idx_logs_record ON activity_logs(record_id);
CREATE INDEX idx_logs_date ON activity_logs(created_at);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "activity_logs_select" ON activity_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_logs_insert" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "activity_logs_update" ON activity_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "activity_logs_delete" ON activity_logs FOR DELETE TO authenticated USING (true);

-- 12. MACHINES
CREATE TABLE IF NOT EXISTS machines (
    machine_id SERIAL PRIMARY KEY,
    machine_code VARCHAR(20) UNIQUE NOT NULL,
    machine_name VARCHAR(100) NOT NULL,
    machine_type VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    manufacturer VARCHAR(100),
    purchase_date DATE,
    installation_date DATE,
    max_production_per_hour INT,
    current_utilization_percent DECIMAL(5,2) DEFAULT 0,
    is_operational BOOLEAN DEFAULT true,
    last_maintenance_date DATE,
    next_maintenance_date DATE,
    maintenance_notes TEXT,
    status VARCHAR(30) DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_machines_type ON machines(machine_type);
CREATE INDEX idx_machines_status ON machines(status);

ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machines_select" ON machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "machines_insert" ON machines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "machines_update" ON machines FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "machines_delete" ON machines FOR DELETE TO authenticated USING (true);

-- 13. PRODUCTION CAPACITY
CREATE TABLE IF NOT EXISTS production_capacity (
    capacity_id SERIAL PRIMARY KEY,
    machine_id INT NOT NULL REFERENCES machines(machine_id),
    production_order_id VARCHAR(20) NOT NULL REFERENCES production_orders(production_order_id),
    shift VARCHAR(20) NOT NULL,
    scheduled_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    operator_id INT NOT NULL REFERENCES employees(employee_id),
    allocated_hours DECIMAL(5,2) NOT NULL,
    estimated_output INT,
    status VARCHAR(20) DEFAULT 'Scheduled',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_capacity_machine ON production_capacity(machine_id);
CREATE INDEX idx_capacity_production ON production_capacity(production_order_id);
CREATE INDEX idx_capacity_date ON production_capacity(scheduled_date);
CREATE INDEX idx_capacity_status ON production_capacity(status);

ALTER TABLE production_capacity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_capacity_select" ON production_capacity FOR SELECT TO authenticated USING (true);
CREATE POLICY "production_capacity_insert" ON production_capacity FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "production_capacity_update" ON production_capacity FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "production_capacity_delete" ON production_capacity FOR DELETE TO authenticated USING (true);

-- 14. MATERIAL INVENTORY
CREATE TABLE IF NOT EXISTS material_inventory (
    material_id SERIAL PRIMARY KEY,
    material_code VARCHAR(50) UNIQUE NOT NULL,
    material_name VARCHAR(255) NOT NULL,
    material_category VARCHAR(50) NOT NULL,
    specification TEXT,
    unit_of_measure VARCHAR(20) NOT NULL,
    current_stock DECIMAL(15,2) DEFAULT 0,
    minimum_stock_level DECIMAL(15,2) NOT NULL,
    maximum_stock_level DECIMAL(15,2),
    reorder_quantity DECIMAL(15,2),
    unit_cost DECIMAL(15,4),
    last_purchase_date DATE,
    warehouse_location VARCHAR(50),
    rack_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_code ON material_inventory(material_code);
CREATE INDEX idx_inventory_category ON material_inventory(material_category);
CREATE INDEX idx_inventory_status ON material_inventory(status);

ALTER TABLE material_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_inventory_select" ON material_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "material_inventory_insert" ON material_inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "material_inventory_update" ON material_inventory FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "material_inventory_delete" ON material_inventory FOR DELETE TO authenticated USING (true);

-- 15. MATERIAL REQUISITIONS
CREATE TABLE IF NOT EXISTS material_requisitions (
    requisition_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) NOT NULL REFERENCES production_orders(production_order_id),
    requested_by INT NOT NULL REFERENCES employees(employee_id),
    requisition_date TIMESTAMPTZ DEFAULT NOW(),
    required_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'Pending',
    approved_by INT REFERENCES employees(employee_id),
    approved_date TIMESTAMPTZ,
    rejection_reason TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_requisition_production ON material_requisitions(production_order_id);
CREATE INDEX idx_requisition_status ON material_requisitions(status);
CREATE INDEX idx_requisition_date ON material_requisitions(required_date);

ALTER TABLE material_requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_requisitions_select" ON material_requisitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "material_requisitions_insert" ON material_requisitions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "material_requisitions_update" ON material_requisitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "material_requisitions_delete" ON material_requisitions FOR DELETE TO authenticated USING (true);

-- 16. REQUISITION ITEMS
CREATE TABLE IF NOT EXISTS requisition_items (
    requisition_item_id SERIAL PRIMARY KEY,
    requisition_id INT NOT NULL REFERENCES material_requisitions(requisition_id),
    material_id INT NOT NULL REFERENCES material_inventory(material_id),
    quantity_requested DECIMAL(15,2) NOT NULL,
    quantity_approved DECIMAL(15,2),
    quantity_fulfilled DECIMAL(15,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reqitems_requisition ON requisition_items(requisition_id);
CREATE INDEX idx_reqitems_material ON requisition_items(material_id);

ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requisition_items_select" ON requisition_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "requisition_items_insert" ON requisition_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "requisition_items_update" ON requisition_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "requisition_items_delete" ON requisition_items FOR DELETE TO authenticated USING (true);

-- 17. OPERATOR ASSIGNMENTS
CREATE TABLE IF NOT EXISTS operator_assignments (
    assignment_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) NOT NULL REFERENCES production_orders(production_order_id),
    machine_id INT NOT NULL REFERENCES machines(machine_id),
    operator_id INT NOT NULL REFERENCES employees(employee_id),
    shift_date DATE NOT NULL,
    shift VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    actual_start_time TIME,
    actual_end_time TIME,
    break_minutes INT DEFAULT 0,
    output_quantity INT,
    rejected_quantity INT DEFAULT 0,
    efficiency_percent DECIMAL(5,2),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'Assigned',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assignments_production ON operator_assignments(production_order_id);
CREATE INDEX idx_assignments_machine ON operator_assignments(machine_id);
CREATE INDEX idx_assignments_operator ON operator_assignments(operator_id);
CREATE INDEX idx_assignments_date ON operator_assignments(shift_date);

ALTER TABLE operator_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operator_assignments_select" ON operator_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "operator_assignments_insert" ON operator_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "operator_assignments_update" ON operator_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "operator_assignments_delete" ON operator_assignments FOR DELETE TO authenticated USING (true);

-- 18. QUALITY CHECKS
CREATE TABLE IF NOT EXISTS quality_checks (
    qc_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) REFERENCES production_orders(production_order_id),
    sample_order_id VARCHAR(20) REFERENCES sample_orders(sample_order_id),
    check_type VARCHAR(30) NOT NULL,
    check_date TIMESTAMPTZ DEFAULT NOW(),
    checked_by INT NOT NULL REFERENCES employees(employee_id),
    color_accuracy VARCHAR(20),
    print_quality VARCHAR(20),
    binding_quality VARCHAR(20),
    material_quality VARCHAR(20),
    dimensional_accuracy VARCHAR(20),
    finishing_quality VARCHAR(20),
    overall_status VARCHAR(20) NOT NULL,
    defect_type VARCHAR(50),
    defect_quantity INT DEFAULT 0,
    defect_description TEXT,
    rework_required BOOLEAN DEFAULT false,
    rework_description TEXT,
    rework_completed_date TIMESTAMPTZ,
    rework_checked_by INT REFERENCES employees(employee_id),
    approved_for_dispatch BOOLEAN DEFAULT false,
    approved_by INT REFERENCES employees(employee_id),
    approved_date TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qc_production ON quality_checks(production_order_id);
CREATE INDEX idx_qc_sample ON quality_checks(sample_order_id);
CREATE INDEX idx_qc_type ON quality_checks(check_type);
CREATE INDEX idx_qc_status ON quality_checks(overall_status);
CREATE INDEX idx_qc_checkedby ON quality_checks(checked_by);

ALTER TABLE quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quality_checks_select" ON quality_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "quality_checks_insert" ON quality_checks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "quality_checks_update" ON quality_checks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "quality_checks_delete" ON quality_checks FOR DELETE TO authenticated USING (true);

-- 19. DISPATCHES
CREATE TABLE IF NOT EXISTS dispatches (
    dispatch_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) NOT NULL REFERENCES production_orders(production_order_id),
    dispatch_date TIMESTAMPTZ DEFAULT NOW(),
    dispatch_by INT NOT NULL REFERENCES employees(employee_id),
    approved_by INT REFERENCES employees(employee_id),
    total_quantity INT NOT NULL,
    quantity_dispatched INT NOT NULL,
    damaged_quantity INT DEFAULT 0,
    pending_quantity INT DEFAULT 0,
    invoice_number VARCHAR(50),
    document_url TEXT,
    status VARCHAR(20) DEFAULT 'In Transit',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_dispatch_production ON dispatches(production_order_id);
CREATE INDEX idx_dispatch_date ON dispatches(dispatch_date);
CREATE INDEX idx_dispatch_status ON dispatches(status);

ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dispatches_select" ON dispatches FOR SELECT TO authenticated USING (true);
CREATE POLICY "dispatches_insert" ON dispatches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "dispatches_update" ON dispatches FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "dispatches_delete" ON dispatches FOR DELETE TO authenticated USING (true);

-- 20. DELAY LOGS
CREATE TABLE IF NOT EXISTS delay_logs (
    delay_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) NOT NULL REFERENCES production_orders(production_order_id),
    delay_type VARCHAR(50) NOT NULL,
    delay_date TIMESTAMPTZ DEFAULT NOW(),
    reported_by INT NOT NULL REFERENCES employees(employee_id),
    delay_start_time TIMESTAMPTZ NOT NULL,
    delay_end_time TIMESTAMPTZ,
    delay_duration_minutes INT,
    affected_quantity INT,
    estimated_extra_days INT,
    impact_description TEXT,
    resolution_action TEXT,
    resolution_date TIMESTAMPTZ,
    resolved_by INT REFERENCES employees(employee_id),
    customer_notified BOOLEAN DEFAULT false,
    customer_notification_date TIMESTAMPTZ,
    customer_response TEXT,
    status VARCHAR(20) DEFAULT 'Open',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_delay_production ON delay_logs(production_order_id);
CREATE INDEX idx_delay_type ON delay_logs(delay_type);
CREATE INDEX idx_delay_status ON delay_logs(status);
CREATE INDEX idx_delay_start ON delay_logs(delay_start_time);

ALTER TABLE delay_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "delay_logs_select" ON delay_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "delay_logs_insert" ON delay_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "delay_logs_update" ON delay_logs FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delay_logs_delete" ON delay_logs FOR DELETE TO authenticated USING (true);

-- 21. PACKAGING DETAILS
CREATE TABLE IF NOT EXISTS packaging_details (
    packaging_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) NOT NULL REFERENCES production_orders(production_order_id),
    packaging_type VARCHAR(50) NOT NULL,
    packaging_material VARCHAR(100),
    units_per_package INT NOT NULL,
    number_of_packages INT NOT NULL,
    total_weight_kg DECIMAL(10,2),
    package_dimensions_cm TEXT,
    label_details TEXT,
    special_handling_instructions TEXT,
    packaging_qc_status VARCHAR(20) DEFAULT 'Pending',
    packaging_qc_by INT REFERENCES employees(employee_id),
    packaging_qc_date TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'Pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_packaging_production ON packaging_details(production_order_id);
CREATE INDEX idx_packaging_status ON packaging_details(status);

ALTER TABLE packaging_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "packaging_details_select" ON packaging_details FOR SELECT TO authenticated USING (true);
CREATE POLICY "packaging_details_insert" ON packaging_details FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "packaging_details_update" ON packaging_details FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "packaging_details_delete" ON packaging_details FOR DELETE TO authenticated USING (true);

-- 22. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    invoice_id VARCHAR(20) PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    production_order_id VARCHAR(20) REFERENCES production_orders(production_order_id),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    subtotal DECIMAL(15,2) NOT NULL,
    tax_percent DECIMAL(5,2) DEFAULT 18.00,
    tax_amount DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
    billing_address TEXT,
    shipping_address TEXT,
    gst_number VARCHAR(20),
    status VARCHAR(20) DEFAULT 'Draft',
    payment_status VARCHAR(20) DEFAULT 'Pending',
    payment_due_days INT DEFAULT 30,
    payment_reminder_sent BOOLEAN DEFAULT false,
    last_reminder_date DATE,
    notes TEXT,
    created_by INT REFERENCES employees(employee_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoice_quotation ON invoices(quotation_id);
CREATE INDEX idx_invoice_customer ON invoices(customer_id);
CREATE INDEX idx_invoice_status ON invoices(status);
CREATE INDEX idx_invoice_payment_status ON invoices(payment_status);
CREATE INDEX idx_invoice_duedate ON invoices(due_date);
CREATE INDEX idx_invoice_number ON invoices(invoice_number);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert" ON invoices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoices_update" ON invoices FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invoices_delete" ON invoices FOR DELETE TO authenticated USING (true);

-- 23. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
    invoice_item_id SERIAL PRIMARY KEY,
    invoice_id VARCHAR(20) NOT NULL REFERENCES invoices(invoice_id),
    line_item_id INT REFERENCES quotation_products(line_item_id),
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(15,2) NOT NULL,
    total_price DECIMAL(15,2) NOT NULL,
    tax_percent DECIMAL(5,2) DEFAULT 18.00,
    tax_amount DECIMAL(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invoiceitems_invoice ON invoice_items(invoice_id);
CREATE INDEX idx_invoiceitems_lineitem ON invoice_items(line_item_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE TO authenticated USING (true);

-- 24. SUNDRY EXPENSES
CREATE TABLE IF NOT EXISTS sundry_expenses (
    expense_id SERIAL PRIMARY KEY,
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    production_order_id VARCHAR(20) REFERENCES production_orders(production_order_id),
    customer_id VARCHAR(20) NOT NULL REFERENCES customers(customer_id),
    expense_date DATE NOT NULL,
    expense_category VARCHAR(50) NOT NULL,
    expense_sub_category VARCHAR(100),
    amount DECIMAL(15,2) NOT NULL,
    gst_applicable BOOLEAN DEFAULT false,
    gst_amount DECIMAL(15,2) DEFAULT 0,
    total_amount DECIMAL(15,2) NOT NULL,
    payment_method VARCHAR(50),
    paid_by VARCHAR(100),
    payment_reference VARCHAR(100),
    bill_number VARCHAR(50),
    bill_attachment_url TEXT,
    vendor_name VARCHAR(255),
    is_approved BOOLEAN DEFAULT false,
    approved_by INT REFERENCES employees(employee_id),
    approved_date TIMESTAMPTZ,
    rejection_reason TEXT,
    reimbursement_required BOOLEAN DEFAULT false,
    reimbursement_date DATE,
    reimbursement_amount DECIMAL(15,2),
    reimbursement_reference VARCHAR(100),
    reimbursed_by INT REFERENCES employees(employee_id),
    is_recoverable BOOLEAN DEFAULT false,
    recovered_in_invoice BOOLEAN DEFAULT false,
    invoice_id VARCHAR(20) REFERENCES invoices(invoice_id),
    status VARCHAR(20) DEFAULT 'Pending',
    description TEXT NOT NULL,
    customer_present BOOLEAN DEFAULT false,
    created_by INT NOT NULL REFERENCES employees(employee_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sundry_quotation ON sundry_expenses(quotation_id);
CREATE INDEX idx_sundry_production ON sundry_expenses(production_order_id);
CREATE INDEX idx_sundry_customer ON sundry_expenses(customer_id);
CREATE INDEX idx_sundry_category ON sundry_expenses(expense_category);
CREATE INDEX idx_sundry_status ON sundry_expenses(status);
CREATE INDEX idx_sundry_date ON sundry_expenses(expense_date);

ALTER TABLE sundry_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sundry_expenses_select" ON sundry_expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "sundry_expenses_insert" ON sundry_expenses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "sundry_expenses_update" ON sundry_expenses FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "sundry_expenses_delete" ON sundry_expenses FOR DELETE TO authenticated USING (true);

-- 25. JOB FINANCIAL CLOSURE
CREATE TABLE IF NOT EXISTS job_financial_closure (
    closure_id SERIAL PRIMARY KEY,
    production_order_id VARCHAR(20) UNIQUE NOT NULL REFERENCES production_orders(production_order_id),
    quotation_id VARCHAR(20) NOT NULL REFERENCES quotations(quotation_id),
    invoice_id VARCHAR(20) REFERENCES invoices(invoice_id),
    total_quotation_amount DECIMAL(15,2) NOT NULL,
    total_invoice_amount DECIMAL(15,2) DEFAULT 0,
    total_amount_received DECIMAL(15,2) DEFAULT 0,
    pending_amount DECIMAL(15,2) DEFAULT 0,
    total_production_cost DECIMAL(15,2) DEFAULT 0,
    total_material_cost DECIMAL(15,2) DEFAULT 0,
    total_labor_cost DECIMAL(15,2) DEFAULT 0,
    total_machine_cost DECIMAL(15,2) DEFAULT 0,
    total_overhead_cost DECIMAL(15,2) DEFAULT 0,
    total_setup_cost DECIMAL(15,2) DEFAULT 0,
    total_sample_cost DECIMAL(15,2) DEFAULT 0,
    total_sundry_expenses DECIMAL(15,2) DEFAULT 0,
    sundry_expenses_recovered DECIMAL(15,2) DEFAULT 0,
    sundry_expenses_written_off DECIMAL(15,2) DEFAULT 0,
    additional_production_cost DECIMAL(15,2) DEFAULT 0,
    total_cost DECIMAL(15,2),
    total_income DECIMAL(15,2),
    net_profit_loss DECIMAL(15,2),
    profit_margin_percent DECIMAL(5,2),
    total_discount_given DECIMAL(15,2) DEFAULT 0,
    total_write_off DECIMAL(15,2) DEFAULT 0,
    adjustment_notes TEXT,
    planned_days INT,
    actual_days INT,
    delay_days INT,
    delay_cost_impact DECIMAL(15,2),
    qc_failures INT,
    rework_cost DECIMAL(15,2),
    closure_date TIMESTAMPTZ DEFAULT NOW(),
    closed_by INT NOT NULL REFERENCES employees(employee_id),
    status VARCHAR(20) DEFAULT 'Pending',
    summary_report TEXT,
    lessons_learned TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_closure_production ON job_financial_closure(production_order_id);
CREATE INDEX idx_closure_quotation ON job_financial_closure(quotation_id);
CREATE INDEX idx_closure_invoice ON job_financial_closure(invoice_id);
CREATE INDEX idx_closure_status ON job_financial_closure(status);
CREATE INDEX idx_closure_date ON job_financial_closure(closure_date);

ALTER TABLE job_financial_closure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job_financial_closure_select" ON job_financial_closure FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_financial_closure_insert" ON job_financial_closure FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "job_financial_closure_update" ON job_financial_closure FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "job_financial_closure_delete" ON job_financial_closure FOR DELETE TO authenticated USING (true);

-- ============================================================
-- VERIFY ALL TABLES CREATED
-- ============================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- ============================================================
-- VERIFY EMPLOYEE LINK
-- ============================================================
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    e.employee_id,
    e.full_name,
    e.role
FROM users u
LEFT JOIN employees e ON u.id = e.auth_user_id
WHERE u.email = 'admin@printflow.com';
