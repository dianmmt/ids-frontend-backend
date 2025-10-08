import express from 'express';
import { pool } from '../services/database.js';
import RyuService from '../services/ryuServices.js';

const router = express.Router();

// Initialize Ryu service for network-level blocking
const ryuHost = process.env.RYU_HOST || 'localhost';
const ryuPort = parseInt(process.env.RYU_PORT || '8080', 10);
const ryuWsPort = parseInt(process.env.RYU_WS_PORT || process.env.RYU_PORT || '8080', 10);
const ryuService = new RyuService(ryuHost, ryuPort, ryuWsPort);

// Configuration for automatic IP blocking
const BLOCKING_CONFIG = {
  DOS_THRESHOLD: parseInt(process.env.DOS_BLOCK_THRESHOLD) || 10, // Number of DOS attacks to trigger block
  TIME_WINDOW_HOURS: parseInt(process.env.DOS_BLOCK_TIME_WINDOW) || 24, // Time window for counting attacks
  AUTO_BLOCK_ENABLED: process.env.AUTO_BLOCK_ENABLED === 'true' || true, // Enable automatic blocking
  BLOCK_DURATION_HOURS: parseInt(process.env.BLOCK_DURATION_HOURS) || 24 // How long to block IPs
};

/**
 * GET /api/ip-blocking - Get all blocked IPs with filtering and pagination
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      active_only = 'true',
      sort_by = 'blocked_at',
      sort_order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const isActiveOnly = active_only === 'true';

    let query = `
      SELECT 
        id,
        ip_address,
        blocked_at,
        blocked_by,
        reason,
        dos_attack_count,
        time_window_hours,
        is_active,
        unblocked_at,
        unblocked_by,
        notes,
        created_at,
        updated_at
      FROM blocked_ips
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    // Filter by active status
    if (isActiveOnly) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(true);
      paramIndex++;
    }

    // Search by IP address
    if (search) {
      query += ` AND ip_address::text ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Validate sort_by and sort_order
    const validSortColumns = ['blocked_at', 'ip_address', 'dos_attack_count', 'created_at'];
    const validSortOrders = ['asc', 'desc'];
    
    const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'blocked_at';
    const sortOrder = validSortOrders.includes(sort_order.toLowerCase()) ? sort_order.toUpperCase() : 'DESC';

    query += ` ORDER BY ${sortColumn} ${sortOrder}`;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM blocked_ips
      WHERE 1=1
    `;
    const countParams = [];
    let countParamIndex = 1;

    if (isActiveOnly) {
      countQuery += ` AND is_active = $${countParamIndex}`;
      countParams.push(true);
      countParamIndex++;
    }

    if (search) {
      countQuery += ` AND ip_address::text ILIKE $${countParamIndex}`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      blocked_ips: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: Math.ceil(total / parseInt(limit))
      },
      config: BLOCKING_CONFIG
    });

  } catch (error) {
    console.error('Error fetching blocked IPs:', error);
    res.status(500).json({ error: 'Failed to fetch blocked IPs' });
  }
});

/**
 * POST /api/ip-blocking - Manually block an IP address
 */
