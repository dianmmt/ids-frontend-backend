# CICFlowMeter Integration Guide

This document describes the complete integration of CICFlowMeter with the SDN-IDS system, implementing the flow: **CICFlowMeter → DB → Model → Dashboard → Block**.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CICFlowMeter  │───▶│   Collector      │───▶│   Database      │
│   (CSV/Socket)  │    │   Service        │    │   (flows table) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   IP Analyzer   │◀───│   Pipeline       │◀───│   ML Inference  │
│   (Block IPs)   │    │   Processor      │    │   Service       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Ryu Controller│    │   Dashboard      │    │   Attack Logs   │
│   (Flow Rules)  │    │   (Real-time)    │    │   (Database)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Components

### 1. CICFlowMeter Collector Service
**File**: `backend/services/cicflowmeterCollector.js`

- **Purpose**: Collects flow data from CICFlowMeter output
- **Input Sources**:
  - CSV files (monitored for changes)
  - Socket connections (real-time data)
- **Output**: Saves to `flows` table in database
- **Features**:
  - Batch processing for performance
  - Automatic CSV file monitoring
  - Socket server for real-time data
  - Error handling and retry logic

### 2. Pipeline Processor Service
**File**: `backend/services/pipelineProcessor.js`

- **Purpose**: Processes unprocessed flows through ML models
- **Workflow**:
  1. Queries flows with `is_processed = false`
  2. Calls ML inference service for predictions
  3. Saves results to `attacks` table
  4. Marks flows as processed
- **Features**:
  - Cron-based processing
  - Batch processing
  - ML service integration
  - Comprehensive statistics

### 3. IP Analyzer Service
**File**: `backend/services/ipAnalyzer.js`

- **Purpose**: Analyzes attack patterns and blocks malicious IPs
- **Logic**:
  ```sql
  SELECT src_ip, COUNT(*)
  FROM attacks
  WHERE is_attack = true AND timestamp > NOW() - INTERVAL '10 minutes'
  GROUP BY src_ip
  HAVING COUNT(*) > 5;
  ```
- **Features**:
  - Automatic IP blocking via Ryu controller
  - Configurable thresholds
  - Auto-unblocking after time period
  - Whitelist support

### 4. ML Inference Service
**File**: `ml/inference_service.py`

- **Purpose**: REST API wrapper for ML model inference
- **Endpoints**:
  - `POST /predict` - Single flow prediction
  - `POST /predict/batch` - Batch predictions
  - `GET /health` - Health check
  - `GET /model/info` - Model information
- **Features**:
  - Supports both scikit-learn and TensorFlow models
  - Automatic preprocessing
  - Confidence scoring
  - Attack type classification

### 5. Service Orchestrator
**File**: `backend/services/serviceOrchestrator.js`

- **Purpose**: Manages all services lifecycle
- **Features**:
  - Service startup/shutdown coordination
  - Health monitoring
  - Statistics aggregation
  - Manual triggers

## 📊 Database Schema

### New Tables

#### `flows` Table
```sql
CREATE TABLE flows (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(100) UNIQUE NOT NULL,
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    -- ... 80+ CICFlowMeter features
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    flow_start_time TIMESTAMPTZ NOT NULL,
    captured_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

#### `attacks` Table
```sql
CREATE TABLE attacks (
    id BIGSERIAL PRIMARY KEY,
    flow_id VARCHAR(100) NOT NULL,
    src_ip INET NOT NULL,
    dst_ip INET NOT NULL,
    is_attack BOOLEAN NOT NULL,
    attack_type VARCHAR(100),
    confidence_score DECIMAL(5,4),
    severity VARCHAR(20),
    model_name VARCHAR(100),
    detected_at TIMESTAMPTZ NOT NULL
);
```

#### `blocked_ips` Table
```sql
CREATE TABLE blocked_ips (
    id BIGSERIAL PRIMARY KEY,
    ip_address INET NOT NULL,
    block_reason VARCHAR(100) NOT NULL,
    attack_count INTEGER NOT NULL,
    blocked_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);
```

## 🔧 Configuration

### Environment Variables

```bash
# CICFlowMeter Collector
CICFLOWMETER_CSV_PATH=/path/to/cicflowmeter.csv
CICFLOWMETER_SOCKET_PORT=9999
CICFLOWMETER_SOCKET_HOST=0.0.0.0
CICFLOWMETER_BATCH_SIZE=100

# Pipeline Processor
PIPELINE_BATCH_SIZE=50
PIPELINE_INTERVAL=30000  # 30 seconds

# IP Analyzer
IP_ANALYZER_INTERVAL=60000  # 1 minute
IP_ANALYZER_THRESHOLD=5     # 5 attacks
IP_ANALYZER_TIME_WINDOW=10  # 10 minutes
IP_ANALYZER_BLOCK_DURATION=24  # 24 hours

