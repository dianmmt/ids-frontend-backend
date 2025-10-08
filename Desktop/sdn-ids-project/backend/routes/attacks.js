import express from 'express';
import { pool } from '../services/database.js';
import RyuService from '../services/ryuServices.js';
import { DirectMLPredictorWithDB } from '../services/directMLPredictorWithDB.js';

const router = express.Router();

// Initialize Ryu service and ML predictor
// Allow configuring Ryu controller over environment variables for LAN setups
const ryuHost = process.env.RYU_HOST || 'localhost';
const ryuPort = parseInt(process.env.RYU_PORT || '8080', 10);
const ryuWsPort = parseInt(process.env.RYU_WS_PORT || process.env.RYU_PORT || '8080', 10);
const ryuService = new RyuService(ryuHost, ryuPort, ryuWsPort);
// Note: mlPredictor will be created per-user in handlePacketIn to respect user model selection

// Store active SSE connections - exported for use in other modules
export const sseConnections = new Set();

// Initialize Ryu connection and event handlers
let isRyuConnected = false;

const initializeRyuConnection = async () => {
  try {
    isRyuConnected = await ryuService.connect();
    
    if (isRyuConnected) {
      console.log('Ryu controller connected successfully');
      
      // Set up event handlers for attack detection
      ryuService.on('packet_in', handlePacketIn);
      ryuService.on('flow_stats_reply', handleFlowStats);
      ryuService.on('port_stats_reply', handlePortStats);
    } else {
      console.log('Failed to connect to Ryu controller');
    }
  } catch (error) {
    console.error('Error initializing Ryu connection:', error);
  }
};

