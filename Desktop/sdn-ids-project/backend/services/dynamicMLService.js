// backend/services/dynamicMLService.js - Dynamic ML Service Manager
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DynamicMLService {
  constructor(options = {}) {
    this.mlProcess = null;
    this.isRunning = false;
    this.port = options.port || config.ml.service.port;
    this.host = options.host || config.ml.service.host;
    this.mlPath = path.join(__dirname, '../../ml');
    this.restartAttempts = 0;
    this.maxRestartAttempts = 5;
    this.restartDelay = 5000; // 5 seconds
    this.uploadTimeout = config.ml.service.uploadTimeout;
    this.defaultModel = config.ml.service.defaultModel;
    this.fallbackToDefault = false;
  }

  /**
   * Start the dynamic ML service
   */
  async start() {
    console.log('[DynamicMLService] Starting dynamic ML service...');
    console.log(`[DynamicMLService] ML Path: ${this.mlPath}`);
    console.log(`[DynamicMLService] Port: ${this.port}`);
    
    try {
      // Validate Python availability first
      console.log('[DynamicMLService] Checking Python availability...');
      const pythonCmd = 'python3'; // Define at function level
      
      try {
        const { execSync } = await import('child_process');
        console.log(`[DynamicMLService] Testing Python command: ${pythonCmd}`);
        const result = execSync(`${pythonCmd} --version`, { stdio: 'pipe' });
        const output = result.toString().trim();
        console.log(`[DynamicMLService] ✓ Python found: ${output}`);
      } catch (pythonError) {
        console.error(`[DynamicMLService] ✗ Python check failed: ${pythonError.message}`);
        throw new Error(`Python validation failed: ${pythonError.message}`);
      }

      // Start Python ML server
      console.log(`[DynamicMLService] Starting Python ML server: ${pythonCmd} ml_server.py`);
      console.log(`[DynamicMLService] Working directory: ${this.mlPath}`);
      
      this.mlProcess = spawn(pythonCmd, ['ml_server.py'], {
        cwd: this.mlPath,
        env: {
          ...process.env,
          DB_HOST: process.env.DB_HOST || 'localhost',
          DB_PORT: process.env.DB_PORT || '5432',
          DB_NAME: process.env.DB_NAME || 'sdn_ids',
          DB_USER: process.env.DB_USER || 'sdn_user', 
          DB_PASSWORD: process.env.DB_PASSWORD || 'sdn_password',
          PORT: this.port.toString(),
          HOST: this.host,
          PYTHONUNBUFFERED: '1'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Handle stdout
      this.mlProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.log(`[ML-Service] ${output}`);
        }
      });

      // Handle stderr
      this.mlProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        if (output) {
          console.error(`[ML-Service-Error] ${output}`);
        }
      });

      // Handle process close
      this.mlProcess.on('close', (code) => {
        console.log(`[DynamicMLService] ML process exited with code ${code}`);
        this.isRunning = false;
        
        // Auto-restart if not manually stopped
        if (this.restartAttempts < this.maxRestartAttempts) {
          this.restartAttempts++;
          console.log(`[DynamicMLService] Restarting ML service (attempt ${this.restartAttempts}/${this.maxRestartAttempts})`);
          setTimeout(() => this.start(), this.restartDelay);
        } else {
          console.error('[DynamicMLService] Max restart attempts reached. Manual intervention required.');
        }
      });

      // Handle process error
      this.mlProcess.on('error', (error) => {
        console.error('[DynamicMLService] Failed to start ML process:', error);
        this.isRunning = false;
      });

      // Wait for service to be ready
      await this.waitForService();
      
      this.isRunning = true;
      this.restartAttempts = 0;
      console.log('[DynamicMLService] Dynamic ML service started successfully');
      
    } catch (error) {
      console.error('[DynamicMLService] Failed to start:', error);
      throw error;
    }
  }

  /**
   * Stop the dynamic ML service
   */
  async stop() {
    console.log('[DynamicMLService] Stopping dynamic ML service...');
    
    this.isRunning = false;
    
    if (this.mlProcess) {
      // Try graceful shutdown first
      this.mlProcess.kill('SIGTERM');
      
      // Force kill if not stopped within 10 seconds
      const forceKillTimeout = setTimeout(() => {
        if (this.mlProcess && !this.mlProcess.killed) {
          console.log('[DynamicMLService] Force killing ML process');
          this.mlProcess.kill('SIGKILL');
        }
      }, 10000);
      
      // Wait for process to exit
      await new Promise((resolve) => {
        if (!this.mlProcess) {
          clearTimeout(forceKillTimeout);
          resolve();
          return;
        }
        
        this.mlProcess.once('close', () => {
          clearTimeout(forceKillTimeout);
          resolve();
        });
      });
      
      this.mlProcess = null;
    }
    
    console.log('[DynamicMLService] Dynamic ML service stopped');
  }

  /**
   * Wait for ML service to be ready with fallback to default model
   */
  async waitForService(timeout = 120000) { // Tăng timeout lên 2 phút
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds
    const uploadTimeout = this.uploadTimeout; // Timeout cho việc chờ model upload
    
    console.log('[DynamicMLService] Waiting for ML service to be ready...');
    console.log(`[DynamicMLService] Upload timeout: ${uploadTimeout}ms`);
    console.log(`[DynamicMLService] Default model: ${this.defaultModel.name}`);
    
    while (Date.now() - startTime < timeout) {
      try {
        const response = await axios.get(`http://${this.host}:${this.port}/health`, {
          timeout: 10000
        });
        
        if (response.status === 200) {
          const { status, model_loaded, model_loading, model_id } = response.data;
          
          if (status === 'healthy' && model_loaded) {
            console.log('[DynamicMLService] ML service is ready');
            console.log(`[DynamicMLService] Model loaded: Yes`);
            console.log(`[DynamicMLService] Model ID: ${model_id || 'N/A'}`);
            
            // Kiểm tra nếu model đang load từ database (có model_id nhưng chưa sẵn sàng)
            // và đã vượt quá upload timeout
            if (Date.now() - startTime > uploadTimeout && !this.fallbackToDefault) {
              // Nếu model_id bắt đầu bằng UUID (model từ database) và đã timeout
              if (model_id && model_id.length > 20 && !model_id.startsWith('default_')) {
                console.log(`[DynamicMLService] Database model (${model_id}) loading timeout (${uploadTimeout}ms), falling back to default model...`);
                await this.fallbackToDefaultModel();
                this.fallbackToDefault = true;
                continue; // Tiếp tục vòng lặp để kiểm tra lại
              }
            }
            
            return;
          } else if (status === 'loading' || model_loading) {
            console.log('[DynamicMLService] Model is still loading...');
            
            // Kiểm tra nếu đã vượt quá upload timeout và chưa có fallback
            if (Date.now() - startTime > uploadTimeout && !this.fallbackToDefault) {
              console.log(`[DynamicMLService] Upload timeout (${uploadTimeout}ms) reached, falling back to default model...`);
              await this.fallbackToDefaultModel();
              this.fallbackToDefault = true;
            }
          } else {
            console.log(`[DynamicMLService] Service responding but not ready: ${status}`);
            if (response.data.error) {
              console.log(`[DynamicMLService] Error: ${response.data.error}`);
            }
            
            // Nếu service không healthy và đã timeout, thử fallback
            if (Date.now() - startTime > uploadTimeout && !this.fallbackToDefault) {
              console.log(`[DynamicMLService] Service unhealthy after timeout (${uploadTimeout}ms), falling back to default model...`);
              await this.fallbackToDefaultModel();
              this.fallbackToDefault = true;
            }
          }
        }
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log('[DynamicMLService] Service not yet listening...');
        } else if (error.code === 'ECONNRESET') {
          console.log('[DynamicMLService] Connection reset, service may be starting...');
        } else {
          console.log(`[DynamicMLService] Health check error: ${error.message}`);
        }
      }
      
      // Log thời gian đã chờ
      const elapsed = Date.now() - startTime;
      if (elapsed % 10000 === 0) { // Log mỗi 10 giây
        console.log(`[DynamicMLService] Still waiting... (${elapsed}ms elapsed, timeout: ${uploadTimeout}ms)`);
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // Nếu vẫn không có model sau timeout, thử fallback lần cuối
    if (!this.fallbackToDefault) {
      console.log('[DynamicMLService] Final timeout reached, attempting fallback to default model...');
      try {
        await this.fallbackToDefaultModel();
        return; // Thử lại health check
      } catch (fallbackError) {
        console.error('[DynamicMLService] Fallback to default model failed:', fallbackError);
      }
    }
    
    throw new Error(`ML service failed to start within ${timeout}ms`);
  }

  /**
   * Fallback to default model
   */
  async fallbackToDefaultModel() {
    try {
      console.log(`[DynamicMLService] Loading default model: ${this.defaultModel.name}`);
      
      // Gọi endpoint để load default model
      const response = await axios.post(`http://${this.host}:${this.port}/load-default-model`, {
        modelName: this.defaultModel.name,
        modelFile: this.defaultModel.modelFile,
        scalerFile: this.defaultModel.scalerFile,
        encoderFile: this.defaultModel.encoderFile
      }, {
        timeout: 30000 // 30 seconds for model loading
      });
      
      if (response.status === 200) {
        console.log('[DynamicMLService] Default model loaded successfully');
        return response.data;
      } else {
        throw new Error(`Failed to load default model: ${response.status}`);
      }
    } catch (error) {
      console.error('[DynamicMLService] Error loading default model:', error);
      throw error;
    }
  }

  /**
   * Check if service is running
   */
  isServiceRunning() {
    return this.isRunning && this.mlProcess && !this.mlProcess.killed;
  }

  /**
   * Get service status
   */
  async getStatus() {
    try {
      if (!this.isServiceRunning()) {
        return { 
          status: 'stopped',
          running: false
        };
      }
      
      const response = await axios.get(`http://${this.host}:${this.port}/health`, {
        timeout: 5000
      });
      
      return {
        status: 'running',
        running: true,
        ...response.data
      };
    } catch (error) {
      return {
        status: 'error',
        running: false,
        error: error.message
      };
    }
  }

  /**
   * Reload the ML model
   */
  async reloadModel() {
    try {
      if (!this.isServiceRunning()) {
        throw new Error('ML service is not running');
      }
      
      const response = await axios.post(`http://${this.host}:${this.port}/reload-model`, {}, {
        timeout: 30000 // 30 seconds for model loading
      });
      
      return response.data;
    } catch (error) {
      console.error('[DynamicMLService] Error reloading model:', error);
      throw error;
    }
  }

  /**
   * Test prediction
   */
  async testPrediction(features) {
    try {
      if (!this.isServiceRunning()) {
        throw new Error('ML service is not running');
      }
      
      const response = await axios.post(`http://${this.host}:${this.port}/predict`, 
        { features },
        { timeout: 10000 }
      );
      
      return response.data;
    } catch (error) {
      console.error('[DynamicMLService] Test prediction failed:', error);
      throw error;
    }
  }

  async testPythonDirectly() {
    try {
      console.log('[DynamicMLService] Testing Python directly...');
      const testCommands = ['python3', '/usr/bin/python3', '/bin/python3'];
      
      for (const cmd of testCommands) {
        try {
          const { execSync } = await import('child_process');
          const result = execSync(`${cmd} --version`, { 
            stdio: 'pipe',
            timeout: 5000 
          });
          const output = result.toString().trim();
          
          if (output.includes('Python')) {
            console.log(`[DynamicMLService] ✓ Working Python command: ${cmd}`);
            console.log(`[DynamicMLService] ✓ Version: ${output}`);
            return cmd;
          }
        } catch (e) {
          console.log(`[DynamicMLService] ✗ ${cmd} failed: ${e.message}`);
        }
      }
      
      throw new Error('Python not available');
    } catch (error) {
      console.error('[DynamicMLService] Python test failed:', error.message);
      throw error;
    }
  }
}

export default DynamicMLService;