import express from 'express';
import { pool } from '../services/database.js';

const router = express.Router();

// GET /api/topology
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        nn.node_id,
        nn.node_type,
        nn.label,
        nn.ip_address,
        nn.status,
        nn.position_x,
        nn.position_y,
        nn.port_count,
        nn.active_flows,
        nn.cpu_usage,
        nn.memory_usage,
        nn.last_seen
      FROM network_nodes nn
      ORDER BY nn.node_type, nn.node_id
    `);

    const switches = result.rows.filter(n => n.node_type === 'switch');
    const hosts = result.rows.filter(n => n.node_type === 'host');
    const controllers = result.rows.filter(n => n.node_type === 'controller');

    res.json({ switches, hosts, controllers, links: [] });
  } catch (error) {
    console.error('Topology fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch topology' });
  }
});

export default router;