// Handle packet_in events for attack detection
const handlePacketIn = async (packetData) => {
  try {
    // Extract packet information
    const packetInfo = {
      dpid: packetData.dpid,
      in_port: packetData.match.in_port,
      eth_src: packetData.match.eth_src,
      eth_dst: packetData.match.eth_dst,
      ipv4_src: packetData.match.ipv4_src,
      ipv4_dst: packetData.match.ipv4_dst,
      tcp_src: packetData.match.tcp_src,
      tcp_dst: packetData.match.tcp_dst,
      udp_src: packetData.match.udp_src,
      udp_dst: packetData.match.udp_dst,
      timestamp: new Date().toISOString()
    };

    // Prepare data for ML prediction with CICFlowMeter features
    const mlInput = {
      // Basic flow info
      duration: 0, // Will be calculated from flow stats
      source_ip: packetInfo.ipv4_src,
      destination_ip: packetInfo.ipv4_dst,
      source_port: packetInfo.tcp_src || packetInfo.udp_src,
      destination_port: packetInfo.tcp_dst || packetInfo.udp_dst,
      protocol: packetInfo.tcp_src ? 'TCP' : (packetInfo.udp_src ? 'UDP' : 'unknown'),
      packet_count: 1,
      byte_count: packetData.data ? packetData.data.length : 0,
      timestamp: packetInfo.timestamp,
      
      // CICFlowMeter features (defaults for single packet)
      total_fwd_packets: 1,
      total_backward_packets: 0,
      total_length_of_fwd_packets: packetData.data ? packetData.data.length : 0,
      total_length_of_bwd_packets: 0,
      avg_packet_size: packetData.data ? packetData.data.length : 0,
      bytes_per_second: 0,
      packets_per_second: 0
    };

    // Get user ID from packet source or use default (admin user)
    // In a real system, you'd map IP addresses to users or use session info
    const userId = '1'; // Default to admin user for now
    
    // Create user-aware ML predictor that respects model selection
    const userMLPredictor = new DirectMLPredictorWithDB(userId);
    
    // Get ML prediction using user's selected model
    const prediction = await userMLPredictor.predictAttack(mlInput);
    
    // Log which model was used for this detection
    console.log(`[Attack Detection] Flow ${packetInfo.ipv4_src}->${packetInfo.ipv4_dst} processed with model: ${prediction.modelName} (Type: ${prediction.modelType}, User: ${userId})`);
    
    const confidenceThreshold = parseFloat(process.env.ATTACK_CONFIDENCE_THRESHOLD || '0.7');
    const passesConfidence = (prediction.confidence === undefined || prediction.confidence === null)
      ? true
      : prediction.confidence >= confidenceThreshold;

    // Filter out Normal traffic - don't save or broadcast
    const isNormalTraffic = prediction.attackType && 
      (prediction.attackType.toLowerCase() === 'normal' || 
       prediction.attackType.toLowerCase() === 'normal traffic' ||
       prediction.attackType.toLowerCase() === 'benign');

    if (prediction.isAttack && passesConfidence && !isNormalTraffic) {
      // Store attack detection in database
      const attackData = {
        event_id: `attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        attack_type: prediction.attackType,
        severity: prediction.severity,
        confidence_score: prediction.confidence,
        src_ip: packetInfo.ipv4_src,
        dst_ip: packetInfo.ipv4_dst,
        src_port: packetInfo.tcp_src || packetInfo.udp_src,
        dst_port: packetInfo.tcp_dst || packetInfo.udp_dst,
        protocol: packetInfo.tcp_src ? 'TCP' : 'UDP',
        flow_id: packetData.buffer_id,
        switch_id: packetInfo.dpid,
        detected_at: packetInfo.timestamp,
        false_positive: false,
        analyst_notes: `Auto-detected by ML model: ${prediction.modelName || 'Unknown'} (Type: ${prediction.modelType || 'Unknown'})`,
        model_name: prediction.modelName,
        model_version: prediction.modelType,
        detection_method: 'ml',
        inference_time_ms: prediction.inferenceTime || 0
      };

      // Insert into database (new consolidated table)
      await pool.query(`
        INSERT INTO attack_events (
          event_id, attack_type, severity, confidence_score,
          src_ip, dst_ip, src_port, dst_port,
          protocol, flow_id, switch_id, detected_at, false_positive, analyst_notes, 
          is_attack, model_name, model_version, detection_method, inference_time_ms
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE, $16, $17, $18, $19)
      `, [
        attackData.event_id, attackData.attack_type, attackData.severity,
        attackData.confidence_score, attackData.src_ip, attackData.dst_ip,
        attackData.src_port, attackData.dst_port, attackData.protocol,
        attackData.flow_id, attackData.switch_id, attackData.detected_at,
        attackData.false_positive, attackData.analyst_notes,
        attackData.model_name, attackData.model_version, attackData.detection_method, attackData.inference_time_ms
      ]);

      // Send to all connected SSE clients
      const sseData = {
        id: attackData.event_id,
        timestamp: attackData.detected_at,
        source_ip: attackData.src_ip,
        destination_ip: attackData.dst_ip,
        attack_type: attackData.attack_type,
        severity: attackData.severity,
        confidence: attackData.confidence_score,
        status: 'detected',
        flow_data: {
          protocol: attackData.protocol,
          src_port: attackData.src_port,
          dst_port: attackData.dst_port,
          packet_count: attackData.packet_count || 1,
          byte_count: attackData.byte_count || 0
        }
      };

      // Broadcast to all SSE connections
      sseConnections.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
        } catch (error) {
          console.error('Error sending SSE data:', error);
          sseConnections.delete(res);
        }
      });

      // Auto-block high severity attacks
      if (prediction.severity === 'critical' || prediction.severity === 'high') {
        await autoBlockAttack(packetInfo, attackData);
      }
    }
  } catch (error) {
    console.error('Error handling packet_in:', error);
  }
};

// Handle flow statistics for anomaly detection
const handleFlowStats = async (flowData) => {
  try {
    // Analyze flow patterns for anomalies
    for (const flow of flowData) {
      const flowInfo = {
        dpid: flowData.dpid,
        packet_count: flow.packet_count,
        byte_count: flow.byte_count,
        duration_sec: flow.duration_sec,
        timestamp: new Date().toISOString()
      };

      // Check for DDoS patterns (high packet count, short duration)
      if (flow.packet_count > 1000 && flow.duration_sec < 10) {
        const attackData = {
          event_id: `ddos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          attack_type: 'DDoS',
          severity: 'high',
          confidence_score: 0.85,
          src_ip: flow.match?.ipv4_src || 'unknown',
          dst_ip: flow.match?.ipv4_dst || 'unknown',
          src_port: flow.match?.tcp_src || flow.match?.udp_src || 0,
          dst_port: flow.match?.tcp_dst || flow.match?.udp_dst || 0,
          protocol: flow.match?.tcp_src ? 'TCP' : 'UDP',
          flow_id: flow.cookie,
          switch_id: flowData.dpid,
          detected_at: flowInfo.timestamp,
          false_positive: false,
          analyst_notes: 'DDoS pattern detected from flow stats',
          model_name: 'rule-based',
          model_version: 'flow-analysis',
          detection_method: 'rule-based',
          inference_time_ms: 0
        };

        // Store and broadcast
        await storeAndBroadcastAttack(attackData);
      }
    }
  } catch (error) {
    console.error('Error handling flow stats:', error);
  }
};

