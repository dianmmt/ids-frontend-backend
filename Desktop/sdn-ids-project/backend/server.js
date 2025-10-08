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
import mlDirectRoutes from './routes/ml-direct.js';
import mlUserAwareRoutes from './routes/ml-user-aware.js';
import attacksRoutes, { sseConnections } from './routes/attacks.js';
import topologyRoutes from './routes/topology.js';
import dashboardRoutes from './routes/dashboard.js';
import cicflowmeterRoutes from './routes/cicflowmeter.js';
import pipelineRoutes from './routes/pipeline.js';
import ipAnalyzerRoutes from './routes/ip-analyzer.js';
import modelManagementRoutes from './routes/model-management.js';
import ipBlockingRoutes from './routes/ip-blocking.js';
import { initializeDatabase, closeDatabase } from './services/database.js';
import DatabaseInitializer from './services/databaseInitializer.js';
import performanceScheduler from './services/performanceScheduler.js';
import ServiceOrchestrator from './services/serviceOrchestrator.js';
import { setSseConnections } from './services/pipelineProcessor.js';
import config from './services/config.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
// Build allowed origins list from config/env (comma-separated supported)
const allowedOrigins = typeof config.server.cors.origin === "string"
  ? config.server.cors.origin.split(",").map(o => o.trim()).filter(Boolean)
  : Array.isArray(config.server.cors.origin)
    ? config.server.cors.origin
    : [];

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/.test(origin);
      if (allowedOrigins.includes(origin) || isLocalhost) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
    credentials: true
  }
});
const pool = new Pool(config.database);
const PORT = config.server.port || process.env.PORT || 3001;

// Initialize service orchestrator
const serviceOrchestrator = new ServiceOrchestrator();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable for development
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // Tăng từ 100 lên 300 requests per window
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
// Apply rate limiting to all API routes except long-lived SSE stream
app.use('/api', (req, res, next) => {
  const url = req.originalUrl || '';
  const path = req.path || '';
  const isSseStream = req.method === 'GET' && (
    url === '/api/attacks/stream' ||
    path === '/attacks/stream'
  );
  if (isSseStream) return next();
  return limiter(req, res, next);
});

// CORS configuration
console.log('[CORS] Allowed origins:', allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    console.log('[CORS] Request origin:', origin);
    // Allow non-browser requests (e.g., curl, Postman) with no origin
    if (!origin) return callback(null, true);
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\\d+)?$/.test(origin);
    if (allowedOrigins.indexOf(origin) !== -1 || isLocalhost) {
      console.log('[CORS] Origin allowed:', origin);
      return callback(null, true);
    }
    console.log('[CORS] Origin rejected:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
  ]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

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
app.use('/api/ml-direct', mlDirectRoutes);
app.use('/api/ml-user-aware', mlUserAwareRoutes);
app.use('/api/attacks', attacksRoutes);
app.use('/api/topology', topologyRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/cicflowmeter', (req, res, next) => {
  req.serviceOrchestrator = serviceOrchestrator;
  next();
}, cicflowmeterRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/ip-analyzer', ipAnalyzerRoutes);
app.use('/api/models', modelManagementRoutes);
app.use('/api/ip-blocking', ipBlockingRoutes);


// Admin: counts of performance-related tables (quick ingestion check)
app.get('/api/admin/performance/counts', async (req, res) => {
  try {
    const queries = [
      pool.query("SELECT COUNT(*)::bigint AS count FROM performance_metrics"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM performance_metrics WHERE component = 'ml'"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM performance_metrics WHERE component = 'database'"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM network_statistics"),
      pool.query("SELECT COUNT(*)::bigint AS count FROM performance_alerts")
    ];

    const [metrics, ml, db, net, alerts] = await Promise.all(queries);

    res.json({
      performance_metrics: Number(metrics.rows[0].count),
      ml_metrics: Number(ml.rows[0].count),
      database_metrics: Number(db.rows[0].count),
      network_statistics: Number(net.rows[0].count),
      system_health: 1, // System health is calculated on-demand, not stored
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

// Removed system settings routes (table not part of consolidated schema)

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial data
  socket.emit('connected', { message: 'Connected to SDN-IDS server' });
  
  // Simulate real-time updates
  const interval = setInterval(async () => {
    try {
      // Get dashboard summary data
      const [flowsCount, attacksCount, nodesCount] = await Promise.all([
        pool.query('SELECT COUNT(*)::bigint AS count FROM flows'),
        pool.query("SELECT COUNT(*)::bigint AS count FROM attack_events WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'"),
        pool.query('SELECT COUNT(*)::bigint AS count FROM network_nodes')
      ]);
      
      const dashboardSummary = {
        flows: Number(flowsCount.rows[0].count),
        attacks_24h: Number(attacksCount.rows[0].count),
        nodes: Number(nodesCount.rows[0].count)
      };
      
      socket.emit('dashboard_update', dashboardSummary);
      
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
    scheduler: performanceScheduler.getStatus(),
    services: serviceOrchestrator.getStatus()
  });
});

// Service orchestrator endpoints
app.get('/api/services/status', (req, res) => {
  res.json(serviceOrchestrator.getStatus());
});

app.get('/api/services/stats', async (req, res) => {
  try {
    const stats = await serviceOrchestrator.getComprehensiveStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services/process-now', async (req, res) => {
  try {
    await serviceOrchestrator.triggerProcessing();
    res.json({ success: true, message: 'Processing triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services/restart/:serviceName', async (req, res) => {
  try {
    const { serviceName } = req.params;
    await serviceOrchestrator.restartService(serviceName);
    res.json({ success: true, message: `Service ${serviceName} restarted` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
    
    // Initialize database tables and default data
    await DatabaseInitializer.initialize();
    console.log('✓ Database initialization completed');
    
    // Start the server
    // ... existing code ...

// Start the server
	server.listen(PORT, '0.0.0.0', () => {
	  console.log(`✓ Server running on port ${PORT}`);
	  console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
	  console.log(`✓ API endpoints available at: http://0.0.0.0:${PORT}/api`);
	  console.log(`✓ Server accessible from all network interfaces`);
	});
// ... existing code ...
    
    // Start performance monitoring scheduler
    performanceScheduler.start();
    console.log('✓ Performance monitoring scheduler started');
    
    // Start service orchestrator (CICFlowMeter pipeline)
    await serviceOrchestrator.start();
    console.log('✓ Service orchestrator started');
    
    // Connect SSE connections to PipelineProcessor for attack notifications
    setSseConnections(sseConnections);
    console.log('✓ SSE connections linked to PipelineProcessor');
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      console.log(`\nReceived ${signal}, shutting down gracefully...`);
      server.close(() => console.log('✓ HTTP server closed'));
      performanceScheduler.stop();
      console.log('✓ Performance scheduler stopped');
      await serviceOrchestrator.stop();
      console.log('✓ Service orchestrator stopped');
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