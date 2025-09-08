// backend/services/cicflowmeterCollector.js - CICFlowMeter Data Collector
import fs from 'fs';
import csv from 'csv-parser';
import net from 'net';
import { query } from './database.js';

export class CICFlowMeterCollector {
  constructor(options = {}) {
    this.csvPath = options.csvPath || process.env.CICFLOWMETER_CSV_PATH;
    this.socketPort = options.socketPort || parseInt(process.env.CICFLOWMETER_SOCKET_PORT) || 9999;
    this.socketHost = options.socketHost || process.env.CICFLOWMETER_SOCKET_HOST || 'localhost';
    this.batchSize = options.batchSize || parseInt(process.env.CICFLOWMETER_BATCH_SIZE) || 100;
    this.pollInterval = options.pollInterval || parseInt(process.env.CICFLOWMETER_POLL_INTERVAL) || 5000;
    
    this.isRunning = false;
    this.socketServer = null;
    this.csvWatcher = null;
    this.buffer = [];
    this.lastProcessedLine = 0;
  }

  /**
   * Start the collector service
   */
  async start() {
    console.log('[CICFlowMeter] Starting collector service...');
    
    try {
      // Start socket server for real-time data
      await this.startSocketServer();
      
      // Start CSV file monitoring
      if (this.csvPath) {
        await this.startCSVMonitoring();
      }
      
      this.isRunning = true;
      console.log('[CICFlowMeter] Collector service started successfully');
      
    } catch (error) {
      console.error('[CICFlowMeter] Failed to start collector:', error);
      throw error;
    }
  }

  /**
   * Stop the collector service
   */
  async stop() {
    console.log('[CICFlowMeter] Stopping collector service...');
    
    this.isRunning = false;
    
    if (this.socketServer) {
      this.socketServer.close();
      this.socketServer = null;
    }
    
    if (this.csvWatcher) {
      this.csvWatcher.close();
      this.csvWatcher = null;
    }
    
    // Process remaining buffer
    if (this.buffer.length > 0) {
      await this.processBatch(this.buffer);
      this.buffer = [];
    }
    
    console.log('[CICFlowMeter] Collector service stopped');
  }

  /**
   * Start socket server for real-time CICFlowMeter data
   */
  async startSocketServer() {
    return new Promise((resolve, reject) => {
      this.socketServer = net.createServer((socket) => {
        console.log('[CICFlowMeter] New socket connection from:', socket.remoteAddress);
        
        let buffer = '';
        
        socket.on('data', (data) => {
          buffer += data.toString();
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop(); // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const flowData = this.parseCSVLine(line);
                if (flowData) {
                  this.buffer.push(flowData);
                  
                  // Process batch when buffer is full
                  if (this.buffer.length >= this.batchSize) {
                    this.processBatch(this.buffer.splice(0, this.batchSize));
                  }
                }
              } catch (error) {
                console.error('[CICFlowMeter] Error parsing socket data:', error);
              }
            }
          }
        });
        
        socket.on('close', () => {
          console.log('[CICFlowMeter] Socket connection closed');
        });
        
        socket.on('error', (error) => {
          console.error('[CICFlowMeter] Socket error:', error);
        });
      });
      
