// backend/server.js
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'sdn_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sdn_ids',
  password: process.env.DB_PASSWORD || 'sdn_password',
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.connect()
  .then(client => {
    console.log('✅ Connected to PostgreSQL database');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err);
  });

// Dashboard API - Get system overview
app.get('/api/dashboard/summary', async (req, res) => {
  try {
    const result = await pool.query('SELECT get_dashboard_summary()');
    res.json(result.rows[0].get_dashboard_summary);
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

// Attack Detection API
app.get('/api/attacks', async (req, res) => {
  try {
    const { severity, search, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        ae.id,
        ae.event_id,
        ae.attack_type,
        ae.severity,
        ae.status,
        ae.confidence,
        ae.source_ip,
        ae.destination_ip,
        ae.source_port,
        ae.destination_port,
        ae.protocol,
        ae.packet_count,
        ae.byte_count,
        ae.detected_at,
        ae.is_confirmed,
        ae.analyst_notes,
        u.username as confirmed_by_name,
        nn.label as affected_switch_name
      FROM attack_events ae
      LEFT JOIN users u ON ae.confirmed_by = u.id
      LEFT JOIN network_nodes nn ON ae.affected_switch = nn.node_id
      WHERE ae.detected_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    `;
    
    const params = [];
    let paramIndex = 1;

    if (severity && severity !== 'all') {
      query += ` AND ae.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (search) {
      query += ` AND (ae.attack_type ILIKE $${paramIndex} OR ae.source_ip::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY ae.detected_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Attack fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attacks' });
  }
});

// Network Topology API
app.get('/api/topology', async (req, res) => {
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
        nn.last_seen,
        COALESCE(recent_attacks.attack_count, 0) as recent_attacks
      FROM network_nodes nn
      LEFT JOIN (
        SELECT 
          affected_switch,
          COUNT(*) as attack_count
        FROM attack_events
        WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
          AND affected_switch IS NOT NULL
        GROUP BY affected_switch
      ) recent_attacks ON nn.node_id = recent_attacks.affected_switch
      ORDER BY nn.node_type, nn.node_id
    `);
    
    const switches = result.rows.filter(node => node.node_type === 'switch');
    const hosts = result.rows.filter(node => node.node_type === 'host');
    const controllers = result.rows.filter(node => node.node_type === 'controller');
    
    res.json({
      switches: switches,
      hosts: hosts,
      controllers: controllers,
      links: [] // Would be populated from actual SDN controller
    });
  } catch (error) {
    console.error('Topology fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch topology' });
  }
});

// Performance Metrics API
app.get('/api/performance/current', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        component,
        metric_type,
        metric_name,
        metric_value,
        metric_unit,
        measured_at
      FROM performance_metrics pm1
      WHERE pm1.measured_at = (
        SELECT MAX(pm2.measured_at)
        FROM performance_metrics pm2
        WHERE pm2.component = pm1.component 
          AND pm2.metric_type = pm1.metric_type
          AND pm2.metric_name = pm1.metric_name
      )
      ORDER BY component, metric_type
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Performance metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Users API
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.role,
        u.status,
        u.full_name,
        u.last_login,
        u.created_at,
        CASE 
          WHEN u.last_login >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' THEN 'online'
          WHEN u.last_login >= CURRENT_TIMESTAMP - INTERVAL '1 day' THEN 'recent'
          ELSE 'offline'
        END as activity_status,
        COALESCE(actions_today.action_count, 0) as actions_today
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as action_count
        FROM audit_logs
        WHERE created_at >= CURRENT_DATE
        GROUP BY user_id
      ) actions_today ON u.id = actions_today.user_id
      ORDER BY u.last_login DESC NULLS LAST
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// System Settings API
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        category,
        setting_key,
        setting_value,
        description,
        updated_at
      FROM system_settings
      ORDER BY category, setting_key
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

app.put('/api/settings/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    await pool.query(
      'UPDATE system_settings SET setting_value = $1, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $2',
      [JSON.stringify(value), key]
    );
    
    res.json({ success: true, message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial data
  socket.emit('connected', { message: 'Connected to SDN-IDS server' });
  
  // Simulate real-time updates
  const interval = setInterval(async () => {
    try {
      // Send dashboard updates
      const dashboardResult = await pool.query('SELECT get_dashboard_summary()');
      socket.emit('dashboard_update', dashboardResult.rows[0].get_dashboard_summary);
      
      // Send recent attacks
      const attacksResult = await pool.query(`
        SELECT * FROM attack_events 
        WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '5 minutes'
        ORDER BY detected_at DESC LIMIT 5
      `);
      if (attacksResult.rows.length > 0) {
        socket.emit('new_attacks', attacksResult.rows);
      }
    } catch (error) {
      console.error('Real-time update error:', error);
    }
  }, 30000); // Update every 30 seconds
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(interval);
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 SDN-IDS Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/api/health`);
});