-- ============================================================================
-- SAMPLE DATA INSERTION FOR SDN-IDS DATABASE
-- This script runs automatically after schema creation
-- ============================================================================

-- ============================================================================
-- 1. INSERT SAMPLE USERS
-- ============================================================================
INSERT INTO users (username, email, password_hash, role, full_name, status) VALUES
('admin', 'admin@sdn-ids.com', crypt('admin123', gen_salt('bf')), 'admin', 'System Administrator', 'active'),
('analyst1', 'analyst1@sdn-ids.com', crypt('analyst123', gen_salt('bf')), 'analyst', 'Security Analyst 1', 'active'),
('analyst2', 'analyst2@sdn-ids.com', crypt('analyst123', gen_salt('bf')), 'analyst', 'Security Analyst 2', 'active'),
('viewer1', 'viewer1@sdn-ids.com', crypt('viewer123', gen_salt('bf')), 'viewer', 'Network Viewer 1', 'active'),
('ml_engineer', 'ml@sdn-ids.com', crypt('ml123', gen_salt('bf')), 'analyst', 'ML Engineer', 'active')
ON CONFLICT (username) DO NOTHING;

-- ============================================================================
-- 2. INSERT SAMPLE NETWORK NODES
-- ============================================================================
INSERT INTO network_nodes (node_id, node_type, label, ip_address, status, port_count, position_x, position_y) VALUES
('c1', 'controller', 'Ryu Controller', '192.168.1.100', 'active', 0, 100, 100),
('s1', 'switch', 'Core Switch 1', '192.168.1.101', 'active', 24, 300, 100),
('s2', 'switch', 'Core Switch 2', '192.168.1.102', 'active', 24, 500, 100),
('s3', 'switch', 'Access Switch 1', '192.168.1.103', 'active', 48, 300, 300),
('s4', 'switch', 'Access Switch 2', '192.168.1.104', 'active', 48, 500, 300),
('h1', 'host', 'Web Server 1', '192.168.1.10', 'active', 0, 200, 400),
('h2', 'host', 'Web Server 2', '192.168.1.11', 'active', 0, 400, 400),
('h3', 'host', 'Database Server', '192.168.1.12', 'active', 0, 600, 400),
('h4', 'host', 'File Server', '192.168.1.13', 'active', 0, 400, 500),
('h5', 'host', 'DNS Server', '192.168.1.14', 'active', 0, 200, 500)
ON CONFLICT (node_id) DO NOTHING;

