// CICFlowMeter Feature Mapper
// Maps CICFlowMeter CSV headers to database column names and ML model features

export class CICFlowMeterFeatureMapper {
  constructor() {
    // Complete mapping from CICFlowMeter CSV headers to database columns (77 features)
    this.csvToDbMapping = {
      // Basic flow identification
      'Protocol': 'protocol',
      'Flow Duration': 'duration_seconds',
      
      // Forward/Backward packet counts and lengths
      'Tot Fwd Pkts': 'total_fwd_packets',
      'Tot Bwd Pkts': 'total_backward_packets',
      'TotLen Fwd Pkts': 'total_length_of_fwd_packets',
      'TotLen Bwd Pkts': 'total_length_of_bwd_packets',
      
      // Forward packet length features
      'Fwd Pkt Len Max': 'fwd_packet_length_max',
      'Fwd Pkt Len Min': 'fwd_packet_length_min',
      'Fwd Pkt Len Mean': 'fwd_packet_length_mean',
      'Fwd Pkt Len Std': 'fwd_packet_length_std',
      
      // Backward packet length features
      'Bwd Pkt Len Max': 'bwd_packet_length_max',
      'Bwd Pkt Len Min': 'bwd_packet_length_min',
      'Bwd Pkt Len Mean': 'bwd_packet_length_mean',
      'Bwd Pkt Len Std': 'bwd_packet_length_std',
      
      // Flow rate features
      'Flow Byts/s': 'flow_bytes_per_second',
      'Flow Pkts/s': 'flow_packets_per_second',
      
      // Flow IAT (Inter-Arrival Time) features
      'Flow IAT Mean': 'flow_iat_mean',
      'Flow IAT Std': 'flow_iat_std',
      'Flow IAT Max': 'flow_iat_max',
      'Flow IAT Min': 'flow_iat_min',
      
      // Forward IAT features
      'Fwd IAT Tot': 'fwd_iat_total',
      'Fwd IAT Mean': 'fwd_iat_mean',
      'Fwd IAT Std': 'fwd_iat_std',
      'Fwd IAT Max': 'fwd_iat_max',
      'Fwd IAT Min': 'fwd_iat_min',
      
      // Backward IAT features
      'Bwd IAT Tot': 'bwd_iat_total',
      'Bwd IAT Mean': 'bwd_iat_mean',
      'Bwd IAT Std': 'bwd_iat_std',
      'Bwd IAT Max': 'bwd_iat_max',
      'Bwd IAT Min': 'bwd_iat_min',
      
      // Protocol flags
      'Fwd PSH Flags': 'fwd_psh_flags',
      'Bwd PSH Flags': 'bwd_psh_flags',
      'Fwd URG Flags': 'fwd_urg_flags',
      'Bwd URG Flags': 'bwd_urg_flags',
      
      // Header length features
      'Fwd Header Len': 'fwd_header_length',
      'Bwd Header Len': 'bwd_header_length',
      
      // Forward/Backward packet rates
      'Fwd Pkts/s': 'fwd_packets_per_second',
      'Bwd Pkts/s': 'bwd_packets_per_second',
      
      // Packet length statistics
      'Pkt Len Min': 'packet_length_min',
      'Pkt Len Max': 'packet_length_max',
      'Pkt Len Mean': 'packet_length_mean',
      'Pkt Len Std': 'packet_length_std',
      'Pkt Len Var': 'packet_length_variance',
      
      // TCP flags
      'FIN Flag Cnt': 'fin_flag_count',
      'SYN Flag Cnt': 'syn_flag_count',
      'RST Flag Cnt': 'rst_flag_count',
      'PSH Flag Cnt': 'psh_flag_count',
      'ACK Flag Cnt': 'ack_flag_count',
      'URG Flag Cnt': 'urg_flag_count',
      'CWE Flag Count': 'cwe_flag_count',
      'ECE Flag Cnt': 'ece_flag_count',
      
      // Flow ratios and averages
      'Down/Up Ratio': 'down_up_ratio',
      'Pkt Size Avg': 'packet_size_avg',
      'Fwd Seg Size Avg': 'fwd_segment_size_avg',
      'Bwd Seg Size Avg': 'bwd_segment_size_avg',
      
      // Forward flow features
      'Fwd Byts/b Avg': 'fwd_bytes_per_byte_avg',
      'Fwd Pkts/b Avg': 'fwd_packets_per_byte_avg',
      'Fwd Blk Rate Avg': 'fwd_block_rate_avg',
      
      // Backward flow features
      'Bwd Byts/b Avg': 'bwd_bytes_per_byte_avg',
      'Bwd Pkts/b Avg': 'bwd_packets_per_byte_avg',
      'Bwd Blk Rate Avg': 'bwd_block_rate_avg',
      
      // Subflow features
      'Subflow Fwd Pkts': 'subflow_fwd_packets',
      'Subflow Fwd Byts': 'subflow_fwd_bytes',
      'Subflow Bwd Pkts': 'subflow_bwd_packets',
      'Subflow Bwd Byts': 'subflow_bwd_bytes',
      
      // Window size features
      'Init Fwd Win Byts': 'init_fwd_win_bytes',
      'Init Bwd Win Byts': 'init_bwd_win_bytes',
      'Fwd Act Data Pkts': 'fwd_act_data_packets',
      'Fwd Seg Size Min': 'fwd_segment_size_min',
      
      // Active/Idle time features
      'Active Mean': 'active_mean',
      'Active Std': 'active_std',
      'Active Max': 'active_max',
      'Active Min': 'active_min',
      'Idle Mean': 'idle_mean',
      'Idle Std': 'idle_std',
      'Idle Max': 'idle_max',
      'Idle Min': 'idle_min'
    };

    // ML model feature order (77 features total)
    this.mlFeatureOrder = [
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
      'fwd_header_length',               // 34
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
      'fwd_bytes_per_byte_avg',          // 55
      'fwd_packets_per_byte_avg',         // 56
      'fwd_block_rate_avg',               // 57
      'bwd_bytes_per_byte_avg',           // 58
      'bwd_packets_per_byte_avg',         // 59
      'bwd_block_rate_avg',               // 60
      'subflow_fwd_packets',              // 61
      'subflow_fwd_bytes',                // 62
      'subflow_bwd_packets',              // 63
      'subflow_bwd_bytes',                // 64
      'init_fwd_win_bytes',              // 65
      'init_bwd_win_bytes',              // 66
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
  }

  /**
   * Map CICFlowMeter CSV row to database format
   * @param {Object} csvRow - Raw CSV row data
   * @returns {Object} Mapped data for database insertion
   */
  mapCsvToDatabase(csvRow) {
    const mappedData = {};
    
    // Map each CSV column to database column
    for (const [csvHeader, dbColumn] of Object.entries(this.csvToDbMapping)) {
      if (csvRow[csvHeader] !== undefined) {
        mappedData[dbColumn] = this.convertValue(csvRow[csvHeader], dbColumn);
      }
    }
    
    return mappedData;
  }

  /**
   * Map database row to ML model input format
   * @param {Object} dbRow - Database row data
   * @returns {Array} Feature array for ML model (77 features)
   */
  mapDatabaseToML(dbRow) {
    const features = [];
    
    for (const featureName of this.mlFeatureOrder) {
      const value = dbRow[featureName] || 0;
      features.push(this.convertToFloat(value));
    }
    
    return features;
  }

  /**
   * Convert CSV value to appropriate database type
   * @param {any} value - Raw value from CSV
   * @param {string} columnName - Database column name
   * @returns {any} Converted value
   */
  convertValue(value, columnName) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    // Convert to appropriate type based on column name
    if (columnName.includes('_count') || columnName.includes('_flags') || 
        columnName.includes('_packets') || columnName.includes('_bytes') ||
        columnName.includes('_length')) {
      return parseInt(value) || 0;
    }
    
    if (columnName.includes('_mean') || columnName.includes('_std') || 
        columnName.includes('_max') || columnName.includes('_min') ||
        columnName.includes('_avg') || columnName.includes('_ratio') ||
        columnName.includes('_rate') || columnName.includes('_seconds')) {
      return parseFloat(value) || 0.0;
    }
    
    return value;
  }

