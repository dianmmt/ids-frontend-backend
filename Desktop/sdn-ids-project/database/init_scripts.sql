-- ============================================================================
-- SDN-IDS DATABASE SCHEMA - CLEANED VERSION
-- Removed duplicates and consolidated overlapping functionality
-- ============================================================================

-- Enable essential extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS - User Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'analyst', 'viewer')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    full_name VARCHAR(255),
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 2. NETWORK_NODES - SDN Topology
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) UNIQUE NOT NULL,
    node_type VARCHAR(20) NOT NULL CHECK (node_type IN ('controller', 'switch', 'host')),
    label VARCHAR(100) NOT NULL,
    ip_address INET,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'warning')),
    port_count INTEGER DEFAULT 0,
    
    -- Topology visualization
    position_x DECIMAL(10,2) DEFAULT 0,
    position_y DECIMAL(10,2) DEFAULT 0,
    
    -- Performance data
    cpu_usage DECIMAL(5,2) DEFAULT 0,
    memory_usage DECIMAL(5,2) DEFAULT 0,
    active_flows INTEGER DEFAULT 0,
    
    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. FLOWS - Consolidated Flow Data (CICFlowMeter + Ryu)
-- ============================================================================
CREATE TABLE IF NOT EXISTS flows (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(100) UNIQUE NOT NULL,
    switch_id VARCHAR(50) REFERENCES network_nodes(node_id),
    
    -- Basic flow identification
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol VARCHAR(20) NOT NULL,
    
    -- Basic flow statistics
    packet_count BIGINT DEFAULT 0,
    byte_count BIGINT DEFAULT 0,
    duration_seconds DECIMAL(15,6),
    
    -- CICFlowMeter complete feature set
    -- Forward/Backward packet counts and lengths
    total_fwd_packets INTEGER,
    total_backward_packets INTEGER,
    total_length_of_fwd_packets BIGINT,
    total_length_of_bwd_packets BIGINT,
    
    -- Forward packet length features
    fwd_packet_length_max DECIMAL(10,3),
    fwd_packet_length_min DECIMAL(10,3),
    fwd_packet_length_mean DECIMAL(10,3),
    fwd_packet_length_std DECIMAL(10,3),
    
    -- Backward packet length features
    bwd_packet_length_max DECIMAL(10,3),
    bwd_packet_length_min DECIMAL(10,3),
    bwd_packet_length_mean DECIMAL(10,3),
    bwd_packet_length_std DECIMAL(10,3),
    
    -- Flow rate features
    flow_bytes_per_second DECIMAL(15,6),
    flow_packets_per_second DECIMAL(12,6),
    
    -- Flow IAT (Inter-Arrival Time) features
    flow_iat_mean DECIMAL(15,6),
    flow_iat_std DECIMAL(15,6),
    flow_iat_max DECIMAL(15,6),
    flow_iat_min DECIMAL(15,6),
    
    -- Forward IAT features
    fwd_iat_total DECIMAL(15,6),
    fwd_iat_mean DECIMAL(15,6),
    fwd_iat_std DECIMAL(15,6),
    fwd_iat_max DECIMAL(15,6),
    fwd_iat_min DECIMAL(15,6),
    
    -- Backward IAT features
    bwd_iat_total DECIMAL(15,6),
    bwd_iat_mean DECIMAL(15,6),
    bwd_iat_std DECIMAL(15,6),
    bwd_iat_max DECIMAL(15,6),
    bwd_iat_min DECIMAL(15,6),
    
    -- Protocol flags
    fwd_psh_flags INTEGER DEFAULT 0,
    bwd_psh_flags INTEGER DEFAULT 0,
    fwd_urg_flags INTEGER DEFAULT 0,
    bwd_urg_flags INTEGER DEFAULT 0,
    
    -- Header length features
    fwd_header_length INTEGER,
    bwd_header_length INTEGER,
    
    -- Forward/Backward packet rates
    fwd_packets_per_second DECIMAL(12,6),
    bwd_packets_per_second DECIMAL(12,6),
    
    -- Packet length statistics
    packet_length_min DECIMAL(10,3),
    packet_length_max DECIMAL(10,3),
    packet_length_mean DECIMAL(10,3),
    packet_length_std DECIMAL(10,3),
    packet_length_variance DECIMAL(10,3),
    
    -- TCP flags
    fin_flag_count INTEGER DEFAULT 0,
    syn_flag_count INTEGER DEFAULT 0,
    rst_flag_count INTEGER DEFAULT 0,
    psh_flag_count INTEGER DEFAULT 0,
    ack_flag_count INTEGER DEFAULT 0,
    urg_flag_count INTEGER DEFAULT 0,
    cwe_flag_count INTEGER DEFAULT 0,
    ece_flag_count INTEGER DEFAULT 0,
    
    -- Flow ratios and averages
    down_up_ratio DECIMAL(10,6),
    packet_size_avg DECIMAL(10,3),
    fwd_segment_size_avg DECIMAL(10,3),
    bwd_segment_size_avg DECIMAL(10,3),
    
    -- Forward flow features
    fwd_bytes_per_byte_avg DECIMAL(10,6),
    fwd_packets_per_byte_avg DECIMAL(10,6),
    fwd_block_rate_avg DECIMAL(10,6),
    
    -- Backward flow features
    bwd_bytes_per_byte_avg DECIMAL(10,6),
    bwd_packets_per_byte_avg DECIMAL(10,6),
    bwd_block_rate_avg DECIMAL(10,6),
    
    -- Subflow features
    subflow_fwd_packets INTEGER,
    subflow_fwd_bytes BIGINT,
    subflow_bwd_packets INTEGER,
    subflow_bwd_bytes BIGINT,
    
    -- Window size features
    init_fwd_win_bytes INTEGER,
    init_bwd_win_bytes INTEGER,
    fwd_act_data_packets INTEGER,
    fwd_segment_size_min DECIMAL(10,3),
    
    -- Active/Idle time features
    active_mean DECIMAL(15,6),
    active_std DECIMAL(15,6),
    active_max DECIMAL(15,6),
    active_min DECIMAL(15,6),
    idle_mean DECIMAL(15,6),
    idle_std DECIMAL(15,6),
    idle_max DECIMAL(15,6),
    idle_min DECIMAL(15,6),
    
    -- Processing status
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    risk_score DECIMAL(5,4) DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 1),
    
    -- Timestamps
    flow_start_time TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. MODEL_REGISTRY - Consolidated Model Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    version VARCHAR(50) NOT NULL,
    format VARCHAR(20) NOT NULL CHECK (format IN ('pkl', 'h5', 'joblib')),
    framework VARCHAR(50),
    model_type VARCHAR(50) NOT NULL,
    description TEXT,
    
    -- Performance metrics
    accuracy DECIMAL(5,4) CHECK (accuracy >= 0 AND accuracy <= 1),
    precision_score DECIMAL(5,4) CHECK (precision_score >= 0 AND precision_score <= 1),
    recall_score DECIMAL(5,4) CHECK (recall_score >= 0 AND recall_score <= 1),
    f1_score DECIMAL(5,4) CHECK (f1_score >= 0 AND f1_score <= 1),
    
    -- Training information
    training_samples INTEGER,
    test_samples INTEGER,
    training_duration_seconds INTEGER,
    
