// File: backend/services/performanceScheduler.js

import performanceService from './performanceService.js';
import cron from 'node-cron';

class PerformanceScheduler {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  // Start all scheduled tasks
  start() {
    if (this.isRunning) {
      console.log('Performance scheduler is already running');
      return;
    }

    console.log('Starting performance monitoring scheduler...');

    // Collect system metrics every 30 seconds
    const systemMetricsTask = cron.schedule('*/30 * * * * *', async () => {
      try {
        await performanceService.calculateAndStoreSystemMetrics();
        console.log(`[${new Date().toISOString()}] System metrics collected`);
      } catch (error) {
        console.error('Error collecting system metrics:', error.message);
      }
    }, { scheduled: false });

    // Collect ML performance every 1 minute
    const mlPerformanceTask = cron.schedule('0 * * * * *', async () => {
      try {
        await performanceService.calculateAndStoreMLPerformance();
        console.log(`[${new Date().toISOString()}] ML performance collected`);
      } catch (error) {
        console.error('Error collecting ML performance:', error.message);
      }
    }, { scheduled: false });

    // Collect database performance every 2 minutes
    const dbPerformanceTask = cron.schedule('0 */2 * * * *', async () => {
      try {
        await performanceService.calculateAndStoreDatabasePerformance();
        console.log(`[${new Date().toISOString()}] Database performance collected`);
      } catch (error) {
        console.error('Error collecting database performance:', error.message);
      }
    }, { scheduled: false });

    // Collect network statistics every 1 minute
    const networkStatsTask = cron.schedule('0 * * * * *', async () => {
      try {
        await performanceService.calculateAndStoreNetworkStats();
        console.log(`[${new Date().toISOString()}] Network statistics collected`);
      } catch (error) {
        console.error('Error collecting network statistics:', error.message);
      }
    }, { scheduled: false });

    // Collect system health every 5 minutes
    const systemHealthTask = cron.schedule('0 */5 * * * *', async () => {
      try {
        await performanceService.calculateAndStoreSystemHealth();
        console.log(`[${new Date().toISOString()}] System health collected`);
      } catch (error) {
        console.error('Error collecting system health:', error.message);
      }
    }, { scheduled: false });

    // Cleanup old data daily at midnight
    const cleanupTask = cron.schedule('0 0 * * *', async () => {
      try {
        const { pool } = await import('./database.js');
        const result = await pool.query('SELECT cleanup_old_performance_data($1)', [30]);
        const deletedCount = result.rows[0].cleanup_old_performance_data;
        console.log(`[${new Date().toISOString()}] Cleaned up ${deletedCount} old performance records`);
      } catch (error) {
        console.error('Error during cleanup:', error.message);
      }
    }, { scheduled: false });

    // Store task references
    this.tasks.set('systemMetrics', systemMetricsTask);
    this.tasks.set('mlPerformance', mlPerformanceTask);
    this.tasks.set('dbPerformance', dbPerformanceTask);
    this.tasks.set('networkStats', networkStatsTask);
    this.tasks.set('systemHealth', systemHealthTask);
    this.tasks.set('cleanup', cleanupTask);

    // Start all tasks
    this.tasks.forEach((task, name) => {
      task.start();
      console.log(`✓ Started ${name} collection task`);
    });

    this.isRunning = true;
    console.log('Performance monitoring scheduler started successfully');
  }

  // Stop all scheduled tasks
  stop() {
    if (!this.isRunning) {
      console.log('Performance scheduler is not running');
      return;
    }

    console.log('Stopping performance monitoring scheduler...');

    this.tasks.forEach((task, name) => {
      task.stop();
      console.log(`✓ Stopped ${name} collection task`);
    });

    this.isRunning = false;
    console.log('Performance monitoring scheduler stopped');
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.tasks.keys()),
      taskCount: this.tasks.size
    };
  }

  // Restart specific task
  restartTask(taskName) {
    const task = this.tasks.get(taskName);
    if (!task) {
      throw new Error(`Task '${taskName}' not found`);
    }

    task.stop();
    task.start();
    console.log(`Restarted task: ${taskName}`);
  }

  // Manual collection of all performance data
  async collectAllNow() {
    console.log('Manual performance data collection started...');
    
    try {
      const result = await performanceService.collectAllPerformanceData();
      console.log('Manual performance data collection completed:', result);
      return result;
    } catch (error) {
      console.error('Error in manual performance collection:', error);
      throw error;
    }
  }
}

// Create singleton instance
const scheduler = new PerformanceScheduler();

// Handle process termination
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping performance scheduler...');
  scheduler.stop();
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping performance scheduler...');
  scheduler.stop();
  process.exit(0);
});

export default scheduler;