  /**
   * Convert value to float for ML model
   * @param {any} value - Input value
   * @returns {number} Float value
   */
  convertToFloat(value) {
    if (value === null || value === undefined || value === '') {
      return 0.0;
    }
    
    const floatValue = parseFloat(value);
    return isNaN(floatValue) ? 0.0 : floatValue;
  }

  /**
   * Get the complete list of CICFlowMeter features
   * @returns {Array} List of feature names
   */
  getCICFlowMeterFeatures() {
    return Object.keys(this.csvToDbMapping);
  }

  /**
   * Get the ML model feature order
   * @returns {Array} Ordered list of ML features
   */
  getMLFeatureOrder() {
    return [...this.mlFeatureOrder];
  }

  /**
   * Validate that all required features are present
   * @param {Object} data - Data to validate
   * @returns {Object} Validation result
   */
  validateFeatures(data) {
    const missingFeatures = [];
    const presentFeatures = [];
    
    for (const feature of this.mlFeatureOrder) {
      if (data[feature] === undefined || data[feature] === null) {
        missingFeatures.push(feature);
      } else {
        presentFeatures.push(feature);
      }
    }
    
    return {
      isValid: missingFeatures.length === 0,
      missingFeatures,
      presentFeatures,
      totalFeatures: this.mlFeatureOrder.length,
      presentCount: presentFeatures.length,
      missingCount: missingFeatures.length
    };
  }
}

export default CICFlowMeterFeatureMapper;
