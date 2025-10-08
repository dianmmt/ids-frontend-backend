// frontend/src/services/ryuClients.js
import { io, Socket } from 'socket.io-client';

export interface Switch {
  id: string;
  ports: Port[];
  connected: boolean;
  lastSeen: string;
  description?: {
    ip?: string;
    [key: string]: any;
  };
  flow_count?: number;
}

export interface Port {
  port_no: number;
  hw_addr: string;
  name: string;
  config: number;
  state: number;
  curr: number;
  advertised: number;
  supported: number;
  peer: number;
  curr_speed: number;
  max_speed: number;
}

export interface Flow {
  dpid: string;
  match: any;
  actions: any[];
  priority: number;
  packet_count: number;
  byte_count: number;
  duration_sec: number;
  duration_nsec: number;
  timestamp: string;
}

export interface Host {
  mac: string;
  ipv4?: string[];
  dpid?: number;
  port?: number;
  [key: string]: any;
}

export interface Controller {
  id: string;
  connected: boolean;
  [key: string]: any;
}

export interface Link {
  src: {
    dpid: string;
    port_no: number;
  };
  dst: {
    dpid: string;
    port_no: number;
  };
}

export interface NetworkTopology {
  switches: Switch[];
  hosts: Host[];
  controllers: Controller[];
  links: Link[];
  timestamp: number;
}

export interface FlowRule {
  dpid: string;
  match: any;
  actions: any[];
  priority?: number;
  idle_timeout?: number;
  hard_timeout?: number;
}

export interface ConnectionStatus {
  status: string;
  connected: boolean;
  message: string;
}

class RyuClient {
  private socket: Socket | null = null;
  private apiBaseUrl: string;
  private eventHandlers: Map<string, Function[]> = new Map();
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(serverUrl: string = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001') {
    this.apiBaseUrl = serverUrl;
    if (!serverUrl) {
      console.warn("⚠️ VITE_API_BASE_URL is not set, defaulting to http://localhost:3001");
    }
  }

  // =====================
  // CONNECTION MANAGEMENT
  // =====================

  // Connect to the backend server via Socket.IO
  connect() {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.apiBaseUrl);

    this.socket.on('connect', () => {
      console.log('Connected to SDN-IDS server');
      this.emit('client_connected', { timestamp: new Date().toISOString() });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from SDN-IDS server');
    });

    // Forward socket events
    this.socket.on('topology_update', (topology: NetworkTopology) => {
      this.emit('topology_updated', topology);
    });

    this.socket.on('flow_stats_update', (flows: Flow[]) => {
      this.emit('flows_updated', flows);
    });

    this.socket.on('switch_connected', (switchInfo: Switch) => {
      this.emit('switch_connected', switchInfo);
    });

    this.socket.on('switch_disconnected', (data: { id: string }) => {
      this.emit('switch_disconnected', data);
    });

    this.socket.on('port_stats_update', (stats: any[]) => {
      this.emit('port_stats_updated', stats);
    });

    this.socket.on('security_policy_updated', (policy: any) => {
      this.emit('security_policy_updated', policy);
    });

    this.socket.on('flow_rule_added', (response: any) => {
      this.emit('flow_rule_added', response);
    });

    this.socket.on('flow_rule_error', (error: any) => {
      this.emit('flow_rule_error', error);
    });