// Handle port statistics for port scan detection
const handlePortStats = async (portData) => {
  try {
    // Analyze port statistics for port scanning patterns
    for (const port of portData) {
      if (port.rx_packets > 100 && port.tx_packets === 0) {
        // Potential port scan - many packets received but none sent
        const attackData = {
          event_id: `portscan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          attack_type: 'Port Scan',
          severity: 'medium',
          confidence_score: 0.75,
          src_ip: 'unknown',
          dst_ip: 'unknown',
          src_port: 0,
          dst_port: port.port_no,
          protocol: 'TCP',
          flow_id: null,
          switch_id: portData.dpid,
          detected_at: new Date().toISOString(),
          false_positive: false,
          analyst_notes: 'Port scan pattern detected from port stats',
          model_name: 'rule-based',
          model_version: 'port-analysis',
          detection_method: 'rule-based',
          inference_time_ms: 0
        };

        await storeAndBroadcastAttack(attackData);
      }
    }
  } catch (error) {
    console.error('Error handling port stats:', error);
  }
};

// Auto-block detected attacks
const autoBlockAttack = async (packetInfo, attackData) => {
  try {
    const blockResult = await ryuService.blockIP(
      packetInfo.dpid,
      packetInfo.ipv4_src,
      2000 // High priority
    );

    if (blockResult.success) {
      console.log(`Auto-blocked IP ${packetInfo.ipv4_src} for ${attackData.attack_type}`);
      
      // Update attack status
      await pool.query(
        'UPDATE attack_events SET status = $1 WHERE event_id = $2',
        ['blocked', attackData.event_id]
      );

      // Broadcast updated status
      const updateData = {
        id: attackData.event_id,
        status: 'blocked',
        action: 'auto_blocked',
        blocked_ip: packetInfo.ipv4_src
      };

      sseConnections.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(updateData)}\n\n`);
        } catch (error) {
          sseConnections.delete(res);
        }
      });
    }
  } catch (error) {
    console.error('Error auto-blocking attack:', error);
  }
};

// Store attack and broadcast to SSE clients
const storeAndBroadcastAttack = async (attackData) => {
  try {
    // Insert into database (new consolidated table)
    await pool.query(`
      INSERT INTO attack_events (
        event_id, attack_type, severity, confidence_score,
        src_ip, dst_ip, src_port, dst_port,
        protocol, flow_id, switch_id, detected_at, false_positive, analyst_notes, 
        is_attack, model_name, model_version, detection_method, inference_time_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, TRUE, $16, $17, $18, $19)
    `, [
      attackData.event_id, attackData.attack_type, attackData.severity,
      attackData.confidence_score, attackData.src_ip, attackData.dst_ip,
      attackData.src_port, attackData.dst_port, attackData.protocol,
      attackData.flow_id, attackData.switch_id, attackData.detected_at,
      attackData.false_positive, attackData.analyst_notes,
      attackData.model_name, attackData.model_version, attackData.detection_method, attackData.inference_time_ms
    ]);

    // Format for SSE
    const sseData = {
      id: attackData.event_id,
      timestamp: attackData.detected_at,
      source_ip: attackData.src_ip,
      destination_ip: attackData.dst_ip,
      attack_type: attackData.attack_type,
      severity: attackData.severity,
      confidence: attackData.confidence_score,
      status: 'detected',
      flow_data: {
        protocol: attackData.protocol,
        src_port: attackData.src_port,
        dst_port: attackData.dst_port,
        packet_count: attackData.packet_count || 1,
        byte_count: attackData.byte_count || 0
      }
    };

    // Broadcast to all SSE connections
    sseConnections.forEach(res => {
      try {
        res.write(`data: ${JSON.stringify(sseData)}\n\n`);
      } catch (error) {
        sseConnections.delete(res);
      }
    });
  } catch (error) {
    console.error('Error storing and broadcasting attack:', error);
  }
};

// Initialize Ryu connection on startup
initializeRyuConnection();

