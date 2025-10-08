// backend/services/cicflowmeterCollector.js - CICFlowMeter Data Collector (Fixed)
import fs from 'fs';
import path from 'path';
import net from 'net';
import { query } from './database.js';
import CICFlowMeterFeatureMapper from './cicflowmeterFeatureMapper.js';

export class CICFlowMeterCollector {
  constructor(options = {}) {
    // File or directory mode
    this.csvPath = options.csvPath || process.env.CICFLOWMETER_CSV_PATH;
    this.csvDirectory = options.csvDirectory || process.env.CICFLOWMETER_CSV_DIRECTORY;
    this.csvPattern = options.csvPattern || process.env.CICFLOWMETER_CSV_PATTERN || '*_Flow.csv';
    
    // Socket configuration
    this.socketPort = options.socketPort || parseInt(process.env.CICFLOWMETER_SOCKET_PORT) || 9999;
    this.socketHost = options.socketHost || process.env.CICFLOWMETER_SOCKET_HOST || 'localhost';
    
    // Processing configuration
    this.batchSize = options.batchSize || parseInt(process.env.CICFLOWMETER_BATCH_SIZE) || 100;
    this.pollInterval = options.pollInterval || parseInt(process.env.CICFLOWMETER_POLL_INTERVAL) || 5000;
    
    // Initialize feature mapper
    this.featureMapper = new CICFlowMeterFeatureMapper();
    
    // State management
    this.isRunning = false;
    this.socketServer = null;
    this.csvWatcher = null;
    this.directoryWatcher = null;
    this.buffer = [];
    this.processedFiles = new Map(); // Track file positions: filename -> lastPosition
    this.isProcessing = false;
    
    // Debug log
    console.log('[CICFlowMeter] Constructor initialized:');
    console.log('  csvDirectory:', this.csvDirectory);
    console.log('  csvPattern:', this.csvPattern);
    console.log('  batchSize:', this.batchSize);
    console.log('  pollInterval:', this.pollInterval);
  }

