// backend/services/mlPredictor.js - ML Prediction Service
const axios = require('axios');

class MLPredictorService {
  constructor() {
    this.mlApiUrl = process.env.ML_API_URL || 'http://ml:5000';
    this.timeout = 10000; // 10 seconds timeout
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

module.exports = MLPredictorService;

// -----------------------------------------------------------------------------
// backend/routes/ml.js - ML API Routes
// -----------------------------------------------------------------------------
const express = require('express');
const MLPredictorService = require('../services/mlPredictor');

const router = express.Router();
const mlService = new MLPredictorService();

// ML Health Check
router.get('/health', async (req, res) => {
  try {
    const health = await mlService.checkHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Single Flow Prediction
router.post('/predict', async (req, res) => {
  try {
    const flowData = req.body;
    const result = await mlService.predictFlow(flowData);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error, prediction: result.data });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Batch Prediction
router.post('/predict/batch', async (req, res) => {
  try {
    const { flows } = req.body;
    
    if (!flows || !Array.isArray(flows)) {
      return res.status(400).json({ error: 'Invalid flows data' });
    }
    
    const result = await mlService.predictBatch(flows);
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error, predictions: result.data });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Model Information
router.get('/model/info', async (req, res) => {
  try {
    const result = await mlService.getModelInfo();
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test Prediction
router.get('/test', async (req, res) => {
  try {
    const result = await mlService.testPrediction();
    
    if (result.success) {
      res.json(result.data);
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;