-- ============================================================================
-- 3. INSERT SAMPLE ML MODELS
-- ============================================================================
INSERT INTO ml_models (model_name, model_version, model_type, accuracy, precision_score, recall_score, f1_score, status, is_active, training_data_size, training_duration_seconds) VALUES
('RandomForest_IDS_v1', '1.0.0', 'Random Forest', 0.9456, 0.9234, 0.9567, 0.9398, 'active', true, 100000, 3600),
('NeuralNetwork_IDS_v1', '1.0.0', 'Neural Network', 0.9234, 0.9123, 0.9345, 0.9232, 'active', false, 100000, 7200),
('XGBoost_IDS_v1', '1.0.0', 'XGBoost', 0.9567, 0.9456, 0.9678, 0.9567, 'training', false, 100000, 1800),
('LSTM_Anomaly_v1', '1.0.0', 'LSTM', 0.9123, 0.9012, 0.9234, 0.9123, 'active', true, 50000, 10800)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. INSERT SAMPLE NETWORK FLOWS
-- ============================================================================
INSERT INTO network_flows (flow_id, switch_id, source_ip, destination_ip, source_port, destination_port, protocol, packet_count, byte_count, duration_seconds, packets_per_second, bytes_per_second, avg_packet_size, risk_score, flow_start_time) VALUES
('flow_001', 's1', '192.168.1.10', '192.168.1.11', 80, 443, 'TCP', 1500, 75000, 30.5, 49.18, 2459.02, 50.0, 0.1, NOW() - INTERVAL '1 hour'),
('flow_002', 's1', '192.168.1.12', '192.168.1.13', 3306, 22, 'TCP', 800, 40000, 45.2, 17.70, 885.02, 50.0, 0.2, NOW() - INTERVAL '2 hours'),
('flow_003', 's2', '192.168.1.14', '8.8.8.8', 53, 53, 'UDP', 200, 10000, 5.0, 40.00, 2000.00, 50.0, 0.05, NOW() - INTERVAL '30 minutes'),
('flow_004', 's3', '192.168.1.15', '192.168.1.16', 22, 22, 'TCP', 1200, 60000, 60.0, 20.00, 1000.00, 50.0, 0.3, NOW() - INTERVAL '3 hours'),
('flow_005', 's4', '10.0.0.100', '192.168.1.10', 80, 80, 'TCP', 5000, 250000, 120.0, 41.67, 2083.33, 50.0, 0.8, NOW() - INTERVAL '15 minutes'),
('flow_006', 's1', '192.168.1.20', '192.168.1.21', 443, 443, 'TCP', 3000, 150000, 90.0, 33.33, 1666.67, 50.0, 0.15, NOW() - INTERVAL '45 minutes'),
('flow_007', 's2', '172.16.0.50', '192.168.1.12', 3306, 3306, 'TCP', 2500, 125000, 75.0, 33.33, 1666.67, 50.0, 0.4, NOW() - INTERVAL '1 hour 30 minutes'),
('flow_008', 's3', '192.168.1.25', '8.8.4.4', 53, 53, 'UDP', 150, 7500, 3.0, 50.00, 2500.00, 50.0, 0.05, NOW() - INTERVAL '10 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. INSERT SAMPLE ATTACK DETECTIONS
-- ============================================================================
INSERT INTO attack_detections (detection_id, attack_type, severity, confidence_score, source_ip, destination_ip, source_port, destination_port, protocol, flow_id, switch_id, ml_model_id, detection_method, false_positive, analyst_notes) VALUES
('det_001', 'DDoS Attack', 'high', 0.89, '10.0.0.100', '192.168.1.10', 80, 80, 'TCP', 'flow_005', 's4', 1, 'ml', false, 'Confirmed DDoS attack from external network'),
('det_002', 'Port Scanning', 'medium', 0.76, '172.16.0.50', '192.168.1.12', 3306, 3306, 'TCP', 'flow_007', 's2', 1, 'rule-based', false, 'Suspicious port scanning activity'),
('det_003', 'SQL Injection Attempt', 'critical', 0.92, '192.168.1.25', '192.168.1.12', 80, 80, 'TCP', NULL, 's3', 1, 'ml', false, 'SQL injection payload detected in HTTP traffic'),
('det_004', 'Brute Force Attack', 'high', 0.85, '192.168.1.30', '192.168.1.14', 22, 22, 'TCP', NULL, 's3', 1, 'rule-based', false, 'Multiple failed SSH login attempts'),
('det_005', 'Data Exfiltration', 'critical', 0.94, '192.168.1.15', '8.8.8.8', 443, 443, 'TCP', NULL, 's1', 1, 'ml', false, 'Large data transfer to external destination')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. INSERT SAMPLE PERFORMANCE METRICS
-- ============================================================================
INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, node_id, component, recorded_at) VALUES
('cpu_usage', 25.5, 'percent', 'c1', 'controller', NOW() - INTERVAL '5 minutes'),
('memory_usage', 45.2, 'percent', 'c1', 'controller', NOW() - INTERVAL '5 minutes'),
('active_flows', 150, 'count', 's1', 'switch', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 15.8, 'percent', 's1', 'switch', NOW() - INTERVAL '5 minutes'),
('memory_usage', 32.1, 'percent', 's1', 'switch', NOW() - INTERVAL '5 minutes'),
('active_flows', 120, 'count', 's2', 'switch', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 18.3, 'percent', 's2', 'switch', NOW() - INTERVAL '5 minutes'),
('memory_usage', 28.7, 'percent', 's2', 'switch', NOW() - INTERVAL '5 minutes'),
('active_flows', 85, 'count', 's3', 'switch', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 12.4, 'percent', 's3', 'switch', NOW() - INTERVAL '5 minutes'),
('memory_usage', 25.9, 'percent', 's3', 'switch', NOW() - INTERVAL '5 minutes'),
('active_flows', 95, 'count', 's4', 'switch', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 14.2, 'percent', 's4', 'switch', NOW() - INTERVAL '5 minutes'),
('memory_usage', 27.3, 'percent', 's4', 'switch', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 8.5, 'percent', 'h1', 'host', NOW() - INTERVAL '5 minutes'),
('memory_usage', 18.7, 'percent', 'h1', 'host', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 12.3, 'percent', 'h2', 'host', NOW() - INTERVAL '5 minutes'),
('memory_usage', 22.4, 'percent', 'h2', 'host', NOW() - INTERVAL '5 minutes'),
('cpu_usage', 35.8, 'percent', 'h3', 'host', NOW() - INTERVAL '5 minutes'),
('memory_usage', 48.9, 'percent', 'h3', 'host', NOW() - INTERVAL '5 minutes')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. INSERT SAMPLE SECURITY RULES
-- ============================================================================
INSERT INTO security_rules (rule_name, rule_type, source_ip_range, destination_ip_range, source_port_range, destination_port_range, protocol, action, priority, description, created_by) VALUES
('Block External SSH', 'firewall', NULL, '192.168.1.0/24', NULL, '22', 'TCP', 'deny', 100, 'Block SSH access from external networks', (SELECT id FROM users WHERE username = 'admin')),
('Allow Internal HTTP', 'firewall', '192.168.1.0/24', '192.168.1.0/24', NULL, '80', 'TCP', 'allow', 200, 'Allow HTTP traffic within internal network', (SELECT id FROM users WHERE username = 'admin')),
('Block SQL Injection', 'ids', NULL, NULL, NULL, NULL, 'HTTP', 'alert', 50, 'Detect SQL injection patterns in HTTP traffic', (SELECT id FROM users WHERE username = 'admin')),
('Rate Limit External', 'ips', NULL, '192.168.1.0/24', NULL, NULL, NULL, 'block', 75, 'Rate limit external traffic to prevent DDoS', (SELECT id FROM users WHERE username = 'admin')),
('Monitor DNS Queries', 'ids', '192.168.1.0/24', NULL, NULL, '53', 'UDP', 'alert', 150, 'Monitor DNS queries for suspicious activity', (SELECT id FROM users WHERE username = 'admin'))
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. INSERT SAMPLE AUDIT LOGS
-- ============================================================================
INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent, action_time) VALUES
((SELECT id FROM users WHERE username = 'admin'), 'admin', 'CREATE_RULE', 'security_rules', '1', NULL, '{"rule_name": "Block External SSH"}', '192.168.1.100', 'pgAdmin/4.0', NOW() - INTERVAL '1 day'),
((SELECT id FROM users WHERE username = 'analyst1'), 'analyst1', 'UPDATE_DETECTION', 'attack_detections', '1', '{"severity": "medium"}', '{"severity": "high"}', '192.168.1.101', 'Web Browser', NOW() - INTERVAL '2 hours'),
((SELECT id FROM users WHERE username = 'analyst2'), 'analyst2', 'VIEW_TOPOLOGY', 'network_topology', NULL, NULL, NULL, '192.168.1.102', 'Web Browser', NOW() - INTERVAL '30 minutes'),
((SELECT id FROM users WHERE username = 'ml_engineer'), 'ml_engineer', 'DEPLOY_MODEL', 'ml_models', '1', '{"status": "training"}', '{"status": "active"}', '192.168.1.103', 'ML Service', NOW() - INTERVAL '1 hour'),
((SELECT id FROM users WHERE username = 'admin'), 'admin', 'DELETE_USER', 'users', '5', '{"username": "old_user"}', NULL, '192.168.1.100', 'pgAdmin/4.0', NOW() - INTERVAL '3 hours')
ON CONFLICT DO NOTHING;
INSERT INTO system_metrics (metric_name, metric_value, metric_unit, status, trend) VALUES
('CPU Usage', 78.5, '%', 'warning', 5.2),
('Memory Usage', 65.3, '%', 'normal', -2.1),
('Disk Usage', 42.7, '%', 'normal', 1.5),
('Network Load', 89.2, '%', 'critical', 15.3);

