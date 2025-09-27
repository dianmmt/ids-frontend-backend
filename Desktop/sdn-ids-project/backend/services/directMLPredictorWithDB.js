// backend/services/directMLPredictorWithDB.js - Direct ML with Database Model Support
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { query } from './database.js';

export class DirectMLPredictorWithDB {
  constructor(userId = null) {
    this.userId = userId;
    this.mlPath = path.join(process.cwd(), '..', 'ml');
    this.pythonPath = null; // Lazy initialization
    this.modelLoaded = false;
    this.modelInfo = null;
    this.mlEnabled = process.env.ML_ENABLED !== 'false'; // Default to true unless explicitly disabled
  }

  /**
   * Find Python executable path (lazy initialization)
   */
  findPythonPath() {
    if (this.pythonPath) {
      return this.pythonPath;
    }

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
          this.pythonPath = pythonPath;
          return this.pythonPath;
        }
      } catch (e) {
        // Continue to next path
      }
    }
    
    throw new Error('Python not found. Please install Python 3.7+ and ensure it\'s in PATH');
  }

  /**
   * Get user's selected model from database
   */
  async getUserSelectedModel(userId, selectionType = 'primary') {
    try {
      // First try to get user's specific model selection
      const result = await query(`
        SELECT 
          mr.id, mr.name AS model_name, mr.model_type, mr.storage_path AS model_path,
          mf_scaler.file_path as scaler_path,
          mf_encoder.file_path as encoder_path
        FROM model_selections ms
        JOIN model_registry mr ON ms.model_id = mr.id
        LEFT JOIN model_files mf_scaler ON mr.id = mf_scaler.model_id AND mf_scaler.file_type = 'scaler'
        LEFT JOIN model_files mf_encoder ON mr.id = mf_encoder.model_id AND mf_encoder.file_type = 'encoder'
        WHERE ms.user_id = $1 
          AND ms.selection_type = $2
          AND ms.is_active = true
          AND mr.status = 'active'
      `, [userId, selectionType]);

      if (result.rows.length > 0) {
        console.log(`[DirectMLPredictorWithDB] Using user ${userId} selected model: ${result.rows[0].model_name}`);
        return result.rows[0];
      }

      // If no user selection, try to get any active model for this user
      const fallbackResult = await query(`
        SELECT 
          mr.id, mr.name AS model_name, mr.model_type, mr.storage_path AS model_path,
          mf_scaler.file_path as scaler_path,
          mf_encoder.file_path as encoder_path
        FROM model_selections ms
        JOIN model_registry mr ON ms.model_id = mr.id
        LEFT JOIN model_files mf_scaler ON mr.id = mf_scaler.model_id AND mf_scaler.file_type = 'scaler'
        LEFT JOIN model_files mf_encoder ON mr.id = mf_encoder.model_id AND mf_encoder.file_type = 'encoder'
        WHERE ms.user_id = $1 
          AND ms.is_active = true
          AND mr.status = 'active'
        ORDER BY ms.created_at DESC
        LIMIT 1
      `, [userId]);

      if (fallbackResult.rows.length > 0) {
        console.log(`[DirectMLPredictorWithDB] Using fallback model for user ${userId}: ${fallbackResult.rows[0].model_name}`);
        return fallbackResult.rows[0];
      }

      // If still no model, try to get any active model from registry
      const anyActiveResult = await query(`
        SELECT 
          mr.id, mr.name AS model_name, mr.model_type, mr.storage_path AS model_path,
          mf_scaler.file_path as scaler_path,
          mf_encoder.file_path as encoder_path
        FROM model_registry mr
        LEFT JOIN model_files mf_scaler ON mr.id = mf_scaler.model_id AND mf_scaler.file_type = 'scaler'
        LEFT JOIN model_files mf_encoder ON mr.id = mf_encoder.model_id AND mf_encoder.file_type = 'encoder'
        WHERE mr.status = 'active'
        ORDER BY mr.created_at DESC
        LIMIT 1
      `);

      if (anyActiveResult.rows.length > 0) {
        console.log(`[DirectMLPredictorWithDB] Using any active model for user ${userId}: ${anyActiveResult.rows[0].model_name}`);
        return anyActiveResult.rows[0];
      }

      // Final fallback to default model
      console.log(`[DirectMLPredictorWithDB] No database models found, using default model for user ${userId}`);
      return await this.getDefaultModel();
    } catch (error) {
      console.error('Error getting user selected model:', error);
      return await this.getDefaultModel();
    }
  }

  /**
   * Get default model (fallback)
   */
  async getDefaultModel() {
    // Try to find any available model files in the ml directory
    const possibleModels = [
      'random_forest_model.joblib',
      'random_forest_model.pkl',
      'model.joblib',
      'model.pkl',
      'Dense_4Layer_model_run_1.h5'
    ];
    
    const possibleScalers = [
      'scaler.joblib',
      'scaler.pkl'
    ];
    
    const possibleEncoders = [
      'label_encoder.joblib',
      'label_encoder.pkl'
    ];
    
    let modelPath = null;
    let scalerPath = null;
    let encoderPath = null;
    
    // Find first available model
    for (const modelFile of possibleModels) {
      const fullPath = path.join(this.mlPath, modelFile);
      if (fs.existsSync(fullPath)) {
        modelPath = fullPath;
        break;
      }
    }
    
    // Find first available scaler
    for (const scalerFile of possibleScalers) {
      const fullPath = path.join(this.mlPath, scalerFile);
      if (fs.existsSync(fullPath)) {
        scalerPath = fullPath;
        break;
      }
    }
    
    // Find first available encoder
    for (const encoderFile of possibleEncoders) {
      const fullPath = path.join(this.mlPath, encoderFile);
      if (fs.existsSync(fullPath)) {
        encoderPath = fullPath;
        break;
      }
    }
    
    return {
      model_name: 'default_fallback_model',
      model_type: 'scikit-learn',
      model_path: modelPath || path.join(this.mlPath, 'random_forest_model.joblib'),
      scaler_path: scalerPath,
      encoder_path: encoderPath
    };
  }

  /**
   * Run Python ML prediction with database model
   */
  async runPythonPredictionWithDB(flowData, modelInfo) {
    return new Promise((resolve, reject) => {
      const pythonScript = `
import sys
import os
import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path

# Add the ml directory to Python path for standardized preprocessing
sys.path.append('${this.mlPath.replace(/\\/g, '/')}')

try:
    # Import standardized preprocessing
    from standardized_preprocessing import standardize_flow_data, validate_feature_count
    
    # Load model from database path
    model_path = "${modelInfo.model_path.replace(/\\/g, '/')}"
    scaler_path = "${modelInfo.scaler_path?.replace(/\\/g, '/') || ''}"
    encoder_path = "${modelInfo.encoder_path?.replace(/\\/g, '/') || ''}"
    
    # Check if model file exists
    if not os.path.exists(model_path):
        print(json.dumps({
            'success': False,
            'error': f'Model file not found: {model_path}'
        }))
        sys.exit(1)
    
    # Load model
    try:
        if model_path.endswith('.joblib'):
            model = joblib.load(model_path)
        elif model_path.endswith('.pkl'):
            import pickle
            with open(model_path, 'rb') as f:
                model = pickle.load(f)
        elif model_path.endswith('.h5'):
            import tensorflow as tf
            from tensorflow import keras
            model = keras.models.load_model(model_path)
        else:
            print(json.dumps({
                'success': False,
                'error': f'Unsupported model format: {model_path}'
            }))
            sys.exit(1)
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Failed to load model: {str(e)}'
        }))
        sys.exit(1)
    
    # Load scaler if available
    scaler = None
    if scaler_path and os.path.exists(scaler_path):
        try:
            if scaler_path.endswith('.joblib'):
                scaler = joblib.load(scaler_path)
            else:
                import pickle
                with open(scaler_path, 'rb') as f:
                    scaler = pickle.load(f)
        except Exception as e:
            print(f"Warning: Failed to load scaler: {e}")
    
    # Load label encoder if available
    label_encoder = None
    if encoder_path and os.path.exists(encoder_path):
        try:
            if encoder_path.endswith('.joblib'):
                label_encoder = joblib.load(encoder_path)
            else:
                import pickle
                with open(encoder_path, 'rb') as f:
                    label_encoder = pickle.load(f)
        except Exception as e:
            print(f"Warning: Failed to load label encoder: {e}")
    
    # Get flow data from stdin
    flow_data = json.loads(sys.stdin.read())
    
    # Use standardized preprocessing
    feature_array = standardize_flow_data(flow_data)
    
    # Validate feature count
    if not validate_feature_count(feature_array):
        print(json.dumps({
            'success': False,
            'error': 'Feature count validation failed'
        }))
        sys.exit(1)
    
    # Apply scaler if available
    if scaler is not None:
        try:
            feature_array = scaler.transform(feature_array)
        except Exception as e:
            print(f"Scaler warning: {e}")
    
    # Make prediction
    prediction = model.predict(feature_array)[0]
    
    # Get confidence if available
    confidence = 0.0
    if hasattr(model, 'predict_proba'):
        try:
            probabilities = model.predict_proba(feature_array)[0]
            confidence = float(np.max(probabilities))
        except:
            pass
    
    # Apply label encoder if available
    if label_encoder is not None:
        try:
            if isinstance(prediction, (np.integer, int)):
                prediction = label_encoder.inverse_transform([prediction])[0]
            else:
                prediction = str(prediction)
        except:
            prediction = str(prediction)
    else:
        prediction = str(prediction)
    
    # Determine if malicious
    is_malicious = prediction.lower() not in ['normal', 'benign', 'legitimate']
    
    # Return result as JSON
    print(json.dumps({
        'success': True,
        'prediction': prediction,
        'is_malicious': is_malicious,
        'confidence': confidence,
        'model_name': "${modelInfo.model_name}",
        'model_type': "${modelInfo.model_type}"
    }))
    
except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e)
    }))
    sys.exit(1)
      `;

      const python = spawn(this.findPythonPath(), ['-c', pythonScript], {
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
   * Predict attack for packet/flow data using database model
   */
  async predictAttack(packetData, selectionType = 'primary') {
    try {
      // Check if Python is available
      if (!this.isPythonAvailable()) {
        console.warn('Python not available, returning fallback prediction');
        return {
          isAttack: false,
          attackType: 'Normal',
          severity: 'low',
          confidence: 0.0,
          inferenceTime: 0,
          probabilities: {},
          modelName: 'fallback',
          modelType: 'fallback'
        };
      }

      // Get user's selected model from database
      const modelInfo = await this.getUserSelectedModel(this.userId, selectionType);
      
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

      // Run Python prediction with database model
      const result = await this.runPythonPredictionWithDB(mlInput, modelInfo);
      
      return {
        isAttack: result.is_malicious || result.prediction !== 'Normal',
        attackType: result.prediction || 'Unknown',
        severity: this.mapConfidenceToSeverity(result.confidence),
        confidence: result.confidence || 0.0,
        inferenceTime: 0,
        probabilities: {},
        modelName: result.model_name || 'unknown',
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
        modelName: 'fallback',
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
   * Check if Python is available
   */
  isPythonAvailable() {
    if (!this.mlEnabled) {
      return false;
    }
    
    try {
      this.findPythonPath();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check ML service health
   */
  async checkHealth() {
    try {
      if (!this.isPythonAvailable()) {
        return {
          status: 'unhealthy',
          error: 'Python not available',
          python_path: null,
          ml_path: this.mlPath
        };
      }

      const modelInfo = await this.getUserSelectedModel(this.userId);
      return {
        status: 'healthy',
        python_path: this.pythonPath,
        ml_path: this.mlPath,
        current_model: modelInfo.model_name,
        model_type: modelInfo.model_type
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        python_path: this.pythonPath,
        ml_path: this.mlPath
      };
    }
  }
}

export default DirectMLPredictorWithDB;
