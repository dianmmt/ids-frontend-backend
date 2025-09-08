import express from 'express';
import { pool } from '../services/database.js';

const router = express.Router();

// GET /api/dashboard/summary
router.get('/summary', async (req, res) => {
  try {
    const [flowsCount, attacksCount, nodesCount] = await Promise.all([
      pool.query('SELECT COUNT(*)::bigint AS count FROM network_flows'),
      pool.query("SELECT COUNT(*)::bigint AS count FROM attack_detections WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'"),
      pool.query('SELECT COUNT(*)::bigint AS count FROM network_nodes')
    ]);

    const latestPerf = await pool.query(`
      SELECT 
        (SELECT row_to_json(t) FROM (SELECT * FROM ml_performance ORDER BY timestamp DESC LIMIT 1) t) as ml,
        (SELECT row_to_json(t) FROM (SELECT * FROM database_performance ORDER BY timestamp DESC LIMIT 1) t) as db,
        (SELECT row_to_json(t) FROM (SELECT * FROM network_statistics ORDER BY timestamp DESC LIMIT 1) t) as net,
        (SELECT row_to_json(t) FROM (SELECT * FROM system_health ORDER BY timestamp DESC LIMIT 1) t) as health
    `);

    res.json({
      totals: {
        flows: Number(flowsCount.rows[0].count),
        attacks_24h: Number(attacksCount.rows[0].count),
        nodes: Number(nodesCount.rows[0].count)
      },
      performance: {
        ml: latestPerf.rows[0].ml,
        db: latestPerf.rows[0].db,
        net: latestPerf.rows[0].net,
        health: latestPerf.rows[0].health
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

export default router;


