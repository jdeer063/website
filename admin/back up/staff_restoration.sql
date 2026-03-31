-- Emergency Staff Restoration Script
-- This script re-adds the essential staff accounts after a mock data wipe

-- Ensure staff table is clean (optional, safe to run multiple times if username is unique)
-- DELETE FROM staff WHERE username IN ('cashier', 'admin', 'reader1');

INSERT INTO staff (last_name, first_name, username, password, role, contact_number, status)
VALUES 
    ('User', 'Cashier', 'cashier', 'xyuuki18', 'cashier', '09123456789', 'active'),
    ('System', 'Admin', 'admin', 'admin123', 'cashier', '09170000000', 'active'),
    ('Reader', 'One', 'reader1', 'reader123', 'reader', '09171111111', 'active')
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    status = 'active';

-- 2. Security Patch: Allow login check for anon users
-- This is required because the login page uses the 'anon' key
DROP POLICY IF EXISTS "Allow anon SELECT for login" ON staff;
CREATE POLICY "Allow anon SELECT for login" ON staff
    FOR SELECT TO anon USING (status = 'active');

-- Output verification
SELECT id, username, role, status FROM staff;
