// backend/services/userModelPreferenceService.js - User Model Preference Management
import { query } from './database.js';

export class UserModelPreferenceService {
  /**
   * Set user's preferred model for attack detection
   */
  static async setUserModelPreference(userId, modelId, selectionType = 'primary') {
    try {
      // First, deactivate any existing preferences for this user and selection type
      await query(`
        UPDATE model_selections 
        SET is_active = false 
        WHERE user_id = $1 AND selection_type = $2
      `, [userId, selectionType]);

      // Insert new preference
      const result = await query(`
        INSERT INTO model_selections (user_id, model_id, selection_type, is_active, created_at)
        VALUES ($1, $2, $3, true, NOW())
        ON CONFLICT (user_id, model_id, selection_type) 
        DO UPDATE SET is_active = true, updated_at = NOW()
        RETURNING *
      `, [userId, modelId, selectionType]);

      return result.rows[0];
    } catch (error) {
      console.error('Error setting user model preference:', error);
      throw error;
    }
  }

  /**
   * Get user's preferred model for attack detection
   */
  static async getUserModelPreference(userId, selectionType = 'primary') {
    try {
      const result = await query(`
        SELECT 
          ms.id,
          ms.user_id,
          ms.model_id,
          ms.selection_type,
          ms.is_active,
          ms.created_at,
          ms.updated_at,
          mr.name AS model_name,
          mr.model_type,
          mr.framework,
          mr.version,
          mr.accuracy,
          mr.storage_path AS model_path,
          mr.status as model_status
        FROM model_selections ms
        JOIN model_registry mr ON ms.model_id = mr.id
        WHERE ms.user_id = $1 
          AND ms.selection_type = $2
          AND ms.is_active = true
          AND mr.status = 'active'
        ORDER BY ms.updated_at DESC
        LIMIT 1
      `, [userId, selectionType]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('Error getting user model preference:', error);
      return null;
    }
  }

  /**
   * Get all user's model preferences
   */
  static async getUserModelPreferences(userId) {
    try {
      const result = await query(`
        SELECT 
          ms.id,
          ms.user_id,
          ms.model_id,
          ms.selection_type,
          ms.is_active,
          ms.created_at,
          ms.updated_at,
          mr.name AS model_name,
          mr.model_type,
          mr.framework,
          mr.version,
          mr.accuracy,
          mr.storage_path AS model_path,
          mr.status as model_status
        FROM model_selections ms
        JOIN model_registry mr ON ms.model_id = mr.id
        WHERE ms.user_id = $1
        ORDER BY ms.selection_type, ms.updated_at DESC
      `, [userId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting user model preferences:', error);
      return [];
    }
  }

  /**
   * Get model files for a specific model
   */
  static async getModelFiles(modelId) {
    try {
      const result = await query(`
        SELECT 
          file_type,
          file_path,
          file_size,
          file_hash,
          upload_status
        FROM model_files
        WHERE model_id = $1 AND upload_status = 'completed'
        ORDER BY file_type
      `, [modelId]);

      return result.rows;
    } catch (error) {
      console.error('Error getting model files:', error);
      return [];
    }
  }

  /**
   * Get complete model information with files
   */
  static async getCompleteModelInfo(modelId) {
    try {
      // Get model info
      const modelResult = await query(`
        SELECT 
          id,
          name AS model_name,
          model_type,
          framework,
          version,
          accuracy,
          storage_path AS model_path,
          status,
          created_at
        FROM model_registry
        WHERE id = $1 AND status = 'active'
      `, [modelId]);

      if (modelResult.rows.length === 0) {
        return null;
      }

      const model = modelResult.rows[0];

      // Get model files
      const files = await this.getModelFiles(modelId);
      
      // Organize files by type
      const modelFiles = {
        model: null,
        scaler: null,
        encoder: null,
        metadata: null
      };

      files.forEach(file => {
        if (modelFiles.hasOwnProperty(file.file_type)) {
          modelFiles[file.file_type] = file;
        }
      });

      return {
        ...model,
        files: modelFiles
      };
    } catch (error) {
      console.error('Error getting complete model info:', error);
      return null;
    }
  }

  /**
   * Create model_selections table if it doesn't exist
   */
  static async createTableIfNotExists() {
    try {
      await query(`
        CREATE TABLE IF NOT EXISTS model_selections (
          id BIGSERIAL PRIMARY KEY,
          user_id VARCHAR(50) NOT NULL,
          model_id UUID NOT NULL REFERENCES model_registry(id) ON DELETE CASCADE,
          selection_type VARCHAR(20) NOT NULL DEFAULT 'primary',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, model_id, selection_type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_model_selections_user_id ON model_selections(user_id);
        CREATE INDEX IF NOT EXISTS idx_model_selections_model_id ON model_selections(model_id);
        CREATE INDEX IF NOT EXISTS idx_model_selections_active ON model_selections(is_active);
      `);
      
      console.log('Model selections table created/verified successfully');
    } catch (error) {
      console.error('Error creating model_selections table:', error);
      throw error;
    }
  }
}

export default UserModelPreferenceService;
