import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  Clock, 
  Filter,
  Search,
  Download,
  Eye,
  Ban
} from 'lucide-react';

interface AttackEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  attack_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  status: 'detected' | 'blocked' | 'investigating';
  flow_data: {
    protocol: string;
    src_port: number;
    dst_port: number;
    packet_count: number;
    byte_count: number;
  };
}

export const AttackDetection: React.FC = () => {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Mock real-time attack data
    const mockAttacks: AttackEvent[] = [
      {
        id: '1',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        source_ip: '192.168.1.100',
        destination_ip: '10.0.0.5',
        attack_type: 'DDoS',
        severity: 'critical',
        confidence: 0.95,
        status: 'blocked',
        flow_data: {
          protocol: 'TCP',
          src_port: 80,
          dst_port: 443,
          packet_count: 15420,
          byte_count: 2048000
        }
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        source_ip: '172.16.0.25',
        destination_ip: '10.0.0.12',
        attack_type: 'Port Scan',
        severity: 'medium',
        confidence: 0.87,
        status: 'detected',
        flow_data: {
          protocol: 'TCP',
          src_port: 22,
          dst_port: 80,
          packet_count: 245,
          byte_count: 12800
        }
      },
      {
        id: '3',
        timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        source_ip: '203.0.113.45',
        destination_ip: '10.0.0.3',
        attack_type: 'Brute Force',
        severity: 'high',
        confidence: 0.92,
        status: 'investigating',
        flow_data: {
          protocol: 'TCP',
          src_port: 22,
          dst_port: 22,
          packet_count: 892,
          byte_count: 45600
        }
      }
    ];

    setAttacks(mockAttacks);

    // Simulate new attacks
    const interval = setInterval(() => {
      const newAttack: AttackEvent = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        source_ip: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        destination_ip: `10.0.0.${Math.floor(Math.random() * 255)}`,
        attack_type: ['DDoS', 'Port Scan', 'Brute Force', 'SQL Injection'][Math.floor(Math.random() * 4)],
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)] as any,
        confidence: Math.random() * 0.3 + 0.7,
        status: ['detected', 'blocked', 'investigating'][Math.floor(Math.random() * 3)] as any,
        flow_data: {
          protocol: ['TCP', 'UDP'][Math.floor(Math.random() * 2)],
          src_port: Math.floor(Math.random() * 65535),
          dst_port: Math.floor(Math.random() * 65535),
          packet_count: Math.floor(Math.random() * 10000) + 100,
          byte_count: Math.floor(Math.random() * 1000000) + 1000
        }
      };

      setAttacks(prev => [newAttack, ...prev.slice(0, 9)]);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  const severityColor = {
    low: 'text-green-400 bg-green-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    critical: 'text-red-400 bg-red-400/10'
  };

  const statusColor = {
    detected: 'text-yellow-400 bg-yellow-400/10',
    blocked: 'text-green-400 bg-green-400/10',
    investigating: 'text-blue-400 bg-blue-400/10'
  };

  const filteredAttacks = attacks.filter(attack => {
    const severityMatch = filterSeverity === 'all' || attack.severity === filterSeverity;
    const searchMatch = attack.source_ip.includes(searchTerm) || 
                       attack.destination_ip.includes(searchTerm) || 
                       attack.attack_type.toLowerCase().includes(searchTerm.toLowerCase());
    return severityMatch && searchMatch;
  });

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="text-red-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {attacks.filter(a => a.status === 'detected').length}
              </h3>
              <p className="text-red-400 font-medium">Active Threats</p>
            </div>
          </div>
        </div>
        
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <Shield className="text-green-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {attacks.filter(a => a.status === 'blocked').length}
              </h3>
              <p className="text-green-400 font-medium">Blocked Attacks</p>
            </div>
          </div>
        </div>

        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <Clock className="text-blue-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {attacks.filter(a => a.status === 'investigating').length}
              </h3>
              <p className="text-blue-400 font-medium">Under Investigation</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-purple-400 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-white">ML</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">94.2%</h3>
              <p className="text-purple-400 font-medium">ML Accuracy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Search size={20} className="text-gray-400" />
              <input
                type="text"
                placeholder="Search by IP or attack type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
          <button className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
            <Download size={20} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* Attack Events List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">Recent Attack Events</h3>
          <p className="text-gray-400 text-sm">Real-time ML-powered threat detection</p>
        </div>
        <div className="divide-y divide-gray-700">
          {filteredAttacks.map((attack) => (
            <div key={attack.id} className="p-6 hover:bg-gray-700/30 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${severityColor[attack.severity]}`}>
                      {attack.severity.toUpperCase()}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[attack.status]}`}>
                      {attack.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">
                      Confidence: {(attack.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="text-white font-semibold">{attack.attack_type} Attack</h4>
                    <p className="text-gray-400 text-sm">
                      {attack.source_ip} → {attack.destination_ip}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-sm text-gray-400">
                    <span>Protocol: {attack.flow_data.protocol}</span>
                    <span>Packets: {attack.flow_data.packet_count.toLocaleString()}</span>
                    <span>Bytes: {(attack.flow_data.byte_count / 1024).toFixed(1)}KB</span>
                    <span>Time: {new Date(attack.timestamp).toLocaleTimeString()}</span>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 ml-4">
                  <button className="p-2 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-lg transition-colors">
                    <Eye size={16} />
                  </button>
                  <button className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors">
                    <Ban size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};