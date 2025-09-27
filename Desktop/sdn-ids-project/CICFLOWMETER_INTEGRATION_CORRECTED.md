# CICFlowMeter Integration Guide - Corrected Feature Mapping (77 Features)

## Overview

This document provides the corrected and comprehensive integration guide for CICFlowMeter features in the SDN-IDS system. The system now properly maps all **77 CICFlowMeter features** to the database schema and ML models.

## CICFlowMeter Feature List (77 Features)

The following are the complete CICFlowMeter features that will be fed into the ML models for attack detection:

### Basic Flow Information (2 features)
1. **Protocol** - Network protocol (TCP, UDP, ICMP, etc.)
2. **Flow Duration** - Duration of the flow in seconds

### Forward/Backward Packet Counts and Lengths (4 features)
3. **Tot Fwd Pkts** - Total number of forward packets
4. **Tot Bwd Pkts** - Total number of backward packets
5. **TotLen Fwd Pkts** - Total length of forward packets in bytes
6. **TotLen Bwd Pkts** - Total length of backward packets in bytes

### Forward Packet Length Features (4 features)
7. **Fwd Pkt Len Max** - Maximum forward packet length
8. **Fwd Pkt Len Min** - Minimum forward packet length
9. **Fwd Pkt Len Mean** - Mean forward packet length
10. **Fwd Pkt Len Std** - Standard deviation of forward packet lengths

### Backward Packet Length Features (4 features)
11. **Bwd Pkt Len Max** - Maximum backward packet length
12. **Bwd Pkt Len Min** - Minimum backward packet length
13. **Bwd Pkt Len Mean** - Mean backward packet length
14. **Bwd Pkt Len Std** - Standard deviation of backward packet lengths

### Flow Rate Features (2 features)
15. **Flow Byts/s** - Flow bytes per second
16. **Flow Pkts/s** - Flow packets per second

### Flow Inter-Arrival Time (IAT) Features (4 features)
17. **Flow IAT Mean** - Mean inter-arrival time
18. **Flow IAT Std** - Standard deviation of inter-arrival times
19. **Flow IAT Max** - Maximum inter-arrival time
20. **Flow IAT Min** - Minimum inter-arrival time

### Forward IAT Features (5 features)
21. **Fwd IAT Tot** - Total forward inter-arrival time
22. **Fwd IAT Mean** - Mean forward inter-arrival time
23. **Fwd IAT Std** - Standard deviation of forward inter-arrival times
24. **Fwd IAT Max** - Maximum forward inter-arrival time
25. **Fwd IAT Min** - Minimum forward inter-arrival time

### Backward IAT Features (5 features)
26. **Bwd IAT Tot** - Total backward inter-arrival time
27. **Bwd IAT Mean** - Mean backward inter-arrival time
28. **Bwd IAT Std** - Standard deviation of backward inter-arrival times
29. **Bwd IAT Max** - Maximum backward inter-arrival time
30. **Bwd IAT Min** - Minimum backward inter-arrival time

### Header Length Features (2 features)
31. **Fwd Header Len** - Forward header length
32. **Bwd Header Len** - Backward header length

### Packet Rate Features (2 features)
33. **Fwd Pkts/s** - Forward packets per second
34. **Bwd Pkts/s** - Backward packets per second

### Packet Length Statistics (5 features)
35. **Pkt Len Min** - Minimum packet length
36. **Pkt Len Max** - Maximum packet length
37. **Pkt Len Mean** - Mean packet length
38. **Pkt Len Std** - Standard deviation of packet lengths
39. **Pkt Len Var** - Variance of packet lengths

### Packet Size Average (1 feature)
40. **Pkt Size Avg** - Average packet size

### Active Time Features (4 features)
41. **Active Mean** - Mean active time
42. **Active Std** - Standard deviation of active times
43. **Active Max** - Maximum active time
44. **Active Min** - Minimum active time

### Protocol Flags (4 features)
31. **Fwd PSH Flags** - Forward PSH flag count
32. **Bwd PSH Flags** - Backward PSH flag count
33. **Fwd URG Flags** - Forward URG flag count
34. **Bwd URG Flags** - Backward URG flag count

### Header Length Features (2 features)
35. **Fwd Header Len** - Forward header length
36. **Bwd Header Len** - Backward header length

### Packet Rate Features (2 features)
37. **Fwd Pkts/s** - Forward packets per second
38. **Bwd Pkts/s** - Backward packets per second

### Packet Length Statistics (5 features)
39. **Pkt Len Min** - Minimum packet length
40. **Pkt Len Max** - Maximum packet length
41. **Pkt Len Mean** - Mean packet length
42. **Pkt Len Std** - Standard deviation of packet lengths
43. **Pkt Len Var** - Variance of packet lengths

### TCP Flag Counts (8 features)
44. **FIN Flag Cnt** - FIN flag count
45. **SYN Flag Cnt** - SYN flag count
46. **RST Flag Cnt** - RST flag count
47. **PSH Flag Cnt** - PSH flag count
48. **ACK Flag Cnt** - ACK flag count
49. **URG Flag Cnt** - URG flag count
50. **CWE Flag Count** - Congestion Window Reduced flag count
51. **ECE Flag Cnt** - ECN-Echo flag count

