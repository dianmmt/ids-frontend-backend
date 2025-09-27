import express from 'express';
import { verifyToken } from '../services/authService.js';
import { listModels, uploadModel, setActiveModel, setInactiveModel, deleteModel, getAllActiveModels } from '../services/modelRegistryService.js';
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
    const { name, version, format, framework, model_type, description, base64Content, accuracy, precision_score, recall_score, f1_score, training_samples, test_samples } = req.body || {};
    const model = await uploadModel({
      name,
      version,
      format,
      framework,
      model_type,
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

// GET /api/models/active - get all active models
router.get('/active', authenticateToken, async (req, res) => {
  try {
    const activeModels = await getAllActiveModels();
    res.json({ success: true, models: activeModels });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// POST /api/models/:id/activate - set active and push to ML service
router.post('/:id/activate', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Mark active in DB
    const active = await setActiveModel(id);
    // Note: Download functionality removed - models are managed in database only

    // Model activated in database - ML service integration removed
    res.json({ 
      success: true, 
      model: active, 
      message: 'Model activated successfully' 
    });
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

// Download functionality removed - models are managed in database only

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
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID required' });
    }
    
    // Import the user model preference service
    const { UserModelPreferenceService } = await import('../services/userModelPreferenceService.js');
    
    // Set user's model preference
    const result = await UserModelPreferenceService.setUserModelPreference(userId, id, selection_type);
    
    res.json({
      success: true,
      message: 'Model selected successfully',
      model_id: id,
      selection_type,
      preference: result
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
    
    // Import the user model preference service
    const { UserModelPreferenceService } = await import('../services/userModelPreferenceService.js');
    
    // Get user's model preferences
    const preferences = await UserModelPreferenceService.getUserModelPreferences(userId);
    
    res.json({
      success: true,
      selections: preferences
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

export default router;





