# SDN-IDS Database Description

## Overview
The SDN-IDS (Software-Defined Network Intrusion Detection System) uses a PostgreSQL database to store and manage all system data including user authentication, network topology, flow data, attack detections, ML models, and performance metrics.

## Database Architecture

### Core Tables

#### 1. **users** - User Management
**Purpose**: Manages user authentication, authorization, and profile information.

**Columns**:
- `id` (UUID, PK): Unique user identifier
- `username` (VARCHAR(50), UNIQUE): User login name
- `email` (VARCHAR(100), UNIQUE): User email address
- `password_hash` (VARCHAR(255)): Encrypted password
- `role` (VARCHAR(20)): User role ('admin', 'analyst', 'viewer')
- `status` (VARCHAR(20)): Account status ('active', 'inactive', 'suspended')
- `full_name` (VARCHAR(255)): User's full name
- `last_login` (TIMESTAMPTZ): Last login timestamp
- `created_at` (TIMESTAMPTZ): Account creation time

**Relationships**: Referenced by `audit_logs`, `security_rules`

#### 2. **network_nodes** - SDN Topology
**Purpose**: Stores information about SDN network devices (controllers, switches, hosts).

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `node_id` (VARCHAR(50), UNIQUE): Device identifier (s1, h1, c1)
- `node_type` (VARCHAR(20)): Device type ('controller', 'switch', 'host')
- `label` (VARCHAR(100)): Display name
- `ip_address` (INET): Device IP address
- `status` (VARCHAR(20)): Device status ('active', 'inactive', 'warning')
- `port_count` (INTEGER): Number of ports
- `position_x`, `position_y` (DECIMAL): UI coordinates for topology visualization
- `cpu_usage`, `memory_usage` (DECIMAL): Performance metrics
- `active_flows` (INTEGER): Current active flow count
- `last_seen` (TIMESTAMPTZ): Last activity timestamp
- `created_at` (TIMESTAMPTZ): Device registration time

**Relationships**: Referenced by `network_flows`, `attack_detections`, `performance_metrics`

#### 3. **network_flows** - Flow Data
**Purpose**: Stores real-time network flow data from Ryu controller for ML analysis.

**Columns**:
- `id` (BIGSERIAL, PK): Internal ID
- `flow_id` (VARCHAR(100)): Unique flow identifier
- `switch_id` (VARCHAR(50), FK): Reference to network_nodes
- `source_ip`, `destination_ip` (INET): Flow endpoints
- `source_port`, `destination_port` (INTEGER): Port numbers
- `protocol` (VARCHAR(20)): Network protocol (TCP, UDP, etc.)
- `packet_count`, `byte_count` (BIGINT): Flow statistics
- `duration_seconds` (DECIMAL): Flow duration
- `packets_per_second`, `bytes_per_second` (DECIMAL): Computed rates
- `avg_packet_size` (DECIMAL): Average packet size
- `risk_score` (DECIMAL): ML-computed risk score (0-1)
- `flow_start_time` (TIMESTAMPTZ): Flow initiation time
- `captured_at` (TIMESTAMPTZ): Data capture time

**Relationships**: References `network_nodes(switch_id)`

#### 4. **attack_events** - Unified Attack Detection
**Purpose**: Consolidated table for all attack detections (replaces legacy `attacks` and `attack_detections` tables).

**Columns**:
- `id` (BIGSERIAL, PK): Internal ID
- `event_id` (VARCHAR(120), UNIQUE): Unique event identifier
- `flow_id` (VARCHAR(100)): Associated flow ID
- `switch_id` (VARCHAR(50)): Switch where attack detected
- `src_ip`, `dst_ip` (INET): Attack endpoints
- `src_port`, `dst_port` (INTEGER): Port numbers
- `protocol` (VARCHAR(20)): Network protocol
- `is_attack` (BOOLEAN): Attack confirmation
- `attack_type` (VARCHAR(100)): Type of attack detected
- `confidence_score` (DECIMAL): ML confidence (0-1)
- `severity` (VARCHAR(20)): Severity level ('low', 'medium', 'high', 'critical')
- `model_name`, `model_version` (VARCHAR): ML model used
- `inference_time_ms` (DECIMAL): ML processing time
- `ml_model_id` (INTEGER, FK): Reference to ml_models
- `detection_method` (VARCHAR(50)): Detection method ('ml', 'rule-based', 'anomaly')
- `status` (VARCHAR(30)): Event status ('detected', 'blocked', 'resolved')
- `false_positive` (BOOLEAN): False positive flag
- `analyst_notes` (TEXT): Analyst comments
- `detected_at` (TIMESTAMPTZ): Detection timestamp
- `created_at` (TIMESTAMPTZ): Record creation time

**Relationships**: References `ml_models(id)`

