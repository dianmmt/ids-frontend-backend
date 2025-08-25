-- ============================================================================
-- SIMPLIFIED SDN-IDS DATABASE SCHEMA
-- Optimized for React interface with minimal complexity
-- ============================================================================

-- Enable essential extensions only
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. USERS - User Management
-- ============================================================================
CREATE TABLE users (
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
CREATE TABLE network_nodes (
    id SERIAL PRIMARY KEY,
    node_id VARCHAR(50) UNIQUE NOT NULL, -- s1, h1, c1
    node_type VARCHAR(20) NOT NULL CHECK (node_type IN ('controller', 'switch', 'host')),
    label VARCHAR(100) NOT NULL,
    ip_address INET,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'warning')),
    port_count INTEGER DEFAULT 0,
    
    -- For topology visualization
    position_x DECIMAL(10,2) DEFAULT 0,
    position_y DECIMAL(10,2) DEFAULT 0,
    
    -- Performance data (updated by monitoring)
    cpu_usage DECIMAL(5,2) DEFAULT 0,
    memory_usage DECIMAL(5,2) DEFAULT 0,
    active_flows INTEGER DEFAULT 0,
    
    last_seen TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 3. NETWORK_FLOWS - Flow Data from Ryu
-- ============================================================================
CREATE TABLE network_flows (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(100) NOT NULL,
    switch_id VARCHAR(50) NOT NULL REFERENCES network_nodes(node_id),
    
    -- 5-tuple flow identification
    source_ip INET NOT NULL,
    destination_ip INET NOT NULL,
    source_port INTEGER,
    destination_port INTEGER,
    protocol VARCHAR(20) NOT NULL,
    
    -- Flow statistics
    packet_count BIGINT DEFAULT 0,
    byte_count BIGINT DEFAULT 0,
    duration_seconds DECIMAL(10,3) DEFAULT 0,
    
    -- Computed features (for ML)
    packets_per_second DECIMAL(12,6) DEFAULT 0,
    bytes_per_second DECIMAL(15,6) DEFAULT 0,
    avg_packet_size DECIMAL(10,3) DEFAULT 0,
    
    -- Risk assessment
    risk_score DECIMAL(5,4) DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 1),
    
    -- Timing
    flow_start_time TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. ML_MODELS - Model Registry
-- ============================================================================
CREATE TABLE ml_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(20) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    
    -- Performance metrics
    accuracy DECIMAL(5,4) CHECK (accuracy >= 0 AND accuracy <= 1),
    precision_score DECIMAL(5,4) CHECK (precision_score >= 0 AND precision_score <= 1),
    recall_score DECIMAL(5,4) CHECK (recall_score >= 0 AND recall_score <= 1),
    f1_score DECIMAL(5,4) CHECK (f1_score >= 0 AND f1_score <= 1),
    
    -- Status
    status VARCHAR(20) DEFAULT 'training' CHECK (status IN ('training', 'active', 'deprecated')),
    is_active BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(model_name, model_version)
);

