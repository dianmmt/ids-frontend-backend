// backend/services/modelRegistryService.js - Model Registry Service
import { pool } from './database.js';
import crypto from 'crypto';

export async function listModels() {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, version, format, framework, description,
        accuracy, precision_score, recall_score, f1_score,
        training_samples, test_samples,
        sha256, size_bytes, uploaded_by, created_at, is_active
      FROM model_registry 
      ORDER BY created_at DESC
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      version: row.version,
      format: row.format,
      framework: row.framework,
      description: row.description,
      accuracy: row.accuracy,
      precision_score: row.precision_score,
      recall_score: row.recall_score,
      f1_score: row.f1_score,
      training_samples: row.training_samples,
      test_samples: row.test_samples,
      sha256: row.sha256,
      size_bytes: row.size_bytes,
      uploaded_by: row.uploaded_by,
      uploaded_at: row.created_at,
      created_at: row.created_at,
      is_active: row.is_active
    }));
  } catch (error) {
    console.error('Error listing models:', error);
    throw new Error('Failed to list models');
  }
}

export async function uploadModel({ name, version, format, framework, model_type, description, base64Content, uploadedBy, accuracy, precision_score, recall_score, f1_score, training_samples, test_samples }) {
  try {
    // Validate required fields
    if (!name || !version || !format || !base64Content || !model_type) {
      throw new Error('Missing required fields: name, version, format, base64Content, model_type');
    }
    
    // Validate format
    const validFormats = ['pkl', 'h5', 'joblib'];
    if (!validFormats.includes(format)) {
      throw new Error(`Invalid format. Must be one of: ${validFormats.join(', ')}`);
    }
    
    // Decode base64 content
    const content = Buffer.from(base64Content, 'base64');
    const size_bytes = content.length;
    
    // Calculate SHA256 hash
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    
    // Check if model already exists
    const existing = await pool.query(
      'SELECT id FROM model_registry WHERE name = $1 AND version = $2',
      [name, version]
    );
    
    if (existing.rows.length > 0) {
      throw new Error(`Model ${name} version ${version} already exists`);
    }
    
    // Start transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert model metadata (new schema columns)
      const modelResult = await client.query(`
        INSERT INTO model_registry (
          name, version, format, framework, model_type, description,
          accuracy, precision_score, recall_score, f1_score,
          training_samples, test_samples,
          sha256, size_bytes, uploaded_by, status, upload_status, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'active', 'ready', false)
        RETURNING id
      `, [
        name, version, format, framework, model_type, description,
        accuracy ?? null, precision_score ?? null, recall_score ?? null, f1_score ?? null,
        training_samples ?? null, test_samples ?? null,
        sha256, size_bytes, uploadedBy || null
      ]);
      
      const modelId = modelResult.rows[0].id;
      
      // Store model content in model_files (database storage)
      await client.query(`
        INSERT INTO model_files (
          model_id, file_name, file_type, file_size, file_hash,
          upload_status, storage_type, content
        ) VALUES ($1, $2, 'model', $3, $4, 'completed', 'database', $5)
      `, [
        modelId,
        `${name}.${format}`,
        size_bytes,
        sha256,
        content
      ]);
      
      await client.query('COMMIT');
      
      return {
        id: modelId,
        name,
        version,
        format,
        framework,
        description,
        sha256,
        size_bytes,
        uploaded_by: uploadedBy || null,
        uploaded_at: new Date().toISOString(),
        is_active: false
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error uploading model:', error);
    throw new Error(`Failed to upload model: ${error.message}`);
  }
}

export async function setActiveModel(id) {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Activate the specified model (allow multiple active models)
      const result = await client.query(`
        UPDATE model_registry 
        SET is_active = true 
        WHERE id = $1 
        RETURNING id, name, version, format, framework, is_active
      `, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Model not found');
      }
      
      await client.query('COMMIT');
      
      return result.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error setting active model:', error);
    throw new Error(`Failed to set active model: ${error.message}`);
  }
}

export async function setInactiveModel(id) {
  try {
    const result = await pool.query(`
      UPDATE model_registry 
      SET is_active = false 
      WHERE id = $1 
      RETURNING id, name, version, format, framework, is_active
    `, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Model not found');
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Error setting inactive model:', error);
    throw new Error(`Failed to set inactive model: ${error.message}`);
  }
}

export async function deleteModel(id) {
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if model exists
      const modelCheck = await client.query(
        'SELECT id, is_active FROM model_registry WHERE id = $1',
        [id]
      );
      
      if (modelCheck.rows.length === 0) {
        throw new Error('Model not found');
      }
      
      if (modelCheck.rows[0].is_active) {
        throw new Error('Cannot delete active model. Please deactivate it first.');
      }
      
      // Delete model files
      await client.query('DELETE FROM model_files WHERE model_id = $1', [id]);
      
      // Delete model registry entry
      await client.query('DELETE FROM model_registry WHERE id = $1', [id]);
      
      await client.query('COMMIT');
      
      return {
        id,
        message: 'Model deleted successfully'
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Error deleting model:', error);
    throw new Error(`Failed to delete model: ${error.message}`);
  }
}

// Download functionality removed - models are managed in database only

export async function getModelById(id) {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, version, format, framework, description,
        sha256, size_bytes, uploaded_by, uploaded_at, is_active
      FROM model_registry 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Error getting model by ID:', error);
    throw new Error(`Failed to get model: ${error.message}`);
  }
}

export async function getActiveModel() {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, version, format, framework, description,
        accuracy, precision_score, recall_score, f1_score,
        training_samples, test_samples,
        sha256, size_bytes, uploaded_by, created_at, is_active
      FROM model_registry 
      WHERE is_active = true
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Error getting active model:', error);
    throw new Error(`Failed to get active model: ${error.message}`);
  }
}

export async function getAllActiveModels() {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, version, format, framework, description,
        accuracy, precision_score, recall_score, f1_score,
        training_samples, test_samples,
        sha256, size_bytes, uploaded_by, created_at, is_active
      FROM model_registry 
      WHERE is_active = true
      ORDER BY created_at DESC
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      version: row.version,
      format: row.format,
      framework: row.framework,
      description: row.description,
      accuracy: row.accuracy,
      precision_score: row.precision_score,
      recall_score: row.recall_score,
      f1_score: row.f1_score,
      training_samples: row.training_samples,
      test_samples: row.test_samples,
      sha256: row.sha256,
      size_bytes: row.size_bytes,
      uploaded_by: row.uploaded_by,
      created_at: row.created_at,
      is_active: row.is_active
    }));
    
  } catch (error) {
    console.error('Error getting all active models:', error);
    throw new Error(`Failed to get active models: ${error.message}`);
  }
}

export async function updateModelMetadata(id, updates) {
  try {
    const allowedFields = ['name', 'version', 'description', 'framework'];
    const updateFields = [];
    const values = [];
    let paramCount = 1;
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }
    
    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }
    
    values.push(id);
    
    const result = await pool.query(`
      UPDATE model_registry 
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramCount}
      RETURNING id, name, version, format, framework, description, is_active
    `, values);
    
    if (result.rows.length === 0) {
      throw new Error('Model not found');
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Error updating model metadata:', error);
    throw new Error(`Failed to update model: ${error.message}`);
  }
}





