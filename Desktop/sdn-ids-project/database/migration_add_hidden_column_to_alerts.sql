-- Migration: Add hidden column to performance_alerts table
-- This allows hiding alerts from the UI without deleting them from the database

-- Add hidden column to performance_alerts table
ALTER TABLE performance_alerts 
ADD COLUMN IF NOT EXISTS hidden BOOLEAN DEFAULT FALSE;

-- Add index for better query performance when filtering hidden alerts
CREATE INDEX IF NOT EXISTS idx_performance_alerts_hidden 
ON performance_alerts(hidden);

-- Add index for combined filtering (resolved and hidden)
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved_hidden 
ON performance_alerts(resolved, hidden);

-- Update existing alerts to ensure they are not hidden by default
UPDATE performance_alerts 
SET hidden = FALSE 
WHERE hidden IS NULL;

-- Add comment to document the purpose of the hidden column
COMMENT ON COLUMN performance_alerts.hidden IS 'Marks alerts as hidden from UI without deleting from database';


