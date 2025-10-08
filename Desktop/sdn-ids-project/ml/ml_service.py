#!/usr/bin/env python3
"""
ML Server for Dynamic Inference Service - FIXED VERSION
Loads default model first, then checks database in background
ml/ml_service.py
"""

import os
import sys
import time
import logging
import threading
import pickle
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import joblib
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger(__name__)

# Force flush output
sys.stdout.flush()
sys.stderr.flush()

# Flask app
app = Flask(__name__)
CORS(app)

# Global variables for model management
current_model = None
current_context = None
model_lock = threading.Lock()
server_ready = False

# ============================================================================
# CUSTOM UNPICKLER - Fix for "No module named 'models'" error
# ============================================================================

class CustomUnpickler(pickle.Unpickler):
    """Custom unpickler to handle missing modules"""
    def find_class(self, module, name):
        # Try original module first
        try:
            return super().find_class(module, name)
        except (ImportError, AttributeError) as e:
            logger.warning(f"Module {module}.{name} not found: {e}")
            
            # If 'models' module not found, try sklearn
            if module.startswith('models.'):
                try:
                    sklearn_module = module.replace('models.', 'sklearn.')
                    logger.info(f"Trying sklearn equivalent: {sklearn_module}.{name}")
                    return super().find_class(sklearn_module, name)
                except Exception as sklearn_error:
                    logger.warning(f"sklearn equivalent failed: {sklearn_error}")
            
            # Try common module mappings
            module_mappings = {
                'models': 'sklearn',
                'models.ensemble': 'sklearn.ensemble',
                'models.tree': 'sklearn.tree',
                'models.linear_model': 'sklearn.linear_model',
            }
            
            for old_prefix, new_prefix in module_mappings.items():
                if module.startswith(old_prefix):
                    try:
                        new_module = module.replace(old_prefix, new_prefix)
                        logger.info(f"Trying mapping: {new_module}.{name}")
                        return super().find_class(new_module, name)
                    except:
                        pass
            
            # If still not found, create dummy class
            logger.warning(f"Creating dummy class for {module}.{name}")
            return type(name, (), {})

def safe_joblib_load(filepath):
    """Safely load joblib file with custom unpickler"""
    try:
        # Try normal loading first
        logger.info(f"Attempting standard joblib load: {filepath}")
        return joblib.load(filepath)
    except ModuleNotFoundError as e:
        logger.warning(f"Standard load failed with ModuleNotFoundError: {e}")
        logger.info("Retrying with custom unpickler...")
        
        # Try with custom unpickler
        try:
            with open(filepath, 'rb') as f:
                model = CustomUnpickler(f).load()
                logger.info("✓ Successfully loaded with custom unpickler")
                return model
        except Exception as custom_error:
            logger.error(f"Custom unpickler also failed: {custom_error}")
            raise

def extract_sklearn_model(wrapped_model):
    """Extract sklearn model from wrapper if needed"""
    # If it's already a sklearn model, return as is
    if hasattr(wrapped_model, 'predict') and hasattr(wrapped_model, 'fit'):
        logger.info("Model has predict and fit methods - using as is")
        return wrapped_model
    
    # Try to extract model from common wrapper patterns
    wrapper_attrs = ['model', 'estimator', 'classifier', '_model', 'sklearn_model']
    for attr_name in wrapper_attrs:
        if hasattr(wrapped_model, attr_name):
            attr = getattr(wrapped_model, attr_name)
            if hasattr(attr, 'predict') and hasattr(attr, 'fit'):
                logger.info(f"Found sklearn model in attribute: {attr_name}")
                return attr
    
    # If no model found, try to inspect all attributes
    for attr_name in dir(wrapped_model):
        if not attr_name.startswith('_'):
            try:
                attr = getattr(wrapped_model, attr_name)
                if hasattr(attr, 'predict') and hasattr(attr, 'fit'):
                    logger.info(f"Found sklearn model in attribute: {attr_name}")
                    return attr
            except:
                pass
    
    # If still not found, return original
    logger.warning("Could not extract sklearn model, using original")
    return wrapped_model

# ============================================================================
# DATABASE AND MODEL LOADING
# ============================================================================

def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'sdn_ids'),
        user=os.getenv('DB_USER', 'sdn_user'),
        password=os.getenv('DB_PASSWORD', 'sdn_password')
    )

def load_scaler_encoder():
    """Load scaler and label encoder from ml/ folder"""
    scaler = None
    encoder = None
    scaler_path = "scaler.joblib"
    encoder_path = "label_encoder.pkl"

    if os.path.exists(scaler_path):
        try:
            scaler = safe_joblib_load(scaler_path)
            logger.info(f"✓ Scaler loaded: {scaler_path}")
        except Exception as e:
            logger.error(f"✗ Failed to load scaler: {e}")

    if os.path.exists(encoder_path):
        try:
            encoder = safe_joblib_load(encoder_path)
            logger.info(f"✓ Label encoder loaded: {encoder_path}")
        except Exception as e:
            logger.error(f"✗ Failed to load encoder: {e}")

    return scaler, encoder

