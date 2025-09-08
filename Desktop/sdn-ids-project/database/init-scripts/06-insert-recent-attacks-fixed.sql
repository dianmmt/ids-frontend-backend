-- ============================================================================
-- INSERT RECENT ATTACK EVENTS FOR DASHBOARD DEMONSTRATION (FIXED VERSION)
-- This script adds recent attack events with proper status and flow data
-- ============================================================================

-- Insert recent attack events (last 24 hours)
INSERT INTO attack_detections (
    detection_id, attack_type, severity, confidence_score,
    source_ip, destination_ip, source_port, destination_port,
    protocol, flow_id, switch_id, detected_at, 
    false_positive, analyst_notes, status, packet_count, byte_count, detection_method
) VALUES
-- Recent DDoS attacks
('det_006', 'DDoS Attack', 'critical', 0.95, '203.0.113.45', '192.168.1.10', 80, 80, 'TCP', 'flow_ddos_001', 's4', NOW() - INTERVAL '2 hours', false, 'Large-scale DDoS attack from external network', 'detected', 15000, 750000, 'ml'),
('det_007', 'DDoS Attack', 'high', 0.88, '198.51.100.23', '192.168.1.11', 443, 443, 'TCP', 'flow_ddos_002', 's4', NOW() - INTERVAL '3 hours', false, 'DDoS attack targeting web server', 'blocked', 8000, 400000, 'ml'),

-- Recent port scanning attempts
('det_008', 'Port Scanning', 'medium', 0.82, '192.168.1.50', '192.168.1.12', 22, 22, 'TCP', 'flow_scan_001', 's3', NOW() - INTERVAL '1 hour', false, 'Port scan targeting database server', 'detected', 500, 25000, 'rule-based'),
('det_009', 'Port Scanning', 'medium', 0.79, '192.168.1.51', '192.168.1.13', 80, 80, 'TCP', 'flow_scan_002', 's3', NOW() - INTERVAL '45 minutes', false, 'Port scan on file server', 'detected', 300, 15000, 'rule-based'),
('det_010', 'Port Scanning', 'high', 0.85, '10.0.0.200', '192.168.1.14', 53, 53, 'UDP', 'flow_scan_003', 's1', NOW() - INTERVAL '30 minutes', false, 'DNS port scan from external network', 'blocked', 200, 10000, 'rule-based'),

-- Recent SQL injection attempts
('det_011', 'SQL Injection Attempt', 'critical', 0.93, '192.168.1.60', '192.168.1.12', 80, 80, 'TCP', 'flow_sql_001', 's3', NOW() - INTERVAL '1 hour 30 minutes', false, 'SQL injection payload in HTTP request', 'detected', 25, 1250, 'ml'),
('det_012', 'SQL Injection Attempt', 'critical', 0.91, '192.168.1.61', '192.168.1.10', 80, 80, 'TCP', 'flow_sql_002', 's4', NOW() - INTERVAL '2 hours 15 minutes', false, 'Multiple SQL injection attempts detected', 'blocked', 45, 2250, 'ml'),

-- Recent brute force attacks
('det_013', 'Brute Force Attack', 'high', 0.87, '192.168.1.70', '192.168.1.14', 22, 22, 'TCP', 'flow_brute_001', 's1', NOW() - INTERVAL '1 hour 45 minutes', false, 'SSH brute force attack on DNS server', 'detected', 150, 7500, 'rule-based'),
('det_014', 'Brute Force Attack', 'medium', 0.76, '192.168.1.71', '192.168.1.13', 22, 22, 'TCP', 'flow_brute_002', 's3', NOW() - INTERVAL '2 hours 30 minutes', false, 'SSH brute force on file server', 'investigating', 80, 4000, 'rule-based'),

-- Recent malware/ransomware attempts
('det_015', 'Malware Communication', 'high', 0.89, '192.168.1.80', '8.8.8.8', 443, 443, 'TCP', 'flow_malware_001', 's1', NOW() - INTERVAL '45 minutes', false, 'Suspicious communication to external DNS', 'detected', 200, 10000, 'ml'),
('det_016', 'Ransomware Activity', 'critical', 0.96, '192.168.1.81', '192.168.1.13', 445, 445, 'TCP', 'flow_ransom_001', 's3', NOW() - INTERVAL '1 hour', false, 'Ransomware attempting to encrypt file server', 'blocked', 1000, 50000, 'ml'),

