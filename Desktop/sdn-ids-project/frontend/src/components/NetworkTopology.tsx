import React, { useState, useEffect } from 'react';
import { 
  Network, 
  Server, 
  Router, 
  MonitorSpeaker,
  Activity,
  AlertCircle,
  CheckCircle,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import ryuClient, { NetworkTopology as TopologyData, Switch } from '../services/ryuClient';

interface NetworkNode {
  id: string;
  label: string;
  type: 'switch' | 'host' | 'controller';
  status: 'active' | 'inactive' | 'warning';
  ip: string;
  ports: number;
  connections: number;
}

export const NetworkTopology: React.FC = () => {
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [ryuConnectionStatus, setRyuConnectionStatus] = useState<{ status: string; connected: boolean; message: string }>({
    status: 'disconnected',
    connected: false,
    message: 'Cannot connect to Ryu'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hosts, setHosts] = useState<any[]>([]);
  const [hostsLoading, setHostsLoading] = useState(false);
  const [hostsError, setHostsError] = useState<string | null>(null);

  // --- Fetch hosts from backend via /v1.0/hosts
  const fetchHosts = async (retryCount = 0) => {
    const maxRetries = 3;
    
    try {
      setHostsLoading(true);
      setHostsError(null);
      
      const res = await fetch("/api/topology/hosts");
      if (!res.ok) {
        throw new Error(`Backend error: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (data.success && Array.isArray(data.data)) {
        setHosts(data.data);
        console.log(`✅ Loaded ${data.count} hosts from backend`);
        return data.data; // ✅ Return data để sử dụng
      } else {
        throw new Error(data.message || 'Invalid response format');
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error fetching hosts (attempt ${retryCount + 1}):`, errorMsg);
      
      if (retryCount < maxRetries) {
        console.log(`🔄 Retrying in 2 seconds... (${retryCount + 1}/${maxRetries})`);
        setTimeout(() => fetchHosts(retryCount + 1), 2000);
        return []; // ✅ Return empty array khi retry
      } else {
        setHostsError(errorMsg);
        setHosts([]);
        throw error; // ✅ Throw error để loadTopologyData có thể handle
      }
    } finally {
      setHostsLoading(false);
    }
  };

  useEffect(() => {
    // Connect Ryu client
    ryuClient.connect();

    // Event listeners
    ryuClient.on('topology_updated', (topologyData: TopologyData) => {
      updateNodesFromTopology(topologyData);
    });

    ryuClient.on('switch_connected', (sw: Switch) => console.log('Switch connected:', sw));
    ryuClient.on('switch_disconnected', (data: { id: string }) => console.log('Switch disconnected:', data.id));

    // Load initial topology
    loadTopologyData();

    // Update Ryu connection status periodically from backend
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/topology/ryu-status');
        if (response.ok) {
          const ryuStatus = await response.json();
          console.log('🔍 Ryu status update from backend:', ryuStatus);
          setRyuConnectionStatus({
            status: ryuStatus.status,
            connected: ryuStatus.connected,
            message: ryuStatus.message
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (error) {
        console.error('❌ Failed to get Ryu status from backend:', error);
        setRyuConnectionStatus({ 
          status: 'disconnected', 
          connected: false, 
          message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    }, 10000); // Tăng từ 5000 lên 10000 (10 giây)

    return () => {
      clearInterval(interval);
      ryuClient.disconnect();
    };
  }, []);

  // --- Load topology + hosts
  const loadTopologyData = async () => {
    try {
      setIsLoading(true);
      setHostsError(null); // ✅ Reset error state
      
      // Get topology data from backend API for consistent status
      const [topologyResponse, hostsData] = await Promise.all([
        fetch('/api/topology'),
        fetchHosts()
      ]);
      
      if (!topologyResponse.ok) {
        throw new Error(`Topology API error: ${topologyResponse.status}`);
      }
      
      const topologyData = await topologyResponse.json();
      
      // Update Ryu connection status from backend
      if (topologyData.ryuConnection) {
        setRyuConnectionStatus({
          status: topologyData.ryuConnection.status,
          connected: topologyData.ryuConnection.connected,
          message: topologyData.ryuConnection.connected ? 'Connected to Ryu' : 'Cannot connect to Ryu'
        });
      }
      
      // Convert backend topology format to frontend format
      const frontendTopologyData = {
        switches: topologyData.switches || [],
        hosts: topologyData.hosts || [],
        links: topologyData.links || []
      };
      
      updateNodesFromTopology(frontendTopologyData);
    } catch (error) {
      console.error('Error loading topology data:', error);
      setHostsError('Failed to load topology data');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Map topology + hosts to nodes
  const updateNodesFromTopology = (topologyData: TopologyData) => {
    const newNodes: NetworkNode[] = [];

    // Controller - Use backend status for consistency
    newNodes.push({
      id: 'controller',
      label: 'Ryu Controller',
      type: 'controller',
      status: ryuConnectionStatus.connected ? 'active' : 'inactive',
      ip: 'localhost:8080',
      ports: 1,
      connections: topologyData.switches.length
    });

    // Switches - Handle both backend and frontend formats
    topologyData.switches.forEach((sw: any) => {
      newNodes.push({
        id: sw.id || sw.dpid,
        label: sw.label || `Switch ${sw.id || sw.dpid}`,
        type: 'switch',
        status: (sw.connected !== undefined ? sw.connected : sw.status === 'active') ? 'active' : 'inactive',
        ip: sw.ip_address || sw.description?.ip || 'Unknown',
        ports: sw.port_count || sw.ports?.length || 0,
        connections: sw.ports ? sw.ports.filter((p: any) => p.state === 1).length : 0
      });
    });

    // Hosts - Handle both backend and frontend formats
    const hostsData = hosts.length > 0 ? hosts : topologyData.hosts || [];
    const hostsWithIPv4 = hostsData.filter((host: any) => {
      // Handle different host formats (backend vs frontend)
      let ipv4Address = null;
      
      if (Array.isArray(host.ipv4) && host.ipv4.length > 0) {
        // Frontend format
        ipv4Address = host.ipv4[0];
      } else if (host.ip_address && host.ip_address !== 'Unknown') {
        // Backend format
        ipv4Address = host.ip_address;
      } else {
        return false;
      }
      
      // ✅ Filter out specific unwanted host IP
      if (ipv4Address === '192.168.20.128') {
        console.log(`🚫 Frontend filtering out host with IP: ${ipv4Address}`);
        return false;
      }
      
      // ✅ Loại bỏ các giá trị không hợp lệ
      if (!ipv4Address || 
          ipv4Address === 'unknown' || 
          ipv4Address === 'Unknown IP' || 
          ipv4Address === '0.0.0.0' ||
          ipv4Address === '127.0.0.1' ||
          ipv4Address === 'localhost') {
        return false;
      }

      // ✅ Kiểm tra format IPv4 cơ bản
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      return ipv4Regex.test(ipv4Address);
    });

    console.log(`🔍 Total hosts: ${hostsData.length}, Hosts with valid IPv4: ${hostsWithIPv4.length}`);

    hostsWithIPv4.forEach((host: any) => {
      const hostIp = Array.isArray(host.ipv4) ? host.ipv4[0] : host.ip_address;
      newNodes.push({
        id: host.mac,
        label: `Host ${host.mac.slice(-6)}`,
        type: 'host',
        status: 'active',
        ip: hostIp,
        ports: 1,
        connections: 1
      });
    });

    setNodes(newNodes);
  };

  // --- Refresh button
  const refreshData = async () => {
    await loadTopologyData();
  };

  // --- Helpers
  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'controller': return MonitorSpeaker;
      case 'switch': return Router;
      case 'host': return Server;
      default: return Network;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'warning': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'inactive': return 'text-red-400 bg-red-400/10 border-red-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className="flex items-center justify-between">
        <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
          ryuConnectionStatus.connected ? 'bg-green-400/10 text-green-400' :
          ryuConnectionStatus.status === 'connecting' ? 'bg-yellow-400/10 text-yellow-400' :
          'bg-red-400/10 text-red-400'
        }`}>
          {ryuConnectionStatus.connected ? (
            <CheckCircle size={16} />
          ) : ryuConnectionStatus.status === 'connecting' ? (
            <RefreshCw size={16} className="animate-spin" />
          ) : (
            <WifiOff size={16} />
          )}
          <span className="text-sm font-medium">{ryuConnectionStatus.message}</span>
          {/* ✅ Thêm debug info */}
          <span className="text-xs opacity-70">({ryuConnectionStatus.status})</span>
        </div>

        <div className="flex space-x-2">
          {/* ✅ Thêm debug button */}
          <button
            onClick={async () => {
              const status = await ryuClient.getRyuConnectionStatus();
              console.log('🔍 Manual status check:', status);
              alert(JSON.stringify(status, null, 2));
            }}
            className="text-xs bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded"
          >
            Debug
          </button>
          
          <button
            onClick={refreshData}
            disabled={isLoading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Topology Stats */}
      {hostsError && (
        <div className="bg-red-800/50 backdrop-blur-sm rounded-xl p-4 border border-red-700">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">Hosts error: {hostsError}</span>
            <button 
              onClick={() => loadTopologyData()} 
              className="text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {['switch', 'host', 'controller', 'total'].map((type, idx) => (
          <div key={idx} className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <div className="flex items-center space-x-3">
              {{
                switch: <Router className="text-blue-400" size={24} />,
                host: <Server className="text-purple-400" size={24} />,
                controller: <MonitorSpeaker className="text-green-400" size={24} />,
                total: <Activity className="text-cyan-400" size={24} />
              }[type]}
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {type === 'total' ? nodes.length : nodes.filter(n => n.type === type).length}
                </h3>
                <p className={`font-medium ${
                  type === 'switch' ? 'text-blue-400' :
                  type === 'host' ? 'text-purple-400' :
                  type === 'controller' ? 'text-green-400' : 'text-cyan-400'
                }`}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}{type==='total'?' Nodes':''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ Thêm hosts filter info */}
      <div className="bg-blue-800/20 backdrop-blur-sm rounded-xl p-4 border border-blue-700">
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center space-x-2">
            <Server className="text-purple-400" size={16} />
            <span className="text-white">Hosts with IPv4:</span>
            <span className="text-purple-400 font-mono">
              {nodes.filter(n => n.type === 'host').length}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Router className="text-blue-400" size={16} />
            <span className="text-white">Switches:</span>
            <span className="text-blue-400 font-mono">
              {nodes.filter(n => n.type === 'switch').length}
            </span>
          </div>
        </div>
      </div>

      {/* Topology Visualization + Node Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visualization */}
        <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 relative min-h-[500px]">
          {/* Controller */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
            <div 
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${getStatusColor('active')}`}
              onClick={() => setSelectedNode(nodes.find(n => n.type === 'controller') || null)}
            >
              <MonitorSpeaker size={32} className="mx-auto text-green-400" />
              <p className="text-xs text-center mt-2 text-white">Controller</p>
            </div>
          </div>

          {/* Switches */}
          <div className="absolute top-32 left-0 right-0 flex justify-around">
            {nodes.filter(n => n.type === 'switch').map(node => {
              const Icon = getNodeIcon(node.type);
              return (
                <div key={node.id} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${getStatusColor(node.status)}`} onClick={() => setSelectedNode(node)}>
                  <Icon size={28} className="mx-auto" />
                  <p className="text-xs text-center mt-2 text-white">{node.label}</p>
                </div>
              );
            })}
          </div>

          {/* Hosts */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-around">
            {nodes.filter(n => n.type === 'host').map(node => {
              const Icon = getNodeIcon(node.type);
              return (
                <div key={node.id} className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${getStatusColor(node.status)}`} onClick={() => setSelectedNode(node)}>
                  <Icon size={24} className="mx-auto" />
                  <p className="text-xs text-center mt-2 text-white">{node.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Node Details */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 min-h-[500px]">
          <h3 className="text-lg font-semibold text-white mb-6">Node Details</h3>
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                {React.createElement(getNodeIcon(selectedNode.type), { size: 32, className: 'text-blue-400' })}
                <div>
                  <h4 className="text-white font-semibold">{selectedNode.label}</h4>
                  <p className="text-gray-400 text-sm">{selectedNode.type.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status:</span>
                  <div className="flex items-center space-x-2">
                    {selectedNode.status === 'active' ? <CheckCircle size={16} className="text-green-400" /> : <AlertCircle size={16} className="text-red-400" />}
                    <span className="text-white capitalize">{selectedNode.status}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IP Address:</span>
                  <span className="text-white font-mono">{selectedNode.ip}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Ports:</span>
                  <span className="text-white">{selectedNode.ports}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Connections:</span>
                  <span className="text-white">{selectedNode.connections}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 mt-20">
              <Network size={48} className="mx-auto mb-4 opacity-50" />
              <p>Click on a node to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