-- ============================================================================
-- 5. ML_PREDICTIONS - Inference Results
-- ============================================================================
CREATE TABLE ml_predictions (
    id BIGSERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL REFERENCES ml_models(id),
    flow_id BIGINT NOT NULL REFERENCES network_flows(id),
    
    -- Prediction results
    prediction_class VARCHAR(50), -- attack type or 'benign'
    confidence_score DECIMAL(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    is_malicious BOOLEAN NOT NULL DEFAULT false,
    
    -- Performance
    inference_time_ms DECIMAL(10,3),
    
    predicted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. ATTACK_EVENTS - Detected Attacks
-- ============================================================================
CREATE TABLE attack_events (
    id BIGSERIAL PRIMARY KEY,
    event_id VARCHAR(100) UNIQUE NOT NULL DEFAULT ('ATK-' || to_char(CURRENT_TIMESTAMP, 'YYYYMMDD-HH24MISS-') || substr(gen_random_uuid()::text, 1, 6)),
    
    -- Source data
    flow_id BIGINT REFERENCES network_flows(id),
    prediction_id BIGINT REFERENCES ml_predictions(id),
    
    -- Attack details
    attack_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'investigating', 'blocked', 'resolved')),
    confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Network info
    source_ip INET NOT NULL,
    destination_ip INET NOT NULL,
    source_port INTEGER,
    destination_port INTEGER,
    protocol VARCHAR(20),
    affected_switch VARCHAR(50) REFERENCES network_nodes(node_id),
    
    -- Flow statistics
    packet_count BIGINT DEFAULT 0,
    byte_count BIGINT DEFAULT 0,
    
    -- Human validation
    is_confirmed BOOLEAN, -- NULL=pending, true=confirmed, false=false_positive
    confirmed_by UUID REFERENCES users(id),
    confirmation_timestamp TIMESTAMPTZ,
    analyst_notes TEXT,
    
    -- Response
    auto_blocked BOOLEAN DEFAULT false,
    response_actions TEXT,
    
    -- Timing
    detected_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMPTZ
);

-- ============================================================================
-- 7. PERFORMANCE_METRICS - System Monitoring
-- ============================================================================
CREATE TABLE performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    component VARCHAR(100) NOT NULL, -- 'controller', 'ml_engine', 'database'
    node_id VARCHAR(50), -- reference to network_nodes for network components
    
    metric_type VARCHAR(50) NOT NULL, -- 'cpu', 'memory', 'disk', 'network'
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20), -- '%', 'MB', 'ms'
    
    measured_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. SYSTEM_SETTINGS - Configuration
-- ============================================================================
CREATE TABLE system_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 9. AUDIT_LOGS - Simple Audit Trail
-- ============================================================================
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    ip_address INET,
    result VARCHAR(20) DEFAULT 'success' CHECK (result IN ('success', 'failure')),
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- ESSENTIAL INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);

-- Network nodes
CREATE INDEX idx_nodes_type ON network_nodes(node_type);
CREATE INDEX idx_nodes_status ON network_nodes(status);

-- Network flows (CRITICAL - high volume)
CREATE INDEX idx_flows_captured_at ON network_flows(captured_at DESC);
CREATE INDEX idx_flows_switch_time ON network_flows(switch_id, captured_at DESC);
CREATE INDEX idx_flows_src_ip ON network_flows(source_ip);
CREATE INDEX idx_flows_risk_score ON network_flows(risk_score DESC) WHERE risk_score > 0.5;

-- ML predictions
CREATE INDEX idx_predictions_flow ON ml_predictions(flow_id);
CREATE INDEX idx_predictions_malicious ON ml_predictions(is_malicious, confidence_score DESC);

-- Attack events (MOST CRITICAL for UI)
CREATE INDEX idx_attacks_detected_at ON attack_events(detected_at DESC);
CREATE INDEX idx_attacks_type_severity ON attack_events(attack_type, severity);
CREATE INDEX idx_attacks_status ON attack_events(status);
CREATE INDEX idx_attacks_pending ON attack_events(is_confirmed) WHERE is_confirmed IS NULL;

-- Performance metrics
CREATE INDEX idx_perf_component_time ON performance_metrics(component, measured_at DESC);

-- Audit logs
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at DESC);

-- ============================================================================
-- TRIGGERS FOR AUTO-CALCULATION
-- ============================================================================

