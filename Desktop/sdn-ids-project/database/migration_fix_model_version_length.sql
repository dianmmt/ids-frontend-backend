-- Migration script to fix model_version field length constraint
-- The model_version field in attack_events table was VARCHAR(20) but model types
-- from ML services can be longer than 20 characters, causing insertion errors.

-- Update model_version field to allow longer model types
ALTER TABLE attack_events 
ALTER COLUMN model_version TYPE VARCHAR(100);

-- Also ensure severity field can handle longer severity descriptions
-- In case severity mappings also exceed the VARCHAR(20) limit
ALTER TABLE attack_events 
ALTER COLUMN severity TYPE VARCHAR(50);

-- Update the CHECK constraint for severity to include additional values if needed
ALTER TABLE attack_events 
DROP CONSTRAINT IF EXISTS attack_events_severity_check;

ALTER TABLE attack_events 
ADD CONSTRAINT attack_events_severity_check 
CHECK (severity IN ('low', 'medium', 'high', 'critical'));

-- Update performance_alerts table severity field to match
ALTER TABLE performance_alerts 
ALTER COLUMN severity TYPE VARCHAR(50);

-- Add comment to explain the changes
COMMENT ON COLUMN attack_events.model_version IS 'Model type/version identifier - Updated from VARCHAR(20) to VARCHAR(100) to accommodate longer model type names from ML services';
COMMENT ON COLUMN attack_events.severity IS 'Attack severity level - Updated from VARCHAR(20) to VARCHAR(50) to accommodate longer severity descriptions';
