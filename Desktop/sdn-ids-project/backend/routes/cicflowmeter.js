// backend/routes/cicflowmeter.js - CICFlowMeter API Routes
import express from 'express';
import { query } from '../services/database.js';

const router = express.Router();

/**
 * GET /api/cicflowmeter/stats
 * Get CICFlowMeter collector statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(*) as total_flows,
        COUNT(CASE WHEN is_processed = false THEN 1 END) as unprocessed_flows,
        COUNT(CASE WHEN captured_at > NOW() - INTERVAL '1 hour' THEN 1 END) as flows_last_hour,
        COUNT(CASE WHEN captured_at > NOW() - INTERVAL '24 hours' THEN 1 END) as flows_last_24h,
        MIN(captured_at) as oldest_flow,
        MAX(captured_at) as newest_flow,
        AVG(flow_duration) as avg_flow_duration,
        AVG(total_fwd_packets + total_backward_packets) as avg_packet_count
      FROM flows
    `);
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting CICFlowMeter stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cicflowmeter/flows
 * Get recent flows with pagination
 */
router.get('/flows', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const processed = req.query.processed;
    
    let whereClause = '';
    let params = [limit, offset];
    
    if (processed !== undefined) {
      whereClause = 'WHERE is_processed = $3';
      params = [limit, offset, processed === 'true'];
    }
    
    const result = await query(`
      SELECT 
        flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
        flow_duration, total_fwd_packets, total_backward_packets,
        flow_bytes_per_second, flow_packets_per_second,
        is_processed, processed_at, flow_start_time, captured_at
      FROM flows
      ${whereClause}
      ORDER BY captured_at DESC
      LIMIT $1 OFFSET $2
    `, params);
    
    // Get total count
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM flows
      ${whereClause}
    `, processed !== undefined ? [processed === 'true'] : []);
    
    res.json({
      success: true,
      data: {
        flows: result.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting flows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cicflowmeter/flows/:flowId
 * Get specific flow details
 */
router.get('/flows/:flowId', async (req, res) => {
  try {
    const { flowId } = req.params;
    
    const result = await query(`
      SELECT *
      FROM flows
      WHERE flow_id = $1
    `, [flowId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting flow details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cicflowmeter/top-ips
 * Get top source IPs by flow count
 */
router.get('/top-ips', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    
    const result = await query(`
      SELECT 
        src_ip,
        COUNT(*) as flow_count,
        COUNT(CASE WHEN is_processed = true THEN 1 END) as processed_count,
        AVG(flow_duration) as avg_duration,
        SUM(total_fwd_packets + total_backward_packets) as total_packets,
        SUM(total_length_of_fwd_packets + total_length_of_bwd_packets) as total_bytes,
        MAX(captured_at) as last_flow
      FROM flows
      WHERE captured_at > NOW() - INTERVAL '${timeWindow} hours'
      GROUP BY src_ip
      ORDER BY flow_count DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting top IPs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/cicflowmeter/protocol-stats
 * Get protocol statistics
 */
router.get('/protocol-stats', async (req, res) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    
    const result = await query(`
      SELECT 
        protocol,
        COUNT(*) as flow_count,
        COUNT(CASE WHEN is_processed = true THEN 1 END) as processed_count,
        AVG(flow_duration) as avg_duration,
        AVG(total_fwd_packets + total_backward_packets) as avg_packets,
        AVG(flow_bytes_per_second) as avg_bytes_per_second
      FROM flows
      WHERE captured_at > NOW() - INTERVAL '${timeWindow} hours'
      GROUP BY protocol
      ORDER BY flow_count DESC
    `);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting protocol stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/cicflowmeter/reset-processing
 * Reset processing status for flows (for debugging)
 */
router.post('/reset-processing', async (req, res) => {
  try {
    const { flowIds } = req.body;
    
    let result;
    if (flowIds && flowIds.length > 0) {
      result = await query(`
        UPDATE flows 
        SET is_processed = false, processed_at = NULL
        WHERE flow_id = ANY($1)
      `, [flowIds]);
    } else {
      result = await query(`
        UPDATE flows 
        SET is_processed = false, processed_at = NULL
        WHERE is_processed = true
      `);
    }
    
    res.json({
      success: true,
      message: `Reset processing status for ${result.rowCount} flows`,
      affectedRows: result.rowCount
    });
  } catch (error) {
    console.error('Error resetting processing status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/cicflowmeter/cleanup
 * Clean up old processed flows
 */
router.delete('/cleanup', async (req, res) => {
  try {
    const daysToKeep = parseInt(req.query.days) || 7;
    
    const result = await query(`
      SELECT cleanup_old_flows($1) as deleted_count
    `, [daysToKeep]);
    
    const deletedCount = result.rows[0].deleted_count;
    
    res.json({
      success: true,
      message: `Cleaned up ${deletedCount} old flows`,
      deletedCount
    });
  } catch (error) {
    console.error('Error cleaning up old flows:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;


