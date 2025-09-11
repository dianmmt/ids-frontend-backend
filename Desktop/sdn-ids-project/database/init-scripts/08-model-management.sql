-- ============================================================================
-- Model Management Schema Updates
-- This script adds tables for model upload, storage, and selection
-- ============================================================================

-- Create model_files table for storing uploaded model files
CREATE TABLE IF NOT EXISTS model_files (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'model', 'scaler', 'encoder', 'metadata'
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash for integrity
    upload_status VARCHAR(20) DEFAULT 'uploading' CHECK (upload_status IN ('uploading', 'completed', 'failed', 'deleted')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create model_versions table for versioning
CREATE TABLE IF NOT EXISTS model_versions (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    version_number VARCHAR(20) NOT NULL,
    version_description TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    performance_metrics JSONB, -- Store accuracy, precision, recall, etc.
    training_data_info JSONB, -- Store training dataset information
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    UNIQUE(model_id, version_number)
);

-- Create model_selections table for user model preferences
CREATE TABLE IF NOT EXISTS model_selections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    model_version_id BIGINT REFERENCES model_versions(id) ON DELETE CASCADE,
    selection_type VARCHAR(20) DEFAULT 'primary' CHECK (selection_type IN ('primary', 'fallback', 'testing')),
    is_active BOOLEAN DEFAULT TRUE,
    selected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    selected_by UUID REFERENCES users(id),
    
    UNIQUE(user_id, selection_type)
);

-- Create model_usage_logs table for tracking model usage
CREATE TABLE IF NOT EXISTS model_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES ml_models(id) ON DELETE CASCADE,
    model_version_id BIGINT REFERENCES model_versions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    usage_type VARCHAR(20) NOT NULL CHECK (usage_type IN ('prediction', 'training', 'testing', 'validation')),
    input_data_hash VARCHAR(64), -- Hash of input data for tracking
    prediction_result JSONB, -- Store prediction results
    processing_time_ms DECIMAL(10,3),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Update ml_models table to support file storage
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS file_storage_type VARCHAR(20) DEFAULT 'database' CHECK (file_storage_type IN ('database', 'filesystem', 's3'));
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS upload_status VARCHAR(20) DEFAULT 'ready' CHECK (upload_status IN ('uploading', 'ready', 'failed', 'deleted'));
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS file_count INTEGER DEFAULT 0;
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS total_size BIGINT DEFAULT 0;
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);
ALTER TABLE ml_models ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_model_files_model_id ON model_files(model_id);
CREATE INDEX IF NOT EXISTS idx_model_files_file_type ON model_files(file_type);
CREATE INDEX IF NOT EXISTS idx_model_files_upload_status ON model_files(upload_status);
CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_is_active ON model_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_model_selections_user_id ON model_selections(user_id);
CREATE INDEX IF NOT EXISTS idx_model_selections_model_id ON model_selections(model_id);
CREATE INDEX IF NOT EXISTS idx_model_selections_selection_type ON model_selections(selection_type);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_model_id ON model_usage_logs(model_id);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_created_at ON model_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_model_usage_logs_usage_type ON model_usage_logs(usage_type);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_model_files_updated_at BEFORE UPDATE ON model_files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_versions_updated_at BEFORE UPDATE ON model_versions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for easier querying
CREATE OR REPLACE VIEW active_models AS
SELECT 
    m.*,
    mv.version_number,
    mv.version_description,
    mv.performance_metrics,
    mf.file_count,
    mf.total_size,
    u.username as uploaded_by_username
FROM ml_models m
LEFT JOIN model_versions mv ON m.id = mv.model_id AND mv.is_active = true
LEFT JOIN (
    SELECT 
        model_id,
        COUNT(*) as file_count,
        SUM(file_size) as total_size
    FROM model_files 
    WHERE upload_status = 'completed'
    GROUP BY model_id
) mf ON m.id = mf.model_id
LEFT JOIN users u ON m.uploaded_by = u.id
WHERE m.status = 'active' AND m.upload_status = 'ready'
ORDER BY m.created_at DESC;