-- Function to calculate flow statistics
CREATE OR REPLACE FUNCTION calculate_flow_features()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate derived features
    IF NEW.duration_seconds > 0 THEN
        NEW.packets_per_second = NEW.packet_count / NEW.duration_seconds;
        NEW.bytes_per_second = NEW.byte_count / NEW.duration_seconds;
    END IF;
    
    IF NEW.packet_count > 0 THEN
        NEW.avg_packet_size = NEW.byte_count::DECIMAL / NEW.packet_count;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER calc_flow_features_trigger
    BEFORE INSERT OR UPDATE ON network_flows
    FOR EACH ROW
    EXECUTE FUNCTION calculate_flow_features();

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Users
INSERT INTO users (username, email, password_hash, role, full_name) VALUES 
('admin', 'admin@company.com', crypt('admin123', gen_salt('bf')), 'admin', 'System Administrator'),
('analyst', 'analyst@company.com', crypt('analyst123', gen_salt('bf')), 'analyst', 'Security Analyst'),
('viewer', 'viewer@company.com', crypt('viewer123', gen_salt('bf')), 'viewer', 'Network Viewer');

-- Network topology
INSERT INTO network_nodes (node_id, node_type, label, ip_address, position_x, position_y) VALUES 
('c1', 'controller', 'Ryu Controller', '172.16.0.1', 400, 50),
('s1', 'switch', 'Core Switch 1', '10.0.0.1', 200, 200),
('s2', 'switch', 'Core Switch 2', '10.0.0.2', 600, 200),
('h1', 'host', 'Web Server', '192.168.1.10', 100, 350),
('h2', 'host', 'Database Server', '192.168.1.20', 300, 350),
('h3', 'host', 'Client PC', '192.168.1.100', 700, 350);

-- System settings
INSERT INTO system_settings (setting_key, setting_value, description, category) VALUES 
('ryu_controller_url', '"http://localhost:8080"', 'Ryu Controller REST API URL', 'controller'),
('ml_model_endpoint', '"http://localhost:5000/predict"', 'ML inference endpoint', 'ml'),
('alert_thresholds', '{"cpu": 80, "memory": 85, "confidence": 0.7}', 'Alert thresholds', 'alerts'),
('dashboard_refresh', '{"attacks": 30, "topology": 60, "performance": 15}', 'Dashboard refresh intervals (seconds)', 'ui');

-- Sample ML model
INSERT INTO ml_models (model_name, model_version, model_type, accuracy, precision_score, recall_score, f1_score, status, is_active) VALUES 
('RandomForest_IDS', 'v1.0', 'random_forest', 0.947, 0.923, 0.951, 0.937, 'active', true);

-- ============================================================================
-- PRACTICAL QUERY EXAMPLES FOR REACT COMPONENTS
-- ============================================================================

/*
================================================================================
DASHBOARD.TSX - SYSTEM OVERVIEW QUERIES
================================================================================
*/

