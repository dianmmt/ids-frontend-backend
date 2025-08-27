// Simple test script to verify performance API endpoints
import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001/api';

async function testPerformanceAPI() {
  console.log('🧪 Testing Performance API Endpoints...\n');

  const endpoints = [
    '/performance/current',
    '/performance/alerts',
    '/performance/health',
    '/performance/ml',
    '/performance/database',
    '/performance/network'
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}...`);
      const response = await fetch(`${API_BASE}${endpoint}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${endpoint} - Status: ${response.status}`);
        console.log(`   Data:`, data.length || data);
      } else {
        console.log(`❌ ${endpoint} - Status: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.log(`❌ ${endpoint} - Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('🎉 API testing completed!');
}

// Run the test
testPerformanceAPI();

