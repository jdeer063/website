-- Water Billing System Database Schema

-- RESET: Drop existing tables to enforce new schema
DROP TABLE IF EXISTS billing CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS area_boxes CASCADE;

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_initial VARCHAR(5),
    address TEXT NOT NULL,
    meter_number VARCHAR(50) UNIQUE NOT NULL,
    contact_number VARCHAR(20) NOT NULL,
    customer_type VARCHAR(20) DEFAULT 'residential' CHECK (customer_type IN ('residential', 'industrial')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    has_discount BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    auth_uid UUID UNIQUE, -- Links to Supabase Auth user
    last_name VARCHAR(100) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_initial VARCHAR(5),
    role VARCHAR(20) NOT NULL CHECK (role IN ('cashier', 'reader')),
    contact_number VARCHAR(20) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Billing Table
CREATE TABLE IF NOT EXISTS billing (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    billing_period VARCHAR(50) NOT NULL,
    previous_reading DECIMAL(10,2) DEFAULT 0,
    current_reading DECIMAL(10,2) DEFAULT 0,
    consumption DECIMAL(10,2) DEFAULT 0,
    reading_date DATE,
    base_charge DECIMAL(10,2) DEFAULT 0,
    consumption_charge DECIMAL(10,2) DEFAULT 0,
    penalty DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    arrears DECIMAL(10,2) DEFAULT 0,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'overdue')),
    balance DECIMAL(10,2) DEFAULT 0,
    payment_date TIMESTAMP,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Area Boxes Table (Scheduling Overhaul)
CREATE TABLE IF NOT EXISTS area_boxes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(20) DEFAULT '#0288D1',
    barangays TEXT[] DEFAULT '{}', -- Array of barangay names
    assigned_reader_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- System Settings (The "Brain")
CREATE TABLE IF NOT EXISTS system_settings (
    id SERIAL PRIMARY KEY,
    base_rate DECIMAL(10,2) DEFAULT 150.00,
    tier1_threshold INTEGER DEFAULT 10,
    tier1_rate DECIMAL(10,2) DEFAULT 15.00,
    tier2_threshold INTEGER DEFAULT 20,
    tier2_rate DECIMAL(10,2) DEFAULT 20.00,
    tier3_rate DECIMAL(10,2) DEFAULT 25.00,
    discount_percentage DECIMAL(5,2) DEFAULT 20.00,
    penalty_percentage DECIMAL(5,2) DEFAULT 10.00,
    cutoff_days INTEGER DEFAULT 30,
    admin_pin VARCHAR(255), -- Set manually on setup
    updated_at TIMESTAMP DEFAULT NOW()
);


-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_meter_number ON customers(meter_number);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_staff_username ON staff(username);
CREATE INDEX IF NOT EXISTS idx_staff_auth_uid ON staff(auth_uid);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_billing_customer_id ON billing(customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_status ON billing(status);
CREATE INDEX IF NOT EXISTS idx_billing_due_date ON billing(due_date);

-- Enable Row Level Security (RLS)
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE area_boxes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON staff;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON billing;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON area_boxes;
DROP POLICY IF EXISTS "Enable read/write for authenticated users" ON system_settings;

-- RLS Policies (Allow all operations for authenticated users)
CREATE POLICY "Enable read/write for authenticated users" ON customers
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read/write for authenticated users" ON staff
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read/write for authenticated users" ON billing
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read/write for authenticated users" ON area_boxes
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Enable read/write for authenticated users" ON system_settings
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
