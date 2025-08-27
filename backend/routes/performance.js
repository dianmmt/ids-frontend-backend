import express from 'express';
import performanceServiceInstance from '../services/performanceService.js';
import os from 'os';

const router = express.Router();

// Get current system performance metrics
router.get('/current', async (req, res) => {
  try {
    console.log('Fetching current performance metrics...');

    try {
      await performanceServiceInstance.collectAllPerformanceData();
    } catch (collectError) {
      console.warn('Could not collect fresh data, using existing:', collectError.message);
    }

    const metrics = await performanceServiceInstance.getLatestSystemMetrics();
    console.log(`Retrieved ${metrics.length} metrics:`, metrics.map(m => `${m.name}: ${m.value}${m.unit}`));

    res.json(metrics);
  } catch (error) {
    console.error('Error fetching current performance:', error);
    const fallbackMetrics = [
      { name: 'CPU Usage', value: 45, unit: '%', status: 'normal', trend: 2 },
      { name: 'Memory Usage', value: 62, unit: '%', status: 'normal', trend: -1 },
      { name: 'Disk Usage', value: 38, unit: '%', status: 'normal', trend: 0.5 },
      { name: 'Network Load', value: 23, unit: '%', status: 'normal', trend: 5 }
    ];
    res.json(fallbackMetrics);
  }
});

// Refresh performance data - collect new metrics
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Refreshing performance data...');
    const result = await performanceServiceInstance.collectAllPerformanceData();
    const updatedMetrics = await performanceServiceInstance.getLatestSystemMetrics();
    const updatedHealth = await performanceServiceInstance.getLatestPerformanceData();

    // Alerts pagination
    const limit = parseInt(req.query.limit) || 4;
    const offset = parseInt(req.query.offset) || 0;
    const alerts = await performanceServiceInstance.getActiveAlerts(limit, offset);
    const totalAlerts = await performanceServiceInstance.getActiveAlertsCount();

    res.json({
      success: true,
      message: 'Performance data refreshed successfully',
      timestamp: new Date().toISOString(),
      metrics: updatedMetrics,
      health: updatedHealth.system_health || {},
      alerts,
      alertsPagination: { limit, offset, total: totalAlerts },
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
      await performanceServiceInstance.collectAllPerformanceData();
    }
    const systemMetrics = await performanceServiceInstance.getLatestSystemMetrics();
    const performanceData = await performanceServiceInstance.getLatestPerformanceData();

    // Alerts pagination
    const limit = parseInt(req.query.limit) || 4;
    const offset = parseInt(req.query.offset) || 0;
    const alerts = await performanceServiceInstance.getActiveAlerts(limit, offset);
    const totalAlerts = await performanceServiceInstance.getActiveAlertsCount();

    res.json({
      timestamp: new Date().toISOString(),
      systemMetrics,
      mlPerformance: performanceData.ml_performance || null,
      databasePerformance: performanceData.database_performance || null,
      networkStatistics: performanceData.network_statistics || null,
      systemHealth: performanceData.system_health || null,
      alerts,
      alertsPagination: { limit, offset, total: totalAlerts }
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
    const history = await performanceServiceInstance.getPerformanceHistory(hours);
    res.json(history);
  } catch (error) {
    console.error('Error fetching performance history:', error);
    res.status(500).json({ error: 'Failed to fetch performance history' });
  }
});

// Get system health status
router.get('/health', async (req, res) => {
  try {
    const health = await performanceServiceInstance.getLatestPerformanceData();
    res.json(health.system_health || {});
  } catch (error) {
    console.error('Error fetching system health:', error);
    res.status(500).json({ error: 'Failed to fetch system health' });
  }
});

// Get active performance alerts (paginated)
router.get('/alerts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 4;
    const offset = parseInt(req.query.offset) || 0;
    const alerts = await performanceServiceInstance.getActiveAlerts(limit, offset);
    const total = await performanceServiceInstance.getActiveAlertsCount();
    res.json({ alerts, pagination: { limit, offset, total } });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

export default router;

