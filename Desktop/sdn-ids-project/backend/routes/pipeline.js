// backend/routes/pipeline.js - Pipeline Processor API Routes
import express from 'express';
import { query } from '../services/database.js';

const router = express.Router();

/**
 * GET /api/pipeline/stats
 * Get pipeline processor statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_attacks,
        COUNT(CASE WHEN detected_at > NOW() - INTERVAL '1 hour' THEN 1 END) as attacks_last_hour,
        COUNT(CASE WHEN detected_at > NOW() - INTERVAL '24 hours' THEN 1 END) as attacks_last_24h,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_attacks,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_attacks,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_attacks,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_attacks,
        AVG(confidence_score) as avg_confidence,
        AVG(inference_time_ms) as avg_inference_time
      FROM attacks
      WHERE is_attack = true
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting pipeline stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/attacks
 * Get recent attacks with pagination
 */
router.get('/attacks', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const severity = req.query.severity;
    const attackType = req.query.attackType;
    
    let whereClause = 'WHERE is_attack = true';
    let params = [limit, offset];
    let paramIndex = 3;
    
    if (severity) {
      whereClause += ` AND severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }
    
    if (attackType) {
      whereClause += ` AND attack_type = $${paramIndex}`;
      params.push(attackType);
      paramIndex++;
    }
    
    const result = await query(`
      SELECT 
        a.*,
        f.flow_duration,
        f.total_fwd_packets,
        f.total_backward_packets,
        f.flow_bytes_per_second,
        f.flow_packets_per_second
      FROM attacks a
      LEFT JOIN flows f ON a.flow_id = f.flow_id
      ${whereClause}
      ORDER BY a.detected_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    
    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM attacks
      ${whereClause}
    `, params.slice(2));
    
    res.json({
      success: true,
      data: {
        attacks: result.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting attacks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/attacks/:attackId
 * Get specific attack details
 */
router.get('/attacks/:attackId', async (req, res) => {
  try {
    const { attackId } = req.params;
    
    const result = await query(`
      SELECT 
        a.*,
        f.*
      FROM attacks a
      LEFT JOIN flows f ON a.flow_id = f.flow_id
      WHERE a.id = $1
    `, [attackId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Attack not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting attack details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/attack-stats-by-ip
 * Get attack statistics by IP address
 */
router.get('/attack-stats-by-ip', async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    const limit = parseInt(req.query.limit) || 50;
    
    const result = await query(`
      SELECT 
        src_ip,
        COUNT(*) as attack_count,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
        MAX(detected_at) as last_attack,
        MIN(detected_at) as first_attack,
        AVG(confidence_score) as avg_confidence,
        STRING_AGG(DISTINCT attack_type, ', ') as attack_types
      FROM attacks 
      WHERE is_attack = true 
        AND detected_at > NOW() - INTERVAL '${timeWindow} hours'
      GROUP BY src_ip
      ORDER BY attack_count DESC, critical_count DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting attack stats by IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/attack-types
 * Get attack type statistics
 */
router.get('/attack-types', async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    
    const result = await query(`
      SELECT 
        attack_type,
        COUNT(*) as count,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
        AVG(confidence_score) as avg_confidence,
        MAX(detected_at) as last_attack
      FROM attacks
      WHERE is_attack = true 
        AND detected_at > NOW() - INTERVAL '${timeWindow} hours'
      GROUP BY attack_type
      ORDER BY count DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting attack types:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/severity-distribution
 * Get severity distribution
 */
router.get('/severity-distribution', async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    
    const result = await query(`
      SELECT 
        severity,
        COUNT(*) as count,
        AVG(confidence_score) as avg_confidence
      FROM attacks
      WHERE is_attack = true 
        AND detected_at > NOW() - INTERVAL '${timeWindow} hours'
      GROUP BY severity
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting severity distribution:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/timeline
 * Get attack timeline data
 */
router.get('/timeline', async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    const interval = req.query.interval || '1 hour'; // 1 hour intervals
    
    const result = await query(`
      SELECT 
        DATE_TRUNC('hour', detected_at) as time_bucket,
        COUNT(*) as attack_count,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count
      FROM attacks
      WHERE is_attack = true 
        AND detected_at > NOW() - INTERVAL '${timeWindow} hours'
      GROUP BY DATE_TRUNC('hour', detected_at)
      ORDER BY time_bucket DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting attack timeline:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/pipeline/process-now
 * Trigger manual processing
 */
router.post('/process-now', async (req, res) => {
  try {
    // This would typically call the pipeline processor service
    // For now, we'll just return a success message
    res.json({
      success: true,
      message: 'Manual processing triggered'
    });
  } catch (error) {
    console.error('Error triggering manual processing:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/pipeline/model-performance
 * Get ML model performance metrics
 */
router.get('/model-performance', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        model_name,
        model_version,
        COUNT(*) as total_predictions,
        AVG(confidence_score) as avg_confidence,
        AVG(inference_time_ms) as avg_inference_time,
        COUNT(CASE WHEN is_attack = true THEN 1 END) as attack_predictions,
        COUNT(CASE WHEN is_attack = false THEN 1 END) as benign_predictions,
        MAX(detected_at) as last_prediction
      FROM attacks
      GROUP BY model_name, model_version
      ORDER BY total_predictions DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting model performance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;


