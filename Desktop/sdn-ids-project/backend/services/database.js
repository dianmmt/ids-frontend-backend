// File: backend/services/database.js

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Database configuration
const dbConfig = {
  user: process.env.DB_USER || 'sdn_user',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sdn_ids',
  password: process.env.DB_PASSWORD || 'sdn_password',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,

  // Connection pool settings
  max: process.env.DB_POOL_MAX ? parseInt(process.env.DB_POOL_MAX) : 20,
  min: process.env.DB_POOL_MIN ? parseInt(process.env.DB_POOL_MIN) : 5,
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT ? parseInt(process.env.DB_IDLE_TIMEOUT) : 30000,
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT ? parseInt(process.env.DB_CONNECTION_TIMEOUT) : 2000,

  // SSL configuration (for production)
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
export const pool = new Pool(dbConfig);
// Query helper
export const query = (text, params) => pool.query(text, params);

// Handle pool events
pool.on('connect', () => {
  console.log(`[DB] New client connected (total: ${pool.totalCount})`);
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client:', err);
});

pool.on('acquire', () => {
  console.log(`[DB] Client acquired (waiting: ${pool.waitingCount})`);
});

pool.on('remove', () => {
  console.log(`[DB] Client removed (total: ${pool.totalCount})`);
});

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('[DB] Database connection successful');

    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log(`[DB] Server time: ${result.rows[0].current_time}`);
    console.log(`[DB] PostgreSQL version: ${result.rows[0].version.split(' ')[0]}`);

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
