import crypto from 'crypto';
import { pool } from './database.js';

function computeSha256(buffer) {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

export async function listModels() {
  const res = await pool.query(
    `SELECT id, name, version, format, framework, description, sha256, size_bytes, uploaded_by, uploaded_at, is_active
     FROM model_registry
     ORDER BY uploaded_at DESC`
  );
  return res.rows;
}

export async function getModelById(modelId) {
  const res = await pool.query(
    `SELECT mr.*, ma.content
       FROM model_registry mr
       JOIN model_artifacts ma ON ma.model_id = mr.id
      WHERE mr.id = $1`,
    [modelId]
  );
  return res.rows[0] || null;
}

export async function downloadModel(modelId) {
  const res = await pool.query(
    `SELECT mr.id, mr.name, mr.version, mr.format, mr.framework, mr.sha256, mr.size_bytes, ma.content
       FROM model_registry mr
       JOIN model_artifacts ma ON ma.model_id = mr.id
      WHERE mr.id = $1`,
    [modelId]
  );
  return res.rows[0] || null;
}

export async function uploadModel({ name, version, format, framework, description, base64Content, uploadedBy }) {
  if (!name || !version || !format || !base64Content) {
    throw new Error('name, version, format, and base64Content are required');
  }
  const normalizedFormat = format.toLowerCase();
  if (!['pkl', 'h5'].includes(normalizedFormat)) {
    throw new Error('format must be pkl or h5');
  }

  const buffer = Buffer.from(base64Content, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new Error('content is empty');
  }
  const sha256 = computeSha256(buffer);
  const sizeBytes = buffer.length;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const ins = await client.query(
      `INSERT INTO model_registry (name, version, format, framework, description, sha256, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, name, version, format, framework, description, sha256, size_bytes, uploaded_by, uploaded_at, is_active`,
      [name, version, normalizedFormat, framework || null, description || null, sha256, sizeBytes, uploadedBy || null]
    );
    const model = ins.rows[0];

    await client.query(
      `INSERT INTO model_artifacts (model_id, content) VALUES ($1, $2)`,
      [model.id, buffer]
    );

    await client.query('COMMIT');
    return model;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function setActiveModel(modelId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Fetch model name for enforcing single active per name via trigger
    const found = await client.query(`SELECT id, name FROM model_registry WHERE id = $1`, [modelId]);
    if (found.rows.length === 0) {
      throw new Error('Model not found');
    }
    await client.query(`UPDATE model_registry SET is_active = TRUE WHERE id = $1`, [modelId]);
    const updated = await client.query(`SELECT id, name, version, format, framework, sha256, size_bytes, is_active FROM model_registry WHERE id = $1`, [modelId]);
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteModel(modelId) {
  const res = await pool.query(`DELETE FROM model_registry WHERE id = $1 RETURNING id`, [modelId]);
  if (res.rows.length === 0) {
    throw new Error('Model not found');
  }
  return { id: modelId };
}


