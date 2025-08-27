// Test script for refresh functionality
import performanceService from './services/performanceService.js';

async function testRefreshFunctionality() {
  console.log('🔄 Testing Refresh Functionality...\n');

  try {
    // Test initial data collection
    console.log('1. Initial Performance Data Collection...');
    const initialResult = await performanceService.collectAllPerformanceData();
    console.log('✅ Initial collection result:', initialResult);

    // Test getting latest metrics
    console.log('\n2. Getting Latest System Metrics...');
    const initialMetrics = await performanceService.getLatestSystemMetrics();
    console.log('✅ Initial metrics:', initialMetrics.length, 'metrics');
    initialMetrics.forEach(metric => {
      console.log(`   - ${metric.name}: ${metric.value}${metric.unit} (${metric.status})`);
    });

    // Wait a moment to simulate time passing
    console.log('\n3. Waiting 2 seconds to simulate time passing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test refresh (collect new data)
    console.log('\n4. Refreshing Performance Data...');
    const refreshResult = await performanceService.collectAllPerformanceData();
    console.log('✅ Refresh collection result:', refreshResult);

    // Get updated metrics
    console.log('\n5. Getting Updated System Metrics...');
    const updatedMetrics = await performanceService.getLatestSystemMetrics();
    console.log('✅ Updated metrics:', updatedMetrics.length, 'metrics');
    updatedMetrics.forEach(metric => {
      console.log(`   - ${metric.name}: ${metric.value}${metric.unit} (${metric.status})`);
    });

    // Test getting all performance data
    console.log('\n6. Getting All Performance Data...');
    const allData = await performanceService.getLatestPerformanceData();
    console.log('✅ All performance data retrieved:');
    console.log('   - ML Performance:', allData.ml_performance ? 'Available' : 'Not available');
    console.log('   - Database Performance:', allData.database_performance ? 'Available' : 'Not available');
    console.log('   - Network Statistics:', allData.network_statistics ? 'Available' : 'Not available');
    console.log('   - System Health:', allData.system_health ? 'Available' : 'Not available');

    // Test getting active alerts
    console.log('\n7. Getting Active Alerts...');
    const alerts = await performanceService.getActiveAlerts();
    console.log('✅ Active alerts:', alerts.length);

    console.log('\n🎉 Refresh functionality test completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Initial collection: ${initialResult.success ? 'Success' : 'Failed'}`);
    console.log(`   - Refresh collection: ${refreshResult.success ? 'Success' : 'Failed'}`);
    console.log(`   - Metrics updated: ${initialMetrics.length} → ${updatedMetrics.length}`);
    console.log(`   - Active alerts: ${alerts.length}`);

  } catch (error) {
    console.error('❌ Error during refresh testing:', error);
    process.exit(1);
  }
}

// Run the test
testRefreshFunctionality();