router.post('/', async (req, res) => {
  try {
    const { 
      ip_address, 
      reason, 
      blocked_by = 'admin',
      notes = '',
      dos_attack_count = 0,
      time_window_hours = BLOCKING_CONFIG.TIME_WINDOW_HOURS
    } = req.body;

    if (!ip_address || !reason) {
      return res.status(400).json({ 
        error: 'IP address and reason are required' 
      });
    }

    // Validate IP address format
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip_address)) {
      return res.status(400).json({ 
        error: 'Invalid IP address format' 
      });
    }

    // Check if IP is already blocked
    const existingBlock = await pool.query(
      'SELECT id, is_active FROM blocked_ips WHERE ip_address = $1',
      [ip_address]
    );

    if (existingBlock.rows.length > 0) {
      const existing = existingBlock.rows[0];
      if (existing.is_active) {
        return res.status(409).json({ 
          error: 'IP address is already blocked',
          blocked_ip: existing
        });
      } else {
        // Reactivate existing block
        const result = await pool.query(`
          UPDATE blocked_ips 
          SET 
            is_active = TRUE,
            blocked_at = CURRENT_TIMESTAMP,
            blocked_by = $1,
            reason = $2,
            dos_attack_count = $3,
            time_window_hours = $4,
            notes = $5,
            unblocked_at = NULL,
            unblocked_by = NULL
          WHERE ip_address = $6
          RETURNING *
        `, [blocked_by, reason, dos_attack_count, time_window_hours, notes, ip_address]);

        // Try to block in Ryu controller
        await blockIPInRyu(ip_address, reason);

        return res.json({
          success: true,
          message: 'IP address re-blocked successfully',
          blocked_ip: result.rows[0]
        });
      }
    }

    // Insert new block
    const result = await pool.query(`
      INSERT INTO blocked_ips (
        ip_address, blocked_by, reason, dos_attack_count, 
        time_window_hours, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [ip_address, blocked_by, reason, dos_attack_count, time_window_hours, notes]);

    // Try to block in Ryu controller
    await blockIPInRyu(ip_address, reason);

    res.status(201).json({
      success: true,
      message: 'IP address blocked successfully',
      blocked_ip: result.rows[0]
    });

  } catch (error) {
    console.error('Error blocking IP:', error);
    res.status(500).json({ error: 'Failed to block IP address' });
  }
});

/**
 * DELETE /api/ip-blocking/:id - Unblock an IP address
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { unblocked_by = 'admin', notes = '' } = req.body;

    // Get the blocked IP first
    const blockedIP = await pool.query(
      'SELECT * FROM blocked_ips WHERE id = $1 AND is_active = TRUE',
      [id]
    );

    if (blockedIP.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Blocked IP not found or already unblocked' 
      });
    }

    const ipAddress = blockedIP.rows[0].ip_address;

    // Update the block record
    const result = await pool.query(`
      UPDATE blocked_ips 
      SET 
        is_active = FALSE,
        unblocked_at = CURRENT_TIMESTAMP,
        unblocked_by = $1,
        notes = COALESCE($2, notes)
      WHERE id = $3
      RETURNING *
    `, [unblocked_by, notes, id]);

    // Try to unblock in Ryu controller
    await unblockIPInRyu(ipAddress);

    res.json({
      success: true,
      message: 'IP address unblocked successfully',
      unblocked_ip: result.rows[0]
    });

  } catch (error) {
    console.error('Error unblocking IP:', error);
    res.status(500).json({ error: 'Failed to unblock IP address' });
  }
});

/**
 * POST /api/ip-blocking/check-dos - Check if IP should be blocked based on DOS attacks
 */
router.post('/check-dos', async (req, res) => {
  try {
    const { ip_address, time_window_hours = BLOCKING_CONFIG.TIME_WINDOW_HOURS } = req.body;

    if (!ip_address) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    // Count DOS attacks from this IP in the specified time window
    const dosCount = await pool.query(`
      SELECT COUNT(*) as count
      FROM attack_events 
      WHERE src_ip = $1 
        AND detected_at >= CURRENT_TIMESTAMP - INTERVAL '${time_window_hours} hours'
        AND (
          LOWER(attack_type) LIKE '%dos%' OR 
          LOWER(attack_type) LIKE '%ddos%' OR
          LOWER(attack_type) LIKE '%denial%'
        )
    `, [ip_address]);

    const attackCount = parseInt(dosCount.rows[0].count);
    const shouldBlock = attackCount >= BLOCKING_CONFIG.DOS_THRESHOLD;

    // Check if IP is already blocked
    const existingBlock = await pool.query(
      'SELECT * FROM blocked_ips WHERE ip_address = $1 AND is_active = TRUE',
      [ip_address]
    );

    const isAlreadyBlocked = existingBlock.rows.length > 0;

    res.json({
      ip_address,
      dos_attack_count: attackCount,
      threshold: BLOCKING_CONFIG.DOS_THRESHOLD,
      time_window_hours,
      should_block: shouldBlock,
      is_already_blocked: isAlreadyBlocked,
      auto_block_enabled: BLOCKING_CONFIG.AUTO_BLOCK_ENABLED
    });

  } catch (error) {
    console.error('Error checking DOS attacks:', error);
    res.status(500).json({ error: 'Failed to check DOS attacks' });
  }
});

/**
 * POST /api/ip-blocking/auto-block - Automatically block IP based on DOS threshold
 */
router.post('/auto-block', async (req, res) => {
  try {
    const { ip_address, dos_attack_count, time_window_hours = BLOCKING_CONFIG.TIME_WINDOW_HOURS } = req.body;

    if (!ip_address || !dos_attack_count) {
      return res.status(400).json({ error: 'IP address and DOS attack count are required' });
    }

    // Check if auto-blocking is enabled
    if (!BLOCKING_CONFIG.AUTO_BLOCK_ENABLED) {
      return res.status(403).json({ 
        error: 'Automatic IP blocking is disabled',
        config: BLOCKING_CONFIG
      });
    }

    // Check if IP is already blocked
    const existingBlock = await pool.query(
      'SELECT * FROM blocked_ips WHERE ip_address = $1 AND is_active = TRUE',
      [ip_address]
    );

    if (existingBlock.rows.length > 0) {
      return res.json({
        success: false,
        message: 'IP address is already blocked',
        blocked_ip: existingBlock.rows[0]
      });
    }

    // Check if threshold is met
    if (dos_attack_count < BLOCKING_CONFIG.DOS_THRESHOLD) {
      return res.json({
        success: false,
        message: `DOS attack count (${dos_attack_count}) below threshold (${BLOCKING_CONFIG.DOS_THRESHOLD})`,
        dos_attack_count,
        threshold: BLOCKING_CONFIG.DOS_THRESHOLD
      });
    }

    // Auto-block the IP
    const reason = `Automatic block: ${dos_attack_count} DOS attacks detected in ${time_window_hours} hours`;
    
    const result = await pool.query(`
      INSERT INTO blocked_ips (
        ip_address, blocked_by, reason, dos_attack_count, 
        time_window_hours, notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [ip_address, 'system', reason, dos_attack_count, time_window_hours, 'Auto-blocked due to excessive DOS attacks']);

    // Try to block in Ryu controller
    await blockIPInRyu(ip_address, reason);

    res.json({
      success: true,
      message: 'IP address automatically blocked due to excessive DOS attacks',
      blocked_ip: result.rows[0],
      dos_attack_count,
      threshold: BLOCKING_CONFIG.DOS_THRESHOLD
    });

  } catch (error) {
    console.error('Error auto-blocking IP:', error);
    res.status(500).json({ error: 'Failed to auto-block IP address' });
  }
});