#### 5. **ml_models** - ML Model Registry
**Purpose**: Manages machine learning models and their performance metrics.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `model_name` (VARCHAR(100)): Model name
- `model_version` (VARCHAR(20)): Version number
- `model_type` (VARCHAR(50)): Model type (RandomForest, Neural Network, etc.)
- `accuracy`, `precision_score`, `recall_score`, `f1_score` (DECIMAL): Performance metrics
- `status` (VARCHAR(20)): Model status ('training', 'active', 'deprecated')
- `is_active` (BOOLEAN): Active model flag
- `model_path` (TEXT): File system path
- `folder_path` (TEXT): Model folder path
- `training_data_size` (INTEGER): Training dataset size
- `training_duration_seconds` (INTEGER): Training time
- `created_at`, `updated_at` (TIMESTAMPTZ): Timestamps

**Relationships**: Referenced by `attack_events(ml_model_id)`

#### 6. **performance_metrics** - System Monitoring
**Purpose**: Stores system performance metrics for monitoring and alerting.

**Columns**:
- `id` (BIGSERIAL, PK): Internal ID
- `metric_name` (VARCHAR(100)): Metric identifier
- `metric_value` (DECIMAL(15,6)): Metric value
- `metric_unit` (VARCHAR(20)): Unit of measurement
- `node_id` (VARCHAR(50), FK): Associated network node
- `component` (VARCHAR(50)): System component ('controller', 'switch', 'host', 'system')
- `recorded_at` (TIMESTAMPTZ): Measurement time
- `created_at` (TIMESTAMPTZ): Record creation time

**Relationships**: References `network_nodes(node_id)`

#### 7. **security_rules** - Firewall/IDS Rules
**Purpose**: Manages security rules and policies.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `rule_name` (VARCHAR(100)): Rule identifier
- `rule_type` (VARCHAR(50)): Rule type ('firewall', 'ids', 'ips')
- `source_ip_range`, `destination_ip_range` (CIDR): IP ranges
- `source_port_range`, `destination_port_range` (VARCHAR(50)): Port ranges
- `protocol` (VARCHAR(20)): Network protocol
- `action` (VARCHAR(20)): Rule action ('allow', 'deny', 'alert', 'block')
- `priority` (INTEGER): Rule priority
- `is_active`, `is_enabled` (BOOLEAN): Rule status flags
- `description` (TEXT): Rule description
- `created_by` (UUID, FK): Creator user ID
- `created_at`, `updated_at` (TIMESTAMPTZ): Timestamps

**Relationships**: References `users(id)`

#### 8. **audit_logs** - System Activity Logs
**Purpose**: Comprehensive audit trail for all system activities.

**Columns**:
- `id` (BIGSERIAL, PK): Internal ID
- `user_id` (UUID, FK): User who performed action
- `username` (VARCHAR(50)): Username for quick reference
- `action` (VARCHAR(100)): Action performed
- `resource_type` (VARCHAR(50)): Type of resource affected
- `resource_id` (VARCHAR(100)): Resource identifier
- `old_values`, `new_values` (JSONB): Change tracking
- `ip_address` (INET): User IP address
- `user_agent` (TEXT): Browser/client information
- `action_time` (TIMESTAMPTZ): Action timestamp
- `created_at` (TIMESTAMPTZ): Log creation time

**Relationships**: References `users(id)`

### Performance Monitoring Tables

#### 9. **ml_performance** - ML Processing Metrics
**Purpose**: Tracks ML model performance and processing statistics.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `inference_speed` (INTEGER): Flows processed per second
- `model_accuracy` (DECIMAL(5,2)): Current model accuracy percentage
- `processing_latency` (DECIMAL(10,3)): Processing time in milliseconds
- `queue_size` (INTEGER): Pending processing queue size
- `processed_today` (BIGINT): Total flows processed today
- `timestamp` (TIMESTAMPTZ): Measurement time
- `created_at` (TIMESTAMPTZ): Record creation time

#### 10. **database_performance** - Database Metrics
**Purpose**: Monitors database performance and health.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `active_connections` (INTEGER): Current active connections
- `max_connections` (INTEGER): Maximum allowed connections
- `avg_query_time` (DECIMAL(10,3)): Average query execution time (ms)
- `cache_hit_rate` (DECIMAL(5,2)): Database cache hit rate percentage
- `storage_used` (BIGINT): Used storage in bytes
- `storage_total` (BIGINT): Total storage in bytes
- `timestamp` (TIMESTAMPTZ): Measurement time
- `created_at` (TIMESTAMPTZ): Record creation time

#### 11. **network_statistics** - Network Performance
**Purpose**: Tracks network-level performance metrics.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `packets_per_second` (INTEGER): Network packet rate
- `bandwidth_used` (BIGINT): Bandwidth utilization in bits per second
- `dropped_packets_rate` (DECIMAL(5,4)): Packet drop rate percentage
- `active_flows` (INTEGER): Current active flow count
- `timestamp` (TIMESTAMPTZ): Measurement time
- `created_at` (TIMESTAMPTZ): Record creation time