CREATE OR REPLACE VIEW user_model_selections AS
SELECT 
    ms.*,
    m.model_name,
    m.model_type,
    mv.version_number,
    mv.performance_metrics,
    u.username as selected_by_username
FROM model_selections ms
JOIN ml_models m ON ms.model_id = m.id
LEFT JOIN model_versions mv ON ms.model_version_id = mv.id
LEFT JOIN users u ON ms.selected_by = u.id
WHERE ms.is_active = true
ORDER BY ms.selected_at DESC;

CREATE OR REPLACE VIEW model_usage_statistics AS
SELECT 
    m.model_name,
    m.model_type,
    mv.version_number,
    COUNT(*) as total_usage,
    COUNT(CASE WHEN success = true THEN 1 END) as successful_predictions,
    COUNT(CASE WHEN success = false THEN 1 END) as failed_predictions,
    AVG(processing_time_ms) as avg_processing_time,
    MAX(created_at) as last_used,
    MIN(created_at) as first_used
FROM model_usage_logs mul
JOIN ml_models m ON mul.model_id = m.id
LEFT JOIN model_versions mv ON mul.model_version_id = mv.id
WHERE mul.created_at > NOW() - INTERVAL '30 days'
GROUP BY m.id, m.model_name, m.model_type, mv.version_number
ORDER BY total_usage DESC;

-- Function to get user's selected model
CREATE OR REPLACE FUNCTION get_user_selected_model(user_uuid UUID, selection_type VARCHAR DEFAULT 'primary')
RETURNS TABLE (
    model_id UUID,
    model_name VARCHAR,
    model_type VARCHAR,
    version_number VARCHAR,
    model_path TEXT,
    scaler_path TEXT,
    encoder_path TEXT,
    performance_metrics JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.model_name,
        m.model_type,
        mv.version_number,
        m.model_path,
        mf_scaler.file_path as scaler_path,
        mf_encoder.file_path as encoder_path,
        mv.performance_metrics
    FROM model_selections ms
    JOIN ml_models m ON ms.model_id = m.id
    LEFT JOIN model_versions mv ON ms.model_version_id = mv.id
    LEFT JOIN model_files mf_scaler ON m.id = mf_scaler.model_id AND mf_scaler.file_type = 'scaler'
    LEFT JOIN model_files mf_encoder ON m.id = mf_encoder.model_id AND mf_encoder.file_type = 'encoder'
    WHERE ms.user_id = user_uuid 
        AND ms.selection_type = selection_type
        AND ms.is_active = true
        AND m.status = 'active'
        AND m.upload_status = 'ready';
END;
$$ LANGUAGE plpgsql;

-- Function to log model usage
CREATE OR REPLACE FUNCTION log_model_usage(
    p_model_id UUID,
    p_model_version_id BIGINT,
    p_user_id UUID,
    p_usage_type VARCHAR,
    p_input_hash VARCHAR,
    p_prediction_result JSONB,
    p_processing_time DECIMAL,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO model_usage_logs (
        model_id, model_version_id, user_id, usage_type,
        input_data_hash, prediction_result, processing_time_ms,
        success, error_message
    ) VALUES (
        p_model_id, p_model_version_id, p_user_id, p_usage_type,
        p_input_hash, p_prediction_result, p_processing_time,
        p_success, p_error_message
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update model file count and size
CREATE OR REPLACE FUNCTION update_model_file_stats(p_model_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE ml_models 
    SET 
        file_count = (
            SELECT COUNT(*) 
            FROM model_files 
            WHERE model_id = p_model_id AND upload_status = 'completed'
        ),
        total_size = (
            SELECT COALESCE(SUM(file_size), 0) 
            FROM model_files 
            WHERE model_id = p_model_id AND upload_status = 'completed'
        )
    WHERE id = p_model_id;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update file stats when files are added/removed
CREATE OR REPLACE FUNCTION trigger_update_model_file_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM update_model_file_stats(NEW.model_id);
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_model_file_stats(OLD.model_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_model_file_stats_trigger
    AFTER INSERT OR UPDATE OR DELETE ON model_files
    FOR EACH ROW EXECUTE FUNCTION trigger_update_model_file_stats();

-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================