      this.socketServer.listen(this.socketPort, this.socketHost, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`[CICFlowMeter] Socket server listening on ${this.socketHost}:${this.socketPort}`);
          resolve();
        }
      });
      
      this.socketServer.on('error', (error) => {
        console.error('[CICFlowMeter] Socket server error:', error);
        reject(error);
      });
    });
  }

  /**
   * Start CSV file monitoring
   */
  async startCSVMonitoring() {
    if (!fs.existsSync(this.csvPath)) {
      console.warn(`[CICFlowMeter] CSV file not found: ${this.csvPath}`);
      return;
    }
    
    console.log(`[CICFlowMeter] Monitoring CSV file: ${this.csvPath}`);
    
    // Watch for file changes
    this.csvWatcher = fs.watch(this.csvPath, async (eventType) => {
      if (eventType === 'change') {
        await this.processNewCSVLines();
      }
    });
    
    // Initial processing
    await this.processNewCSVLines();
  }

  /**
   * Process new lines from CSV file
   */
  async processNewCSVLines() {
    try {
      const lines = fs.readFileSync(this.csvPath, 'utf8').split('\n');
      const newLines = lines.slice(this.lastProcessedLine);
      
      for (const line of newLines) {
        if (line.trim()) {
          try {
            const flowData = this.parseCSVLine(line);
            if (flowData) {
              this.buffer.push(flowData);
            }
          } catch (error) {
            console.error('[CICFlowMeter] Error parsing CSV line:', error);
          }
        }
      }
      
      this.lastProcessedLine = lines.length;
      
      // Process batch if buffer is full
      if (this.buffer.length >= this.batchSize) {
        await this.processBatch(this.buffer.splice(0, this.batchSize));
      }
      
    } catch (error) {
      console.error('[CICFlowMeter] Error processing CSV file:', error);
    }
  }

  /**
   * Parse a CSV line into flow data
   */
  parseCSVLine(line) {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    
    if (values.length < 10) {
      return null; // Skip incomplete lines
    }
    
    try {
      return {
        flow_id: this.generateFlowId(values[1], values[2], values[3], values[4]), // src_ip, dst_ip, src_port, dst_port
        src_ip: values[1],
        dst_ip: values[2],
        src_port: parseInt(values[3]) || 0,
        dst_port: parseInt(values[4]) || 0,
        protocol: values[5] || 'TCP',
        
        // Flow statistics
        flow_duration: parseFloat(values[6]) || 0,
        total_fwd_packets: parseInt(values[7]) || 0,
        total_backward_packets: parseInt(values[8]) || 0,
        total_length_of_fwd_packets: parseInt(values[9]) || 0,
        total_length_of_bwd_packets: parseInt(values[10]) || 0,
        
        // Packet length features
        fwd_packet_length_max: parseFloat(values[11]) || 0,
        fwd_packet_length_min: parseFloat(values[12]) || 0,
        fwd_packet_length_mean: parseFloat(values[13]) || 0,
        fwd_packet_length_std: parseFloat(values[14]) || 0,
        bwd_packet_length_max: parseFloat(values[15]) || 0,
        bwd_packet_length_min: parseFloat(values[16]) || 0,
        bwd_packet_length_mean: parseFloat(values[17]) || 0,
        bwd_packet_length_std: parseFloat(values[18]) || 0,
        
        // Flow timing features
        flow_bytes_per_second: parseFloat(values[19]) || 0,
        flow_packets_per_second: parseFloat(values[20]) || 0,
        flow_iat_mean: parseFloat(values[21]) || 0,
        flow_iat_std: parseFloat(values[22]) || 0,
        flow_iat_max: parseFloat(values[23]) || 0,
        flow_iat_min: parseFloat(values[24]) || 0,
        
        // Forward/Backward IAT features
        fwd_iat_total: parseFloat(values[25]) || 0,
        fwd_iat_mean: parseFloat(values[26]) || 0,
        fwd_iat_std: parseFloat(values[27]) || 0,
        fwd_iat_max: parseFloat(values[28]) || 0,
        fwd_iat_min: parseFloat(values[29]) || 0,
        bwd_iat_total: parseFloat(values[30]) || 0,
        bwd_iat_mean: parseFloat(values[31]) || 0,
        bwd_iat_std: parseFloat(values[32]) || 0,
        bwd_iat_max: parseFloat(values[33]) || 0,
        bwd_iat_min: parseFloat(values[34]) || 0,
        
        // Protocol features
        fwd_psh_flags: parseInt(values[35]) || 0,
        bwd_psh_flags: parseInt(values[36]) || 0,
        fwd_urg_flags: parseInt(values[37]) || 0,
        bwd_urg_flags: parseInt(values[38]) || 0,
        fwd_header_length: parseInt(values[39]) || 0,
        bwd_header_length: parseInt(values[40]) || 0,
        fwd_packets_per_second: parseFloat(values[41]) || 0,
        bwd_packets_per_second: parseFloat(values[42]) || 0,
        
        // Window size and packet length features
        min_packet_length: parseFloat(values[43]) || 0,
        max_packet_length: parseFloat(values[44]) || 0,
        packet_length_mean: parseFloat(values[45]) || 0,
        packet_length_std: parseFloat(values[46]) || 0,
        packet_length_variance: parseFloat(values[47]) || 0,
        
        // Flag counts
        fin_flag_count: parseInt(values[48]) || 0,
        syn_flag_count: parseInt(values[49]) || 0,
        rst_flag_count: parseInt(values[50]) || 0,
        psh_flag_count: parseInt(values[51]) || 0,
        ack_flag_count: parseInt(values[52]) || 0,
        urg_flag_count: parseInt(values[53]) || 0,
        cwe_flag_count: parseInt(values[54]) || 0,
        ece_flag_count: parseInt(values[55]) || 0,
        
        // Additional features
        down_up_ratio: parseInt(values[56]) || 0,
        average_packet_size: parseFloat(values[57]) || 0,
        avg_fwd_segment_size: parseFloat(values[58]) || 0,
        avg_bwd_segment_size: parseFloat(values[59]) || 0,
        
        // Flow start time (use current time if not available)
        flow_start_time: new Date().toISOString()
      };
    } catch (error) {
      console.error('[CICFlowMeter] Error parsing flow data:', error);
      return null;
    }
  }

  /**
   * Generate unique flow ID
   */
  generateFlowId(srcIp, dstIp, srcPort, dstPort) {
    return `${srcIp}_${dstIp}_${srcPort}_${dstPort}_${Date.now()}`;
  }

  /**
   * Process a batch of flow data
   */
  async processBatch(flows) {
    if (flows.length === 0) return;
    
    try {
      console.log(`[CICFlowMeter] Processing batch of ${flows.length} flows`);
      
      // Prepare batch insert query
      const columns = Object.keys(flows[0]);
      const placeholders = flows.map((_, index) => 
        `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
      ).join(', ');
      
      const values = flows.flatMap(flow => 
        columns.map(col => flow[col])
      );
      
      const queryText = `
        INSERT INTO flows (${columns.join(', ')})
        VALUES ${placeholders}
        ON CONFLICT (flow_id) DO NOTHING
      `;
      
      await query(queryText, values);
      
      console.log(`[CICFlowMeter] Successfully inserted ${flows.length} flows`);
      
    } catch (error) {
      console.error('[CICFlowMeter] Error processing batch:', error);
      
      // Try individual inserts as fallback
      for (const flow of flows) {
        try {
          await this.insertSingleFlow(flow);
        } catch (individualError) {
          console.error('[CICFlowMeter] Error inserting individual flow:', individualError);
        }
      }
    }
  }

  /**
   * Insert a single flow
   */
  async insertSingleFlow(flow) {
    const columns = Object.keys(flow);
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const values = columns.map(col => flow[col]);
    
    const queryText = `
      INSERT INTO flows (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (flow_id) DO NOTHING
    `;
    
    await query(queryText, values);
  }

  /**
   * Get collector statistics
   */
  async getStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_flows,
          COUNT(CASE WHEN is_processed = false THEN 1 END) as unprocessed_flows,
          COUNT(CASE WHEN captured_at > NOW() - INTERVAL '1 hour' THEN 1 END) as flows_last_hour,
          MIN(captured_at) as oldest_flow,
          MAX(captured_at) as newest_flow
        FROM flows
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('[CICFlowMeter] Error getting stats:', error);
      return null;
    }
  }

  /**
   * Clean up old processed flows
   */
  async cleanupOldFlows(daysToKeep = 7) {
    try {
      const result = await query(`
        SELECT cleanup_old_flows($1) as deleted_count
      `, [daysToKeep]);
      
      const deletedCount = result.rows[0].deleted_count;
      console.log(`[CICFlowMeter] Cleaned up ${deletedCount} old flows`);
      
      return deletedCount;
    } catch (error) {
      console.error('[CICFlowMeter] Error cleaning up old flows:', error);
      return 0;
    }
  }
}

export default CICFlowMeterCollector;


