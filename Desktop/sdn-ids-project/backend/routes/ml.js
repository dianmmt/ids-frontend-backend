import express from 'express';
import { verifyToken } from '../services/authService.js';
// Note: model management endpoints are served under /api/models. Remove duplicates here.
import axios from 'axios';
import config from '../services/config.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fetch from 'node-fetch';

// định nghĩa ở đầu file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Middleware: authenticate and require admin
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: 'Access token required' });
  const result = verifyToken(token);
  if (!result.valid) return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  req.user = result.user;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin access required' });
  next();
}

// Duplicated model management endpoints were removed in favor of /api/models

// POST /api/ml/predict - test model with sample data using user's selected model
router.post('/predict', authenticateToken, async (req, res) => {
  try {
    const { DirectMLPredictorWithDB } = await import('../services/directMLPredictorWithDB.js');
    
    // Get user ID and model selection from headers
    const userId = req.user?.id || req.headers['x-user-id'] || '1';
    const modelSelectionType = req.headers['x-model-selection-type'];
    
    // Create direct ML predictor instance with database support
    const mlPredictor = new DirectMLPredictorWithDB(userId);
    
    // Get the sample data from request body
    const sampleData = req.body;
    
    // Make prediction using the user's selected model
    const prediction = await mlPredictor.predictAttack(sampleData, modelSelectionType);
    
    // Return the prediction result in the format expected by frontend
    res.json({
      success: true,
      is_malicious: prediction.isAttack,
      prediction: prediction.attackType,
      confidence: prediction.confidence,
      attack_type: prediction.attackType,
      severity: prediction.severity,
      inference_time: prediction.inferenceTime,
      probabilities: prediction.probabilities,
      model_name: prediction.modelName,
      model_id: prediction.modelId
    });
    
  } catch (error) {
    console.error('ML Prediction API Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to test model',
      message: 'Model prediction failed'
    });
  }
});

