import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  AlertTriangle,
  Clock,
  Filter,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Trash2
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
  const [searchIp, setSearchIp] = useState('');
  const [searchAttackType, setSearchAttackType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [activeModels, setActiveModels] = useState<ActiveModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [isTestingModel, setIsTestingModel] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<{ip: boolean, attackType: boolean}>({ip: false, attackType: false});
  const eventsPerPage = 5;
  const reportRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Common attack types and IP patterns for suggestions
  const commonAttackTypes = [
    'DDoS', 'SQL Injection', 'XSS', 'Brute Force', 'Port Scan',
    'Malware', 'Phishing', 'Ransomware', 'Botnet', 'Anomaly'
  ];

  const commonIpPatterns = [
    '192.168.', '10.0.', '172.16.', '127.0.0.1', '0.0.0.0'
  ];

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Error loading recent searches:', e);
      }
    }
  }, []);

  // Save recent searches to localStorage
  const saveRecentSearch = (search: string) => {
    if (!search.trim()) return;
    
    const updated = [search, ...recentSearches.filter(s => s !== search)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));
  };

  // Clear all search filters
  const clearAllSearches = () => {
    setSearchTerm('');
    setSearchIp('');
    setSearchAttackType('');
    setFilterSeverity('all');
    setCurrentPage(1);
  };

  // Persist selected model to localStorage for header display
  useEffect(() => {
    if (!selectedModelId) {
      localStorage.removeItem('selectedModelId');
      localStorage.removeItem('selectedModelName');
      return;
    }
    const model = activeModels.find(m => m.id === selectedModelId);
    if (model) {
      localStorage.setItem('selectedModelId', selectedModelId);
      localStorage.setItem('selectedModelName', model.name);
    }
  }, [selectedModelId, activeModels]);

  // Fetch active models
  const fetchActiveModels = async () => {
    try {
      console.log('Fetching active models...');
      const response = await fetch('/api/models/active', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });
      console.log('Response status:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('Active models data:', data);
        const active = data.models || [];
        console.log('Active models:', active);
        setActiveModels(active);
        if (active.length > 0 && !selectedModelId) {
          setSelectedModelId(active[0].id);
        }
      } else {
        console.error('Failed to fetch active models:', response.status, response.statusText);
      }
    } catch (err) {
      console.error('Failed to fetch active models:', err);
    }
  };

  // Save user's model selection
  const saveModelSelection = async (modelId: string) => {
    try {
      const response = await fetch(`/api/models/${modelId}/select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        },
        body: JSON.stringify({ selection_type: 'primary' })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Model selection saved:', result);
      } else {
        console.error('Failed to save model selection');
      }
    } catch (error) {
      console.error('Error saving model selection:', error);
    }
  };

  // Test selected model with different data types
  const testSelectedModel = async () => {
    if (!selectedModelId) {
      alert('Please select a model first');
      return;
    }

    setIsTestingModel(true);
    
    // Save the model selection first
    await saveModelSelection(selectedModelId);

    try {
      // Test with CSV data (77 features)
      const response = await fetch('/api/ml/test-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`,
          'X-User-ID': localStorage.getItem('userId') || '1',
          'X-Model-Selection-Type': selectedModelId
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        const result = await response.json();
        
        // Get model name for display
        const selectedModel = activeModels.find(m => m.id === selectedModelId);
        const modelDisplayName = result.model_name || selectedModel?.name || 'Unknown Model';
        
        // Create detailed notification message
        let message = `🤖 Model Test Results\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📊 Model: ${modelDisplayName}\n`;
        message += `📋 Test Type: CSV Data (77 features)\n`;
        message += `🔍 Predicted Class: ${result.prediction || 'Unknown'}\n`;
        message += `🎯 Is Attack: ${result.is_malicious ? '⚠️ YES' : '✅ NO'}\n`;
        message += `⚡ Severity: ${result.severity || 'N/A'}\n`;
        message += `⏱️ Inference Time: ${result.inference_time || 'N/A'}ms\n`;
        
        // Show CSV specific info if available
        if (result.csv_row_index !== undefined) {
          message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
          message += `📋 CSV Data Details:\n`;
          message += `• Row Index: ${result.csv_row_index}\n`;
          message += `• Features Used: ${result.features_used || 77}/77\n`;
          if (result.features_extracted) {
            message += `• Extraction: ${result.features_extracted}\n`;
          }
        }
        
        // Show probabilities if available
        if (result.probabilities && Object.keys(result.probabilities).length > 0) {
          message += `\n🎲 Class Probabilities:\n`;
          Object.entries(result.probabilities)
            .sort(([,a], [,b]) => (b as number) - (a as number)) // Sort by probability desc
            .forEach(([type, prob]) => {
              message += `• ${type}: ${((prob as number) * 100).toFixed(1)}%\n`;
            });
        }
        
        alert(message);
      } else {
        // Parse error response for more details
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || 'Failed to test model';
        
        // Get model name for error display
        const selectedModel = activeModels.find(m => m.id === selectedModelId);
        const modelDisplayName = selectedModel?.name || 'Unknown Model';
        
        // Provide more detailed error guidance
        let detailedMessage = `❌ Model Test Failed\n`;
        detailedMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        detailedMessage += `📊 Model: ${modelDisplayName}\n`;
        detailedMessage += `📋 Test Type: CSV Data (77 features)\n`;
        detailedMessage += `🚫 Error: ${errorMessage}\n\n`;
        detailedMessage += "🔍 Possible reasons:\n";
        detailedMessage += "1. CSV file not found or inaccessible\n";
        detailedMessage += "2. CSV file format issues\n";
        detailedMessage += "3. Insufficient features in CSV (need 77)\n";
        detailedMessage += "4. Model not compatible with CSV data\n";
        detailedMessage += "5. ML service not running\n";
        detailedMessage += "6. Authentication issues\n";
        detailedMessage += "7. Network connectivity problem\n\n";
        detailedMessage += "💡 Recommended actions:\n";
        detailedMessage += "- Check CSV file path and permissions\n";
        detailedMessage += "- Verify CSV has all 77 required features\n";
        detailedMessage += "- Check Model Management page\n";
        detailedMessage += "- Verify model is activated and loaded\n";
        detailedMessage += "- Restart ML services\n";
        detailedMessage += "- Check your network connection";

        alert(detailedMessage);
        console.error('Model test error:', errorData);
      }
    } catch (err) {
      console.error('Model test error:', err);
      
      // Get model name for error display
      const selectedModel = activeModels.find(m => m.id === selectedModelId);
      const modelDisplayName = selectedModel?.name || 'Unknown Model';
      
      let errorMessage = `❌ Error Testing Model\n`;
      errorMessage += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      errorMessage += `📊 Model: ${modelDisplayName}\n`;
      errorMessage += `📋 Test Type: CSV Data (77 features)\n`;
      
      if (err instanceof TypeError) {
        errorMessage += '🌐 Network error. Check your connection and ML service status.';
      } else if (err instanceof Error) {
        errorMessage += `🚫 Error: ${err.message}`;
      } else {
        errorMessage += '🚫 Unknown error occurred during model testing.';
      }
      
      errorMessage += '\n\n💡 Try:\n';
      errorMessage += '- Refresh the page and try again\n';
      errorMessage += '- Check if ML service is running\n';
      errorMessage += '- Verify model is properly loaded';

      alert(errorMessage);
    } finally {
      setIsTestingModel(false);
    }
  };


  // Delete an attack permanently
  const deleteAttack = async (attackId: string) => {
    if (!confirm('Are you sure you want to permanently delete this attack? This action cannot be undone.')) {
      return;
    }

    setActionLoading(attackId);
    try {
      const response = await fetch(`/api/attacks/${attackId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
        }
      });

      if (response.ok) {
        // Remove from local state
        setAttacks(prev => prev.filter(attack => attack.id !== attackId));
      } else {
        const errorData = await response.json();
        alert(`Failed to delete attack: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting attack:', error);
      alert('Failed to delete attack. Please try again.');
    } finally {
      setActionLoading(null);
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
          id: item.event_id,
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

    // Setup SSE
    const connectSSE = () => {
      eventSourceRef.current = new EventSource('/api/attacks/stream', {
        withCredentials: true
      });

      eventSourceRef.current.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          // Handle different types of SSE messages
          if (payload.action === 'deleted') {
            setAttacks(prev => prev.filter(attack => attack.id !== payload.id));
            return;
          }
          
          // Ignore non-attack messages (e.g., connection/heartbeat) that lack a stable id
          if (!payload || !payload.id) return;

          const newAttack: AttackEvent = {
            id: payload.id,
            timestamp: payload.timestamp || new Date().toISOString(),
            source_ip: payload.source_ip || 'Unknown',
            destination_ip: payload.destination_ip || 'Unknown',
            attack_type: payload.attack_type || 'Anomaly',
            severity: payload.severity || 'low',
            confidence: payload.confidence ?? 0,
            status: payload.status || 'detected',
            probabilities: payload.probabilities || {},
            flow_data: {
              protocol: payload.flow_data?.protocol || 'Unknown',
              src_port: payload.flow_data?.src_port || 0,
              dst_port: payload.flow_data?.dst_port || 0,
              packet_count: payload.flow_data?.packet_count || 0,
              byte_count: payload.flow_data?.byte_count || 0
            }
          };

          setAttacks(prev => [newAttack, ...prev.filter(a => a.id !== newAttack.id).slice(0, 49)]);
        } catch (e) {
          // Malformed message – ignore
        }
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+C to clear all searches
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        clearAllSearches();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Enhanced filtering logic with multiple search criteria
  const filteredAttacks = attacks.filter(attack => {
    const severityMatch =
      filterSeverity === 'all' || attack.severity === filterSeverity;
  
    const source = attack.source_ip ?? "";
    const dest = attack.destination_ip ?? "";
    const type = attack.attack_type ?? "";
  
    // General search term (searches across all fields)
    const generalSearchMatch = !searchTerm || 
      source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dest.toLowerCase().includes(searchTerm.toLowerCase()) ||
      type.toLowerCase().includes(searchTerm.toLowerCase());
  
    // IP-specific search (searches both source and destination IPs)
    const ipSearchMatch = !searchIp || 
      source.toLowerCase().includes(searchIp.toLowerCase()) ||
      dest.toLowerCase().includes(searchIp.toLowerCase());
  
    // Attack type-specific search
    const attackTypeSearchMatch = !searchAttackType || 
      type.toLowerCase().includes(searchAttackType.toLowerCase());
  
    return severityMatch && generalSearchMatch && ipSearchMatch && attackTypeSearchMatch;
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

      {/* Enhanced Filters and Search */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
        <div className="space-y-4">
          {/* Search Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Search size={20} />
              <span>Search and Filter</span>
            </h3>
            <button
              onClick={clearAllSearches}
              className="text-sm text-gray-400 hover:text-white transition-colors"
              title="Clear all filters (Ctrl+Shift+C)"
            >
              Clear all filters
            </button>
          </div>

          {/* Search Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* General Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">General Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search all..."
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    if (e.target.value.trim()) {
                      saveRecentSearch(e.target.value);
                    }
                  }}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-10 pr-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* IP Address Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">IP Address</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">🌐</div>
                <input
                  type="text"
                  placeholder="192.168.1.1 or 10.0.0.0/24"
                  value={searchIp}
                  onChange={e => setSearchIp(e.target.value)}
                  onFocus={() => setShowSuggestions(prev => ({...prev, ip: true}))}
                  onBlur={() => setTimeout(() => setShowSuggestions(prev => ({...prev, ip: false})), 200)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-10 pr-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                {showSuggestions.ip && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {commonIpPatterns.map((pattern, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSearchIp(pattern);
                          setShowSuggestions(prev => ({...prev, ip: false}));
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        {pattern}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Attack Type Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Attack Type</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">⚔️</div>
                <input
                  type="text"
                  placeholder="DDoS, SQL Injection, XSS..."
                  value={searchAttackType}
                  onChange={e => setSearchAttackType(e.target.value)}
                  onFocus={() => setShowSuggestions(prev => ({...prev, attackType: true}))}
                  onBlur={() => setTimeout(() => setShowSuggestions(prev => ({...prev, attackType: false})), 200)}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg pl-10 pr-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                {showSuggestions.attackType && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                    {commonAttackTypes.map((type, index) => (
                      <button
                        key={index}
                        onClick={() => {
                          setSearchAttackType(type);
                          setShowSuggestions(prev => ({...prev, attackType: false}));
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Recent Searches</label>
              <div className="flex flex-wrap gap-2">
                {recentSearches.slice(0, 5).map((search, index) => (
                  <button
                    key={index}
                    onClick={() => setSearchTerm(search)}
                    className="px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 hover:text-white text-sm rounded-full border border-gray-600 hover:border-gray-500 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 pt-4 border-t border-gray-700">
            <div className="flex items-center space-x-2">
              <Filter size={20} className="text-gray-400" />
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Severity Levels</option>
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
                onChange={async (e) => {
                  const newModelId = e.target.value;
                  setSelectedModelId(newModelId);
                  if (newModelId) {
                    await saveModelSelection(newModelId);
                  }
                }}
                className="bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                disabled={activeModels.length === 0}
              >
                {activeModels.length === 0 ? (
                  <option value="">No active model</option>
                ) : (
                  activeModels.map(model => (
                    <option key={model.id} value={model.id}>
                      {model.name} v{model.version} ({model.framework}) - {(model.accuracy ? (model.accuracy * 100).toFixed(1) : 'N/A')}%
                    </option>
                  ))
                )}
              </select>
              
              {/* Test Button */}
              <button
                onClick={testSelectedModel}
                disabled={!selectedModelId || isTestingModel}
                className="group flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-600 disabled:to-gray-700 text-white text-sm rounded-lg transition-all duration-300 ease-in-out transform hover:scale-105 disabled:cursor-not-allowed disabled:scale-100 shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 min-w-[120px]"
                title="Test with real CSV data (77 features)"
              >
                {isTestingModel ? (
                  <>
                    <div key="spinner" className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    <span key="testing-text">Testing...</span>
                  </>
                ) : (
                  <>
                    <Shield key="shield-icon" size={18} className="text-white/80 group-hover:animate-pulse group-disabled:animate-none" />
                    <span key="test-text">Test Model</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* Search Results Summary */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div className="text-sm text-gray-400">
              {filteredAttacks.length === attacks.length ? (
                `Showing all ${attacks.length} events`
              ) : (
                `Found ${filteredAttacks.length} of ${attacks.length} events`
              )}
              {(searchTerm || searchIp || searchAttackType || filterSeverity !== 'all') && (
                <span className="ml-2 text-blue-400">
                  (filtered)
                </span>
              )}
            </div>
            <button
              onClick={handleExport}
              className="group flex items-center justify-center space-x-3 px-4 py-2 rounded-lg font-medium text-sm bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white shadow-md hover:shadow-lg transition-all duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
            >
              <Download size={18} className="text-white/80 group-hover:animate-pulse" />
              <span>Export Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attack Events List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700">
        <div className="p-6 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-white">
            Recent Attack Events
          </h3>
          <p className="text-gray-400 text-sm">
            Real-time threat detection using ML
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
                  {/* Delete Button */}
                  <button 
                    onClick={() => deleteAttack(attack.id)}
                    disabled={actionLoading === attack.id}
                    className="p-2 text-red-400 hover:text-red-300 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete attack permanently"
                  >
                    {actionLoading === attack.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-400 border-t-transparent"></div>
                    ) : (
                      <Trash2 size={16} />
                    )}
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