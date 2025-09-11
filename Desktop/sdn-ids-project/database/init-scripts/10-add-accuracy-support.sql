-- ============================================================================
-- 10. ADD ACCURACY SUPPORT - Add performance metrics to model_registry
-- This script adds accuracy and other performance metrics to the model registry
-- ============================================================================

-- Add performance metrics columns to model_registry
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS accuracy DECIMAL(5,4) CHECK (accuracy >= 0 AND accuracy <= 1);
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS precision_score DECIMAL(5,4) CHECK (precision_score >= 0 AND precision_score <= 1);
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS recall_score DECIMAL(5,4) CHECK (recall_score >= 0 AND recall_score <= 1);
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS f1_score DECIMAL(5,4) CHECK (f1_score >= 0 AND f1_score <= 1);

-- Add training data information
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS training_samples INTEGER;
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS test_samples INTEGER;
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS training_duration_seconds INTEGER;

-- Add model metadata
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS model_parameters JSONB;
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS feature_importance JSONB;
ALTER TABLE model_registry ADD COLUMN IF NOT EXISTS confusion_matrix JSONB;

-- Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_model_registry_accuracy ON model_registry(accuracy);
CREATE INDEX IF NOT EXISTS idx_model_registry_f1_score ON model_registry(f1_score);
CREATE INDEX IF NOT EXISTS idx_model_registry_is_active ON model_registry(is_active);

-- Update the active_ml_models view to include new metrics
CREATE OR REPLACE VIEW active_ml_models AS
SELECT 
  id, name, version, format, framework, description,
  accuracy, precision_score, recall_score, f1_score,
  training_samples, test_samples, training_duration_seconds,
  model_parameters, feature_importance, confusion_matrix,
  sha256, size_bytes, uploaded_by, uploaded_at, is_active
FROM model_registry
WHERE is_active = TRUE;

-- Create a view for model performance comparison
CREATE OR REPLACE VIEW model_performance_comparison AS
SELECT 
  name,
  version,
  format,
  framework,
  accuracy,
  precision_score,
  recall_score,
  f1_score,
  training_samples,
  test_samples,
  uploaded_at,
  ROW_NUMBER() OVER (PARTITION BY name ORDER BY accuracy DESC) as accuracy_rank,
  ROW_NUMBER() OVER (PARTITION BY name ORDER BY f1_score DESC) as f1_rank
FROM model_registry
WHERE accuracy IS NOT NULL
ORDER BY name, accuracy DESC;

-- Function to get best performing model by name
CREATE OR REPLACE FUNCTION get_best_model_by_name(model_name VARCHAR)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    version VARCHAR,
    format VARCHAR,
    framework VARCHAR,
    accuracy DECIMAL,
    f1_score DECIMAL,
    uploaded_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id,
        mr.name,
        mr.version,
        mr.format,
        mr.framework,
        mr.accuracy,
        mr.f1_score,
        mr.uploaded_at
    FROM model_registry mr
    WHERE mr.name = model_name
        AND mr.accuracy IS NOT NULL
    ORDER BY mr.accuracy DESC, mr.f1_score DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get model performance statistics
CREATE OR REPLACE FUNCTION get_model_performance_stats()
RETURNS TABLE (
    total_models BIGINT,
    active_models BIGINT,
    avg_accuracy DECIMAL,
    max_accuracy DECIMAL,
    min_accuracy DECIMAL,
    models_with_metrics BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_models,
        COUNT(CASE WHEN is_active THEN 1 END) as active_models,
        AVG(accuracy) as avg_accuracy,
        MAX(accuracy) as max_accuracy,
        MIN(accuracy) as min_accuracy,
        COUNT(CASE WHEN accuracy IS NOT NULL THEN 1 END) as models_with_metrics
    FROM model_registry;
END;
$$ LANGUAGE plpgsql;