// POST /api/ml/test-csv - test model with data from CSV file
router.post('/test-csv', authenticateToken, async (req, res) => {
  try {
    const fs = await import('fs');
    const path = await import('path');
    const { DirectMLPredictorWithDB } = await import('../services/directMLPredictorWithDB.js');
    
    // Get user ID and model selection from headers
    const userId = req.user?.id || req.headers['x-user-id'] || '1';
    const modelSelectionType = req.headers['x-model-selection-type'];
    
    // Path to CSV file
    const csvFilePath = path.join(__dirname, 'metasploitable-2.csv');
    
    // Check if file exists
    if (!fs.default.existsSync(csvFilePath)) {
      return res.status(404).json({
        success: false,
        error: 'CSV file not found',
        message: 'The specified CSV file does not exist'
      });
    }
    
    // Read CSV file
    const csvContent = fs.default.readFileSync(csvFilePath, 'utf8');
    const lines = csvContent.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid CSV file',
        message: 'CSV file must have at least header and one data row'
      });
    }
    
    // Get header and random data row
    const header = lines[0].split(',').map(col => col.trim());
    const randomRowIndex = Math.floor(Math.random() * (lines.length - 1)) + 1;
    const randomRow = lines[randomRowIndex].split(',').map(col => col.trim());
    
    // Define the 77 features we need
    const requiredFeatures = [
      'Protocol', 'Flow Duration', 'Tot Fwd Pkts', 'Tot Bwd Pkts', 'TotLen Fwd Pkts', 'TotLen Bwd Pkts',
      'Fwd Pkt Len Max', 'Fwd Pkt Len Min', 'Fwd Pkt Len Mean', 'Fwd Pkt Len Std', 'Bwd Pkt Len Max',
      'Bwd Pkt Len Min', 'Bwd Pkt Len Mean', 'Bwd Pkt Len Std', 'Flow Byts/s', 'Flow Pkts/s',
      'Flow IAT Mean', 'Flow IAT Std', 'Flow IAT Max', 'Flow IAT Min', 'Fwd IAT Tot', 'Fwd IAT Mean',
      'Fwd IAT Std', 'Fwd IAT Max', 'Fwd IAT Min', 'Bwd IAT Tot', 'Bwd IAT Mean', 'Bwd IAT Std',
      'Bwd IAT Max', 'Bwd IAT Min', 'Fwd PSH Flags', 'Bwd PSH Flags', 'Fwd URG Flags', 'Bwd URG Flags',
      'Fwd Header Len', 'Bwd Header Len', 'Fwd Pkts/s', 'Bwd Pkts/s', 'Pkt Len Min', 'Pkt Len Max',
      'Pkt Len Mean', 'Pkt Len Std', 'Pkt Len Var', 'FIN Flag Cnt', 'SYN Flag Cnt', 'RST Flag Cnt',
      'PSH Flag Cnt', 'ACK Flag Cnt', 'URG Flag Cnt', 'CWE Flag Count', 'ECE Flag Cnt', 'Down/Up Ratio',
      'Pkt Size Avg', 'Fwd Seg Size Avg', 'Bwd Seg Size Avg', 'Fwd Byts/b Avg', 'Fwd Pkts/b Avg',
      'Fwd Blk Rate Avg', 'Bwd Byts/b Avg', 'Bwd Pkts/b Avg', 'Bwd Blk Rate Avg', 'Subflow Fwd Pkts',
      'Subflow Fwd Byts', 'Subflow Bwd Pkts', 'Subflow Bwd Byts', 'Init Fwd Win Byts', 'Init Bwd Win Byts',
      'Fwd Act Data Pkts', 'Fwd Seg Size Min', 'Active Mean', 'Active Std', 'Active Max', 'Active Min',
      'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min'
    ];
    
    // Extract features from CSV data
    const sampleData = {};
    const missingFeatures = [];
    
    requiredFeatures.forEach(feature => {
      const featureIndex = header.findIndex(col => 
        col.toLowerCase().replace(/[^a-z0-9]/g, '') === feature.toLowerCase().replace(/[^a-z0-9]/g, '')
      );
      
      if (featureIndex !== -1 && featureIndex < randomRow.length) {
        let value = randomRow[featureIndex];
        
        // Convert to appropriate data type
        if (feature === 'Protocol') {
          sampleData[feature] = value;
        } else {
          // Convert to number, handle special cases
          const numValue = parseFloat(value);
          sampleData[feature] = isNaN(numValue) ? 0 : numValue;
        }
      } else {
        missingFeatures.push(feature);
        sampleData[feature] = feature === 'Protocol' ? 'TCP' : 0; // Default values
      }
    });
    
    // Create direct ML predictor instance with database support
    const mlServerUrl = process.env.ML_SERVER_URL || 'http://localhost:5000';
    const response = await fetch(`${mlServerUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-ID': req.user?.id || '1'
      },
      body: JSON.stringify({
        features: Object.values(sampleData) // Array of 77 features
      })
    });

    if (!response.ok) {
      throw new Error(`ML server error: ${response.statusText}`);
    }

    const prediction = await response.json();
    
    // Return the prediction result in the format expected by frontend
    res.json({
      success: true,
      is_malicious: prediction.is_malicious,
      prediction: prediction.prediction,  // This will now show specific attack type
      confidence: prediction.confidence,
      attack_type: prediction.attack_type,
      display_name: prediction.display_name,  // Human-readable attack name
      severity: prediction.severity,
      inference_time: prediction.inference_time || 'N/A',
      probabilities: prediction.probabilities || {},
      model_name: prediction.model_name || 'Best RF',
      model_id: prediction.model_id,
      csv_row_index: randomRowIndex,
      features_used: Object.keys(sampleData).length,
      missing_features: missingFeatures,
      sample_data: sampleData
    });
    
  } catch (error) {
    console.error('CSV test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Model management endpoints moved to /api/models

export default router;


