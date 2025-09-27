-- Migration script to add CICFlowMeter features to existing flows table
-- Run this script to update the database schema

-- Add missing CICFlowMeter features to flows table
ALTER TABLE flows 
ADD COLUMN IF NOT EXISTS fwd_packet_length_std DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS bwd_packet_length_std DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS flow_iat_max DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS flow_iat_min DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS fwd_iat_total DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS fwd_iat_std DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS fwd_iat_max DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS fwd_iat_min DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS bwd_iat_total DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS bwd_iat_std DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS bwd_iat_max DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS bwd_iat_min DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS fwd_psh_flags INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bwd_psh_flags INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fwd_urg_flags INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bwd_urg_flags INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS fwd_header_length INTEGER,
ADD COLUMN IF NOT EXISTS bwd_header_length INTEGER,
ADD COLUMN IF NOT EXISTS fwd_packets_per_second DECIMAL(12,6),
ADD COLUMN IF NOT EXISTS bwd_packets_per_second DECIMAL(12,6),
ADD COLUMN IF NOT EXISTS packet_length_min DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS packet_length_max DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS packet_length_mean DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS packet_length_std DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS packet_length_variance DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS cwe_flag_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ece_flag_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS down_up_ratio DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS packet_size_avg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS fwd_segment_size_avg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS bwd_segment_size_avg DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS fwd_bytes_per_byte_avg DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS fwd_packets_per_byte_avg DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS fwd_block_rate_avg DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS bwd_bytes_per_byte_avg DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS bwd_packets_per_byte_avg DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS bwd_block_rate_avg DECIMAL(10,6),
ADD COLUMN IF NOT EXISTS subflow_fwd_packets INTEGER,
ADD COLUMN IF NOT EXISTS subflow_fwd_bytes BIGINT,
ADD COLUMN IF NOT EXISTS subflow_bwd_packets INTEGER,
ADD COLUMN IF NOT EXISTS subflow_bwd_bytes BIGINT,
ADD COLUMN IF NOT EXISTS init_fwd_win_bytes INTEGER,
ADD COLUMN IF NOT EXISTS init_bwd_win_bytes INTEGER,
ADD COLUMN IF NOT EXISTS fwd_act_data_packets INTEGER,
ADD COLUMN IF NOT EXISTS fwd_segment_size_min DECIMAL(10,3),
ADD COLUMN IF NOT EXISTS active_mean DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS active_std DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS active_max DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS active_min DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS idle_mean DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS idle_std DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS idle_max DECIMAL(15,6),
ADD COLUMN IF NOT EXISTS idle_min DECIMAL(15,6);

-- Create indexes for better performance on new columns
CREATE INDEX IF NOT EXISTS idx_flows_fwd_packet_length_std ON flows(fwd_packet_length_std);
CREATE INDEX IF NOT EXISTS idx_flows_bwd_packet_length_std ON flows(bwd_packet_length_std);
CREATE INDEX IF NOT EXISTS idx_flows_flow_iat_max ON flows(flow_iat_max);
CREATE INDEX IF NOT EXISTS idx_flows_flow_iat_min ON flows(flow_iat_min);
CREATE INDEX IF NOT EXISTS idx_flows_fwd_iat_total ON flows(fwd_iat_total);
CREATE INDEX IF NOT EXISTS idx_flows_bwd_iat_total ON flows(bwd_iat_total);
CREATE INDEX IF NOT EXISTS idx_flows_packet_length_mean ON flows(packet_length_mean);
CREATE INDEX IF NOT EXISTS idx_flows_packet_length_std ON flows(packet_length_std);
CREATE INDEX IF NOT EXISTS idx_flows_cwe_flag_count ON flows(cwe_flag_count);
CREATE INDEX IF NOT EXISTS idx_flows_ece_flag_count ON flows(ece_flag_count);
CREATE INDEX IF NOT EXISTS idx_flows_down_up_ratio ON flows(down_up_ratio);
CREATE INDEX IF NOT EXISTS idx_flows_packet_size_avg ON flows(packet_size_avg);
CREATE INDEX IF NOT EXISTS idx_flows_active_mean ON flows(active_mean);
CREATE INDEX IF NOT EXISTS idx_flows_idle_mean ON flows(idle_mean);

