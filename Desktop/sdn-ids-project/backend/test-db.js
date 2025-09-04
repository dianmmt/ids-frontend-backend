import { pool } from './services/database.js';

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📊 Query test successful:', result.rows[0]);
    
    // Test users table
    const usersResult = await client.query('SELECT COUNT(*) as user_count FROM users');
    console.log('👥 Users table accessible:', usersResult.rows[0]);
    
    // Test dashboard function
    try {
      const dashboardResult = await client.query('SELECT get_dashboard_summary()');
      console.log('📈 Dashboard function working');
    } catch (error) {
      console.log('⚠️ Dashboard function not available (schema may not be imported yet)');
    }
    
    client.release();
    console.log('🎉 Database test completed successfully');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();