// GET /api/attacks/stream - Server-Sent Events endpoint
router.get('/stream', (req, res) => {
  // Prepare CORS for EventSource withCredentials and proxy-safe headers
  const origin = req.headers.origin || '*';
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // disable buffering on nginx
    'Access-Control-Allow-Headers': 'Cache-Control',
  };
  // If client uses credentials, wildcard origin is invalid. Reflect the origin and allow credentials
  if (origin !== '*') {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  // Set SSE headers
  res.writeHead(200, headers);

  // Keep the underlying socket alive indefinitely
  if (res.socket) {
    try {
      res.socket.setKeepAlive(true);
      res.socket.setNoDelay(true);
      res.socket.setTimeout(0);
    } catch {}
  }

  // Flush headers immediately (if compression/proxy supports)
  if (typeof res.flushHeaders === 'function') {
    try { res.flushHeaders(); } catch {}
  }

  // Inform client of reconnection delay and send initial connection message
  res.write('retry: 5000\n\n');
  res.write(': connected\n\n');
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'Connected to attack detection stream',
    timestamp: new Date().toISOString(),
    ryu_connected: isRyuConnected
  })}\n\n`);

  // Add this connection to the set
  sseConnections.add(res);

  // Send heartbeat every 15 seconds to keep connection alive and bypass idle timeouts
  const heartbeat = setInterval(() => {
    try {
      // Use a comment ping and a data heartbeat
      res.write(`: keep-alive ${Date.now()}\n\n`);
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        active_connections: sseConnections.size
      })}\n\n`);
    } catch (error) {
      // Ignore expected disconnect errors
      if (error && (error.code === 'ECONNRESET' || String(error.message || '').includes('write after end'))) {
        // no-op
      } else {
        console.error('SSE heartbeat error:', error);
      }
      clearInterval(heartbeat);
      sseConnections.delete(res);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
    clearInterval(heartbeat);
    sseConnections.delete(res);
  });

  // Some environments emit 'aborted' instead of 'close' with ECONNRESET
  req.on('aborted', () => {
    clearInterval(heartbeat);
    sseConnections.delete(res);
  });

  req.on('error', (error) => {
    if (error && (error.code === 'ECONNRESET' || error.message === 'aborted')) {
      // Expected when client navigates away or reconnects
    } else {
      console.error('SSE connection error:', error);
    }
    clearInterval(heartbeat);
    sseConnections.delete(res);
  });
});

