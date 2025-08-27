// Test script for performance calculations
import performanceService from './services/performanceService.js';
import os from 'os';

async function testPerformanceCalculations() {
  console.log('🧪 Testing Performance Calculations...\n');

  try {
    // Test system metrics collection
    console.log('1. Testing System Metrics Collection...');
    const systemMetrics = await performanceService.collectSystemMetrics();
    console.log('✅ System metrics collected:', systemMetrics.length, 'metrics');
    systemMetrics.forEach(metric => {
      console.log(`   - ${metric.name}: ${metric.value}${metric.unit} (${metric.status})`);
    });

    // Test CPU usage calculation
    console.log('\n2. Testing CPU Usage Calculation...');
    const cpuUsage = await performanceService.calculateCPUUsage();
    console.log(`✅ CPU Usage: ${cpuUsage}%`);

    // Test memory usage calculation
    console.log('\n3. Testing Memory Usage Calculation...');
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = ((totalMem - freeMem) / totalMem) * 100;
    console.log(`✅ Memory Usage: ${memoryUsage.toFixed(2)}%`);
    console.log(`   - Total: ${(totalMem / 1024 / 1024 / 1024).toFixed(2)} GB`);
    console.log(`   - Free: ${(freeMem / 1024 / 1024 / 1024).toFixed(2)} GB`);

    // Test disk usage calculation
    console.log('\n4. Testing Disk Usage Calculation...');
    const diskUsage = await performanceService.calculateDiskUsage();
    console.log(`✅ Disk Usage: ${diskUsage}%`);

    // Test network load calculation
    console.log('\n5. Testing Network Load Calculation...');
    const networkLoad = await performanceService.calculateNetworkLoad();
    console.log(`✅ Network Load: ${networkLoad}%`);

    // Test ML performance collection
    console.log('\n6. Testing ML Performance Collection...');
    const mlMetrics = await performanceService.collectMLMetrics();
    console.log('✅ ML metrics collected:', mlMetrics);

    // Test database performance collection
    console.log('\n7. Testing Database Performance Collection...');
    const dbMetrics = await performanceService.collectDatabaseMetrics();
    console.log('✅ Database metrics collected:', dbMetrics);

    // Test network statistics collection
    console.log('\n8. Testing Network Statistics Collection...');
    const networkStats = await performanceService.collectNetworkStats();
    console.log('✅ Network statistics collected:', networkStats);

    // Test system health collection
    console.log('\n9. Testing System Health Collection...');
    const healthMetrics = await performanceService.collectSystemHealth();
    console.log('✅ System health collected:', healthMetrics);

    // Test complete performance data collection
    console.log('\n10. Testing Complete Performance Data Collection...');
    const allData = await performanceService.collectAllPerformanceData();
    console.log('✅ All performance data collected:', allData);

    console.log('\n🎉 All performance calculations completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - System Metrics: ${systemMetrics.length}`);
    console.log(`   - CPU Usage: ${cpuUsage}%`);
    console.log(`   - Memory Usage: ${memoryUsage.toFixed(2)}%`);
    console.log(`   - Disk Usage: ${diskUsage}%`);
    console.log(`   - Network Load: ${networkLoad}%`);
    console.log(`   - Overall Health Score: ${healthMetrics.healthScore}/100`);

  } catch (error) {
    console.error('❌ Error during performance testing:', error);
    process.exit(1);
  }
}

// Run the test
testPerformanceCalculations();
