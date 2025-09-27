// backend/services/databaseInitializer.js - Database Initialization Service
import { query } from './database.js';
import UserModelPreferenceService from './userModelPreferenceService.js';
import fs from 'fs';
import path from 'path';

export class DatabaseInitializer {
  /**
   * Initialize all database tables and data
   */
  static async initialize() {
    try {
      console.log('🔧 Initializing database...');
      
      // Create model_selections table
      await UserModelPreferenceService.createTableIfNotExists();
      console.log('✅ Model selections table ready');
      
      // Run migration scripts
      await this.runMigrations();
      console.log('✅ Database migrations completed');
      
      // Set default model preferences
      await this.setDefaultModelPreferences();
      console.log('✅ Default model preferences set');
      
      console.log('🎉 Database initialization completed successfully');
      
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Run database migration scripts
   */
  static async runMigrations() {
    try {
      const migrationPath = path.join(process.cwd(), '..', 'database', 'migration_add_model_selections.sql');
      
      if (fs.existsSync(migrationPath)) {
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        await query(migrationSQL);
        console.log('✅ Model selections migration applied');
      } else {
        console.log('⚠️  Migration file not found, creating table manually');
        await UserModelPreferenceService.createTableIfNotExists();
      }
    } catch (error) {
      console.error('Error running migrations:', error);
      // Don't throw - table might already exist
    }
  }

  /**
   * Set default model preferences for users
   */
  static async setDefaultModelPreferences() {
    try {
      // Check if there are any active models
      const activeModelsResult = await query(`
        SELECT id, name as model_name, framework, accuracy
        FROM model_registry 
        WHERE status = 'active'
        ORDER BY accuracy DESC, created_at DESC
        LIMIT 1
      `);

      if (activeModelsResult.rows.length === 0) {
        console.log('⚠️  No active models found, skipping default preferences');
        return;
      }

      const defaultModel = activeModelsResult.rows[0];
      console.log(`📋 Setting default model: ${defaultModel.model_name} (${defaultModel.framework})`);

      // Set default preference for user 1 (admin) if not exists
      const existingPreference = await query(`
        SELECT id FROM model_selections 
        WHERE user_id = '1' AND selection_type = 'primary' AND is_active = true
      `);

      if (existingPreference.rows.length === 0) {
        await UserModelPreferenceService.setUserModelPreference('1', defaultModel.id, 'primary');
        console.log(`✅ Default model preference set for user 1: ${defaultModel.model_name}`);
      } else {
        console.log('✅ Default model preference already exists for user 1');
      }

    } catch (error) {
      console.error('Error setting default model preferences:', error);
      // Don't throw - this is not critical
    }
  }

  /**
   * Get database initialization status
   */
  static async getStatus() {
    try {
      // Check if model_selections table exists
      const tableCheck = await query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'model_selections'
        );
      `);

      const tableExists = tableCheck.rows[0].exists;

      // Check if there are any model preferences
      let preferencesCount = 0;
      if (tableExists) {
        const countResult = await query('SELECT COUNT(*) as count FROM model_selections WHERE is_active = true');
        preferencesCount = parseInt(countResult.rows[0].count);
      }

      // Check active models count
      const modelsResult = await query('SELECT COUNT(*) as count FROM model_registry WHERE status = \'active\'');
      const activeModelsCount = parseInt(modelsResult.rows[0].count);

      return {
        initialized: tableExists,
        modelSelectionsTable: tableExists,
        activePreferences: preferencesCount,
        activeModels: activeModelsCount,
        status: tableExists ? 'ready' : 'needs_initialization'
      };
    } catch (error) {
      console.error('Error getting database status:', error);
      return {
        initialized: false,
        modelSelectionsTable: false,
        activePreferences: 0,
        activeModels: 0,
        status: 'error',
        error: error.message
      };
    }
  }
}

export default DatabaseInitializer;