#### 12. **system_health** - Overall System Health
**Purpose**: Provides system-wide health status and metrics.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `overall_status` (VARCHAR(20)): System status ('healthy', 'warning', 'critical')
- `uptime_seconds` (BIGINT): System uptime in seconds
- `last_restart` (TIMESTAMPTZ): Last system restart time
- `health_score` (INTEGER): Overall health score (0-100)
- `timestamp` (TIMESTAMPTZ): Measurement time
- `created_at` (TIMESTAMPTZ): Record creation time

#### 13. **performance_alerts** - Performance Alerts
**Purpose**: Manages performance-related alerts and notifications.

**Columns**:
- `id` (SERIAL, PK): Internal ID
- `alert_id` (VARCHAR(50), UNIQUE): Unique alert identifier
- `timestamp` (TIMESTAMPTZ): Alert time
- `severity` (VARCHAR(20)): Alert severity ('low', 'medium', 'high')
- `component` (VARCHAR(100)): Affected system component
- `message` (TEXT): Alert description
- `resolved` (BOOLEAN): Resolution status
- `resolved_at` (TIMESTAMPTZ): Resolution time
- `resolved_by` (VARCHAR(100)): Who resolved the alert
- `created_at` (TIMESTAMPTZ): Record creation time

## Database Relationships

### Primary Relationships
1. **users** → **audit_logs** (one-to-many)
2. **users** → **security_rules** (one-to-many)
3. **network_nodes** → **network_flows** (one-to-many)
4. **network_nodes** → **attack_events** (one-to-many)
5. **network_nodes** → **performance_metrics** (one-to-many)
6. **ml_models** → **attack_events** (one-to-many)

### Data Flow Relationships
- **network_flows** → **attack_events**: Flow data analyzed by ML models to detect attacks
- **ml_models** → **attack_events**: ML models generate attack detections
- **performance_metrics** → **performance_alerts**: Metrics trigger alerts when thresholds exceeded

## Backend-Frontend Data Flow

### 1. **Authentication Flow**
```
Frontend → POST /api/auth/login → Backend → users table → JWT token → Frontend
```

### 2. **Real-time Attack Detection Flow**
```
Ryu Controller → Backend (packet_in events) → ML Prediction → attack_events table → SSE Stream → Frontend
```

### 3. **Network Topology Flow**
```
Ryu Controller → Backend → network_nodes table → GET /api/topology → Frontend
```

### 4. **Performance Monitoring Flow**
```
Backend Services → performance_metrics, ml_performance, database_performance, network_statistics, system_health tables → GET /api/performance/realtime → Frontend
```

### 5. **Model Management Flow**
```
Frontend → POST /api/models/upload → Backend → ml_models table → File System → Frontend
```

### 6. **Dashboard Data Flow**
```
Frontend → GET /api/dashboard/summary → Backend → Multiple tables (aggregated queries) → Frontend
```

## Key API Endpoints

### Authentication
- `POST /api/auth/login` - User authentication
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Attack Detection
- `GET /api/attacks` - List attack events with filtering
- `GET /api/attacks/stream` - Real-time attack stream (SSE)
- `POST /api/attacks/:id/block` - Block detected attack
- `GET /api/attacks/stats` - Attack statistics

### Network Management
- `GET /api/topology` - Network topology data
- `GET /api/flows` - Network flow data

### Performance Monitoring
- `GET /api/performance/realtime` - Real-time performance metrics
- `GET /api/performance/alerts` - Performance alerts

### Model Management
- `GET /api/models` - List available models
- `POST /api/models/upload` - Upload new model
- `POST /api/models/:id/select` - Select model for user

### Dashboard
- `GET /api/dashboard/summary` - Dashboard summary data

## Database Indexes

### Performance Indexes
- `idx_network_flows_switch_id` - Fast flow lookups by switch
- `idx_network_flows_source_ip` - Fast flow lookups by source IP
- `idx_attack_detections_detected_at` - Fast attack queries by time
- `idx_attack_detections_severity` - Fast attack filtering by severity
- `idx_performance_metrics_timestamp` - Fast performance queries by time

### Security Indexes
- `idx_audit_logs_user_id` - Fast audit log lookups by user
- `idx_audit_logs_action_time` - Fast audit log queries by time

## Data Retention and Cleanup

### Automatic Cleanup Functions
- **Performance Data**: 30-day retention (configurable)
- **Old Alerts**: Cleanup resolved alerts older than 30 days
- **Audit Logs**: Long-term retention for compliance

### Manual Cleanup
- Database maintenance scripts for old flow data
- Archive functions for historical attack data
- Performance optimization for large datasets

## Security Features

### Data Protection
- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control (RBAC)
- Comprehensive audit logging
- SQL injection prevention with parameterized queries

### Access Control
- Admin: Full system access
- Analyst: Attack analysis and model management
- Viewer: Read-only access to dashboards and reports

This database design supports a comprehensive SDN-based intrusion detection system with real-time monitoring, machine learning integration, and extensive performance tracking capabilities.