-- Recent data exfiltration attempts
('det_017', 'Data Exfiltration', 'critical', 0.94, '192.168.1.90', '1.2.3.4', 443, 443, 'TCP', 'flow_exfil_001', 's1', NOW() - INTERVAL '30 minutes', false, 'Large data transfer to suspicious external IP', 'detected', 5000, 250000, 'ml'),
('det_018', 'Data Exfiltration', 'high', 0.86, '192.168.1.91', '5.6.7.8', 80, 80, 'TCP', 'flow_exfil_002', 's2', NOW() - INTERVAL '1 hour 15 minutes', false, 'Suspicious data upload to external server', 'blocked', 2000, 100000, 'ml'),

-- Recent lateral movement attempts
('det_019', 'Lateral Movement', 'high', 0.83, '192.168.1.100', '192.168.1.12', 3389, 3389, 'TCP', 'flow_lateral_001', 's3', NOW() - INTERVAL '2 hours', false, 'Attempted RDP connection to database server', 'detected', 50, 2500, 'rule-based'),
('det_020', 'Lateral Movement', 'medium', 0.78, '192.168.1.101', '192.168.1.10', 5985, 5985, 'TCP', 'flow_lateral_002', 's4', NOW() - INTERVAL '1 hour 30 minutes', false, 'WinRM connection attempt to web server', 'investigating', 30, 1500, 'rule-based'),

-- Recent zero-day exploit attempts
('det_021', 'Zero-Day Exploit', 'critical', 0.97, '203.0.113.100', '192.168.1.11', 80, 80, 'TCP', 'flow_zero_001', 's4', NOW() - INTERVAL '15 minutes', false, 'Unknown exploit pattern detected', 'detected', 75, 3750, 'ml'),
('det_022', 'Zero-Day Exploit', 'critical', 0.95, '198.51.100.200', '192.168.1.10', 443, 443, 'TCP', 'flow_zero_002', 's4', NOW() - INTERVAL '25 minutes', false, 'Suspicious payload targeting web application', 'blocked', 120, 6000, 'ml'),

-- Recent botnet communication
('det_023', 'Botnet Communication', 'high', 0.88, '192.168.1.110', '192.168.1.1', 53, 53, 'UDP', 'flow_botnet_001', 's1', NOW() - INTERVAL '20 minutes', false, 'Botnet C&C communication detected', 'detected', 100, 5000, 'ml'),
('det_024', 'Botnet Communication', 'medium', 0.74, '192.168.1.111', '8.8.4.4', 53, 53, 'UDP', 'flow_botnet_002', 's1', NOW() - INTERVAL '35 minutes', false, 'Suspicious DNS queries to external servers', 'investigating', 80, 4000, 'ml'),

-- Recent APT (Advanced Persistent Threat) activity
('det_025', 'APT Activity', 'critical', 0.98, '192.168.1.120', '192.168.1.12', 1433, 1433, 'TCP', 'flow_apt_001', 's3', NOW() - INTERVAL '10 minutes', false, 'Advanced persistent threat targeting database', 'detected', 200, 10000, 'ml'),
('det_026', 'APT Activity', 'critical', 0.96, '192.168.1.121', '192.168.1.13', 445, 445, 'TCP', 'flow_apt_002', 's3', NOW() - INTERVAL '5 minutes', false, 'APT attempting to access file shares', 'blocked', 150, 7500, 'ml'),

-- Recent cryptomining activity
('det_027', 'Cryptomining', 'medium', 0.81, '192.168.1.130', '192.168.1.10', 80, 80, 'TCP', 'flow_crypto_001', 's4', NOW() - INTERVAL '40 minutes', false, 'Cryptocurrency mining activity detected', 'detected', 500, 25000, 'ml'),
('det_028', 'Cryptomining', 'low', 0.69, '192.168.1.131', '192.168.1.11', 443, 443, 'TCP', 'flow_crypto_002', 's4', NOW() - INTERVAL '50 minutes', false, 'Suspicious mining pool communication', 'investigating', 300, 15000, 'ml'),

