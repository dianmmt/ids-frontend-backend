// backend/routes/ip-analyzer.js - IP Analyzer API Routes
import express from 'express';
import { query } from '../services/database.js';

const router = express.Router();

/**
 * GET /api/ip-analyzer/stats
 * Get IP analyzer statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        COUNT(DISTINCT src_ip) as unique_attack_ips,
        COUNT(*) as total_attacks,
        COUNT(CASE WHEN detected_at > NOW() - INTERVAL '1 hour' THEN 1 END) as attacks_last_hour,
        COUNT(CASE WHEN detected_at > NOW() - INTERVAL '24 hours' THEN 1 END) as attacks_last_24h
      FROM attacks 
      WHERE is_attack = true
    `);
    
    // Get blocked IPs count
    const blockedResult = await query(`
      SELECT 
        COUNT(*) as total_blocked,
        COUNT(CASE WHEN is_active = true THEN 1 END) as active_blocks,
        COUNT(CASE WHEN blocked_at > NOW() - INTERVAL '24 hours' THEN 1 END) as blocked_last_24h
      FROM blocked_ips
    `);
    
    res.json({
      success: true,
      data: {
        ...result.rows[0],
        ...blockedResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting IP analyzer stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ip-analyzer/blocked-ips
 * Get blocked IP addresses
 */
router.get('/blocked-ips', async (req, res) => {
  try {
    const activeOnly = req.query.active !== 'false'; // Default to true
    const limit = parseInt(req.query.limit) || 100;
    
    let whereClause = '';
    if (activeOnly) {
      whereClause = 'WHERE is_active = true';
    }
    
    const result = await query(`
      SELECT 
        id, ip_address, block_reason, attack_count, time_window_minutes,
        blocked_at, unblocked_at, is_active, created_at
      FROM blocked_ips
      ${whereClause}
      ORDER BY blocked_at DESC
      LIMIT $1
    `, [limit]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting blocked IPs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ip-analyzer/top-attacking-ips
 * Get top attacking IP addresses
 */
router.get('/top-attacking-ips', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    
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
    console.error('Error getting top attacking IPs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ip-analyzer/ip-details/:ipAddress
 * Get detailed information about a specific IP
 */
router.get('/ip-details/:ipAddress', async (req, res) => {
  try {
    const { ipAddress } = req.params;
    const timeWindow = parseInt(req.query.timeWindow) || 24; // hours
    
    // Get attack statistics for the IP
    const attackStats = await query(`
      SELECT 
        COUNT(*) as total_attacks,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
        MAX(detected_at) as last_attack,
        MIN(detected_at) as first_attack,
        AVG(confidence_score) as avg_confidence,
        STRING_AGG(DISTINCT attack_type, ', ') as attack_types,
        STRING_AGG(DISTINCT dst_ip, ', ') as target_ips
      FROM attacks 
      WHERE src_ip = $1 
        AND is_attack = true 
        AND detected_at > NOW() - INTERVAL '${timeWindow} hours'
    `, [ipAddress]);
    
    // Get recent attacks from this IP
    const recentAttacks = await query(`
      SELECT 
        a.*,
        f.flow_duration,
        f.total_fwd_packets,
        f.total_backward_packets
      FROM attacks a
      LEFT JOIN flows f ON a.flow_id = f.flow_id
      WHERE a.src_ip = $1 
        AND a.is_attack = true 
        AND a.detected_at > NOW() - INTERVAL '${timeWindow} hours'
      ORDER BY a.detected_at DESC
      LIMIT 10
    `, [ipAddress]);
    
    // Check if IP is currently blocked
    const blockedStatus = await query(`
      SELECT *
      FROM blocked_ips
      WHERE ip_address = $1 AND is_active = true
    `, [ipAddress]);
    
    res.json({
      success: true,
      data: {
        ip_address: ipAddress,
        attack_stats: attackStats.rows[0],
        recent_attacks: recentAttacks.rows,
        blocked_status: blockedStatus.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Error getting IP details:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ip-analyzer/block-ip
 * Manually block an IP address
 */
router.post('/block-ip', async (req, res) => {
  try {
    const { ipAddress, reason } = req.body;
    
    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }
    
    // Check if IP is already blocked
    const existingBlock = await query(`
      SELECT id FROM blocked_ips 
      WHERE ip_address = $1 AND is_active = true
    `, [ipAddress]);
    
    if (existingBlock.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'IP address is already blocked'
      });
    }
    
    // Get attack count for the IP
    const attackCount = await query(`
      SELECT COUNT(*) as count
      FROM attacks 
      WHERE src_ip = $1 AND is_attack = true 
        AND detected_at > NOW() - INTERVAL '24 hours'
    `, [ipAddress]);
    
    // Log the block
    const result = await query(`
      INSERT INTO blocked_ips (
        ip_address, block_reason, attack_count, time_window_minutes,
        blocked_at, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, [
      ipAddress,
      reason || 'Manual block',
      parseInt(attackCount.rows[0].count),
      1440, // 24 hours in minutes
      new Date().toISOString(),
      true
    ]);
    
    res.json({
      success: true,
      message: `IP ${ipAddress} blocked successfully`,
      block_id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error blocking IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ip-analyzer/unblock-ip
 * Manually unblock an IP address
 */
router.post('/unblock-ip', async (req, res) => {
  try {
    const { ipAddress, reason } = req.body;
    
    if (!ipAddress) {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }
    
    // Update the block record
    const result = await query(`
      UPDATE blocked_ips 
      SET is_active = false, unblocked_at = NOW()
      WHERE ip_address = $1 AND is_active = true
      RETURNING id
    `, [ipAddress]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'IP address is not currently blocked'
      });
    }
    
    res.json({
      success: true,
      message: `IP ${ipAddress} unblocked successfully`,
      block_id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error unblocking IP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ip-analyzer/whitelist
 * Get whitelisted IPs (if implemented)
 */
router.get('/whitelist', async (req, res) => {
  try {
    // This would query a whitelist table if implemented
    // For now, return empty array
    res.json({
      success: true,
      data: []
    });
  } catch (error) {
    console.error('Error getting whitelist:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ip-analyzer/analyze-now
 * Trigger manual IP analysis
 */
router.post('/analyze-now', async (req, res) => {
  try {
    // This would typically call the IP analyzer service
    // For now, we'll just return a success message
    res.json({
      success: true,
      message: 'Manual IP analysis triggered'
    });
  } catch (error) {
    console.error('Error triggering manual analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ip-analyzer/block-history
 * Get IP blocking history
 */
router.get('/block-history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const ipAddress = req.query.ip;
    
    let whereClause = '';
    let params = [limit];
    
    if (ipAddress) {
      whereClause = 'WHERE ip_address = $2';
      params.push(ipAddress);
    }
    
    const result = await query(`
      SELECT *
      FROM blocked_ips
      ${whereClause}
      ORDER BY blocked_at DESC
      LIMIT $1
    `, params);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error getting block history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;


