-- Migration: Add blocked_ips table for IP blocking functionality
-- This table stores IP addresses that have been blocked due to excessive DOS attacks

-- Create blocked_ips table
CREATE TABLE IF NOT EXISTS blocked_ips (
    id SERIAL PRIMARY KEY,
    ip_address INET NOT NULL UNIQUE,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    blocked_by VARCHAR(50) DEFAULT 'system',
    reason TEXT NOT NULL,
    dos_attack_count INTEGER NOT NULL DEFAULT 0,
    time_window_hours INTEGER NOT NULL DEFAULT 24,
    is_active BOOLEAN DEFAULT TRUE,
    unblocked_at TIMESTAMP WITH TIME ZONE NULL,
    unblocked_by VARCHAR(50) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster IP lookups
CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip_address ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_active ON blocked_ips(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON blocked_ips(blocked_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blocked_ips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blocked_ips_updated_at
    BEFORE UPDATE ON blocked_ips
    FOR EACH ROW
    EXECUTE FUNCTION update_blocked_ips_updated_at();

-- Create view for active blocked IPs
CREATE OR REPLACE VIEW active_blocked_ips AS
SELECT 
    id,
    ip_address,
    blocked_at,
    blocked_by,
    reason,
    dos_attack_count,
    time_window_hours,
    notes,
    created_at,
    updated_at
FROM blocked_ips 
WHERE is_active = TRUE;

-- Insert some example data (optional - for testing)
-- INSERT INTO blocked_ips (ip_address, reason, dos_attack_count, time_window_hours, blocked_by) 
-- VALUES 
--     ('192.168.1.100', 'Excessive DOS attacks detected', 15, 24, 'system'),
--     ('10.0.0.50', 'Multiple DOS attempts in short time', 8, 12, 'system')
-- ON CONFLICT (ip_address) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE blocked_ips IS 'Stores IP addresses that have been blocked due to security violations';
COMMENT ON COLUMN blocked_ips.ip_address IS 'The IP address that was blocked';
COMMENT ON COLUMN blocked_ips.blocked_at IS 'When the IP was first blocked';
COMMENT ON COLUMN blocked_ips.blocked_by IS 'Who/what blocked the IP (system, admin, etc.)';
COMMENT ON COLUMN blocked_ips.reason IS 'Reason for blocking the IP';
COMMENT ON COLUMN blocked_ips.dos_attack_count IS 'Number of DOS attacks that triggered the block';
COMMENT ON COLUMN blocked_ips.time_window_hours IS 'Time window in hours for counting attacks';
COMMENT ON COLUMN blocked_ips.is_active IS 'Whether the block is currently active';
COMMENT ON COLUMN blocked_ips.unblocked_at IS 'When the IP was unblocked (if applicable)';
COMMENT ON COLUMN blocked_ips.unblocked_by IS 'Who unblocked the IP (if applicable)';
COMMENT ON COLUMN blocked_ips.notes IS 'Additional notes about the blocking decision';


