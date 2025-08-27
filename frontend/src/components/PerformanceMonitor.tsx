import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Wifi,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Monitor,
  Database,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Chart } from './ui/Chart';

interface SystemMetric {
  name: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  trend: number;
}

interface PerformanceAlert {
  id: string;
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  component: string;
  message: string;
  resolved: boolean;
}

interface MLPerformance {
  inferenceSpeed: number;
  modelAccuracy: number;
  processingLatency: number;
  queueSize: number;
  processedToday: number;
}

interface DatabasePerformance {
  activeConnections: number;
  maxConnections: number;
  avgQueryTime: number;
  cacheHitRate: number;
  storageUsed: number;
  storageTotal: number;
}

interface NetworkStatistics {
  packetsPerSecond: number;
  bandwidthUsed: number;
  droppedPacketsRate: number;
  activeFlows: number;
}

interface SystemHealth {
  overallStatus: string;
  uptimeSeconds: number;
  lastRestart: string;
  healthScore: number;
}

export const PerformanceMonitor: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([]);
  const [performanceAlerts, setPerformanceAlerts] = useState<PerformanceAlert[]>([]);
  const [mlPerformance, setMLPerformance] = useState<MLPerformance | null>(null);
  const [databasePerformance, setDatabasePerformance] = useState<DatabasePerformance | null>(null);
  const [networkStatistics, setNetworkStatistics] = useState<NetworkStatistics | null>(null);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch performance data from backend
  const fetchPerformanceData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const endpoint = '/api/performance/current';
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText.substring(0, 100)}...`);
      }

      const data = await response.json();

      // Backend returns: [{ name, value, unit, status, trend }, ...]
      setSystemMetrics((Array.isArray(data) ? data : []).map((item: any) => ({
        name: item.name ?? 'Unknown',
        value: typeof item.value === 'number' ? item.value : Number(item.value) || 0,
        unit: item.unit ?? '%',
        status: (item.status as 'normal' | 'warning' | 'critical') ?? 'normal',
        trend: typeof item.trend === 'number' ? item.trend : Number(item.trend) || 0,
      })));

      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching performance data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch performance data');

      // Fallback to mock data if API fails
      if (systemMetrics.length === 0) {
        setSystemMetrics([
          { name: 'CPU Usage', value: 45, unit: '%', status: 'normal', trend: 2 },
          { name: 'Memory Usage', value: 62, unit: '%', status: 'normal', trend: -1 },
          { name: 'Disk Usage', value: 38, unit: '%', status: 'normal', trend: 0.5 },
          { name: 'Network Load', value: 23, unit: '%', status: 'normal', trend: 5 },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [systemMetrics.length]);

  // Initial data fetch
  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPerformanceData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchPerformanceData]);

  // Manual refresh function
  const handleRefresh = async () => {
    await fetchPerformanceData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal':
        return 'text-green-400 bg-green-400/10';
      case 'warning':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'critical':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low':
        return 'text-blue-400 bg-blue-400/10';
      case 'medium':
        return 'text-yellow-400 bg-yellow-400/10';
      case 'high':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getMetricIcon = (name: string) => {
    switch (name) {
      case 'CPU Usage':
        return Cpu;
      case 'Memory Usage':
        return Monitor;
      case 'Disk Usage':
        return HardDrive;
      case 'Network Load':
        return Wifi;
      default:
        return Activity;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Performance Monitor</h2>
        <div className="flex items-center space-x-4">
          {lastRefresh && (
            <span className="text-sm text-gray-400">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle size={20} className="text-red-400" />
            <span className="text-red-400">Error: {error}</span>
          </div>
        </div>
      )}

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {systemMetrics.map((metric) => {
          const Icon = getMetricIcon(metric.name);
          const TrendIcon = metric.trend > 0 ? TrendingUp : TrendingDown;
          
          return (
            <div key={metric.name} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <Icon size={24} className={`${getStatusColor(metric.status).split(' ')[0]}`} />
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(metric.status)}`}>
                  {metric.status.toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">
                  {metric.value.toFixed(1)}{metric.unit}
                </h3>
                <p className="text-gray-400 text-sm mb-2">{metric.name}</p>
                <div className="flex items-center space-x-1">
                  <TrendIcon size={14} className={metric.trend > 0 ? 'text-red-400' : 'text-green-400'} />
                  <span className={`text-xs ${metric.trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {Math.abs(metric.trend).toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="mt-4 w-full bg-gray-700 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-500 ${
                    metric.status === 'critical' ? 'bg-red-400' :
                    metric.status === 'warning' ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${metric.value}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance Charts */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">System Performance</h3>
            <div className="flex items-center space-x-2 text-green-400">
              <Activity size={16} />
              <span className="text-sm">Real-time</span>
            </div>
          </div>
          <Chart type="line" />
          <div className="mt-4 flex justify-between text-sm text-gray-400">
            <span>CPU: {systemMetrics.find(m => m.name === 'CPU Usage')?.value.toFixed(1) || '0'}%</span>
            <span>Memory: {systemMetrics.find(m => m.name === 'Memory Usage')?.value.toFixed(1) || '0'}%</span>
            <span>Network: {systemMetrics.find(m => m.name === 'Network Load')?.value.toFixed(1) || '0'}%</span>
          </div>
        </div>

        {/* ML Processing Performance */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">ML Processing Performance</h3>
          {mlPerformance ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Inference Speed</span>
                <span className="text-white font-semibold">{mlPerformance.inferenceSpeed.toLocaleString()} flows/sec</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(100, mlPerformance.inferenceSpeed / 15)}%` }}></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Model Accuracy</span>
                <span className="text-green-400 font-semibold">{mlPerformance.modelAccuracy}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-green-400 h-2 rounded-full" style={{ width: `${mlPerformance.modelAccuracy}%` }}></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-400">Processing Latency</span>
                <span className="text-yellow-400 font-semibold">{mlPerformance.processingLatency}ms avg</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${Math.min(100, (mlPerformance.processingLatency / 5) * 100)}%` }}></div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Queue Size</p>
                  <p className="text-white font-semibold">{mlPerformance.queueSize.toLocaleString()} flows</p>
                </div>
                <div className="bg-gray-700/30 rounded-lg p-3">
                  <p className="text-gray-400 text-xs">Processed Today</p>
                  <p className="text-white font-semibold">{(mlPerformance.processedToday / 1000000).toFixed(1)}M flows</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">Loading ML performance data...</div>
          )}
        </div>
      </div>

      {/* Performance Alerts */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Performance Alerts</h3>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400">
                {performanceAlerts.filter(a => !a.resolved).length} active alerts
              </span>
              <button className="text-blue-400 hover:text-blue-300 text-sm">
                View All
              </button>
            </div>
          </div>
        </div>
        <div className="divide-y divide-gray-700">
          {performanceAlerts.length > 0 ? (
            performanceAlerts.map((alert) => (
              <div key={alert.id} className="p-6 hover:bg-gray-700/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="mt-1">
                      {alert.resolved ? (
                        <CheckCircle size={20} className="text-green-400" />
                      ) : (
                        <AlertTriangle size={20} className="text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getSeverityColor(alert.severity)}`}>
                          {alert.severity.toUpperCase()}
                        </span>
                        <span className="text-gray-400 text-sm">{alert.component}</span>
                      </div>
                      <p className="text-white font-medium">{alert.message}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {alert.resolved ? (
                      <span className="text-green-400 text-sm">Resolved</span>
                    ) : (
                      <button className="text-blue-400 hover:text-blue-300 text-sm">
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-400">
              No active alerts
            </div>
          )}
        </div>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Database className="text-blue-400" size={24} />
            <h3 className="text-lg font-semibold text-white">Database Performance</h3>
          </div>
          {databasePerformance ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Connections</span>
                <span className="text-white">{databasePerformance.activeConnections}/{databasePerformance.maxConnections}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Query Time (avg)</span>
                <span className="text-white">{databasePerformance.avgQueryTime}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cache Hit Rate</span>
                <span className="text-green-400">{databasePerformance.cacheHitRate}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Storage Used</span>
                <span className="text-white">{formatBytes(databasePerformance.storageUsed)} / {formatBytes(databasePerformance.storageTotal)}</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">Loading database data...</div>
          )}
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Wifi className="text-purple-400" size={24} />
            <h3 className="text-lg font-semibold text-white">Network Statistics</h3>
          </div>
          {networkStatistics ? (
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Packets/sec</span>
                <span className="text-white">{networkStatistics.packetsPerSecond.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bandwidth Used</span>
                <span className="text-white">{formatBytes(networkStatistics.bandwidthUsed)}/s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Dropped Packets</span>
                <span className="text-yellow-400">{(networkStatistics.droppedPacketsRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Active Flows</span>
                <span className="text-white">{networkStatistics.activeFlows.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">Loading network data...</div>
          )}
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Activity className="text-green-400" size={24} />
            <h3 className="text-lg font-semibold text-white">System Health</h3>
          </div>
          {systemHealth ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Overall Status</span>
                <div className="flex items-center space-x-2">
                  <CheckCircle size={16} className="text-green-400" />
                  <span className="text-green-400 capitalize">{systemHealth.overallStatus}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Uptime</span>
                <span className="text-white">{formatUptime(systemHealth.uptimeSeconds)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Last Restart</span>
                <span className="text-white">{new Date(systemHealth.lastRestart).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Health Score</span>
                <span className="text-green-400">{systemHealth.healthScore}/100</span>
              </div>
            </div>
          ) : (
            <div className="text-gray-400 text-center py-8">Loading health data...</div>
          )}
        </div>
      </div>
    </div>
  );
};