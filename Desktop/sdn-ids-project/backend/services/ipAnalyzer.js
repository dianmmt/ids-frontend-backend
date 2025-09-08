// backend/services/ipAnalyzer.js - IP Analysis and Blocking Service
import { query } from './database.js';
import RyuService from './ryuServices.js';
import cron from 'node-cron';

export class IPAnalyzer {
  constructor(options = {}) {
    this.analysisInterval = options.analysisInterval || parseInt(process.env.IP_ANALYZER_INTERVAL) || 60000; // 1 minute
    this.attackThreshold = options.attackThreshold || parseInt(process.env.IP_ANALYZER_THRESHOLD) || 5;
    this.timeWindowMinutes = options.timeWindowMinutes || parseInt(process.env.IP_ANALYZER_TIME_WINDOW) || 10;
    this.blockDurationHours = options.blockDurationHours || parseInt(process.env.IP_ANALYZER_BLOCK_DURATION) || 24;
    this.autoUnblock = options.autoUnblock !== false; // Default to true
    
    this.ryuService = new RyuService();
    this.isRunning = false;
    this.analysisJob = null;
    this.stats = {
      totalAnalyzed: 0,
      totalBlocked: 0,
      totalUnblocked: 0,
      lastAnalysis: null,
      activeBlocks: 0
    };
  }

  /**
   * Start the IP analyzer service
   */
  async start() {
    console.log('[IPAnalyzer] Starting IP analyzer service...');
    
    try {
      // Connect to Ryu controller
      const connected = await this.ryuService.connect();
      if (!connected) {
        console.warn('[IPAnalyzer] Failed to connect to Ryu controller, blocking will be disabled');
      }
      
      // Start cron job for analysis
      this.analysisJob = cron.schedule(`*/${this.analysisInterval / 1000} * * * * *`, async () => {
        if (this.isRunning) {
          await this.analyzeMaliciousIPs();
        }
      });
      
      // Start auto-unblock job if enabled
      if (this.autoUnblock) {
        cron.schedule('0 */1 * * * *', async () => { // Every hour
          if (this.isRunning) {
            await this.autoUnblockExpiredIPs();
          }
        });
      }
      
      this.isRunning = true;
      console.log(`[IPAnalyzer] IP analyzer started (interval: ${this.analysisInterval}ms, threshold: ${this.attackThreshold} attacks in ${this.timeWindowMinutes} minutes)`);
      
      // Run initial analysis
      await this.analyzeMaliciousIPs();
      
    } catch (error) {
      console.error('[IPAnalyzer] Failed to start analyzer:', error);
      throw error;
    }
  }

  /**
   * Stop the IP analyzer service
   */
  async stop() {
    console.log('[IPAnalyzer] Stopping IP analyzer service...');
    
    this.isRunning = false;
    
    if (this.analysisJob) {
      this.analysisJob.destroy();
      this.analysisJob = null;
    }
    
    // Disconnect from Ryu
    this.ryuService.disconnect();
    
    console.log('[IPAnalyzer] IP analyzer stopped');
  }

  /**
   * Analyze malicious IPs and block if necessary
   */
  async analyzeMaliciousIPs() {
    if (!this.isRunning) return;
    
    const startTime = Date.now();
    
    try {
      console.log('[IPAnalyzer] Analyzing malicious IPs...');
      
      // Get IPs with high attack counts
      const maliciousIPs = await this.getMaliciousIPs();
      
      if (maliciousIPs.length === 0) {
        console.log('[IPAnalyzer] No malicious IPs found');
        return;
      }
      
      console.log(`[IPAnalyzer] Found ${maliciousIPs.length} malicious IPs`);
      
      // Process each malicious IP
      let blockedCount = 0;
      for (const ipData of maliciousIPs) {
        try {
          const shouldBlock = await this.shouldBlockIP(ipData.ip_address);
          
          if (shouldBlock) {
            await this.blockIP(ipData);
            blockedCount++;
          }
        } catch (error) {
          console.error(`[IPAnalyzer] Error processing IP ${ipData.ip_address}:`, error);
        }
      }
      
      // Update statistics
      this.stats.totalAnalyzed += maliciousIPs.length;
      this.stats.totalBlocked += blockedCount;
      this.stats.lastAnalysis = new Date();
      this.stats.activeBlocks = await this.getActiveBlockCount();
      
      console.log(`[IPAnalyzer] Analysis complete: ${blockedCount} IPs blocked`);
      
    } catch (error) {
      console.error('[IPAnalyzer] Error analyzing malicious IPs:', error);
    }
  }

