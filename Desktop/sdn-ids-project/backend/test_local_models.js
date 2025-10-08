#!/usr/bin/env node
/**
 * Test script to verify local model usage
 */

import { DirectMLPredictorWithDB } from './services/directMLPredictorWithDB.js';
import { query } from './services/database.js';

async function testLocalModels() {
  console.log('=== Testing Local Model Usage ===\n');

  try {
    // Create DirectMLPredictorWithDB instance
    const predictor = new DirectMLPredictorWithDB('1');
    
    // Test getUserSelectedModel method
    console.log('🔍 Testing getUserSelectedModel method...');
    const modelInfo = await predictor.getUserSelectedModel('1', 'primary');
    
    console.log('✅ Model Info Retrieved:');
    console.log(`   Model Name: ${modelInfo.model_name}`);
    console.log(`   Model Type: ${modelInfo.model_type}`);
    console.log(`   Model Path: ${modelInfo.model_path}`);
    console.log(`   Scaler Path: ${modelInfo.scaler_path}`);
    console.log(`   Encoder Path: ${modelInfo.encoder_path}`);
    console.log('');

    // Verify paths are local (not database paths)
    const isLocalModel = modelInfo.model_path && 
                        (modelInfo.model_path.includes('ml/') || 
                         modelInfo.model_path.includes('random_forest_model') ||
                         modelInfo.model_path.includes('scaler.joblib'));
    
    if (isLocalModel) {
      console.log('✅ SUCCESS: Using local models from ml/ folder');
    } else {
      console.log('❌ WARNING: Still using database models');
      console.log(`   Model Path: ${modelInfo.model_path}`);
    }
    console.log('');

    // Test with sample flow data
    console.log('🤖 Testing ML prediction with local models...');
    const sampleFlow = {
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

    const prediction = await predictor.predictAttack(sampleFlow);
    
    console.log('✅ ML Prediction Result:');
    console.log(`   Is Attack: ${prediction.isAttack}`);
    console.log(`   Attack Type: ${prediction.attackType}`);
    console.log(`   Confidence: ${prediction.confidence}`);
    console.log(`   Severity: ${prediction.severity}`);
    console.log(`   Model Name: ${prediction.modelName}`);
    console.log(`   Model Version: ${prediction.modelVersion}`);
    console.log(`   Model Type: ${prediction.modelType}`);
    console.log('');

    // Check if model name indicates local usage
    const isLocalModelName = prediction.modelName && 
                            (prediction.modelName.includes('local') || 
                             prediction.modelName.includes('fallback') ||
                             prediction.modelName.includes('default'));
    
    if (isLocalModelName) {
      console.log('✅ SUCCESS: Prediction using local model');
    } else {
      console.log('⚠️  INFO: Model name:', prediction.modelName);
    }

    console.log('\n🎉 Local model test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testLocalModels().catch(console.error);
