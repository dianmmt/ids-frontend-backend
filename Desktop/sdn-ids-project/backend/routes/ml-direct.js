import express from 'express';
import { verifyToken } from '../services/authService.js';
import { DirectMLPredictor } from '../services/directMLPredictor.js';

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

// GET /api/ml-direct/health - check ML service health
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const mlPredictor = new DirectMLPredictor();
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

// POST /api/ml-direct/install-dependencies - install ML dependencies
router.post('/install-dependencies', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const mlPredictor = new DirectMLPredictor();
    const result = await mlPredictor.installMLDependencies();
    res.json({ 
      success: true, 
      message: 'ML dependencies installed successfully',
      output: result.output
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'Failed to install ML dependencies'
    });
  }
});

// POST /api/ml-direct/predict - test model with sample data
router.post('/predict', authenticateToken, async (req, res) => {
  try {
    // Get user ID and model selection from headers
    const userId = req.headers['x-user-id'] || req.user?.id;
    const modelSelectionType = req.headers['x-model-selection-type'] || 'primary';
    
    // Create ML predictor instance
    const mlPredictor = new DirectMLPredictor(userId);
    
    // Get the sample data from request body
    const sampleData = req.body;
    
    // Make prediction using the direct ML predictor
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
      model_type: prediction.modelType
    });
    
  } catch (error) {
    console.error('Direct ML Prediction API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to test model',
      message: 'Model prediction failed'
    });
  }
});

// GET /api/ml-direct/test - test ML service with sample data
router.get('/test', authenticateToken, async (req, res) => {
  try {
    const mlPredictor = new DirectMLPredictor();
    const result = await mlPredictor.testPrediction();
    
    if (result.success) {
      res.json({
        success: true,
        ...result.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'ML test failed'
      });
    }
    
  } catch (error) {
    console.error('Direct ML Test API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      message: 'ML test failed'
    });
  }
});

export default router;
