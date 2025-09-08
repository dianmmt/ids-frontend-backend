-- ============================================================================
-- CICFlowMeter Integration Schema Updates
-- This script adds necessary columns and tables for CICFlowMeter integration
-- ============================================================================

-- Add is_processed column to network_flows table
ALTER TABLE network_flows ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT FALSE;

-- Add index for faster querying of unprocessed flows
CREATE INDEX IF NOT EXISTS idx_network_flows_is_processed ON network_flows(is_processed);

-- Create flows table specifically for CICFlowMeter data
CREATE TABLE IF NOT EXISTS flows (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(100) UNIQUE NOT NULL,
    
    -- CICFlowMeter features (subset of the 80+ features)
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol VARCHAR(20),
    
    -- Flow statistics
    flow_duration DECIMAL(15,6),
    total_fwd_packets INTEGER,
    total_backward_packets INTEGER,
    total_length_of_fwd_packets BIGINT,
    total_length_of_bwd_packets BIGINT,
    fwd_packet_length_max DECIMAL(10,3),
    fwd_packet_length_min DECIMAL(10,3),
    fwd_packet_length_mean DECIMAL(10,3),
    fwd_packet_length_std DECIMAL(10,3),
    bwd_packet_length_max DECIMAL(10,3),
    bwd_packet_length_min DECIMAL(10,3),
    bwd_packet_length_mean DECIMAL(10,3),
    bwd_packet_length_std DECIMAL(10,3),
    
    -- Flow timing features
    flow_bytes_per_second DECIMAL(15,6),
    flow_packets_per_second DECIMAL(12,6),
    flow_iat_mean DECIMAL(15,6),
    flow_iat_std DECIMAL(15,6),
    flow_iat_max DECIMAL(15,6),
    flow_iat_min DECIMAL(15,6),
    
    -- Forward/Backward features
    fwd_iat_total DECIMAL(15,6),
    fwd_iat_mean DECIMAL(15,6),
    fwd_iat_std DECIMAL(15,6),
    fwd_iat_max DECIMAL(15,6),
    fwd_iat_min DECIMAL(15,6),
    bwd_iat_total DECIMAL(15,6),
    bwd_iat_mean DECIMAL(15,6),
    bwd_iat_std DECIMAL(15,6),
    bwd_iat_max DECIMAL(15,6),
    bwd_iat_min DECIMAL(15,6),
    
    -- Protocol features
    fwd_psh_flags INTEGER,
    bwd_psh_flags INTEGER,
    fwd_urg_flags INTEGER,
    bwd_urg_flags INTEGER,
    fwd_header_length INTEGER,
    bwd_header_length INTEGER,
    fwd_packets_per_second DECIMAL(12,6),
    bwd_packets_per_second DECIMAL(12,6),
    
    -- Window size features
    min_packet_length DECIMAL(10,3),
    max_packet_length DECIMAL(10,3),
    packet_length_mean DECIMAL(10,3),
    packet_length_std DECIMAL(10,3),
    packet_length_variance DECIMAL(15,6),
    
    -- FIN, SYN, RST, PSH, ACK, URG flags
    fin_flag_count INTEGER,
    syn_flag_count INTEGER,
    rst_flag_count INTEGER,
    psh_flag_count INTEGER,
    ack_flag_count INTEGER,
    urg_flag_count INTEGER,
    cwe_flag_count INTEGER,
    ece_flag_count INTEGER,
    down_up_ratio INTEGER,
    average_packet_size DECIMAL(10,3),
    avg_fwd_segment_size DECIMAL(10,3),
    avg_bwd_segment_size DECIMAL(10,3),
    fwd_header_length_1 INTEGER,
    fwd_avg_bytes_per_bulk INTEGER,
    fwd_avg_packets_per_bulk INTEGER,
    fwd_avg_bulk_rate DECIMAL(10,3),
    bwd_avg_bytes_per_bulk INTEGER,
    bwd_avg_packets_per_bulk INTEGER,
    bwd_avg_bulk_rate DECIMAL(10,3),
    subflow_fwd_packets INTEGER,
    subflow_bwd_packets INTEGER,
    subflow_fwd_bytes BIGINT,
    subflow_bwd_bytes BIGINT,
    init_win_bytes_forward INTEGER,
    init_win_bytes_backward INTEGER,
    act_data_pkt_fwd INTEGER,
    min_seg_size_forward INTEGER,
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
    
    -- Timestamps
    flow_start_time TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for flows table
CREATE INDEX IF NOT EXISTS idx_flows_src_ip ON flows(src_ip);
CREATE INDEX IF NOT EXISTS idx_flows_dst_ip ON flows(dst_ip);
CREATE INDEX IF NOT EXISTS idx_flows_protocol ON flows(protocol);
CREATE INDEX IF NOT EXISTS idx_flows_captured_at ON flows(captured_at);
CREATE INDEX IF NOT EXISTS idx_flows_is_processed ON flows(is_processed);
CREATE INDEX IF NOT EXISTS idx_flows_flow_start_time ON flows(flow_start_time);

-- Create blocked_ips table for IP blocking logs
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

-- Create index for blocked_ips table
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON blocked_ips(blocked_at);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_is_active ON blocked_ips(is_active);

-- Create attacks table (if not exists) for ML prediction results
CREATE TABLE IF NOT EXISTS attacks (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(100) NOT NULL,
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    src_port INTEGER,
    dst_port INTEGER,
    protocol VARCHAR(20),
    
    -- ML prediction results
    is_attack BOOLEAN NOT NULL,
    attack_type VARCHAR(100),
    confidence_score DECIMAL(5,4),
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- ML model info
    model_name VARCHAR(100),
    model_version VARCHAR(20),
    inference_time_ms DECIMAL(10,3),
    
    -- Timestamps
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for attacks table
CREATE INDEX IF NOT EXISTS idx_attacks_flow_id ON attacks(flow_id);
CREATE INDEX IF NOT EXISTS idx_attacks_src_ip ON attacks(src_ip);
CREATE INDEX IF NOT EXISTS idx_attacks_dst_ip ON attacks(dst_ip);
CREATE INDEX IF NOT EXISTS idx_attacks_is_attack ON attacks(is_attack);
CREATE INDEX IF NOT EXISTS idx_attacks_detected_at ON attacks(detected_at);
CREATE INDEX IF NOT EXISTS idx_attacks_severity ON attacks(severity);

-- Create a view for easy querying of recent attacks
CREATE OR REPLACE VIEW recent_attacks AS
SELECT 
    a.*,
    f.flow_duration,
    f.total_fwd_packets,
    f.total_backward_packets,
    f.flow_bytes_per_second,
    f.flow_packets_per_second
FROM attacks a
LEFT JOIN flows f ON a.flow_id = f.flow_id
WHERE a.detected_at > NOW() - INTERVAL '1 hour'
ORDER BY a.detected_at DESC;

-- Create a view for IP attack statistics
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
FROM attacks 
WHERE is_attack = true 
    AND detected_at > NOW() - INTERVAL '24 hours'
GROUP BY src_ip
ORDER BY attack_count DESC;

-- Function to clean up old processed flows
CREATE OR REPLACE FUNCTION cleanup_old_flows(days_to_keep INTEGER DEFAULT 7)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    cutoff_date TIMESTAMPTZ;
BEGIN
    cutoff_date := CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;
    
    -- Delete old processed flows
    DELETE FROM flows WHERE is_processed = TRUE AND captured_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete old attacks
    DELETE FROM attacks WHERE detected_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    -- Delete old blocked IPs (inactive ones)
    DELETE FROM blocked_ips WHERE is_active = FALSE AND blocked_at < cutoff_date;
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIALIZATION COMPLETE
-- ============================================================================


