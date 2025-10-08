#!/usr/bin/env node
/**
 * Debug script để kiểm tra trạng thái fallback
 * Chạy: node debug_fallback.js
 */

import axios from 'axios';

async function debugFallback() {
  console.log('='.repeat(60));
  console.log('Debug ML Service Fallback Status');
  console.log('='.repeat(60));
  
  const mlServiceUrl = 'http://localhost:5000';
  
  try {
    // 1. Kiểm tra health check
    console.log('1. Checking health status...');
    const healthResponse = await axios.get(`${mlServiceUrl}/health`, { timeout: 5000 });
    const healthData = healthResponse.data;
    
    console.log('Health Check Response:');
    console.log(`   Status: ${healthData.status}`);
    console.log(`   Model loaded: ${healthData.model_loaded}`);
    console.log(`   Model loading: ${healthData.model_loading}`);
    console.log(`   Model ID: ${healthData.model_id || 'N/A'}`);
    console.log(`   Is database model: ${healthData.is_database_model || false}`);
    console.log(`   Model type: ${healthData.model_type || 'unknown'}`);
    
    // 2. Kiểm tra model status
    console.log('\n2. Checking model status...');
    try {
      const statusResponse = await axios.get(`${mlServiceUrl}/model-status`, { timeout: 5000 });
      const statusData = statusResponse.data;
      
      console.log('Model Status Response:');
      console.log(`   Model loaded: ${statusData.model_loaded}`);
      console.log(`   Model ID: ${statusData.model_id || 'N/A'}`);
      console.log(`   Loading time: ${statusData.loading_time || 0}s`);
      console.log(`   Status: ${statusData.status}`);
    } catch (error) {
      console.log('   ❌ Model status endpoint not available');
    }
    
    // 3. Phân tích trạng thái
    console.log('\n3. Fallback Analysis:');
    
    if (healthData.model_loaded) {
      if (healthData.is_database_model) {
        console.log('   🔄 Current model: Database model (UUID)');
        console.log('   ⚠️  Fallback will trigger if upload timeout is reached');
        console.log('   💡 To test fallback, wait for timeout or manually call /load-default-model');
      } else if (healthData.model_id && healthData.model_id.startsWith('default_')) {
        console.log('   ✅ Current model: Default model (already fallback)');
        console.log('   🎯 Fallback mechanism is working correctly');
      } else {
        console.log('   ❓ Current model: Unknown type');
      }
    } else if (healthData.model_loading) {
      console.log('   ⏳ Model is currently loading...');
      console.log('   🔄 Fallback will trigger if loading takes too long');
    } else {
      console.log('   ❌ No model loaded and not loading');
      console.log('   🚨 Service may need restart');
    }
    
    // 4. Test fallback endpoint
    console.log('\n4. Testing fallback endpoint...');
    try {
      const fallbackResponse = await axios.post(`${mlServiceUrl}/load-default-model`, {
        modelName: 'random_forest_full_best',
        modelFile: 'random_forest_full_best_model_1456_samples.pkl',
        scalerFile: 'scaler.pkl',
        encoderFile: 'label_encoder.pkl'
      }, { timeout: 10000 });
      
      console.log('   ✅ Fallback endpoint is working');
      console.log(`   Response: ${JSON.stringify(fallbackResponse.data, null, 2)}`);
    } catch (error) {
      console.log('   ❌ Fallback endpoint failed:', error.message);
    }
    
    // 5. Recommendations
    console.log('\n5. Recommendations:');
    
    if (healthData.is_database_model) {
      console.log('   📝 To see fallback in action:');
      console.log('      1. Set ML_UPLOAD_TIMEOUT=5000 (5 seconds)');
      console.log('      2. Restart the ML service');
      console.log('      3. Watch the logs for fallback messages');
    } else if (healthData.model_id && healthData.model_id.startsWith('default_')) {
      console.log('   ✅ Fallback is already active');
      console.log('   📝 To test with database model:');
      console.log('      1. Upload a model to the database');
      console.log('      2. Set it as primary model');
      console.log('      3. Restart ML service');
    } else {
      console.log('   🔧 Service needs troubleshooting');
      console.log('   📝 Check ML service logs for errors');
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ ML service is not running on localhost:5000');
      console.log('📝 Start the ML service first');
    } else {
      console.log('❌ Error:', error.message);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Debug completed');
}

// Run debug
debugFallback().catch(console.error);