### Flow Ratios and Averages (4 features)
52. **Down/Up Ratio** - Download to upload ratio
53. **Pkt Size Avg** - Average packet size
54. **Fwd Seg Size Avg** - Average forward segment size
55. **Bwd Seg Size Avg** - Average backward segment size

### Forward Flow Features (3 features)
56. **Fwd Byts/b Avg** - Average forward bytes per bulk
57. **Fwd Pkts/b Avg** - Average forward packets per bulk
58. **Fwd Blk Rate Avg** - Average forward bulk rate

### Backward Flow Features (3 features)
59. **Bwd Byts/b Avg** - Average backward bytes per bulk
60. **Bwd Pkts/b Avg** - Average backward packets per bulk
61. **Bwd Blk Rate Avg** - Average backward bulk rate

### Subflow Features (4 features)
62. **Subflow Fwd Pkts** - Subflow forward packets
63. **Subflow Fwd Byts** - Subflow forward bytes
64. **Subflow Bwd Pkts** - Subflow backward packets
65. **Subflow Bwd Byts** - Subflow backward bytes

### Window Size Features (4 features)
66. **Init Fwd Win Byts** - Initial forward window bytes
67. **Init Bwd Win Byts** - Initial backward window bytes
68. **Fwd Act Data Pkts** - Forward active data packets
69. **Fwd Seg Size Min** - Minimum forward segment size

### Active Time Features (4 features)
70. **Active Mean** - Mean active time
71. **Active Std** - Standard deviation of active times
72. **Active Max** - Maximum active time
73. **Active Min** - Minimum active time

### Idle Time Features (4 features)
74. **Idle Mean** - Mean idle time
75. **Idle Std** - Standard deviation of idle times
76. **Idle Max** - Maximum idle time
77. **Idle Min** - Minimum idle time

**Total: 77 features** - Complete CICFlowMeter feature set for ML model training and inference.

## Database Schema Mapping

The database schema in `flows` table includes all 84 CICFlowMeter features with proper data types:

```sql
-- Basic flow identification
src_ip INET NOT NULL,
dst_ip INET NOT NULL,
src_port INTEGER,
dst_port INTEGER,
protocol VARCHAR(20) NOT NULL,
duration_seconds DECIMAL(15,6),

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

-- Flow IAT features
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
idle_min DECIMAL(15,6)
```

## Feature Mapping Implementation

### 1. CICFlowMeter Feature Mapper (`cicflowmeterFeatureMapper.js`)

The feature mapper handles the conversion between:
- CICFlowMeter CSV headers → Database column names
- Database rows → ML model input arrays (84 features)

### 2. Updated CICFlowMeter Collector (`cicflowmeterCollector.js`)

The collector now uses the feature mapper to:
- Parse CSV data using proper header mapping
- Convert CSV rows to database format
- Handle all 84 features correctly

### 3. Updated ML Predictors

All ML predictors now use the feature mapper to:
- Convert database rows to ML input format
- Ensure consistent feature ordering
- Handle missing or invalid values

## ML Model Integration

### Feature Array Order (77 Features)

The ML models expect features in this exact order:

```javascript
const mlFeatureOrder = [
  'flow_duration',                    // 1
  'total_fwd_packets',                // 2
  'total_backward_packets',           // 3
  'total_length_of_fwd_packets',      // 4
  'total_length_of_bwd_packets',      // 5
  'fwd_packet_length_max',            // 6
  'fwd_packet_length_min',            // 7
  'fwd_packet_length_mean',           // 8
  'fwd_packet_length_std',            // 9
  'bwd_packet_length_max',            // 10
  'bwd_packet_length_min',            // 11
  'bwd_packet_length_mean',           // 12
  'bwd_packet_length_std',            // 13
  'flow_bytes_per_second',            // 14
  'flow_packets_per_second',          // 15
  'flow_iat_mean',                    // 16
  'flow_iat_std',                     // 17
  'flow_iat_max',                     // 18
  'flow_iat_min',                     // 19
  'fwd_iat_total',                    // 20
  'fwd_iat_mean',                     // 21
  'fwd_iat_std',                      // 22
  'fwd_iat_max',                      // 23
  'fwd_iat_min',                      // 24
  'bwd_iat_total',                    // 25
  'bwd_iat_mean',                     // 26
  'bwd_iat_std',                      // 27
  'bwd_iat_max',                      // 28
  'bwd_iat_min',                      // 29
  'fwd_psh_flags',                    // 30
  'bwd_psh_flags',                    // 31
  'fwd_urg_flags',                    // 32
  'bwd_urg_flags',                    // 33
  'fwd_header_length',                // 34
  'bwd_header_length',                // 35
  'fwd_packets_per_second',           // 36
  'bwd_packets_per_second',           // 37
  'packet_length_min',                // 38
  'packet_length_max',                // 39
  'packet_length_mean',               // 40
  'packet_length_std',                // 41
  'packet_length_variance',           // 42
  'fin_flag_count',                   // 43
  'syn_flag_count',                   // 44
  'rst_flag_count',                   // 45
  'psh_flag_count',                   // 46
  'ack_flag_count',                   // 47
  'urg_flag_count',                   // 48
  'cwe_flag_count',                   // 49
  'ece_flag_count',                   // 50
  'down_up_ratio',                    // 51
  'packet_size_avg',                  // 52
  'fwd_segment_size_avg',             // 53
  'bwd_segment_size_avg',             // 54
  'fwd_bytes_per_byte_avg',           // 55
  'fwd_packets_per_byte_avg',         // 56
  'fwd_block_rate_avg',               // 57
  'bwd_bytes_per_byte_avg',           // 58
  'bwd_packets_per_byte_avg',         // 59
  'bwd_block_rate_avg',               // 60
  'subflow_fwd_packets',              // 61
  'subflow_fwd_bytes',                // 62
  'subflow_bwd_packets',              // 63
  'subflow_bwd_bytes',                // 64
  'init_fwd_win_bytes',               // 65
  'init_bwd_win_bytes',               // 66
  'fwd_act_data_packets',             // 67
  'fwd_segment_size_min',             // 68
  'active_mean',                      // 69
  'active_std',                       // 70
  'active_max',                       // 71
  'active_min',                       // 72
  'idle_mean',                        // 73
  'idle_std',                         // 74
  'idle_max',                         // 75
  'idle_min'                          // 76
];
```