-- 1. Get system overview stats for Dashboard cards
-- Query for: attacks detected, blocked, investigating, ML accuracy
SELECT 
    (SELECT COUNT(*) FROM attack_events WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as attacks_24h,
    (SELECT COUNT(*) FROM attack_events WHERE status = 'blocked' AND detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as blocked_24h,
    (SELECT COUNT(*) FROM attack_events WHERE status = 'investigating') as investigating,
    (SELECT COUNT(*) FROM attack_events WHERE is_confirmed IS NULL) as pending_review,
    (SELECT AVG(f1_score) FROM ml_models WHERE is_active = true) as ml_accuracy,
    (SELECT COUNT(*) FROM network_flows WHERE captured_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour') as flows_last_hour;

-- 2. Attack timeline data for chart (last 24 hours, grouped by hour)
SELECT 
    date_trunc('hour', detected_at) as hour,
    COUNT(*) as attack_count,
    AVG(confidence) as avg_confidence
FROM attack_events 
WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY date_trunc('hour', detected_at)
ORDER BY hour;

-- 3. Recent security events for activity feed
SELECT 
    ae.event_id,
    ae.attack_type,
    ae.severity,
    ae.source_ip,
    ae.detected_at,
    CASE 
        WHEN ae.detected_at >= CURRENT_TIMESTAMP - INTERVAL '2 minutes' THEN '2 min ago'
        WHEN ae.detected_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes' THEN '5 min ago'
        ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ae.detected_at))/60 || ' min ago'
    END as time_ago
FROM attack_events ae
ORDER BY ae.detected_at DESC
LIMIT 10;

/*
================================================================================
ATTACKDETECTION.TSX - ATTACK MANAGEMENT QUERIES
================================================================================
*/

-- 4. Get recent attacks with pagination and filtering
SELECT 
    ae.id,
    ae.event_id,
    ae.attack_type,
    ae.severity,
    ae.status,
    ae.confidence,
    ae.source_ip,
    ae.destination_ip,
    ae.source_port,
    ae.destination_port,
    ae.protocol,
    ae.packet_count,
    ae.byte_count,
    ae.detected_at,
    ae.is_confirmed,
    ae.analyst_notes,
    u.username as confirmed_by_name,
    nn.label as affected_switch_name
FROM attack_events ae
LEFT JOIN users u ON ae.confirmed_by = u.id
LEFT JOIN network_nodes nn ON ae.affected_switch = nn.node_id
WHERE 
    ($1::text IS NULL OR ae.severity = $1) -- Filter by severity
    AND ($2::text IS NULL OR ae.attack_type ILIKE '%' || $2 || '%') -- Search by type
    AND ae.detected_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY ae.detected_at DESC
LIMIT $3 OFFSET $4; -- Pagination

-- 5. Attack statistics for summary cards
SELECT 
    COUNT(*) FILTER (WHERE status = 'detected') as active_threats,
    COUNT(*) FILTER (WHERE status = 'blocked') as blocked_attacks,
    COUNT(*) FILTER (WHERE status = 'investigating') as investigating,
    ROUND(AVG(confidence * 100), 1) as avg_confidence
FROM attack_events 
WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours';

-- 6. Attack types distribution
SELECT 
    attack_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM attack_events WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'), 1) as percentage,
    AVG(confidence) as avg_confidence
FROM attack_events 
WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY attack_type
ORDER BY count DESC;

/*
================================================================================
NETWORKTOPOLOGY.TSX - NETWORK VISUALIZATION QUERIES
================================================================================
*/

-- 7. Get network topology with current status
SELECT 
    nn.node_id,
    nn.node_type,
    nn.label,
    nn.ip_address,
    nn.status,
    nn.position_x,
    nn.position_y,
    nn.port_count,
    nn.active_flows,
    nn.cpu_usage,
    nn.memory_usage,
    nn.last_seen,
    COALESCE(recent_attacks.attack_count, 0) as recent_attacks
FROM network_nodes nn
LEFT JOIN (
    SELECT 
        affected_switch,
        COUNT(*) as attack_count
    FROM attack_events
    WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
      AND affected_switch IS NOT NULL
    GROUP BY affected_switch
) recent_attacks ON nn.node_id = recent_attacks.affected_switch
ORDER BY nn.node_type, nn.node_id;

-- 8. Network topology statistics
SELECT 
    node_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'active') as active,
    COUNT(*) FILTER (WHERE status = 'warning') as warning,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive
FROM network_nodes
GROUP BY node_type;

-- 9. Top source IPs for attack analysis
SELECT 
    source_ip,
    COUNT(*) as attack_count,
    COUNT(DISTINCT attack_type) as unique_attack_types,
    MAX(detected_at) as latest_attack,
    AVG(confidence) as avg_confidence
FROM attack_events
WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY source_ip
ORDER BY attack_count DESC
LIMIT 10;

/*
================================================================================
PERFORMANCEMONITOR.TSX - SYSTEM PERFORMANCE QUERIES
================================================================================
*/

-- 10. Current system performance metrics
SELECT 
    component,
    metric_type,
    metric_name,
    metric_value,
    metric_unit,
    measured_at
FROM performance_metrics pm1
WHERE pm1.measured_at = (
    SELECT MAX(pm2.measured_at)
    FROM performance_metrics pm2
    WHERE pm2.component = pm1.component 
      AND pm2.metric_type = pm1.metric_type
      AND pm2.metric_name = pm1.metric_name
)
ORDER BY component, metric_type;

