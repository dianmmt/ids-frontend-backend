import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sdn_ids_db',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 5,
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
let pool;
if (!global._pgPool) {
  pool = new Pool(dbConfig);
  global._pgPool = pool;
} else {
  pool = global._pgPool;
}

// Handle pool events
pool.on('connect', (client) => {
  console.log(`[DB] New client connected (total: ${pool.totalCount})`);
});

pool.on('error', (err, client) => {
  console.error('[DB] Unexpected error on idle client:', err);
  process.exit(-1);
});

pool.on('acquire', (client) => {
  console.log(`[DB] Client acquired (waiting: ${pool.waitingCount})`);
});

pool.on('remove', (client) => {
  console.log(`[DB] Client removed (total: ${pool.totalCount})`);
});

// Export a query function
export async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('📊 Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('❌ Query error:', error);
    throw error;
  }
}

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('[DB] Database connection successful');
    
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log(`[DB] Server time: ${result.rows[0].current_time}`);
    console.log(`[DB] PostgreSQL version: ${result.rows[0].version.split(' ')[0]}`);
    
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('system_metrics', 'performance_alerts', 'ml_performance', 'database_performance', 'network_statistics', 'system_health', 'performance_history')
    `;
    
    const tablesResult = await client.query(tablesQuery);
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    console.log('[DB] Performance monitoring tables found:', existingTables);
    
    if (existingTables.length < 7) {
      console.warn('[DB] Warning: Some performance monitoring tables are missing. Make sure to run the schema initialization scripts.');
    }
    
    client.release();
    return true;
  } catch (error) {
    console.error('[DB] Database connection failed:', error.message);
    throw error;
  }
}

// Initialize database connection
export async function initializeDatabase() {
  try {
    await testConnection();
    console.log('[DB] Database initialized successfully');
  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    throw error;
  }
}

// Graceful shutdown
export async function closeDatabase() {
  try {
    await pool.end();
    console.log('[DB] Database connections closed');
  } catch (error) {
    console.error('[DB] Error closing database connections:', error);
  }
}

// Handle process termination
process.on('SIGTERM', async () => {
  console.log('[DB] Received SIGTERM, closing database connections...');
  await closeDatabase();
});

process.on('SIGINT', async () => {
  console.log('[DB] Received SIGINT, closing database connections...');
  await closeDatabase();
  process.exit(0);
});

// Export pool for direct access if needed
export { pool };