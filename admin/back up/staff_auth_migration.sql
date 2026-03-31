-- Add auth_uid column to existing staff table
ALTER TABLE staff ADD COLUMN IF NOT EXISTS auth_uid UUID UNIQUE;

-- Create index for auth_uid
CREATE INDEX IF NOT EXISTS idx_staff_auth_uid ON staff(auth_uid);
