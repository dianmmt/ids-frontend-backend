// backend/services/cicflowmeterCollector.js - CICFlowMeter Data Collector
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import net from 'net';
import { query } from './database.js';
import CICFlowMeterFeatureMapper from './cicflowmeterFeatureMapper.js';

export class CICFlowMeterCollector {
  constructor(options = {}) {
    this.csvPath = options.csvPath || process.env.CICFLOWMETER_CSV_PATH;
    this.csvDirectory = options.csvDirectory || process.env.CICFLOWMETER_CSV_DIRECTORY;
    this.csvPattern = options.csvPattern || process.env.CICFLOWMETER_CSV_PATTERN || '*_Flow.csv';
    this.socketPort = options.socketPort || parseInt(process.env.CICFLOWMETER_SOCKET_PORT) || 9999;
    this.socketHost = options.socketHost || process.env.CICFLOWMETER_SOCKET_HOST || 'localhost';
    this.batchSize = options.batchSize || parseInt(process.env.CICFLOWMETER_BATCH_SIZE) || 100;
    this.pollInterval = options.pollInterval || parseInt(process.env.CICFLOWMETER_POLL_INTERVAL) || 5000;
    
    // Initialize feature mapper
    this.featureMapper = new CICFlowMeterFeatureMapper();
    
    this.isRunning = false;
    this.socketServer = null;
    this.csvWatcher = null;
    this.directoryWatcher = null;
    this.buffer = [];
    this.lastProcessedLine = 0;
    this.activeFiles = new Map(); // Track active files and their last processed line
    this.fileWatchers = new Map(); // Track individual file watchers
  }

