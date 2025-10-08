// backend/services/mlPredictor.js - ML Prediction Service
import axios from 'axios';
import CICFlowMeterFeatureMapper from './cicflowmeterFeatureMapper.js';

export class MLPredictor {
  constructor(userId = null) {
    // Use dynamic inference service if available, fallback to ml service
    this.mlApiUrl = process.env.DYNAMIC_INFERENCE_API_URL || process.env.INFERENCE_API_URL || process.env.ML_API_URL || 'http://dynamic-inference-service:5000';
    this.timeout = 10000; // 10 seconds timeout
    this.userId = userId;
    this.featureMapper = new CICFlowMeterFeatureMapper();
  }

  /**
   * Predict attack for packet/flow data
   * @param {Object} packetData - Network packet/flow data
   * @returns {Promise<Object>} Attack prediction result
   */
  async predictAttack(packetData, selectionType = 'primary') {
    try {
      // Use feature mapper to convert packet data to ML input format
      const mlInput = this.featureMapper.mapDatabaseToML(packetData);

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
        isAttack: prediction.is_malicious || (prediction.prediction && prediction.prediction.toLowerCase() !== 'normal'),
        attackType: prediction.attack_type || prediction.prediction || 'Unknown',
        severity: prediction.severity || this.mapAttackTypeToSeverity(prediction.attack_type || prediction.prediction || 'Unknown', prediction.confidence || 0.0),
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
   * Map attack type and confidence to severity level
   * @param {string} attackType - Attack type
   * @param {number} confidence - Confidence score (0-1)
   * @returns {string} Severity level
   */
  mapAttackTypeToSeverity(attackType, confidence) {
    // Normalize attack type for comparison
    const normalizedType = attackType.toLowerCase().trim();
    
    // Map specific attack types to base severity
    let baseSeverity = 'medium';
    
    if (normalizedType === 'normal') {
      return 'low';
    } else if (normalizedType.includes('dos') || normalizedType.includes('ddos')) {
      baseSeverity = 'critical'; // DoS/DDoS attacks are critical
    } else if (normalizedType.includes('u2r')) {
      baseSeverity = 'critical'; // User-to-Root privilege escalation is critical
    } else if (normalizedType.includes('r2l')) {
      baseSeverity = 'high'; // Remote-to-Local access is high severity
    } else if (normalizedType.includes('web attack') || normalizedType.includes('web_attack')) {
      baseSeverity = 'high'; // Web attacks are high severity
    } else if (normalizedType.includes('bfa') || normalizedType.includes('brute')) {
      baseSeverity = 'high'; // Brute Force Attacks are high severity
    } else if (normalizedType.includes('probe') || normalizedType.includes('scan')) {
      baseSeverity = 'medium'; // Probing/scanning is medium severity
    }
    
    // Adjust severity based on confidence
    if (confidence >= 0.9) {
      // High confidence - keep or upgrade severity
      if (baseSeverity === 'medium') return 'high';
      return baseSeverity;
    } else if (confidence >= 0.7) {
      // Medium confidence - keep base severity
      return baseSeverity;
    } else if (confidence >= 0.5) {
      // Lower confidence - downgrade severity slightly
      if (baseSeverity === 'critical') return 'high';
      if (baseSeverity === 'high') return 'medium';
      return baseSeverity;
    } else {
      // Very low confidence - low severity
      return 'low';
    }
  }

  /**
   * Map confidence score to severity level (fallback method)
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