import axios from 'axios';
import { WebSocket } from 'ws';

class RyuService {
  constructor(host = '192.168.163.156', port = 8080, wsPort = 8080) {
    this.host = host;
    this.port = port;
    this.wsPort = wsPort;
    this.baseUrl = `http://${host}:${port}`;
    // ✅ Bỏ WebSocket connection đến Ryu vì Ryu không có endpoint này
    // this.wsUrl = `ws://${host}:${wsPort}/v1.0/topology/ws`;
    this.ws = null;
    this.isConnected = false;
    this.connectionStatus = 'disconnected';
    this.eventHandlers = new Map();
    this.connectionCheckInterval = null;
    this.detectedHosts = new Map();
    this.hostMonitoringInterval = null;
  }

  // ✅ Sửa connect method - chỉ dùng HTTP API
  async connect() {
    try {
      this.connectionStatus = 'connecting';
      console.log(`Connecting to Ryu controller at ${this.baseUrl}...`);
      
      // Test HTTP connection
      const response = await axios.get(`${this.baseUrl}/stats/switches`, { timeout: 5000 });
      console.log('✅ Ryu HTTP API is accessible');
      
      // ✅ Set connected ngay lập tức vì HTTP API hoạt động
      this.isConnected = true;
      this.connectionStatus = 'connected';
      
      // ✅ Bỏ WebSocket connection vì Ryu không hỗ trợ
      // this.ws = new WebSocket(this.wsUrl);
      
      this.startConnectionMonitoring();
      this.startHostMonitoring();
      this.autoDetectHosts();
      
      return true;
    } catch (error) {
      console.error('Failed to connect to Ryu controller:', error.message);
      this.connectionStatus = 'disconnected';
      this.isConnected = false;
      return false;
    }
  }

  // ✅ Bỏ WebSocket event subscription
  subscribeToEvents() {
    // Không cần WebSocket events vì Ryu không hỗ trợ
    console.log('✅ Using HTTP polling instead of WebSocket');
  }

  // ✅ Bỏ WebSocket message handling
  handleMessage(data) {
    // Không cần handle WebSocket messages
  }
  async getHostsController(req, res) {
    try {
      const hosts = await this.getHostsFromRyu();
      res.json({
        success: true,
        data: hosts,
        count: hosts.length
      });
    } catch (error) {
      console.error('Error getting hosts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get hosts',
        error: error.message
      });
    }
  }

  // Process packet_in events for host detection
  processPacketIn(packet) {
    try {
      let detectedHost = null;

      // Extract host information from ARP packets
      if (packet.arp) {
        detectedHost = {
          mac: packet.arp.src_mac,
          ipv4: [packet.arp.src_ip],
          switch: packet.dpid,
          port: packet.in_port,
          detected_by: 'packet_in_arp',
          last_seen: new Date().toISOString(),
          timestamp: Date.now()
        };
      }
      
      // Extract from Ethernet frames (IPv4)
      else if (packet.eth && packet.eth.ethertype === 2048) {
        detectedHost = {
          mac: packet.eth.src,
          ipv4: ['unknown'],
          switch: packet.dpid,
          port: packet.in_port,
          detected_by: 'packet_in_eth',
          last_seen: new Date().toISOString(),
          timestamp: Date.now()
        };
      }

      // Extract from IPv4 packets
      else if (packet.ipv4 && packet.eth) {
        detectedHost = {
          mac: packet.eth.src,
          ipv4: [packet.ipv4.src],
          switch: packet.dpid,
          port: packet.in_port,
          detected_by: 'packet_in_ipv4',
          last_seen: new Date().toISOString(),
          timestamp: Date.now()
        };
      }

      if (detectedHost) {
        this.detectedHosts.set(detectedHost.mac, detectedHost);
        console.log('Real-time host detected:', detectedHost);
        
        // Notify event handlers
        const handler = this.eventHandlers.get('host_detected');
        if (handler) {
          handler(detectedHost);
        }
      }
    } catch (error) {
      console.error('Error processing packet_in:', error);
    }
  }

  // Register event handlers
  on(event, handler) {
    this.eventHandlers.set(event, handler);
  }

  // Auto detect hosts from multiple sources
  async autoDetectHosts() {
    console.log('Starting host auto-detection...');
    
    try {
      const switches = await this.getSwitches();
      const hosts = await this.detectRealHosts(switches);
      
      // Update detected hosts map
      hosts.forEach(host => {
        this.detectedHosts.set(host.mac, host);
      });
      
      console.log(`Detected ${hosts.length} hosts from auto-detection`);
      return hosts;
    } catch (error) {
      console.error('Error in host auto-detection:', error);
      return [];
    }
  }

  // Detect real hosts from multiple sources
  async detectRealHosts(switches) {
    const hosts = new Map();
    
    try {
      // Method 1: Detect from flow entries
      const flowHosts = await this.detectHostsFromFlows(switches);
      flowHosts.forEach(host => hosts.set(host.mac, host));
      
      // Method 2: Detect from port statistics
      const portHosts = await this.detectHostsFromPorts(switches);
      portHosts.forEach(host => hosts.set(host.mac, host));
      
      // Method 3: Use Ryu's REST API for host information
      
      return Array.from(hosts.values());
    } catch (error) {
      console.error('Error detecting real hosts:', error);
      return Array.from(hosts.values());
    }
  }

  // Detect hosts from flow statistics
  async detectHostsFromFlows(switches) {
    const hosts = [];
    
    try {
      for (const dpid of switches) {
        const flows = await this.getFlowStats(dpid);
        
        flows.forEach(flow => {
          if (flow.match) {
            // Detect from source IP and MAC
            if (flow.match.ipv4_src && flow.match.eth_src) {
              hosts.push({
                mac: flow.match.eth_src,
                ipv4: [flow.match.ipv4_src],
                switch: dpid,
                port: flow.match.in_port || 1,
                detected_by: 'flow_src',
                last_seen: new Date().toISOString(),
                timestamp: Date.now()
              });
            }
            
            // Detect from destination IP and MAC
            if (flow.match.ipv4_dst && flow.match.eth_dst) {
              hosts.push({
                mac: flow.match.eth_dst,
                ipv4: [flow.match.ipv4_dst],
                switch: dpid,
                port: flow.match.in_port || 1,
                detected_by: 'flow_dst',
                last_seen: new Date().toISOString(),
                timestamp: Date.now()
              });
            }
            
            // Detect from ARP packets
            if (flow.match.eth_type === '0x0806' && flow.match.arp_spa) {
              hosts.push({
                mac: flow.match.arp_sha || `arp_${flow.match.arp_spa}`,
                ipv4: [flow.match.arp_spa],
                switch: dpid,
                port: flow.match.in_port || 1,
                detected_by: 'arp_flow',
                last_seen: new Date().toISOString(),
                timestamp: Date.now()
              });
            }
          }
        });
      }
    } catch (error) {
      console.error('Error detecting hosts from flows:', error);
    }
    
    return this.removeDuplicateHosts(hosts);
  }

  // Detect hosts from active ports
  async detectHostsFromPorts(switches) {
    const hosts = [];
    
    try {
      for (const dpid of switches) {
        const ports = await this.getPortStats(dpid);
        
        ports.forEach(port => {
          // If port has traffic and is not a switch-to-switch port
          if (port.port_no > 2 && (port.rx_packets > 0 || port.tx_packets > 0)) {
            hosts.push({
              mac: `port_${dpid}_${port.port_no}`,
              ipv4: [`192.168.${dpid}.${port.port_no}`],
              switch: dpid,
              port: port.port_no,
              detected_by: 'port_activity',
              last_seen: new Date().toISOString(),
              timestamp: Date.now(),
              rx_packets: port.rx_packets,
              tx_packets: port.tx_packets
            });
          }
        });
      }
    } catch (error) {
      console.error('Error detecting hosts from ports:', error);
    }
    
    return hosts;
  }

 

  // Remove duplicate hosts by MAC address
  removeDuplicateHosts(hosts) {
    const uniqueHosts = new Map();
    
    hosts.forEach(host => {
      if (!uniqueHosts.has(host.mac)) {
        uniqueHosts.set(host.mac, host);
      } else {
        // Update existing host with new information
        const existing = uniqueHosts.get(host.mac);
        const updatedHost = {
          ...existing,
          ...host,
          last_seen: host.last_seen,
          timestamp: host.timestamp
        };
        
        // Merge IP addresses
        if (host.ipv4 && host.ipv4[0] !== 'unknown') {
          updatedHost.ipv4 = [...new Set([...existing.ipv4, ...host.ipv4])];
        }
        
        uniqueHosts.set(host.mac, updatedHost);
      }
    });
    
    return Array.from(uniqueHosts.values());
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

  // Security: Block IP address
  async blockIP(dpid, ipAddress, priority = 1000) {
    const match = {
      ipv4_src: ipAddress
    };
    
    const actions = []; // Drop packet
    
    return await this.addFlowRule(dpid, match, actions, priority);
  }

  // Security: Block port
  async blockPort(dpid, port, priority = 1000) {
    const match = {
      tcp_dst: port
    };
    
    const actions = []; // Drop packet
    
    return await this.addFlowRule(dpid, match, actions, priority);
  }

  // Get topology information
    async getTopology() {
    try {
      const switches = await this.getSwitches();
      const topology = {
        switches: [],
        links: await this.getLinks(),
        hosts: this.getDetectedHosts(),
        timestamp: Date.now()
      };

      // Switch info
      for (const dpid of switches) {
        const desc = await this.getSwitchDesc(dpid);
        const ports = await this.getPortStats(dpid);
        
        topology.switches.push({
          id: dpid,
          description: desc,
          ports: ports,
          connected: true,
          flow_count: (await this.getFlowStats(dpid)).length
        });
      }

      // Nếu hosts rỗng, thử lấy từ REST API
      if (topology.hosts.length === 0) {
        console.log('No hosts in cache, fetching from Ryu /v1.0/hosts...');
        const apiHosts = await this.getHostsFromRyu();
        topology.hosts = apiHosts;
      }

      return topology;
    } catch (error) {
      console.error('Error getting topology:', error);
      return { switches: [], links: [], hosts: [], timestamp: Date.now() };
    }
  }

  // Get links between switches
  async getLinks() {
    try {
      const response = await axios.get(`${this.baseUrl}/topology/links`, { timeout: 3000 });
      return response.data || [];
    } catch (error) {
      // Fallback: create mock links based on switch connections
      return this.createMockLinks();
    }
  }

  // Create mock links for testing
  createMockLinks() {
    // Simple linear topology for demo
    return [
      {
        src: { dpid: '1', port_no: 1 },
        dst: { dpid: '2', port_no: 1 }
      }
    ];
  }

  // Get all detected hosts
  getDetectedHosts() {
    return Array.from(this.detectedHosts.values());
  }

  
 

  // Start host monitoring
  startHostMonitoring() {
    this.stopHostMonitoring();
    this.hostMonitoringInterval = setInterval(async () => {
      try {
        await this.autoDetectHosts();
        
        // Clean up old hosts (older than 5 minutes)
        const now = Date.now();
        for (const [mac, host] of this.detectedHosts) {
          if (now - host.timestamp > 300000) { // 5 minutes
            this.detectedHosts.delete(mac);
            console.log(`Removed stale host: ${mac}`);
          }
        }
      } catch (error) {
        console.error('Error in host monitoring:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop host monitoring
  stopHostMonitoring() {
    if (this.hostMonitoringInterval) {
      clearInterval(this.hostMonitoringInterval);
      this.hostMonitoringInterval = null;
    }
  }

  // ✅ Cải thiện connection monitoring
  startConnectionMonitoring() {
    this.stopConnectionMonitoring();
    this.connectionCheckInterval = setInterval(async () => {
      try {
        // ✅ Test HTTP connection định kỳ
        await axios.get(`${this.baseUrl}/stats/switches`, { timeout: 3000 });
        if (this.connectionStatus !== 'connected') {
          console.log('✅ Ryu connection restored');
          this.connectionStatus = 'connected';
          this.isConnected = true;
        }
      } catch (error) {
        if (this.connectionStatus !== 'disconnected') {
          console.log('❌ Ryu connection lost');
          this.connectionStatus = 'disconnected';
          this.isConnected = false;
        }
      }
    }, 5000); // ✅ Giảm interval xuống 5s thay vì 10s
  }

  // Stop connection monitoring
  stopConnectionMonitoring() {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = null;
    }
  }

  // Get connection status
  getConnectionStatus() {
    return this.connectionStatus;
  }

  // Check if connected
  isConnectedToRyu() {
    return this.isConnected && this.connectionStatus === 'connected';
  }

  // Disconnect from Ryu
  disconnect() {
    this.stopConnectionMonitoring();
    this.stopHostMonitoring();
    
    // ✅ Bỏ WebSocket cleanup vì không có WebSocket
    // if (this.ws) {
    //   this.ws.close();
    // }
    
    this.isConnected = false;
    this.connectionStatus = 'disconnected';
    this.detectedHosts.clear();
    console.log('Disconnected from Ryu controller');
  }
  async getTopologyController(req, res) {
    try {
      const topology = await this.getTopology();
      res.json({
        success: true,
        data: topology,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error getting topology:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get topology',
        error: error.message
      });
    }
  }

  // Get all switches (controller method)
  async getSwitchesController(req, res) {
    try {
      const switches = await this.getSwitches();
      const switchesWithDetails = [];

      for (const dpid of switches) {
        const desc = await this.getSwitchDesc(dpid);
        const flowStats = await this.getFlowStats(dpid);
        const portStats = await this.getPortStats(dpid);
        
        switchesWithDetails.push({
          id: dpid,
          description: desc,
          flow_count: flowStats.length,
          port_count: portStats.length,
          connected: true
        });
      }

      res.json({
        success: true,
        data: switchesWithDetails
      });
    } catch (error) {
      console.error('Error getting switches:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get switches',
        error: error.message
      });
    }
  }

  // Get all detected hosts (controller method)
  

  // Get flow statistics for a specific switch (controller method)
  async getFlowStatsController(req, res) {
    try {
      const { dpid } = req.params;
      const flows = await this.getFlowStats(dpid);
      
      res.json({
        success: true,
        data: flows,
        switch: dpid,
        count: flows.length
      });
    } catch (error) {
      console.error('Error getting flow stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get flow statistics',
        error: error.message
      });
    }
  }

  // Get port statistics for a specific switch (controller method)
  async getPortStatsController(req, res) {
    try {
      const { dpid } = req.params;
      const ports = await this.getPortStats(dpid);
      
      res.json({
        success: true,
        data: ports,
        switch: dpid,
        count: ports.length
      });
    } catch (error) {
      console.error('Error getting port stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get port statistics',
        error: error.message
      });
    }
  }

  // Add flow rule (controller method)
  async addFlowRuleController(req, res) {
    try {
      const { dpid, match, actions, priority, idle_timeout, hard_timeout } = req.body;
      
      const result = await this.addFlowRule(
        dpid, 
        match, 
        actions, 
        priority, 
        idle_timeout, 
        hard_timeout
      );
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Flow rule added successfully',
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to add flow rule',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error adding flow rule:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add flow rule',
        error: error.message
      });
    }
  }

  // Block IP address (controller method)
  async blockIPController(req, res) {
    try {
      const { dpid, ip_address, priority } = req.body;
      
      const result = await this.blockIP(dpid, ip_address, priority);
      
      if (result.success) {
        res.json({
          success: true,
          message: `IP ${ip_address} blocked successfully on switch ${dpid}`,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to block IP',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error blocking IP:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to block IP',
        error: error.message
      });
    }
  }

  // Block port (controller method)
  async blockPortController(req, res) {
    try {
      const { dpid, port, priority } = req.body;
      
      const result = await this.blockPort(dpid, port, priority);
      
      if (result.success) {
        res.json({
          success: true,
          message: `Port ${port} blocked successfully on switch ${dpid}`,
          data: result.data
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Failed to block port',
          error: result.error
        });
      }
    } catch (error) {
      console.error('Error blocking port:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to block port',
        error: error.message
      });
    }
  }

  // Get connection status (controller method)
  async getStatusController(req, res) {
    try {
      const status = this.getConnectionStatus();
      const isConnected = this.isConnectedToRyu();
      const hosts = this.getDetectedHosts();
      
      res.json({
        success: true,
        data: {
          connected: isConnected,
          status: status,
          host_count: hosts.length,
          monitoring: this.isMonitoring,
          base_url: this.baseUrl
        }
      });
    } catch (error) {
      console.error('Error getting status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get status',
        error: error.message
      });
    }
  }

  // Force host detection (controller method)
  async detectHostsController(req, res) {
    try {
      const hosts = await this.autoDetectHosts();
      
      res.json({
        success: true,
        message: `Detected ${hosts.length} hosts`,
        data: hosts,
        count: hosts.length
      });
    } catch (error) {
      console.error('Error detecting hosts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to detect hosts',
        error: error.message
      });
    }
  }
  // Get hosts directly from Ryu REST API
  async getHostsFromRyu() {
    try {
      const response = await axios.get(`${this.baseUrl}/v1.0/hosts`);
      const hosts = response.data || [];
      
      // Cập nhật cache detectedHosts
      hosts.forEach(host => {
        const hostData = {
          mac: host.mac,
          ipv4: host.ipv4 && host.ipv4.length ? host.ipv4 : ['unknown'],
          switch: host.dpid,
          port: host.port,
          detected_by: 'rest_host',
          last_seen: new Date().toISOString(),
          timestamp: Date.now()
        };
        this.detectedHosts.set(host.mac, hostData);
      });

      return hosts;
    } catch (error) {
      console.error('Error getting hosts from Ryu REST API:', error.message);
      return [];
    }
  }

  // Disconnect from Ryu (controller method)
  async disconnectController(req, res) {
    try {
      this.disconnect();
      this.isMonitoring = false;
      
      res.json({
        success: true,
        message: 'Disconnected from Ryu controller'
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect',
        error: error.message
      });
    }
  }
}

export default RyuService;