INSERT INTO performance_alerts (alert_id, timestamp, severity, component, message, resolved) VALUES
('alert_001', CURRENT_TIMESTAMP - INTERVAL '5 minutes', 'high', 'Network Interface', 'High network utilization detected (89%)', FALSE),
('alert_002', CURRENT_TIMESTAMP - INTERVAL '15 minutes', 'medium', 'CPU', 'CPU usage above threshold (78%)', FALSE),
('alert_003', CURRENT_TIMESTAMP - INTERVAL '30 minutes', 'low', 'ML Processing', 'Model inference time increased', TRUE);
-- ============================================================================
-- 9. INSERT SAMPLE ML PERFORMANCE
-- ============================================================================
INSERT INTO ml_performance (inference_speed, model_accuracy, processing_latency, queue_size, processed_today) VALUES
(1247, 94.7, 2.4, 127, 2300000);

INSERT INTO database_performance (active_connections, max_connections, avg_query_time, cache_hit_rate, storage_used, storage_total) VALUES
(45, 100, 12.4, 96.8, 2252431769, 10737418240);

INSERT INTO network_statistics (packets_per_second, bandwidth_used, dropped_packets_rate, active_flows) VALUES
(15420, 847000000, 0.0002, 1287);

INSERT INTO system_health (overall_status, uptime_seconds, last_restart, health_score) VALUES
('healthy', 1323780, CURRENT_TIMESTAMP - INTERVAL '15 days 7 hours 23 minutes', 92);

