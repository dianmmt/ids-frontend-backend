// backend/services/directMLPredictorWithDB.js - Direct ML with Database Model Support
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { query } from './database.js';
import { CICFlowMeterFeatureMapper } from './cicflowmeterFeatureMapper.js';
import fetch from 'node-fetch';

export class DirectMLPredictorWithDB {
  constructor(userId = null, options = {}) {
    this.userId = userId;
    this.mlPath = path.join(process.cwd(), '..', 'ml');
    this.pythonPath = null; // Lazy initialization
    this.modelLoaded = false;
    this.modelInfo = null;
    this.timeout = options.timeout || 30000;
    this.mlEnabled = process.env.ML_ENABLED !== 'false'; // Default to true unless explicitly disabled
    // Initialize feature mapper for consistent feature processing
    this.featureMapper = new CICFlowMeterFeatureMapper();
  }

  /**
   * Find Python executable path (lazy initialization)
   */
  findPythonPath() {
    if (this.pythonPath) {
      return this.pythonPath;
    }

    // Prioritize python3 first since it's working
    const possiblePaths = [
      'python3',          // Linux/macOS
      '/usr/bin/python3', // Common Linux path
      'python',           // Generic alias
      'py',               // Windows
      '/usr/local/bin/python3'
    ];

    for (const pythonPath of possiblePaths) {
      try {
        console.log(`[DirectMLPredictorWithDB] Testing Python: ${pythonPath}`);
        const result = execSync(`${pythonPath} --version`, {
          encoding: 'utf8',
          timeout: 5000
        });

        console.log(`[DirectMLPredictorWithDB] ✓ ${pythonPath} output: ${result.trim()}`);

        if (result.includes('Python')) {
          this.pythonPath = pythonPath;
          console.log(`[DirectMLPredictorWithDB] ✓ Selected: ${pythonPath}`);
          return this.pythonPath;
        }
      } catch (e) {
        console.log(`[DirectMLPredictorWithDB] ✗ ${pythonPath} failed: ${e.message}`);
      }
    }

    throw new Error('Python not found. Please install Python 3.7+ and ensure it\'s in PATH');
  }

  /**
   * Get user's selected model from database (TEMPORARILY DISABLED - using local models)
   */
  async getUserSelectedModel(userId, selectionType = 'primary') {
    // TEMPORARILY DISABLED: Always use local models instead of database models
    console.log(`[DirectMLPredictorWithDB] TEMPORARILY using local models instead of database models for user ${userId}`);
    
    // Skip database lookup and go directly to local model fallback
    return await this.getDefaultModel();
    
    /* ORIGINAL DATABASE CODE (DISABLED)
    try {
      // First try to get user's specific model selection
      const result = await query(`
        SELECT 
          mr.id, mr.name AS model_name, mr.version AS model_version, mr.model_type, mr.storage_path AS model_path,
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
        const modelRow = result.rows[0];
        console.log(`[DirectMLPredictorWithDB] Using user ${userId} selected model: ${modelRow.model_name}`);
        
        // Ensure we have valid model paths
        if (!modelRow.model_path) {
          console.warn(`[DirectMLPredictorWithDB] Model ${modelRow.model_name} has no storage path, will use folder loading`);
        }
        
        return modelRow;
      }
    */

    /* ORIGINAL DATABASE FALLBACK CODE (DISABLED)
      // If no user selection, try to get any active model for this user
      const fallbackResult = await query(`
        SELECT 
          mr.id, mr.name AS model_name, mr.version AS model_version, mr.model_type, mr.storage_path AS model_path,
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
        const modelRow = fallbackResult.rows[0];
        console.log(`[DirectMLPredictorWithDB] Using fallback model for user ${userId}: ${modelRow.model_name}`);
        
        // Ensure we have valid model paths
        if (!modelRow.model_path) {
          console.warn(`[DirectMLPredictorWithDB] Fallback model ${modelRow.model_name} has no storage path, will use folder loading`);
        }
        
        return modelRow;
      }

      // If still no model, try to get any active model from registry
      const anyActiveResult = await query(`
        SELECT 
          mr.id, mr.name AS model_name, mr.version AS model_version, mr.model_type, mr.storage_path AS model_path,
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
        const modelRow = anyActiveResult.rows[0];
        console.log(`[DirectMLPredictorWithDB] Using any active model for user ${userId}: ${modelRow.model_name}`);
        
        // Ensure we have valid model paths
        if (!modelRow.model_path) {
          console.warn(`[DirectMLPredictorWithDB] Active model ${modelRow.model_name} has no storage path, will use folder loading`);
        }
        
        return modelRow;
      }

      // Final fallback to default model
      console.log(`[DirectMLPredictorWithDB] No database models found, using default model for user ${userId}`);
    */
    
    // Always use local model fallback instead of database
    return await this.getDefaultModel();
  }

