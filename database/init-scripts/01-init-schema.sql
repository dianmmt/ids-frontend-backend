-- ============================================================================
-- SDN-IDS DATABASE SCHEMA INITIALIZATION
-- This script runs automatically when PostgreSQL container starts for the first time
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
CREATE TABLE IF NOT EXISTS network_flows (
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
CREATE TABLE IF NOT EXISTS ml_models (
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
    
    -- Model metadata
    model_path TEXT,
    training_data_size INTEGER,
    training_duration_seconds INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. ATTACK_DETECTIONS - Security Events
-- ============================================================================
CREATE TABLE IF NOT EXISTS attack_detections (
    id BIGSERIAL PRIMARY KEY,
    detection_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- Detection details
    attack_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    confidence_score DECIMAL(5,4) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Source and target
    source_ip INET NOT NULL,
    destination_ip INET NOT NULL,
    source_port INTEGER,
    destination_port INTEGER,
    protocol VARCHAR(20),
    
    -- Flow context
    flow_id VARCHAR(100),
    switch_id VARCHAR(50) REFERENCES network_nodes(node_id),
    
    -- ML model used
    ml_model_id INTEGER REFERENCES ml_models(id),
    
    -- Detection metadata
    detection_method VARCHAR(50) NOT NULL, -- 'ml', 'rule-based', 'anomaly'
    false_positive BOOLEAN DEFAULT false,
    analyst_notes TEXT,
    
    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 6. PERFORMANCE_METRICS - System Monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS performance_metrics (
    id BIGSERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20),
    
    -- Context
    node_id VARCHAR(50) REFERENCES network_nodes(node_id),
    component VARCHAR(50), -- 'controller', 'switch', 'host', 'system'
    
    -- Timing
    recorded_at TIMESTAMPTZ NOT NULL,
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
    is_active BOOLEAN DEFAULT true,
    is_enabled BOOLEAN DEFAULT true,
    
    -- Metadata
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. AUDIT_LOGS - System Activity Logs
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

-- Network flows indexes
CREATE INDEX IF NOT EXISTS idx_network_flows_switch_id ON network_flows(switch_id);
CREATE INDEX IF NOT EXISTS idx_network_flows_source_ip ON network_flows(source_ip);
CREATE INDEX IF NOT EXISTS idx_network_flows_dest_ip ON network_flows(destination_ip);
CREATE INDEX IF NOT EXISTS idx_network_flows_protocol ON network_flows(protocol);
CREATE INDEX IF NOT EXISTS idx_network_flows_captured_at ON network_flows(captured_at);

-- Attack detections indexes
CREATE INDEX IF NOT EXISTS idx_attack_detections_attack_type ON attack_detections(attack_type);
CREATE INDEX IF NOT EXISTS idx_attack_detections_severity ON attack_detections(severity);
CREATE INDEX IF NOT EXISTS idx_attack_detections_detected_at ON attack_detections(detected_at);
CREATE INDEX IF NOT EXISTS idx_attack_detections_source_ip ON attack_detections(source_ip);

-- Performance metrics indexes
CREATE INDEX IF NOT EXISTS idx_performance_metrics_node_id ON performance_metrics(node_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_time ON audit_logs(action_time);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_ml_models_updated_at BEFORE UPDATE ON ml_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_security_rules_updated_at BEFORE UPDATE ON security_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Performance Monitoring Database Schema
-- File: database/init-scripts/02_performance_monitoring.sql

-- 1. System Metrics Table
CREATE TABLE IF NOT EXISTS system_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10, 2) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('normal', 'warning', 'critical')) NOT NULL,
    trend DECIMAL(10, 2) DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);

-- 2. Performance Alerts Table
CREATE TABLE IF NOT EXISTS performance_alerts (
    id SERIAL PRIMARY KEY,
    alert_id VARCHAR(50) UNIQUE NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
    component VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE NULL,
    resolved_by VARCHAR(100) NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for alerts
CREATE INDEX idx_performance_alerts_timestamp ON performance_alerts(timestamp);
CREATE INDEX idx_performance_alerts_severity ON performance_alerts(severity);
CREATE INDEX idx_performance_alerts_resolved ON performance_alerts(resolved);

-- 3. ML Processing Performance Table
CREATE TABLE IF NOT EXISTS ml_performance (
    id SERIAL PRIMARY KEY,
    inference_speed INTEGER NOT NULL, -- flows per second
    model_accuracy DECIMAL(5, 2) NOT NULL, -- percentage
    processing_latency DECIMAL(10, 3) NOT NULL, -- milliseconds
    queue_size INTEGER NOT NULL,
    processed_today BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for ML performance
CREATE INDEX idx_ml_performance_timestamp ON ml_performance(timestamp);

-- 4. Database Performance Table
CREATE TABLE IF NOT EXISTS database_performance (
    id SERIAL PRIMARY KEY,
    active_connections INTEGER NOT NULL,
    max_connections INTEGER NOT NULL,
    avg_query_time DECIMAL(10, 3) NOT NULL, -- milliseconds
    cache_hit_rate DECIMAL(5, 2) NOT NULL, -- percentage
    storage_used BIGINT NOT NULL, -- bytes
    storage_total BIGINT NOT NULL, -- bytes
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for database performance
CREATE INDEX idx_database_performance_timestamp ON database_performance(timestamp);

-- 5. Network Statistics Table
CREATE TABLE IF NOT EXISTS network_statistics (
    id SERIAL PRIMARY KEY,
    packets_per_second INTEGER NOT NULL,
    bandwidth_used BIGINT NOT NULL, -- bits per second
    dropped_packets_rate DECIMAL(5, 4) NOT NULL, -- percentage
    active_flows INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for network statistics
CREATE INDEX idx_network_statistics_timestamp ON network_statistics(timestamp);

-- 6. System Health Table
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    overall_status VARCHAR(20) CHECK (overall_status IN ('healthy', 'warning', 'critical')) NOT NULL,
    uptime_seconds BIGINT NOT NULL,
    last_restart TIMESTAMP WITH TIME ZONE NOT NULL,
    health_score INTEGER CHECK (health_score >= 0 AND health_score <= 100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for system health
CREATE INDEX idx_system_health_timestamp ON system_health(timestamp);

-- 7. Performance History (for charting)
CREATE TABLE IF NOT EXISTS performance_history (
    id SERIAL PRIMARY KEY,
    cpu_usage DECIMAL(5, 2) NOT NULL,
    memory_usage DECIMAL(5, 2) NOT NULL,
    disk_usage DECIMAL(5, 2) NOT NULL,
    network_load DECIMAL(5, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for performance history
CREATE INDEX idx_performance_history_timestamp ON performance_history(timestamp);

-- 8. Create views for easier querying

-- Latest system metrics view
CREATE OR REPLACE VIEW latest_system_metrics AS
SELECT DISTINCT ON (metric_name) 
    metric_name,
    metric_value,
    metric_unit,
    status,
    trend,
    timestamp
FROM system_metrics 
ORDER BY metric_name, timestamp DESC;

-- Active alerts view
CREATE OR REPLACE VIEW active_alerts AS
SELECT 
    alert_id,
    timestamp,
    severity,
    component,
    message,
    created_at
FROM performance_alerts 
WHERE resolved = FALSE
ORDER BY timestamp DESC;

-- Latest performance data view
CREATE OR REPLACE VIEW latest_performance AS
SELECT 
    (SELECT row_to_json(ml.*) FROM (
        SELECT * FROM ml_performance 
        ORDER BY timestamp DESC LIMIT 1
    ) ml) as ml_performance,
    
    (SELECT row_to_json(db.*) FROM (
        SELECT * FROM database_performance 
        ORDER BY timestamp DESC LIMIT 1
    ) db) as database_performance,
    
    (SELECT row_to_json(net.*) FROM (
        SELECT * FROM network_statistics 
        ORDER BY timestamp DESC LIMIT 1
    ) net) as network_statistics,
    
    (SELECT row_to_json(health.*) FROM (
        SELECT * FROM system_health 
        ORDER BY timestamp DESC LIMIT 1
    ) health) as system_health;

-- Functions for data cleanup (remove old data)
CREATE OR REPLACE FUNCTION cleanup_old_performance_data(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
    
    -- Clean up old system metrics
    DELETE FROM system_metrics WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up old performance history
    DELETE FROM performance_history WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Clean up old ML performance data
    DELETE FROM ml_performance WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Clean up old database performance data
    DELETE FROM database_performance WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Clean up old network statistics
    DELETE FROM network_statistics WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Clean up old system health data
    DELETE FROM system_health WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Clean up resolved alerts older than cutoff_date
    DELETE FROM performance_alerts 
    WHERE resolved = TRUE AND resolved_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample data for testing

-- Create a trigger to automatically update performance_history
CREATE OR REPLACE FUNCTION update_performance_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Only insert if it's been more than 1 minute since last entry
    IF NOT EXISTS (
        SELECT 1 FROM performance_history 
        WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 minute'
    ) THEN
        INSERT INTO performance_history (cpu_usage, memory_usage, disk_usage, network_load)
        SELECT 
            COALESCE((SELECT metric_value FROM latest_system_metrics WHERE metric_name = 'CPU Usage'), 0),
            COALESCE((SELECT metric_value FROM latest_system_metrics WHERE metric_name = 'Memory Usage'), 0),
            COALESCE((SELECT metric_value FROM latest_system_metrics WHERE metric_name = 'Disk Usage'), 0),
            COALESCE((SELECT metric_value FROM latest_system_metrics WHERE metric_name = 'Network Load'), 0);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trigger_update_performance_history
    AFTER INSERT ON system_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_performance_history();
-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================