-- ============================================================================
-- UPDATE NETWORK NODES WITH PERFORMANCE DATA
-- ============================================================================
UPDATE network_nodes SET 
    cpu_usage = 25.5,
    memory_usage = 45.2,
    active_flows = 150
WHERE node_id = 'c1';

UPDATE network_nodes SET 
    cpu_usage = 15.8,
    memory_usage = 32.1,
    active_flows = 150
WHERE node_id = 's1';

UPDATE network_nodes SET 
    cpu_usage = 18.3,
    memory_usage = 28.7,
    active_flows = 120
WHERE node_id = 's2';

UPDATE network_nodes SET 
    cpu_usage = 12.4,
    memory_usage = 25.9,
    active_flows = 85
WHERE node_id = 's3';

UPDATE network_nodes SET 
    cpu_usage = 14.2,
    memory_usage = 27.3,
    active_flows = 95
WHERE node_id = 's4';

UPDATE network_nodes SET 
    cpu_usage = 8.5,
    memory_usage = 18.7,
    active_flows = 0
WHERE node_id = 'h1';

UPDATE network_nodes SET 
    cpu_usage = 12.3,
    memory_usage = 22.4,
    active_flows = 0
WHERE node_id = 'h2';

UPDATE network_nodes SET 
    cpu_usage = 35.8,
    memory_usage = 48.9,
    active_flows = 0
WHERE node_id = 'h3';

UPDATE network_nodes SET 
    cpu_usage = 0.0,
    memory_usage = 0.0,
    active_flows = 0
WHERE node_id = 'h4';

UPDATE network_nodes SET 
    cpu_usage = 0.0,
    memory_usage = 0.0,
    active_flows = 0
WHERE node_id = 'h5';

-- ============================================================================
-- SAMPLE DATA INSERTION COMPLETE
-- ============================================================================