-- Recent IoT device compromise
('det_029', 'IoT Compromise', 'high', 0.85, '192.168.1.140', '192.168.1.1', 23, 23, 'TCP', 'flow_iot_001', 's1', NOW() - INTERVAL '1 hour 20 minutes', false, 'IoT device compromised and communicating with C&C', 'detected', 80, 4000, 'ml'),
('det_030', 'IoT Compromise', 'medium', 0.77, '192.168.1.141', '192.168.1.2', 8080, 8080, 'TCP', 'flow_iot_002', 's1', NOW() - INTERVAL '1 hour 40 minutes', false, 'Suspicious IoT device behavior detected', 'investigating', 60, 3000, 'ml'),

-- Insert some very recent attacks (last 5 minutes) for real-time demonstration
('det_031', 'DDoS Attack', 'critical', 0.92, '203.0.113.150', '192.168.1.10', 80, 80, 'TCP', 'flow_recent_001', 's4', NOW() - INTERVAL '2 minutes', false, 'Ongoing DDoS attack - high packet rate', 'detected', 2000, 100000, 'ml'),
('det_032', 'Port Scanning', 'medium', 0.80, '192.168.1.200', '192.168.1.12', 3306, 3306, 'TCP', 'flow_recent_002', 's3', NOW() - INTERVAL '1 minute', false, 'Active port scan on database server', 'detected', 100, 5000, 'rule-based'),
('det_033', 'SQL Injection Attempt', 'critical', 0.94, '192.168.1.201', '192.168.1.10', 80, 80, 'TCP', 'flow_recent_003', 's4', NOW() - INTERVAL '30 seconds', false, 'SQL injection payload detected in real-time', 'detected', 5, 250, 'ml'),
('det_034', 'Brute Force Attack', 'high', 0.88, '192.168.1.202', '192.168.1.14', 22, 22, 'TCP', 'flow_recent_004', 's1', NOW() - INTERVAL '45 seconds', false, 'SSH brute force in progress', 'detected', 20, 1000, 'rule-based'),
('det_035', 'Malware Communication', 'high', 0.86, '192.168.1.203', '8.8.8.8', 443, 443, 'TCP', 'flow_recent_005', 's1', NOW() - INTERVAL '15 seconds', false, 'Suspicious external communication detected', 'detected', 50, 2500, 'ml')

ON CONFLICT (detection_id) DO NOTHING;

-- Create some network flows for the recent attacks
INSERT INTO network_flows (
    flow_id, switch_id, source_ip, destination_ip, source_port, destination_port,
    protocol, packet_count, byte_count, duration_seconds, packets_per_second,
    bytes_per_second, avg_packet_size, risk_score, flow_start_time
) VALUES
('flow_recent_001', 's4', '203.0.113.150', '192.168.1.10', 80, 80, 'TCP', 2000, 100000, 120.0, 16.67, 833.33, 50.0, 0.9, NOW() - INTERVAL '2 minutes'),
('flow_recent_002', 's3', '192.168.1.200', '192.168.1.12', 3306, 3306, 'TCP', 100, 5000, 60.0, 1.67, 83.33, 50.0, 0.7, NOW() - INTERVAL '1 minute'),
('flow_recent_003', 's4', '192.168.1.201', '192.168.1.10', 80, 80, 'TCP', 5, 250, 5.0, 1.00, 50.00, 50.0, 0.8, NOW() - INTERVAL '30 seconds'),
('flow_recent_004', 's1', '192.168.1.202', '192.168.1.14', 22, 22, 'TCP', 20, 1000, 45.0, 0.44, 22.22, 50.0, 0.6, NOW() - INTERVAL '45 seconds'),
('flow_recent_005', 's1', '192.168.1.203', '8.8.8.8', 443, 443, 'TCP', 50, 2500, 15.0, 3.33, 166.67, 50.0, 0.7, NOW() - INTERVAL '15 seconds')
ON CONFLICT DO NOTHING;

