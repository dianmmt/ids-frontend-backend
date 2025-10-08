// Script để trigger manual processing của Pipeline Processor
import { PipelineProcessor } from './services/pipelineProcessor.js';
import { query, closeDatabase } from './services/database.js';

async function main() {
  console.log('🔧 Triggering Pipeline Processor manually...\n');
  
  // Kiểm tra số flows chưa xử lý
  const unprocessedResult = await query(`
    SELECT COUNT(*) as count 
    FROM flows 
    WHERE is_processed = false
  `);
  
  const unprocessedCount = parseInt(unprocessedResult.rows[0].count);
  console.log(`📊 Unprocessed flows: ${unprocessedCount}`);
  
  if (unprocessedCount === 0) {
    console.log('✅ Không có flows nào cần xử lý!');
    await closeDatabase();
    return;
  }
  
  // Tạo Pipeline Processor instance
  const processor = new PipelineProcessor({
    batchSize: 50,
    processingInterval: 30000
  });
  
  // ⚡ FIX: Set isRunning = true để bypass check
  processor.isRunning = true;
  
  console.log('\n🚀 Bắt đầu xử lý flows...');
  
  try {
    // Xử lý flows một lần (không cần start scheduler)
    await processor.processUnprocessedFlows();
    
    // Kiểm tra kết quả
    const stats = processor.getStats();
    console.log('\n📈 Kết quả:');
    console.log(`   ✅ Processed: ${stats.totalProcessed} flows`);
    console.log(`   🚨 Attacks detected: ${stats.totalAttacks}`);
    console.log(`   ⚠️  Errors: ${stats.totalErrors}`);
    console.log(`   ⏱️  Processing time: ${stats.processingTime}ms`);
    
    // Kiểm tra alerts mới
    const alertsResult = await query(`
      SELECT attack_type, severity, src_ip, dst_ip, confidence_score, detected_at
      FROM attack_events
      WHERE detected_at > NOW() - INTERVAL '5 minutes'
      ORDER BY detected_at DESC
      LIMIT 10
    `);
    
    if (alertsResult.rows.length > 0) {
      console.log('\n🚨 Alerts vừa phát hiện:');
      alertsResult.rows.forEach((alert, i) => {
        console.log(`   ${i+1}. [${alert.severity.toUpperCase()}] ${alert.attack_type}`);
        console.log(`      ${alert.src_ip} → ${alert.dst_ip} (${(alert.confidence_score * 100).toFixed(1)}%)`);
      });
    } else {
      console.log('\n⚠️  Không có alerts mới');
      console.log('   ℹ️  Có thể tất cả flows đều được classify là Normal Traffic');
      console.log('   ℹ️  Đây là vấn đề với ML model - cần train lại!');
    }
    
    // Kiểm tra xem có bao nhiêu flows được classify là Normal
    const normalResult = await query(`
      SELECT COUNT(*) as count
      FROM flows
      WHERE is_processed = true
      AND label ILIKE '%normal%'
      AND processed_at > NOW() - INTERVAL '5 minutes'
    `);
    
    if (normalResult.rows.length > 0) {
      const normalCount = parseInt(normalResult.rows[0].count);
      if (normalCount > 0) {
        console.log(`\n📊 Flows được classify là Normal: ${normalCount}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Lỗi khi xử lý:', error);
    console.error(error.stack);
  }
  
  await closeDatabase();
  console.log('\n✅ Hoàn tất!');
}

main().catch(console.error);
