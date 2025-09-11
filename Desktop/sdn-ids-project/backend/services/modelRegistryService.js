// backend/services/modelRegistryService.js - Model Registry Service
import { pool } from './database.js';
import crypto from 'crypto';

export async function listModels() {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, version, format, framework, description,
        sha256, size_bytes, uploaded_by, uploaded_at, is_active
      FROM model_registry 
      ORDER BY uploaded_at DESC
    `);
    
    return result.rows.map(row => ({
      id: row.id,
      name: row.name,
      version: row.version,
      format: row.format,
      framework: row.framework,
      description: row.description,
      sha256: row.sha256,
      size_bytes: row.size_bytes,
      uploaded_by: row.uploaded_by,
      uploaded_at: row.uploaded_at,
      is_active: row.is_active
    }));
  } catch (error) {
    console.error('Error listing models:', error);
    throw new Error('Failed to list models');
  }
}

export async function uploadModel({ name, version, format, framework, description, base64Content, uploadedBy, accuracy, precision_score, recall_score, f1_score, training_samples, test_samples }) {
  try {
    // Validate required fields
    if (!name || !version || !format || !base64Content) {
      throw new Error('Missing required fields: name, version, format, base64Content');
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
      
      // Insert model metadata
      const modelResult = await client.query(`
        INSERT INTO model_registry (
          name, version, format, framework, description, 
          sha256, size_bytes, uploaded_by, uploaded_at, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), false)
        RETURNING id
      `, [name, version, format, framework, description, sha256, size_bytes, uploadedBy]);
      
      const modelId = modelResult.rows[0].id;
      
      // Store model content
      await client.query(`
        INSERT INTO model_artifacts (model_id, content) VALUES ($1, $2)
      `, [modelId, content]);
      
      // Insert performance metrics if provided
      if (accuracy !== undefined || precision_score !== undefined || recall_score !== undefined || f1_score !== undefined) {
        await client.query(`
          INSERT INTO model_versions (
            model_id, version_number, performance_metrics, training_data_info
          ) VALUES ($1, $2, $3, $4)
        `, [
          modelId, 
          version,
          JSON.stringify({
            accuracy: accuracy || null,
            precision_score: precision_score || null,
            recall_score: recall_score || null,
            f1_score: f1_score || null
          }),
          JSON.stringify({
            training_samples: training_samples || null,
            test_samples: test_samples || null
          })
        ]);
      }
      
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
        uploaded_by: uploadedBy,
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
      
      // Deactivate all other models
      await client.query(`
        UPDATE model_registry 
        SET is_active = false 
        WHERE id != $1
      `, [id]);
      
      // Activate the specified model
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
      
      // Delete model artifacts
      await client.query('DELETE FROM model_artifacts WHERE model_id = $1', [id]);
      
      // Delete model versions
      await client.query('DELETE FROM model_versions WHERE model_id = $1', [id]);
      
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

export async function downloadModel(id) {
  try {
    const result = await pool.query(`
      SELECT 
        mr.name, mr.version, mr.format, mr.framework, mr.sha256, mr.size_bytes,
        ma.content
      FROM model_registry mr
      JOIN model_artifacts ma ON mr.id = ma.model_id
      WHERE mr.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      name: row.name,
      version: row.version,
      format: row.format,
      framework: row.framework,
      sha256: row.sha256,
      size_bytes: row.size_bytes,
      content: row.content
    };
    
  } catch (error) {
    console.error('Error downloading model:', error);
    throw new Error(`Failed to download model: ${error.message}`);
  }
}

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
        sha256, size_bytes, uploaded_by, uploaded_at, is_active
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





