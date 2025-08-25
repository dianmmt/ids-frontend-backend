import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Activity, 
  Network, 
  AlertTriangle,
  TrendingUp,
  Database,
  Clock,
  CheckCircle
} from 'lucide-react';

// MetricCard component
interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: React.ComponentType<any>;
  iconColor: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  iconColor
}) => {
  const changeColor = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-gray-400'
  };

  const changeIcon = {
    positive: '↗',
    negative: '↘',
    neutral: '→'
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gray-700/50 rounded-lg">
            <Icon size={20} className={iconColor} />
          </div>
          <div>
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-medium ${changeColor[changeType]} flex items-center space-x-1`}>
            <span>{changeIcon[changeType]}</span>
            <span>{change}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple Chart component
interface ChartProps {
  type: 'line' | 'bar' | 'area';
  height?: number;
}

const Chart: React.FC<ChartProps> = ({ type, height = 200 }) => {
  const [data, setData] = useState<number[]>([]);

  useEffect(() => {
    const generateData = () => {
      const points = 24;
      const newData: number[] = [];
      
      for (let i = 0; i < points; i++) {
        const baseLevel = 20;
        const timeVariation = Math.sin((i / points) * Math.PI * 2) * 15;
        const randomSpikes = Math.random() > 0.8 ? Math.random() * 40 : 0;
        const noise = (Math.random() - 0.5) * 10;
        
        const value = Math.max(0, baseLevel + timeVariation + randomSpikes + noise);
        newData.push(Math.round(value));
      }
      
      return newData;
    };

    setData(generateData());

    const interval = setInterval(() => {
      setData(prevData => {
        const newData = [...prevData.slice(1)];
        const lastValue = prevData[prevData.length - 1] || 20;
        const variation = (Math.random() - 0.5) * 10;
        const spike = Math.random() > 0.9 ? Math.random() * 30 : 0;
        const newValue = Math.max(0, Math.round(lastValue + variation + spike));
        newData.push(newValue);
        return newData;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const maxValue = Math.max(...data, 1);
  const width = 400;
  const chartHeight = height - 40;

  const createPath = () => {
    if (data.length === 0) return '';
    
    const stepX = width / (data.length - 1);
    
    let path = `M 0,${chartHeight - (data[0] / maxValue) * chartHeight}`;
    
    for (let i = 1; i < data.length; i++) {
      const x = i * stepX;
      const y = chartHeight - (data[i] / maxValue) * chartHeight;
      path += ` L ${x},${y}`;
    }
    
    return path;
  };

  return (
    <div className="w-full" style={{ height }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.8"/>
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.1"/>
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {[...Array(5)].map((_, i) => (
          <line
            key={i}
            x1="0"
            y1={(chartHeight / 4) * i}
            x2={width}
            y2={(chartHeight / 4) * i}
            stroke="#374151"
            strokeWidth="1"
            opacity="0.3"
          />
        ))}
        
        {/* Chart area */}
        {data.length > 0 && (
          <path
            d={`${createPath()} L ${width},${chartHeight} L 0,${chartHeight} Z`}
            fill="url(#chartGradient)"
          />
        )}
        
        {/* Chart line */}
        {data.length > 0 && (
          <path
            d={createPath()}
            stroke="#3B82F6"
            strokeWidth="2"
            fill="none"
          />
        )}
        
        {/* Data points */}
        {data.map((value, i) => (
          <circle
            key={i}
            cx={(i / (data.length - 1)) * width}
            cy={chartHeight - (value / maxValue) * chartHeight}
            r="3"
            fill="#3B82F6"
          />
        ))}
      </svg>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const [threatLevel, setThreatLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [realtimeData, setRealtimeData] = useState({
    attacksDetected: 888,
    blockedConnections: 33,
    activeFlows: 15389,
    systemLoad: 68
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setRealtimeData(prev => ({
        attacksDetected: prev.attacksDetected + Math.floor(Math.random() * 3),
        blockedConnections: prev.blockedConnections + Math.floor(Math.random() * 2),
        activeFlows: prev.activeFlows + Math.floor(Math.random() * 20) - 10,
        systemLoad: Math.max(60, Math.min(95, prev.systemLoad + (Math.random() - 0.5) * 10))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const threatLevelColor = {
    low: 'text-green-400',
    medium: 'text-yellow-400',
    high: 'text-red-400'
  };

  const threatLevelBg = {
    low: 'bg-green-400/10 border-green-400/20',
    medium: 'bg-yellow-400/10 border-yellow-400/20',
    high: 'bg-red-400/10 border-red-400/20'
  };

  return (
    <div className="space-y-8">
      {/* System Status Banner */}
      <div className={`p-8 rounded-2xl border ${threatLevelBg[threatLevel]} backdrop-blur-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className={`p-4 rounded-xl bg-black/20`}>
              <Shield size={32} className={threatLevelColor[threatLevel]} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">System Status: Active</h2>
              <p className={`text-lg font-semibold ${threatLevelColor[threatLevel]}`}>
                Threat Level: {threatLevel.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Last ML Model Update</p>
            <p className="text-white font-semibold text-lg">2 minutes ago</p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard
          title="Attacks Detected"
          value={realtimeData.attacksDetected.toLocaleString()}
          change="+12"
          changeType="negative"
          icon={AlertTriangle}
          iconColor="text-red-400"
        />
        <MetricCard
          title="Blocked Connections"
          value={realtimeData.blockedConnections.toString()}
          change="+3"
          changeType="positive"
          icon={Shield}
          iconColor="text-green-400"
        />
        <MetricCard
          title="Active Network Flows"
          value={realtimeData.activeFlows.toLocaleString()}
          change="-45"
          changeType="neutral"
          icon={Activity}
          iconColor="text-blue-400"
        />
        <MetricCard
          title="System Load"
          value={`${Math.round(realtimeData.systemLoad)}%`}
          change="+5%"
          changeType="negative"
          icon={TrendingUp}
          iconColor="text-purple-400"
        />
      </div>

      {/* Charts and Analysis */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        <div className="xl:col-span-3 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-semibold text-white">Attack Detection Timeline</h3>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400 font-medium">Live</span>
            </div>
          </div>
          <Chart type="line" height={280} />
        </div>

        <div className="xl:col-span-2 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-8">ML Model Performance</h3>
          <div className="space-y-8">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-300 font-medium">Detection Accuracy</span>
                <span className="text-green-400 font-bold text-lg">94.7%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="bg-green-400 h-3 rounded-full transition-all duration-500" style={{ width: '94.7%' }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-gray-300 font-medium">False Positive Rate</span>
                <span className="text-yellow-400 font-bold text-lg">2.1%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div className="bg-yellow-400 h-3 rounded-full transition-all duration-500" style={{ width: '2.1%' }}></div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-600">
              <div className="flex justify-between items-center">
                <span className="text-gray-300 font-medium">Processing Speed</span>
                <span className="text-blue-400 font-bold text-lg">1,247 flows/sec</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-8">Recent Security Events</h3>
        <div className="space-y-4">
          {[
            { time: '2 min ago', event: 'DDoS attack detected from 192.168.1.100', severity: 'high' },
            { time: '5 min ago', event: 'Suspicious port scan blocked', severity: 'medium' },
            { time: '8 min ago', event: 'ML model updated with new threat signatures', severity: 'info' },
            { time: '12 min ago', event: 'Network topology change detected', severity: 'low' },
          ].map((item, index) => (
            <div key={index} className="flex items-center space-x-6 p-4 rounded-xl bg-gray-700/50 hover:bg-gray-700/70 transition-colors">
              <div className={`w-3 h-3 rounded-full ${
                item.severity === 'high' ? 'bg-red-400' :
                item.severity === 'medium' ? 'bg-yellow-400' :
                item.severity === 'info' ? 'bg-blue-400' : 'bg-green-400'
              }`}></div>
              <div className="flex-1">
                <p className="text-white font-medium">{item.event}</p>
                <p className="text-gray-400 text-sm mt-1">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};