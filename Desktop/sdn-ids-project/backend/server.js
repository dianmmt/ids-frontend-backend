import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Pool } from 'pg';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import performanceRoutes from './routes/performance.js';
import mlRoutes from './routes/ml.js';
import { initializeDatabase, closeDatabase } from './services/database.js';
import performanceScheduler from './services/performanceScheduler.js';
import config from './services/config.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: config.server.cors.origin,
    methods: ["GET", "POST"]
  }
});
const pool = new Pool(config.database);
const PORT = config.server.port || process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// CORS configuration
const corsOptions = {
  origin: config.server.cors.origin || process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing middleware (allow large model uploads)
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb' }));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - IP: ${req.ip}`);
  next();
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

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/ml', mlRoutes);

// Dashboard API
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

// Admin: counts of performance-related tables (quick ingestion check)
app.get('/api/admin/performance/counts', async (req, res) => {
  try {
    const queries = [
      pool.query("SELECT COUNT(*)::bigint AS count FROM performance_metrics"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM ml_performance"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM database_performance"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM network_statistics"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM system_health"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM performance_alerts")
    ];

    const [metrics, ml, db, net, health, alerts] = await Promise.all(queries);

    res.json({
      performance_metrics: Number(metrics.rows[0].count),
      ml_performance: Number(ml.rows[0].count),
      database_performance: Number(db.rows[0].count),
      network_statistics: Number(net.rows[0].count),
      system_health: Number(health.rows[0].count),
      performance_alerts: Number(alerts.rows[0].count)
    });
  } catch (error) {
    console.error('Admin counts error:', error);
    res.status(500).json({ error: 'Failed to fetch performance counts' });
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
      const dashboardResult = await pool.query('SELECT get_dashboard_summary()');
      socket.emit('dashboard_update', dashboardResult.rows[0].get_dashboard_summary);
      
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
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: 'connected',
    scheduler: performanceScheduler.getStatus()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(`[ERROR] ${error.stack}`);
  const isDevelopment = process.env.NODE_ENV !== 'production';
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal Server Error',
    ...(isDevelopment && { stack: error.stack })
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Initialize server
async function startServer() {
  try {
    console.log('Starting SDN-IDS Performance Monitoring Server...');
    
    // Initialize database connection
    await initializeDatabase();
    console.log('✓ Database connection established');
    
    // Start the server
    server.listen(PORT, () => {
      console.log(`✓ Server running on port ${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`✓ API endpoints available at: http://localhost:${PORT}/api`);
    });
    
    // Start performance monitoring scheduler
    performanceScheduler.start();
    console.log('✓ Performance monitoring scheduler started');
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      server.close(() => console.log('✓ HTTP server closed'));
      performanceScheduler.stop();
      console.log('✓ Performance scheduler stopped');
      await closeDatabase();
      console.log('✓ Database connections closed');
      console.log('Graceful shutdown completed');
      process.exit(0);
    };
    
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      process.exit(1);
    });
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();