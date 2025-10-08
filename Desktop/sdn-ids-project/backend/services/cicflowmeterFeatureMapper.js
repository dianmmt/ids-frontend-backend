// CICFlowMeter Feature Mapper
// Maps CICFlowMeter CSV headers to database column names and ML model features

export class CICFlowMeterFeatureMapper {
  constructor() {
    // Complete mapping from actual CICFlowMeter CSV headers to database columns
    this.csvToDbMapping = {
      // Basic flow identification
      'Protocol': 'protocol',
      'Flow Duration': 'flow_duration',
      'Src IP': 'src_ip',
      'Dst IP': 'dst_ip',
      'Src Port': 'src_port',
      'Dst Port': 'dst_port',
      
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

    // ML model feature order (77 features total) - INCLUDING Protocol as first feature
    this.mlFeatureOrder = [
      'protocol',                         // 1 - Protocol (TCP=6, UDP=17, etc.)
      'flow_duration',                    // 2 - Flow Duration
      'total_fwd_packets',                // 3 - Tot Fwd Pkts
      'total_backward_packets',           // 4 - Tot Bwd Pkts
      'total_length_of_fwd_packets',      // 5 - TotLen Fwd Pkts
      'total_length_of_bwd_packets',      // 6 - TotLen Bwd Pkts
      'fwd_packet_length_max',            // 7 - Fwd Pkt Len Max
      'fwd_packet_length_min',            // 8 - Fwd Pkt Len Min
      'fwd_packet_length_mean',           // 9 - Fwd Pkt Len Mean
      'fwd_packet_length_std',            // 10 - Fwd Pkt Len Std
      'bwd_packet_length_max',            // 11 - Bwd Pkt Len Max
      'bwd_packet_length_min',            // 12 - Bwd Pkt Len Min
      'bwd_packet_length_mean',           // 13 - Bwd Pkt Len Mean
      'bwd_packet_length_std',            // 14 - Bwd Pkt Len Std
      'flow_bytes_per_second',            // 15 - Flow Byts/s
      'flow_packets_per_second',          // 16 - Flow Pkts/s
      'flow_iat_mean',                    // 17 - Flow IAT Mean
      'flow_iat_std',                     // 18 - Flow IAT Std
      'flow_iat_max',                     // 19 - Flow IAT Max
      'flow_iat_min',                     // 20 - Flow IAT Min
      'fwd_iat_total',                    // 21 - Fwd IAT Tot
      'fwd_iat_mean',                     // 22 - Fwd IAT Mean
      'fwd_iat_std',                      // 23 - Fwd IAT Std
      'fwd_iat_max',                      // 24 - Fwd IAT Max
      'fwd_iat_min',                      // 25 - Fwd IAT Min
      'bwd_iat_total',                    // 26 - Bwd IAT Tot
      'bwd_iat_mean',                     // 27 - Bwd IAT Mean
      'bwd_iat_std',                      // 28 - Bwd IAT Std
      'bwd_iat_max',                      // 29 - Bwd IAT Max
      'bwd_iat_min',                      // 30 - Bwd IAT Min
      'fwd_psh_flags',                    // 31 - Fwd PSH Flags
      'bwd_psh_flags',                    // 32 - Bwd PSH Flags
      'fwd_urg_flags',                    // 33 - Fwd URG Flags
      'bwd_urg_flags',                    // 34 - Bwd URG Flags
      'fwd_header_length',                // 35 - Fwd Header Len
      'bwd_header_length',                // 36 - Bwd Header Len
      'fwd_packets_per_second',           // 37 - Fwd Pkts/s
      'bwd_packets_per_second',           // 38 - Bwd Pkts/s
      'packet_length_min',                // 39 - Pkt Len Min
      'packet_length_max',                // 40 - Pkt Len Max
      'packet_length_mean',               // 41 - Pkt Len Mean
      'packet_length_std',                // 42 - Pkt Len Std
      'packet_length_variance',           // 43 - Pkt Len Var
      'fin_flag_count',                   // 44 - FIN Flag Cnt
      'syn_flag_count',                   // 45 - SYN Flag Cnt
      'rst_flag_count',                   // 46 - RST Flag Cnt
      'psh_flag_count',                   // 47 - PSH Flag Cnt
      'ack_flag_count',                   // 48 - ACK Flag Cnt
      'urg_flag_count',                   // 49 - URG Flag Cnt
      'cwe_flag_count',                   // 50 - CWE Flag Count
      'ece_flag_count',                   // 51 - ECE Flag Cnt
      'down_up_ratio',                    // 52 - Down/Up Ratio
      'packet_size_avg',                  // 53 - Pkt Size Avg
      'fwd_segment_size_avg',             // 54 - Fwd Seg Size Avg
      'bwd_segment_size_avg',             // 55 - Bwd Seg Size Avg
      'fwd_bytes_per_byte_avg',           // 56 - Fwd Byts/b Avg
      'fwd_packets_per_byte_avg',         // 57 - Fwd Pkts/b Avg
      'fwd_block_rate_avg',               // 58 - Fwd Blk Rate Avg
      'bwd_bytes_per_byte_avg',           // 59 - Bwd Byts/b Avg
      'bwd_packets_per_byte_avg',         // 60 - Bwd Pkts/b Avg
      'bwd_block_rate_avg',               // 61 - Bwd Blk Rate Avg
      'subflow_fwd_packets',              // 62 - Subflow Fwd Pkts
      'subflow_fwd_bytes',                // 63 - Subflow Fwd Byts
      'subflow_bwd_packets',              // 64 - Subflow Bwd Pkts
      'subflow_bwd_bytes',                // 65 - Subflow Bwd Byts
      'init_fwd_win_bytes',               // 66 - Init Fwd Win Byts
      'init_bwd_win_bytes',               // 67 - Init Bwd Win Byts
      'fwd_act_data_packets',             // 68 - Fwd Act Data Pkts
      'fwd_segment_size_min',             // 69 - Fwd Seg Size Min
      'active_mean',                      // 70 - Active Mean
      'active_std',                       // 71 - Active Std
      'active_max',                       // 72 - Active Max
      'active_min',                       // 73 - Active Min
      'idle_mean',                        // 74 - Idle Mean
      'idle_std',                         // 75 - Idle Std
      'idle_max',                         // 76 - Idle Max
      'idle_min'                          // 77 - Idle Min
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
      let value = dbRow[featureName] || 0;
      
      // Special handling for protocol - ensure numeric (CICFlowMeter CSV already provides numeric values)
      if (featureName === 'protocol') {
        value = this.convertProtocolToNumeric(value);
      }
      
      features.push(this.convertToFloat(value));
    }
    
    return features;
  }

  /**
   * Convert protocol value to numeric (CICFlowMeter CSV already provides numeric values)
   * @param {string|number} protocol - Protocol value
   * @returns {number} Numeric protocol value
   */
  convertProtocolToNumeric(protocol) {
    // CICFlowMeter CSV already provides numeric protocol values (TCP=6, UDP=17, etc.)
    // Just ensure it's a number and provide fallback
    if (typeof protocol === 'number') {
      return protocol;
    }
    
    const numericProtocol = parseFloat(protocol);
    return isNaN(numericProtocol) ? 6 : numericProtocol; // Default to TCP (6) if invalid
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

    // ✅ Fix: parse timestamp từ định dạng DD/MM/YYYY hh:mm:ss AM/PM
    if (columnName === 'flow_start_time') {
      try {
        const [datePart, timePart, ampm] = value.split(' ');
        const [day, month, year] = datePart.split('/');
        let [hour, minute, second] = timePart.split(':').map(Number);

        if (ampm?.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0;

        const isoString = `${year}-${month}-${day} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;
        return isoString; // PostgreSQL hiểu được format này
      } catch (err) {
        console.warn('[Mapper] Failed to parse timestamp:', value);
        return null;
      }
    }

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