def load_default_model(model_name="random_forest_full_best", 
                      model_file="random_forest_one_third_best_model_2486_samples.pkl",
                      scaler_file="scaler.joblib", 
                      encoder_file="label_encoder.pkl"):
    """Load default model from local files - ALWAYS USE THIS FIRST"""
    global current_model, current_context
    
    try:
        with model_lock:
            logger.info("=" * 60)
            logger.info(f"Loading default model: {model_name}")
            logger.info(f"Model file: {model_file}")
            
            # Check if model file exists
            if not os.path.exists(model_file):
                raise Exception(f"Default model file not found: {model_file}")
            
            # Load model with safe loader
            logger.info(f"Reading model file...")
            try:
                loaded_model = safe_joblib_load(model_file)
                logger.info(f"✓ Raw model loaded successfully")
                logger.info(f"✓ Model type: {type(loaded_model).__name__}")
                
                # Extract sklearn model from wrapper if needed
                current_model = extract_sklearn_model(loaded_model)
                logger.info(f"✓ Final model type: {type(current_model).__name__}")
                
                # Verify model has predict method
                if not hasattr(current_model, 'predict'):
                    raise Exception("Model does not have predict method!")
                    
            except Exception as load_error:
                logger.error(f"Failed to load model: {load_error}")
                raise
            
            # Load scaler and encoder
            logger.info(f"Loading scaler and encoder...")
            scaler, encoder = load_scaler_encoder()
            
            current_context = {
                "model_id": f"default_{model_name}",
                "scaler": scaler,
                "label_encoder": encoder,
                "loaded_at": time.time(),
                "model_type": "default"
            }
            
            logger.info(f"✓ Model context created")
            logger.info(f"  - Model ID: default_{model_name}")
            logger.info(f"  - Type: default")
            logger.info(f"  - Has predict: {hasattr(current_model, 'predict')}")
            logger.info(f"  - Scaler: {'✓' if scaler else '✗'}")
            logger.info(f"  - Encoder: {'✓' if encoder else '✗'}")
            logger.info("=" * 60)
            
    except Exception as e:
        logger.error(f"✗ Error loading default model: {e}")
        raise

def load_model_from_database(model_id):
    """Load model from database (supports both filesystem and BYTEA storage)"""
    with model_lock:
        try:
            logger.info(f"Attempting to load model from database: {model_id}")
            
            with get_db_connection() as conn:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                
                # Query both file_path and content (BYTEA)
                query = """
                SELECT file_path, content, storage_type, file_type, upload_status 
                FROM model_files
                WHERE model_id = %s 
                  AND file_type = 'model' 
                  AND upload_status = 'completed'
                LIMIT 1
                """
                cursor.execute(query, (model_id,))
                result = cursor.fetchone()

                if not result:
                    raise Exception(f"No model file found for {model_id}")

                storage_type = result.get("storage_type", "filesystem")
                logger.info(f"Storage type: {storage_type}")
                
                # Load based on storage type
                if storage_type == "database":
                    # Load from BYTEA column
                    content = result["content"]
                    if content is None:
                        raise Exception(f"content is NULL for model {model_id}")
                    
                    logger.info(f"Loading model from database BYTEA ({len(content)} bytes)")
                    
                    # Load from binary data
                    import io
                    model_obj = joblib.load(io.BytesIO(content))
                    
                elif storage_type == "filesystem":
                    # Load from file path
                    model_path = result["file_path"]
                    logger.info(f"Loading model from filesystem: {model_path}")
                    
                    if model_path is None:
                        raise Exception(f"file_path is NULL for model {model_id}")
                    
                    if not os.path.exists(model_path):
                        raise Exception(f"Model file not found: {model_path}")
                    
                    model_obj = safe_joblib_load(model_path)
                else:
                    raise Exception(f"Unsupported storage_type: {storage_type}")
                
                # Extract sklearn model
                model_obj = extract_sklearn_model(model_obj)
                logger.info(f"✓ Model loaded from database: {model_id}")

                # Load scaler and encoder
                scaler, label_encoder = load_scaler_encoder()

                return model_obj, {
                    "model_id": model_id,
                    "scaler": scaler,
                    "label_encoder": label_encoder,
                    "loaded_at": time.time(),
                    "model_type": "database",
                    "storage_type": storage_type
                }

        except Exception as e:
            logger.error(f"✗ Error loading model from database {model_id}: {e}")
            raise