    this.socket.on('host_detected', (host: Host) => {
      this.emit('host_detected', host);
    });
  }

  // WebSocket connection for additional real-time updates
  connectWebSocket(): void {
    try {
      const wsUrl = this.apiBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://');
      this.ws = new WebSocket(`${wsUrl}/ws/topology`);
      
      this.ws.onopen = () => {
        console.log('Connected to topology WebSocket');
        this.reconnectAttempts = 0;
        this.emit('websocket_connected', {});
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('Topology WebSocket connection closed');
        this.emit('websocket_disconnected', {});
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('Topology WebSocket error:', error);
        this.emit('websocket_error', { error });
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
    }
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'topology_updated':
        this.emit('topology_updated', data.payload);
        break;
      case 'switch_connected':
        this.emit('switch_connected', data.payload);
        break;
      case 'switch_disconnected':
        this.emit('switch_disconnected', data.payload);
        break;
      case 'host_detected':
        this.emit('host_detected', data.payload);
        break;
      case 'flow_added':
        this.emit('flow_added', data.payload);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect WebSocket (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connectWebSocket();
      }, this.reconnectDelay);
    } else {
      console.log('Max WebSocket reconnection attempts reached');
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // =====================
  // EVENT HANDLING
  // =====================

  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler?: Function) {
    if (!handler) {
      this.eventHandlers.delete(event);
    } else {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // =====================
  // HTTP API METHODS
  // =====================

  async getTopology(): Promise<NetworkTopology> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/topology`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      return {
        switches: data.switches || [],
        hosts: data.hosts || [],
        controllers: data.controllers || [],
        links: data.links || [],
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error fetching topology:', error);
      return { switches: [], links: [], hosts: [], controllers: [], timestamp: Date.now() };
    }
  }

  async getSwitches(): Promise<Switch[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/switches`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.data || data || [];
    } catch (error) {
      console.error('Error fetching switches:', error);
      return [];
    }
  }

  async getHosts(): Promise<Host[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/hosts`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching hosts:', error);
      return [];
    }
  }

  async getFlows(): Promise<Flow[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching flows:', error);
      return [];
    }
  }

  async getFlowStats(dpid: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows/${dpid}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error fetching flow stats:', error);
      return [];
    }
  }

  async addFlowRule(flowRule: FlowRule): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowRule),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error adding flow rule:', error);
      return { success: false, error: 'Failed to add flow rule' };
    }
  }

  async deleteFlowRule(dpid: string, match: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows/${dpid}/${encodeURIComponent(JSON.stringify(match))}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error deleting flow rule:', error);
      return { success: false, error: 'Failed to delete flow rule' };
    }
  }

  async getSwitchStats(dpid: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/switches/${dpid}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching switch stats:', error);
      return {};
    }
  }

  async getPortStats(dpid: string): Promise<Port[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/switches/${dpid}/ports`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching port stats:', error);
      return [];
    }
  }

  // =====================
  // SOCKET METHODS
  // =====================

  addFlowRuleSocket(flowRule: FlowRule) {
    if (this.socket) {
      this.socket.emit('add_flow_rule', flowRule);
    }
  }

  updateSecurityPolicy(policy: any) {
    if (this.socket) {
      this.socket.emit('update_security_policy', policy);
    }
  }

  // =====================
  // SECURITY HELPERS
  // =====================

  async blockIP(dpid: string, ipAddress: string, priority: number = 1000) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/security/block-ip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dpid,
          ip_address: ipAddress,
          priority
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error blocking IP:', error);
      // Fallback to direct flow rule method
      const flowRule: FlowRule = {
        dpid,
        match: { ipv4_src: ipAddress },
        actions: [], // drop
        priority
      };
      return await this.addFlowRule(flowRule);
    }
  }

  async blockPort(dpid: string, port: number, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match: { tcp_dst: port },
      actions: [], // drop
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  async redirectTraffic(dpid: string, match: any, outputPort: number, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match,
      actions: [{ type: 'OUTPUT', port: outputPort }],
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  async setRateLimit(dpid: string, match: any, rate: number, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match,
      actions: [{ type: 'METER', meter_id: 1 }],
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  // =====================
  // UTILITY METHODS
  // =====================

  async refreshTopology(): Promise<NetworkTopology> {
    try {
      return await this.getTopology();
    } catch (error) {
      console.error('Error refreshing topology:', error);
      throw error;
    }
  }

  async detectHosts(): Promise<Host[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/hosts/detect`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Error detecting hosts:', error);
      return [];
    }
  }

  // =====================
  // STATUS HELPERS
  // =====================

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }

  async getRyuConnectionStatus(): Promise<ConnectionStatus> {
    try {
      // ✅ Thử relative URL trước
      const response = await fetch('/api/topology/ryu-status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('🔍 Ryu status response:', data);
      
      return {
        status: data.status || 'unknown',
        connected: data.connected || false,
        message: data.message || 'Unknown status'
      };
    } catch (error) {
      console.error('❌ Error checking Ryu connection status:', error);
      
      // ✅ Fallback: thử direct URL nếu proxy fail
      try {
        const fallbackResponse = await fetch(`${this.apiBaseUrl}/api/topology/ryu-status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log('🔍 Fallback Ryu status response:', fallbackData);
          return {
            status: fallbackData.status || 'unknown',
            connected: fallbackData.connected || false,
            message: fallbackData.message || 'Unknown status'
          };
        }
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
      }
      
      return { 
        status: 'disconnected', 
        connected: false, 
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // WebSocket status
  isWebSocketConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Singleton export
const ryuClient = new RyuClient((import.meta as any).env?.VITE_API_BASE_URL);
export default ryuClient;