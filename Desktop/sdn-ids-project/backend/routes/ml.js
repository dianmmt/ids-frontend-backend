import express from 'express';
import { verifyToken } from '../services/authService.js';
// Note: model management endpoints are served under /api/models. Remove duplicates here.
import axios from 'axios';
import config from '../services/config.js';

const router = express.Router();

// Middleware: authenticate and require admin
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

// Duplicated model management endpoints were removed in favor of /api/models

// POST /api/ml/predict - test model with sample data using user's selected model
router.post('/predict', authenticateToken, async (req, res) => {
  try {
    const { DirectMLPredictorWithDB } = await import('../services/directMLPredictorWithDB.js');
    
    // Get user ID and model selection from headers
    const userId = req.user?.id || req.headers['x-user-id'] || '1';
    const modelSelectionType = req.headers['x-model-selection-type'];
    
    // Create direct ML predictor instance with database support
    const mlPredictor = new DirectMLPredictorWithDB(userId);
    
    // Get the sample data from request body
    const sampleData = req.body;
    
    // Make prediction using the user's selected model
    const prediction = await mlPredictor.predictAttack(sampleData, modelSelectionType);
    
    // Return the prediction result in the format expected by frontend
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
      model_id: prediction.modelId
    });
    
  } catch (error) {
    console.error('ML Prediction API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to test model',
      message: 'Model prediction failed'
    });
  }
});

// Model management endpoints moved to /api/models

export default router;


