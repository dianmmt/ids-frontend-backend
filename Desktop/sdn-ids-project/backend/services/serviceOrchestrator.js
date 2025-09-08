// backend/services/serviceOrchestrator.js - Service Orchestrator
import CICFlowMeterCollector from './cicflowmeterCollector.js';
import PipelineProcessor from './pipelineProcessor.js';
import IPAnalyzer from './ipAnalyzer.js';
import { initializeDatabase } from './database.js';

export class ServiceOrchestrator {
  constructor(options = {}) {
    this.services = {};
    this.isRunning = false;
    this.startupDelay = options.startupDelay || 5000; // 5 seconds delay between services
  }

  /**
   * Start all services
   */
  async start() {
    console.log('[ServiceOrchestrator] Starting all services...');
    
    try {
      // Initialize database first
      console.log('[ServiceOrchestrator] Initializing database...');
      await initializeDatabase();
      
      // Start services with delays
      console.log('[ServiceOrchestrator] Starting CICFlowMeter collector...');
      this.services.collector = new CICFlowMeterCollector();
      await this.services.collector.start();
      
      await this.delay(this.startupDelay);
      
      console.log('[ServiceOrchestrator] Starting pipeline processor...');
      this.services.processor = new PipelineProcessor();
      await this.services.processor.start();
      
      await this.delay(this.startupDelay);
      
      console.log('[ServiceOrchestrator] Starting IP analyzer...');
      this.services.analyzer = new IPAnalyzer();
      await this.services.analyzer.start();
      
      this.isRunning = true;
      console.log('[ServiceOrchestrator] All services started successfully');
      
      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      console.error('[ServiceOrchestrator] Failed to start services:', error);
      await this.stop();
      throw error;
    }
  }

  /**
   * Stop all services
   */
  async stop() {
    console.log('[ServiceOrchestrator] Stopping all services...');
    
    this.isRunning = false;
    
    // Stop services in reverse order
    if (this.services.analyzer) {
      try {
        await this.services.analyzer.stop();
        console.log('[ServiceOrchestrator] IP analyzer stopped');
      } catch (error) {
        console.error('[ServiceOrchestrator] Error stopping IP analyzer:', error);
      }
    }
    
    if (this.services.processor) {
      try {
        await this.services.processor.stop();
        console.log('[ServiceOrchestrator] Pipeline processor stopped');
      } catch (error) {
        console.error('[ServiceOrchestrator] Error stopping pipeline processor:', error);
      }
    }
    
    if (this.services.collector) {
      try {
        await this.services.collector.stop();
        console.log('[ServiceOrchestrator] CICFlowMeter collector stopped');
      } catch (error) {
        console.error('[ServiceOrchestrator] Error stopping collector:', error);
      }
    }
    
    console.log('[ServiceOrchestrator] All services stopped');
  }

  /**
   * Get status of all services
   */
  getStatus() {
    const status = {
      isRunning: this.isRunning,
      services: {}
    };
    
    if (this.services.collector) {
      status.services.collector = {
        name: 'CICFlowMeter Collector',
        running: this.services.collector.isRunning
      };
    }
    
    if (this.services.processor) {
      status.services.processor = {
        name: 'Pipeline Processor',
        running: this.services.processor.isRunning,
        stats: this.services.processor.getStats()
      };
    }
    
    if (this.services.analyzer) {
      status.services.analyzer = {
        name: 'IP Analyzer',
        running: this.services.analyzer.isRunning,
        stats: this.services.analyzer.getStats()
      };
    }
    
    return status;
  }

  /**
   * Get comprehensive statistics
   */
  async getComprehensiveStats() {
    const stats = {
      timestamp: new Date().toISOString(),
      services: this.getStatus(),
      collector: null,
      processor: null,
      analyzer: null
    };
    
    try {
      if (this.services.collector) {
        stats.collector = await this.services.collector.getStats();
      }
    } catch (error) {
      console.error('[ServiceOrchestrator] Error getting collector stats:', error);
    }
    
    try {
      if (this.services.processor) {
        stats.processor = this.services.processor.getStats();
        stats.processor.recentAttacks = await this.services.processor.getRecentAttacks(10);
        stats.processor.attackStatsByIP = await this.services.processor.getAttackStatsByIP(24);
      }
    } catch (error) {
      console.error('[ServiceOrchestrator] Error getting processor stats:', error);
    }
    
    try {
      if (this.services.analyzer) {
        stats.analyzer = await this.services.analyzer.getIPStats();
        stats.analyzer.blockedIPs = await this.services.analyzer.getBlockedIPs(true);
        stats.analyzer.topAttackingIPs = await this.services.analyzer.getTopAttackingIPs(10, 24);
      }
    } catch (error) {
      console.error('[ServiceOrchestrator] Error getting analyzer stats:', error);
    }
    
    return stats;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const status = this.getStatus();
        const healthyServices = Object.values(status.services).filter(s => s.running).length;
        const totalServices = Object.keys(status.services).length;
        
        if (healthyServices < totalServices) {
          console.warn(`[ServiceOrchestrator] Health check: ${healthyServices}/${totalServices} services running`);
        }
        
        // Log periodic stats
        if (Date.now() % 300000 < 60000) { // Every 5 minutes
          const stats = await this.getComprehensiveStats();
          console.log('[ServiceOrchestrator] Periodic stats:', {
            collector: stats.collector?.total_flows || 0,
            processor: stats.processor?.totalProcessed || 0,
            analyzer: stats.analyzer?.totalBlocked || 0
          });
        }
        
      } catch (error) {
        console.error('[ServiceOrchestrator] Health monitoring error:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Utility function for delays
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Restart a specific service
   */
  async restartService(serviceName) {
    console.log(`[ServiceOrchestrator] Restarting service: ${serviceName}`);
    
    try {
      // Stop the service
      if (this.services[serviceName]) {
        await this.services[serviceName].stop();
        delete this.services[serviceName];
      }
      
      // Start the service
      switch (serviceName) {
        case 'collector':
          this.services.collector = new CICFlowMeterCollector();
          await this.services.collector.start();
          break;
        case 'processor':
          this.services.processor = new PipelineProcessor();
          await this.services.processor.start();
          break;
        case 'analyzer':
          this.services.analyzer = new IPAnalyzer();
          await this.services.analyzer.start();
          break;
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
      
      console.log(`[ServiceOrchestrator] Service ${serviceName} restarted successfully`);
      
    } catch (error) {
      console.error(`[ServiceOrchestrator] Error restarting service ${serviceName}:`, error);
      throw error;
    }
  }

  /**
   * Manual trigger for processing
   */
  async triggerProcessing() {
    console.log('[ServiceOrchestrator] Manual processing trigger');
    
    try {
      if (this.services.processor) {
        await this.services.processor.processNow();
      }
      
      if (this.services.analyzer) {
        await this.services.analyzer.analyzeNow();
      }
      
      console.log('[ServiceOrchestrator] Manual processing completed');
      
    } catch (error) {
      console.error('[ServiceOrchestrator] Error in manual processing:', error);
      throw error;
    }
  }
}

export default ServiceOrchestrator;


