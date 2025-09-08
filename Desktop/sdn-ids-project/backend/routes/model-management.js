import express from 'express';
import { verifyToken } from '../services/authService.js';
import { listModels, uploadModel, setActiveModel, setInactiveModel, deleteModel, downloadModel } from '../services/modelRegistryService.js';
import axios from 'axios';

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

// GET /api/models - list models
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const models = await listModels();
    res.json({ success: true, models });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/models - upload model (base64)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
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

// POST /api/models/:id/activate - set active and push to ML service
router.post('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
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

// POST /api/models/:id/deactivate - deactivate model
router.post('/:id/deactivate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const inactive = await setInactiveModel(id);
    res.json({ success: true, model: inactive, message: 'Model deactivated successfully' });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// DELETE /api/models/:id - delete model
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteModel(id);
    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// GET /api/models/:id/download - download model
router.get('/:id/download', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const artifact = await downloadModel(id);
    if (!artifact) return res.status(404).json({ success: false, message: 'Model not found' });
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.name}_${artifact.version}.${artifact.format}"`);
    res.send(artifact.content);
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// GET /api/models/:id/info - get model information
router.get('/:id/info', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const models = await listModels();
    const model = models.find(m => m.id === id);
    
    if (!model) {
      return res.status(404).json({ success: false, message: 'Model not found' });
    }
    
    res.json({ success: true, model });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/models/:id/select - select model for user
router.post('/:id/select', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { selection_type = 'primary' } = req.body;
    
    // This would need to be implemented in modelRegistryService
    // For now, just return success
    res.json({
      success: true,
      message: 'Model selected successfully',
      model_id: id,
      selection_type
    });
  } catch (e) {
    res.status(400).json({ success: false, message: e.message });
  }
});

// GET /api/models/user/selected - get user's selected models
router.get('/user/selected', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }
    
    // This would need to be implemented in modelRegistryService
    // For now, return empty array
    res.json({
      success: true,
      selections: []
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
