// Test script to manually trigger SSE broadcast
// This simulates what PipelineProcessor does when it detects an attack

import { query } from './services/database.js';

// Import SSE connections - this requires the server to be running
let sseConnections = null;

async function testSSEBroadcast() {
  console.log('=== Manual SSE Broadcast Test ===\n');
  
  console.log('IMPORTANT: This script requires backend server to be running!');
  console.log('Make sure you have started: npm start\n');
  
  try {
    // Try to get SSE connections from running server
    console.log('This script will:');
    console.log('1. Insert a test attack into database');
    console.log('2. Show you the exact data format for SSE');
    console.log('3. Explain how to trigger real SSE broadcasts\n');
    
    // Step 1: Insert test attack
    const testEventId = `manual_sse_test_${Date.now()}`;
    const detectedAt = new Date().toISOString();
    
    console.log('1. Inserting test attack...');
    await query(`
      INSERT INTO attack_events (
        event_id, flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
        is_attack, attack_type, confidence_score, severity,
        model_name, model_version, detection_method, detected_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      testEventId,
      'manual_test_flow',
      '10.0.0.50',
      '10.0.0.100',
      12345,
      443,
      6,
      true,
      'Manual Test Attack',
      0.98,
      'high',
      'Manual Test',
      'v1.0',
      'manual',
      detectedAt
    ]);
    
    console.log('✓ Test attack inserted');
    console.log('  Event ID:', testEventId);
    
    // Step 2: Show SSE data format
    console.log('\n2. Expected SSE Broadcast Data Format:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const sseData = {
      id: testEventId,
      timestamp: detectedAt,
      source_ip: '10.0.0.50',
      destination_ip: '10.0.0.100',
      attack_type: 'Manual Test Attack',
      severity: 'high',
      confidence: 0.98,
      status: 'detected',
      flow_data: {
        protocol: 6,
        src_port: 12345,
        dst_port: 443
      }
    };
    console.log(JSON.stringify(sseData, null, 2));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Step 3: Show how to trigger real broadcasts
    console.log('\n3. How to Trigger REAL SSE Broadcasts:\n');
    
    console.log('Method A - Via Pipeline Processor (Recommended):');
    console.log('  1. Make sure backend server is running (npm start)');
    console.log('  2. Run: node backend/trigger_pipeline.js');
    console.log('  3. This will process flows and broadcast real attacks\n');
    
    console.log('Method B - Via Real-time Packet Detection:');
    console.log('  1. Make sure Ryu controller is connected');
    console.log('  2. Send network traffic through switches');
    console.log('  3. Attacks detected will broadcast automatically\n');
    
    console.log('Method C - Check if broadcasts are working:');
    console.log('  Backend logs should show:');
    console.log('  [PipelineProcessor] Broadcasted attack notification to N SSE client(s)');
    console.log('  where N is the number of connected clients\n');
    
    // Step 4: Verify frontend is listening
    console.log('4. Frontend Debug Checklist:\n');
    console.log('□ Open browser DevTools Console (F12)');
    console.log('□ Log in to the application');
    console.log('□ Check for: [App] Initializing SSE connection...');
    console.log('□ Check for: [App] SSE connection established successfully');
    console.log('□ Trigger attack via Method A or B above');
    console.log('□ Look for: [App] SSE Event received: {...}');
    console.log('□ Look for: [App] Creating notification for attack: ...');
    console.log('□ Look for: [Header] Notifications prop updated: ...');
    console.log('□ Check bell icon in header for notification badge\n');
    
    // Step 5: Common issues
    console.log('5. Common Issues:\n');
    console.log('Issue: "No SSE clients connected" in backend logs');
    console.log('Fix: Make sure frontend is logged in and console shows SSE connection\n');
    
    console.log('Issue: "Ignoring event (missing required fields)" in frontend');
    console.log('Fix: Check SSE data format matches expected structure\n');
    
    console.log('Issue: "Notification already seen" in frontend');
    console.log('Fix: Refresh browser page to clear seen notifications cache\n');
    
    console.log('Issue: Events in Recent Security but not Notifications');
    console.log('Fix: This means SSE is not broadcasting. Check:');
    console.log('     - Backend server.js line: setSseConnections(sseConnections)');
    console.log('     - Backend logs for: "SSE connections linked to PipelineProcessor"');
    console.log('     - Only attacks via PipelineProcessor broadcast to SSE\n');
    
    // Cleanup
    console.log('6. Cleaning up...');
    await query('DELETE FROM attack_events WHERE event_id = $1', [testEventId]);
    console.log('✓ Test data cleaned up\n');
    
    console.log('=== Next Steps ===');
    console.log('1. Run: node backend/trigger_pipeline.js (in a separate terminal)');
    console.log('2. Watch backend terminal for broadcast logs');
    console.log('3. Watch browser console for SSE event logs');
    console.log('4. Check bell icon in header for notification badge\n');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

testSSEBroadcast();


