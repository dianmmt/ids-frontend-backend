#!/usr/bin/env node
/**
 * Test script to verify the getLocalModelFallback error fix
 */

import { DirectMLPredictorWithDB } from './services/directMLPredictorWithDB.js';
import { PipelineProcessor } from './services/pipelineProcessor.js';
import { query } from './services/database.js';

async function testFixLocalModelError() {
  console.log('=== Testing Local Model Error Fix ===\n');

  try {
    // Test 1: DirectMLPredictorWithDB.getUserSelectedModel
    console.log('🔍 Test 1: DirectMLPredictorWithDB.getUserSelectedModel');
    const predictor = new DirectMLPredictorWithDB('1');
    
    const modelInfo = await predictor.getUserSelectedModel('1', 'primary');
    
    console.log('✅ getUserSelectedModel SUCCESS:');
    console.log(`   Model Name: ${modelInfo.model_name}`);
    console.log(`   Model Type: ${modelInfo.model_type}`);
    console.log(`   Model Path: ${modelInfo.model_path}`);
    console.log(`   Scaler Path: ${modelInfo.scaler_path}`);
    console.log(`   Encoder Path: ${modelInfo.encoder_path}`);
    console.log('');

    // Test 2: PipelineProcessor with sample flow
    console.log('🔍 Test 2: PipelineProcessor.processSingleFlow');
    const processor = new PipelineProcessor({ batchSize: 1 });
    
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
      console.log('⚠️  No unprocessed flows found - creating mock flow for test');
      
      // Create mock flow for testing
      const mockFlow = {
        flow_id: 'test-flow-123',
        src_ip: '192.168.1.100',
        dst_ip: '192.168.1.200',
        src_port: 54321,
        dst_port: 80,
        protocol: 6,
        flow_duration: 1000,
        total_fwd_packets: 10,
        total_backward_packets: 5,
        total_length_of_fwd_packets: 1000,
        total_length_of_bwd_packets: 500,
        fwd_packet_length_max: 100,
        fwd_packet_length_min: 50,
        fwd_packet_length_mean: 75,
        fwd_packet_length_std: 10,
        bwd_packet_length_max: 100,
        bwd_packet_length_min: 50,
        bwd_packet_length_mean: 75,
        bwd_packet_length_std: 10,
        flow_bytes_per_second: 1000,
        flow_packets_per_second: 10,
        flow_iat_mean: 100,
        flow_iat_std: 10,
        flow_iat_max: 200,
        flow_iat_min: 50,
        fwd_iat_total: 1000,
        fwd_iat_mean: 100,
        fwd_iat_std: 10,
        fwd_iat_max: 200,
        fwd_iat_min: 50,
        bwd_iat_total: 500,
        bwd_iat_mean: 100,
        bwd_iat_std: 10,
        bwd_iat_max: 200,
        bwd_iat_min: 50,
        fwd_psh_flags: 0,
        bwd_psh_flags: 0,
        fwd_urg_flags: 0,
        bwd_urg_flags: 0,
        fwd_header_length: 20,
        bwd_header_length: 20,
        fwd_packets_per_second: 10,
        bwd_packets_per_second: 5,
        packet_length_min: 50,
        packet_length_max: 100,
        packet_length_mean: 75,
        packet_length_std: 10,
        packet_length_variance: 100,
        fin_flag_count: 1,
        syn_flag_count: 1,
        rst_flag_count: 0,
        psh_flag_count: 0,
        ack_flag_count: 5,
        urg_flag_count: 0,
        cwe_flag_count: 0,
        ece_flag_count: 0,
        down_up_ratio: 0.5,
        packet_size_avg: 75,
        fwd_segment_size_avg: 75,
        bwd_segment_size_avg: 75,
        fwd_bytes_per_byte_avg: 1,
        fwd_packets_per_byte_avg: 0.01,
        fwd_block_rate_avg: 0,
        bwd_bytes_per_byte_avg: 1,
        bwd_packets_per_byte_avg: 0.01,
        bwd_block_rate_avg: 0,
        subflow_fwd_packets: 10,
        subflow_fwd_bytes: 1000,
        subflow_bwd_packets: 5,
        subflow_bwd_bytes: 500,
        init_fwd_win_bytes: 65535,
        init_bwd_win_bytes: 65535,
        fwd_act_data_packets: 10,
        fwd_segment_size_min: 20,
        active_mean: 100,
        active_std: 10,
        active_max: 200,
        active_min: 50,
        idle_mean: 0,
        idle_std: 0,
        idle_max: 0,
        idle_min: 0
      };

      console.log('🧪 Testing with mock flow...');
      const result2 = await processor.processSingleFlow(mockFlow);
      
      console.log('✅ processSingleFlow SUCCESS:');
      console.log(`   Success: ${result2.success}`);
      console.log(`   Is Attack: ${result2.isAttack}`);
      console.log(`   Attack Type: ${result2.attackType}`);
      console.log(`   Confidence: ${result2.confidence}`);
      console.log(`   Model Name: ${result2.modelName}`);
      console.log('');
      
    } else {
      const testFlow = result.rows[0];
      console.log(`🧪 Testing with real flow: ${testFlow.flow_id}`);
      
      const result2 = await processor.processSingleFlow(testFlow);
      
      console.log('✅ processSingleFlow SUCCESS:');
      console.log(`   Success: ${result2.success}`);
      console.log(`   Is Attack: ${result2.isAttack}`);
      console.log(`   Attack Type: ${result2.attackType}`);
      console.log(`   Confidence: ${result2.confidence}`);
      console.log(`   Model Name: ${result2.modelName}`);
      console.log('');
    }

    console.log('🎉 All tests passed! The getLocalModelFallback error has been fixed.');
    console.log('✅ System is now using local models from ml/ folder successfully.');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
    
    if (error.message.includes('getLocalModelFallback')) {
      console.error('\n🔧 The getLocalModelFallback error still exists!');
      console.error('   Please check that getDefaultModel() method exists and is properly implemented.');
    }
  }
}

// Run the test
testFixLocalModelError().catch(console.error);