def load_primary_model_background():
    """Load primary model in background"""
    global current_model, current_context
    
    logger.info("Background: Checking for database model...")
    
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT model_id FROM model_selections 
                WHERE selection_type = 'primary' 
                ORDER BY created_at DESC LIMIT 1
            """)
            result = cursor.fetchone()
            
            if result:
                model_id = result['model_id']
                logger.info(f"Background: Found database model: {model_id}")
                
                db_model, db_context = load_model_from_database(model_id)
                
                with model_lock:
                    current_model = db_model
                    current_context = db_context
                
                logger.info(f"✓ Background: Database model loaded")
                return
                
    except Exception as db_error:
        logger.warning(f"Background: Failed to load database model: {db_error}")
    
    logger.info("Background: Using default model")

def run_inference(model, context, X_input):
    """Run inference"""
    scaler = context.get("scaler")
    label_encoder = context.get("label_encoder")

    if scaler:
        X_input = scaler.transform(X_input)

    y_pred = model.predict(X_input)

    # Manual mapping if label encoder fails or is not available
    # Mapping: 0=BFA, 1=BOTNET, 2=DDoS, 3=DoS, 4=Normal, 5=Probe, 6=U2R, 7=Web-Attack
    label_mapping = {
        0: 'BFA',
        1: 'BOTNET', 
        2: 'DDoS',
        3: 'DoS',
        4: 'Normal',
        5: 'Probe',
        6: 'U2R',
        7: 'Web-Attack'
    }

    if label_encoder:
        try:
            y_pred_decoded = label_encoder.inverse_transform(y_pred)
        except Exception as e:
            logger.error(f"Label encoder failed: {e}, using manual mapping")
            y_pred_decoded = np.array([label_mapping.get(int(pred), f'Unknown_{pred}') for pred in y_pred])
    else:
        logger.warning("No label encoder available, using manual mapping")
        y_pred_decoded = np.array([label_mapping.get(int(pred), f'Unknown_{pred}') for pred in y_pred])

    return {
        "predictions": y_pred_decoded.tolist(),
        "raw_predictions": y_pred.tolist(),
        "model_id": context["model_id"],
        "timestamp": time.time()
    }

# ============================================================================
# REST API ENDPOINTS
# ============================================================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check"""
    try:
        if not server_ready:
            return jsonify({
                'status': 'starting',
                'message': 'Server is starting up...'
            }), 503
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
            db_healthy = True
        except:
            db_healthy = False
        
        return jsonify({
            'status': 'healthy',
            'timestamp': time.time(),
            'model_loaded': current_model is not None,
            'model_id': current_context.get('model_id') if current_context else None,
            'database_healthy': db_healthy
        }), 200
        
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Predict endpoint"""
    try:
        if not current_model or not current_context:
            return jsonify({
                'error': 'No model loaded',
                'is_malicious': False,
                'prediction': 'Normal'
            }), 503
            
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No input data'}), 400
            
        if isinstance(data, list):
            X_input = np.array(data)
        elif isinstance(data, dict) and 'features' in data:
            X_input = np.array(data['features'])
        else:
            return jsonify({'error': 'Invalid format'}), 400
            
        if X_input.ndim == 1:
            X_input = X_input.reshape(1, -1)
            
        result = run_inference(current_model, current_context, X_input)
        
        predictions = result['predictions']
        if predictions:
            prediction = predictions[0] if isinstance(predictions, list) else predictions
            is_malicious = prediction not in ['Normal', 'BENIGN']
            
            return jsonify({
                'is_malicious': is_malicious,
                'prediction': prediction,
                'confidence': 0.85,
                'attack_type': prediction if is_malicious else 'Normal',
                'model_id': result.get('model_id')
            }), 200
        else:
            return jsonify({
                'is_malicious': False,
                'prediction': 'Normal'
            }), 200
            
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/reload-model', methods=['POST'])
def reload_model():
    """Reload model"""
    threading.Thread(target=load_primary_model_background, daemon=True).start()
    return jsonify({'status': 'reloading'}), 202

@app.route('/model-status', methods=['GET'])
def model_status():
    """Get model status"""
    return jsonify({
        'model_loaded': current_model is not None,
        'model_id': current_context.get('model_id') if current_context else None,
        'status': 'loaded' if current_model else 'loading'
    }), 200

def model_watcher():
    """Watch for model changes"""
    while True:
        try:
            time.sleep(60)
            with get_db_connection() as conn:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                cursor.execute("""
                    SELECT model_id FROM model_selections 
                    WHERE selection_type = 'primary' 
                    ORDER BY created_at DESC LIMIT 1
                """)
                result = cursor.fetchone()
                
                if result and current_context:
                    new_model = result['model_id']
                    if new_model != current_context.get('model_id'):
                        logger.info(f"Model changed: {new_model}")
                        threading.Thread(target=load_primary_model_background, daemon=True).start()
        except Exception as e:
            logger.error(f"Watcher error: {e}")
            time.sleep(60)

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

if __name__ == '__main__':
    print("=" * 60)
    print("Starting Dynamic ML Inference Server")
    print("=" * 60)
    sys.stdout.flush()
    
    # Load default model BEFORE starting Flask
    try:
        logger.info("STARTUP: Loading default model...")
        load_default_model()
        logger.info("✓ STARTUP: Default model loaded")
        server_ready = True
    except Exception as e:
        logger.error(f"✗ STARTUP: Failed: {e}")
        sys.exit(1)
    
    # Start Flask
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    
    logger.info(f"Starting Flask on {host}:{port}")
    
    # Background threads
    threading.Thread(target=load_primary_model_background, daemon=True).start()
    threading.Thread(target=model_watcher, daemon=True).start()
    
    try:
        app.run(host=host, port=port, debug=False, threaded=True, use_reloader=False)
    except Exception as e:
        logger.error(f"Flask failed: {e}")
        sys.exit(1)