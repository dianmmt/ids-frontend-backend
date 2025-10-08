import express from 'express';
import { pool } from '../services/database.js';
import RyuService from '../services/ryuServices.js';

const router = express.Router();

// Dynamic Ryu host detection
const getRyuHost = () => {
  // Ưu tiên biến môi trường
  if (process.env.RYU_HOST) {
    return process.env.RYU_HOST;
  }
  
  // Tự động phát hiện dựa trên network interface
  const os = require('os');
  const interfaces = os.networkInterfaces();
  
  // Tìm IP không phải localhost
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        // Giả sử Ryu chạy trên cùng subnet
        const ip = iface.address;
        const subnet = ip.substring(0, ip.lastIndexOf('.'));
        return `${subnet}.100`; // Giả sử Ryu ở IP .100
      }
    }
  }
  
  return 'localhost'; // Fallback
};

const ryuHost = getRyuHost();
const ryuPort = parseInt(process.env.RYU_PORT || '8080', 10);
const ryuWsPort = parseInt(process.env.RYU_WS_PORT || process.env.RYU_PORT || '8080', 10);

console.log(`Connecting to Ryu controller at: ${ryuHost}:${ryuPort}`);

const ryuService = new RyuService(ryuHost, ryuPort, ryuWsPort);

// Helper function to get hosts from Ryu service
import axios from 'axios';

const getHosts = async () => {
  try {
    // Gọi trực tiếp endpoint Ryu /v1.0/hosts
    const url = `http://${ryuService.host}:${ryuService.port}/v1.0/hosts`;
    const response = await axios.get(url);
    const hosts = response.data || [];
    
    // ✅ Log thông tin hosts để debug
    console.log(`🔍 Raw hosts from Ryu: ${hosts.length} total`);
    const hostsWithIPv4 = hosts.filter(host => 
      Array.isArray(host.ipv4) && 
      host.ipv4.length > 0 && 
      host.ipv4[0] && 
      host.ipv4[0] !== 'unknown'
    );
    console.log(`🔍 Hosts with IPv4: ${hostsWithIPv4.length}`);
    
    // Filter out host with IP 192.168.20.128
    const filteredHosts = hostsWithIPv4.filter(host => {
      const hostIp = host.ipv4?.[0];
      if (hostIp === '192.168.20.128') {
        console.log(`🚫 Filtering out host with IP: ${hostIp}`);
        return false;
      }
      return true;
    });
    
    console.log(`🔍 Hosts after filtering: ${filteredHosts.length}`);
    
    // Đảm bảo là array
    return Array.isArray(filteredHosts) ? filteredHosts : [];
  } catch (error) {
    console.error('Error getting hosts from Ryu /v1.0/hosts:', error);
    return [];
  }
};


/**
 * GET /api/topology
 * Lấy topology từ Ryu controller (ưu tiên), fallback sang DB nếu lỗi
 */
router.get('/', async (req, res) => {
  try {
    let switches = [];
    let hosts = [];
    let controllers = [];
    let links = [];

    try {
      // ---- Ưu tiên lấy từ Ryu ----
      const ryuTopology = await ryuService.getTopology();
      const ryuConnectionStatus = ryuService.getConnectionStatus();
      const isRyuConnected = ryuService.isConnectedToRyu();

      switches = (ryuTopology.switches || []).map(sw => ({
        id: sw.dpid || sw.id,
        node_type: 'switch',
        label: `Switch ${sw.dpid || sw.id}`,
        ip_address: sw.description?.ip || 'Unknown',
        status: 'active',
        position_x: 0,
        position_y: 0,
        port_count: sw.ports?.length || 0,
        active_flows: 0,
        cpu_usage: 0,
        memory_usage: 0,
        last_seen: new Date().toISOString(),
        description: sw.description,
        ports: sw.ports,
        connected: true
      }));

      hosts = (ryuTopology.hosts || [])
        .filter(h => {
          // Filter out host with IP 192.168.20.128
          const hostIp = h.ipv4?.[0] || 'Unknown';
          if (hostIp === '192.168.20.128') {
            console.log(`🚫 Filtering out host with IP: ${hostIp}`);
            return false;
          }
          return true;
        })
        .map(h => ({
          id: h.mac,
          node_type: 'host',
          label: `Host ${h.mac.slice(-6)}`,
          ip_address: h.ipv4?.[0] || 'Unknown',
          status: 'active',
          position_x: 0,
          position_y: 0,
          port_count: 1,
          active_flows: 0,
          cpu_usage: 0,
          memory_usage: 0,
          last_seen: new Date().toISOString(),
          mac: h.mac,
          ipv4: h.ipv4
        }));

      controllers = [{
        id: 'controller',
        node_type: 'controller',
        label: 'Ryu Controller',
        ip_address: `${ryuService.host}:${ryuService.port}`,
        status: isRyuConnected ? 'active' : 'inactive',
        position_x: 0,
        position_y: 0,
        port_count: 1,
        active_flows: 0,
        cpu_usage: 0,
        memory_usage: 0,
        last_seen: new Date().toISOString(),
        connected: isRyuConnected
      }];

      links = ryuTopology.links || [];

      return res.json({
        switches,
        hosts,
        controllers,
        links,
        ryuConnection: { status: ryuConnectionStatus, connected: isRyuConnected }
      });

    } catch (err) {
      console.warn('⚠️ Ryu fetch failed, fallback to DB:', err.message);

      // ---- Fallback sang DB ----
      const result = await pool.query('SELECT * FROM topology_nodes');
      switches = result.rows.filter(n => n.node_type === 'switch');
      hosts = result.rows.filter(n => n.node_type === 'host');
      controllers = result.rows.filter(n => n.node_type === 'controller');

      const ryuConnectionStatus = ryuService.getConnectionStatus();
      const isRyuConnected = ryuService.isConnectedToRyu();

      return res.json({
        switches,
        hosts,
        controllers,
        links: [],
        ryuConnection: { status: ryuConnectionStatus, connected: isRyuConnected }
      });
    }
  } catch (error) {
    console.error('❌ Topology fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch topology' });
  }
});

/**
 * GET /api/topology/hosts
 * Trả về thông tin host cho frontend
 */
router.get('/hosts', async (req, res) => {
  try {
    const hosts = await getHosts();
    console.log('🔍 Raw hosts from Ryu:', hosts); // Debug
    
    res.json({
      success: true,
      data: hosts,  // ✅ Đảm bảo đây là array hosts từ Ryu
      count: hosts.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching hosts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hosts',
      error: error.message,
      data: []  // ✅ Luôn trả về array
    });
  }
});


/**
 * GET /api/topology/ryu-status
 * Kiểm tra trạng thái kết nối Ryu
 */
router.get('/ryu-status', (req, res) => {
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
    console.error('❌ Ryu status check error:', error);
    res.status(500).json({
      status: 'disconnected',
      connected: false,
      message: 'Cannot connect to Ryu',
      error: 'Failed to check Ryu status'
    });
  }
});

// Initialize Ryu connection
(async () => {
  await ryuService.connect();
})();

export default router;