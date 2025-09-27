-- Migration: Add model_selections table for user model preferences
-- This table stores user preferences for which models to use for attack detection

-- Create model_selections table
CREATE TABLE IF NOT EXISTS model_selections (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    model_id UUID NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
    selection_type VARCHAR(20) NOT NULL DEFAULT 'primary',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, model_id, selection_type)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_model_selections_user_id ON model_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_model_selections_model_id ON model_selections(model_id);
CREATE INDEX IF NOT EXISTS idx_model_selections_active ON model_selections(is_active);
CREATE INDEX IF NOT EXISTS idx_model_selections_selection_type ON model_selections(selection_type);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_model_selections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_model_selections_updated_at
    BEFORE UPDATE ON model_selections
    FOR EACH ROW
    EXECUTE FUNCTION update_model_selections_updated_at();

-- Insert default model selection for user 1 (admin) if it doesn't exist
-- This ensures the system has a default model to use
INSERT INTO model_selections (user_id, model_id, selection_type, is_active)
SELECT '1', mr.id, 'primary', true
FROM model_registry mr
WHERE mr.status = 'active'
  AND LOWER(mr.name) LIKE '%random%forest%'
  AND NOT EXISTS (
    SELECT 1 FROM model_selections ms 
    WHERE ms.user_id = '1' 
      AND ms.selection_type = 'primary' 
      AND ms.is_active = true
  )
LIMIT 1;

-- If no random forest model found, use the first active model
INSERT INTO model_selections (user_id, model_id, selection_type, is_active)
SELECT '1', mr.id, 'primary', true
FROM model_registry mr
WHERE mr.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM model_selections ms 
    WHERE ms.user_id = '1' 
      AND ms.selection_type = 'primary' 
      AND ms.is_active = true
  )
ORDER BY mr.created_at ASC
LIMIT 1;

-- Add comment to table
COMMENT ON TABLE model_selections IS 'Stores user preferences for ML models used in attack detection';
COMMENT ON COLUMN model_selections.user_id IS 'User ID who selected the model';
COMMENT ON COLUMN model_selections.model_id IS 'Reference to model_registry table (UUID)';
COMMENT ON COLUMN model_selections.selection_type IS 'Type of selection: primary, secondary, etc.';
COMMENT ON COLUMN model_selections.is_active IS 'Whether this selection is currently active';
