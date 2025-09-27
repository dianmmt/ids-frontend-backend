// backend/services/pipelineProcessor.js - ML Pipeline Processor
import { query } from './database.js';
import { DirectMLPredictorWithDB } from './directMLPredictorWithDB.js';
import cron from 'node-cron';

export class PipelineProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || parseInt(process.env.PIPELINE_BATCH_SIZE) || 50;
    this.processingInterval = options.processingInterval || parseInt(process.env.PIPELINE_INTERVAL) || 30000; // 30 seconds
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 5000; // 5 seconds
    
    // Use DirectMLPredictorWithDB for user-aware predictions
    this.mlPredictor = new DirectMLPredictorWithDB();
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
   * Get unprocessed flows from database
   */
  async getUnprocessedFlows() {
    try {
      const result = await query(`
        SELECT 
          flow_id,
          src_ip,
          dst_ip,
          src_port,
          dst_port,
          protocol,
          duration_seconds as flow_duration,
          
          -- Forward/Backward packet counts and lengths
          total_fwd_packets,
          total_backward_packets,
          total_length_of_fwd_packets,
          total_length_of_bwd_packets,
          
          -- Forward packet length features
          fwd_packet_length_max,
          fwd_packet_length_min,
          fwd_packet_length_mean,
          fwd_packet_length_std,
          
          -- Backward packet length features
          bwd_packet_length_max,
          bwd_packet_length_min,
          bwd_packet_length_mean,
          bwd_packet_length_std,
          
          -- Flow rate features
          flow_bytes_per_second,
          flow_packets_per_second,
          
          -- Flow IAT features
          flow_iat_mean,
          flow_iat_std,
          flow_iat_max,
          flow_iat_min,
          
          -- Forward IAT features
          fwd_iat_total,
          fwd_iat_mean,
          fwd_iat_std,
          fwd_iat_max,
          fwd_iat_min,
          
          -- Backward IAT features
          bwd_iat_total,
          bwd_iat_mean,
          bwd_iat_std,
          bwd_iat_max,
          bwd_iat_min,
          
          -- Protocol flags
          fwd_psh_flags,
          bwd_psh_flags,
          fwd_urg_flags,
          bwd_urg_flags,
          
          -- Header length features
          fwd_header_length,
          bwd_header_length,
          
          -- Forward/Backward packet rates
          fwd_packets_per_second,
          bwd_packets_per_second,
          
          -- Packet length statistics
          packet_length_min,
          packet_length_max,
          packet_length_mean,
          packet_length_std,
          packet_length_variance,
          
          -- TCP flags
          fin_flag_count,
          syn_flag_count,
          rst_flag_count,
          psh_flag_count,
          ack_flag_count,
          urg_flag_count,
          cwe_flag_count,
          ece_flag_count,
          
          -- Flow ratios and averages
          down_up_ratio,
          packet_size_avg,
          fwd_segment_size_avg,
          bwd_segment_size_avg,
          
          -- Forward flow features
          fwd_bytes_per_byte_avg,
          fwd_packets_per_byte_avg,
          fwd_block_rate_avg,
          
          -- Backward flow features
          bwd_bytes_per_byte_avg,
          bwd_packets_per_byte_avg,
          bwd_block_rate_avg,
          
          -- Subflow features
          subflow_fwd_packets,
          subflow_fwd_bytes,
          subflow_bwd_packets,
          subflow_bwd_bytes,
          
          -- Window size features
          init_fwd_win_bytes,
          init_bwd_win_bytes,
          fwd_act_data_packets,
          fwd_segment_size_min,
          
          -- Active/Idle time features
          active_mean,
          active_std,
          active_max,
          active_min,
          idle_mean,
          idle_std,
          idle_max,
          idle_min,
          
          -- Basic flow statistics
          packet_count,
          byte_count,
          risk_score,
          flow_start_time,
          captured_at
        FROM flows 
        WHERE is_processed = false 
        ORDER BY captured_at ASC 
        LIMIT $1
      `, [this.batchSize * 2]); // Get more than batch size to account for processing failures
      
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
   * Process a single flow
   */
  async processSingleFlow(flow) {
    try {
      // Prepare flow data for ML prediction
      const mlInput = this.prepareMLInput(flow);
      
      // Get user ID from flow data or use default
      const userId = flow.user_id || '1';
      
      // Create user-aware ML predictor for this flow
      const userMLPredictor = new DirectMLPredictorWithDB(userId);
      
      // Get ML prediction using user's selected model
      const prediction = await userMLPredictor.predictAttack(mlInput);
      
      // Log which model was used
      console.log(`[PipelineProcessor] Flow ${flow.flow_id} processed with model: ${prediction.modelName} (user: ${userId})`);
      
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
        userId: userId
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
   * Prepare flow data for ML prediction
   */
  prepareMLInput(flow) {
    // Calculate derived features
    const totalPackets = (flow.total_fwd_packets || 0) + (flow.total_backward_packets || 0);
    const totalBytes = (flow.total_length_of_fwd_packets || 0) + (flow.total_length_of_bwd_packets || 0);
    const avgPacketSize = totalPackets > 0 ? totalBytes / totalPackets : 0;

    return {
      // Basic flow identification
      source_ip: flow.src_ip,
      destination_ip: flow.dst_ip,
      source_port: flow.src_port,
      destination_port: flow.dst_port,
      protocol: flow.protocol,
      timestamp: flow.flow_start_time,
      
      // Basic flow statistics
      packet_count: totalPackets,
      byte_count: totalBytes,
      duration: flow.flow_duration || 0,
      packets_per_second: flow.flow_packets_per_second || 0,
      bytes_per_second: flow.flow_bytes_per_second || 0,
      avg_packet_size: avgPacketSize,
      
      // Forward/Backward packet counts and lengths
      total_fwd_packets: flow.total_fwd_packets || 0,
      total_backward_packets: flow.total_backward_packets || 0,
      total_length_of_fwd_packets: flow.total_length_of_fwd_packets || 0,
      total_length_of_bwd_packets: flow.total_length_of_bwd_packets || 0,
      
      // Forward packet length features
      fwd_packet_length_max: flow.fwd_packet_length_max || 0,
      fwd_packet_length_min: flow.fwd_packet_length_min || 0,
      fwd_packet_length_mean: flow.fwd_packet_length_mean || 0,
      fwd_packet_length_std: flow.fwd_packet_length_std || 0,
      
      // Backward packet length features
      bwd_packet_length_max: flow.bwd_packet_length_max || 0,
      bwd_packet_length_min: flow.bwd_packet_length_min || 0,
      bwd_packet_length_mean: flow.bwd_packet_length_mean || 0,
      bwd_packet_length_std: flow.bwd_packet_length_std || 0,
      
      // Flow IAT features
      flow_iat_mean: flow.flow_iat_mean || 0,
      flow_iat_std: flow.flow_iat_std || 0,
      flow_iat_max: flow.flow_iat_max || 0,
      flow_iat_min: flow.flow_iat_min || 0,
      
      // Forward IAT features
      fwd_iat_total: flow.fwd_iat_total || 0,
      fwd_iat_mean: flow.fwd_iat_mean || 0,
      fwd_iat_std: flow.fwd_iat_std || 0,
      fwd_iat_max: flow.fwd_iat_max || 0,
      fwd_iat_min: flow.fwd_iat_min || 0,
      
      // Backward IAT features
      bwd_iat_total: flow.bwd_iat_total || 0,
      bwd_iat_mean: flow.bwd_iat_mean || 0,
      bwd_iat_std: flow.bwd_iat_std || 0,
      bwd_iat_max: flow.bwd_iat_max || 0,
      bwd_iat_min: flow.bwd_iat_min || 0,
      
      // Protocol flags
      fwd_psh_flags: flow.fwd_psh_flags || 0,
      bwd_psh_flags: flow.bwd_psh_flags || 0,
      fwd_urg_flags: flow.fwd_urg_flags || 0,
      bwd_urg_flags: flow.bwd_urg_flags || 0,
      
      // Header length features
      fwd_header_length: flow.fwd_header_length || 0,
      bwd_header_length: flow.bwd_header_length || 0,
      
      // Forward/Backward packet rates
      fwd_packets_per_second: flow.fwd_packets_per_second || 0,
      bwd_packets_per_second: flow.bwd_packets_per_second || 0,
      
      // Packet length statistics
      packet_length_min: flow.packet_length_min || 0,
      packet_length_max: flow.packet_length_max || 0,
      packet_length_mean: flow.packet_length_mean || 0,
      packet_length_std: flow.packet_length_std || 0,
      packet_length_variance: flow.packet_length_variance || 0,
      
      // TCP flags
      fin_flag_count: flow.fin_flag_count || 0,
      syn_flag_count: flow.syn_flag_count || 0,
      rst_flag_count: flow.rst_flag_count || 0,
      psh_flag_count: flow.psh_flag_count || 0,
      ack_flag_count: flow.ack_flag_count || 0,
      urg_flag_count: flow.urg_flag_count || 0,
      cwe_flag_count: flow.cwe_flag_count || 0,
      ece_flag_count: flow.ece_flag_count || 0,
      
      // Flow ratios and averages
      down_up_ratio: flow.down_up_ratio || 0,
      packet_size_avg: flow.packet_size_avg || 0,
      fwd_segment_size_avg: flow.fwd_segment_size_avg || 0,
      bwd_segment_size_avg: flow.bwd_segment_size_avg || 0,
      
      // Forward flow features
      fwd_bytes_per_byte_avg: flow.fwd_bytes_per_byte_avg || 0,
      fwd_packets_per_byte_avg: flow.fwd_packets_per_byte_avg || 0,
      fwd_block_rate_avg: flow.fwd_block_rate_avg || 0,
      
      // Backward flow features
      bwd_bytes_per_byte_avg: flow.bwd_bytes_per_byte_avg || 0,
      bwd_packets_per_byte_avg: flow.bwd_packets_per_byte_avg || 0,
      bwd_block_rate_avg: flow.bwd_block_rate_avg || 0,
      
      // Subflow features
      subflow_fwd_packets: flow.subflow_fwd_packets || 0,
      subflow_fwd_bytes: flow.subflow_fwd_bytes || 0,
      subflow_bwd_packets: flow.subflow_bwd_packets || 0,
      subflow_bwd_bytes: flow.subflow_bwd_bytes || 0,
      
      // Window size features
      init_fwd_win_bytes: flow.init_fwd_win_bytes || 0,
      init_bwd_win_bytes: flow.init_bwd_win_bytes || 0,
      fwd_act_data_packets: flow.fwd_act_data_packets || 0,
      fwd_segment_size_min: flow.fwd_segment_size_min || 0,
      
      // Active/Idle time features
      active_mean: flow.active_mean || 0,
      active_std: flow.active_std || 0,
      active_max: flow.active_max || 0,
      active_min: flow.active_min || 0,
      idle_mean: flow.idle_mean || 0,
      idle_std: flow.idle_std || 0,
      idle_max: flow.idle_max || 0,
      idle_min: flow.idle_min || 0,
      
      // Risk score
      risk_score: flow.risk_score || 0
    };
  }

  /**
   * Save attack detection to database
   */
  async saveAttackDetection(flow, prediction) {
    try {
      const eventId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const queryText = `
        INSERT INTO attack_events (
          event_id, flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
          is_attack, attack_type, confidence_score, severity,
          model_name, model_version, detection_method, inference_time_ms, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `;
      
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
        prediction.modelType || 'Unknown',
        'ml',
        prediction.inferenceTime || 0,
        new Date().toISOString()
      ];
      
      await query(queryText, values);
      
      console.log(`[PipelineProcessor] Attack detected: ${prediction.attackType} (${prediction.severity}) from ${flow.src_ip} to ${flow.dst_ip} using model: ${prediction.modelName}`);
      
    } catch (error) {
      console.error('[PipelineProcessor] Error saving attack detection:', error);
      throw error;
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
          f.duration_seconds as flow_duration,
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
}

export default PipelineProcessor;