-- Update the flows view to include new columns
CREATE OR REPLACE VIEW flows_view AS
SELECT 
    id,
    flow_id,
    switch_id,
    src_ip,
    dst_ip,
    src_port,
    dst_port,
    protocol,
    packet_count,
    byte_count,
    duration_seconds,
    
    -- Forward/Backward packet counts and lengths
    total_fwd_packets,
    total_backward_packets,
    total_length_of_fwd_packets,
    total_length_of_bwd_packets,
    
    -- Forward packet length features
    fwd_packet_length_max,
    fwd_packet_length_min,
    fwd_packet_length_mean,
    fwd_packet_length_std,
    
    -- Backward packet length features
    bwd_packet_length_max,
    bwd_packet_length_min,
    bwd_packet_length_mean,
    bwd_packet_length_std,
    
    -- Flow rate features
    flow_bytes_per_second,
    flow_packets_per_second,
    
    -- Flow IAT features
    flow_iat_mean,
    flow_iat_std,
    flow_iat_max,
    flow_iat_min,
    
    -- Forward IAT features
    fwd_iat_total,
    fwd_iat_mean,
    fwd_iat_std,
    fwd_iat_max,
    fwd_iat_min,
    
    -- Backward IAT features
    bwd_iat_total,
    bwd_iat_mean,
    bwd_iat_std,
    bwd_iat_max,
    bwd_iat_min,
    
    -- Protocol flags
    fwd_psh_flags,
    bwd_psh_flags,
    fwd_urg_flags,
    bwd_urg_flags,
    
    -- Header length features
    fwd_header_length,
    bwd_header_length,
    
    -- Forward/Backward packet rates
    fwd_packets_per_second,
    bwd_packets_per_second,
    
    -- Packet length statistics
    packet_length_min,
    packet_length_max,
    packet_length_mean,
    packet_length_std,
    packet_length_variance,
    
    -- TCP flags
    fin_flag_count,
    syn_flag_count,
    rst_flag_count,
    psh_flag_count,
    ack_flag_count,
    urg_flag_count,
    cwe_flag_count,
    ece_flag_count,
    
    -- Flow ratios and averages
    down_up_ratio,
    packet_size_avg,
    fwd_segment_size_avg,
    bwd_segment_size_avg,
    
    -- Forward flow features
    fwd_bytes_per_byte_avg,
    fwd_packets_per_byte_avg,
    fwd_block_rate_avg,
    
    -- Backward flow features
    bwd_bytes_per_byte_avg,
    bwd_packets_per_byte_avg,
    bwd_block_rate_avg,
    
    -- Subflow features
    subflow_fwd_packets,
    subflow_fwd_bytes,
    subflow_bwd_packets,
    subflow_bwd_bytes,
    
    -- Window size features
    init_fwd_win_bytes,
    init_bwd_win_bytes,
    fwd_act_data_packets,
    fwd_segment_size_min,
    
    -- Active/Idle time features
    active_mean,
    active_std,
    active_max,
    active_min,
    idle_mean,
    idle_std,
    idle_max,
    idle_min,
    
    -- Processing status
    is_processed,
    processed_at,
    risk_score,
    flow_start_time,
    captured_at
FROM flows;

-- Add comments to document the new columns
COMMENT ON COLUMN flows.fwd_packet_length_std IS 'Standard deviation of forward packet lengths';
COMMENT ON COLUMN flows.bwd_packet_length_std IS 'Standard deviation of backward packet lengths';
COMMENT ON COLUMN flows.flow_iat_max IS 'Maximum inter-arrival time for the flow';
COMMENT ON COLUMN flows.flow_iat_min IS 'Minimum inter-arrival time for the flow';
COMMENT ON COLUMN flows.fwd_iat_total IS 'Total forward inter-arrival time';
COMMENT ON COLUMN flows.bwd_iat_total IS 'Total backward inter-arrival time';
COMMENT ON COLUMN flows.cwe_flag_count IS 'Congestion Window Reduced flag count';
COMMENT ON COLUMN flows.ece_flag_count IS 'ECN-Echo flag count';
COMMENT ON COLUMN flows.down_up_ratio IS 'Ratio of download to upload traffic';
COMMENT ON COLUMN flows.packet_size_avg IS 'Average packet size';
COMMENT ON COLUMN flows.active_mean IS 'Mean active time';
COMMENT ON COLUMN flows.idle_mean IS 'Mean idle time';
-- Note: This migration was for the old attacks table which has been replaced by attack_events
-- The attack_events table already has the necessary columns
-- Print success message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully. Added all CICFlowMeter features to flows table.';
END $$;
