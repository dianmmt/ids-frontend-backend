-- ============================================================================
-- 3. MODEL REGISTRY - Store trained models (PKL/H5) securely in PostgreSQL
-- This script creates tables and functions to manage model binaries and metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    version VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL CHECK (format IN ('pkl','h5')),
    framework VARCHAR(50), -- e.g., scikit-learn, tensorflow
    description TEXT,
    sha256 CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_model_registry_name_version
ON model_registry (name, version);

-- Separate large object storage to avoid row bloat
CREATE TABLE IF NOT EXISTS model_artifacts (
    model_id UUID PRIMARY KEY REFERENCES model_registry(id) ON DELETE CASCADE,
    content BYTEA NOT NULL
);

-- Ensure only one active model per name
CREATE OR REPLACE FUNCTION enforce_single_active_model()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active THEN
        UPDATE model_registry
        SET is_active = FALSE
        WHERE name = NEW.name AND id <> NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_model ON model_registry;
CREATE TRIGGER trg_single_active_model
BEFORE INSERT OR UPDATE ON model_registry
FOR EACH ROW
EXECUTE FUNCTION enforce_single_active_model();

-- ============================================================================
-- ML MODELS ENHANCEMENTS: add folder path and optional storage path
-- ============================================================================

-- Add folder path to existing ml_models table for dashboard references
ALTER TABLE IF EXISTS ml_models
  ADD COLUMN IF NOT EXISTS folder_path TEXT;

-- Add optional storage path to model_registry for FS-backed artifacts (future)
ALTER TABLE IF EXISTS model_registry
  ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Helpful view to expose active models with locations
CREATE OR REPLACE VIEW active_ml_models AS
SELECT 
  id, model_name, model_version, model_type,
  accuracy, precision_score, recall_score, f1_score,
  status, is_active, folder_path,
  created_at, updated_at
FROM ml_models
WHERE is_active = TRUE;



