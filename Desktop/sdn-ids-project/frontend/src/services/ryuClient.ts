import { io, Socket } from 'socket.io-client';

export interface Switch {
  id: string;
  ports: Port[];
  connected: boolean;
  lastSeen: string;
  description?: any;
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

export interface NetworkTopology {
  switches: Switch[];
  links: any[];
  hosts: any[];
}

export interface FlowRule {
  dpid: string;
  match: any;
  actions: any[];
  priority?: number;
  idle_timeout?: number;
  hard_timeout?: number;
}

class RyuClient {
  private socket: Socket | null = null;
  private apiBaseUrl: string;
  private eventHandlers: Map<string, Function[]> = new Map();

  constructor(serverUrl: string = 'http://localhost:3001') {
    this.apiBaseUrl = serverUrl;
  }

  // Connect to the backend server
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

    // Handle topology updates
    this.socket.on('topology_update', (topology: NetworkTopology) => {
      this.emit('topology_updated', topology);
    });

    // Handle flow statistics updates
    this.socket.on('flow_stats_update', (flows: Flow[]) => {
      this.emit('flows_updated', flows);
    });

    // Handle switch events
    this.socket.on('switch_connected', (switchInfo: Switch) => {
      this.emit('switch_connected', switchInfo);
    });

    this.socket.on('switch_disconnected', (data: { id: string }) => {
      this.emit('switch_disconnected', data);
    });

    // Handle port statistics updates
    this.socket.on('port_stats_update', (stats: any[]) => {
      this.emit('port_stats_updated', stats);
    });

    // Handle security policy updates
    this.socket.on('security_policy_updated', (policy: any) => {
      this.emit('security_policy_updated', policy);
    });

    // Handle flow rule responses
    this.socket.on('flow_rule_added', (response: any) => {
      this.emit('flow_rule_added', response);
    });

    this.socket.on('flow_rule_error', (error: any) => {
      this.emit('flow_rule_error', error);
    });
  }

  // Disconnect from the server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Event handling
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

  // API Methods

  // Get network topology
  async getTopology(): Promise<NetworkTopology> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/topology`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching topology:', error);
      return { switches: [], links: [], hosts: [] };
    }
  }

  // Get connected switches
  async getSwitches(): Promise<Switch[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/switches`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching switches:', error);
      return [];
    }
  }

  // Get flow statistics
  async getFlows(): Promise<Flow[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching flows:', error);
      return [];
    }
  }

  // Add flow rule
  async addFlowRule(flowRule: FlowRule): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(flowRule),
      });
      return await response.json();
    } catch (error) {
      console.error('Error adding flow rule:', error);
      return { success: false, error: 'Failed to add flow rule' };
    }
  }

  // Delete flow rule
  async deleteFlowRule(dpid: string, match: any): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/flows/${dpid}/${encodeURIComponent(JSON.stringify(match))}`, {
        method: 'DELETE',
      });
      return await response.json();
    } catch (error) {
      console.error('Error deleting flow rule:', error);
      return { success: false, error: 'Failed to delete flow rule' };
    }
  }

  // Get switch statistics
  async getSwitchStats(dpid: string): Promise<any> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/switches/${dpid}/stats`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching switch stats:', error);
      return {};
    }
  }

  // Get port statistics
  async getPortStats(dpid: string): Promise<Port[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/switches/${dpid}/ports`);
      return await response.json();
    } catch (error) {
      console.error('Error fetching port stats:', error);
      return [];
    }
  }

  // Socket.IO Methods

  // Add flow rule via socket
  addFlowRuleSocket(flowRule: FlowRule) {
    if (this.socket) {
      this.socket.emit('add_flow_rule', flowRule);
    }
  }

  // Update security policy
  updateSecurityPolicy(policy: any) {
    if (this.socket) {
      this.socket.emit('update_security_policy', policy);
    }
  }

  // Security-specific methods

  // Block IP address
  async blockIP(dpid: string, ipAddress: string, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match: { ipv4_src: ipAddress },
      actions: [], // Drop packet
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  // Block port
  async blockPort(dpid: string, port: number, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match: { tcp_dst: port },
      actions: [], // Drop packet
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  // Redirect traffic
  async redirectTraffic(dpid: string, match: any, outputPort: number, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match,
      actions: [{ type: 'OUTPUT', port: outputPort }],
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  // Rate limiting
  async setRateLimit(dpid: string, match: any, rate: number, priority: number = 1000) {
    const flowRule: FlowRule = {
      dpid,
      match,
      actions: [{ type: 'METER', meter_id: 1 }],
      priority
    };
    return await this.addFlowRule(flowRule);
  }

  // Utility methods

  // Check if connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Get connection status
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' {
    if (!this.socket) return 'disconnected';
    if (this.socket.connected) return 'connected';
    return 'connecting';
  }
}

// Create and export a singleton instance
const ryuClient = new RyuClient();
export default ryuClient;

