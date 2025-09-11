import express from 'express';
import { verifyToken } from '../services/authService.js';
import { listModels, uploadModel, setActiveModel, setInactiveModel, deleteModel, downloadModel } from '../services/modelRegistryService.js';
import axios from 'axios';
import config from '../services/config.js';
import { MLPredictor } from '../services/mlPredictor.js';

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

// POST /api/ml/predict - test prediction using active/selected model
router.post('/predict', authenticateToken, async (req, res) => {
  try {
    const userIdHeader = req.headers['x-user-id'];
    const selectionType = req.headers['x-model-selection-type'] || 'primary';

    // Instantiate predictor with optional user context (used by dynamic inference service)
    const predictor = new MLPredictor(userIdHeader || req.user?.id || null);

    const input = req.body || {};
    const prediction = await predictor.predictAttack(input, selectionType);

    // Map to frontend-expected shape
    return res.json({
      is_malicious: !!prediction.isAttack,
      prediction: prediction.isAttack ? 'attack' : 'normal',
      attack_type: prediction.attackType || 'unknown',
      severity: prediction.severity || 'low',
      confidence: typeof prediction.confidence === 'number' ? prediction.confidence : 0,
      inference_time: prediction.inferenceTime || 0,
      probabilities: prediction.probabilities || {}
    });
  } catch (e) {
    console.error('ML predict error:', e);
    return res.status(500).json({ success: false, message: 'Failed to connect to ML service', error: e.message });
  }
});

// GET /api/ml/models - list models
router.get('/models', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const models = await listModels();
    res.json({ success: true, models });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/ml/models - upload model (base64)
router.post('/models', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { name, version, format, framework, description, base64Content, accuracy, precision_score, recall_score, f1_score, training_samples, test_samples } = req.body || {};
    const model = await uploadModel({
      name,
      version,
      format,
      framework,
      description,
      base64Content,
      uploadedBy: req.user?.id || null,
      accuracy,
      precision_score,
      recall_score,
      f1_score,
      training_samples,
      test_samples
    });
    res.status(201).json({ success: true, model });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// POST /api/ml/models/:id/activate - set active and push to ML service
router.post('/models/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Mark active in DB
    const active = await setActiveModel(id);
    // Fetch bytes to send to ML service
    const artifact = await downloadModel(id);
    if (!artifact) return res.status(404).json({ success: false, message: 'Model not found' });

    // Push to ML service (optional - continue even if ML service is not available)
    const mlUrl = process.env.ML_API_URL || 'http://ml:5000';
    try {
      await axios.post(`${mlUrl}/model/load`, {
        name: artifact.name,
        version: artifact.version,
        format: artifact.format,
        framework: artifact.framework,
        sha256: artifact.sha256,
        size_bytes: artifact.size_bytes,
        base64Content: artifact.content.toString('base64')
      }, { timeout: 20000 });
      
      res.json({ success: true, model: active, message: 'Model activated and loaded into ML service' });
    } catch (mlError) {
      console.warn('ML service not available, model activated in database only:', mlError.message);
      res.json({ 
        success: true, 
        model: active, 
        message: 'Model activated in database (ML service not available)',
        warning: 'ML service connection failed - model is stored but not loaded for inference'
      });
    }
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// POST /api/ml/models/:id/deactivate - deactivate model
router.post('/models/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const inactive = await setInactiveModel(id);
    res.json({ success: true, model: inactive, message: 'Model deactivated successfully' });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// DELETE /api/ml/models/:id - delete model
router.delete('/models/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteModel(id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

export default router;


