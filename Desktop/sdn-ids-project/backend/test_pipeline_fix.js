#!/usr/bin/env node
/**
 * Test script to verify PipelineProcessor fix
 */

import { PipelineProcessor } from './services/pipelineProcessor.js';
import { query } from './services/database.js';

async function testPipelineProcessor() {
  console.log('=== Testing PipelineProcessor Fix ===\n');

  try {
    // Create PipelineProcessor instance
    const processor = new PipelineProcessor({ batchSize: 2 });
    
    // Get a sample unprocessed flow
    const result = await query(`
      SELECT 
        flow_id, src_ip, dst_ip, src_port, dst_port, protocol,
        flow_duration, total_fwd_packets, total_backward_packets,
        total_length_of_fwd_packets, total_length_of_bwd_packets,
        fwd_packet_length_max, fwd_packet_length_min, fwd_packet_length_mean, fwd_packet_length_std,
        bwd_packet_length_max, bwd_packet_length_min, bwd_packet_length_mean, bwd_packet_length_std,
        flow_bytes_per_second, flow_packets_per_second,
        flow_iat_mean, flow_iat_std, flow_iat_max, flow_iat_min,
        fwd_iat_total, fwd_iat_mean, fwd_iat_std, fwd_iat_max, fwd_iat_min,
        bwd_iat_total, bwd_iat_mean, bwd_iat_std, bwd_iat_max, bwd_iat_min,
        fwd_psh_flags, bwd_psh_flags, fwd_urg_flags, bwd_urg_flags,
        fwd_header_length, bwd_header_length,
        fwd_packets_per_second, bwd_packets_per_second,
        packet_length_min, packet_length_max, packet_length_mean, packet_length_std, packet_length_variance,
        fin_flag_count, syn_flag_count, rst_flag_count, psh_flag_count, ack_flag_count,
        urg_flag_count, cwe_flag_count, ece_flag_count,
        down_up_ratio, packet_size_avg, fwd_segment_size_avg, bwd_segment_size_avg,
        fwd_bytes_per_byte_avg, fwd_packets_per_byte_avg, fwd_block_rate_avg,
        bwd_bytes_per_byte_avg, bwd_packets_per_byte_avg, bwd_block_rate_avg,
        subflow_fwd_packets, subflow_fwd_bytes, subflow_bwd_packets, subflow_bwd_bytes,
        init_fwd_win_bytes, init_bwd_win_bytes, fwd_act_data_packets, fwd_segment_size_min,
        active_mean, active_std, active_max, active_min,
        idle_mean, idle_std, idle_max, idle_min
      FROM flows 
      WHERE is_processed = false 
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      console.log('❌ No unprocessed flows found in database');
      console.log('   Please ensure CICFlowMeter collector is running and generating flows');
      return;
    }

    const testFlow = result.rows[0];
    console.log('✅ Found test flow:');
    console.log(`   Flow ID: ${testFlow.flow_id}`);
    console.log(`   Source: ${testFlow.src_ip}:${testFlow.src_port}`);
    console.log(`   Destination: ${testFlow.dst_ip}:${testFlow.dst_port}`);
    console.log(`   Protocol: ${testFlow.protocol}`);
    console.log(`   Duration: ${testFlow.flow_duration}μs`);
    console.log(`   Packets: ${testFlow.total_fwd_packets} fwd, ${testFlow.total_backward_packets} bwd`);
    console.log('');

    // Test prepareMLInput method
    console.log('🔍 Testing prepareMLInput method...');
    const mlInput = processor.prepareMLInput(testFlow);
    console.log(`   ML Input type: ${typeof mlInput}`);
    console.log(`   ML Input is array: ${Array.isArray(mlInput)}`);
    console.log(`   ML Input keys: ${Object.keys(mlInput).length}`);
    console.log('');

    // Test processSingleFlow method
    console.log('🤖 Testing processSingleFlow method...');
    const result2 = await processor.processSingleFlow(testFlow);
    
    console.log('✅ ProcessSingleFlow result:');
    console.log(`   Success: ${result2.success}`);
    console.log(`   Is Attack: ${result2.isAttack}`);
    console.log(`   Attack Type: ${result2.attackType}`);
    console.log(`   Confidence: ${result2.confidence}`);
    console.log(`   Model Name: ${result2.modelName}`);
    console.log(`   User ID: ${result2.userId}`);
    console.log('');

    if (result2.success) {
      console.log('🎉 PipelineProcessor fix is working correctly!');
    } else {
      console.log('❌ PipelineProcessor still has issues:');
      console.log(`   Error: ${result2.error}`);
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testPipelineProcessor().catch(console.error);