# ML Inference Service
INFERENCE_API_URL=http://inference-service:5000
INFERENCE_HOST=0.0.0.0
INFERENCE_PORT=5000
MODEL_FOLDER=/app
```

## 🚀 Getting Started

### 1. Database Setup
```bash
# Run the new migration
psql -U sdn_user -d sdn_ids -f database/init-scripts/07-cicflowmeter-integration.sql
```

### 2. Start Services
```bash
# Using Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Or manually start the backend
cd backend
npm install
npm start
```

### 3. Test the Integration

#### Test CICFlowMeter Collector
```bash
# Send test data via socket
echo "192.168.1.100,10.0.0.1,12345,80,TCP,10.5,100,50,50000,25000,500,100,500,50,250,50,250,25,1000,200,1000,500,5000,1000,500,200,5000,1000,500,200,1,0,0,0,20,20,9.5,4.8,500,100,500,50,0,1,0,10,90,0,0,0,500,450,50,192.168.1.100,10.0.0.1,12345,80,TCP,10.5,100,50,50000,25000,500,100,500,50,250,50,250,25,1000,200,1000,500,5000,1000,500,200,5000,1000,500,200,1,0,0,0,20,20,9.5,4.8,500,100,500,50,0,1,0,10,90,0,0,0,500,450,50" | nc localhost 9999
```

#### Test ML Inference
```bash
curl -X POST http://localhost:5001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "source_ip": "192.168.1.100",
    "destination_ip": "10.0.0.1",
    "source_port": 12345,
    "destination_port": 80,
    "protocol": "TCP",
    "packet_count": 100,
    "byte_count": 50000,
    "duration": 10.5,
    "packets_per_second": 9.5,
    "bytes_per_second": 4761.9
  }'
```

#### Test Pipeline Processing
```bash
# Trigger manual processing
curl -X POST http://localhost:3001/api/services/process-now
```

#### Test IP Blocking
```bash
# Check blocked IPs
curl http://localhost:3001/api/ip-analyzer/blocked-ips

# Manually block an IP
curl -X POST http://localhost:3001/api/ip-analyzer/block-ip \
  -H "Content-Type: application/json" \
  -d '{"ipAddress": "192.168.1.100", "reason": "Manual test block"}'
```

## 📈 API Endpoints

### CICFlowMeter Routes (`/api/cicflowmeter/`)
- `GET /stats` - Collector statistics
- `GET /flows` - List flows with pagination
- `GET /flows/:flowId` - Get specific flow
- `GET /top-ips` - Top source IPs by flow count
- `GET /protocol-stats` - Protocol statistics
- `POST /reset-processing` - Reset processing status
- `DELETE /cleanup` - Clean up old flows

### Pipeline Routes (`/api/pipeline/`)
- `GET /stats` - Processing statistics
- `GET /attacks` - List attacks with pagination
- `GET /attacks/:attackId` - Get specific attack
- `GET /attack-stats-by-ip` - Attack statistics by IP
- `GET /attack-types` - Attack type statistics
- `GET /severity-distribution` - Severity distribution
- `GET /timeline` - Attack timeline data
- `POST /process-now` - Trigger manual processing

### IP Analyzer Routes (`/api/ip-analyzer/`)
- `GET /stats` - Analyzer statistics
- `GET /blocked-ips` - List blocked IPs
- `GET /top-attacking-ips` - Top attacking IPs
- `GET /ip-details/:ipAddress` - IP details
- `POST /block-ip` - Manually block IP
- `POST /unblock-ip` - Manually unblock IP
- `POST /analyze-now` - Trigger manual analysis

### Service Management (`/api/services/`)
- `GET /status` - Service status
- `GET /stats` - Comprehensive statistics
- `POST /process-now` - Trigger processing
- `POST /restart/:serviceName` - Restart service

## 🔍 Monitoring and Debugging

### Service Status
```bash
# Check all services status
curl http://localhost:3001/api/services/status

# Get comprehensive statistics
curl http://localhost:3001/api/services/stats
```

### Database Queries
```sql
-- Check unprocessed flows
SELECT COUNT(*) FROM flows WHERE is_processed = false;

-- Check recent attacks
SELECT * FROM attacks WHERE detected_at > NOW() - INTERVAL '1 hour';

-- Check blocked IPs
SELECT * FROM blocked_ips WHERE is_active = true;

-- Check IP attack statistics
SELECT src_ip, COUNT(*) as attack_count
FROM attacks 
WHERE is_attack = true AND detected_at > NOW() - INTERVAL '24 hours'
GROUP BY src_ip
ORDER BY attack_count DESC;
```

### Logs
```bash
# Backend logs
docker logs sdn-ids-backend

# Inference service logs
docker logs sdn-ids-inference

# Database logs
docker logs sdn-ids-db
```

## 🛠️ Troubleshooting

### Common Issues

1. **CICFlowMeter not connecting**
   - Check socket port configuration
   - Verify CSV file path exists
   - Check firewall settings

2. **ML predictions failing**
   - Verify model files are present
   - Check inference service health
   - Review model compatibility

3. **IP blocking not working**
   - Check Ryu controller connection
   - Verify flow rule syntax
   - Check switch connectivity

4. **Database connection issues**
   - Verify database credentials
   - Check network connectivity
   - Review connection pool settings

### Performance Tuning

1. **Batch Size Optimization**
   ```bash
   # Increase batch size for better throughput
   export PIPELINE_BATCH_SIZE=100
   export CICFLOWMETER_BATCH_SIZE=200
   ```

2. **Processing Interval Tuning**
   ```bash
   # Reduce interval for faster processing
   export PIPELINE_INTERVAL=15000  # 15 seconds
   export IP_ANALYZER_INTERVAL=30000  # 30 seconds
   ```

3. **Database Optimization**
   ```sql
   -- Add indexes for better performance
   CREATE INDEX CONCURRENTLY idx_flows_processed ON flows(is_processed);
   CREATE INDEX CONCURRENTLY idx_attacks_detected_at ON attacks(detected_at);
   ```

## 📚 Additional Resources

- [CICFlowMeter Documentation](https://github.com/ahlashkari/CICFlowMeter)
- [Ryu Controller Documentation](https://ryu.readthedocs.io/)
- [PostgreSQL Performance Tuning](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [Docker Compose Best Practices](https://docs.docker.com/compose/production/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.


