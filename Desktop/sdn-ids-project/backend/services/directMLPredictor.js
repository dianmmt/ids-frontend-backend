// backend/services/directMLPredictor.js - Direct ML Integration without Docker
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

export class DirectMLPredictor {
  constructor(userId = null) {
    this.userId = userId;
    this.mlPath = path.join(process.cwd(), '..', 'ml');
    this.pythonPath = this.findPythonPath();
    this.modelLoaded = false;
    this.modelInfo = null;
  }

  /**
   * Find Python executable path
   */
  findPythonPath() {
    const possiblePaths = [
      'python3',
      'python',
      'py', // Windows
      '/usr/bin/python3',
      '/usr/local/bin/python3'
    ];

    for (const pythonPath of possiblePaths) {
      try {
        const result = require('child_process').execSync(`${pythonPath} --version`, { encoding: 'utf8' });
        if (result.includes('Python')) {
          return pythonPath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    throw new Error('Python not found. Please install Python 3.7+ and ensure it\'s in PATH');
  }

  /**
   * Check if ML dependencies are installed
   */
  async checkMLDependencies() {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import sys
try:
    import numpy
    import pandas
    import sklearn
    import joblib
    import flask
    print("SUCCESS: All ML dependencies are available")
    sys.exit(0)
except ImportError as e:
    print(f"ERROR: Missing dependency - {e}")
    sys.exit(1)
      `;

      const python = spawn(this.pythonPath, ['-c', pythonScript]);
      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output });
        } else {
          reject(new Error(`ML dependencies check failed: ${error || output}`));
        }
      });
    });
  }

  /**
   * Install ML dependencies
   */
  async installMLDependencies() {
    return new Promise((resolve, reject) => {
      console.log('Installing ML dependencies...');
      const requirementsPath = path.join(this.mlPath, 'requirements.txt');
      
      if (!fs.existsSync(requirementsPath)) {
        reject(new Error('requirements.txt not found in ml directory'));
        return;
      }

      const pip = spawn(this.pythonPath, ['-m', 'pip', 'install', '-r', requirementsPath]);
      let output = '';
      let error = '';

      pip.stdout.on('data', (data) => {
        output += data.toString();
        process.stdout.write(data);
      });

      pip.stderr.on('data', (data) => {
        error += data.toString();
        process.stderr.write(data);
      });

      pip.on('close', (code) => {
        if (code === 0) {
          console.log('ML dependencies installed successfully');
          resolve({ success: true, output });
        } else {
          reject(new Error(`Failed to install ML dependencies: ${error}`));
        }
      });
    });
  }

  /**
   * Run Python ML prediction directly
   */
  async runPythonPrediction(flowData) {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import sys
import os
import json
import numpy as np
import pandas as pd
from pathlib import Path

# Add ml directory to path
ml_dir = "${this.mlPath.replace(/\\/g, '/')}"
sys.path.insert(0, ml_dir)

try:
    from inference import load_model_from_folder, predict_threat
    
    # Load model
    model, context = load_model_from_folder(ml_dir)
    
    # Get flow data from stdin
    flow_data = json.loads(sys.stdin.read())
    
    # Make prediction
    result = predict_threat(flow_data, model)
    
    # Return result as JSON
    print(json.dumps({
        'success': True,
        'prediction': result.get('prediction', 'unknown'),
        'is_malicious': result.get('is_malicious', False),
        'confidence': result.get('confidence', 0.0),
        'model_type': context.get('framework', 'unknown')
    }))
    
except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e)
    }))
    sys.exit(1)
      `;

      const python = spawn(this.pythonPath, ['-c', pythonScript], {
        cwd: this.mlPath
      });

      let output = '';
      let error = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      // Send flow data to Python script
      python.stdin.write(JSON.stringify(flowData));
      python.stdin.end();

      python.on('close', (code) => {
        try {
          const result = JSON.parse(output);
          if (result.success) {
            resolve(result);
          } else {
            reject(new Error(result.error || 'Unknown Python error'));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${output}\nError: ${error}`));
        }
      });
    });
  }

  /**
   * Predict attack for packet/flow data
   */
  async predictAttack(packetData, selectionType = 'primary') {
    try {
      // Prepare data for ML model - map to CICFlowMeter features
      const mlInput = {
        // Basic flow info
        flow_duration: packetData.duration || 0,
        total_fwd_packets: packetData.total_fwd_packets || packetData.packet_count || 1,
        total_backward_packets: packetData.total_backward_packets || 0,
        total_length_of_fwd_packets: packetData.total_length_of_fwd_packets || packetData.byte_count || 0,
        total_length_of_bwd_packets: packetData.total_length_of_bwd_packets || 0,
        
        // Packet length features
        fwd_packet_length_max: packetData.fwd_packet_length_max || 0,
        fwd_packet_length_min: packetData.fwd_packet_length_min || 0,
        fwd_packet_length_mean: packetData.fwd_packet_length_mean || packetData.avg_packet_size || 0,
        fwd_packet_length_std: packetData.fwd_packet_length_std || 0,
        bwd_packet_length_max: packetData.bwd_packet_length_max || 0,
        bwd_packet_length_min: packetData.bwd_packet_length_min || 0,
        bwd_packet_length_mean: packetData.bwd_packet_length_mean || 0,
        bwd_packet_length_std: packetData.bwd_packet_length_std || 0,
        
        // Flow timing features
        flow_bytes_per_second: packetData.flow_bytes_per_second || packetData.bytes_per_second || 0,
        flow_packets_per_second: packetData.flow_packets_per_second || packetData.packets_per_second || 0,
        flow_iat_mean: packetData.flow_iat_mean || 0,
        flow_iat_std: packetData.flow_iat_std || 0,
        flow_iat_max: packetData.flow_iat_max || 0,
        flow_iat_min: packetData.flow_iat_min || 0,
        
        // Forward IAT features
        fwd_iat_total: packetData.fwd_iat_total || 0,
        fwd_iat_mean: packetData.fwd_iat_mean || 0,
        fwd_iat_std: packetData.fwd_iat_std || 0,
        fwd_iat_max: packetData.fwd_iat_max || 0,
        fwd_iat_min: packetData.fwd_iat_min || 0,
        
        // Backward IAT features
        bwd_iat_total: packetData.bwd_iat_total || 0,
        bwd_iat_mean: packetData.bwd_iat_mean || 0,
        bwd_iat_std: packetData.bwd_iat_std || 0,
        bwd_iat_max: packetData.bwd_iat_max || 0,
        bwd_iat_min: packetData.bwd_iat_min || 0,
        
        // Protocol features
        fwd_psh_flags: packetData.fwd_psh_flags || 0,
        bwd_psh_flags: packetData.bwd_psh_flags || 0,
        fwd_urg_flags: packetData.fwd_urg_flags || 0,
        bwd_urg_flags: packetData.bwd_urg_flags || 0,
        fwd_header_length: packetData.fwd_header_length || 0,
        bwd_header_length: packetData.bwd_header_length || 0,
        fwd_packets_per_second: packetData.fwd_packets_per_second || 0,
        bwd_packets_per_second: packetData.bwd_packets_per_second || 0,
        
        // Window size features
        min_packet_length: packetData.min_packet_length || 0,
        max_packet_length: packetData.max_packet_length || 0,
        packet_length_mean: packetData.packet_length_mean || packetData.avg_packet_size || 0,
        packet_length_std: packetData.packet_length_std || 0,
        packet_length_variance: packetData.packet_length_variance || 0,
        
        // Flag counts
        fin_flag_count: packetData.fin_flag_count || 0,
        syn_flag_count: packetData.syn_flag_count || 0,
        rst_flag_count: packetData.rst_flag_count || 0,
        psh_flag_count: packetData.psh_flag_count || 0,
        ack_flag_count: packetData.ack_flag_count || 0,
        urg_flag_count: packetData.urg_flag_count || 0,
        cwe_flag_count: packetData.cwe_flag_count || 0,
        ece_flag_count: packetData.ece_flag_count || 0,
        
        // Additional features
        down_up_ratio: packetData.down_up_ratio || 0,
        average_packet_size: packetData.average_packet_size || packetData.avg_packet_size || 0,
        avg_fwd_segment_size: packetData.avg_fwd_segment_size || 0,
        avg_bwd_segment_size: packetData.avg_bwd_segment_size || 0,
        
        // Extended CICFlowMeter features
        fwd_header_length_1: packetData.fwd_header_length_1 || 0,
        fwd_avg_bytes_per_bulk: packetData.fwd_avg_bytes_per_bulk || 0,
        fwd_avg_packets_per_bulk: packetData.fwd_avg_packets_per_bulk || 0,
        fwd_avg_bulk_rate: packetData.fwd_avg_bulk_rate || 0,
        bwd_avg_bytes_per_bulk: packetData.bwd_avg_bytes_per_bulk || 0,
        bwd_avg_packets_per_bulk: packetData.bwd_avg_packets_per_bulk || 0,
        bwd_avg_bulk_rate: packetData.bwd_avg_bulk_rate || 0,
        subflow_fwd_packets: packetData.subflow_fwd_packets || 0,
        subflow_bwd_packets: packetData.subflow_bwd_packets || 0,
        subflow_fwd_bytes: packetData.subflow_fwd_bytes || 0,
        subflow_bwd_bytes: packetData.subflow_bwd_bytes || 0,
        init_win_bytes_forward: packetData.init_win_bytes_forward || 0,
        init_win_bytes_backward: packetData.init_win_bytes_backward || 0,
        act_data_pkt_fwd: packetData.act_data_pkt_fwd || 0,
        min_seg_size_forward: packetData.min_seg_size_forward || 0,
        active_mean: packetData.active_mean || 0,
        active_std: packetData.active_std || 0,
        active_max: packetData.active_max || 0,
        active_min: packetData.active_min || 0,
        idle_mean: packetData.idle_mean || 0,
        idle_std: packetData.idle_std || 0,
        idle_max: packetData.idle_max || 0,
        idle_min: packetData.idle_min || 0
      };

      // Run Python prediction
      const result = await this.runPythonPrediction(mlInput);
      
      return {
        isAttack: result.is_malicious || result.prediction !== 'Normal',
        attackType: result.prediction || 'Unknown',
        severity: this.mapConfidenceToSeverity(result.confidence),
        confidence: result.confidence || 0.0,
        inferenceTime: 0, // Direct execution, no network latency
        probabilities: {},
        modelType: result.model_type || 'unknown'
      };
      
    } catch (error) {
      console.error('Direct ML Prediction Error:', error.message);
      
      // Fallback prediction - conservative approach
      return {
        isAttack: false,
        attackType: 'Normal',
        severity: 'low',
        confidence: 0.0,
        inferenceTime: 0,
        probabilities: {},
        modelType: 'fallback'
      };
    }
  }

  /**
   * Map confidence score to severity level
   */
  mapConfidenceToSeverity(confidence) {
    if (confidence >= 0.9) return 'critical';
    if (confidence >= 0.8) return 'high';
    if (confidence >= 0.6) return 'medium';
    return 'low';
  }

  /**
   * Check ML service health
   */
  async checkHealth() {
    try {
      await this.checkMLDependencies();
      return {
        status: 'healthy',
        python_path: this.pythonPath,
        ml_path: this.mlPath,
        dependencies_installed: true
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        python_path: this.pythonPath,
        ml_path: this.mlPath,
        dependencies_installed: false
      };
    }
  }

  /**
   * Test ML service with sample data
   */
  async testPrediction() {
    try {
      const sampleData = {
        flow_duration: 10.5,
        total_fwd_packets: 100,
        total_backward_packets: 50,
        total_length_of_fwd_packets: 50000,
        total_length_of_bwd_packets: 25000,
        fwd_packet_length_max: 1500,
        fwd_packet_length_min: 64,
        fwd_packet_length_mean: 500,
        fwd_packet_length_std: 200,
        bwd_packet_length_max: 1000,
        bwd_packet_length_min: 32,
        bwd_packet_length_mean: 500,
        bwd_packet_length_std: 150,
        flow_bytes_per_second: 7500,
        flow_packets_per_second: 15,
        flow_iat_mean: 1000,
        flow_iat_std: 200,
        flow_iat_max: 2000,
        flow_iat_min: 100,
        fwd_iat_total: 10000,
        fwd_iat_mean: 800,
        fwd_iat_std: 150,
        fwd_iat_max: 1500,
        fwd_iat_min: 50,
        bwd_iat_total: 5000,
        bwd_iat_mean: 1200,
        bwd_iat_std: 250,
        bwd_iat_max: 2000,
        bwd_iat_min: 100,
        fwd_psh_flags: 0,
        bwd_psh_flags: 0,
        fwd_urg_flags: 0,
        bwd_urg_flags: 0,
        fwd_header_length: 20,
        bwd_header_length: 20,
        fwd_packets_per_second: 10,
        bwd_packets_per_second: 5,
        min_packet_length: 32,
        max_packet_length: 1500,
        packet_length_mean: 500,
        packet_length_std: 200,
        packet_length_variance: 40000,
        fin_flag_count: 0,
        syn_flag_count: 1,
        rst_flag_count: 0,
        psh_flag_count: 10,
        ack_flag_count: 90,
        urg_flag_count: 0,
        cwe_flag_count: 0,
        ece_flag_count: 0,
        down_up_ratio: 2,
        average_packet_size: 500,
        avg_fwd_segment_size: 500,
        avg_bwd_segment_size: 500,
        fwd_header_length_1: 20,
        fwd_avg_bytes_per_bulk: 1000,
        fwd_avg_packets_per_bulk: 2,
        fwd_avg_bulk_rate: 0.1,
        bwd_avg_bytes_per_bulk: 500,
        bwd_avg_packets_per_bulk: 1,
        bwd_avg_bulk_rate: 0.05,
        subflow_fwd_packets: 100,
        subflow_bwd_packets: 50,
        subflow_fwd_bytes: 50000,
        subflow_bwd_bytes: 25000,
        init_win_bytes_forward: 65535,
        init_win_bytes_backward: 65535,
        act_data_pkt_fwd: 100,
        min_seg_size_forward: 0,
        active_mean: 1000,
        active_std: 200,
        active_max: 2000,
        active_min: 100,
        idle_mean: 0,
        idle_std: 0,
        idle_max: 0,
        idle_min: 0
      };

      const result = await this.predictAttack(sampleData);
      
      return {
        success: true,
        data: {
          sample_flow: sampleData,
          prediction: result.attackType,
          is_malicious: result.isAttack,
          confidence: result.confidence,
          severity: result.severity,
          model_type: result.modelType
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default DirectMLPredictor;
