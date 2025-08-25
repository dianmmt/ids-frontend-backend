import React, { useState, useEffect } from 'react';
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
  Database
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

export const PerformanceMonitor: React.FC = () => {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetric[]>([
    { name: 'CPU Usage', value: 78, unit: '%', status: 'warning', trend: 5 },
    { name: 'Memory Usage', value: 65, unit: '%', status: 'normal', trend: -2 },
    { name: 'Disk Usage', value: 42, unit: '%', status: 'normal', trend: 1 },
    { name: 'Network Load', value: 89, unit: '%', status: 'critical', trend: 15 },
  ]);

  const [performanceAlerts, setPerformanceAlerts] = useState<PerformanceAlert[]>([
    {
      id: '1',
      timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      severity: 'high',
      component: 'Network Interface',
      message: 'High network utilization detected (89%)',
      resolved: false
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      severity: 'medium',
      component: 'CPU',
      message: 'CPU usage above threshold (78%)',
      resolved: false
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      severity: 'low',
      component: 'ML Processing',
      message: 'Model inference time increased',
      resolved: true
    }
  ]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemMetrics(prev => prev.map(metric => ({
        ...metric,
        value: Math.max(0, Math.min(100, metric.value + (Math.random() - 0.5) * 10)),
        trend: (Math.random() - 0.5) * 20
      })));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="space-y-6">
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
            <span>CPU: {systemMetrics[0]?.value.toFixed(1)}%</span>
            <span>Memory: {systemMetrics[1]?.value.toFixed(1)}%</span>
            <span>Network: {systemMetrics[3]?.value.toFixed(1)}%</span>
          </div>
        </div>

        {/* ML Processing Performance */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">ML Processing Performance</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Inference Speed</span>
              <span className="text-white font-semibold">1,247 flows/sec</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-blue-400 h-2 rounded-full" style={{ width: '89%' }}></div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Model Accuracy</span>
              <span className="text-green-400 font-semibold">94.7%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-green-400 h-2 rounded-full" style={{ width: '94.7%' }}></div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-400">Processing Latency</span>
              <span className="text-yellow-400 font-semibold">2.4ms avg</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '76%' }}></div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-gray-400 text-xs">Queue Size</p>
                <p className="text-white font-semibold">127 flows</p>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-3">
                <p className="text-gray-400 text-xs">Processed Today</p>
                <p className="text-white font-semibold">2.3M flows</p>
              </div>
            </div>
          </div>
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
          {performanceAlerts.map((alert) => (
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
          ))}
        </div>
      </div>

      {/* System Resources */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Database className="text-blue-400" size={24} />
            <h3 className="text-lg font-semibold text-white">Database Performance</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Connections</span>
              <span className="text-white">45/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Query Time (avg)</span>
              <span className="text-white">12.4ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Cache Hit Rate</span>
              <span className="text-green-400">96.8%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Storage Used</span>
              <span className="text-white">2.1GB / 10GB</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Wifi className="text-purple-400" size={24} />
            <h3 className="text-lg font-semibold text-white">Network Statistics</h3>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-400">Packets/sec</span>
              <span className="text-white">15,420</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Bandwidth Used</span>
              <span className="text-white">847 Mbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Dropped Packets</span>
              <span className="text-yellow-400">0.02%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Active Flows</span>
              <span className="text-white">1,287</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3 mb-6">
            <Activity className="text-green-400" size={24} />
            <h3 className="text-lg font-semibold text-white">System Health</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Overall Status</span>
              <div className="flex items-center space-x-2">
                <CheckCircle size={16} className="text-green-400" />
                <span className="text-green-400">Healthy</span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Uptime</span>
              <span className="text-white">15d 7h 23m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Last Restart</span>
              <span className="text-white">15 days ago</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Health Score</span>
              <span className="text-green-400">92/100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};