  /**
   * Start the collector service
   */
  async start() {
    console.log('[CICFlowMeter] Starting collector service...');
    
    try {
      // Start socket server for real-time data
      await this.startSocketServer();
      
      // Start CSV monitoring (file or directory)
      if (this.csvDirectory) {
        await this.startDirectoryMonitoring();
      } else if (this.csvPath) {
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
    
    if (this.directoryWatcher) {
      this.directoryWatcher.close();
      this.directoryWatcher = null;
    }
    
    // Close all file watchers
    for (const [filePath, watcher] of this.fileWatchers) {
      watcher.close();
    }
    this.fileWatchers.clear();
    this.activeFiles.clear();
    
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
   * Start directory monitoring for timestamp-based CSV files
   */
  async startDirectoryMonitoring() {
    if (!fs.existsSync(this.csvDirectory)) {
      console.warn(`[CICFlowMeter] CSV directory not found: ${this.csvDirectory}`);
      return;
    }
    
    console.log(`[CICFlowMeter] Monitoring directory: ${this.csvDirectory} for pattern: ${this.csvPattern}`);
    
    // Process existing files matching the pattern
    await this.processExistingFiles();
    
    // Watch directory for new files
    this.directoryWatcher = fs.watch(this.csvDirectory, async (eventType, filename) => {
      if (eventType === 'rename' && filename && this.matchesPattern(filename)) {
        console.log(`[CICFlowMeter] New file detected: ${filename}`);
        await this.addFileToMonitoring(path.join(this.csvDirectory, filename));
      }
    });
    
    // Periodic check for new files (fallback)
    setInterval(async () => {
      await this.checkForNewFiles();
    }, this.pollInterval);
  }

  /**
   * Check if filename matches the pattern
   */
  matchesPattern(filename) {
    const pattern = this.csvPattern.replace('*', '.*');
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(filename);
  }

  /**
   * Process existing files in the directory
   */
  async processExistingFiles() {
    try {
      const files = fs.readdirSync(this.csvDirectory);
      const matchingFiles = files
        .filter(file => this.matchesPattern(file))
        .map(file => ({
          name: file,
          path: path.join(this.csvDirectory, file),
          stats: fs.statSync(path.join(this.csvDirectory, file))
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Sort by modification time, newest first
      
      console.log(`[CICFlowMeter] Found ${matchingFiles.length} existing files matching pattern`);
      
      // Monitor the most recent file and any files that might still be growing
      for (const file of matchingFiles) {
        const ageMinutes = (Date.now() - file.stats.mtime.getTime()) / (1000 * 60);
        if (ageMinutes < 5) { // Files modified in last 5 minutes
          await this.addFileToMonitoring(file.path);
        }
      }
    } catch (error) {
      console.error('[CICFlowMeter] Error processing existing files:', error);
    }
  }

  /**
   * Check for new files periodically
   */
  async checkForNewFiles() {
    try {
      const files = fs.readdirSync(this.csvDirectory);
      const matchingFiles = files.filter(file => this.matchesPattern(file));
      
      for (const filename of matchingFiles) {
        const filePath = path.join(this.csvDirectory, filename);
        if (!this.activeFiles.has(filePath)) {
          console.log(`[CICFlowMeter] New file detected during periodic check: ${filename}`);
          await this.addFileToMonitoring(filePath);
        }
      }
    } catch (error) {
      console.error('[CICFlowMeter] Error checking for new files:', error);
    }
  }

  /**
   * Add a file to monitoring
   */
  async addFileToMonitoring(filePath) {
    if (this.activeFiles.has(filePath)) {
      return; // Already monitoring this file
    }
    
    try {
      console.log(`[CICFlowMeter] Adding file to monitoring: ${filePath}`);
      
      // Initialize tracking for this file
      this.activeFiles.set(filePath, {
        lastProcessedLine: 0,
        lastSize: 0
      });
      
      // Watch for changes to this file
      const watcher = fs.watch(filePath, async (eventType) => {
        if (eventType === 'change') {
          await this.processFileChanges(filePath);
        }
      });
      
      this.fileWatchers.set(filePath, watcher);
      
      // Initial processing
      await this.processFileChanges(filePath);
      
    } catch (error) {
      console.error(`[CICFlowMeter] Error adding file to monitoring: ${filePath}`, error);
    }
  }

  /**
   * Process changes to a specific file
   */
  async processFileChanges(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`[CICFlowMeter] File no longer exists: ${filePath}`);
        this.removeFileFromMonitoring(filePath);
        return;
      }
      
      const fileInfo = this.activeFiles.get(filePath);
      if (!fileInfo) {
        return;
      }
      
      const stats = fs.statSync(filePath);
      const currentSize = stats.size;
      
      // Only process if file has grown
      if (currentSize <= fileInfo.lastSize) {
        return;
      }
      
      const lines = fs.readFileSync(filePath, 'utf8').split('\n');
      const newLines = lines.slice(fileInfo.lastProcessedLine);
      
      for (const line of newLines) {
        if (line.trim()) {
          try {
            const flowData = this.parseCSVLine(line);
            if (flowData) {
              this.buffer.push(flowData);
            }
          } catch (error) {
            console.error(`[CICFlowMeter] Error parsing line from ${filePath}:`, error);
          }
        }
      }
      
      // Update tracking info
      fileInfo.lastProcessedLine = lines.length;
      fileInfo.lastSize = currentSize;
      
      // Process batch if buffer is full
      if (this.buffer.length >= this.batchSize) {
        await this.processBatch(this.buffer.splice(0, this.batchSize));
      }
      
    } catch (error) {
      console.error(`[CICFlowMeter] Error processing file changes: ${filePath}`, error);
    }
  }

  /**
   * Remove file from monitoring
   */
  removeFileFromMonitoring(filePath) {
    if (this.fileWatchers.has(filePath)) {
      this.fileWatchers.get(filePath).close();
      this.fileWatchers.delete(filePath);
    }
    this.activeFiles.delete(filePath);
    console.log(`[CICFlowMeter] Removed file from monitoring: ${filePath}`);
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
   * Parse a CSV line into flow data using proper feature mapping
   */
  parseCSVLine(line) {
    const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
    
    if (values.length < 10) {
      return null; // Skip incomplete lines
    }
    
    try {
      // Create CSV row object using CICFlowMeter headers
      const csvRow = this.createCSVRowObject(values);
      
      // Use feature mapper to convert CSV data to database format
      const mappedData = this.featureMapper.mapCsvToDatabase(csvRow);
      
      // Add required fields not in CICFlowMeter CSV
      mappedData.flow_id = this.generateFlowId(mappedData.src_ip, mappedData.dst_ip, mappedData.src_port, mappedData.dst_port);
      mappedData.packet_count = (mappedData.total_fwd_packets || 0) + (mappedData.total_backward_packets || 0);
      mappedData.byte_count = (mappedData.total_length_of_fwd_packets || 0) + (mappedData.total_length_of_bwd_packets || 0);
      mappedData.flow_start_time = new Date().toISOString();
      mappedData.captured_at = new Date().toISOString();
      
      return mappedData;
    } catch (error) {
      console.error('[CICFlowMeter] Error parsing flow data:', error);
      return null;
    }
  }

  /**
   * Create CSV row object from values array using CICFlowMeter headers
   */
  createCSVRowObject(values) {
    const headers = [
      'Protocol', 'Flow Duration', 'Tot Fwd Pkts', 'Tot Bwd Pkts', 'TotLen Fwd Pkts', 'TotLen Bwd Pkts',
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
      'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min'
    ];

    const csvRow = {};
    headers.forEach((header, index) => {
      csvRow[header] = values[index] || '';
    });

    return csvRow;
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


