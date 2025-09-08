// backend/services/mlPredictor.js - ML Prediction Service
import axios from 'axios';

export class MLPredictor {
  constructor(userId = null) {
    // Use dynamic inference service if available, fallback to ml service
    this.mlApiUrl = process.env.DYNAMIC_INFERENCE_API_URL || process.env.INFERENCE_API_URL || process.env.ML_API_URL || 'http://dynamic-inference-service:5000';
    this.timeout = 10000; // 10 seconds timeout
    this.userId = userId;
  }

  /**
   * Predict attack for packet/flow data
   * @param {Object} packetData - Network packet/flow data
   * @returns {Promise<Object>} Attack prediction result
   */
  async predictAttack(packetData, selectionType = 'primary') {
    try {
      // Prepare data for ML model - map to CICFlowMeter features
      const mlInput = {
        // Basic flow info
        flow_duration: packetData.duration || 0,
        total_fwd_packets: packetData.total_fwd_packets || packetData.packet_count || 1,
        total_backward_packets: packetData.total_backward_packets || 0,
        total_length_of_fwd_packets: packetData.total_length_of_fwd_packets || packetData.byte_count || 0,
        total_length_of_bwd_packets: packetData.total_length_of_bwd_packets || 0,
        
        // Packet length features
        fwd_packet_length_max: packetData.fwd_packet_length_max || 0,
        fwd_packet_length_min: packetData.fwd_packet_length_min || 0,
        fwd_packet_length_mean: packetData.fwd_packet_length_mean || packetData.avg_packet_size || 0,
        fwd_packet_length_std: packetData.fwd_packet_length_std || 0,
        bwd_packet_length_max: packetData.bwd_packet_length_max || 0,
        bwd_packet_length_min: packetData.bwd_packet_length_min || 0,
        bwd_packet_length_mean: packetData.bwd_packet_length_mean || 0,
        bwd_packet_length_std: packetData.bwd_packet_length_std || 0,
        
        // Flow timing features
        flow_bytes_per_second: packetData.flow_bytes_per_second || packetData.bytes_per_second || 0,
        flow_packets_per_second: packetData.flow_packets_per_second || packetData.packets_per_second || 0,
        flow_iat_mean: packetData.flow_iat_mean || 0,
        flow_iat_std: packetData.flow_iat_std || 0,
        flow_iat_max: packetData.flow_iat_max || 0,
        flow_iat_min: packetData.flow_iat_min || 0,
        
        // Forward IAT features
        fwd_iat_total: packetData.fwd_iat_total || 0,
        fwd_iat_mean: packetData.fwd_iat_mean || 0,
        fwd_iat_std: packetData.fwd_iat_std || 0,
        fwd_iat_max: packetData.fwd_iat_max || 0,
        fwd_iat_min: packetData.fwd_iat_min || 0,
        
        // Backward IAT features
        bwd_iat_total: packetData.bwd_iat_total || 0,
        bwd_iat_mean: packetData.bwd_iat_mean || 0,
        bwd_iat_std: packetData.bwd_iat_std || 0,
        bwd_iat_max: packetData.bwd_iat_max || 0,
        bwd_iat_min: packetData.bwd_iat_min || 0,
        
        // Protocol features
        fwd_psh_flags: packetData.fwd_psh_flags || 0,
        bwd_psh_flags: packetData.bwd_psh_flags || 0,
        fwd_urg_flags: packetData.fwd_urg_flags || 0,
        bwd_urg_flags: packetData.bwd_urg_flags || 0,
        fwd_header_length: packetData.fwd_header_length || 0,
        bwd_header_length: packetData.bwd_header_length || 0,
        fwd_packets_per_second: packetData.fwd_packets_per_second || 0,
        bwd_packets_per_second: packetData.bwd_packets_per_second || 0,
        
        // Window size features
        min_packet_length: packetData.min_packet_length || 0,
        max_packet_length: packetData.max_packet_length || 0,
        packet_length_mean: packetData.packet_length_mean || packetData.avg_packet_size || 0,
        packet_length_std: packetData.packet_length_std || 0,
        packet_length_variance: packetData.packet_length_variance || 0,
        
        // Flag counts
        fin_flag_count: packetData.fin_flag_count || 0,
        syn_flag_count: packetData.syn_flag_count || 0,
        rst_flag_count: packetData.rst_flag_count || 0,
        psh_flag_count: packetData.psh_flag_count || 0,
        ack_flag_count: packetData.ack_flag_count || 0,
        urg_flag_count: packetData.urg_flag_count || 0,
        cwe_flag_count: packetData.cwe_flag_count || 0,
        ece_flag_count: packetData.ece_flag_count || 0,
        
        // Additional features
        down_up_ratio: packetData.down_up_ratio || 0,
        average_packet_size: packetData.average_packet_size || packetData.avg_packet_size || 0,
        avg_fwd_segment_size: packetData.avg_fwd_segment_size || 0,
        avg_bwd_segment_size: packetData.avg_bwd_segment_size || 0,
        
        // Extended CICFlowMeter features
        fwd_header_length_1: packetData.fwd_header_length_1 || 0,
        fwd_avg_bytes_per_bulk: packetData.fwd_avg_bytes_per_bulk || 0,
        fwd_avg_packets_per_bulk: packetData.fwd_avg_packets_per_bulk || 0,
        fwd_avg_bulk_rate: packetData.fwd_avg_bulk_rate || 0,
        bwd_avg_bytes_per_bulk: packetData.bwd_avg_bytes_per_bulk || 0,
        bwd_avg_packets_per_bulk: packetData.bwd_avg_packets_per_bulk || 0,
        bwd_avg_bulk_rate: packetData.bwd_avg_bulk_rate || 0,
        subflow_fwd_packets: packetData.subflow_fwd_packets || 0,
        subflow_bwd_packets: packetData.subflow_bwd_packets || 0,
        subflow_fwd_bytes: packetData.subflow_fwd_bytes || 0,
        subflow_bwd_bytes: packetData.subflow_bwd_bytes || 0,
        init_win_bytes_forward: packetData.init_win_bytes_forward || 0,
        init_win_bytes_backward: packetData.init_win_bytes_backward || 0,
        act_data_pkt_fwd: packetData.act_data_pkt_fwd || 0,
        min_seg_size_forward: packetData.min_seg_size_forward || 0,
        active_mean: packetData.active_mean || 0,
        active_std: packetData.active_std || 0,
        active_max: packetData.active_max || 0,
        active_min: packetData.active_min || 0,
        idle_mean: packetData.idle_mean || 0,
        idle_std: packetData.idle_std || 0,
        idle_max: packetData.idle_max || 0,
        idle_min: packetData.idle_min || 0
      };

      // Add user-specific headers for dynamic inference service
      const headers = { 'Content-Type': 'application/json' };
      if (this.userId) {
        headers['X-User-ID'] = this.userId;
        headers['X-Model-Selection-Type'] = selectionType;
      }

      const response = await axios.post(`${this.mlApiUrl}/predict`, mlInput, {
        timeout: this.timeout,
        headers: headers
      });
      
      const prediction = response.data;
      
      return {
        isAttack: prediction.is_malicious || prediction.prediction !== 'Normal',
        attackType: prediction.attack_type || prediction.prediction || 'Unknown',
        severity: prediction.severity || this.mapConfidenceToSeverity(prediction.confidence),
        confidence: prediction.confidence || 0.0,
        inferenceTime: prediction.inference_time || 0,
        probabilities: prediction.probabilities || {}
      };
      
    } catch (error) {
      console.error('ML Prediction Error:', error.message);
      
      // Fallback prediction - conservative approach
      return {
        isAttack: false,
        attackType: 'Normal',
        severity: 'low',
        confidence: 0.0,
        inferenceTime: 0,
        probabilities: {}
      };
    }
  }