  /**
   * Start the collector service
   */
  async start() {
    console.log('[CICFlowMeter] Starting collector service...');
    console.log('[CICFlowMeter] Configuration:', {
      csvPath: this.csvPath,
      csvDirectory: this.csvDirectory,
      csvPattern: this.csvPattern,
      socketPort: this.socketPort,
      batchSize: this.batchSize
    });
    
    try {
      // Start socket server for real-time data
      await this.startSocketServer();
      
      // Start CSV monitoring (file or directory)
      if (this.csvDirectory) {
        await this.startDirectoryMonitoring();
      } else if (this.csvPath) {
        await this.startCSVMonitoring();
      } else {
        console.warn('[CICFlowMeter] No CSV path or directory configured');
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
    
    if (this.directoryWatcher) {
      this.directoryWatcher.close();
      this.directoryWatcher = null;
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
   * Start directory monitoring for multiple CSV files
   */
  async startDirectoryMonitoring() {
    if (!fs.existsSync(this.csvDirectory)) {
      console.error(`[CICFlowMeter] Directory not found: ${this.csvDirectory}`);
      return;
    }
    
    console.log(`[CICFlowMeter] Monitoring directory: ${this.csvDirectory}`);
    console.log(`[CICFlowMeter] File pattern: ${this.csvPattern}`);
    console.log(`[CICFlowMeter] Mode: Processing latest file only`);
    
    // Process the latest file first
    await this.processLatestFile();
    
    // Watch for new files and changes
    this.directoryWatcher = fs.watch(this.csvDirectory, async (eventType, filename) => {
      if (!filename) return;
      
      // Check if filename matches pattern
      if (this.matchesPattern(filename)) {
        console.log(`[CICFlowMeter] File event: ${eventType} - ${filename}`);
        
        // Process the latest file (which might be the new one)
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for file to be fully written
        await this.processLatestFile();
      }
    });
    
    // Poll for new data periodically
    setInterval(async () => {
      if (this.isRunning && !this.isProcessing) {
        await this.processLatestFile();
      }
    }, this.pollInterval);
  }

  /**
   * Check if filename matches the pattern
   */
  matchesPattern(filename) {
    const pattern = this.csvPattern.replace(/\*/g, '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(filename);
  }

  /**
   * Get the latest CSV file in directory
   */
  getLatestFile() {
    try {
      const files = fs.readdirSync(this.csvDirectory);
      const matchingFiles = files.filter(file => this.matchesPattern(file));
      
      if (matchingFiles.length === 0) {
        console.log('[CICFlowMeter] No matching files found');
        return null;
      }
      
      // Sort by modification time, newest first
      const filesWithStats = matchingFiles.map(filename => {
        const filePath = path.join(this.csvDirectory, filename);
        const stats = fs.statSync(filePath);
        return {
          filename,
          filePath,
          mtime: stats.mtime,
          size: stats.size
        };
      }).sort((a, b) => b.mtime - a.mtime);
      
      const latest = filesWithStats[0];
      console.log(`[CICFlowMeter] Latest file: ${latest.filename} (${latest.size} bytes, modified: ${latest.mtime})`);
      
      return latest;
    } catch (error) {
      console.error('[CICFlowMeter] Error getting latest file:', error);
      return null;
    }
  }

  /**
   * Process the latest CSV file in directory
   */
  async processLatestFile() {
    const latestFile = this.getLatestFile();
    
    if (!latestFile) {
      return;
    }
    
    // Check if we're already tracking this file
    const lastPosition = this.processedFiles.get(latestFile.filename) || 0;
    
    // If this is a new file (not tracked yet) or has new data
    if (!this.processedFiles.has(latestFile.filename)) {
      console.log(`[CICFlowMeter] Found new file: ${latestFile.filename}`);
      // Clear tracking for old files if we have more than 5 files tracked
      if (this.processedFiles.size > 5) {
        const oldestKey = Array.from(this.processedFiles.keys())[0];
        this.processedFiles.delete(oldestKey);
        console.log(`[CICFlowMeter] Removed tracking for old file: ${oldestKey}`);
      }
    }
    
    // Process the file
    await this.processCSVFile(latestFile.filePath);
  }

  /**
   * Process all existing CSV files in directory
   */
  async processExistingFiles() {
    try {
      const files = fs.readdirSync(this.csvDirectory);
      const matchingFiles = files.filter(file => this.matchesPattern(file));
      
      console.log(`[CICFlowMeter] Found ${matchingFiles.length} matching files`);
      
      for (const filename of matchingFiles) {
        const filePath = path.join(this.csvDirectory, filename);
        await this.processCSVFile(filePath);
      }
    } catch (error) {
      console.error('[CICFlowMeter] Error processing existing files:', error);
    }
  }

  /**
   * Process a single CSV file
   */
  async processCSVFile(filePath) {
    if (this.isProcessing) {
      console.log('[CICFlowMeter] Already processing, skipping...');
      return;
    }
    
    this.isProcessing = true;
    
    try {
      const stats = fs.statSync(filePath);
      const filename = path.basename(filePath);
      
      // Get last processed position
      const lastPosition = this.processedFiles.get(filename) || 0;
      
      // Only process if file has new data
      if (stats.size <= lastPosition) {
        this.isProcessing = false;
        return;
      }
      
      console.log(`[CICFlowMeter] Processing file: ${filename}`);
      console.log(`[CICFlowMeter] Size: ${stats.size}, Last position: ${lastPosition}`);
      
      // Read file content from last position
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Calculate line position
      let currentPosition = 0;
      let startLine = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const lineSize = Buffer.byteLength(lines[i] + '\n', 'utf8');
        
        if (currentPosition + lineSize > lastPosition) {
          startLine = i;
          break;
        }
        
        currentPosition += lineSize;
      }
      
      // Skip header if this is the first time processing
      if (lastPosition === 0 && startLine === 0) {
        startLine = 1;
      }
      
      // Process new lines
      let processedCount = 0;
      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line) {
          try {
            const flowData = this.parseCSVLine(line);
            if (flowData) {
              this.buffer.push(flowData);
              processedCount++;
              
              // Process batch when buffer is full
              if (this.buffer.length >= this.batchSize) {
                await this.processBatch(this.buffer.splice(0, this.batchSize));
              }
            }
          } catch (error) {
            console.error('[CICFlowMeter] Error parsing line:', error.message);
          }
        }
      }
      
      // Process remaining buffer
      if (this.buffer.length > 0) {
        await this.processBatch(this.buffer.splice(0, this.buffer.length));
      }
      
      // Update last processed position
      this.processedFiles.set(filename, stats.size);
      
      console.log(`[CICFlowMeter] Processed ${processedCount} new lines from ${filename}`);
      
    } catch (error) {
      console.error(`[CICFlowMeter] Error processing file ${filePath}:`, error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Start CSV file monitoring (single file mode)
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
        await this.processCSVFile(this.csvPath);
      }
    });
    
    // Initial processing
    await this.processCSVFile(this.csvPath);
    
    // Poll periodically
    setInterval(async () => {
      if (this.isRunning && !this.isProcessing) {
        await this.processCSVFile(this.csvPath);
      }
    }, this.pollInterval);
  }

  /**
   * Parse a CSV line into flow data using proper feature mapping
   */
  parseCSVLine(line) {
    // Skip header
    if (line.startsWith('Flow ID') || !line.trim()) {
      return null;
    }
    
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    
    if (values.length < 83) {
      console.warn(`[CICFlowMeter] Insufficient columns: ${values.length}`);
      return null;
    }
    
    try {
      // Create CSV row object using CICFlowMeter headers
      const headers = [
        'Flow ID', 'Src IP', 'Src Port', 'Dst IP', 'Dst Port', 'Protocol', 'Timestamp', 'Flow Duration',
        'Tot Fwd Pkts', 'Tot Bwd Pkts', 'TotLen Fwd Pkts', 'TotLen Bwd Pkts',
        'Fwd Pkt Len Max', 'Fwd Pkt Len Min', 'Fwd Pkt Len Mean', 'Fwd Pkt Len Std',
        'Bwd Pkt Len Max', 'Bwd Pkt Len Min', 'Bwd Pkt Len Mean', 'Bwd Pkt Len Std',
        'Flow Byts/s', 'Flow Pkts/s', 'Flow IAT Mean', 'Flow IAT Std', 'Flow IAT Max', 'Flow IAT Min',
        'Fwd IAT Tot', 'Fwd IAT Mean', 'Fwd IAT Std', 'Fwd IAT Max', 'Fwd IAT Min',
        'Bwd IAT Tot', 'Bwd IAT Mean', 'Bwd IAT Std', 'Bwd IAT Max', 'Bwd IAT Min',
        'Fwd PSH Flags', 'Bwd PSH Flags', 'Fwd URG Flags', 'Bwd URG Flags',
        'Fwd Header Len', 'Bwd Header Len', 'Fwd Pkts/s', 'Bwd Pkts/s',
        'Pkt Len Min', 'Pkt Len Max', 'Pkt Len Mean', 'Pkt Len Std', 'Pkt Len Var',
        'FIN Flag Cnt', 'SYN Flag Cnt', 'RST Flag Cnt', 'PSH Flag Cnt', 'ACK Flag Cnt', 'URG Flag Cnt',
        'CWE Flag Count', 'ECE Flag Cnt', 'Down/Up Ratio', 'Pkt Size Avg',
        'Fwd Seg Size Avg', 'Bwd Seg Size Avg', 'Fwd Byts/b Avg', 'Fwd Pkts/b Avg', 'Fwd Blk Rate Avg',
        'Bwd Byts/b Avg', 'Bwd Pkts/b Avg', 'Bwd Blk Rate Avg',
        'Subflow Fwd Pkts', 'Subflow Fwd Byts', 'Subflow Bwd Pkts', 'Subflow Bwd Byts',
        'Init Fwd Win Byts', 'Init Bwd Win Byts', 'Fwd Act Data Pkts', 'Fwd Seg Size Min',
        'Active Mean', 'Active Std', 'Active Max', 'Active Min',
        'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min', 'Label'
      ];

      const csvRow = {};
      headers.forEach((header, index) => {
        csvRow[header] = values[index] || '';
      });
      
      // Use feature mapper to convert
      const mappedData = this.featureMapper.mapCsvToDatabase(csvRow);
      
      // Add required fields
      mappedData.flow_id = csvRow['Flow ID'] || this.generateFlowId(
        mappedData.src_ip, 
        mappedData.dst_ip, 
        mappedData.src_port, 
        mappedData.dst_port
      );
      
      mappedData.packet_count = (mappedData.total_fwd_packets || 0) + (mappedData.total_backward_packets || 0);
      mappedData.byte_count = (mappedData.total_length_of_fwd_packets || 0) + (mappedData.total_length_of_bwd_packets || 0);
      mappedData.flow_start_time = this.parseTimestamp(csvRow['Timestamp']) || new Date().toISOString();
      mappedData.captured_at = new Date().toISOString();
      mappedData.label = csvRow['Label'] || null;
      
      return mappedData;
    } catch (error) {
      console.error('[CICFlowMeter] Error parsing flow:', error.message);
      return null;
    }
  }

  /**
   * Parse timestamp from CICFlowMeter format
   */
  parseTimestamp(value) {
    if (!value) return null;
    try {
      const [datePart, timePart, ampm] = value.trim().split(' ');
      if (!datePart || !timePart) return null;

      const [day, month, year] = datePart.split('/').map(Number);
      let [hour, minute, second] = timePart.split(':').map(Number);

      if (ampm?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (ampm?.toUpperCase() === 'AM' && hour === 12) hour = 0;

      return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ` +
             `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(second).padStart(2,'0')}`;
    } catch (err) {
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
        RETURNING flow_id
      `;
      
      const result = await query(queryText, values);
      
      console.log(`[CICFlowMeter] Successfully inserted ${result.rows.length} flows`);
      
      // REAL-TIME PROCESSING: Trigger immediate ML processing for new flows
      if (result.rows.length > 0) {
        await this.triggerImmediateProcessing(result.rows.map(row => row.flow_id));
      }
      
    } catch (error) {
      console.error('[CICFlowMeter] Error processing batch:', error);
      
      // Try individual inserts as fallback
      console.log('[CICFlowMeter] Attempting individual inserts...');
      let successCount = 0;
      const insertedFlowIds = [];
      
      for (const flow of flows) {
        try {
          const flowId = await this.insertSingleFlow(flow);
          if (flowId) {
            successCount++;
            insertedFlowIds.push(flowId);
          }
        } catch (individualError) {
          console.error('[CICFlowMeter] Error inserting flow:', individualError.message);
        }
      }
      
      console.log(`[CICFlowMeter] Individual inserts: ${successCount}/${flows.length} successful`);
      
      // Trigger immediate processing for successfully inserted flows
      if (insertedFlowIds.length > 0) {
        await this.triggerImmediateProcessing(insertedFlowIds);
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
      RETURNING flow_id
    `;
    
    const result = await query(queryText, values);
    return result.rows.length > 0 ? result.rows[0].flow_id : null;
  }

  /**
   * Trigger immediate ML processing for new flows
   */
  async triggerImmediateProcessing(flowIds) {
    try {
      console.log(`[CICFlowMeter] Triggering immediate ML processing for ${flowIds.length} flows`);
      
      // Import PipelineProcessor dynamically to avoid circular dependency
      const { PipelineProcessor } = await import('./pipelineProcessor.js');
      
      // Get the pipeline processor instance from service orchestrator
      // This is a bit of a hack, but we need to access the running instance
      const processor = global.pipelineProcessor;
      
      if (processor && processor.processFlowImmediately) {
        // Process each flow immediately
        for (const flowId of flowIds) {
          try {
            await processor.processFlowImmediately(flowId);
          } catch (error) {
            console.error(`[CICFlowMeter] Error processing flow ${flowId} immediately:`, error);
          }
        }
      } else {
        console.warn('[CICFlowMeter] Pipeline processor not available for immediate processing');
      }
      
    } catch (error) {
      console.error('[CICFlowMeter] Error triggering immediate processing:', error);
    }
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