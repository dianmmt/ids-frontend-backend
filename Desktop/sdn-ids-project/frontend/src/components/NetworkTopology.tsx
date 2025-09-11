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

  useEffect(() => {
    // Connect to Ryu client
    ryuClient.connect();
    
    // Set up event listeners
    ryuClient.on('topology_updated', (topologyData: TopologyData) => {
      updateNodesFromTopology(topologyData);
    });

    ryuClient.on('switch_connected', (switchInfo: Switch) => {
      console.log('Switch connected:', switchInfo);
    });

    ryuClient.on('switch_disconnected', (data: { id: string }) => {
      console.log('Switch disconnected:', data.id);
    });

    // Load initial data
    loadTopologyData();

    // Update Ryu connection status
    const updateRyuConnectionStatus = async () => {
      try {
        const ryuStatus = await ryuClient.getRyuConnectionStatus();
        setRyuConnectionStatus(ryuStatus);
      } catch (error) {
        console.error('Error updating Ryu connection status:', error);
        setRyuConnectionStatus({
          status: 'disconnected',
          connected: false,
          message: 'Cannot connect to Ryu'
        });
      }
    };

    updateRyuConnectionStatus();
    const ryuStatusInterval = setInterval(updateRyuConnectionStatus, 5000);

    return () => {
      clearInterval(ryuStatusInterval);
      ryuClient.disconnect();
    };
  }, []);

  const loadTopologyData = async () => {
    try {
      setIsLoading(true);
      
      // Load topology
      const topologyData = await ryuClient.getTopology();
      updateNodesFromTopology(topologyData);
      
    } catch (error) {
      console.error('Error loading topology data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateNodesFromTopology = (topologyData: TopologyData) => {
    const newNodes: NetworkNode[] = [];
    
    // Add controller node
    newNodes.push({
      id: 'controller',
      label: 'Ryu Controller',
      type: 'controller',
      status: ryuConnectionStatus.connected ? 'active' : 'inactive',
      ip: 'localhost:8080',
      ports: 1,
      connections: topologyData.switches.length
    });

    // Add switch nodes
    topologyData.switches.forEach((switchInfo: Switch) => {
      newNodes.push({
        id: switchInfo.id,
        label: `Switch ${switchInfo.id}`,
        type: 'switch',
        status: switchInfo.connected ? 'active' : 'inactive',
        ip: switchInfo.description?.ip || 'Unknown',
        ports: switchInfo.ports.length,
        connections: switchInfo.ports.filter(p => p.state === 1).length
      });
    });

    // Add host nodes (if available)
    topologyData.hosts.forEach((host: any) => {
      newNodes.push({
        id: host.mac,
        label: `Host ${host.mac.slice(-6)}`,
        type: 'host',
        status: 'active',
        ip: host.ipv4?.[0] || 'Unknown',
        ports: 1,
        connections: 1
      });
    });

    setNodes(newNodes);
  };

  const refreshData = async () => {
    await loadTopologyData();
    // Also refresh Ryu connection status
    try {
      const ryuStatus = await ryuClient.getRyuConnectionStatus();
      setRyuConnectionStatus(ryuStatus);
    } catch (error) {
      console.error('Error refreshing Ryu connection status:', error);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'controller':
        return MonitorSpeaker;
      case 'switch':
        return Router;
      case 'host':
        return Server;
      default:
        return Network;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-400 bg-green-400/10 border-green-400/20';
      case 'warning':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'inactive':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };


  return (
    <div className="space-y-6">
      {/* Connection Status and Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
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
            <span className="text-sm font-medium">
              {ryuConnectionStatus.message}
            </span>
          </div>
          
          {isLoading && (
            <div className="flex items-center space-x-2 text-blue-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Loading...</span>
            </div>
          )}
        </div>
        
        <button
          onClick={refreshData}
          disabled={isLoading}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Topology Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Router className="text-blue-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'switch').length}
              </h3>
              <p className="text-blue-400 font-medium">Switches</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Server className="text-purple-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'host').length}
              </h3>
              <p className="text-purple-400 font-medium">Hosts</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <MonitorSpeaker className="text-green-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">
                {nodes.filter(n => n.type === 'controller').length}
              </h3>
              <p className="text-green-400 font-medium">Controllers</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center space-x-3">
            <Activity className="text-cyan-400" size={24} />
            <div>
              <h3 className="text-2xl font-bold text-white">{nodes.length}</h3>
              <p className="text-cyan-400 font-medium">Total Nodes</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Network Topology Visualization */}
        <div className="lg:col-span-2 bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Network Topology</h3>
            <div className="flex items-center space-x-2 text-green-400">
              <Activity size={16} />
              <span className="text-sm">Live</span>
            </div>
          </div>

          {/* Simplified topology visualization */}
          <div className="bg-gray-900/50 rounded-lg p-8 min-h-96 relative">
            {/* Controller at the top */}
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2">
              <div 
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${getStatusColor('active')}`}
                onClick={() => setSelectedNode(nodes.find(n => n.type === 'controller') || null)}
              >
                <MonitorSpeaker size={32} className="mx-auto text-green-400" />
                <p className="text-xs text-center mt-2 text-white">Controller</p>
              </div>
            </div>

            {/* Switches in the middle */}
            <div className="absolute top-32 left-0 right-0 flex justify-around">
              {nodes.filter(n => n.type === 'switch').map((node) => {
                const Icon = getNodeIcon(node.type);
                return (
                  <div 
                    key={node.id}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${getStatusColor(node.status)}`}
                    onClick={() => setSelectedNode(node)}
                  >
                    <Icon size={28} className="mx-auto" />
                    <p className="text-xs text-center mt-2 text-white">{node.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Hosts at the bottom */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-around">
              {nodes.filter(n => n.type === 'host').map((node) => {
                const Icon = getNodeIcon(node.type);
                return (
                  <div 
                    key={node.id}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${getStatusColor(node.status)}`}
                    onClick={() => setSelectedNode(node)}
                  >
                    <Icon size={24} className="mx-auto" />
                    <p className="text-xs text-center mt-2 text-white">{node.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Connection lines visualization placeholder */}
            <div className="absolute inset-0 pointer-events-none">
              {/* SVG lines would be drawn here in a real implementation */}
            </div>
          </div>
        </div>

        {/* Node Details Panel */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
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
                    {selectedNode.status === 'active' ? (
                      <CheckCircle size={16} className="text-green-400" />
                    ) : (
                      <AlertCircle size={16} className="text-red-400" />
                    )}
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

              {selectedNode.type === 'switch' && (
                <div className="mt-6">
                  <h5 className="text-white font-semibold mb-3">Flow Table Stats</h5>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Active Flows:</span>
                      <span className="text-white">127</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Packet Count:</span>
                      <span className="text-white">45,892</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Byte Count:</span>
                      <span className="text-white">2.3 MB</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400">
              <Network size={48} className="mx-auto mb-4 opacity-50" />
              <p>Click on a node to view details</p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};