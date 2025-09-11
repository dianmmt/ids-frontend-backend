import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Download,
  Eye,
  Ban,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface AttackEvent {
  id: string;
  timestamp: string;
  source_ip: string;
  destination_ip: string;
  attack_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  status: 'detected' | 'blocked' | 'investigating';
  probabilities?: Record<string, number>;
  flow_data: {
    protocol: string;
    src_port: number;
    dst_port: number;
    packet_count: number;
    byte_count: number;
  };
}

interface ActiveModel {
  id: string;
  name: string;
  version: string;
  framework: string;
  accuracy: number;
  is_active: boolean;
}

interface AttackDetectionProps {
  onAttackCountUpdate?: (count: number) => void;
}

export const AttackDetection: React.FC<AttackDetectionProps> = ({ onAttackCountUpdate }) => {
  const [attacks, setAttacks] = useState<AttackEvent[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [activeModels, setActiveModels] = useState<ActiveModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const eventsPerPage = 5;
  const reportRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch active models
  const fetchActiveModels = async () => {
    try {
      console.log('Fetching active models...');
      const response = await fetch('/api/ml/models', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Models data:', data);
        const active = data.models?.filter((model: any) => model.is_active) || [];
        console.log('Active models:', active);
        setActiveModels(active);
        if (active.length > 0 && !selectedModelId) {
          setSelectedModelId(active[0].id);
        }
      } else {
        console.error('Failed to fetch models:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch active models:', err);
    }
  };

  // Test selected model with sample data
  const testSelectedModel = async () => {
    if (!selectedModelId) {
      alert('Please select a model first');
      return;
    }

    try {
      const sampleData = {
        source_ip: '192.168.1.100',
        destination_ip: '10.0.0.1',
        source_port: 12345,
        destination_port: 80,
        protocol: 'TCP',
        packet_count: 100,
        byte_count: 5000,
        timestamp: new Date().toISOString()
      };

      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          'X-User-ID': localStorage.getItem('userId') || '1',
          'X-Model-Selection-Type': selectedModelId
        },
        body: JSON.stringify(sampleData)
      });

      if (response.ok) {
        const result = await response.json();
        alert(`Model Test Result:\nAttack: ${result.is_malicious ? 'Yes' : 'No'}\nConfidence: ${(result.confidence * 100).toFixed(1)}%\nAttack Type: ${result.attack_type}`);
      } else {
        alert('Failed to test model');
      }
    } catch (err) {
      console.error('Model test error:', err);
      alert('Error testing model');
    }
  };

  // Fetch initial attack data
  useEffect(() => {
    const fetchAttacks = async () => {
      try {
        const response = await fetch('/api/attacks?severity=all&limit=50', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
          }
        });
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        const mappedAttacks: AttackEvent[] = data.map((item: any) => ({
          id: item.detection_id,
          timestamp: item.detected_at,
          source_ip: item.source_ip,
          destination_ip: item.destination_ip,
          attack_type: item.attack_type || 'Anomaly',
          severity: item.severity,
          confidence: item.confidence_score,
          status: item.status || 'detected',
          probabilities: item.probabilities || {},
          flow_data: {
            protocol: item.protocol,
            src_port: item.source_port,
            dst_port: item.destination_port,
            packet_count: item.packet_count,
            byte_count: item.byte_count
          }
        }));
        setAttacks(mappedAttacks);
      } catch (err) {
        setError('Failed to fetch initial attacks');
        console.error(err);
      }
    };

    fetchAttacks();
    fetchActiveModels();

    // Thiết lập SSE
    const connectSSE = () => {
      eventSourceRef.current = new EventSource('/api/attacks/stream', {
        withCredentials: true
      });

      eventSourceRef.current.onmessage = (event) => {
        const newAttack: AttackEvent = JSON.parse(event.data);
        setAttacks(prev => [newAttack, ...prev.slice(0, 49)]);
      };

      eventSourceRef.current.onerror = () => {
        setError('Lost connection to attack stream. Reconnecting...');
        eventSourceRef.current?.close();
        setTimeout(connectSSE, 5000);
      };
    };

    connectSSE();

    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Update attack count in parent component
  useEffect(() => {
    if (onAttackCountUpdate) {
      onAttackCountUpdate(attacks.length);
    }
  }, [attacks.length, onAttackCountUpdate]);

  // Khai báo filteredAttacks trước phân trang
  const filteredAttacks = attacks.filter(attack => {
    const severityMatch =
      filterSeverity === 'all' || attack.severity === filterSeverity;
  
    const source = attack.source_ip ?? "";
    const dest = attack.destination_ip ?? "";
    const type = attack.attack_type ?? "";
  
    const searchMatch =
      source.includes(searchTerm) ||
      dest.includes(searchTerm) ||
      type.toLowerCase().includes(searchTerm.toLowerCase());
  
    return severityMatch && searchMatch;
  });
  
  

  // Pagination
  const totalPages = Math.ceil(filteredAttacks.length / eventsPerPage);
  const startIndex = (currentPage - 1) * eventsPerPage;
  const endIndex = startIndex + eventsPerPage;
  const currentAttacks = filteredAttacks.slice(startIndex, endIndex);

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

  const severityCounts = attacks.reduce(
    (acc, attack) => {
      const severity = attack.severity || 'low';
      if (severity in acc) {
        acc[severity as keyof typeof acc] = (acc[severity as keyof typeof acc] || 0) + 1;
      }
      return acc;
    },
    {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    } as Record<'low' | 'medium' | 'high' | 'critical', number>
  );

  const byType = attacks.reduce((acc: Record<string, number>, a) => {
    const attackType = a.attack_type || 'Unknown';
    acc[attackType] = (acc[attackType] || 0) + 1;
    return acc;
  }, {});

  const topAttackTypes = Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const handleExport = async () => {
    if (!reportRef.current) return;

    const element = reportRef.current;
    const canvas = await html2canvas(element, {
      backgroundColor: '#0b1220',
      scale: 2,
      useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 48;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const marginLeft = 24;
    let y = 24;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text('Attack Detection Report', marginLeft, y);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(new Date().toLocaleString(), marginLeft, y + 16);
    y += 32;

    if (imgHeight > pageHeight - y - 24) {
      const ratio = (pageHeight - y - 24) / imgHeight;
      pdf.addImage(imgData, 'PNG', marginLeft, y, imgWidth, imgHeight * ratio);
    } else {
      pdf.addImage(imgData, 'PNG', marginLeft, y, imgWidth, imgHeight);
    }

    pdf.save(`attack-report-${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

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
              <h3 className="text-2xl font-bold text-white">
                {selectedModelId && activeModels.find(m => m.id === selectedModelId) 
                  ? `${(activeModels.find(m => m.id === selectedModelId)!.accuracy * 100).toFixed(1)}%`
                  : 'N/A'
                }
              </h3>
              <p className="text-purple-400 font-medium">
                {selectedModelId && activeModels.find(m => m.id === selectedModelId) 
                  ? `${activeModels.find(m => m.id === selectedModelId)!.name} Accuracy`
                  : 'No Model Selected'
                }
              </p>
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
                onChange={e => setSearchTerm(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 w-64"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Shield size={20} className="text-gray-400" />
              <select
                value={selectedModelId}
                onChange={e => setSelectedModelId(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                disabled={activeModels.length === 0}
              >
                {activeModels.length === 0 ? (
                  <option value="">No Active Models</option>
                ) : (
                  activeModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} v{model.version} ({model.framework}) - {(model.accuracy * 100).toFixed(1)}%
                    </option>
                  ))
                )}
              </select>
              

            </div>
          </div>
          <button
          onClick={handleExport}
          className="flex items-center justify-center space-x-3 px-3 py-1.5 rounded-md font-medium text-xs bg-blue-500 hover:bg-blue-600 text-white shadow-sm transition-colors"
        >
          <Download size={16} />
          <span>Export Report</span>
        </button>

        </div>
      </div>

      {/* Attack Events List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Recent Attack Events
          </h3>
          <p className="text-gray-400 text-sm">
            Real-time ML-powered threat detection
          </p>
        </div>
        <div className="divide-y divide-gray-700">
          {currentAttacks.map(attack => (
            <div
              key={attack.id}
              className="p-6 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center space-x-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${severityColor[attack.severity] || 'text-gray-400 bg-gray-400/10'}`}
                    >
                      {(attack.severity || 'unknown').toUpperCase()}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor[attack.status] || 'text-gray-400 bg-gray-400/10'}`}
                    >
                      {(attack.status || 'unknown').toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400">
                      Confidence: {((attack.confidence || 0) * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold">
                      {attack.attack_type || 'Unknown'} Attack
                    </h4>
                    <p className="text-gray-400 text-sm">
                      {attack.source_ip || 'Unknown'} → {attack.destination_ip || 'Unknown'}
                    </p>
                  </div>

                  <div className="flex items-center space-x-6 text-sm text-gray-400">
                    <span>Protocol: {attack.flow_data?.protocol || 'Unknown'}</span>
                    <span>
                      Ports: {attack.flow_data?.src_port || 'Unknown'} →{' '}
                      {attack.flow_data?.dst_port || 'Unknown'}
                    </span>
                    <span>
                      Packets: {(attack.flow_data?.packet_count || 0).toLocaleString()}
                    </span>
                    <span>
                      Bytes: {((attack.flow_data?.byte_count || 0) / 1024).toFixed(1)}KB
                    </span>
                    <span>
                      Time: {new Date(attack.timestamp || Date.now()).toLocaleTimeString()}
                    </span>
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

        {/* Pagination */}
        <div className="flex items-center justify-between p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            Showing {startIndex + 1}-
            {Math.min(endIndex, filteredAttacks.length)} of {filteredAttacks.length} events
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-white bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <ChevronLeft size={16} />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button
              onClick={() =>
                setCurrentPage(prev => Math.min(prev + 1, totalPages))
              }
              disabled={currentPage === totalPages}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'text-gray-500 cursor-not-allowed'
                  : 'text-white bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <span>Next</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Off-screen report for export */}
      <div
        ref={reportRef}
        style={{ position: 'absolute', left: -99999, top: 0, width: 794 }}
        className="p-6 rounded-xl"
      >
        <div className="space-y-4 bg-gray-900 text-white rounded-xl border border-gray-700 p-6">
          <h2 className="text-xl font-bold mb-2">Attack Detection Report</h2>
          <p className="text-gray-400 text-sm mb-4">
            Generated at {new Date().toLocaleString()}
          </p>

          {/* Summary Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded bg-red-500/10 border border-red-500/20">
              Critical: {severityCounts.critical}
            </div>
            <div className="p-3 rounded bg-orange-500/10 border border-orange-500/20">
              High: {severityCounts.high}
            </div>
            <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20">
              Medium: {severityCounts.medium}
            </div>
            <div className="p-3 rounded bg-green-500/10 border border-green-500/20">
              Low: {severityCounts.low}
            </div>
          </div>

          {/* Top Attack Types */}
          <div>
            <h3 className="font-semibold mt-4 mb-2">Top Attack Types</h3>
            <ul className="list-disc list-inside text-sm text-gray-300">
              {topAttackTypes.map(([type, count]) => (
                <li key={type}>
                  {type}: {count}
                </li>
              ))}
            </ul>
          </div>

          {/* Recent Attacks */}
          <div>
            <h3 className="font-semibold mt-4 mb-2">Recent Attacks</h3>
            <table className="w-full text-sm border border-gray-700">
              <thead className="bg-gray-800">
                <tr>
                  <th className="p-2 border border-gray-700">Time</th>
                  <th className="p-2 border border-gray-700">Source</th>
                  <th className="p-2 border border-gray-700">Destination</th>
                  <th className="p-2 border border-gray-700">Type</th>
                  <th className="p-2 border border-gray-700">Severity</th>
                  <th className="p-2 border border-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {attacks.slice(0, 10).map(attack => (
                  <tr key={attack.id} className="text-gray-300">
                    <td className="p-2 border border-gray-700">
                      {new Date(attack.timestamp || Date.now()).toLocaleTimeString()}
                    </td>
                    <td className="p-2 border border-gray-700">
                      {attack.source_ip || 'Unknown'}
                    </td>
                    <td className="p-2 border border-gray-700">
                      {attack.destination_ip || 'Unknown'}
                    </td>
                    <td className="p-2 border border-gray-700">
                      {attack.attack_type || 'Unknown'}
                    </td>
                    <td className="p-2 border border-gray-700">
                      {attack.severity || 'Unknown'}
                    </td>
                    <td className="p-2 border border-gray-700">
                      {attack.status || 'Unknown'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttackDetection;