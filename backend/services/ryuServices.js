import axios from 'axios';
import { WebSocket } from 'ws';

class RyuService {
  constructor(host = 'localhost', port = 8080, wsPort = 8080) {
    this.host = host;
    this.port = port;
    this.wsPort = wsPort;
    this.baseUrl = `http://${host}:${port}`;
    this.wsUrl = `ws://${host}:${wsPort}/ws/controller`;
    this.ws = null;
    this.isConnected = false;
    this.eventHandlers = new Map();
  }

  // Connect to Ryu controller
  async connect() {
    try {
      // Test HTTP connection
      const response = await axios.get(`${this.baseUrl}/stats/switches`);
      console.log('Ryu HTTP API is accessible');
      
      // Connect WebSocket
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.on('open', () => {
        console.log('Connected to Ryu WebSocket');
        this.isConnected = true;
        this.subscribeToEvents();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data);
      });

      this.ws.on('close', () => {
        console.log('Ryu WebSocket connection closed');
        this.isConnected = false;
        // Attempt to reconnect
        setTimeout(() => this.connect(), 5000);
      });

      this.ws.on('error', (error) => {
        console.error('Ryu WebSocket error:', error);
        this.isConnected = false;
      });

      return true;
    } catch (error) {
      console.error('Failed to connect to Ryu controller:', error.message);
      return false;
    }
  }

  // Subscribe to OpenFlow events
  subscribeToEvents() {
    if (this.ws && this.isConnected) {
      const subscription = {
        type: 'subscribe',
        events: [
          'switch_enter',
          'switch_leave', 
          'flow_stats_reply',
          'port_stats_reply',
          'packet_in',
          'port_status'
        ]
      };
      this.ws.send(JSON.stringify(subscription));
    }
  }

  // Handle incoming messages from Ryu
  handleMessage(data) {
    try {
      const message = JSON.parse(data);
      const handler = this.eventHandlers.get(message.type);
      if (handler) {
        handler(message);
      }
    } catch (error) {
      console.error('Error parsing Ryu message:', error);
    }
  }

  // Register event handlers
  on(event, handler) {
    this.eventHandlers.set(event, handler);
  }

  // Get all switches
  async getSwitches() {
    try {
      const response = await axios.get(`${this.baseUrl}/stats/switches`);
      return response.data;
    } catch (error) {
      console.error('Error getting switches:', error);
      return [];
    }
  }

  // Get flow statistics for a switch
  async getFlowStats(dpid) {
    try {
      const response = await axios.get(`${this.baseUrl}/stats/flow/${dpid}`);
      return response.data[dpid] || [];
    } catch (error) {
      console.error('Error getting flow stats:', error);
      return [];
    }
  }

  // Get port statistics for a switch
  async getPortStats(dpid) {
    try {
      const response = await axios.get(`${this.baseUrl}/stats/port/${dpid}`);
      return response.data[dpid] || [];
    } catch (error) {
      console.error('Error getting port stats:', error);
      return [];
    }
  }

  // Add flow rule
  async addFlowRule(dpid, match, actions, priority = 1000, idleTimeout = 0, hardTimeout = 0) {
    try {
      const flowRule = {
        dpid: parseInt(dpid),
        match: match,
        actions: actions,
        priority: priority,
        idle_timeout: idleTimeout,
        hard_timeout: hardTimeout
      };

      const response = await axios.post(`${this.baseUrl}/stats/flowentry/add`, flowRule);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error adding flow rule:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete flow rule
  async deleteFlowRule(dpid, match) {
    try {
      const flowRule = {
        dpid: parseInt(dpid),
        match: match
      };

      const response = await axios.post(`${this.baseUrl}/stats/flowentry/delete`, flowRule);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error deleting flow rule:', error);
      return { success: false, error: error.message };
    }
  }

  // Get switch description
  async getSwitchDesc(dpid) {
    try {
      const response = await axios.get(`${this.baseUrl}/stats/desc/${dpid}`);
      return response.data[dpid] || {};
    } catch (error) {
      console.error('Error getting switch description:', error);
      return {};
    }
  }

  // Get aggregate flow statistics
  async getAggregateFlowStats(dpid, match = {}) {
    try {
      const params = new URLSearchParams({
        dpid: dpid,
        ...match
      });
      const response = await axios.get(`${this.baseUrl}/stats/aggregateflow/${dpid}?${params}`);
      return response.data[dpid] || [];
    } catch (error) {
      console.error('Error getting aggregate flow stats:', error);
      return [];
    }
  }

  // Get table statistics
  async getTableStats(dpid) {
    try {
      const response = await axios.get(`${this.baseUrl}/stats/table/${dpid}`);
      return response.data[dpid] || [];
    } catch (error) {
      console.error('Error getting table stats:', error);
      return [];
    }
  }

  // Send packet out
  async sendPacketOut(dpid, bufferId, inPort, actions, data = null) {
    try {
      const packetOut = {
        dpid: parseInt(dpid),
        buffer_id: bufferId,
        in_port: inPort,
        actions: actions
      };

      if (data) {
        packetOut.data = data;
      }

      const response = await axios.post(`${this.baseUrl}/stats/flowentry/add`, packetOut);
      return { success: true, data: response.data };
    } catch (error) {
      console.error('Error sending packet out:', error);
      return { success: false, error: error.message };
    }
  }

  // Get topology information
  async getTopology() {
    try {
      const switches = await this.getSwitches();
      const topology = {
        switches: [],
        links: [],
        hosts: []
      };

      // Get detailed information for each switch
      for (const dpid of switches) {
        const desc = await this.getSwitchDesc(dpid);
        const ports = await this.getPortStats(dpid);
        
        topology.switches.push({
          id: dpid,
          description: desc,
          ports: ports,
          connected: true
        });
      }

      return topology;
    } catch (error) {
      console.error('Error getting topology:', error);
      return { switches: [], links: [], hosts: [] };
    }
  }

  // Security-related flow rules
  async blockIP(dpid, ipAddress, priority = 1000) {
    const match = {
      ipv4_src: ipAddress
    };
    
    const actions = []; // Drop packet
    
    return await this.addFlowRule(dpid, match, actions, priority);
  }

  async blockPort(dpid, port, priority = 1000) {
    const match = {
      tcp_dst: port
    };
    
    const actions = []; // Drop packet
    
    return await this.addFlowRule(dpid, match, actions, priority);
  }

  async redirectTraffic(dpid, match, outputPort, priority = 1000) {
    const actions = [
      {
        type: 'OUTPUT',
        port: outputPort
      }
    ];
    
    return await this.addFlowRule(dpid, match, actions, priority);
  }

  // Rate limiting
  async setRateLimit(dpid, match, rate, priority = 1000) {
    const actions = [
      {
        type: 'METER',
        meter_id: 1
      }
    ];
    
    // First add meter
    try {
      const meter = {
        dpid: parseInt(dpid),
        flags: 1, // KBPS
        meter_id: 1,
        bands: [
          {
            type: 'DROP',
            rate: rate
          }
        ]
      };
      
      await axios.post(`${this.baseUrl}/stats/meterentry/add`, meter);
    } catch (error) {
      console.error('Error adding meter:', error);
    }
    
    return await this.addFlowRule(dpid, match, actions, priority);
  }

  // Disconnect from Ryu
  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
    this.isConnected = false;
  }
}

export default RyuService;

