-- ========================================
-- COMPREHENSIVE MOCK DATA FOR AQUAFLOW (REGENERATED)
-- ========================================
-- This script creates realistic test data for both Admin and Cashier dashboards.
-- It is designed to ensure the system is functional and accessible immediately.

-- STEP 1: Clear existing data
-- Delete in correct order to respect foreign key constraints
DELETE FROM online_payments;
DELETE FROM billing;
DELETE FROM area_boxes;
DELETE FROM staff;
DELETE FROM customers;
DELETE FROM system_settings;

-- Reset sequences (PostgreSQL syntax)
ALTER SEQUENCE IF EXISTS customers_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS staff_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS billing_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS area_boxes_id_seq RESTART WITH 1;
ALTER SEQUENCE IF EXISTS system_settings_id_seq RESTART WITH 1;

-- STEP 2: System Settings
INSERT INTO system_settings (
    base_rate, 
    tier1_threshold, 
    tier1_rate, 
    tier2_threshold, 
    tier2_rate, 
    tier3_rate,
    discount_percentage,
    penalty_percentage,
    cutoff_days,
    admin_pin
) VALUES (
    150.00,  -- Base rate for minimum consumption
    10,      -- Tier 1 threshold (0-10 m³)
    15.00,   -- Tier 1 rate
    20,      -- Tier 2 threshold (11-20 m³)
    20.00,   -- Tier 2 rate
    25.00,   -- Tier 3 rate (21+ m³)
    20.00,   -- SC/PWD discount
    10.00,   -- Late penalty
    30,      -- Cutoff days
    '1234'   -- Admin PIN
);

-- STEP 3: Staff Accounts (Critical for Login)
-- These accounts are inserted directly to ensure dashboard access
INSERT INTO staff (last_name, first_name, username, password, role, contact_number, status) VALUES 
('User', 'Wana', 'wana', 'xyuuki18', 'cashier', '09123456780', 'active'),
('Deer', 'John', 'jdeer', '090603', 'cashier', '09123456789', 'active'),
('User', 'Cashier', 'cashier', 'xyuuki18', 'cashier', '09177778888', 'active'),
('System', 'Admin', 'admin', 'admin123', 'cashier', '09170000000', 'active'),
('Reader', 'One', 'reader1', 'reader123', 'reader', '09171111111', 'active'),
('Reader', 'Two', 'reader2', 'reader123', 'reader', '09172222222', 'active');

-- STEP 4: Customers (Realistic Pulupandan-based Data)
INSERT INTO customers (last_name, first_name, middle_initial, address, meter_number, contact_number, customer_type, status, has_discount) VALUES
('Reyes', 'Maria', 'S', 'Zone 1, Pulupandan', 'MTR-2024-001', '09171234567', 'residential', 'active', false),
('Santos', 'Juan', 'D', 'Zone 2, Pulupandan', 'MTR-2024-002', '09181234568', 'residential', 'active', true),
('Cruz', 'Ana', 'M', 'Zone 3, Pulupandan', 'MTR-2024-003', '09191234569', 'residential', 'active', false),
('Garcia', 'Pedro', 'L', 'Zone 4, Pulupandan', 'MTR-2024-004', '09201234570', 'residential', 'active', false),
('Mendoza', 'Rosa', 'T', 'ZONE 4-A, Pulupandan', 'MTR-2024-005', '09211234571', 'residential', 'active', true),
('Villanueva', 'Carlos', 'R', 'Zone 5, Pulupandan', 'MTR-2024-006', '09221234572', 'residential', 'active', false),
('Aquino', 'Elena', 'V', 'Zone 6, Pulupandan', 'MTR-2024-007', '09231234573', 'residential', 'active', false),
('Ramos', 'Miguel', 'A', 'Zone 7, Pulupandan', 'MTR-2024-008', '09241234574', 'residential', 'active', false),
('Torres', 'Luz', 'C', 'Canjusa, Pulupandan', 'MTR-2024-009', '09251234575', 'residential', 'active', true),
('Fernandez', 'Jose', 'B', 'Utod, Pulupandan', 'MTR-2024-010', '09261234576', 'residential', 'active', false),
('Lopez', 'Carmen', 'G', 'Pag-ayon, Pulupandan', 'MTR-2024-011', '09271234577', 'residential', 'active', false),
('Gonzales', 'Roberto', 'F', 'Palaka Norte, Pulupandan', 'MTR-2024-012', '09281234578', 'residential', 'active', false),
('Bautista', 'Linda', 'H', 'Mabini, Pulupandan', 'MTR-2024-013', '09291234579', 'residential', 'active', false),
('Dela Cruz', 'Antonio', 'J', 'Tapong, Pulupandan', 'MTR-2024-014', '09301234580', 'residential', 'active', true),
('Morales', 'Ricardo', 'N', 'Crossing, Pulupandan', 'MTR-2024-015', '09321234582', 'industrial', 'active', false),
('Rivera', 'Teresa', 'P', 'Ubay, Pulupandan', 'MTR-2024-016', '09331234583', 'residential', 'active', false),
('Flores', 'Manuel', 'Q', 'Poblacion, Pulupandan', 'MTR-2024-017', '09341234584', 'residential', 'active', false);

-- STEP 5: Area Boxes (Scheduling)
INSERT INTO area_boxes (name, color, barangays, assigned_reader_id) VALUES
('Zone A - North', '#0288D1', ARRAY['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4'], 4),
('Zone B - South', '#00897B', ARRAY['Zone 5', 'Zone 6', 'Zone 7', 'Canjusa'], 5),
('Zone C - Central', '#F57C00', ARRAY['Utod', 'Pag-ayon', 'Palaka Norte', 'Palaka Sur', 'Mabini'], NULL);

-- STEP 6: Billing Records (Historical & Current)
-- January 2026 (Paid)
INSERT INTO billing (customer_id, billing_period, previous_reading, current_reading, consumption, reading_date, base_charge, consumption_charge, penalty, tax, arrears, amount, due_date, status, balance, payment_date) VALUES
(1, 'January 2026', 100, 115, 15, '2026-01-01', 150, 225, 0, 0, 0, 375, '2026-01-20', 'paid', 0, '2026-01-15 10:00:00'),
(2, 'January 2026', 80, 92, 12, '2026-01-01', 150, 180, 0, 0, 0, 264, '2026-01-20', 'paid', 0, '2026-01-16 11:30:00');

-- February 2026 (Mix of scenarios)
INSERT INTO billing (customer_id, billing_period, previous_reading, current_reading, consumption, reading_date, base_charge, consumption_charge, penalty, tax, arrears, amount, due_date, status, balance) VALUES
(1, 'February 2026', 115, 130, 15, '2026-02-01', 150, 225, 0, 0, 0, 375, '2026-02-28', 'unpaid', 375),
(2, 'February 2026', 92, 105, 13, '2026-02-01', 150, 195, 0, 0, 0, 276, '2026-02-28', 'unpaid', 276),
(10, 'January 2026', 90, 105, 15, '2026-01-01', 150, 225, 37.5, 0, 0, 412.5, '2026-01-20', 'overdue', 412.5);

-- STEP 7: Online Payments (Queue)
INSERT INTO online_payments (bill_id, customer_id, amount, platform, reference_number, status) VALUES
(3, 1, 375.00, 'gcash', 'REF-PAY-001', 'pending'),
(4, 2, 276.00, 'paymaya', 'REF-PAY-002', 'pending');
