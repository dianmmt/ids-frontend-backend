import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Download,
  Filter,
  PieChart,
  Target,
  Clock
} from 'lucide-react';
import { Chart } from './ui/Chart';

export const SecurityAnalytics: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const [reportType, setReportType] = useState('attacks');

  const attackTypes = [
    { name: 'DDoS', count: 425, percentage: 45, trend: '+12%' },
    { name: 'Port Scan', count: 312, percentage: 33, trend: '+8%' },
    { name: 'Brute Force', count: 156, percentage: 16, trend: '-3%' },
    { name: 'SQL Injection', count: 57, percentage: 6, trend: '+15%' }
  ];

  const topSourceIPs = [
    { ip: '203.0.113.45', attacks: 89, country: 'Unknown' },
    { ip: '192.0.2.123', attacks: 67, country: 'Unknown' },
    { ip: '198.51.100.89', attacks: 54, country: 'Unknown' },
    { ip: '172.16.254.1', attacks: 42, country: 'Unknown' },
    { ip: '10.0.0.100', attacks: 38, country: 'Internal' }
  ];

  const timeSeriesData = {
    '1h': { attacks: [12, 15, 8, 22, 19, 25, 18, 14, 20, 16, 24, 21] },
    '24h': { attacks: [45, 52, 38, 67, 59, 72, 48, 63, 55, 70, 42, 58] },
    '7d': { attacks: [320, 280, 410, 390, 450, 380, 420] },
    '30d': { attacks: [1200, 1350, 1180, 1420, 1290, 1380, 1250, 1450] }
  };

  return (
    <div className="space-y-6">
      {/* Analytics Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-white">Security Analytics & Reporting</h2>
          <p className="text-gray-400">Comprehensive analysis of network security events</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar size={20} className="text-gray-400" />
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Download size={20} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-3xl font-bold text-white">950</h3>
              <p className="text-red-400 font-medium">Total Attacks</p>
              <div className="flex items-center space-x-1 mt-2">
                <TrendingUp size={14} className="text-red-400" />
                <span className="text-red-400 text-sm">+23% vs last period</span>
              </div>
            </div>
            <Target className="text-red-400" size={32} />
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500/10 to-green-600/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-3xl font-bold text-white">847</h3>
              <p className="text-green-400 font-medium">Blocked</p>
              <div className="flex items-center space-x-1 mt-2">
                <TrendingUp size={14} className="text-green-400" />
                <span className="text-green-400 text-sm">89.2% success rate</span>
              </div>
            </div>
            <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">✓</span>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-3xl font-bold text-white">2.4s</h3>
              <p className="text-yellow-400 font-medium">Avg Detection</p>
              <div className="flex items-center space-x-1 mt-2">
                <Clock size={14} className="text-yellow-400" />
                <span className="text-yellow-400 text-sm">Response time</span>
              </div>
            </div>
            <Clock className="text-yellow-400" size={32} />
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500/10 to-purple-600/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-3xl font-bold text-white">94.7%</h3>
              <p className="text-purple-400 font-medium">ML Accuracy</p>
              <div className="flex items-center space-x-1 mt-2">
                <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                <span className="text-purple-400 text-sm">Model confidence</span>
              </div>
            </div>
            <div className="w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attack Timeline */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Attack Timeline</h3>
            <div className="flex items-center space-x-2 text-blue-400">
              <BarChart3 size={16} />
              <span className="text-sm">Live Updates</span>
            </div>
          </div>
          <Chart type="line" />
          <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
            <span>Peak: 72 attacks at 14:00</span>
            <span>Average: 58 attacks/hour</span>
          </div>
        </div>

        {/* Attack Distribution */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Attack Types Distribution</h3>
            <PieChart size={20} className="text-gray-400" />
          </div>
          <div className="space-y-4">
            {attackTypes.map((type, index) => (
              <div key={type.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white font-medium">{type.name}</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-white text-sm">{type.count}</span>
                    <span className={`text-xs ${
                      type.trend.startsWith('+') ? 'text-red-400' : 'text-green-400'
                    }`}>{type.trend}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      index === 0 ? 'bg-red-400' :
                      index === 1 ? 'bg-yellow-400' :
                      index === 2 ? 'bg-blue-400' : 'bg-purple-400'
                    }`}
                    style={{ width: `${type.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Source IPs */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">Top Attack Sources</h3>
          <div className="space-y-4">
            {topSourceIPs.map((source, index) => (
              <div key={source.ip} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <div>
                  <p className="text-white font-mono text-sm">{source.ip}</p>
                  <p className="text-gray-400 text-xs">{source.country}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-semibold">{source.attacks}</p>
                  <p className="text-gray-400 text-xs">attacks</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Geographic Distribution */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">Geographic Distribution</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Internal Network</span>
              <span className="text-white">45%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-blue-400 h-2 rounded-full" style={{ width: '45%' }}></div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-400">External Sources</span>
              <span className="text-white">55%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="bg-red-400 h-2 rounded-full" style={{ width: '55%' }}></div>
            </div>

            <div className="mt-6 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Unknown/Proxy</span>
                <span className="text-white">78%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tor Exit Nodes</span>
                <span className="text-white">12%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Known Botnets</span>
                <span className="text-white">10%</span>
              </div>
            </div>
          </div>
        </div>

        {/* ML Model Performance */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-6">ML Model Performance</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Precision</span>
                <span className="text-green-400">96.2%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-green-400 h-2 rounded-full" style={{ width: '96.2%' }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Recall</span>
                <span className="text-blue-400">93.8%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-blue-400 h-2 rounded-full" style={{ width: '93.8%' }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">F1-Score</span>
                <span className="text-purple-400">95.0%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-purple-400 h-2 rounded-full" style={{ width: '95.0%' }}></div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-gray-700/30 rounded-lg">
              <p className="text-xs text-gray-400 mb-2">Last Model Update</p>
              <p className="text-white text-sm">2 hours ago</p>
              <p className="text-green-400 text-xs mt-1">Training accuracy improved by 0.3%</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};