## Usage Examples

### 1. Processing CICFlowMeter CSV Data

```javascript
import CICFlowMeterCollector from './services/cicflowmeterCollector.js';

const collector = new CICFlowMeterCollector({
  csvDirectory: '/path/to/cicflowmeter/output',
  csvPattern: '*_Flow.csv'
});

await collector.start();
```

### 2. Using Feature Mapper Directly

```javascript
import CICFlowMeterFeatureMapper from './services/cicflowmeterFeatureMapper.js';

const mapper = new CICFlowMeterFeatureMapper();

// Convert CSV row to database format
const csvRow = {
  'Protocol': 'TCP',
  'Flow Duration': '1.5',
  'Tot Fwd Pkts': '10',
  // ... other features
};

const dbData = mapper.mapCsvToDatabase(csvRow);

// Convert database row to ML input
const mlFeatures = mapper.mapDatabaseToML(dbData);
```

### 3. ML Prediction with Correct Features

```javascript
import MLPredictor from './services/mlPredictor.js';

const predictor = new MLPredictor(userId);

// Database row with all 84 features
const flowData = await getFlowFromDatabase(flowId);

// Predict attack using correct feature mapping
const prediction = await predictor.predictAttack(flowData);
```

## Validation and Testing

### Feature Validation

```javascript
const mapper = new CICFlowMeterFeatureMapper();
const validation = mapper.validateFeatures(flowData);

if (!validation.isValid) {
  console.log('Missing features:', validation.missingFeatures);
  console.log('Present features:', validation.presentFeatures);
}
```

### Testing CICFlowMeter Integration

```bash
# Test CSV processing
node ml/cicflowmeter_test.py

# Test complete integration
node ml/complete_cicflowmeter_test.py

# Test ML prediction
node ml/test_random_forest_model.py
```

## Configuration

### Environment Variables

```bash
# CICFlowMeter CSV settings
CICFLOWMETER_CSV_DIRECTORY=/path/to/csv/files
CICFLOWMETER_CSV_PATTERN=*_Flow.csv
CICFLOWMETER_SOCKET_PORT=9999
CICFLOWMETER_SOCKET_HOST=localhost
CICFLOWMETER_BATCH_SIZE=100
CICFLOWMETER_POLL_INTERVAL=5000

# ML Service URLs
DYNAMIC_INFERENCE_API_URL=http://dynamic-inference-service:5000
INFERENCE_API_URL=http://inference-service:5000
ML_API_URL=http://ml-service:5000
```

## Troubleshooting

### Common Issues

1. **Feature Count Mismatch**: Ensure all 84 features are present
2. **Data Type Errors**: Check decimal precision for numeric fields
3. **Missing Values**: Handle null/undefined values with defaults
4. **Feature Order**: Maintain consistent ordering for ML models

### Debug Commands

```javascript
// Check feature mapping
console.log('CICFlowMeter features:', mapper.getCICFlowMeterFeatures());
console.log('ML feature order:', mapper.getMLFeatureOrder());

// Validate data
const validation = mapper.validateFeatures(data);
console.log('Validation result:', validation);
```

## Performance Considerations

1. **Batch Processing**: Process flows in batches of 100-1000
2. **Caching**: Use feature mapper caching for repeated conversions
3. **Database Indexing**: Index frequently queried features
4. **Memory Management**: Handle large datasets with streaming

## Security Considerations

1. **Input Validation**: Validate all CICFlowMeter data before processing
2. **SQL Injection**: Use parameterized queries for database operations
3. **Data Sanitization**: Clean and normalize feature values
4. **Access Control**: Implement proper authentication for ML services

This corrected integration ensures that all 84 CICFlowMeter features are properly mapped, processed, and fed into the ML models for accurate attack detection.
