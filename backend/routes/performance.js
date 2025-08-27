// File: backend/routes/performance.js
import express from 'express';
import performanceService from '../services/performanceService.js';
import os from 'os';

const router = express.Router();

// Get current system performance metrics
router.get('/current', async (req, res) => {
  try {
    const metrics = await performanceService.getLatestSystemMetrics();
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching current performance:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Refresh performance data - collect new metrics
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Refreshing performance data...');
    
    // Collect fresh performance data
    const result = await performanceService.collectAllPerformanceData();
    
    // Get the updated metrics
    const updatedMetrics = await performanceService.getLatestSystemMetrics();
    const updatedHealth = await performanceService.getLatestPerformanceData();
    const updatedAlerts = await performanceService.getActiveAlerts();
    
    res.json({
      success: true,
      message: 'Performance data refreshed successfully',
      timestamp: new Date().toISOString(),
      metrics: updatedMetrics,
      health: updatedHealth.system_health || {},
      alerts: updatedAlerts,
      collectionResult: result
    });
  } catch (error) {
    console.error('Error refreshing performance data:', error);
    res.status(500).json({ 
      error: 'Failed to refresh performance data',
      details: error.message 
    });
  }
});

// Get real-time performance data (with optional refresh)
router.get('/realtime', async (req, res) => {
  try {
    const shouldRefresh = req.query.refresh === 'true';
    
    if (shouldRefresh) {
      // Collect fresh data first
      await performanceService.collectAllPerformanceData();
    }
    
    // Get all current performance data
    const systemMetrics = await performanceService.getLatestSystemMetrics();
    const performanceData = await performanceService.getLatestPerformanceData();
    const alerts = await performanceService.getActiveAlerts();
    
    res.json({
      timestamp: new Date().toISOString(),
      systemMetrics,
      mlPerformance: performanceData.ml_performance || {},
      databasePerformance: performanceData.database_performance || {},
      networkStatistics: performanceData.network_statistics || {},
      systemHealth: performanceData.system_health || {},
      alerts
    });
  } catch (error) {
    console.error('Error fetching real-time performance:', error);
    res.status(500).json({ error: 'Failed to fetch real-time performance data' });
  }
});

// Get performance history
router.get('/history', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const history = await performanceService.getPerformanceHistory(hours);
    res.json(history);
  } catch (error) {
    console.error('Error fetching performance history:', error);
    res.status(500).json({ error: 'Failed to fetch performance history' });
  }
});

// Get system health status
router.get('/health', async (req, res) => {
  try {
    const health = await performanceService.getLatestPerformanceData();
    res.json(health.system_health || {});
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// Get active performance alerts
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await performanceService.getActiveAlerts();
    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get ML performance metrics
router.get('/ml', async (req, res) => {
  try {
    const mlData = await performanceService.getLatestPerformanceData();
    res.json(mlData.ml_performance || {});
  } catch (error) {
    console.error('Error fetching ML performance:', error);
    res.status(500).json({ error: 'Failed to fetch ML performance' });
  }
});

// Get database performance metrics
router.get('/database', async (req, res) => {
  try {
    const dbData = await performanceService.getLatestPerformanceData();
    res.json(dbData.database_performance || {});
  } catch (error) {
    console.error('Error fetching database performance:', error);
    res.status(500).json({ error: 'Failed to fetch database performance' });
  }
});

// Get network statistics
router.get('/network', async (req, res) => {
  try {
    const networkData = await performanceService.getLatestPerformanceData();
    res.json(networkData.network_statistics || {});
  } catch (error) {
    console.error('Error fetching network statistics:', error);
    res.status(500).json({ error: 'Failed to fetch network statistics' });
  }
});

// Manual trigger for performance data collection
router.post('/collect', async (req, res) => {
  try {
    const result = await performanceService.collectAllPerformanceData();
    res.json(result);
  } catch (error) {
    console.error('Error collecting performance data:', error);
    res.status(500).json({ error: 'Failed to collect performance data' });
  }
});

// Get system information (platform, architecture, etc.)
router.get('/system-info', async (req, res) => {
  try {
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      hostname: os.hostname(),
      userInfo: os.userInfo(),
      networkInterfaces: Object.keys(os.networkInterfaces())
    };
    
    res.json(systemInfo);
  } catch (error) {
    console.error('Error fetching system info:', error);
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

export default router;