// GET /api/attacks
// Query params: severity=low|medium|high|critical|all, search=string, limit, offset
router.get('/', async (req, res) => {
  try {
    const { severity, search, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT 
        ad.id,
        ad.event_id,
        ad.attack_type,
        ad.severity,
        ad.confidence_score as confidence,
        ad.src_ip as source_ip,
        ad.dst_ip as destination_ip,
        ad.src_port as source_port,
        ad.dst_port as destination_port,
        ad.protocol,
        ad.flow_id,
        ad.switch_id,
        ad.detected_at,
        ad.false_positive,
        ad.analyst_notes
      FROM attack_events ad
      WHERE ad.detected_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
        AND LOWER(ad.attack_type) NOT IN ('normal', 'normal traffic', 'benign')
    `;

    const params = [];
    let paramIndex = 1;

    if (severity && severity !== 'all') {
      query += ` AND ad.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (search) {
      query += ` AND (ad.attack_type ILIKE $${paramIndex} OR ad.src_ip::text ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY ad.detected_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Attack fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch attacks' });
  }
});

// POST /api/attacks/:id/block - Manually block an attack
router.post('/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const { dpid, ip_address } = req.body;

    // Update attack status in database
    await pool.query(
      'UPDATE attack_events SET status = $1 WHERE event_id = $2',
      ['blocked', id]
    );

    // Block IP in Ryu controller if dpid and ip provided
    if (dpid && ip_address) {
      const blockResult = await ryuService.blockIP(dpid, ip_address, 2000);
      
      if (blockResult.success) {
        res.json({ 
          success: true, 
          message: `IP ${ip_address} blocked on switch ${dpid}`,
          attack_id: id
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: 'Failed to block IP in Ryu controller' 
        });
      }
    } else {
      res.json({ 
        success: true, 
        message: 'Attack marked as blocked in database',
        attack_id: id
      });
    }

    // Broadcast update to SSE clients
    const updateData = {
      id: id,
      status: 'blocked',
      action: 'manually_blocked',
      timestamp: new Date().toISOString()
    };

    sseConnections.forEach(res => {
      try {
        res.write(`data: ${JSON.stringify(updateData)}\n\n`);
      } catch (error) {
        sseConnections.delete(res);
      }
    });

  } catch (error) {
    console.error('Error blocking attack:', error);
    res.status(500).json({ error: 'Failed to block attack' });
  }
});

// DELETE /api/attacks/:id - Delete an attack permanently
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete attack from database
    const result = await pool.query(
      'DELETE FROM attack_events WHERE event_id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attack not found' });
    }

    // Broadcast deletion to SSE clients
    const updateData = {
      id: id,
      action: 'deleted',
      timestamp: new Date().toISOString()
    };

    sseConnections.forEach(res => {
      try {
        res.write(`data: ${JSON.stringify(updateData)}\n\n`);
      } catch (error) {
        sseConnections.delete(res);
      }
    });

    res.json({ 
      success: true, 
      message: 'Attack deleted successfully',
      attack_id: id
    });

  } catch (error) {
    console.error('Error deleting attack:', error);
    res.status(500).json({ error: 'Failed to delete attack' });
  }
});

// GET /api/attacks/stats - Get attack statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_attacks,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
        COUNT(CASE WHEN detected_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 END) as recent_count
      FROM attack_events 
      WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND LOWER(attack_type) NOT IN ('normal', 'normal traffic', 'benign')
    `).catch(() => ({ rows: [{
      total_attacks: '0',
      critical_count: '0',
      high_count: '0',
      medium_count: '0',
      low_count: '0',
      recent_count: '0'
    }]}));

    const attackTypes = await pool.query(`
      SELECT attack_type, COUNT(*) as count
      FROM attack_events 
      WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND LOWER(attack_type) NOT IN ('normal', 'normal traffic', 'benign')
      GROUP BY attack_type
      ORDER BY count DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    // Blocked count not available without a status column; set to 0 for now
    const summary = {
      ...stats.rows[0],
      blocked_count: stats.rows[0]?.blocked_count ?? 0
    };

    res.json({
      summary,
      top_attack_types: attackTypes.rows,
      ryu_connected: isRyuConnected,
      active_sse_connections: sseConnections.size
    });
  } catch (error) {
    console.error('Error fetching attack stats, serving fallbacks:', error);
    res.json({
      summary: {
        total_attacks: 0,
        critical_count: 0,
        high_count: 0,
        medium_count: 0,
        low_count: 0,
        blocked_count: 0,
        recent_count: 0
      },
      top_attack_types: [],
      ryu_connected: isRyuConnected,
      active_sse_connections: sseConnections.size
    });
  }
});

// GET /api/attacks/recent-events - Get recent security events for dashboard
router.get('/recent-events', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const result = await pool.query(`
      SELECT 
        ad.event_id,
        ad.attack_type,
        ad.severity,
        ad.confidence_score,
        ad.src_ip as source_ip,
        ad.dst_ip as destination_ip,
        ad.src_port as source_port,
        ad.dst_port as destination_port,
        ad.protocol,
        ad.detected_at,
        ad.false_positive
      FROM attack_events ad
      WHERE ad.detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
        AND ad.false_positive = false
        AND LOWER(ad.attack_type) NOT IN ('normal', 'normal traffic', 'benign')
      ORDER BY ad.detected_at DESC
      LIMIT $1
    `, [parseInt(limit)]);

    // Format events for dashboard display
    const events = result.rows.map(attack => {
      const timeAgo = getTimeAgo(attack.detected_at);
      const attackName = formatAttackName(attack.attack_type);
      const ipInfo = formatIPInfo(attack.source_ip, attack.destination_ip);
      
      return {
        id: attack.event_id,
        time: timeAgo,
        event: `${attackName} from ${ipInfo}`,
        severity: attack.severity,
        attack_type: attack.attack_type,
        source_ip: attack.source_ip,
        destination_ip: attack.destination_ip,
        confidence: attack.confidence_score,
        status: 'detected', // Default status since column doesn't exist
        detected_at: attack.detected_at
      };
    });

    res.json(events);
  } catch (error) {
    console.error('Error fetching recent events:', error);
    res.status(500).json({ error: 'Failed to fetch recent security events' });
  }
});

// Helper function to calculate time ago
function getTimeAgo(timestamp) {
  const now = new Date();
  const past = new Date(timestamp);
  const diffMs = now - past;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

// Helper function to format attack name
function formatAttackName(attackType) {
  const attackNames = {
    'DDoS': 'DDoS Attack',
    'Port Scan': 'Port Scan',
    'Brute Force': 'Brute Force Attack',
    'SQL Injection': 'SQL Injection',
    'XSS': 'Cross-Site Scripting',
    'Malware': 'Malware Detection',
    'Botnet': 'Botnet Activity',
    'Phishing': 'Phishing Attempt',
    'Intrusion': 'Intrusion Attempt',
    'Anomaly': 'Network Anomaly'
  };
  
  return attackNames[attackType] || attackType || 'Unknown Attack';
}

// Helper function to format IP information
function formatIPInfo(sourceIP, destinationIP) {
  if (sourceIP && destinationIP) {
    return `${sourceIP} → ${destinationIP}`;
  } else if (sourceIP) {
    return sourceIP;
  } else if (destinationIP) {
    return destinationIP;
  }
  return 'Unknown IP';
}

export default router;


