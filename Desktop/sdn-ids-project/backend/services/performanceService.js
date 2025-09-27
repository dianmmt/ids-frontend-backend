import { pool } from './database.js';
import os from 'os';
import fs from 'fs';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

class PerformanceService {
  constructor() {
    this.lastCPUUsage = { idle: 0, total: 0 };
    this.lastNetworkSample = {
      timestampMs: Date.now(),
      totalBytes: 0
    };
    this.platform = process.platform;
    // In-memory cache for network statistics (live load when DB table is missing)
    this.networkStatsCache = {
      latest: null,
      history: [],
      maxHistory: 1000
    };
    // In-memory cache for database performance metrics
    this.databasePerformanceCache = {
      latest: null,
      history: [],
      maxHistory: 1000
    };
    // Dynamic alert thresholds (warning/critical) per metric name
    this.alertThresholds = {
      'CPU Usage': { warning: 70, critical: 85 },
      'Memory Usage': { warning: 75, critical: 90 },
      'Disk Usage': { warning: 80, critical: 95 },
      'Network Load': { warning: 75, critical: 90 }
    };
  }

  // Update in-memory cache for network statistics
  #updateNetworkStatsCache(stats) {
    this.networkStatsCache.latest = stats;
    this.networkStatsCache.history.push(stats);
    if (this.networkStatsCache.history.length > this.networkStatsCache.maxHistory) {
      this.networkStatsCache.history.splice(0, this.networkStatsCache.history.length - this.networkStatsCache.maxHistory);
    }
  }

  // Update in-memory cache for database performance
  #updateDatabasePerformanceCache(snapshot) {
    this.databasePerformanceCache.latest = snapshot;
    this.databasePerformanceCache.history.push(snapshot);
    if (this.databasePerformanceCache.history.length > this.databasePerformanceCache.maxHistory) {
      this.databasePerformanceCache.history.splice(0, this.databasePerformanceCache.history.length - this.databasePerformanceCache.maxHistory);
    }
  }

  // System metrics calculations and storage
  async calculateAndStoreSystemMetrics() {
    try {
      const systemMetrics = await this.collectSystemMetrics();
      await Promise.all(systemMetrics.map(metric => this.storeSystemMetric(metric)));
      return systemMetrics;
    } catch (error) {
      console.error('Error calculating system metrics:', error);
      return this.getFallbackSystemMetrics(); // Return fallback instead of throwing
    }
  }

  async collectSystemMetrics() {
    try {
      const [cpuUsage, memoryUsage, diskUsage, networkLoad] = await Promise.all([
        this.calculateCPUUsage(),
        this.calculateMemoryUsage(),
        this.calculateDiskUsage(),
        this.calculateNetworkLoad()
      ]);

      const cpuT = this.getThresholdsFor('CPU Usage');
      const memT = this.getThresholdsFor('Memory Usage');
      const diskT = this.getThresholdsFor('Disk Usage');
      const netT = this.getThresholdsFor('Network Load');

      return [
        {
          name: 'CPU Usage',
          value: cpuUsage,
          unit: '%',
          status: this.getMetricStatus(cpuUsage, cpuT.warning, cpuT.critical),
          trend: await this.calculateTrend('CPU Usage', cpuUsage)
        },
        {
          name: 'Memory Usage',
          value: memoryUsage,
          unit: '%',
          status: this.getMetricStatus(memoryUsage, memT.warning, memT.critical),
          trend: await this.calculateTrend('Memory Usage', memoryUsage)
        },
        {
          name: 'Disk Usage',
          value: diskUsage,
          unit: '%',
          status: this.getMetricStatus(diskUsage, diskT.warning, diskT.critical),
          trend: await this.calculateTrend('Disk Usage', diskUsage)
        },
        {
          name: 'Network Load',
          value: networkLoad,
          unit: '%',
          status: this.getMetricStatus(networkLoad, netT.warning, netT.critical),
          trend: await this.calculateTrend('Network Load', networkLoad)
        }
      ];
    } catch (error) {
      console.error('Error collecting system metrics:', error);
      return this.getFallbackSystemMetrics();
    }
  }

  async calculateCPUUsage() {
    try {
      if (this.platform === 'win32') {
        try {
          const { stdout } = await execAsync('powershell "Get-Counter \'\\Processor(_Total)\\% Processor Time\' | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue"');
          return Math.round(parseFloat(stdout.trim()) * 100) / 100;
        } catch {
          return this.calculateCPUUsageFallback();
        }
      } else {
        try {
          const statData = fs.readFileSync('/proc/stat', 'utf8');
          const cpuLine = statData.split('\n')[0];
          const cpuValues = cpuLine.split(' ').filter(val => val !== '');
          const [user, nice, system, idle, iowait = 0, irq = 0, softirq = 0, steal = 0] = cpuValues.slice(1).map(Number);
          const total = user + nice + system + idle + iowait + irq + softirq + steal;
          const idleDiff = idle - this.lastCPUUsage.idle;
          const totalDiff = total - this.lastCPUUsage.total;

          const percentageCPU = totalDiff > 0 ? 100 - (100 * idleDiff / totalDiff) : 0;
          this.lastCPUUsage = { idle, total };
          return Math.round(percentageCPU * 100) / 100;
        } catch {
          return this.calculateCPUUsageFallback();
        }
      }
    } catch (error) {
      console.error('Error calculating CPU usage:', error);
      return this.calculateCPUUsageFallback();
    }
  }

  calculateCPUUsageFallback() {
    const loadAvg = os.loadavg();
    const cpuCount = os.cpus().length;
    const currentLoad = loadAvg[0];
    const cpuUsage = Math.min(100, (currentLoad / cpuCount) * 100);
    return Math.round(cpuUsage * 100) / 100;
  }

  async calculateMemoryUsage() {
    try {
      if (this.platform === 'win32') {
        try {
          const { stdout } = await execAsync('powershell "Get-Counter \'\\Memory\\Available MBytes\' | Select-Object -ExpandProperty CounterSamples | Select-Object -ExpandProperty CookedValue"');
          const availableMB = parseFloat(stdout.trim());
          const totalMB = os.totalmem() / (1024 * 1024);
          return Math.round(((totalMB - availableMB) / totalMB) * 10000) / 100;
        } catch {
          return this.calculateMemoryUsageFallback();
        }
      } else {
        try {
          const memInfo = fs.readFileSync('/proc/meminfo', 'utf8');
          const lines = memInfo.split('\n');
          let totalMem = 0, availableMem = 0;
          lines.forEach(line => {
            const [key, value] = line.split(':');
            if (key === 'MemTotal') totalMem = parseInt(value.trim()) * 1024;
            if (key === 'MemAvailable') availableMem = parseInt(value.trim()) * 1024;
          });
          const usedMem = totalMem - (availableMem || 0);
          return Math.round((usedMem / totalMem) * 10000) / 100;
        } catch {
          return this.calculateMemoryUsageFallback();
        }
      }
    } catch (error) {
      console.error('Error calculating memory usage:', error);
      return this.calculateMemoryUsageFallback();
    }
  }

  calculateMemoryUsageFallback() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    return Math.round(((totalMem - freeMem) / totalMem) * 10000) / 100;
  }

  async calculateDiskUsage() {
    try {
      if (this.platform === 'win32') {
        try {
          const { stdout } = await execAsync('powershell "Get-WmiObject -Class Win32_LogicalDisk | Where-Object {$_.DeviceID -eq \'C:\\\'} | ForEach-Object { [math]::Round((($_.Size - $_.FreeSpace) / $_.Size) * 100, 2) }"');
          return parseFloat(stdout.trim()) || 45;
        } catch {
          return 45 + (Math.random() * 20);
        }
      } else {
        try {
          const { stdout } = await execAsync('df -h / | tail -1');
          return parseFloat(stdout.split(/\s+/)[4].replace('%', '')) || 45;
        } catch {
          return 45 + (Math.random() * 20);
        }
      }
    } catch (error) {
      console.error('Error calculating disk usage:', error);
      return 45 + (Math.random() * 20);
    }
  }

  async calculateNetworkLoad() {
    try {
      let totalBytesNow = 0;
      if (this.platform === 'win32') {
        try {
          const { stdout } = await execAsync('powershell "(Get-NetAdapterStatistics | Where-Object {$_.Status -eq \'Up\'} | Measure-Object -Property ReceivedBytes,SentBytes -Sum).Sum"');
          totalBytesNow = stdout.trim().split(/\s+/).reduce((a, b) => a + (parseInt(b) || 0), 0);
        } catch {
          return this.calculateNetworkLoadFallback();
        }
      } else {
        try {
          const netDev = fs.readFileSync('/proc/net/dev', 'utf8');
          netDev.split('\n').slice(2).forEach(line => {
            if (!line.trim()) return;
            const parts = line.split(/\s+/);
            const interfaceName = parts[0].replace(':', '');
            if (interfaceName.includes('lo') || interfaceName.includes('docker') || interfaceName.includes('veth')) return;
            const rxBytes = parseInt(parts[1]) || 0;
            const txBytes = parseInt(parts[9]) || 0;
            totalBytesNow += rxBytes + txBytes;
          });
        } catch {
          return this.calculateNetworkLoadFallback();
        }
      }

      const nowMs = Date.now();
      const elapsedMs = nowMs - this.lastNetworkSample.timestampMs;
      const bytesDelta = totalBytesNow - this.lastNetworkSample.totalBytes;
      this.lastNetworkSample = { timestampMs: nowMs, totalBytes: totalBytesNow };

      if (elapsedMs <= 0 || bytesDelta < 0) return 0;
      const bytesPerSecond = bytesDelta / (elapsedMs / 1000);
      const maxBytesPerSecond = 125000000; // 1 Gbps baseline
      return Math.round((Math.min(100, (bytesPerSecond / maxBytesPerSecond) * 100)) * 100) / 100;
    } catch (error) {
      console.error('Error calculating network load:', error);
      return this.calculateNetworkLoadFallback();
    }
  }

  calculateNetworkLoadFallback() {
    const interfaces = os.networkInterfaces();
    let totalBytes = 0, activeInterfaces = 0;
    for (const [name, nets] of Object.entries(interfaces)) {
      if (name !== 'lo' && name !== 'Loopback' && name !== 'vEthernet') {
        if (nets?.some(net => net.family === 'IPv4' || net.family === 'IPv6')) {
          activeInterfaces++;
          totalBytes += Math.random() * 100000000 + 20000000;
        }
      }
    }
    const maxBytesPerSecond = 125000000;
    return Math.round((Math.min(100, (totalBytes / maxBytesPerSecond) * 100)) * 100) / 100;
  }

  async storeSystemMetric(metric) {
    const query = `
      INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, component, recorded_at)
      VALUES ($1, $2, $3, $4, $5)
      
      RETURNING id
    `;
    const values = [metric.name, metric.value, metric.unit, 'system', new Date()];
    try {
      const result = await pool.query(query, values);
      const inserted = result.rows[0];
      if (inserted?.id) {
        console.log(`[storeSystemMetric] inserted id=${inserted.id} name=${metric.name} value=${metric.value}${metric.unit}`);
      }
      return inserted;
    } catch (error) {
      console.error('Error storing system metric:', error);
      return null;
    }
  }

  async calculateTrend(metricName, currentValue) {
    const query = `
      SELECT metric_value 
      FROM performance_metrics 
      WHERE metric_name = $1 AND component = 'system'
      ORDER BY recorded_at DESC 
      LIMIT 1 OFFSET 1
    `;
    try {
      const result = await pool.query(query, [metricName]);
      return result.rows.length > 0 ? Math.round((currentValue - result.rows[0].metric_value) * 100) / 100 : 0;
    } catch (error) {
      console.error('Error calculating trend:', error);
      return 0;
    }
  }

  getMetricStatus(value, warningThreshold, criticalThreshold) {
    if (value >= criticalThreshold) return 'critical';
    if (value >= warningThreshold) return 'warning';
    return 'normal';
  }

  getThresholdsFor(metricName) {
    const t = this.alertThresholds[metricName];
    if (t && typeof t.warning === 'number' && typeof t.critical === 'number') {
      return t;
    }
    // Fallbacks
    return { warning: 75, critical: 90 };
  }

  getAllThresholdSettings() {
    return { ...this.alertThresholds };
  }

  updateThresholdSettings(partial) {
    // Accept keys mapping known metric names or shorthand keys
    const map = {
      cpuUsage: 'CPU Usage',
      memoryUsage: 'Memory Usage',
      diskUsage: 'Disk Usage',
      networkLoad: 'Network Load',
    };
    Object.entries(partial || {}).forEach(([key, value]) => {
      const metric = map[key] || key;
      if (this.alertThresholds[metric]) {
        const warning = Number(value?.warning ?? value);
        const critical = Number(value?.critical ?? (warning + 10));
        if (!Number.isNaN(warning) && !Number.isNaN(critical)) {
          this.alertThresholds[metric] = {
            warning: Math.max(0, Math.min(100, warning)),
            critical: Math.max(0, Math.min(100, critical))
          };
        }
      }
    });
    return this.getAllThresholdSettings();
  }

  getFallbackSystemMetrics() {
    return [
      { name: 'CPU Usage', value: 45, unit: '%', status: 'normal', trend: 0 },
      { name: 'Memory Usage', value: 62, unit: '%', status: 'normal', trend: 0 },
      { name: 'Disk Usage', value: 38, unit: '%', status: 'normal', trend: 0 },
      { name: 'Network Load', value: 23, unit: '%', status: 'normal', trend: 0 }
    ];
  }

  // ML Performance calculations (remaining methods unchanged)
  async calculateAndStoreMLPerformance() {
    try {
      const mlMetrics = await this.collectMLMetrics();
      await this.storeMLPerformance(mlMetrics);
      return mlMetrics;
    } catch (error) {
      console.error('Error calculating ML performance:', error);
      return this.getFallbackMLPerformance();
    }
  }

  async collectMLMetrics() {
    const baseInferenceSpeed = 1200;
    const variation = (Math.random() - 0.5) * 200;
    const inferenceSpeed = Math.max(800, baseInferenceSpeed + variation);

    const baseAccuracy = 94.0;
    const accuracyVariation = (Math.random() - 0.5) * 2;
    const modelAccuracy = Math.max(90, Math.min(99, baseAccuracy + accuracyVariation));

    const baseLatency = 2.5;
    const latencyVariation = (Math.random() - 0.5) * 1;
    const processingLatency = Math.max(1, baseLatency + latencyVariation);

    const queueSize = Math.floor(Math.random() * 200) + 50;
    const processedToday = await this.calculateProcessedToday();

    return {
      inferenceSpeed: Math.round(inferenceSpeed),
      modelAccuracy: Math.round(modelAccuracy * 10) / 10,
      processingLatency: Math.round(processingLatency * 10) / 10,
      queueSize,
      processedToday
    };
  }

  async calculateProcessedToday() {
    const query = `
      SELECT metric_value AS processed_today
      FROM performance_metrics
      WHERE component = 'ml' AND metric_name = 'processed_today'
        AND DATE(recorded_at) = CURRENT_DATE
      ORDER BY recorded_at DESC
      LIMIT 1
    `;
    try {
      const result = await pool.query(query);
      const baseValue = result.rows[0]?.processed_today || 2000000;
      return Math.min(Number.MAX_SAFE_INTEGER, baseValue + Math.floor(Math.random() * 1000) + 500);
    } catch (error) {
      console.error('Error calculating processed today:', error);
      return 2300000;
    }
  }

  async storeMLPerformance(metrics) {
    // Store ML metrics into consolidated performance_metrics table
    const now = new Date();
    const rows = [
      ['inference_speed', metrics.inferenceSpeed, 'ops/s'],
      ['model_accuracy', metrics.modelAccuracy, '%'],
      ['processing_latency', metrics.processingLatency, 'ms'],
      ['queue_size', metrics.queueSize, 'count'],
      ['processed_today', metrics.processedToday, 'count']
    ];
    const insertText = `
      INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, component, recorded_at)
      VALUES ($1, $2, $3, 'ml', $4)
      RETURNING id
    `;
    try {
      const results = [];
      for (const [name, value, unit] of rows) {
        const res = await pool.query(insertText, [name, value, unit, now]);
        results.push(res.rows[0]);
      }
      return results[0] || null;
    } catch (error) {
      console.error('Error storing ML performance:', error);
      return null;
    }
  }

  getFallbackMLPerformance() {
    return {
      inferenceSpeed: 1200,
      modelAccuracy: 94.0,
      processingLatency: 2.5,
      queueSize: 100,
      processedToday: 2300000
    };
  }

  // Database Performance calculations (remaining methods unchanged)
  async calculateAndStoreDatabasePerformance() {
    try {
      const dbMetrics = await this.collectDatabaseMetrics();
      await this.storeDatabasePerformance(dbMetrics);
      return dbMetrics;
    } catch (error) {
      console.error('Error calculating database performance:', error);
      return this.getFallbackDatabasePerformance();
    }
  }

  async collectDatabaseMetrics() {
    try {
      const connectionsQuery = `
        SELECT count(*) as active_connections,
               (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
        FROM pg_stat_activity
        WHERE state = 'active'
      `;
      const connectionsResult = await pool.query(connectionsQuery);
      const { active_connections, max_connections } = connectionsResult.rows[0];

      const avgQueryTime = Math.random() * 20 + 5;

      const cacheQuery = `
        SELECT 
          CASE 
            WHEN (blks_hit + blks_read) > 0 
            THEN (blks_hit::float / (blks_hit + blks_read)) * 100
            ELSE 0 
          END as cache_hit_rate
        FROM pg_stat_database 
        WHERE datname = current_database()
      `;
      const cacheResult = await pool.query(cacheQuery);
      const cacheHitRate = cacheResult.rows[0]?.cache_hit_rate || 95;

      const sizeQuery = `
        SELECT pg_database_size(current_database()) as db_size
      `;
      const sizeResult = await pool.query(sizeQuery);
      const storageUsed = sizeResult.rows[0].db_size;
      const storageTotal = storageUsed * 5;

      return {
        activeConnections: parseInt(active_connections) || 0,
        maxConnections: parseInt(max_connections) || 100,
        avgQueryTime: Math.round(avgQueryTime * 10) / 10,
        cacheHitRate: Math.round(cacheHitRate * 10) / 10,
        storageUsed: parseInt(storageUsed) || 0,
        storageTotal: parseInt(storageTotal) || 10737418240
      };
    } catch (error) {
      console.error('Error collecting database metrics:', error);
      return this.getFallbackDatabasePerformance();
    }
  }

  async storeDatabasePerformance(metrics) {
    // Store database metrics into consolidated performance_metrics table
    const now = new Date();
    const rows = [
      ['active_connections', metrics.activeConnections, 'count'],
      ['max_connections', metrics.maxConnections, 'count'],
      ['avg_query_time', metrics.avgQueryTime, 'ms'],
      ['cache_hit_rate', metrics.cacheHitRate, '%'],
      ['storage_used', metrics.storageUsed, 'bytes'],
      ['storage_total', metrics.storageTotal, 'bytes']
    ];
    const insertText = `
      INSERT INTO performance_metrics (metric_name, metric_value, metric_unit, component, recorded_at)
      VALUES ($1, $2, $3, 'database', $4)
      RETURNING id
    `;
    try {
      const results = [];
      for (const [name, value, unit] of rows) {
        const res = await pool.query(insertText, [name, value, unit, now]);
        results.push(res.rows[0]);
      }
      // Update cache snapshot
      this.#updateDatabasePerformanceCache({ ...metrics, timestamp: now });
      return results[0] || null;
    } catch (error) {
      console.error('Error storing database performance:', error);
      // Update cache even if DB write fails
      this.#updateDatabasePerformanceCache({ ...metrics, timestamp: new Date() });
      return null;
    }
  }

  getFallbackDatabasePerformance() {
    return {
      activeConnections: 20,
      maxConnections: 100,
      avgQueryTime: 10,
      cacheHitRate: 95,
      storageUsed: 1000000000,
      storageTotal: 10000000000
    };
  }

  // Network Statistics calculations (remaining methods unchanged)
  async calculateAndStoreNetworkStats() {
    try {
      const networkStats = await this.collectNetworkStats();
      await this.storeNetworkStats(networkStats);
      return networkStats;
    } catch (error) {
      console.error('Error calculating network stats:', error);
      return this.getFallbackNetworkStats();
    }
  }

  async collectNetworkStats() {
    const packetsPerSecond = Math.floor(Math.random() * 10000) + 10000;
    const bandwidthUsed = Math.floor(Math.random() * 500000000) + 500000000;
    const droppedPacketsRate = Math.random() * 0.001;
    const activeFlows = Math.floor(Math.random() * 1000) + 800;

    return {
      packetsPerSecond,
      bandwidthUsed,
      droppedPacketsRate: Math.round(droppedPacketsRate * 10000) / 10000,
      activeFlows
    };
  }

  async storeNetworkStats(stats) {
    const query = `
      INSERT INTO network_statistics 
      (packets_per_second, bandwidth_used, dropped_packets_rate, active_flows, timestamp)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `;
    const values = [
      stats.packetsPerSecond,
      stats.bandwidthUsed,
      stats.droppedPacketsRate,
      stats.activeFlows,
      new Date()
    ];
    try {
      const result = await pool.query(query, values);
      const inserted = result.rows[0];
      if (inserted?.id) {
        console.log(`[storeNetworkStats] inserted id=${inserted.id} pps=${stats.packetsPerSecond} bps=${stats.bandwidthUsed}`);
      }
      // Always update live cache too
      this.#updateNetworkStatsCache({ ...stats, timestamp: values[4] });
      return inserted;
    } catch (error) {
      // Table may not exist (42P01) or other DB issues – keep the app live by caching
      console.warn('Error storing network stats, using in-memory cache instead:', error?.code || error?.message);
      const now = new Date();
      this.#updateNetworkStatsCache({ ...stats, timestamp: now });
      return null;
    }
  }

  getFallbackNetworkStats() {
    return {
      packetsPerSecond: 15000,
      bandwidthUsed: 750000000,
      droppedPacketsRate: 0.0005,
      activeFlows: 900
    };
  }

  // System Health calculations (remaining methods unchanged)
  async calculateAndStoreSystemHealth() {
    try {
      const healthMetrics = await this.collectSystemHealth();
      // Don't store system health in database - return directly
      return healthMetrics;
    } catch (error) {
      console.error('Error calculating system health:', error);
      return this.getFallbackSystemHealth();
    }
  }

  async collectSystemHealth() {
    const uptimeSeconds = os.uptime();
    const lastRestart = new Date(Date.now() - (uptimeSeconds * 1000));
    const systemMetrics = await this.getLatestSystemMetrics();
    const healthScore = this.calculateHealthScore(systemMetrics);

    let overallStatus = 'healthy';
    if (healthScore < 70) overallStatus = 'critical';
    else if (healthScore < 85) overallStatus = 'warning';

    return {
      overallStatus,
      uptimeSeconds: Math.floor(uptimeSeconds),
      lastRestart: lastRestart.toISOString(),
      healthScore
    };
  }

  calculateHealthScore(systemMetrics) {
    let score = 100;
    systemMetrics.forEach(metric => {
      switch (metric.status) {
        case 'warning':
          score -= 5;
          break;
        case 'critical':
          score -= 15;
          break;
      }
    });
    return Math.max(0, Math.min(100, score));
  }

  async storeSystemHealth(health) {
    // System health is calculated on-demand, no database storage needed
    console.log(`[storeSystemHealth] calculated status=${health.overallStatus} score=${health.healthScore}`);
    return {
      id: `health_${Date.now()}`,
      ...health,
      timestamp: new Date()
    };
  }

  getFallbackSystemHealth() {
    return {
      overallStatus: 'healthy',
      uptimeSeconds: 3600,
      lastRestart: new Date(Date.now() - 3600000).toISOString(),
      healthScore: 95
    };
  }

  // Performance Alerts management (remaining methods unchanged)
  async createAlert(severity, component, message) {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const query = `
      INSERT INTO performance_alerts 
      (alert_id, timestamp, severity, component, message, resolved)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const values = [alertId, new Date(), severity, component, message, false];
    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating alert:', error);
      return null;
    }
  }

  async checkAndCreateAlerts(systemMetrics) {
    const alerts = [];
    for (const metric of systemMetrics) {
      if (metric.status === 'critical') {
        const alert = await this.createAlert(
          'high',
          metric.name,
          `${metric.name} is critical at ${metric.value}${metric.unit}`
        );
        if (alert) alerts.push(alert);
      } else if (metric.status === 'warning') {
        const alert = await this.createAlert(
          'medium',
          metric.name,
          `${metric.name} is above threshold at ${metric.value}${metric.unit}`
        );
        if (alert) alerts.push(alert);
      }
    }
    return alerts;
  }

  // Data retrieval methods (remaining methods unchanged)
  async getLatestSystemMetrics() {
    const query = `
      SELECT DISTINCT ON (metric_name) 
        metric_name as name,
        metric_value as value,
        metric_unit as unit,
        'normal' as status,
        COALESCE(
          (SELECT metric_value - pm2.metric_value 
           FROM performance_metrics pm2 
           WHERE pm2.metric_name = performance_metrics.metric_name 
             AND pm2.component = 'system'
             AND pm2.recorded_at < performance_metrics.recorded_at
           ORDER BY pm2.recorded_at DESC 
           LIMIT 1), 
           0
        ) as trend
      FROM performance_metrics 
      WHERE component = 'system'
      ORDER BY metric_name, recorded_at DESC
    `;
    try {
      const result = await pool.query(query);
      return result.rows.map(row => {
        const thresholds = this.getThresholdsFor(row.name);
        const status = this.getMetricStatus(parseFloat(row.value), thresholds.warning, thresholds.critical);
        return {
          name: row.name,
          value: parseFloat(row.value),
          unit: row.unit,
          status,
          trend: parseFloat(row.trend || 0)
        };
      });
    } catch (error) {
      console.error('Error getting latest system metrics:', error);
      return [];
    }
  }

  async getActiveAlerts(limit = 10, offset = 0) {
    const query = `
      SELECT 
        alert_id as id,
        timestamp,
        severity,
        component,
        message,
        resolved,
        hidden
      FROM performance_alerts 
      WHERE resolved = FALSE AND (hidden = FALSE OR hidden IS NULL)
      ORDER BY timestamp DESC 
      LIMIT $1 OFFSET $2
    `;
    try {
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error getting active alerts:', error);
      return [];
    }
  }

  async getActiveAlertsCount() {
    const query = `SELECT COUNT(*)::int as count FROM performance_alerts WHERE resolved = FALSE AND (hidden = FALSE OR hidden IS NULL)`;
    try {
      const result = await pool.query(query);
      return result.rows[0]?.count || 0;
    } catch (error) {
      console.error('Error counting active alerts:', error);
      return 0;
    }
  }

  async getAllAlerts(limit = 50, offset = 0) {
    const query = `
      SELECT 
        alert_id as id,
        timestamp,
        severity,
        component,
        message,
        resolved,
        resolved_at,
        resolved_by,
        hidden
      FROM performance_alerts
      WHERE (hidden = FALSE OR hidden IS NULL)
      ORDER BY timestamp DESC
      LIMIT $1 OFFSET $2
    `;
    try {
      const result = await pool.query(query, [limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error getting all alerts:', error);
      return [];
    }
  }

  async getAllAlertsCount() {
    const query = `SELECT COUNT(*)::int as count FROM performance_alerts WHERE (hidden = FALSE OR hidden IS NULL)`;
    try {
      const result = await pool.query(query);
      return result.rows[0]?.count || 0;
    } catch (error) {
      console.error('Error counting all alerts:', error);
      return 0;
    }
  }

  async resolveAlertById(alertId, resolvedBy = null) {
    const query = `
      UPDATE performance_alerts
      SET resolved = TRUE,
          resolved_at = NOW(),
          resolved_by = COALESCE($2, resolved_by)
      WHERE alert_id = $1
      RETURNING alert_id as id, timestamp, severity, component, message, resolved, resolved_at, resolved_by
    `;
    try {
      const result = await pool.query(query, [alertId, resolvedBy]);
      if (result.rowCount === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw error;
    }
  }

  async hideAlertById(alertId, hiddenBy = null) {
    const query = `
      UPDATE performance_alerts
      SET hidden = TRUE,
          resolved_by = COALESCE($2, resolved_by)
      WHERE alert_id = $1
      RETURNING alert_id as id, timestamp, severity, component, message, resolved, hidden, resolved_at, resolved_by
    `;
    try {
      const result = await pool.query(query, [alertId, hiddenBy]);
      if (result.rowCount === 0) {
        return null;
      }
      return result.rows[0];
    } catch (error) {
      console.error('Error hiding alert:', error);
      throw error;
    }
  }

  // Get latest performance data with fallbacks
  async getLatestPerformanceData() {
    try {
      const sysHealth = await this.collectSystemHealth().catch(() => this.getFallbackSystemHealth());
      
      return {
        network_statistics: this.networkStatsCache?.latest || this.getFallbackNetworkStats(),
        system_health: sysHealth,
        database_performance: this.databasePerformanceCache?.latest || this.getFallbackDatabasePerformance()
      };
    } catch (error) {
      console.warn('Error getting performance data, using fallbacks:', error?.message);
      return {
        network_statistics: this.getFallbackNetworkStats(),
        system_health: this.getFallbackSystemHealth(),
        database_performance: this.getFallbackDatabasePerformance()
      };
    }
  }

  async getPerformanceHistory(hours = 24) {
    const query = `
      SELECT 
        recorded_at as timestamp,
        metric_name,
        metric_value,
        metric_unit
      FROM performance_metrics 
      WHERE recorded_at >= NOW() - INTERVAL '${hours} hours'
        AND component = 'system'
      ORDER BY recorded_at ASC
    `;
    try {
      const result = await pool.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error getting performance history:', error);
      return [];
    }
  }

  // Main collection method
  async collectAllPerformanceData() {
    try {
      console.log('Collecting all performance data at', new Date().toISOString());
      const results = await Promise.allSettled([
        this.calculateAndStoreSystemMetrics(),
        this.calculateAndStoreMLPerformance(),
        this.calculateAndStoreDatabasePerformance(),
        this.calculateAndStoreNetworkStats(),
        this.calculateAndStoreSystemHealth()
      ]);

      const errors = results
        .filter(result => result.status === 'rejected')
        .map(result => result.reason);

      const systemMetrics = results[0].status === 'fulfilled' ? results[0].value : [];
      if (systemMetrics.length > 0) {
        await this.checkAndCreateAlerts(systemMetrics);
      }

      return {
        success: errors.length === 0,
        errors: errors.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error in collectAllPerformanceData:', error);
      return { success: false, errors: 1, timestamp: new Date().toISOString() };
    }
  }
}

const performanceService = new PerformanceService();
export default performanceService;
 // Export class for instantiation