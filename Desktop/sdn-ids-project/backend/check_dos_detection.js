// Script để kiểm tra hệ thống phát hiện tấn công DoS
import pg from 'pg';
const { Pool } = pg;

// Use native fetch (Node.js 18+)
const fetch = globalThis.fetch || (await import('node-fetch')).default;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'sdn_ids',
  user: process.env.DB_USER || 'sdn_user',
  password: process.env.DB_PASSWORD || 'sdn_password'
});

async function checkMLService() {
  console.log('\n=== Kiểm tra ML Service ===');
  try {
    const response = await fetch('http://localhost:5000/health');
    const data = await response.json();
    console.log('✓ ML Service đang chạy');
    console.log('  Status:', data.status);
    console.log('  Model loaded:', data.model_loaded);
    console.log('  Model ID:', data.model_id);
    return true;
  } catch (error) {
    console.log('✗ ML Service KHÔNG chạy:', error.message);
    console.log('  Vui lòng khởi động ML service: cd ml && python3 ml_server.py');
    return false;
  }
}

async function testDosDetection() {
  console.log('\n=== Test phát hiện tấn công DoS ===');
  try {
    // Tạo dữ liệu giả lập tấn công DoS
    const dosFeatures = {
      "Protocol": 6,
      "Flow Duration": 100000,
      "Tot Fwd Pkts": 1000,
      "Tot Bwd Pkts": 0,
      "TotLen Fwd Pkts": 500000,
      "TotLen Bwd Pkts": 0,
      "Fwd Pkt Len Max": 1500,
      "Fwd Pkt Len Min": 500,
      "Fwd Pkt Len Mean": 500,
      "Fwd Pkt Len Std": 100,
      "Bwd Pkt Len Max": 0,
      "Bwd Pkt Len Min": 0,
      "Bwd Pkt Len Mean": 0,
      "Bwd Pkt Len Std": 0,
      "Flow Byts/s": 5000000,
      "Flow Pkts/s": 10000,
      "Flow IAT Mean": 100,
      "Flow IAT Std": 50,
      "Flow IAT Max": 200,
      "Flow IAT Min": 50,
      "Fwd IAT Tot": 100000,
      "Fwd IAT Mean": 100,
      "Fwd IAT Std": 50,
      "Fwd IAT Max": 200,
      "Fwd IAT Min": 50,
      "Bwd IAT Tot": 0,
      "Bwd IAT Mean": 0,
      "Bwd IAT Std": 0,
      "Bwd IAT Max": 0,
      "Bwd IAT Min": 0,
      "Fwd PSH Flags": 0,
      "Bwd PSH Flags": 0,
      "Fwd URG Flags": 0,
      "Bwd URG Flags": 0,
      "Fwd Header Len": 20000,
      "Bwd Header Len": 0,
      "Fwd Pkts/s": 10000,
      "Bwd Pkts/s": 0,
      "Pkt Len Min": 500,
      "Pkt Len Max": 1500,
      "Pkt Len Mean": 500,
      "Pkt Len Std": 100,
      "Pkt Len Var": 10000,
      "FIN Flag Cnt": 0,
      "SYN Flag Cnt": 1000,
      "RST Flag Cnt": 0,
      "PSH Flag Cnt": 0,
      "ACK Flag Cnt": 0,
      "URG Flag Cnt": 0,
      "CWE Flag Count": 0,
      "ECE Flag Cnt": 0,
      "Down/Up Ratio": 0,
      "Pkt Size Avg": 500,
      "Fwd Seg Size Avg": 500,
      "Bwd Seg Size Avg": 0,
      "Fwd Byts/b Avg": 0,
      "Fwd Pkts/b Avg": 0,
      "Fwd Blk Rate Avg": 0,
      "Bwd Byts/b Avg": 0,
      "Bwd Pkts/b Avg": 0,
      "Bwd Blk Rate Avg": 0,
      "Subflow Fwd Pkts": 1000,
      "Subflow Fwd Byts": 500000,
      "Subflow Bwd Pkts": 0,
      "Subflow Bwd Byts": 0,
      "Init Fwd Win Byts": 8192,
      "Init Bwd Win Byts": 0,
      "Fwd Act Data Pkts": 1000,
      "Fwd Seg Size Min": 20,
      "Active Mean": 100,
      "Active Std": 50,
      "Active Max": 200,
      "Active Min": 50,
      "Idle Mean": 0,
      "Idle Std": 0,
      "Idle Max": 0,
      "Idle Min": 0
    };

    console.log('Gửi dữ liệu DoS tới ML service...');
    const response = await fetch('http://localhost:5000/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dosFeatures)
    });

    const result = await response.json();
    console.log('\nKết quả phát hiện:');
    console.log('  Is malicious:', result.is_malicious);
    console.log('  Attack type:', result.attack_type);
    console.log('  Prediction:', result.prediction);
    console.log('  Severity:', result.severity);
    console.log('  Confidence:', result.confidence);
    console.log('  Model ID:', result.model_id);

    if (result.is_malicious && (result.attack_type === 'DoS' || result.attack_type === 'DDoS')) {
      console.log('\n✓ ML Model CHÍNH XÁC phát hiện tấn công DoS!');
      return true;
    } else {
      console.log('\n⚠ ML Model KHÔNG phát hiện được DoS hoặc phân loại sai!');
      console.log('  Có thể model cần được train lại hoặc threshold cần điều chỉnh.');
      return false;
    }
  } catch (error) {
    console.log('✗ Lỗi khi test:', error.message);
    return false;
  }
}