-- 11. Performance trends (last 24 hours, hourly averages)
SELECT 
    component,
    metric_type,
    date_trunc('hour', measured_at) as hour,
    AVG(metric_value) as avg_value,
    MAX(metric_value) as max_value,
    MIN(metric_value) as min_value
FROM performance_metrics
WHERE measured_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
  AND metric_type IN ('cpu', 'memory', 'disk')
GROUP BY component, metric_type, date_trunc('hour', measured_at)
ORDER BY component, metric_type, hour;

-- 12. ML model performance summary
SELECT 
    mm.model_name,
    mm.model_version,
    mm.status,
    mm.accuracy,
    mm.f1_score,
    COUNT(mp.id) as total_predictions,
    COUNT(mp.id) FILTER (WHERE mp.predicted_at >= CURRENT_DATE) as predictions_today,
    AVG(mp.inference_time_ms) as avg_inference_time,
    COUNT(mp.id) FILTER (WHERE mp.is_malicious = true AND mp.predicted_at >= CURRENT_DATE) as threats_detected_today
FROM ml_models mm
LEFT JOIN ml_predictions mp ON mm.id = mp.model_id
WHERE mm.is_active = true
GROUP BY mm.id, mm.model_name, mm.model_version, mm.status, mm.accuracy, mm.f1_score;

/*
================================================================================
USERMANAGEMENT.TSX - USER ADMINISTRATION QUERIES
================================================================================
*/

-- 13. User list with activity status
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    u.status,
    u.full_name,
    u.last_login,
    u.created_at,
    CASE 
        WHEN u.last_login >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 'online'
        WHEN u.last_login >= CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 'recent'
        ELSE 'offline'
    END as activity_status,
    COALESCE(actions_today.action_count, 0) as actions_today
FROM users u
LEFT JOIN (
    SELECT 
        user_id,
        COUNT(*) as action_count
    FROM audit_logs
    WHERE created_at >= CURRENT_DATE
    GROUP BY user_id
) actions_today ON u.id = actions_today.user_id
ORDER BY u.last_login DESC NULLS LAST;

-- 14. User role statistics
SELECT 
    role,
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE status = 'active') as active_users,
    COUNT(*) FILTER (WHERE last_login >= CURRENT_TIMESTAMP - INTERVAL '24 hours') as active_today
FROM users
GROUP BY role;

/*
================================================================================
SECURITYANALYTICS.TSX - ANALYTICS AND REPORTING QUERIES
================================================================================
*/

-- 15. Attack trends over time periods
SELECT 
    date_trunc('day', detected_at) as day,
    attack_type,
    COUNT(*) as attack_count,
    AVG(confidence) as avg_confidence,
    COUNT(*) FILTER (WHERE status = 'blocked') as blocked_count
FROM attack_events
WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY date_trunc('day', detected_at), attack_type
ORDER BY day DESC, attack_count DESC;

-- 16. Geographic/IP analysis (top attacking sources)
SELECT 
    source_ip,
    COUNT(*) as total_attacks,
    COUNT(DISTINCT destination_ip) as unique_targets,
    COUNT(DISTINCT attack_type) as attack_variety,
    MIN(detected_at) as first_seen,
    MAX(detected_at) as last_seen,
    AVG(confidence) as avg_confidence
FROM attack_events
WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY source_ip
HAVING COUNT(*) >= 5 -- Only show IPs with multiple attacks
ORDER BY total_attacks DESC
LIMIT 20;

-- 17. ML model accuracy over time
SELECT 
    DATE(mp.predicted_at) as prediction_date,
    COUNT(*) as total_predictions,
    COUNT(*) FILTER (WHERE mp.is_malicious = true) as malicious_predictions,
    COUNT(ae.id) as confirmed_attacks,
    ROUND(
        COUNT(ae.id)::DECIMAL / NULLIF(COUNT(*) FILTER (WHERE mp.is_malicious = true), 0) * 100, 
        2
    ) as precision_percentage
