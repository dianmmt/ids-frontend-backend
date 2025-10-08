import express from 'express';
import { pool } from '../services/database.js';
import performanceService from '../services/performanceService.js';

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    // Totals from existing view/tables
    const [flowsCount, attacksCount, nodesCount] = await Promise.all([
      pool.query('SELECT COUNT(*)::bigint AS count FROM flows'),
      pool.query("SELECT COUNT(*)::bigint AS count FROM attack_events WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' AND LOWER(attack_type) NOT IN ('normal', 'normal traffic', 'benign')"),
      pool.query('SELECT COUNT(*)::bigint AS count FROM network_nodes')
    ]);

    // Build performance section without relying on missing tables
    const [mlPerf, dbPerf, latestPerfData] = await Promise.all([
      performanceService.collectMLMetrics().catch(() => performanceService.getFallbackMLPerformance()),
      performanceService.collectDatabaseMetrics().catch(() => performanceService.getFallbackDatabasePerformance()),
      performanceService.getLatestPerformanceData().catch(async () => ({
        network_statistics: performanceService.networkStatsCache?.latest || performanceService.getFallbackNetworkStats(),
        system_health: await performanceService.collectSystemHealth().catch(() => performanceService.getFallbackSystemHealth())
      }))
    ]);

    res.json({
      totals: {
        flows: Number(flowsCount.rows[0].count),
        attacks_24h: Number(attacksCount.rows[0].count),
        nodes: Number(nodesCount.rows[0].count)
      },
      performance: {
        ml: mlPerf,
        db: dbPerf,
        net: latestPerfData.network_statistics,
        health: latestPerfData.system_health
      }
    });
  } catch (error) {
    console.error('Dashboard summary error, serving fallbacks:', error);
    res.json({
      totals: {
        flows: 0,
        attacks_24h: 0,
        nodes: 0
      },
      performance: {
        ml: performanceService.getFallbackMLPerformance(),
        db: performanceService.getFallbackDatabasePerformance(),
        net: performanceService.networkStatsCache?.latest || performanceService.getFallbackNetworkStats(),
        health: performanceService.getFallbackSystemHealth()
      }
    });
  }
});

export default router;