-- Update network nodes with current performance data
UPDATE network_nodes SET 
    cpu_usage = 35.2,
    memory_usage = 52.8,
    active_flows = 180,
    last_seen = NOW()
WHERE node_id = 'c1';

UPDATE network_nodes SET 
    cpu_usage = 28.5,
    memory_usage = 45.3,
    active_flows = 200,
    last_seen = NOW()
WHERE node_id = 's1';

UPDATE network_nodes SET 
    cpu_usage = 32.1,
    memory_usage = 48.7,
    active_flows = 175,
    last_seen = NOW()
WHERE node_id = 's2';

UPDATE network_nodes SET 
    cpu_usage = 25.8,
    memory_usage = 42.1,
    active_flows = 150,
    last_seen = NOW()
WHERE node_id = 's3';

UPDATE network_nodes SET 
    cpu_usage = 38.4,
    memory_usage = 55.2,
    active_flows = 220,
    last_seen = NOW()
WHERE node_id = 's4';

-- Insert recent performance metrics
INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, node_id, component, recorded_at) VALUES
('cpu_usage', 35.2, 'percent', 'c1', 'controller', NOW()),
('memory_usage', 52.8, 'percent', 'c1', 'controller', NOW()),
('active_flows', 180, 'count', 'c1', 'controller', NOW()),
('cpu_usage', 28.5, 'percent', 's1', 'switch', NOW()),
('memory_usage', 45.3, 'percent', 's1', 'switch', NOW()),
('active_flows', 200, 'count', 's1', 'switch', NOW()),
('cpu_usage', 32.1, 'percent', 's2', 'switch', NOW()),
('memory_usage', 48.7, 'percent', 's2', 'switch', NOW()),
('active_flows', 175, 'count', 's2', 'switch', NOW()),
('cpu_usage', 25.8, 'percent', 's3', 'switch', NOW()),
('memory_usage', 42.1, 'percent', 's3', 'switch', NOW()),
('active_flows', 150, 'count', 's3', 'switch', NOW()),
('cpu_usage', 38.4, 'percent', 's4', 'switch', NOW()),
('memory_usage', 55.2, 'percent', 's4', 'switch', NOW()),
('active_flows', 220, 'count', 's4', 'switch', NOW())
ON CONFLICT DO NOTHING;

-- Insert recent performance alerts
INSERT INTO performance_alerts (alert_id, timestamp, severity, component, message, resolved) VALUES
('alert_004', NOW() - INTERVAL '10 minutes', 'high', 'Network Interface', 'High packet rate detected (15,000 pps)', FALSE),
('alert_005', NOW() - INTERVAL '5 minutes', 'medium', 'CPU', 'CPU usage spike on switch s4 (38.4%)', FALSE),
('alert_006', NOW() - INTERVAL '2 minutes', 'high', 'Security', 'Multiple critical attacks detected simultaneously', FALSE),
('alert_007', NOW() - INTERVAL '1 minute', 'high', 'Memory', 'Memory usage above threshold on controller (52.8%)', FALSE)
ON CONFLICT DO NOTHING;

-- Update ML performance metrics
INSERT INTO ml_performance (inference_speed, model_accuracy, processing_latency, queue_size, processed_today) VALUES
(1850, 96.2, 1.8, 45, 2450000)
ON CONFLICT DO NOTHING;

-- Update database performance metrics
INSERT INTO database_performance (active_connections, max_connections, avg_query_time, cache_hit_rate, storage_used, storage_total) VALUES
(52, 100, 8.7, 98.1, 2356789123, 10737418240)
ON CONFLICT DO NOTHING;

-- Update network statistics
INSERT INTO network_statistics (packets_per_second, bandwidth_used, dropped_packets_rate, active_flows) VALUES
(18500, 1250000000, 0.0005, 1520)
ON CONFLICT DO NOTHING;

-- Update system health
INSERT INTO system_health (overall_status, uptime_seconds, last_restart, health_score) VALUES
('warning', 1323780, CURRENT_TIMESTAMP - INTERVAL '15 days 7 hours 23 minutes', 78)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- RECENT ATTACK EVENTS INSERTION COMPLETE
-- ============================================================================
