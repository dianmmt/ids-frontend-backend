-- Migration script to add missing duration_seconds column to flows table
-- This fixes the error: column f.duration_seconds does not exist

-- Add the duration_seconds column if it doesn't exist
ALTER TABLE flows 
ADD COLUMN IF NOT EXISTS duration_seconds DECIMAL(15,6);

-- Add comment to document the column
COMMENT ON COLUMN flows.duration_seconds IS 'Flow duration in seconds';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_flows_duration_seconds ON flows(duration_seconds);

-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully. Added duration_seconds column to flows table.';
END $$;
