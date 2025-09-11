import express from 'express';
import { pool } from '../services/database.js';
import RyuService from '../services/ryuServices.js';

const router = express.Router();

// Create Ryu service instance
const ryuService = new RyuService();

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

    // Get Ryu connection status
    const ryuConnectionStatus = ryuService.getConnectionStatus();
    const isRyuConnected = ryuService.isConnectedToRyu();

    res.json({ 
      switches, 
      hosts, 
      controllers, 
      links: [],
      ryuConnection: {
        status: ryuConnectionStatus,
        connected: isRyuConnected
      }
    });
  } catch (error) {
    console.error('Topology fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch topology' });
  }
});

// GET /api/topology/ryu-status
router.get('/ryu-status', async (req, res) => {
  try {
    const status = ryuService.getConnectionStatus();
    const connected = ryuService.isConnectedToRyu();
    
    res.json({
      status,
      connected,
      message: connected ? 'Connected to Ryu' : 'Cannot connect to Ryu',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Ryu status check error:', error);
    res.status(500).json({ 
      status: 'disconnected',
      connected: false,
      message: 'Cannot connect to Ryu',
      error: 'Failed to check Ryu status'
    });
  }
});

export default router;


