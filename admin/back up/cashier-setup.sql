-- COMPLETE Water Billing System Setup
-- Run this in your Supabase SQL Editor

-- 1. Customers Table
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

-- 2. Staff Table
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
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

-- 3. Billing Table
CREATE TABLE IF NOT EXISTS billing (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    billing_period VARCHAR(50) DEFAULT '',
    period_start DATE,
    period_end DATE,
    previous_reading DECIMAL(10,2) DEFAULT 0,
    current_reading DECIMAL(10,2) DEFAULT 0,
    consumption DECIMAL(10,2) DEFAULT 0,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'overdue')),
    balance DECIMAL(10,2) DEFAULT 0,
    payment_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. Online Payments Table (New)
CREATE TABLE IF NOT EXISTS online_payments (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES billing(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 5. System Settings
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
    admin_pin VARCHAR(255) DEFAULT '1234',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE online_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Simple Policies for Development
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all access') THEN
        CREATE POLICY "Enable all access" ON customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
        CREATE POLICY "Enable all access" ON staff FOR ALL TO authenticated USING (true) WITH CHECK (true);
        CREATE POLICY "Enable all access" ON billing FOR ALL TO authenticated USING (true) WITH CHECK (true);
        CREATE POLICY "Enable all access" ON online_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
        CREATE POLICY "Enable all access" ON system_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