async function checkFlowData() {
  console.log('\n=== Kiểm tra dữ liệu Flow trong database ===');
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_flows,
        COUNT(CASE WHEN captured_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as flows_last_5min,
        COUNT(CASE WHEN captured_at > NOW() - INTERVAL '1 hour' THEN 1 END) as flows_last_hour,
        MAX(captured_at) as latest_flow
      FROM flows
    `);
    
    const stats = result.rows[0];
    console.log('  Tổng số flows:', stats.total_flows);
    console.log('  Flows trong 5 phút qua:', stats.flows_last_5min);
    console.log('  Flows trong 1 giờ qua:', stats.flows_last_hour);
    console.log('  Flow mới nhất:', stats.latest_flow);

    if (parseInt(stats.total_flows) === 0) {
      console.log('\n⚠ KHÔNG có dữ liệu flow nào trong database!');
      console.log('  Nguyên nhân có thể:');
      console.log('  1. CICFlowMeter collector chưa được khởi động');
      console.log('  2. Không có network traffic đang được capture');
      console.log('  3. CICFlowMeter chưa được cấu hình đúng');
      return false;
    } else if (parseInt(stats.flows_last_5min) === 0) {
      console.log('\n⚠ KHÔNG có flow mới trong 5 phút qua!');
      console.log('  CICFlowMeter collector có thể đã dừng hoặc không capture được traffic.');
      return false;
    } else {
      console.log('\n✓ Có dữ liệu flow trong database');
      return true;
    }
  } catch (error) {
    console.log('✗ Lỗi khi truy vấn database:', error.message);
    return false;
  }
}

async function checkAttackAlerts() {
  console.log('\n=== Kiểm tra Attack Alerts ===');
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN detected_at > NOW() - INTERVAL '5 minutes' THEN 1 END) as alerts_last_5min,
        COUNT(CASE WHEN detected_at > NOW() - INTERVAL '1 hour' THEN 1 END) as alerts_last_hour,
        COUNT(CASE WHEN attack_type ILIKE '%dos%' THEN 1 END) as dos_alerts,
        MAX(detected_at) as latest_alert
      FROM attack_events
    `);
    
    const stats = result.rows[0];
    console.log('  Tổng số alerts:', stats.total_alerts);
    console.log('  Alerts trong 5 phút qua:', stats.alerts_last_5min);
    console.log('  Alerts trong 1 giờ qua:', stats.alerts_last_hour);
    console.log('  DoS alerts:', stats.dos_alerts);
    console.log('  Alert mới nhất:', stats.latest_alert);

    // Kiểm tra các alerts gần đây
    const recentAlerts = await pool.query(`
      SELECT attack_type, severity, src_ip, dst_ip, detected_at, confidence_score
      FROM attack_events
      WHERE detected_at > NOW() - INTERVAL '1 hour'
      ORDER BY detected_at DESC
      LIMIT 5
    `);

    if (recentAlerts.rows.length > 0) {
      console.log('\n  Các alert gần đây:');
      recentAlerts.rows.forEach((alert, index) => {
        console.log(`  ${index + 1}. [${alert.severity}] ${alert.attack_type} - ${alert.src_ip} → ${alert.dst_ip}`);
        console.log(`     Confidence: ${(alert.confidence_score * 100).toFixed(1)}% | ${alert.detected_at}`);
      });
    }

    return parseInt(stats.total_alerts) > 0;
  } catch (error) {
    console.log('✗ Lỗi khi truy vấn alerts:', error.message);
    return false;
  }
}

