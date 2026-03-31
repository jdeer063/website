-- Database Schema Repair & Modular Cashier Support
-- Run this to fix "column does not exist" or "relation does not exist" errors

-- 1. Patch Billing Table (Add missing performance columns)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing' AND column_name='created_at') THEN
        ALTER TABLE billing ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing' AND column_name='updated_at') THEN
        ALTER TABLE billing ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing' AND column_name='period_start') THEN
        ALTER TABLE billing ADD COLUMN period_start DATE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='billing' AND column_name='period_end') THEN
        ALTER TABLE billing ADD COLUMN period_end DATE;
    END IF;
END $$;

-- 2. Create Online Payments Table
CREATE TABLE IF NOT EXISTS online_payments (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER REFERENCES billing(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    platform VARCHAR(50) NOT NULL, -- 'gcash', 'bank', etc.
    reference_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Enable RLS and Policies
ALTER TABLE online_payments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable all access' AND tablename = 'online_payments') THEN
        CREATE POLICY "Enable all access" ON online_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Refresh PostgREST Cache (Implicitly happens on schema change, but sometimes helpful to run a simple select)
SELECT * FROM online_payments LIMIT 1;
