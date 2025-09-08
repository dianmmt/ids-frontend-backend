import express from 'express';
import { pool } from '../services/database.js';
import RyuService from '../services/ryuServices.js';
import { MLPredictor } from '../services/mlPredictor.js';

const router = express.Router();

// Initialize Ryu service and ML predictor
const ryuService = new RyuService();
const mlPredictor = new MLPredictor();

// Store active SSE connections
const sseConnections = new Set();

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

    // Prepare data for ML prediction
    const mlInput = {
      source_ip: packetInfo.ipv4_src,
      destination_ip: packetInfo.ipv4_dst,
      source_port: packetInfo.tcp_src || packetInfo.udp_src,
      destination_port: packetInfo.tcp_dst || packetInfo.udp_dst,
      protocol: packetInfo.tcp_src ? 'TCP' : 'UDP',
      packet_count: 1,
      byte_count: packetData.data ? packetData.data.length : 0,
      timestamp: packetInfo.timestamp
    };

    // Get ML prediction
    const prediction = await mlPredictor.predictAttack(mlInput);
    
    if (prediction.isAttack && prediction.confidence > 0.7) {
      // Store attack detection in database
      const attackData = {
        detection_id: `attack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        attack_type: prediction.attackType,
        severity: prediction.severity,
        confidence_score: prediction.confidence,
        source_ip: packetInfo.ipv4_src,
        destination_ip: packetInfo.ipv4_dst,
        source_port: packetInfo.tcp_src || packetInfo.udp_src,
        destination_port: packetInfo.tcp_dst || packetInfo.udp_dst,
        protocol: packetInfo.tcp_src ? 'TCP' : 'UDP',
        flow_id: packetData.buffer_id,
        switch_id: packetInfo.dpid,
        detected_at: packetInfo.timestamp,
        false_positive: false,
        analyst_notes: 'Auto-detected by ML model'
      };

      // Insert into database
      await pool.query(`
        INSERT INTO attack_detections (
          detection_id, attack_type, severity, confidence_score,
          source_ip, destination_ip, source_port, destination_port,
          protocol, flow_id, switch_id, detected_at, false_positive, analyst_notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        attackData.detection_id, attackData.attack_type, attackData.severity,
        attackData.confidence_score, attackData.source_ip, attackData.destination_ip,
        attackData.source_port, attackData.destination_port, attackData.protocol,
        attackData.flow_id, attackData.switch_id, attackData.detected_at,
        attackData.false_positive, attackData.analyst_notes
      ]);

      // Send to all connected SSE clients
      const sseData = {
        id: attackData.detection_id,
        timestamp: attackData.detected_at,
        source_ip: attackData.source_ip,
        destination_ip: attackData.destination_ip,
        attack_type: attackData.attack_type,
        severity: attackData.severity,
        confidence: attackData.confidence_score,
        status: 'detected',
        flow_data: {
          protocol: attackData.protocol,
          src_port: attackData.source_port,
          dst_port: attackData.destination_port,
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
          detection_id: `ddos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          attack_type: 'DDoS',
          severity: 'high',
          confidence_score: 0.85,
          source_ip: flow.match?.ipv4_src || 'unknown',
          destination_ip: flow.match?.ipv4_dst || 'unknown',
          source_port: flow.match?.tcp_src || flow.match?.udp_src || 0,
          destination_port: flow.match?.tcp_dst || flow.match?.udp_dst || 0,
          protocol: flow.match?.tcp_src ? 'TCP' : 'UDP',
          flow_id: flow.cookie,
          switch_id: flowData.dpid,
          detected_at: flowInfo.timestamp,
          false_positive: false,
          analyst_notes: 'DDoS pattern detected from flow stats'
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
          detection_id: `portscan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          attack_type: 'Port Scan',
          severity: 'medium',
          confidence_score: 0.75,
          source_ip: 'unknown',
          destination_ip: 'unknown',
          source_port: 0,
          destination_port: port.port_no,
          protocol: 'TCP',
          flow_id: null,
          switch_id: portData.dpid,
          detected_at: new Date().toISOString(),
          false_positive: false,
          analyst_notes: 'Port scan pattern detected from port stats'
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
        'UPDATE attack_detections SET status = $1 WHERE detection_id = $2',
        ['blocked', attackData.detection_id]
      );

      // Broadcast updated status
      const updateData = {
        id: attackData.detection_id,
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
    // Insert into database
    await pool.query(`
      INSERT INTO attack_detections (
        detection_id, attack_type, severity, confidence_score,
        source_ip, destination_ip, source_port, destination_port,
        protocol, flow_id, switch_id, detected_at, false_positive, analyst_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      attackData.detection_id, attackData.attack_type, attackData.severity,
      attackData.confidence_score, attackData.source_ip, attackData.destination_ip,
      attackData.source_port, attackData.destination_port, attackData.protocol,
      attackData.flow_id, attackData.switch_id, attackData.detected_at,
      attackData.false_positive, attackData.analyst_notes
    ]);

    // Format for SSE
    const sseData = {
      id: attackData.detection_id,
      timestamp: attackData.detected_at,
      source_ip: attackData.source_ip,
      destination_ip: attackData.destination_ip,
      attack_type: attackData.attack_type,
      severity: attackData.severity,
      confidence: attackData.confidence_score,
      status: 'detected',
      flow_data: {
        protocol: attackData.protocol,
        src_port: attackData.source_port,
        dst_port: attackData.destination_port,
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
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection message
  res.write(`data: ${JSON.stringify({
    type: 'connection',
    message: 'Connected to attack detection stream',
    timestamp: new Date().toISOString(),
    ryu_connected: isRyuConnected
  })}\n\n`);

  // Add this connection to the set
  sseConnections.add(res);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        active_connections: sseConnections.size
      })}\n\n`);
    } catch (error) {
      clearInterval(heartbeat);
      sseConnections.delete(res);
    }
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    console.log('SSE client disconnected');
    clearInterval(heartbeat);
    sseConnections.delete(res);
  });

  req.on('error', (error) => {
    console.error('SSE connection error:', error);
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
        ad.detection_id,
        ad.attack_type,
        ad.severity,
        ad.confidence_score as confidence,
        ad.source_ip,
        ad.destination_ip,
        ad.source_port,
        ad.destination_port,
        ad.protocol,
        ad.flow_id,
        ad.switch_id,
        ad.detected_at,
        ad.false_positive,
        ad.analyst_notes
      FROM attack_detections ad
      WHERE ad.detected_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
    `;

    const params = [];
    let paramIndex = 1;

    if (severity && severity !== 'all') {
      query += ` AND ad.severity = $${paramIndex}`;
      params.push(severity);
      paramIndex++;
    }

    if (search) {
      query += ` AND (ad.attack_type ILIKE $${paramIndex} OR ad.source_ip::text ILIKE $${paramIndex})`;
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
      'UPDATE attack_detections SET status = $1 WHERE detection_id = $2',
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
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_count,
        COUNT(CASE WHEN detected_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 END) as recent_count
      FROM attack_detections 
      WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    const attackTypes = await pool.query(`
      SELECT attack_type, COUNT(*) as count
      FROM attack_detections 
      WHERE detected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
      GROUP BY attack_type
      ORDER BY count DESC
      LIMIT 10
    `);

    res.json({
      summary: stats.rows[0],
      top_attack_types: attackTypes.rows,
      ryu_connected: isRyuConnected,
      active_sse_connections: sseConnections.size
    });
  } catch (error) {
    console.error('Error fetching attack stats:', error);
    res.status(500).json({ error: 'Failed to fetch attack statistics' });
  }
});

export default router;


