-- Create Supabase Auth accounts for staff members
-- Run this in Supabase SQL Editor AFTER creating staff in the Admin panel

-- This creates Auth accounts and links them to existing staff records
-- Replace the passwords with your actual staff passwords

DO $$
DECLARE
    staff_record RECORD;
    new_user_id UUID;
BEGIN
    -- Loop through all staff members without auth_uid
    FOR staff_record IN 
        SELECT id, username, password, first_name, last_name, role 
        FROM staff 
        WHERE auth_uid IS NULL
    LOOP
        -- Create Auth user (you'll need to do this via Supabase Dashboard > Authentication > Add User)
        -- Then update the staff record with the auth_uid
        
        RAISE NOTICE 'Create Auth user for: % (username: %@gmail.com, password: %)', 
            staff_record.first_name || ' ' || staff_record.last_name,
            staff_record.username,
            staff_record.password;
    END LOOP;
END $$;

-- MANUAL STEPS:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add User"
-- 3. For each staff member:
--    - Email: {username}@gmail.com (e.g., cashier1@gmail.com)
--    - Password: {their password}
--    - Auto Confirm User: YES
-- 4. After creating the user, get their UUID from the Users table
-- 5. Run this update query for each staff member:
--    UPDATE staff SET auth_uid = '{UUID from Auth Users}' WHERE username = '{username}';

-- Example:
-- UPDATE staff SET auth_uid = '12345678-1234-1234-1234-123456789012' WHERE username = 'cashier1';
