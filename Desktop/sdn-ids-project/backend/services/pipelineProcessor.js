// backend/services/pipelineProcessor.js - ML Pipeline Processor
import { query } from './database.js';
import { DirectMLPredictorWithDB } from './directMLPredictorWithDB.js';
import { CICFlowMeterFeatureMapper } from './cicflowmeterFeatureMapper.js';
import cron from 'node-cron';

// Import SSE connections to broadcast attack notifications
let sseConnections = new Set();
export const setSseConnections = (connections) => {
  sseConnections = connections;
};
export const getSseConnections = () => sseConnections;

export class PipelineProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || parseInt(process.env.PIPELINE_BATCH_SIZE) || 50;
    this.processingInterval = options.processingInterval || parseInt(process.env.PIPELINE_INTERVAL) || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    
    // Use DirectMLPredictorWithDB for user-aware predictions
    this.mlPredictor = new DirectMLPredictorWithDB();
    // Initialize feature mapper for consistent feature processing
    this.featureMapper = new CICFlowMeterFeatureMapper();
    this.isRunning = false;
    this.processingJob = null;
    this.stats = {
      totalProcessed: 0,
      totalAttacks: 0,
      totalErrors: 0,
      lastProcessed: null,
      processingTime: 0
    };
  }

  /**
   * Start the pipeline processor
   */
  async start() {
    console.log('[PipelineProcessor] Starting ML pipeline processor...');
    
    try {
      // Test ML service connection
      const healthCheck = await this.mlPredictor.checkHealth();
      if (healthCheck.status !== 'healthy') {
        console.warn('[PipelineProcessor] ML service health check failed:', healthCheck.error);
      }
      
      // Start cron job for processing
      this.processingJob = cron.schedule(`*/${this.processingInterval / 1000} * * * * *`, async () => {
        if (this.isRunning) {
          await this.processUnprocessedFlows();
        }
      });
      
      this.isRunning = true;
      console.log(`[PipelineProcessor] Pipeline processor started (interval: ${this.processingInterval}ms)`);
      
      // Process immediately on start
      await this.processUnprocessedFlows();
      
    } catch (error) {
      console.error('[PipelineProcessor] Failed to start processor:', error);
      throw error;
    }
  }

  /**
   * Stop the pipeline processor
   */
  async stop() {
    console.log('[PipelineProcessor] Stopping pipeline processor...');
    
    this.isRunning = false;
    
    if (this.processingJob) {
      this.processingJob.destroy();
      this.processingJob = null;
    }
    
    console.log('[PipelineProcessor] Pipeline processor stopped');
  }

  /**
   * Process unprocessed flows
   */
  async processUnprocessedFlows() {
    if (!this.isRunning) return;
    
    const startTime = Date.now();
    
    try {
      // Get unprocessed flows
      const unprocessedFlows = await this.getUnprocessedFlows();
      
      if (unprocessedFlows.length === 0) {
        console.log('[PipelineProcessor] No unprocessed flows found');
        return;
      }
      
      console.log(`[PipelineProcessor] Processing ${unprocessedFlows.length} unprocessed flows`);
      
      // Process flows in batches
      const batches = this.chunkArray(unprocessedFlows, this.batchSize);
      let processedCount = 0;
      let attackCount = 0;
      
      for (const batch of batches) {
        const batchResult = await this.processBatch(batch);
        processedCount += batchResult.processed;
        attackCount += batchResult.attacks;
      }
      
      // Update statistics
      this.stats.totalProcessed += processedCount;
      this.stats.totalAttacks += attackCount;
      this.stats.lastProcessed = new Date();
      this.stats.processingTime = Date.now() - startTime;
      
      console.log(`[PipelineProcessor] Batch processing complete: ${processedCount} flows processed, ${attackCount} attacks detected`);
      
    } catch (error) {
      console.error('[PipelineProcessor] Error processing flows:', error);
      this.stats.totalErrors++;
    }
  }

  /**
   * Get unprocessed flows from database (REAL-TIME: Only recent flows)
   */
  async getUnprocessedFlows() {
    try {
      // REAL-TIME PROCESSING: Only process flows from the last 5 minutes
      // This ensures we only process new flows, not old historical data
      const recentTimeThreshold = new Date(Date.now() - 5 * 60 * 1000); // 5 minutes ago
      
      const result = await query(`
        SELECT 
          -- Metadata fields (for tracking and logging)
          flow_id,
          src_ip,
          dst_ip,
          src_port,
          dst_port,
          flow_start_time,
          captured_at,
          
          -- 77 ML Features in exact order (Protocol first)
          protocol,                         -- 1 - Protocol
          flow_duration,                    -- 2 - Flow Duration
          total_fwd_packets,                -- 3 - Tot Fwd Pkts
          total_backward_packets,           -- 4 - Tot Bwd Pkts
          total_length_of_fwd_packets,      -- 5 - TotLen Fwd Pkts
          total_length_of_bwd_packets,      -- 6 - TotLen Bwd Pkts
          fwd_packet_length_max,            -- 7 - Fwd Pkt Len Max
          fwd_packet_length_min,            -- 8 - Fwd Pkt Len Min
          fwd_packet_length_mean,           -- 9 - Fwd Pkt Len Mean
          fwd_packet_length_std,            -- 10 - Fwd Pkt Len Std
          bwd_packet_length_max,            -- 11 - Bwd Pkt Len Max
          bwd_packet_length_min,            -- 12 - Bwd Pkt Len Min
          bwd_packet_length_mean,           -- 13 - Bwd Pkt Len Mean
          bwd_packet_length_std,            -- 14 - Bwd Pkt Len Std
          flow_bytes_per_second,            -- 15 - Flow Byts/s
          flow_packets_per_second,          -- 16 - Flow Pkts/s
          flow_iat_mean,                    -- 17 - Flow IAT Mean
          flow_iat_std,                     -- 18 - Flow IAT Std
          flow_iat_max,                     -- 19 - Flow IAT Max
          flow_iat_min,                     -- 20 - Flow IAT Min
          fwd_iat_total,                    -- 21 - Fwd IAT Tot
          fwd_iat_mean,                     -- 22 - Fwd IAT Mean
          fwd_iat_std,                      -- 23 - Fwd IAT Std
          fwd_iat_max,                      -- 24 - Fwd IAT Max
          fwd_iat_min,                      -- 25 - Fwd IAT Min
          bwd_iat_total,                    -- 26 - Bwd IAT Tot
          bwd_iat_mean,                     -- 27 - Bwd IAT Mean
          bwd_iat_std,                      -- 28 - Bwd IAT Std
          bwd_iat_max,                      -- 29 - Bwd IAT Max
          bwd_iat_min,                      -- 30 - Bwd IAT Min
          fwd_psh_flags,                    -- 31 - Fwd PSH Flags
          bwd_psh_flags,                    -- 32 - Bwd PSH Flags
          fwd_urg_flags,                    -- 33 - Fwd URG Flags
          bwd_urg_flags,                    -- 34 - Bwd URG Flags
          fwd_header_length,                -- 35 - Fwd Header Len
          bwd_header_length,                -- 36 - Bwd Header Len
          fwd_packets_per_second,           -- 37 - Fwd Pkts/s
          bwd_packets_per_second,           -- 38 - Bwd Pkts/s
          packet_length_min,                -- 39 - Pkt Len Min
          packet_length_max,                -- 40 - Pkt Len Max
          packet_length_mean,               -- 41 - Pkt Len Mean
          packet_length_std,                -- 42 - Pkt Len Std
          packet_length_variance,           -- 43 - Pkt Len Var
          fin_flag_count,                   -- 44 - FIN Flag Cnt
          syn_flag_count,                   -- 45 - SYN Flag Cnt
          rst_flag_count,                   -- 46 - RST Flag Cnt
          psh_flag_count,                   -- 47 - PSH Flag Cnt
          ack_flag_count,                   -- 48 - ACK Flag Cnt
          urg_flag_count,                   -- 49 - URG Flag Cnt
          cwe_flag_count,                   -- 50 - CWE Flag Count
          ece_flag_count,                   -- 51 - ECE Flag Cnt
          down_up_ratio,                    -- 52 - Down/Up Ratio
          packet_size_avg,                  -- 53 - Pkt Size Avg
          fwd_segment_size_avg,             -- 54 - Fwd Seg Size Avg
          bwd_segment_size_avg,             -- 55 - Bwd Seg Size Avg
          fwd_bytes_per_byte_avg,           -- 56 - Fwd Byts/b Avg
          fwd_packets_per_byte_avg,         -- 57 - Fwd Pkts/b Avg
          fwd_block_rate_avg,               -- 58 - Fwd Blk Rate Avg
          bwd_bytes_per_byte_avg,           -- 59 - Bwd Byts/b Avg
          bwd_packets_per_byte_avg,         -- 60 - Bwd Pkts/b Avg
          bwd_block_rate_avg,               -- 61 - Bwd Blk Rate Avg
          subflow_fwd_packets,              -- 62 - Subflow Fwd Pkts
          subflow_fwd_bytes,                -- 63 - Subflow Fwd Byts
          subflow_bwd_packets,              -- 64 - Subflow Bwd Pkts
          subflow_bwd_bytes,                -- 65 - Subflow Bwd Byts
          init_fwd_win_bytes,               -- 66 - Init Fwd Win Byts
          init_bwd_win_bytes,               -- 67 - Init Bwd Win Byts
          fwd_act_data_packets,             -- 68 - Fwd Act Data Pkts
          fwd_segment_size_min,             -- 69 - Fwd Seg Size Min
          active_mean,                      -- 70 - Active Mean
          active_std,                       -- 71 - Active Std
          active_max,                       -- 72 - Active Max
          active_min,                       -- 73 - Active Min
          idle_mean,                        -- 74 - Idle Mean
          idle_std,                         -- 75 - Idle Std
          idle_max,                         -- 76 - Idle Max
          idle_min                          -- 77 - Idle Min
        FROM flows 
        WHERE is_processed = false 
          AND captured_at >= $1  -- REAL-TIME: Only recent flows
        ORDER BY captured_at DESC  -- Process newest first for real-time response
        LIMIT $2
      `, [recentTimeThreshold, this.batchSize]); // Only get recent flows, not old ones
      
      if (result.rows.length > 0) {
        console.log(`[PipelineProcessor] Found ${result.rows.length} recent unprocessed flows (last 5 minutes)`);
      }
      
      return result.rows;
    } catch (error) {
      console.error('[PipelineProcessor] Error getting unprocessed flows:', error);
      return [];
    }
  }

  /**
   * Process a batch of flows
   */
  async processBatch(flows) {
    let processed = 0;
    let attacks = 0;
    
    for (const flow of flows) {
      try {
        const result = await this.processSingleFlow(flow);
        if (result.success) {
          processed++;
          if (result.isAttack) {
            attacks++;
          }
        }
      } catch (error) {
        console.error(`[PipelineProcessor] Error processing flow ${flow.flow_id}:`, error);
        this.stats.totalErrors++;
      }
    }
    
    return { processed, attacks };
  }

  /**
   * Check if IP belongs to web server network range
   */
  isWebServerNetwork(ip) {
    // Check if IP belongs to 172.17.0.0/25 network
    // 172.17.0.0/25 = 172.17.0.0 to 172.17.0.127
    const ipParts = ip.split('.').map(Number);
    
    // Check if IP starts with 172.17.0
    if (ipParts[0] === 172 && ipParts[1] === 17 && ipParts[2] === 0) {
      // Check if last octet is in range 0-127 (for /25 subnet)
      if (ipParts[3] >= 0 && ipParts[3] <= 127) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Process a single flow
   */
  async processSingleFlow(flow) {
    try {
      // WEB ATTACK DETECTION: Check for web server network range (172.17.0.0/25)
      const isWebServerTarget = this.isWebServerNetwork(flow.dst_ip);
      let isWebAttack = false;
      let webAttackPrediction = null;
      
      // Check if this is targeting the web server network
      if (isWebServerTarget) {
        console.log(`🚨 [WEB ATTACK DETECTION] Flow targeting web server network ${flow.dst_ip} detected!`);
        console.log(`   • Source: ${flow.src_ip}:${flow.src_port}`);
        console.log(`   • Target: ${flow.dst_ip}:${flow.dst_port} (172.17.0.0/25 network)`);
        console.log(`   • Protocol: ${flow.protocol}`);
        
        // First, run ML prediction to get the original attack type
        const mlInput = this.prepareMLInput(flow);
        const userId = flow.user_id || '1';
        const userMLPredictor = new DirectMLPredictorWithDB(userId);
        const mlPrediction = await userMLPredictor.predictAttack(mlInput);
        
        // Check if ML model predicts DoS attack
        const isDoS = mlPrediction.attackType && 
          (mlPrediction.attackType.toLowerCase().includes('dos') || 
           mlPrediction.attackType.toLowerCase().includes('ddos'));
        
        if (isDoS) {
          console.log(`🚫 [FILTERED] DoS attack from ${flow.src_ip} to web server network ${flow.dst_ip} - NOT displaying on interface`);
          console.log(`   • Original ML Prediction: ${mlPrediction.attackType}`);
          console.log(`   • Confidence: ${(mlPrediction.confidence * 100).toFixed(1)}%`);
          console.log(`   • Action: Filtered out - not shown on interface`);
          
          // Mark flow as processed but don't save attack detection
          await this.markFlowAsProcessed(flow.flow_id);
          
          return {
            success: true,
            isAttack: false, // Mark as not attack to prevent display
            attackType: 'DoS (Filtered)',
            confidence: mlPrediction.confidence,
            modelName: mlPrediction.modelName,
            userId: userId,
            detectionMethod: 'filtered',
            filtered: true,
            reason: 'DoS attack from web server network filtered out'
          };
        }
        
        // If not DoS, convert ANY attack to Web Attack
        const originalAttackType = mlPrediction.attackType || 'Unknown';
        console.log(`🔄 [ATTACK CONVERSION] Converting ${originalAttackType} to Web Attack for web server network`);
        console.log(`   • Original: ${originalAttackType}`);
        console.log(`   • Converted to: Web Attack`);
        console.log(`   • Target Network: 172.17.0.0/25`);
        
        isWebAttack = true;
        webAttackPrediction = {
          isAttack: true,
          attackType: 'Web Attack',
          severity: this.mapAttackTypeToSeverity(originalAttackType, mlPrediction.confidence || 0.8),
          confidence: Math.max(mlPrediction.confidence || 0.8, 0.9), // Boost confidence for web attacks
          confidencePercentage: Math.max((mlPrediction.confidence || 0.8) * 100, 90),
          inferenceTime: mlPrediction.inferenceTime || 0,
          probabilities: {
            'Web Attack': Math.max(mlPrediction.confidence || 0.8, 0.9),
            'Original': mlPrediction.confidence || 0.8
          },
          topClasses: [['Web Attack', Math.max(mlPrediction.confidence || 0.8, 0.9)], [originalAttackType, mlPrediction.confidence || 0.8]],
          totalClasses: 2,
          modelName: 'Web Attack Rule Engine',
          modelVersion: 'v1.0',
          modelType: 'rule-based',
          modelId: 'web-attack-detector',
          originalAttackType: originalAttackType // Keep track of original prediction
        };
        
        // Log web attack detection with conversion info
        this.logWebAttackDetection(flow, webAttackPrediction, originalAttackType);
        
        // Save web attack detection immediately
        await this.saveAttackDetection(flow, webAttackPrediction);
        
        // Mark flow as processed
        await this.markFlowAsProcessed(flow.flow_id);
        
        return {
          success: true,
          isAttack: true,
          attackType: 'Web Attack',
          confidence: webAttackPrediction.confidence,
          modelName: 'Web Attack Rule Engine',
          userId: 'system',
          detectionMethod: 'rule-based',
          originalAttackType: originalAttackType
        };
      }
      
      // Normal ML processing for non-web attack flows
      // Prepare flow data for ML prediction
      const mlInput = this.prepareMLInput(flow);
      
      // Get user ID from flow data or use default
      const userId = flow.user_id || '1';
      
      // Create user-aware ML predictor for this flow
      const userMLPredictor = new DirectMLPredictorWithDB(userId);
      
      // Get ML prediction using user's selected model
      const prediction = await userMLPredictor.predictAttack(mlInput);
      
      // Log detailed detection results
      this.logDetectionResult(flow, prediction, userId);
      
      // Save attack detection if it's an attack
      if (prediction.isAttack) {
        await this.saveAttackDetection(flow, prediction);
      }
      
      // Mark flow as processed
      await this.markFlowAsProcessed(flow.flow_id);
      
      return {
        success: true,
        isAttack: prediction.isAttack,
        attackType: prediction.attackType,
        confidence: prediction.confidence,
        modelName: prediction.modelName,
        userId: userId,
        detectionMethod: 'ml'
      };
      
    } catch (error) {
      console.error(`[PipelineProcessor] Error processing flow ${flow.flow_id}:`, error);
      
      // Mark flow as processed even on error to avoid infinite retry
      await this.markFlowAsProcessed(flow.flow_id);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Prepare flow data for ML prediction using feature mapper
   */
  prepareMLInput(flow) {
    // Return the flow object directly - DirectMLPredictorWithDB will handle the mapping
    // This avoids double mapping and ensures consistent feature processing
    return flow;
  }

  /**
   * Save attack detection to database and broadcast to SSE clients
   */
  async saveAttackDetection(flow, prediction) {
    try {
      // Filter out Normal traffic - don't save to database
      const isNormalTraffic = prediction.attackType && 
        (prediction.attackType.toLowerCase() === 'normal' || 
         prediction.attackType.toLowerCase() === 'normal traffic' ||
         prediction.attackType.toLowerCase() === 'benign');
      
      if (isNormalTraffic) {
        console.log(`[PipelineProcessor] Skipping Normal traffic from ${flow.src_ip} to ${flow.dst_ip}`);
        return;
      }
      
      // Filter out DoS attacks from web server network - don't save to database
      const isDoSFromWebServerNetwork = prediction.attackType && 
        (prediction.attackType.toLowerCase().includes('dos') || 
         prediction.attackType.toLowerCase().includes('ddos')) &&
        this.isWebServerNetwork(flow.dst_ip);
      
      if (isDoSFromWebServerNetwork) {
        console.log(`[PipelineProcessor] Skipping DoS attack from ${flow.src_ip} to web server network ${flow.dst_ip} - filtered out`);
        return;
      }

      // Check if source IP is already blocked
      const isBlocked = await this.checkIfIPBlocked(flow.src_ip);
      if (isBlocked) {
        console.log(`[PipelineProcessor] Skipping attack from blocked IP ${flow.src_ip} to ${flow.dst_ip}`);
        return;
      }
      
      const eventId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const detectedAt = new Date().toISOString();
      
      const queryText = `
        INSERT INTO attack_events (
          event_id, flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
          is_attack, attack_type, confidence_score, severity,
          model_name, model_version, detection_method, inference_time_ms, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;
      
      // Determine detection method based on attack type
      const detectionMethod = prediction.attackType === 'Web Attack' ? 'rule-based' : 'ml';
      
      const values = [
        eventId,
        flow.flow_id,
        flow.src_ip,
        flow.dst_ip,
        flow.src_port,
        flow.dst_port,
        flow.protocol,
        prediction.isAttack,
        prediction.attackType,
        prediction.confidence,
        prediction.severity,
        prediction.modelName || 'Unknown_Model',
        prediction.modelVersion || 'v1.0',
        detectionMethod,
        prediction.inferenceTime || 0,
        detectedAt
      ];
      
      await query(queryText, values);
      
      console.log(`[PipelineProcessor] Attack detected: ${prediction.attackType} (${prediction.severity}) from ${flow.src_ip} to ${flow.dst_ip} using model: ${prediction.modelName}`);
      
      // Check for DOS attacks and potentially auto-block IP
      await this.checkAndAutoBlockIP(flow, prediction);
      
      // Broadcast attack notification to all SSE clients
      this.broadcastAttackNotification({
        eventId,
        attackType: prediction.attackType,
        severity: prediction.severity,
        confidence: prediction.confidence,
        srcIp: flow.src_ip,
        dstIp: flow.dst_ip,
        srcPort: flow.src_port,
        dstPort: flow.dst_port,
        protocol: flow.protocol,
        detectedAt
      });
      
    } catch (error) {
      console.error('[PipelineProcessor] Error saving attack detection:', error);
      throw error;
    }
  }

  /**
   * Broadcast attack notification to SSE clients
   */
  broadcastAttackNotification(attackData) {
    try {
      const connections = getSseConnections();
      if (connections.size === 0) {
        console.log('[PipelineProcessor] No SSE clients connected, skipping broadcast');
        return;
      }

      // Format SSE data to match frontend expectations
      const sseData = {
        id: attackData.eventId,
        timestamp: attackData.detectedAt,
        source_ip: attackData.srcIp,
        destination_ip: attackData.dstIp,
        attack_type: attackData.attackType,
        severity: attackData.severity,
        confidence: attackData.confidence,
        status: 'detected',
        flow_data: {
          protocol: attackData.protocol,
          src_port: attackData.srcPort,
          dst_port: attackData.dstPort
        }
      };

      // Broadcast to all connected SSE clients
      let broadcastCount = 0;
      connections.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
          broadcastCount++;
        } catch (error) {
          console.error('[PipelineProcessor] Error broadcasting to SSE client:', error);
          connections.delete(res);
        }
      });

      console.log(`[PipelineProcessor] Broadcasted attack notification to ${broadcastCount} SSE client(s)`);
    } catch (error) {
      console.error('[PipelineProcessor] Error broadcasting attack notification:', error);
    }
  }

  /**
   * Mark flow as processed
   */
  async markFlowAsProcessed(flowId) {
    try {
      await query(`
        UPDATE flows 
        SET is_processed = true, processed_at = NOW() 
        WHERE flow_id = $1
      `, [flowId]);
    } catch (error) {
      console.error(`[PipelineProcessor] Error marking flow ${flowId} as processed:`, error);
    }
  }

  /**
   * Get processing statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      batchSize: this.batchSize,
      processingInterval: this.processingInterval
    };
  }

  /**
   * Get recent attacks
   */
  async getRecentAttacks(limit = 100) {
    try {
      const result = await query(`
        SELECT 
          a.*,
          f.flow_duration as flow_duration,
          f.total_fwd_packets,
          f.total_backward_packets,
          f.flow_bytes_per_second,
          f.flow_packets_per_second
        FROM attack_events a
        LEFT JOIN flows f ON a.flow_id = f.flow_id
        WHERE a.is_attack = true
        ORDER BY a.detected_at DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      console.error('[PipelineProcessor] Error getting recent attacks:', error);
      return [];
    }
  }

  /**
   * Get attack statistics by IP
   */
  async getAttackStatsByIP(timeWindowHours = 24) {
    try {
      const result = await query(`
        SELECT 
          src_ip,
          COUNT(*) as attack_count,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
          COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
          COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
          MAX(detected_at) as last_attack,
          AVG(confidence_score) as avg_confidence
        FROM attack_events 
        WHERE is_attack = true 
          AND detected_at > NOW() - INTERVAL '${timeWindowHours} hours'
        GROUP BY src_ip
        ORDER BY attack_count DESC
      `);
      
      return result.rows;
    } catch (error) {
      console.error('[PipelineProcessor] Error getting attack stats by IP:', error);
      return [];
    }
  }

  /**
   * Utility function to chunk array
   */
  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Manual processing trigger
   */
  async processNow() {
    console.log('[PipelineProcessor] Manual processing triggered');
    await this.processUnprocessedFlows();
  }

  /**
   * Process specific flow immediately (for real-time processing)
   */
  async processFlowImmediately(flowId) {
    try {
      console.log(`[PipelineProcessor] Processing flow immediately: ${flowId}`);
      
      // Get the specific flow
      const result = await query(`
        SELECT 
          flow_id, src_ip, dst_ip, src_port, dst_port, flow_start_time, captured_at,
          protocol, flow_duration, total_fwd_packets, total_backward_packets,
          total_length_of_fwd_packets, total_length_of_bwd_packets,
          fwd_packet_length_max, fwd_packet_length_min, fwd_packet_length_mean, fwd_packet_length_std,
          bwd_packet_length_max, bwd_packet_length_min, bwd_packet_length_mean, bwd_packet_length_std,
          flow_bytes_per_second, flow_packets_per_second, flow_iat_mean, flow_iat_std, flow_iat_max, flow_iat_min,
          fwd_iat_total, fwd_iat_mean, fwd_iat_std, fwd_iat_max, fwd_iat_min,
          bwd_iat_total, bwd_iat_mean, bwd_iat_std, bwd_iat_max, bwd_iat_min,
          fwd_psh_flags, bwd_psh_flags, fwd_urg_flags, bwd_urg_flags,
          fwd_header_length, bwd_header_length, fwd_packets_per_second, bwd_packets_per_second,
          packet_length_min, packet_length_max, packet_length_mean, packet_length_std, packet_length_variance,
          fin_flag_count, syn_flag_count, rst_flag_count, psh_flag_count, ack_flag_count, urg_flag_count,
          cwe_flag_count, ece_flag_count, down_up_ratio, packet_size_avg,
          fwd_segment_size_avg, bwd_segment_size_avg, fwd_bytes_per_byte_avg, fwd_packets_per_byte_avg, fwd_block_rate_avg,
          bwd_bytes_per_byte_avg, bwd_packets_per_byte_avg, bwd_block_rate_avg,
          subflow_fwd_packets, subflow_fwd_bytes, subflow_bwd_packets, subflow_bwd_bytes,
          init_fwd_win_bytes, init_bwd_win_bytes, fwd_act_data_packets, fwd_segment_size_min,
          active_mean, active_std, active_max, active_min,
          idle_mean, idle_std, idle_max, idle_min
        FROM flows 
        WHERE flow_id = $1 AND is_processed = false
      `, [flowId]);
      
      if (result.rows.length === 0) {
        console.log(`[PipelineProcessor] Flow ${flowId} not found or already processed`);
        return { success: false, reason: 'Flow not found or already processed' };
      }
      
      const flow = result.rows[0];
      const processingResult = await this.processSingleFlow(flow);
      
      if (processingResult.success) {
        console.log(`[PipelineProcessor] ✅ Flow ${flowId} processed immediately: ${processingResult.isAttack ? 'ATTACK' : 'NORMAL'}`);
      } else {
        console.error(`[PipelineProcessor] ❌ Failed to process flow ${flowId}: ${processingResult.error}`);
      }
      
      return processingResult;
      
    } catch (error) {
      console.error(`[PipelineProcessor] Error processing flow ${flowId} immediately:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset processing status for flows (for debugging)
   */
  async resetProcessingStatus(flowIds = null) {
    try {
      let queryText = 'UPDATE flows SET is_processed = false, processed_at = NULL';
      let values = [];
      
      if (flowIds && flowIds.length > 0) {
        queryText += ' WHERE flow_id = ANY($1)';
        values = [flowIds];
      }
      
      const result = await query(queryText, values);
      console.log(`[PipelineProcessor] Reset processing status for ${result.rowCount} flows`);
      
      return result.rowCount;
    } catch (error) {
      console.error('[PipelineProcessor] Error resetting processing status:', error);
      return 0;
    }
  }

  /**
   * Map attack type and confidence to severity level
   */
  mapAttackTypeToSeverity(attackType, confidence) {
    const normalizedType = attackType.toLowerCase().trim();
    let baseSeverity = 'medium';

    if (normalizedType === 'normal') {
      return 'low';
    } else if (normalizedType.includes('dos') || normalizedType.includes('ddos')) {
      baseSeverity = 'critical';
    } else if (normalizedType.includes('u2r')) {
      baseSeverity = 'critical';
    } else if (normalizedType.includes('r2l')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('web attack') || normalizedType.includes('web_attack')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('bfa') || normalizedType.includes('brute')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('probe') || normalizedType.includes('scan')) {
      baseSeverity = 'medium';
    } else if (normalizedType.includes('sql') || normalizedType.includes('injection')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('xss')) {
      baseSeverity = 'high';
    }

    if (confidence >= 0.9) {
      if (baseSeverity === 'medium') return 'high';
      return baseSeverity;
    } else if (confidence >= 0.7) {
      return baseSeverity;
    } else if (confidence >= 0.5) {
      if (baseSeverity === 'critical') return 'high';
      if (baseSeverity === 'high') return 'medium';
      return baseSeverity;
    } else {
      return 'low';
    }
  }

  /**
   * Log web attack detection results
   */
  logWebAttackDetection(flow, prediction, originalAttackType = null) {
    const timestamp = new Date().toISOString();
    const flowInfo = `${flow.src_ip}:${flow.src_port} → ${flow.dst_ip}:${flow.dst_port}`;
    const protocol = flow.protocol === 6 ? 'TCP' : flow.protocol === 17 ? 'UDP' : `Protocol-${flow.protocol}`;
    
    // Create detailed log message for web attack
    let logMessage = `\n🚨 [WEB ATTACK DETECTION] ${timestamp}`;
    logMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    logMessage += `\n🎯 WEB SERVER NETWORK TARGET DETECTED:`;
    logMessage += `\n   • Target IP: ${flow.dst_ip} (172.17.0.0/25 NETWORK)`;
    logMessage += `\n   • Attacker: ${flow.src_ip}:${flow.src_port}`;
    logMessage += `\n   • Protocol: ${protocol}`;
    logMessage += `\n   • Flow ID: ${flow.flow_id}`;
    
    if (originalAttackType) {
      logMessage += `\n\n🔄 ATTACK CONVERSION:`;
      logMessage += `\n   • Original ML Prediction: ${originalAttackType}`;
      logMessage += `\n   • Converted to: Web Attack`;
      logMessage += `\n   • Reason: Target belongs to web server network (172.17.0.0/25)`;
    }
    
    logMessage += `\n\n🚨 ATTACK CLASSIFICATION:`;
    logMessage += `\n   • Attack Type: ${prediction.attackType}`;
    logMessage += `\n   • Severity: ${prediction.severity.toUpperCase()}`;
    logMessage += `\n   • Confidence: ${prediction.confidencePercentage}%`;
    logMessage += `\n   • Detection Method: Rule-based (Network Target)`;
    logMessage += `\n   • Model: ${prediction.modelName}`;
    
    logMessage += `\n\n⚡ IMMEDIATE ACTIONS:`;
    logMessage += `\n   • 🚨 WEB ATTACK ALERT - High Priority`;
    logMessage += `\n   • 📡 Real-time notification sent`;
    logMessage += `\n   • 💾 Attack logged to database`;
    logMessage += `\n   • 🔔 Frontend alert triggered`;
    
    logMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Log with high priority (use console.warn for visibility)
    console.warn(logMessage);
  }

  /**
   * Check if IP is already blocked
   */
  async checkIfIPBlocked(ipAddress) {
    try {
      const result = await query(
        'SELECT id FROM blocked_ips WHERE ip_address = $1 AND is_active = TRUE',
        [ipAddress]
      );
      return result.rows.length > 0;
    } catch (error) {
      console.error(`[PipelineProcessor] Error checking if IP ${ipAddress} is blocked:`, error);
      return false; // Don't block on error
    }
  }

  /**
   * Check DOS attack count and auto-block IP if threshold is exceeded
   */
  async checkAndAutoBlockIP(flow, prediction) {
    try {
      // Only check for DOS attacks
      const isDoS = prediction.attackType && 
        (prediction.attackType.toLowerCase().includes('dos') || 
         prediction.attackType.toLowerCase().includes('ddos') ||
         prediction.attackType.toLowerCase().includes('denial'));

      if (!isDoS) {
        return; // Not a DOS attack, no need to check blocking
      }

      const ipAddress = flow.src_ip;
      const timeWindowHours = 24; // Check last 24 hours
      const dosThreshold = 10; // Block after 10 DOS attacks

      // Count DOS attacks from this IP in the time window
      const dosCount = await query(`
        SELECT COUNT(*) as count
        FROM attack_events 
        WHERE src_ip = $1 
          AND detected_at >= CURRENT_TIMESTAMP - INTERVAL '${timeWindowHours} hours'
          AND (
            LOWER(attack_type) LIKE '%dos%' OR 
            LOWER(attack_type) LIKE '%ddos%' OR
            LOWER(attack_type) LIKE '%denial%'
          )
      `, [ipAddress]);

      const attackCount = parseInt(dosCount.rows[0].count);

      console.log(`[PipelineProcessor] DOS Check for ${ipAddress}: ${attackCount}/${dosThreshold} attacks in ${timeWindowHours}h`);

      // Check if threshold is exceeded
      if (attackCount >= dosThreshold) {
        // Check if IP is already blocked
        const isAlreadyBlocked = await this.checkIfIPBlocked(ipAddress);
        
        if (!isAlreadyBlocked) {
          console.log(`🚫 [AUTO-BLOCK] Threshold exceeded for ${ipAddress}: ${attackCount} DOS attacks in ${timeWindowHours}h`);
          
          // Auto-block the IP
          await this.autoBlockIP(ipAddress, attackCount, timeWindowHours, prediction.attackType);
        }
      }

    } catch (error) {
      console.error('[PipelineProcessor] Error checking and auto-blocking IP:', error);
    }
  }

  /**
   * Automatically block an IP address
   */
  async autoBlockIP(ipAddress, dosAttackCount, timeWindowHours, attackType) {
    try {
      const reason = `Automatic block: ${dosAttackCount} DOS attacks detected in ${timeWindowHours} hours`;
      const notes = `Auto-blocked due to excessive ${attackType} attacks. Threshold: ${dosAttackCount} attacks in ${timeWindowHours} hours.`;

      // Insert into blocked_ips table
      const result = await query(`
        INSERT INTO blocked_ips (
          ip_address, blocked_by, reason, dos_attack_count, 
          time_window_hours, notes
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [ipAddress, 'system', reason, dosAttackCount, timeWindowHours, notes]);

      const blockedIP = result.rows[0];

      console.log(`🚫 [AUTO-BLOCK SUCCESS] IP ${ipAddress} blocked automatically`);
      console.log(`   • DOS Attacks: ${dosAttackCount} in ${timeWindowHours}h`);
      console.log(`   • Attack Type: ${attackType}`);
      console.log(`   • Block ID: ${blockedIP.id}`);
      console.log(`   • Reason: ${reason}`);

      // Broadcast blocking notification to SSE clients
      this.broadcastBlockingNotification({
        action: 'ip_blocked',
        ip_address: ipAddress,
        reason: reason,
        dos_attack_count: dosAttackCount,
        time_window_hours: timeWindowHours,
        attack_type: attackType,
        blocked_at: blockedIP.blocked_at,
        blocked_by: 'system'
      });

      return blockedIP;

    } catch (error) {
      console.error(`[PipelineProcessor] Error auto-blocking IP ${ipAddress}:`, error);
      throw error;
    }
  }

  /**
   * Broadcast IP blocking notification to SSE clients
   */
  broadcastBlockingNotification(blockingData) {
    try {
      const connections = getSseConnections();
      if (connections.size === 0) {
        console.log('[PipelineProcessor] No SSE clients connected, skipping blocking broadcast');
        return;
      }

      // Format SSE data for blocking notification
      const sseData = {
        type: 'ip_blocking',
        action: blockingData.action,
        ip_address: blockingData.ip_address,
        reason: blockingData.reason,
        dos_attack_count: blockingData.dos_attack_count,
        time_window_hours: blockingData.time_window_hours,
        attack_type: blockingData.attack_type,
        blocked_at: blockingData.blocked_at,
        blocked_by: blockingData.blocked_by,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all connected SSE clients
      let broadcastCount = 0;
      connections.forEach(res => {
        try {
          res.write(`data: ${JSON.stringify(sseData)}\n\n`);
          broadcastCount++;
        } catch (error) {
          console.error('[PipelineProcessor] Error broadcasting blocking notification to SSE client:', error);
          connections.delete(res);
        }
      });

      console.log(`[PipelineProcessor] Broadcasted IP blocking notification to ${broadcastCount} SSE client(s)`);
    } catch (error) {
      console.error('[PipelineProcessor] Error broadcasting IP blocking notification:', error);
    }
  }

  /**
   * Log detailed detection results for each flow
   */
  logDetectionResult(flow, prediction, userId) {
    const timestamp = new Date().toISOString();
    const flowInfo = `${flow.src_ip}:${flow.src_port} → ${flow.dst_ip}:${flow.dst_port}`;
    const protocol = flow.protocol === 6 ? 'TCP' : flow.protocol === 17 ? 'UDP' : `Protocol-${flow.protocol}`;
    
    // Create detailed log message
    let logMessage = `\n🔍 [DETECTION RESULT] ${timestamp}`;
    logMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    logMessage += `\n📊 Flow Information:`;
    logMessage += `\n   • Flow ID: ${flow.flow_id}`;
    logMessage += `\n   • Connection: ${flowInfo}`;
    logMessage += `\n   • Protocol: ${protocol}`;
    logMessage += `\n   • Duration: ${flow.flow_duration || 0}μs`;
    logMessage += `\n   • Packets: ${flow.total_fwd_packets || 0} fwd, ${flow.total_backward_packets || 0} bwd`;
    logMessage += `\n   • Bytes: ${((flow.total_length_of_fwd_packets || 0) + (flow.total_length_of_bwd_packets || 0)).toLocaleString()}`;
    
    logMessage += `\n\n🤖 ML Model Results:`;
    logMessage += `\n   • Model: ${prediction.modelName || 'Unknown'}`;
    logMessage += `\n   • Model Type: ${prediction.modelType || 'Unknown'}`;
    logMessage += `\n   • Model Version: ${prediction.modelVersion || 'v1.0'}`;
    logMessage += `\n   • User ID: ${userId}`;
    
    logMessage += `\n\n🎯 Detection Results:`;
    logMessage += `\n   • Is Attack: ${prediction.isAttack ? '⚠️  YES' : '✅ NO'}`;
    logMessage += `\n   • Attack Type: ${prediction.attackType || 'Unknown'}`;
    logMessage += `\n   • Severity: ${prediction.severity || 'low'}`;
    logMessage += `\n   • Confidence: ${((prediction.confidence || 0) * 100).toFixed(1)}%`;
    logMessage += `\n   • Inference Time: ${prediction.inferenceTime || 0}ms`;
    
    // Add probabilities if available
    if (prediction.probabilities && Object.keys(prediction.probabilities).length > 0) {
      logMessage += `\n\n📈 Class Probabilities:`;
      Object.entries(prediction.probabilities)
        .sort(([,a], [,b]) => Number(b) - Number(a))
        .forEach(([type, prob]) => {
          const percentage = (Number(prob) * 100).toFixed(1);
          const icon = type.toLowerCase().includes('attack') || type.toLowerCase().includes('dos') || type.toLowerCase().includes('malware') ? '⚠️' : '✅';
          logMessage += `\n   • ${icon} ${type}: ${percentage}%`;
        });
    }
    
    // Add action taken
    logMessage += `\n\n⚡ Action Taken:`;
    if (prediction.isAttack) {
      logMessage += `\n   • 🚨 ATTACK DETECTED - Saved to database`;
      logMessage += `\n   • 📡 Broadcasted via SSE to frontend`;
      logMessage += `\n   • 🔔 Alert notification sent`;
    } else {
      logMessage += `\n   • ✅ Normal traffic - No action required`;
      logMessage += `\n   • 📝 Logged for monitoring`;
    }
    
    logMessage += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    
    // Log with appropriate level
    if (prediction.isAttack) {
      console.warn(logMessage); // Use warn for attacks to make them more visible
    } else {
      console.log(logMessage);  // Use log for normal traffic
    }
  }
}

export default PipelineProcessor;