async function checkPipelineProcessor() {
  console.log('\n=== Kiểm tra Pipeline Processor ===');
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_flows,
        COUNT(CASE WHEN is_processed = true THEN 1 END) as processed_flows,
        COUNT(CASE WHEN is_processed = false THEN 1 END) as unprocessed_flows
      FROM flows
      WHERE captured_at > NOW() - INTERVAL '1 hour'
    `);
    
    const stats = result.rows[0];
    console.log('  Total flows (1h):', stats.total_flows);
    console.log('  Processed flows:', stats.processed_flows);
    console.log('  Unprocessed flows:', stats.unprocessed_flows);

    if (parseInt(stats.total_flows) > 0 && parseInt(stats.unprocessed_flows) === parseInt(stats.total_flows)) {
      console.log('\n⚠ TẤT CẢ flows đều CHƯA được xử lý!');
      console.log('  Pipeline processor có thể không chạy hoặc bị lỗi.');
      return false;
    } else if (parseInt(stats.processed_flows) > 0) {
      console.log('\n✓ Pipeline processor đang hoạt động');
      return true;
    }
    
    return true;
  } catch (error) {
    console.log('✗ Lỗi:', error.message);
    return false;
  }
}

async function main() {
  console.log('==========================================');
  console.log('KIỂM TRA HỆ THỐNG PHÁT HIỆN TẤN CÔNG DOS');
  console.log('==========================================');

  const mlOk = await checkMLService();
  const testOk = mlOk ? await testDosDetection() : false;
  const flowOk = await checkFlowData();
  const pipelineOk = await checkPipelineProcessor();
  const alertOk = await checkAttackAlerts();

  console.log('\n==========================================');
  console.log('KẾT QUẢ TỔNG QUAN');
  console.log('==========================================');
  console.log(`ML Service: ${mlOk ? '✓ OK' : '✗ FAILED'}`);
  console.log(`DoS Detection Test: ${testOk ? '✓ OK' : '✗ FAILED'}`);
  console.log(`Flow Data: ${flowOk ? '✓ OK' : '⚠ NO DATA'}`);
  console.log(`Pipeline Processor: ${pipelineOk ? '✓ OK' : '⚠ ISSUE'}`);
  console.log(`Attack Alerts: ${alertOk ? '✓ HAS ALERTS' : '⚠ NO ALERTS'}`);

  console.log('\n==========================================');
  console.log('KHUYẾN NGHỊ');
  console.log('==========================================');

  if (!mlOk) {
    console.log('1. Khởi động ML service:');
    console.log('   cd ml');
    console.log('   python3 ml_server.py');
  }

  if (!flowOk) {
    console.log('2. CICFlowMeter không thu thập được dữ liệu:');
    console.log('   - Kiểm tra CICFlowMeter có đang chạy không');
    console.log('   - Đảm bảo có network traffic đang được capture');
    console.log('   - Kiểm tra cấu hình CSV path/directory');
  }

  if (!pipelineOk) {
    console.log('3. Pipeline processor không xử lý flows:');
    console.log('   - Kiểm tra service orchestrator');
    console.log('   - Xem logs của backend để tìm lỗi');
    console.log('   - Khởi động lại backend để start pipeline processor');
    console.log('   - Hoặc trigger manual: curl -X POST http://localhost:3001/api/cicflowmeter/start');
  }

  if (mlOk && flowOk && !alertOk) {
    console.log('4. ML service và data có nhưng không có alerts:');
    console.log('   - Kiểm tra xem tất cả flows có đang được phân loại là "Normal" không');
    console.log('   - Traffic hiện tại có thể thực sự là normal traffic');
    console.log('   - Thử tạo traffic tấn công thực tế để test');
  }

  if (!testOk && mlOk) {
    console.log('5. ML model không phát hiện được DoS từ test data:');
    console.log('   - Model có thể cần được train lại với dữ liệu DoS');
    console.log('   - Kiểm tra label encoder và mapping');
    console.log('   - Kiểm tra threshold confidence score');
    console.log('   - Model hiện tại classify DOS thành "Normal Traffic" - CẦN TRAIN LẠI!');
  }

  await pool.end();
}

main().catch(console.error);