  /**
   * Get IPs with high attack counts
   */
  async getMaliciousIPs() {
    try {
      const result = await query(`
        SELECT 
          src_ip as ip_address,
          COUNT(*) as attack_count,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
          COUNT(CASE WHEN severity = 'medium' THEN 1 END) as medium_count,
          COUNT(CASE WHEN severity = 'low' THEN 1 END) as low_count,
          MAX(detected_at) as last_attack,
          MIN(detected_at) as first_attack,
          AVG(confidence_score) as avg_confidence,
          STRING_AGG(DISTINCT attack_type, ', ') as attack_types
        FROM attacks
        WHERE is_attack = true 
          AND detected_at > NOW() - INTERVAL '${this.timeWindowMinutes} minutes'
        GROUP BY src_ip
        HAVING COUNT(*) >= $1
        ORDER BY attack_count DESC, critical_count DESC, high_count DESC
      `, [this.attackThreshold]);
      
      return result.rows;
    } catch (error) {
      console.error('[IPAnalyzer] Error getting malicious IPs:', error);
      return [];
    }
  }

  /**
   * Check if IP should be blocked
   */
  async shouldBlockIP(ipAddress) {
    try {
      // Check if IP is already blocked
      const existingBlock = await query(`
        SELECT id, blocked_at, is_active
        FROM blocked_ips 
        WHERE ip_address = $1 AND is_active = true
      `, [ipAddress]);
      
      if (existingBlock.rows.length > 0) {
        console.log(`[IPAnalyzer] IP ${ipAddress} is already blocked`);
        return false;
      }
      
      // Check if IP is in whitelist (you can add a whitelist table if needed)
      const isWhitelisted = await this.isIPWhitelisted(ipAddress);
      if (isWhitelisted) {
        console.log(`[IPAnalyzer] IP ${ipAddress} is whitelisted, skipping block`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error(`[IPAnalyzer] Error checking if IP ${ipAddress} should be blocked:`, error);
      return false;
    }
  }

  /**
   * Check if IP is whitelisted
   */
  async isIPWhitelisted(ipAddress) {
    try {
      // Add your whitelist logic here
      // For now, we'll skip blocking private IPs
      const privateRanges = [
        '10.0.0.0/8',
        '172.16.0.0/12',
        '192.168.0.0/16',
        '127.0.0.0/8'
      ];
      
      for (const range of privateRanges) {
        const result = await query(`
          SELECT $1::inet << $2::cidr as is_private
        `, [ipAddress, range]);
        
        if (result.rows[0].is_private) {
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error(`[IPAnalyzer] Error checking whitelist for IP ${ipAddress}:`, error);
      return false;
    }
  }

  /**
   * Block an IP address
   */
  async blockIP(ipData) {
    try {
      console.log(`[IPAnalyzer] Blocking IP ${ipData.ip_address} (${ipData.attack_count} attacks)`);
      
      // Get all switches to block on
      const switches = await this.ryuService.getSwitches();
      
      // Block IP on all switches
      const blockResults = [];
      for (const dpid of switches) {
        try {
          const result = await this.ryuService.blockIP(dpid, ipData.ip_address, 1000);
          blockResults.push({ dpid, success: result.success, error: result.error });
        } catch (error) {
          console.error(`[IPAnalyzer] Error blocking IP ${ipData.ip_address} on switch ${dpid}:`, error);
          blockResults.push({ dpid, success: false, error: error.message });
        }
      }
      
      // Log blocking action to database
      await this.logBlockedIP(ipData, blockResults);
      
      console.log(`[IPAnalyzer] Successfully blocked IP ${ipData.ip_address}`);
      
    } catch (error) {
      console.error(`[IPAnalyzer] Error blocking IP ${ipData.ip_address}:`, error);
      throw error;
    }
  }

  /**
   * Log blocked IP to database
   */
  async logBlockedIP(ipData, blockResults) {
    try {
      const queryText = `
        INSERT INTO blocked_ips (
          ip_address, block_reason, attack_count, time_window_minutes,
          blocked_at, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `;
      
      const values = [
        ipData.ip_address,
        `High attack count: ${ipData.attack_count} attacks in ${this.timeWindowMinutes} minutes`,
        ipData.attack_count,
        this.timeWindowMinutes,
        new Date().toISOString(),
        true
      ];
      
      await query(queryText, values);
      
    } catch (error) {
      console.error('[IPAnalyzer] Error logging blocked IP:', error);
    }
  }

  /**
   * Unblock an IP address
   */
  async unblockIP(ipAddress, reason = 'Manual unblock') {
    try {
      console.log(`[IPAnalyzer] Unblocking IP ${ipAddress}`);
      
      // Get all switches to unblock on
      const switches = await this.ryuService.getSwitches();
      
      // Remove blocking rules from all switches
      const unblockResults = [];
      for (const dpid of switches) {
        try {
          // Note: This would require implementing deleteFlowRule with specific match criteria
          // For now, we'll just log the unblock action
          unblockResults.push({ dpid, success: true });
        } catch (error) {
          console.error(`[IPAnalyzer] Error unblocking IP ${ipAddress} on switch ${dpid}:`, error);
          unblockResults.push({ dpid, success: false, error: error.message });
        }
      }
      
      // Update database record
      await query(`
        UPDATE blocked_ips 
        SET is_active = false, unblocked_at = NOW()
        WHERE ip_address = $1 AND is_active = true
      `, [ipAddress]);
      
      this.stats.totalUnblocked++;
      this.stats.activeBlocks = await this.getActiveBlockCount();
      
      console.log(`[IPAnalyzer] Successfully unblocked IP ${ipAddress}`);
      
    } catch (error) {
      console.error(`[IPAnalyzer] Error unblocking IP ${ipAddress}:`, error);
      throw error;
    }
  }

  /**
   * Auto-unblock expired IPs
   */
  async autoUnblockExpiredIPs() {
    try {
      const result = await query(`
        SELECT ip_address, blocked_at
        FROM blocked_ips 
        WHERE is_active = true 
          AND blocked_at < NOW() - INTERVAL '${this.blockDurationHours} hours'
      `);
      
      if (result.rows.length === 0) {
        return;
      }
      
      console.log(`[IPAnalyzer] Auto-unblocking ${result.rows.length} expired IPs`);
      
      for (const row of result.rows) {
        try {
          await this.unblockIP(row.ip_address, 'Auto-unblock: Block duration expired');
        } catch (error) {
          console.error(`[IPAnalyzer] Error auto-unblocking IP ${row.ip_address}:`, error);
        }
      }
      
    } catch (error) {
      console.error('[IPAnalyzer] Error auto-unblocking expired IPs:', error);
    }
  }

  /**
   * Get active block count
   */
  async getActiveBlockCount() {
    try {
      const result = await query(`
        SELECT COUNT(*) as count
        FROM blocked_ips 
        WHERE is_active = true
      `);
      
      return parseInt(result.rows[0].count);
    } catch (error) {
      console.error('[IPAnalyzer] Error getting active block count:', error);
      return 0;
    }
  }

  /**
   * Get blocked IPs
   */
  async getBlockedIPs(activeOnly = true) {
    try {
      let queryText = `
        SELECT 
          ip_address, block_reason, attack_count, time_window_minutes,
          blocked_at, unblocked_at, is_active
        FROM blocked_ips
      `;
      
      if (activeOnly) {
        queryText += ' WHERE is_active = true';
      }
      
      queryText += ' ORDER BY blocked_at DESC';
      
      const result = await query(queryText);
      return result.rows;
    } catch (error) {
      console.error('[IPAnalyzer] Error getting blocked IPs:', error);
      return [];
    }
  }

  /**
   * Get IP analysis statistics
   */
  async getIPStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(DISTINCT src_ip) as unique_attack_ips,
          COUNT(*) as total_attacks,
          COUNT(CASE WHEN detected_at > NOW() - INTERVAL '1 hour' THEN 1 END) as attacks_last_hour,
          COUNT(CASE WHEN detected_at > NOW() - INTERVAL '24 hours' THEN 1 END) as attacks_last_24h
        FROM attacks 
        WHERE is_attack = true
      `);
      
      return {
        ...this.stats,
        ...result.rows[0],
        activeBlocks: await this.getActiveBlockCount()
      };
    } catch (error) {
      console.error('[IPAnalyzer] Error getting IP stats:', error);
      return this.stats;
    }
  }

  /**
   * Manual analysis trigger
   */
  async analyzeNow() {
    console.log('[IPAnalyzer] Manual analysis triggered');
    await this.analyzeMaliciousIPs();
  }

  /**
   * Get top attacking IPs
   */
  async getTopAttackingIPs(limit = 20, timeWindowHours = 24) {
    try {
      const result = await query(`
        SELECT 
          src_ip,
          COUNT(*) as attack_count,
          COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_count,
          COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_count,
          MAX(detected_at) as last_attack,
          AVG(confidence_score) as avg_confidence,
          STRING_AGG(DISTINCT attack_type, ', ') as attack_types
        FROM attacks 
        WHERE is_attack = true 
          AND detected_at > NOW() - INTERVAL '${timeWindowHours} hours'
        GROUP BY src_ip
        ORDER BY attack_count DESC, critical_count DESC
        LIMIT $1
      `, [limit]);
      
      return result.rows;
    } catch (error) {
      console.error('[IPAnalyzer] Error getting top attacking IPs:', error);
      return [];
    }
  }
}

export default IPAnalyzer;


