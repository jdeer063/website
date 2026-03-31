-- Seed Data for Customers and Staff (Run this after schema update)

DELETE FROM billing;
DELETE FROM customers;
DELETE FROM staff;

-- Insert Customers
INSERT INTO customers (last_name, first_name, middle_initial, address, meter_number, contact_number, customer_type, status, has_discount)
VALUES 
    ('Dela Cruz', 'Juan', 'P', 'Barangay Canjusa, Pulupandan', 'M-2023-001', '09171234567', 'residential', 'active', false),
    ('Santos', 'Maria', 'L', 'Barangay Culo, Pulupandan', 'M-2023-002', '09187654321', 'residential', 'active', true), -- PWD/Senior
    ('Bautista', 'Ricardo', '', 'Barangay Palaka Norte, Pulupandan', 'M-2023-003', '09198765432', 'residential', 'inactive', false),
    ('Lim', 'Wei', '', 'Barangay Zone 4, Pulupandan', 'M-IND-001', '09201239876', 'industrial', 'active', false),
    ('Ramos', 'Elena', 'S', 'Barangay Mabini, Pulupandan', 'M-2023-004', '09214567890', 'residential', 'pending', false);

-- Insert Staff
INSERT INTO staff (last_name, first_name, middle_initial, username, password, role, contact_number, status)
VALUES 
    ('Admin', 'Super', '', 'admin', 'admin123', 'cashier', '09170000000', 'active'),
    ('Reader', 'Mike', 'J', 'reader1', 'reader123', 'reader', '09171111111', 'active'),
    -- New Readers
    ('Penduko', 'Pedro', 'M', 'ppenduko', 'penduko123', 'reader', '09123456789', 'active'),
    ('Tamad', 'Juan', 'D', 'jtamad', 'tamad123', 'reader', '09198765432', 'active'),
    ('Dalisay', 'Cardo', 'B', 'cdalisay', 'dalisay123', 'reader', '09171234567', 'active'),
    ('Magtanggol', 'Victor', 'A', 'vmagtanggol', 'magtanggol123', 'reader', '09181239876', 'active'),
    ('Kabisote', 'Enteng', 'K', 'ekabisote', 'kabisote123', 'reader', '09205554444', 'active'),
    ('Revilla', 'Bong', 'R', 'brevilla', 'revilla123', 'reader', '09216667777', 'active'),
    ('Lapid', 'Lito', 'L', 'llapid', 'lapid123', 'reader', '09228889999', 'active');


-- Generate Mock Billing Data for Existing Customers (Detailed History)

-- 1. CURRENT BILL (March 2026) - Mostly Unpaid/Pending
INSERT INTO billing (
    customer_id, billing_period, previous_reading, current_reading, consumption, 
    reading_date, base_charge, consumption_charge, penalty, tax, arrears,
    amount, due_date, status, balance
)
SELECT 
    id, 
    'March 2026', 
    320 + FLOOR(RANDOM() * 50), -- Random previous
    320 + FLOOR(RANDOM() * 50) + 20 + FLOOR(RANDOM() * 30), -- Current > Previous
    0, -- placeholder for calc
    CURRENT_DATE, 
    CASE WHEN customer_type = 'industrial' THEN 150 ELSE 50 END, -- Base
    0, 0, 0, 0, 0, -- placeholders
    CURRENT_DATE + INTERVAL '15 days',
    'unpaid',
    0
FROM customers;

-- Update calculations for March (Current)
UPDATE billing b
SET
    consumption = current_reading - previous_reading,
    consumption_charge = (current_reading - previous_reading) * 20,
    -- Apply 20% discount on Base + Consumption if eligible
    amount = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 1.12, -- Add 12% Tax on top of net amount
    
    tax = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 0.12,

    balance = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 1.12
FROM customers c
WHERE b.customer_id = c.id AND b.billing_period = 'March 2026';


-- 2. PREVIOUS BILL (February 2026) - Mix of Paid and Overdue
INSERT INTO billing (
    customer_id, billing_period, previous_reading, current_reading, consumption, 
    reading_date, base_charge, consumption_charge, penalty, tax, arrears,
    amount, due_date, status, balance, payment_date
)
SELECT 
    id, 
    'February 2026', 
    250 + FLOOR(RANDOM() * 50), 
    320 + FLOOR(RANDOM() * 20), 
    0, 
    CURRENT_DATE - INTERVAL '30 days',
    CASE WHEN customer_type = 'industrial' THEN 150 ELSE 50 END,
    0, 0, 0, 0, 0,
    CURRENT_DATE - INTERVAL '5 days', -- Already due
    CASE WHEN RANDOM() > 0.3 THEN 'paid' ELSE 'overdue' END, -- 30% chance overdue
    0,
    CASE WHEN RANDOM() > 0.3 THEN CURRENT_DATE - INTERVAL '2 days' ELSE NULL END -- Payment date if paid
FROM customers;

-- Update calculations for February (Past Due)
UPDATE billing b
SET
    consumption = current_reading - previous_reading,
    consumption_charge = (current_reading - previous_reading) * 20,
    -- Apply 20% discount
    amount = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 1.12,
    
    tax = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 0.12,

    balance = CASE 
        WHEN b.status = 'paid' THEN 0 
        ELSE (
             CASE 
                WHEN c.has_discount THEN 
                    ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
                ELSE 
                    ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
            END
        ) * 1.12 
    END
FROM customers c
WHERE b.customer_id = c.id AND b.billing_period = 'February 2026';


-- 3. HISTORICAL BILL (January 2026) - All Paid
INSERT INTO billing (
    customer_id, billing_period, previous_reading, current_reading, consumption, 
    reading_date, base_charge, consumption_charge, penalty, tax, arrears,
    amount, due_date, status, balance, payment_date
)
SELECT 
    id, 
    'January 2026', 
    200 + FLOOR(RANDOM() * 50), 
    250 + FLOOR(RANDOM() * 20), 
    0, 
    CURRENT_DATE - INTERVAL '60 days',
    CASE WHEN customer_type = 'industrial' THEN 150 ELSE 50 END,
    0, 0, 0, 0, 0,
    CURRENT_DATE - INTERVAL '35 days',
    'paid',
    0,
    CURRENT_DATE - INTERVAL '40 days'
FROM customers;

-- Update calculations for January (History)
UPDATE billing b
SET
    consumption = current_reading - previous_reading,
    consumption_charge = (current_reading - previous_reading) * 20,
    -- Apply 20% discount
    amount = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 1.12,
    
    tax = (
        CASE 
            WHEN c.has_discount THEN 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20)) * 0.80
            ELSE 
                ((CASE WHEN c.customer_type = 'industrial' THEN 150 ELSE 50 END) + ((current_reading - previous_reading) * 20))
        END
    ) * 0.12,

    balance = 0 -- All paid
FROM customers c
WHERE b.customer_id = c.id AND b.billing_period = 'January 2026';
