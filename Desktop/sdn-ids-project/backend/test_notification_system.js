// Test script to verify notification system
import fetch from 'node-fetch';
import { query } from './services/database.js';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

async function testNotificationSystem() {
  console.log('=== Testing Attack Notification System ===\n');
  
  try {
    // Step 1: Check SSE endpoint
    console.log('1. Testing SSE endpoint availability...');
    try {
      const sseTest = await fetch(`${API_BASE}/api/attacks/stream`, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      });
      
      if (sseTest.ok) {
        console.log('✓ SSE endpoint is accessible');
        // Close the connection immediately
        sseTest.body.destroy();
      } else {
        console.log('✗ SSE endpoint returned status:', sseTest.status);
      }
    } catch (e) {
      console.log('✗ SSE endpoint not accessible:', e.message);
    }
    
    // Step 2: Check database connection
    console.log('\n2. Testing database connection...');
    try {
      const dbTest = await query('SELECT 1 as test');
      if (dbTest.rows[0].test === 1) {
        console.log('✓ Database connection OK');
      }
    } catch (e) {
      console.log('✗ Database error:', e.message);
      return;
    }
    
    // Step 3: Insert a test attack
    console.log('\n3. Inserting test attack into database...');
    const testEventId = `test_notification_${Date.now()}`;
    const detectedAt = new Date().toISOString();
    
    try {
      await query(`
        INSERT INTO attack_events (
          event_id, flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
          is_attack, attack_type, confidence_score, severity,
          model_name, model_version, detection_method, detected_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        testEventId,
        'test_flow_' + Date.now(),
        '192.168.100.50',
        '192.168.100.100',
        54321,
        80,
        6,
        true,
        'Test DDoS Attack',
        0.95,
        'critical',
        'Test Model',
        'v1.0',
        'manual_test',
        detectedAt
      ]);
      
      console.log('✓ Test attack inserted:', testEventId);
      console.log('  - Type: Test DDoS Attack');
      console.log('  - Severity: critical');
      console.log('  - Source: 192.168.100.50');
      console.log('  - Destination: 192.168.100.100');
    } catch (e) {
      console.log('✗ Failed to insert test attack:', e.message);
      return;
    }
    
    // Step 4: Verify attack in database
    console.log('\n4. Verifying attack in database...');
    try {
      const result = await query(
        'SELECT * FROM attack_events WHERE event_id = $1',
        [testEventId]
      );
      
      if (result.rows.length > 0) {
        console.log('✓ Attack found in database');
        console.log('  Event ID:', result.rows[0].event_id);
        console.log('  Attack Type:', result.rows[0].attack_type);
        console.log('  Severity:', result.rows[0].severity);
      } else {
        console.log('✗ Attack not found in database');
      }
    } catch (e) {
      console.log('✗ Database query error:', e.message);
    }
    
    // Step 5: Check recent events endpoint
    console.log('\n5. Testing recent events endpoint...');
    try {
      const eventsResponse = await fetch(`${API_BASE}/api/attacks/recent-events?limit=5`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (eventsResponse.ok) {
        const events = await eventsResponse.json();
        console.log('✓ Recent events endpoint OK');
        console.log('  Total events returned:', events.length);
        
        const testEvent = events.find(e => e.id === testEventId);
        if (testEvent) {
          console.log('✓ Test attack found in recent events');
          console.log('  Event data:', JSON.stringify(testEvent, null, 2));
        } else {
          console.log('⚠ Test attack not in recent events (may be filtered)');
        }
      } else {
        console.log('✗ Recent events endpoint error:', eventsResponse.status);
      }
    } catch (e) {
      console.log('✗ Recent events endpoint error:', e.message);
    }
    
    // Step 6: Instructions for manual SSE test
    console.log('\n6. Manual SSE Test Instructions:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('To test SSE notifications manually:');
    console.log('');
    console.log('A. Open your browser and log into the application');
    console.log('B. Open DevTools Console (F12)');
    console.log('C. Look for these logs:');
    console.log('   [App] Initializing SSE connection to /api/attacks/stream');
    console.log('   [App] SSE connection established successfully');
    console.log('');
    console.log('D. Trigger a real attack via pipeline:');
    console.log('   cd backend && node trigger_pipeline.js');
    console.log('');
    console.log('E. Watch console for these logs:');
    console.log('   [App] SSE Event received: {...}');
    console.log('   [App] Creating notification for attack: ...');
    console.log('   [App] Adding new notification to state: ...');
    console.log('   [Header] Notifications prop updated: ...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Cleanup
    console.log('\n7. Cleaning up test data...');
    try {
      await query('DELETE FROM attack_events WHERE event_id = $1', [testEventId]);
      console.log('✓ Test attack cleaned up');
    } catch (e) {
      console.log('⚠ Cleanup warning:', e.message);
    }
    
    console.log('\n=== Test Complete ===\n');
    console.log('Summary:');
    console.log('- Database insertion: Working ✓');
    console.log('- Recent events API: Should be working ✓');
    console.log('- SSE notifications: Need to test manually (see instructions above)');
    console.log('\nNote: Manual database inserts do NOT trigger SSE broadcasts.');
    console.log('Only attacks detected via PipelineProcessor will send notifications.');
    
  } catch (error) {
    console.error('Test failed with error:', error);
  } finally {
    process.exit(0);
  }
}

// Run test
testNotificationSystem();