FROM ml_predictions mp
LEFT JOIN attack_events ae ON mp.id = ae.prediction_id AND ae.is_confirmed = true
WHERE mp.predicted_at >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE(mp.predicted_at)
ORDER BY prediction_date DESC;

/*
================================================================================
SETTINGS.TSX - CONFIGURATION QUERIES
================================================================================
*/

-- 18. Get all system settings grouped by category
SELECT 
    category,
    setting_key,
    setting_value,
    description,
    updated_at
FROM system_settings
ORDER BY category, setting_key;

-- 19. Update system setting
UPDATE system_settings 
SET setting_value = $1, updated_at = CURRENT_TIMESTAMP 
WHERE setting_key = $2;

/*
================================================================================
REAL-TIME DASHBOARD FUNCTIONS
================================================================================
*/

-- 20. Function to get dashboard summary (call this for main dashboard)
CREATE OR REPLACE FUNCTION get_dashboard_summary()
RETURNS JSON AS $
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'attacks_today', (SELECT COUNT(*) FROM attack_events WHERE detected_at >= CURRENT_DATE),
        'attacks_last_hour', (SELECT COUNT(*) FROM attack_events WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'),
        'blocked_today', (SELECT COUNT(*) FROM attack_events WHERE status = 'blocked' AND detected_at >= CURRENT_DATE),
        'pending_review', (SELECT COUNT(*) FROM attack_events WHERE is_confirmed IS NULL),
        'active_nodes', (SELECT COUNT(*) FROM network_nodes WHERE status = 'active'),
        'total_flows_today', (SELECT COUNT(*) FROM network_flows WHERE captured_at >= CURRENT_DATE),
        'ml_accuracy', (SELECT ROUND(AVG(f1_score * 100), 1) FROM ml_models WHERE is_active = true),
        'system_health', 'healthy'
    ) INTO result;
    
    RETURN result;
END;
$ LANGUAGE plpgsql;

-- Usage: SELECT get_dashboard_summary();

/*
================================================================================
SAMPLE API INTEGRATION QUERIES FOR NODE.JS/PYTHON
================================================================================
*/

-- 21. Insert new flow data from Ryu controller
INSERT INTO network_flows (
    flow_id, switch_id, source_ip, destination_ip, source_port, destination_port,
    protocol, packet_count, byte_count, duration_seconds, flow_start_time
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING id;

-- 22. Insert ML prediction result
INSERT INTO ml_predictions (
    model_id, flow_id, prediction_class, confidence_score, is_malicious, inference_time_ms
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id;

-- 23. Create attack event from high-confidence prediction
INSERT INTO attack_events (
    flow_id, prediction_id, attack_type, severity, confidence,
    source_ip, destination_ip, source_port, destination_port, protocol,
    packet_count, byte_count, affected_switch
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
) RETURNING event_id;

-- 24. Update node performance metrics
INSERT INTO performance_metrics (
    component, node_id, metric_type, metric_name, metric_value, metric_unit, measured_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
);

/*
================================================================================
USEFUL MAINTENANCE QUERIES
================================================================================
*/

-- 25. Clean old data (run daily)
DELETE FROM network_flows WHERE captured_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
DELETE FROM performance_metrics WHERE measured_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
DELETE FROM audit_logs WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';

-- 26. Database statistics
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY tablename, attname;

-- 27. Index usage statistics
SELECT 
    indexrelname as index_name,
    idx_tup_read,
    idx_tup_fetch,
    idx_scan
FROM pg_stat_user_indexes 
ORDER BY idx_scan DESC;

COMMENT ON DATABASE sdn_ids IS 'Simplified SDN Intrusion Detection System Database - Optimized for React Interface';

-- ============================================================================
-- SETUP COMPLETION
-- ============================================================================

SELECT 'SDN-IDS Simplified Database Setup Complete!' as status,
       'Default users: admin/admin123, analyst/analyst123, viewer/viewer123' as credentials,
       'Use get_dashboard_summary() for main dashboard data' as tip;