  /**
   * Get default model (fallback)
   */
  async getDefaultModel() {
    // Try to find any available model files in the ml directory
    // ORDER MATTERS: First model found will be used
    const possibleModels = [
      'random_forest_full_best_model_1456_samples.pkl',  // ← New best model first
      'Dense_4Layer_model_run_1.h5',                     // ← Neural network model
      'random_forest_model.joblib',                      // ← Original model
      'random_forest_model.pkl',                         // ← Backup model
      'model.joblib',                                    // ← Generic model
      'model.pkl'                                        // ← Generic backup
    ];

    const possibleScalers = [
      'scaler.joblib'
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
        console.log(`[DirectMLPredictorWithDB] Selected model: ${modelFile}`);
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
from pathlib import Path
import pickle
import joblib

# Add ml directory to path
ml_dir = "${this.mlPath.replace(/\\/g, '/')}"
sys.path.insert(0, ml_dir)

# ============================================================================
# CUSTOM UNPICKLER - Fix for "No module named 'models.sklearn_models'" error
# ============================================================================

class CustomUnpickler(pickle.Unpickler):
    """Custom unpickler to handle missing modules"""
    def find_class(self, module, name):
        # Try original module first
        try:
            return super().find_class(module, name)
        except (ImportError, AttributeError) as e:
            print(f"Module {module}.{name} not found: {e}", file=sys.stderr)
            
            # If 'models' module not found, try sklearn
            if module.startswith('models.'):
                try:
                    sklearn_module = module.replace('models.', 'sklearn.')
                    print(f"Trying sklearn equivalent: {sklearn_module}.{name}", file=sys.stderr)
                    return super().find_class(sklearn_module, name)
                except Exception as sklearn_error:
                    print(f"sklearn equivalent failed: {sklearn_error}", file=sys.stderr)
            
            # Try common module mappings
            module_mappings = {
                'models': 'sklearn',
                'models.ensemble': 'sklearn.ensemble',
                'models.tree': 'sklearn.tree',
                'models.linear_model': 'sklearn.linear_model',
                'models.sklearn_models': 'sklearn.ensemble',  # Specific fix for this error
            }
            
            for old_prefix, new_prefix in module_mappings.items():
                if module.startswith(old_prefix):
                    try:
                        new_module = module.replace(old_prefix, new_prefix)
                        print(f"Trying mapping: {new_module}.{name}", file=sys.stderr)
                        return super().find_class(new_module, name)
                    except:
                        pass
            
            # If still not found, create dummy class
            print(f"Creating dummy class for {module}.{name}", file=sys.stderr)
            return type(name, (), {})

def safe_joblib_load(filepath):
    """Safely load joblib file with custom unpickler"""
    try:
        return joblib.load(filepath)
    except Exception as e:
        print(f"Standard joblib load failed: {e}, trying custom unpickler", file=sys.stderr)
        try:
            with open(filepath, 'rb') as f:
                unpickler = CustomUnpickler(f)
                return unpickler.load()
        except Exception as e2:
            print(f"Custom unpickler also failed: {e2}", file=sys.stderr)
            raise e2

def safe_pickle_load(filepath):
    """Safely load pickle file with custom unpickler"""
    try:
        with open(filepath, 'rb') as f:
            return pickle.load(f)
    except Exception as e:
        print(f"Standard pickle load failed: {e}, trying custom unpickler", file=sys.stderr)
        try:
            with open(filepath, 'rb') as f:
                unpickler = CustomUnpickler(f)
                return unpickler.load()
        except Exception as e2:
            print(f"Custom unpickler also failed: {e2}", file=sys.stderr)
            raise e2

def extract_sklearn_model(loaded_model):
    """Extract sklearn model from wrapper classes"""
    print(f"Extracting sklearn model from: {type(loaded_model).__name__}", file=sys.stderr)
    
    # If it's already a sklearn model, return as is
    if hasattr(loaded_model, 'predict') and hasattr(loaded_model, 'predict_proba'):
        print(f"Model is already sklearn-compatible: {type(loaded_model).__name__}", file=sys.stderr)
        return loaded_model
    
    # Try to extract from common wrapper patterns
    extraction_methods = [
        # Method 1: Check for 'model' attribute
        lambda m: getattr(m, 'model', None),
        # Method 2: Check for 'estimator' attribute  
        lambda m: getattr(m, 'estimator', None),
        # Method 3: Check for 'classifier' attribute
        lambda m: getattr(m, 'classifier', None),
        # Method 4: Check for 'regressor' attribute
        lambda m: getattr(m, 'regressor', None),
        # Method 5: Check for 'sklearn_model' attribute
        lambda m: getattr(m, 'sklearn_model', None),
        # Method 6: Check for 'rf' attribute (RandomForest specific)
        lambda m: getattr(m, 'rf', None),
        # Method 7: Check for 'random_forest' attribute
        lambda m: getattr(m, 'random_forest', None),
    ]
    
    for i, method in enumerate(extraction_methods):
        try:
            extracted = method(loaded_model)
            if extracted is not None and hasattr(extracted, 'predict'):
                print(f"Successfully extracted model using method {i+1}: {type(extracted).__name__}", file=sys.stderr)
                return extracted
        except Exception as e:
            print(f"Extraction method {i+1} failed: {e}", file=sys.stderr)
            continue
    
    # If no extraction worked, try to find any attribute that has predict method
    print(f"Trying to find any attribute with predict method...", file=sys.stderr)
    for attr_name in dir(loaded_model):
        if not attr_name.startswith('_'):
            try:
                attr = getattr(loaded_model, attr_name)
                if hasattr(attr, 'predict') and callable(getattr(attr, 'predict')):
                    print(f"Found model in attribute '{attr_name}': {type(attr).__name__}", file=sys.stderr)
                    return attr
            except Exception as e:
                continue
    
    # Last resort: return the original model and hope for the best
    print(f"Warning: Could not extract sklearn model, using original: {type(loaded_model).__name__}", file=sys.stderr)
    return loaded_model

try:
    # Import inference module
    from inference import load_model_from_folder, predict_threat
    from standardized_preprocessing import standardize_flow_data, validate_feature_count
    
    # Get flow data from stdin
    flow_data_str = sys.stdin.read().strip()
    if not flow_data_str:
        raise ValueError("No flow data received")
    
    flow_data = json.loads(flow_data_str)
    
    # Load model based on database model info
    model_path = "${modelInfo.model_path ? modelInfo.model_path.replace(/\\/g, '/') : 'None'}"
    scaler_path = "${modelInfo.scaler_path ? modelInfo.scaler_path.replace(/\\/g, '/') : 'None'}"
    encoder_path = "${modelInfo.encoder_path ? modelInfo.encoder_path.replace(/\\/g, '/') : 'None'}"
    
    # Load model using safe loading functions
    if model_path != 'None' and os.path.exists(model_path):
        print(f"Loading model from: {model_path}", file=sys.stderr)
        if model_path.endswith('.joblib'):
            raw_model = safe_joblib_load(model_path)
        elif model_path.endswith('.pkl'):
            raw_model = safe_pickle_load(model_path)
        elif model_path.endswith('.h5'):
            import tensorflow as tf
            raw_model = tf.keras.models.load_model(model_path)
        else:
            # Unknown format, try folder loading as fallback
            print(f"Unknown model format, trying folder loading", file=sys.stderr)
            raw_model, context = load_model_from_folder(ml_dir)
            scaler_path = scaler_path if scaler_path != 'None' else context.get('scaler_path')
            encoder_path = encoder_path if encoder_path != 'None' else context.get('encoder_path')
    else:
        # Model path is None or doesn't exist, use folder loading
        print(f"Model path '{model_path}' is invalid, falling back to folder loading", file=sys.stderr)
        raw_model, context = load_model_from_folder(ml_dir)
        scaler_path = scaler_path if scaler_path != 'None' else context.get('scaler_path')
        encoder_path = encoder_path if encoder_path != 'None' else context.get('encoder_path')
    
    # Extract sklearn model from wrapper if needed
    print(f"Processing loaded model: {type(raw_model).__name__}", file=sys.stderr)
    model = extract_sklearn_model(raw_model)
    print(f"Final model type: {type(model).__name__}", file=sys.stderr)
    
    # Verify model has required methods
    if not hasattr(model, 'predict'):
        raise Exception(f"Model {type(model).__name__} does not have predict method!")
    print(f"✓ Model has predict method", file=sys.stderr)
    
    if hasattr(model, 'predict_proba'):
        print(f"✓ Model has predict_proba method", file=sys.stderr)
    else:
        print(f"⚠ Model does not have predict_proba method", file=sys.stderr)
    
    # Load scaler if available using safe loading
    scaler = None
    if scaler_path and scaler_path != 'None' and os.path.exists(scaler_path):
        try:
            print(f"Loading scaler from: {scaler_path}", file=sys.stderr)
            if scaler_path.endswith('.joblib'):
                scaler = safe_joblib_load(scaler_path)
            elif scaler_path.endswith('.pkl'):
                scaler = safe_pickle_load(scaler_path)
            print(f"Scaler loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Could not load scaler: {e}", file=sys.stderr)
    
    # Load label encoder if available using safe loading
    label_encoder = None
    if encoder_path and encoder_path != 'None' and os.path.exists(encoder_path):
        try:
            print(f"Loading label encoder from: {encoder_path}", file=sys.stderr)
            if encoder_path.endswith('.joblib'):
                label_encoder = safe_joblib_load(encoder_path)
            elif encoder_path.endswith('.pkl'):
                label_encoder = safe_pickle_load(encoder_path)
            print(f"Label encoder loaded successfully", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Could not load label encoder: {e}", file=sys.stderr)
    
    # Use standardized preprocessing
    print(f"[Python ML] Standardizing flow data...", file=sys.stderr)
    feature_array = standardize_flow_data(flow_data)
    print(f"[Python ML] Feature array shape: {feature_array.shape}", file=sys.stderr)
    
    # Apply scaler if available
    if scaler is not None:
        try:
            print(f"[Python ML] Applying scaler transformation...", file=sys.stderr)
            feature_array = scaler.transform(feature_array)
            print(f"[Python ML] Scaler applied successfully", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Scaler failed: {e}", file=sys.stderr)
    else:
        print(f"[Python ML] No scaler available, using raw features", file=sys.stderr)
    
    # Get prediction
    print(f"[Python ML] Running model prediction...", file=sys.stderr)
    try:
        prediction = model.predict(feature_array)[0]
        print(f"[Python ML] Raw prediction: {prediction}", file=sys.stderr)
    except Exception as e:
        print(f"Error in model prediction: {e}", file=sys.stderr)
        # Try alternative prediction methods
        if hasattr(model, '__call__'):
            try:
                prediction = model(feature_array)[0]
                print(f"[Python ML] Used __call__ method, prediction: {prediction}", file=sys.stderr)
            except Exception as e2:
                print(f"__call__ method also failed: {e2}", file=sys.stderr)
                raise e
        else:
            raise e
    
    # Get confidence and probabilities for all classes
    confidence = 0.0
    probabilities = {}
    class_confidences = {}
    top_classes = []
    
    if hasattr(model, 'predict_proba'):
        try:
            print(f"[Python ML] Getting prediction probabilities for all classes...", file=sys.stderr)
            probas = model.predict_proba(feature_array)[0]
            confidence = float(np.max(probas))
            
            # Create detailed probabilities dict with all classes
            if hasattr(model, 'classes_'):
                print(f"[Python ML] Model has {len(model.classes_)} classes: {list(model.classes_)}", file=sys.stderr)
                
                # Create probabilities dict and class confidences
                for i, cls in enumerate(model.classes_):
                    class_name = str(cls)
                    class_prob = float(probas[i])
                    probabilities[class_name] = class_prob
                    class_confidences[class_name] = class_prob
                
                # Sort classes by confidence (highest first)
                sorted_classes = sorted(class_confidences.items(), key=lambda x: x[1], reverse=True)
                top_classes = sorted_classes[:5]  # Top 5 classes
                
                # Apply class 4 tie-breaking logic with approximate threshold
                if len(sorted_classes) >= 2:
                    top_class = sorted_classes[0]
                    second_class = sorted_classes[1]
                    
                    # Define threshold for "approximately equal" (e.g., within 5%)
                    threshold = 0.05  # 5% threshold
                    
                    # Check if class 4 has highest probability and is approximately equal to another class
                    if (top_class[0] == '4' or top_class[0] == 4):
                        probability_diff = abs(top_class[1] - second_class[1])
                        
                        print(f"[Python ML] 🔍 CLASS 4 ANALYSIS:", file=sys.stderr)
                        print(f"[Python ML] Class 4 probability: {top_class[1]:.3f} ({top_class[1]*100:.1f}%)", file=sys.stderr)
                        print(f"[Python ML] Second class '{second_class[0]}' probability: {second_class[1]:.3f} ({second_class[1]*100:.1f}%)", file=sys.stderr)
                        print(f"[Python ML] Probability difference: {probability_diff:.3f} ({probability_diff*100:.1f}%)", file=sys.stderr)
                        print(f"[Python ML] Threshold: {threshold:.3f} ({threshold*100:.1f}%)", file=sys.stderr)
                        
                        if probability_diff <= threshold:
                            print(f"[Python ML] 🎯 CLASS 4 TIE-BREAKING LOGIC ACTIVATED (within threshold)", file=sys.stderr)
                            print(f"[Python ML] Class 4 and class '{second_class[0]}' are approximately equal", file=sys.stderr)
                            print(f"[Python ML] Choosing second class '{second_class[0]}' instead of class 4", file=sys.stderr)
                            
                            # Update prediction to use second class
                            prediction = int(second_class[0]) if second_class[0].isdigit() else second_class[0]
                            confidence = second_class[1]
                            
                            # Reorder top_classes to reflect the change
                            top_classes = [second_class] + [cls for cls in sorted_classes if cls != second_class][:4]
                            
                            print(f"[Python ML] ✅ Final prediction changed to: {prediction}", file=sys.stderr)
                            print(f"[Python ML] ✅ Final confidence: {confidence:.3f} ({confidence*100:.1f}%)", file=sys.stderr)
                        else:
                            print(f"[Python ML] ✅ Class 4 wins with clear margin, no tie-breaking needed", file=sys.stderr)
                            print(f"[Python ML] Margin: {probability_diff*100:.1f}% (above {threshold*100:.1f}% threshold)", file=sys.stderr)
                
                # Log detailed confidence information
                print(f"[Python ML] ===== CONFIDENCE ANALYSIS =====", file=sys.stderr)
                print(f"[Python ML] Max confidence: {confidence:.3f} ({confidence*100:.1f}%)", file=sys.stderr)
                print(f"[Python ML] Top 5 class predictions:", file=sys.stderr)
                for i, (class_name, class_conf) in enumerate(top_classes, 1):
                    print(f"[Python ML]   {i}. {class_name}: {class_conf:.3f} ({class_conf*100:.1f}%)", file=sys.stderr)
                
                # Log all classes if there are few of them
                if len(model.classes_) <= 10:
                    print(f"[Python ML] All class probabilities:", file=sys.stderr)
                    for class_name, class_conf in sorted_classes:
                        print(f"[Python ML]   - {class_name}: {class_conf:.3f} ({class_conf*100:.1f}%)", file=sys.stderr)
                else:
                    print(f"[Python ML] Total classes: {len(model.classes_)} (showing top 5 only)", file=sys.stderr)
                
                print(f"[Python ML] ================================", file=sys.stderr)
                
            else:
                print(f"[Python ML] Model classes not available, using raw probabilities", file=sys.stderr)
                for i, prob in enumerate(probas):
                    probabilities[f"class_{i}"] = float(prob)
                    
        except Exception as e:
            print(f"Warning: Could not get probabilities: {e}", file=sys.stderr)
    else:
        print(f"[Python ML] Model does not support predict_proba - using fallback confidence", file=sys.stderr)
        # Fallback: use a simple confidence based on prediction certainty
        if hasattr(model, 'decision_function'):
            try:
                decision_scores = model.decision_function(feature_array)[0]
                if isinstance(decision_scores, (list, np.ndarray)):
                    # For multi-class, use the maximum absolute score
                    max_score = float(np.max(np.abs(decision_scores)))
                    confidence = min(max_score / 10.0, 1.0)  # Normalize to 0-1
                else:
                    # For binary classification
                    confidence = min(abs(float(decision_scores)) / 10.0, 1.0)
                print(f"[Python ML] Using decision function confidence: {confidence:.3f}", file=sys.stderr)
            except Exception as e:
                print(f"Warning: Decision function failed: {e}", file=sys.stderr)
                confidence = 0.5  # Default confidence
    
    # Apply label encoder if available (use updated prediction from tie-breaking logic)
    if label_encoder is not None:
        try:
            print(f"[Python ML] Applying label encoder to final prediction...", file=sys.stderr)
            if isinstance(prediction, (np.integer, int)):
                prediction_str = label_encoder.inverse_transform([prediction])[0]
            else:
                prediction_str = str(prediction)
            print(f"[Python ML] Final decoded prediction: {prediction_str}", file=sys.stderr)
        except Exception as e:
            print(f"Warning: Label encoder failed: {e}", file=sys.stderr)
            prediction_str = str(prediction)
    else:
        prediction_str = str(prediction)
        print(f"[Python ML] No label encoder, using final raw prediction: {prediction_str}", file=sys.stderr)
    
    # Determine if it's malicious
    is_malicious = prediction_str.lower() not in ['normal', 'benign', 'legitimate']
    print(f"[Python ML] Is malicious: {is_malicious}", file=sys.stderr)
    
    # Return result as JSON with detailed confidence information
    result = {
        'success': True,
        'prediction': prediction_str,
        'is_malicious': is_malicious,
        'confidence': confidence,
        'confidence_percentage': round(confidence * 100, 1),
        'probabilities': probabilities,
        'top_classes': top_classes,
        'total_classes': len(model.classes_) if hasattr(model, 'classes_') else len(probabilities),
        'model_name': '${modelInfo.model_name}',
        'model_version': '${modelInfo.model_version || 'v1.0'}',
        'model_type': '${modelInfo.model_type}',
        'model_id': '${modelInfo.id}'
    }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        'success': False,
        'error': str(e),
        'error_type': type(e).__name__
    }
    print(json.dumps(error_result))
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

      // Handle Python process errors
      python.on('error', (err) => {
        console.error('[DirectMLPredictorWithDB] Python process error:', err);
        reject(new Error(`Python process failed: ${err.message}`));
      });

      // Handle stdin errors
      python.stdin.on('error', (err) => {
        console.error('[DirectMLPredictorWithDB] Python stdin error:', err);
        if (err.code !== 'EPIPE') {
          reject(new Error(`Python stdin error: ${err.message}`));
        }
      });

      // Send flow data to Python script with error handling
      try {
        python.stdin.write(JSON.stringify(flowData));
        python.stdin.end();
      } catch (writeError) {
        console.error('[DirectMLPredictorWithDB] Error writing to Python stdin:', writeError);
        python.kill('SIGTERM');
        reject(new Error(`Failed to send data to Python process: ${writeError.message}`));
        return;
      }

      // Set timeout for Python process
      const timeout = setTimeout(() => {
        console.error('[DirectMLPredictorWithDB] Python process timeout, killing process');
        python.kill('SIGTERM');
        reject(new Error('Python process timeout'));
      }, this.timeout);

      python.on('close', (code) => {
        clearTimeout(timeout);
        try {
          if (output.trim()) {
            const result = JSON.parse(output);
            if (result.success) {
              resolve(result);
            } else {
              reject(new Error(result.error || 'Unknown Python error'));
            }
          } else {
            reject(new Error(`Python process exited with code ${code}. No output received.\nStderr: ${error}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse Python output: ${output}\nError: ${error}\nParse error: ${e.message}`));
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
          confidencePercentage: 0.0,
          inferenceTime: 0,
          probabilities: {},
          topClasses: [],
          totalClasses: 0,
          modelName: 'fallback',
          modelVersion: 'v1.0',
          modelType: 'fallback'
        };
      }

      // Get user's selected model from database
      const modelInfo = await this.getUserSelectedModel(this.userId, selectionType);

      // Validate model info
      if (!modelInfo) {
        throw new Error('No model information available from database');
      }

      // Use feature mapper to convert packet data to ML input format
      const mlInput = this.featureMapper.mapDatabaseToML(packetData);

      // Log prediction start
      console.log(`[DirectMLPredictorWithDB] Starting prediction for user ${this.userId}`);
      console.log(`[DirectMLPredictorWithDB] Using model: ${modelInfo.model_name} (${modelInfo.model_type})`);
      
      // Run Python prediction with database model
      const result = await this.runPythonPredictionWithDB(mlInput, modelInfo);
      
      // Log detailed prediction result
      console.log(`[DirectMLPredictorWithDB] ===== PREDICTION RESULT =====`);
      console.log(`[DirectMLPredictorWithDB] Flow Analysis Complete:`);
      console.log(`   • Prediction: ${result.prediction || 'Unknown'}`);
      console.log(`   • Is Malicious: ${result.is_malicious || false}`);
      console.log(`   • Confidence: ${result.confidence_percentage || (result.confidence || 0) * 100}%`);
      console.log(`   • Model: ${result.model_name || 'unknown'} (${result.model_type || 'unknown'})`);
      
      // Log detailed confidence information
      if (result.top_classes && result.top_classes.length > 0) {
        console.log(`[DirectMLPredictorWithDB] Top Class Predictions:`);
        result.top_classes.forEach(([className, classConf], index) => {
          const percentage = (classConf * 100).toFixed(1);
          const marker = index === 0 ? '🎯' : '  ';
          console.log(`[DirectMLPredictorWithDB]   ${marker} ${index + 1}. ${className}: ${percentage}%`);
        });
      }
      
      if (result.total_classes) {
        console.log(`[DirectMLPredictorWithDB] Total Classes Analyzed: ${result.total_classes}`);
      }
      
      // Log all probabilities if available and reasonable number
      if (result.probabilities && Object.keys(result.probabilities).length <= 10) {
        console.log(`[DirectMLPredictorWithDB] All Class Probabilities:`);
        Object.entries(result.probabilities)
          .sort(([,a], [,b]) => b - a) // Sort by confidence descending
          .forEach(([className, classConf]) => {
            const percentage = (classConf * 100).toFixed(1);
            console.log(`[DirectMLPredictorWithDB]   - ${className}: ${percentage}%`);
          });
      }
      
      console.log(`[DirectMLPredictorWithDB] ================================`);

      return {
        isAttack: result.is_malicious || (result.prediction && result.prediction.toLowerCase() !== 'normal'),
        attackType: result.prediction || 'Unknown',
        severity: this.mapAttackTypeToSeverity(result.prediction || 'Unknown', result.confidence || 0.0),
        confidence: result.confidence || 0.0,
        confidencePercentage: result.confidence_percentage || ((result.confidence || 0) * 100),
        inferenceTime: 0,
        probabilities: result.probabilities || {},
        topClasses: result.top_classes || [],
        totalClasses: result.total_classes || 0,
        modelName: result.model_name || 'unknown',
        modelVersion: result.model_version || 'v1.0',
        modelType: result.model_type || 'unknown',
        modelId: result.model_id || 'unknown'
      };

    } catch (error) {
      console.error('Direct ML Prediction Error:', error.message);
      console.error('Error details:', error);

      // Try to use dynamic ML service as fallback
      try {
        console.log('[DirectMLPredictorWithDB] Attempting fallback to dynamic ML service...');
        
        // Use feature mapper to convert packet data to ML input format
        const mlInput = this.featureMapper.mapDatabaseToML(packetData);
        
        const healthCheck = await fetch('http://localhost:5001/health').catch(() => null);
        if (healthCheck && healthCheck.ok) {
          console.log('[DirectMLPredictorWithDB] Dynamic ML service is available, using it as fallback');

          const response = await fetch('http://localhost:5001/predict', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-User-ID': this.userId,
              'X-Model-Selection-Type': selectionType
            },
            body: JSON.stringify(mlInput)
          });

          if (response.ok) {
            const result = await response.json();
            console.log('[DirectMLPredictorWithDB] Successfully used dynamic ML service as fallback');

            return {
              isAttack: result.is_malicious || (result.prediction && result.prediction.toLowerCase() !== 'normal'),
              attackType: result.prediction || 'Unknown',
              severity: this.mapAttackTypeToSeverity(result.prediction || 'Unknown', result.confidence || 0.0),
              confidence: result.confidence || 0.0,
              confidencePercentage: result.confidence_percentage || ((result.confidence || 0) * 100),
              inferenceTime: result.inference_time || 0,
              probabilities: result.probabilities || {},
              topClasses: result.top_classes || [],
              totalClasses: result.total_classes || 0,
              modelName: result.model_name || 'dynamic-ml-service',
              modelVersion: result.model_version || 'v1.0',
              modelType: result.model_type || 'dynamic',
              modelId: result.model_id || 'dynamic'
            };
          }
        }
      } catch (fallbackError) {
        console.error('[DirectMLPredictorWithDB] Fallback to dynamic ML service failed:', fallbackError.message);
      }

      // Final fallback prediction
      return {
        isAttack: false,
        attackType: 'Normal',
        severity: 'low',
        confidence: 0.0,
        confidencePercentage: 0.0,
        inferenceTime: 0,
        probabilities: {},
        topClasses: [],
        totalClasses: 0,
        modelName: 'fallback',
        modelVersion: 'v1.0',
        modelType: 'fallback'
      };
    }
  }

  /**
   * Map attack type and confidence to severity level
   */
  mapAttackTypeToSeverity(attackType, confidence) {
    const normalizedType = attackType.toLowerCase().trim();
    let baseSeverity = 'medium';

    if (normalizedType === 'normal') {
      return 'low';
    } else if (normalizedType.includes('dos') || normalizedType.includes('ddos')) {
      baseSeverity = 'critical';
    } else if (normalizedType.includes('u2r')) {
      baseSeverity = 'critical';
    } else if (normalizedType.includes('r2l')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('web attack') || normalizedType.includes('web_attack')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('bfa') || normalizedType.includes('brute')) {
      baseSeverity = 'high';
    } else if (normalizedType.includes('probe') || normalizedType.includes('scan')) {
      baseSeverity = 'medium';
    }

    if (confidence >= 0.9) {
      if (baseSeverity === 'medium') return 'high';
      return baseSeverity;
    } else if (confidence >= 0.7) {
      return baseSeverity;
    } else if (confidence >= 0.5) {
      if (baseSeverity === 'critical') return 'high';
      if (baseSeverity === 'high') return 'medium';
      return baseSeverity;
    } else {
      return 'low';
    }
  }

  /**
   * Map confidence score to severity level (fallback method)
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
