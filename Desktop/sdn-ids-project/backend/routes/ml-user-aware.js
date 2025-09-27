import express from 'express';
import { verifyToken } from '../services/authService.js';
import { DirectMLPredictorWithDB } from '../services/directMLPredictorWithDB.js';
import UserModelPreferenceService from '../services/userModelPreferenceService.js';

const router = express.Router();

// Middleware: authenticate
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  const result = verifyToken(token);
  if (!result.valid) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  req.user = result.user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
}

// POST /api/ml-user-aware/set-model-preference - Set user's model preference
router.post('/set-model-preference', authenticateToken, async (req, res) => {
  try {
    const { modelId, selectionType = 'primary' } = req.body;
    const userId = req.user.id;

    if (!modelId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Model ID is required' 
      });
    }

    const preference = await UserModelPreferenceService.setUserModelPreference(
      userId, 
      modelId, 
      selectionType
    );

    res.json({ 
      success: true, 
      message: 'Model preference set successfully',
      preference 
    });
  } catch (error) {
    console.error('Error setting model preference:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to set model preference'
    });
  }
});

// GET /api/ml-user-aware/model-preference - Get user's model preference
router.get('/model-preference', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const selectionType = req.query.selectionType || 'primary';

    const preference = await UserModelPreferenceService.getUserModelPreference(
      userId, 
      selectionType
    );

    res.json({ 
      success: true, 
      preference 
    });
  } catch (error) {
    console.error('Error getting model preference:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to get model preference'
    });
  }
});

// GET /api/ml-user-aware/model-preferences - Get all user's model preferences
router.get('/model-preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const preferences = await UserModelPreferenceService.getUserModelPreferences(userId);

    res.json({ 
      success: true, 
      preferences 
    });
  } catch (error) {
    console.error('Error getting model preferences:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to get model preferences'
    });
  }
});

// GET /api/ml-user-aware/health - Check ML service health
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const mlPredictor = new DirectMLPredictorWithDB(userId);
    const health = await mlPredictor.checkHealth();
    res.json({ success: true, ...health });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to check ML service health'
    });
  }
});

// POST /api/ml-user-aware/predict - Test model with sample data using user's selected model
router.post('/predict', authenticateToken, async (req, res) => {
  try {
    // Get user ID and model selection from headers or body
    const userId = req.user.id;
    const modelId = req.headers['x-model-selection-type'] || req.body.modelId;
    
    // Create ML predictor instance
    const mlPredictor = new DirectMLPredictorWithDB(userId);
    
    // Get the sample data from request body
    const sampleData = req.body;
    
    // Make prediction using the user's selected model
    const prediction = await mlPredictor.predictAttack(sampleData, modelId);
    
    // Return the prediction result
    res.json({
      success: true,
      is_malicious: prediction.isAttack,
      prediction: prediction.attackType,
      confidence: prediction.confidence,
      attack_type: prediction.attackType,
      severity: prediction.severity,
      inference_time: prediction.inferenceTime,
      probabilities: prediction.probabilities,
      model_name: prediction.modelName,
      model_type: prediction.modelType,
      model_id: prediction.modelId
    });
    
  } catch (error) {
    console.error('User-Aware ML Prediction API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to test model',
      message: 'Model prediction failed'
    });
  }
});

// GET /api/ml-user-aware/test - Test ML service with sample data using user's selected model
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const modelId = req.query.modelId;
    
    const mlPredictor = new DirectMLPredictorWithDB(userId);
    
    // Create sample data for testing
    const sampleData = {
      flow_duration: 10.5,
      total_fwd_packets: 100,
      total_backward_packets: 50,
      total_length_of_fwd_packets: 5000,
      total_length_of_bwd_packets: 2500,
      fwd_packet_length_max: 1500,
      fwd_packet_length_min: 64,
      fwd_packet_length_mean: 50,
      fwd_packet_length_std: 10,
      bwd_packet_length_max: 1500,
      bwd_packet_length_min: 64,
      bwd_packet_length_mean: 50,
      bwd_packet_length_std: 10,
      flow_bytes_per_second: 1000,
      flow_packets_per_second: 10,
      flow_iat_mean: 0.1,
      flow_iat_std: 0.05,
      flow_iat_max: 1.0,
      flow_iat_min: 0.01
    };
    
    const result = await mlPredictor.predictAttack(sampleData, modelId);
    
    res.json({
      success: true,
      is_malicious: result.isAttack,
      prediction: result.attackType,
      confidence: result.confidence,
      attack_type: result.attackType,
      severity: result.severity,
      model_name: result.modelName,
      model_type: result.modelType
    });
    
  } catch (error) {
    console.error('User-Aware ML Test API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'ML test failed'
    });
  }
});

// POST /api/ml-user-aware/predict-batch - Batch prediction using user's selected model
router.post('/predict-batch', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const modelId = req.headers['x-model-selection-type'] || req.body.modelId;
    const flows = req.body.flows || [];
    
    if (!flows || flows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No flows provided'
      });
    }

    const mlPredictor = new DirectMLPredictorWithDB(userId);
    const predictions = [];
    let successfulPredictions = 0;

    for (let i = 0; i < flows.length; i++) {
      try {
        const flow = flows[i];
        const prediction = await mlPredictor.predictAttack(flow, modelId);
        
        predictions.push({
          flow_id: flow.flow_id || `flow_${i}`,
          prediction: prediction.attackType,
          is_malicious: prediction.isAttack,
          confidence: prediction.confidence,
          severity: prediction.severity,
          model_name: prediction.modelName,
          model_id: prediction.modelId
        });
        
        successfulPredictions++;
      } catch (error) {
        console.error(`Error processing flow ${i}:`, error);
        predictions.push({
          flow_id: flows[i].flow_id || `flow_${i}`,
          prediction: 'unknown',
          is_malicious: false,
          confidence: 0.0,
          severity: 'low',
          model_name: 'error',
          model_id: 'error',
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      predictions,
      total_flows: flows.length,
      successful_predictions: successfulPredictions,
      failed_predictions: flows.length - successfulPredictions
    });
    
  } catch (error) {
    console.error('User-Aware ML Batch Prediction API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Batch prediction failed'
    });
  }
});

export default router;
