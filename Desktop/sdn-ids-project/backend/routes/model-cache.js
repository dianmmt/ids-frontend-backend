// backend/routes/model-cache.js - Model Cache Management Routes
import express from 'express';
import { ModelCacheService } from '../services/modelCacheService.js';
import config from '../services/config.js';

const router = express.Router();

// Initialize Model Cache Service
const modelCacheService = new ModelCacheService(config.modelCache);

/**
 * GET /api/model-cache/health
 * Health check for model cache service
 */
router.get('/health', async (req, res) => {
  try {
    const health = await modelCacheService.healthCheck();
    res.json({
      status: 'success',
      ...health
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/model-cache/models
 * List available models from distribution server
 */
router.get('/models', async (req, res) => {
  try {
    const models = await modelCacheService.listAvailableModels();
    res.json({
      status: 'success',
      models
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * POST /api/model-cache/download
 * Download and cache a model
 */
router.post('/download', async (req, res) => {
  try {
    const { modelKey, fileTypes } = req.body;
    
    if (!modelKey) {
      return res.status(400).json({
        status: 'error',
        message: 'modelKey is required'
      });
    }
    
    const types = fileTypes || ['model', 'scaler', 'encoder'];
    const paths = await modelCacheService.ensureModelFiles(modelKey, types);
    
    res.json({
      status: 'success',
      model_key: modelKey,
      paths
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * GET /api/model-cache/stats
 * Get cache statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = modelCacheService.getCacheStats();
    res.json({
      status: 'success',
      cache_stats: stats
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/model-cache/clear/:modelKey
 * Clear cache for a specific model
 */
router.delete('/clear/:modelKey', async (req, res) => {
  try {
    const { modelKey } = req.params;
    const deletedCount = modelCacheService.clearModelCache(modelKey);
    
    res.json({
      status: 'success',
      message: `Cleared cache for ${modelKey}`,
      deleted_files: deletedCount
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * DELETE /api/model-cache/clear
 * Clear all cache
 */
router.delete('/clear', async (req, res) => {
  try {
    const deletedCount = modelCacheService.clearAllCache();
    
    res.json({
      status: 'success',
      message: 'Cleared all cache',
      deleted_files: deletedCount
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

export default router;
export { modelCacheService };