  /**
   * Map confidence score to severity level
   * @param {number} confidence - Confidence score (0-1)
   * @returns {string} Severity level
   */
  mapConfidenceToSeverity(confidence) {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Predict threat for a single flow
   * @param {Object} flowData - Network flow data
   * @returns {Promise<Object>} Prediction result
   */
  async predictFlow(flowData) {
    try {
      const response = await axios.post(`${this.mlApiUrl}/predict`, flowData, {
        timeout: this.timeout,
        headers: { 'Content-Type': 'application/json' }
      });
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('ML Prediction Error:', error.message);
      return {
        success: false,
        error: error.message,
        // Fallback prediction
        data: {
          prediction: 'unknown',
          confidence: 0.0,
          is_malicious: false,
          attack_type: 'unknown',
          inference_time: 0
        }
      };
    }
  }

  /**
   * Batch predict for multiple flows
   * @param {Array} flows - Array of network flow data
   * @returns {Promise<Object>} Batch prediction results
   */
  async predictBatch(flows) {
    try {
      const response = await axios.post(`${this.mlApiUrl}/predict/batch`, {
        flows: flows
      }, {
        timeout: this.timeout * 2, // Longer timeout for batch
        headers: { 'Content-Type': 'application/json' }
      });
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      console.error('ML Batch Prediction Error:', error.message);
      return {
        success: false,
        error: error.message,
        data: {
          predictions: flows.map(flow => ({
            flow_id: flow.flow_id || 'unknown',
            prediction: 'unknown',
            confidence: 0.0,
            is_malicious: false,
            attack_type: 'unknown'
          }))
        }
      };
    }
  }

  /**
   * Check ML service health
   * @returns {Promise<Object>} Health status
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.mlApiUrl}/health`, {
        timeout: 5000
      });
      
      return {
        status: 'healthy',
        ml_service: response.data
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Get ML model information
   * @returns {Promise<Object>} Model info
   */
  async getModelInfo() {
    try {
      const response = await axios.get(`${this.mlApiUrl}/model/info`, {
        timeout: 5000
      });
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test ML service with sample data
   * @returns {Promise<Object>} Test results
   */
  async testPrediction() {
    try {
      const response = await axios.get(`${this.mlApiUrl}/test`, {
        timeout: 10000
      });
      
      return {
        success: true,
        data: response.data
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default MLPredictor;