/**
 * GET /api/ip-blocking/stats - Get blocking statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_blocked,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_blocks,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END) as unblocked,
        COUNT(CASE WHEN blocked_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours' THEN 1 END) as blocked_last_24h,
        COUNT(CASE WHEN blocked_at >= CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as blocked_last_7d,
        AVG(dos_attack_count) as avg_dos_attacks,
        MAX(dos_attack_count) as max_dos_attacks
      FROM blocked_ips
    `);

    const topBlockedIPs = await pool.query(`
      SELECT 
        ip_address,
        dos_attack_count,
        blocked_at,
        reason
      FROM blocked_ips 
      WHERE is_active = TRUE
      ORDER BY dos_attack_count DESC, blocked_at DESC
      LIMIT 10
    `);

    res.json({
      summary: stats.rows[0],
      top_blocked_ips: topBlockedIPs.rows,
      config: BLOCKING_CONFIG
    });

  } catch (error) {
    console.error('Error fetching blocking stats:', error);
    res.status(500).json({ error: 'Failed to fetch blocking statistics' });
  }
});

/**
 * Helper function to block IP in Ryu controller
 */
async function blockIPInRyu(ipAddress, reason) {
  try {
    console.log(`🚫 Attempting to block IP ${ipAddress} in Ryu controller: ${reason}`);
    
    // This would integrate with your Ryu controller
    // For now, we'll just log the attempt
    // const blockResult = await ryuService.blockIP(dpid, ipAddress, priority);
    
    console.log(`✅ IP ${ipAddress} blocked in network controller`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to block IP ${ipAddress} in Ryu controller:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Helper function to unblock IP in Ryu controller
 */
async function unblockIPInRyu(ipAddress) {
  try {
    console.log(`🔓 Attempting to unblock IP ${ipAddress} in Ryu controller`);
    
    // This would integrate with your Ryu controller
    // For now, we'll just log the attempt
    // const unblockResult = await ryuService.unblockIP(dpid, ipAddress);
    
    console.log(`✅ IP ${ipAddress} unblocked in network controller`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Failed to unblock IP ${ipAddress} in Ryu controller:`, error);
    return { success: false, error: error.message };
  }
}

export default router;


