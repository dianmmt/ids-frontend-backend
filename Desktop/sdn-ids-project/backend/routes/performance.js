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
      try {
        await performanceServiceInstance.collectAllPerformanceData();
      } catch (collectError) {
        console.warn('Realtime refresh failed, continuing with cached/fallbacks:', collectError.message);
      }
    }
    let systemMetrics = [];
    let performanceData = {};

    try {
      systemMetrics = await performanceServiceInstance.getLatestSystemMetrics();
    } catch (e) {
      systemMetrics = performanceServiceInstance.getFallbackSystemMetrics();
    }
    try {
      performanceData = await performanceServiceInstance.getLatestPerformanceData();
    } catch (e) {
      performanceData = {
        network_statistics: performanceServiceInstance.networkStatsCache?.latest || performanceServiceInstance.getFallbackNetworkStats(),
        system_health: performanceServiceInstance.getFallbackSystemHealth()
      };
    }

    // Alerts pagination
    const limit = parseInt(req.query.limit) || 4;
    const offset = parseInt(req.query.offset) || 0;
    const alerts = await performanceServiceInstance.getActiveAlerts(limit, offset);
    const totalAlerts = await performanceServiceInstance.getActiveAlertsCount();

    res.json({
      timestamp: new Date().toISOString(),
      systemMetrics,
      mlPerformance: performanceData.ml_performance || performanceServiceInstance.getFallbackMLPerformance(),
      databasePerformance: performanceData.database_performance || null,
      networkStatistics: performanceData.network_statistics || null,
      systemHealth: performanceData.system_health || null,
      alerts,
      alertsPagination: { limit, offset, total: totalAlerts }
    });
  } catch (error) {
    console.error('Error fetching real-time performance (serving fallbacks):', error);
    res.json({
      timestamp: new Date().toISOString(),
      systemMetrics: performanceServiceInstance.getFallbackSystemMetrics(),
      mlPerformance: performanceServiceInstance.getFallbackMLPerformance(),
      databasePerformance: performanceServiceInstance.getFallbackDatabasePerformance(),
      networkStatistics: performanceServiceInstance.networkStatsCache?.latest || performanceServiceInstance.getFallbackNetworkStats(),
      systemHealth: performanceServiceInstance.getFallbackSystemHealth(),
      alerts: [],
      alertsPagination: { limit: 0, offset: 0, total: 0 }
    });
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

// Threshold settings endpoints
router.get('/thresholds', (req, res) => {
  try {
    const thresholds = performanceServiceInstance.getAllThresholdSettings();
    res.json({ thresholds });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch thresholds' });
  }
});

router.post('/thresholds', (req, res) => {
  try {
    const updated = performanceServiceInstance.updateThresholdSettings(req.body?.thresholds || req.body || {});
    res.json({ success: true, thresholds: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid thresholds payload' });
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

// Get all performance alerts (active and resolved)
router.get('/alerts/all', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const alerts = await performanceServiceInstance.getAllAlerts(limit, offset);
    const total = await performanceServiceInstance.getAllAlertsCount();
    res.json({ alerts, pagination: { limit, offset, total } });
  } catch (error) {
    console.error('Error fetching all alerts:', error);
    res.status(500).json({ error: 'Failed to fetch all alerts' });
  }
});

// Acknowledge (resolve) a performance alert by id, but keep it stored in DB
router.post('/alerts/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const resolvedBy = req.user?.username || null; // optional if auth is wired
    const updated = await performanceServiceInstance.resolveAlertById(id, resolvedBy);
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    return res.json({ success: true, alert: updated });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    return res.status(500).json({ error: 'Failed to acknowledge alert' });
  }
});

// Hide a performance alert by id (soft delete - keeps data in DB but hides from UI)
router.post('/alerts/:id/hide', async (req, res) => {
  try {
    const { id } = req.params;
    const hiddenBy = req.user?.username || null; // optional if auth is wired
    const updated = await performanceServiceInstance.hideAlertById(id, hiddenBy);
    if (!updated) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    return res.json({ success: true, alert: updated, message: 'Alert hidden successfully' });
  } catch (error) {
    console.error('Error hiding alert:', error);
    return res.status(500).json({ error: 'Failed to hide alert' });
  }
});

export default router;

