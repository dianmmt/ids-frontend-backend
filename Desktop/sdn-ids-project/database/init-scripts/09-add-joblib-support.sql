-- ============================================================================
-- 9. ADD JOBLIB SUPPORT - Update model_registry format constraint
-- This script updates the check constraint to support .joblib files
-- ============================================================================

-- Drop the existing check constraint
ALTER TABLE model_registry DROP CONSTRAINT IF EXISTS model_registry_format_check;

-- Add the new check constraint that includes joblib
ALTER TABLE model_registry ADD CONSTRAINT model_registry_format_check 
CHECK (format IN ('pkl', 'h5', 'joblib'));

-- Update the comment to reflect the new supported formats
COMMENT ON COLUMN model_registry.format IS 'Model format: pkl (pickle), h5 (Keras/TensorFlow), or joblib (scikit-learn/XGBoost)';