-- Storage information
    file_storage_type VARCHAR(20) DEFAULT 'filesystem' CHECK (file_storage_type IN ('filesystem', 'database', 's3')),
    sha256 CHAR(64) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    storage_path TEXT,
    folder_path TEXT,
    
    -- Model metadata
    model_parameters JSONB,
    feature_importance JSONB,
    confusion_matrix JSONB,
    
    -- Status and deployment
    status VARCHAR(20) DEFAULT 'training' CHECK (status IN ('training', 'active', 'deprecated')),
    is_active BOOLEAN DEFAULT FALSE,
    upload_status VARCHAR(20) DEFAULT 'ready' CHECK (upload_status IN ('uploading', 'ready', 'failed', 'deleted')),
    
    -- Audit fields
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(name, version)
);

-- Unified model files storage (supports both filesystem and database storage)
CREATE TABLE IF NOT EXISTS model_files (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES model_registry(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'model', 'scaler', 'encoder', 'metadata'
    
    -- Storage options (only one should be used)
    file_path TEXT, -- For filesystem storage
    content BYTEA, -- For database storage (optional)
    
    -- File metadata
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL, -- SHA-256 for integrity
    mime_type VARCHAR(100),
    
    -- Status tracking
    upload_status VARCHAR(20) DEFAULT 'completed' CHECK (upload_status IN ('uploading', 'completed', 'failed', 'deleted')),
    storage_type VARCHAR(20) DEFAULT 'filesystem' CHECK (storage_type IN ('filesystem', 'database', 's3')),
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either file_path or content is provided
    CONSTRAINT check_storage_method CHECK (
        (storage_type = 'filesystem' AND file_path IS NOT NULL AND content IS NULL) OR
        (storage_type = 'database' AND content IS NOT NULL AND file_path IS NULL) OR
        (storage_type = 's3' AND file_path IS NOT NULL AND content IS NULL)
    )
);

-- ============================================================================
-- 5. ATTACK_EVENTS - Consolidated Attack Detection
-- ============================================================================
CREATE TABLE IF NOT EXISTS attack_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(120) UNIQUE NOT NULL,
    
    -- Flow context
    flow_id VARCHAR(100),
    switch_id VARCHAR(50) REFERENCES network_nodes(node_id),
    
    -- Network endpoints
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol VARCHAR(20),
    
    -- Attack classification
    is_attack BOOLEAN NOT NULL DEFAULT TRUE,
    attack_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- ML model information
    model_name VARCHAR(100),
    model_version VARCHAR(20),
    model_id UUID REFERENCES model_registry(id),
    inference_time_ms DECIMAL(10,3),
    
    -- Detection metadata
    detection_method VARCHAR(50) NOT NULL DEFAULT 'ml', -- 'ml', 'rule-based', 'anomaly'
    status VARCHAR(30) DEFAULT 'detected',
    false_positive BOOLEAN DEFAULT FALSE,
    analyst_notes TEXT,
    
    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. PERFORMANCE_METRICS - Consolidated System Monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20),
    
    -- Context
    node_id VARCHAR(50) REFERENCES network_nodes(node_id),
    component VARCHAR(50), -- 'controller', 'switch', 'host', 'system', 'ml', 'database', 'network'
    
    -- Status and trending
    status VARCHAR(20) DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'critical')),
    trend DECIMAL(10,2) DEFAULT 0,
    
    -- Timestamps
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6B. NETWORK_STATISTICS - Time-series network KPIs (lightweight)
-- ============================================================================
CREATE TABLE IF NOT EXISTS network_statistics (
    id BIGSERIAL PRIMARY KEY,
    -- Core KPIs
    packets_per_second BIGINT NOT NULL,
    bandwidth_used BIGINT NOT NULL, -- bytes/sec
    dropped_packets_rate DECIMAL(10,6) NOT NULL CHECK (dropped_packets_rate >= 0 AND dropped_packets_rate <= 1),
    active_flows INTEGER NOT NULL,

    -- Optional association to a network node (e.g., controller/switch)
    node_id VARCHAR(50) REFERENCES network_nodes(node_id),

    -- Timestamps
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Performance alerts
CREATE TABLE IF NOT EXISTS performance_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(50) UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ NULL,
    resolved_by VARCHAR(100) NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. SECURITY_RULES - Firewall and IDS Rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS security_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL CHECK (rule_type IN ('firewall', 'ids', 'ips')),
    
    -- Rule conditions
    source_ip_range CIDR,
    destination_ip_range CIDR,
    source_port_range VARCHAR(50),
    destination_port_range VARCHAR(50),
    protocol VARCHAR(20),
    
    -- Action
    action VARCHAR(20) NOT NULL CHECK (action IN ('allow', 'deny', 'alert', 'block')),
    priority INTEGER DEFAULT 100,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. BLOCKED_IPS - IP Blocking Management
-- ============================================================================
CREATE TABLE IF NOT EXISTS blocked_ips (
    id BIGSERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    block_reason VARCHAR(100) NOT NULL,
    attack_count INTEGER NOT NULL,
    time_window_minutes INTEGER NOT NULL,
    blocked_at TIMESTAMPTZ NOT NULL,
    unblocked_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. AUDIT_LOGS - System Activity Logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    
    -- User context
    user_id UUID REFERENCES users(id),
    username VARCHAR(50),
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    action_time TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Flow indexes
CREATE INDEX IF NOT EXISTS idx_flows_src_ip ON flows(src_ip);
CREATE INDEX IF NOT EXISTS idx_flows_dst_ip ON flows(dst_ip);
CREATE INDEX IF NOT EXISTS idx_flows_protocol ON flows(protocol);
CREATE INDEX IF NOT EXISTS idx_flows_captured_at ON flows(captured_at);
CREATE INDEX IF NOT EXISTS idx_flows_switch_id ON flows(switch_id);
CREATE INDEX IF NOT EXISTS idx_flows_is_processed ON flows(is_processed);

-- Attack events indexes
CREATE INDEX IF NOT EXISTS idx_attack_events_src_ip ON attack_events(src_ip);
CREATE INDEX IF NOT EXISTS idx_attack_events_dst_ip ON attack_events(dst_ip);
CREATE INDEX IF NOT EXISTS idx_attack_events_attack_type ON attack_events(attack_type);
CREATE INDEX IF NOT EXISTS idx_attack_events_severity ON attack_events(severity);
CREATE INDEX IF NOT EXISTS idx_attack_events_detected_at ON attack_events(detected_at);
CREATE INDEX IF NOT EXISTS idx_attack_events_detection_method ON attack_events(detection_method);

-- Model registry indexes
CREATE INDEX IF NOT EXISTS idx_model_registry_name ON model_registry(name);
CREATE INDEX IF NOT EXISTS idx_model_registry_is_active ON model_registry(is_active);
CREATE INDEX IF NOT EXISTS idx_model_registry_status ON model_registry(status);
CREATE INDEX IF NOT EXISTS idx_model_registry_accuracy ON model_registry(accuracy);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_node_id ON performance_metrics(node_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_component ON performance_metrics(component);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_metric_name ON performance_metrics(metric_name);

-- Network statistics indexes
CREATE INDEX IF NOT EXISTS idx_network_statistics_timestamp ON network_statistics(timestamp);
CREATE INDEX IF NOT EXISTS idx_network_statistics_node_id ON network_statistics(node_id);

-- Performance alerts indexes
CREATE INDEX IF NOT EXISTS idx_performance_alerts_timestamp ON performance_alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_severity ON performance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);

-- Blocked IPs indexes
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON blocked_ips(blocked_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_active ON blocked_ips(is_active);

-- Model files indexes
CREATE INDEX IF NOT EXISTS idx_model_files_model_id ON model_files(model_id);
CREATE INDEX IF NOT EXISTS idx_model_files_file_type ON model_files(file_type);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time ON audit_logs(action_time);

-- ============================================================================
-- TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_model_registry_updated_at BEFORE UPDATE ON model_registry
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_rules_updated_at BEFORE UPDATE ON security_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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

CREATE TRIGGER trg_single_active_model
    BEFORE INSERT OR UPDATE ON model_registry
    FOR EACH ROW EXECUTE FUNCTION enforce_single_active_model();

-- ============================================================================
-- COMPATIBILITY VIEWS (for existing application code)
-- ============================================================================

-- Legacy network_flows view
CREATE OR REPLACE VIEW network_flows AS
SELECT 
    id,
    flow_id,
    switch_id,
    src_ip AS source_ip,
    dst_ip AS destination_ip,
    src_port AS source_port,
    dst_port AS destination_port,
    protocol,
    packet_count,
    byte_count,
    duration_seconds,
    CASE 
        WHEN duration_seconds > 0 THEN packet_count / duration_seconds 
        ELSE 0 
    END AS packets_per_second,
    CASE 
        WHEN duration_seconds > 0 THEN byte_count / duration_seconds 
        ELSE 0 
    END AS bytes_per_second,
    CASE 
        WHEN packet_count > 0 THEN byte_count::DECIMAL / packet_count 
        ELSE 0 
    END AS avg_packet_size,
    risk_score,
    flow_start_time,
    captured_at
FROM flows;

-- Legacy ml_models view
CREATE OR REPLACE VIEW ml_models AS
SELECT 
    id,
    name AS model_name,
    version AS model_version,
    model_type,
    accuracy,
    precision_score,
    recall_score,
    f1_score,
    status,
    is_active,
    folder_path,
    storage_path AS model_path,
    training_samples AS training_data_size,
    training_duration_seconds,
    created_at,
    updated_at
FROM model_registry;

-- Legacy attack_detections view
CREATE OR REPLACE VIEW attack_detections AS
SELECT 
    id,
    event_id AS detection_id,
    attack_type,
    severity,
    confidence_score,
    src_ip AS source_ip,
    dst_ip AS destination_ip,
    src_port AS source_port,
    dst_port AS destination_port,
    protocol,
    flow_id,
    switch_id,
    model_id AS ml_model_id,
    detection_method,
    false_positive,
    analyst_notes,
    detected_at,
    created_at
FROM attack_events;

-- Legacy attacks view (for batch ML processing)
CREATE OR REPLACE VIEW attacks AS
SELECT 
    id,
    flow_id,
    src_ip,
    dst_ip,
    src_port,
    dst_port,
    protocol,
    is_attack,
    attack_type,
    confidence_score,
    severity,
    model_name,
    model_version,
    inference_time_ms,
    detected_at,
    created_at
FROM attack_events
WHERE detection_method IN ('ml_batch', 'ml');

-- ============================================================================
-- USEFUL VIEWS
-- ============================================================================

-- Active models view
CREATE OR REPLACE VIEW active_models AS
SELECT 
    mr.*,
    COUNT(mf.id) as file_count,
    COALESCE(SUM(mf.file_size), 0) as total_size
FROM model_registry mr
LEFT JOIN model_files mf ON mr.id = mf.model_id AND mf.upload_status = 'completed'
WHERE mr.is_active = TRUE
GROUP BY mr.id
ORDER BY mr.created_at DESC;

-- Recent attacks view
CREATE OR REPLACE VIEW recent_attacks AS
SELECT 
    ae.*,
    f.flow_duration,
    f.total_fwd_packets,
    f.total_backward_packets,
    f.flow_bytes_per_second,
    f.flow_packets_per_second
FROM attack_events ae
LEFT JOIN flows f ON ae.flow_id = f.flow_id
WHERE ae.detected_at > NOW() - INTERVAL '1 hour'
ORDER BY ae.detected_at DESC;

-- IP attack statistics view
CREATE OR REPLACE VIEW ip_attack_stats AS
SELECT 
    src_ip,
    COUNT(*) as attack_count,
    COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
    COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
    COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
    MAX(detected_at) as last_attack,
    MIN(detected_at) as first_attack,
    AVG(confidence_score) as avg_confidence
FROM attack_events 
WHERE is_attack = TRUE 
    AND detected_at > NOW() - INTERVAL '24 hours'
GROUP BY src_ip
ORDER BY attack_count DESC;

-- Latest system metrics view
CREATE OR REPLACE VIEW latest_system_metrics AS
SELECT DISTINCT ON (metric_name, component, node_id) 
    metric_name,
    metric_value,
    metric_unit,
    component,
    node_id,
    status,
    trend,
    recorded_at
FROM performance_metrics 
ORDER BY metric_name, component, node_id, recorded_at DESC;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Cleanup old data function
CREATE OR REPLACE FUNCTION cleanup_old_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;

    -- Clean old flows
    DELETE FROM flows WHERE is_processed = TRUE AND captured_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    -- Clean old attack events
    DELETE FROM attack_events WHERE detected_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    -- Clean old performance metrics
    DELETE FROM performance_metrics WHERE recorded_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    -- Clean resolved alerts
    DELETE FROM performance_alerts 
    WHERE resolved = TRUE AND resolved_at IS NOT NULL AND resolved_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    -- Clean inactive blocked IPs
    DELETE FROM blocked_ips WHERE is_active = FALSE AND blocked_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================

-- Insert sample users
INSERT INTO users (username, email, password_hash, role, full_name, status) VALUES
('admin', 'admin@sdn-ids.com', crypt('admin123', gen_salt('bf')), 'admin', 'System Administrator', 'active'),
('analyst1', 'analyst1@sdn-ids.com', crypt('analyst123', gen_salt('bf')), 'analyst', 'Security Analyst 1', 'active'),
('viewer1', 'viewer1@sdn-ids.com', crypt('viewer123', gen_salt('bf')), 'viewer', 'Network Viewer 1', 'active')
ON CONFLICT (username) DO NOTHING;

-- Insert sample network nodes
INSERT INTO network_nodes (node_id, node_type, label, ip_address, status, position_x, position_y) VALUES
('c1', 'controller', 'Ryu Controller', '192.168.1.100', 'active', 100, 100),
('s1', 'switch', 'Core Switch 1', '192.168.1.101', 'active', 300, 100),
('s2', 'switch', 'Core Switch 2', '192.168.1.102', 'active', 500, 100),
('h1', 'host', 'Web Server 1', '192.168.1.10', 'active', 200, 400),
('h2', 'host', 'Web Server 2', '192.168.1.11', 'active', 400, 400)
ON CONFLICT (node_id) DO NOTHING;

-- ============================================================================
-- SCHEMA CLEANUP COMPLETE
-- ============================================================================