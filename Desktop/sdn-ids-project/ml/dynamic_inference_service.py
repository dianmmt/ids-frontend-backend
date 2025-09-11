#!/usr/bin/env python3
"""
Dynamic ML Inference Service
Supports loading models from database and user selection
"""

import os
import sys
import json
import time
import logging
import psycopg2
from typing import Dict, Any, List, Optional, Tuple
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
import joblib
import hashlib

# Add current directory to path for imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from inference import load_model_from_folder, predict_threat, predict

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'sdn_ids'),
    'user': os.getenv('DB_USER', 'sdn_user'),
    'password': os.getenv('DB_PASSWORD', 'sdn_password')
}

# Global variables for model management
loaded_models = {}  # Cache for loaded models
model_cache = {}    # Cache for model metadata
last_model_update = 0
cache_refresh_interval = 300  # 5 minutes

def get_db_connection():
    """Get database connection"""
    try:
        return psycopg2.connect(**DB_CONFIG)
    except Exception as e:
        logger.error(f"Database connection error: {e}")
        return None

def get_user_selected_model(user_id: str, selection_type: str = 'primary') -> Optional[Dict[str, Any]]:
    """Get user's selected model from database"""
    try:
        conn = get_db_connection()
        if not conn:
            return None
        
        cursor = conn.cursor()
        
        # Get user's model selection
        query = """
            SELECT 
                m.id, m.model_name, m.model_type, m.model_path,
                mf_scaler.file_path as scaler_path,
            mf_encoder.file_path as encoder_path,
            mv.performance_metrics
            FROM model_selections ms
            JOIN ml_models m ON ms.model_id = m.id
            LEFT JOIN model_versions mv ON ms.model_version_id = mv.id
            LEFT JOIN model_files mf_scaler ON m.id = mf_scaler.model_id AND mf_scaler.file_type = 'scaler'
            LEFT JOIN model_files mf_encoder ON m.id = mf_encoder.model_id AND mf_encoder.file_type = 'encoder'
        WHERE ms.user_id = %s 
            AND ms.selection_type = %s
            AND ms.is_active = true
            AND m.status = 'active'
        """
        
        cursor.execute(query, (user_id, selection_type))
        result = cursor.fetchone()
        
        if result:
            return {
                'model_id': result[0],
                'model_name': result[1],
                'model_type': result[2],
                'model_path': result[3],
                'scaler_path': result[4],
                'encoder_path': result[5],
                'performance_metrics': result[6]
            }
        
        cursor.close()
        conn.close()
        return None
        
    except Exception as e:
        logger.error(f"Error getting user selected model: {e}")
        return None

def load_model_from_database(model_id: str) -> Tuple[Any, Dict[str, Any]]:
    """Load model from database by ID"""
    try:
        conn = get_db_connection()
        if not conn:
            raise Exception("Database connection failed")
        
        cursor = conn.cursor()
        
        # Get model files
        query = """
        SELECT file_type, file_path, file_size, file_hash
        FROM model_files
        WHERE model_id = %s AND upload_status = 'completed'
        ORDER BY file_type
        """
        
        cursor.execute(query, (model_id,))
        files = cursor.fetchall()
        
        if not files:
            raise Exception("No model files found")
        
        # Load model files
        model_obj = None
        scaler = None
        label_encoder = None
        metadata = {}
        
        for file_type, file_path, file_size, file_hash in files:
            if os.path.exists(file_path):
                if file_type == 'model':
                    model_obj = joblib.load(file_path)
                elif file_type == 'scaler':
                    scaler = joblib.load(file_path)
                elif file_type == 'encoder':
                    label_encoder = joblib.load(file_path)
                elif file_type == 'metadata':
                    with open(file_path, 'r') as f:
                        metadata = json.load(f)
        
        if model_obj is None:
            raise Exception("Model file not found or could not be loaded")
        
        context = {
            'model_id': model_id,
            'scaler': scaler,
            'label_encoder': label_encoder,
            'metadata': metadata,
            'loaded_at': time.time()
        }
        
        cursor.close()
        conn.close()
        
        return model_obj, context
        
    except Exception as e:
        logger.error(f"Error loading model from database: {e}")
        raise

def preprocess_flow_data(flow_data: Dict[str, Any]) -> np.ndarray:
    """Preprocess flow data for ML prediction"""
    try:
        # Map flow data to feature array (84 features)
        features = [
            flow_data.get('flow_duration', 0),
            flow_data.get('total_fwd_packets', 0),
            flow_data.get('total_backward_packets', 0),
            flow_data.get('total_length_of_fwd_packets', 0),
            flow_data.get('total_length_of_bwd_packets', 0),
            flow_data.get('fwd_packet_length_max', 0),
            flow_data.get('fwd_packet_length_min', 0),
            flow_data.get('fwd_packet_length_mean', 0),
            flow_data.get('fwd_packet_length_std', 0),
            flow_data.get('bwd_packet_length_max', 0),
            flow_data.get('bwd_packet_length_min', 0),
            flow_data.get('bwd_packet_length_mean', 0),
            flow_data.get('bwd_packet_length_std', 0),
            flow_data.get('flow_bytes_per_second', 0),
            flow_data.get('flow_packets_per_second', 0),
            flow_data.get('flow_iat_mean', 0),
            flow_data.get('flow_iat_std', 0),
            flow_data.get('flow_iat_max', 0),
            flow_data.get('flow_iat_min', 0),
            flow_data.get('fwd_iat_total', 0),
            flow_data.get('fwd_iat_mean', 0),
            flow_data.get('fwd_iat_std', 0),
            flow_data.get('fwd_iat_max', 0),
            flow_data.get('fwd_iat_min', 0),
            flow_data.get('bwd_iat_total', 0),
            flow_data.get('bwd_iat_mean', 0),
            flow_data.get('bwd_iat_std', 0),
            flow_data.get('bwd_iat_max', 0),
            flow_data.get('bwd_iat_min', 0),
            flow_data.get('fwd_psh_flags', 0),
            flow_data.get('bwd_psh_flags', 0),
            flow_data.get('fwd_urg_flags', 0),
            flow_data.get('bwd_urg_flags', 0),
            flow_data.get('fwd_header_length', 0),
            flow_data.get('bwd_header_length', 0),
            flow_data.get('fwd_packets_per_second', 0),
            flow_data.get('bwd_packets_per_second', 0),
            flow_data.get('min_packet_length', 0),
            flow_data.get('max_packet_length', 0),
            flow_data.get('packet_length_mean', 0),
            flow_data.get('packet_length_std', 0),
            flow_data.get('packet_length_variance', 0),
            flow_data.get('fin_flag_count', 0),
            flow_data.get('syn_flag_count', 0),
            flow_data.get('rst_flag_count', 0),
            flow_data.get('psh_flag_count', 0),
            flow_data.get('ack_flag_count', 0),
            flow_data.get('urg_flag_count', 0),
            flow_data.get('cwe_flag_count', 0),
            flow_data.get('ece_flag_count', 0),
            flow_data.get('down_up_ratio', 0),
            flow_data.get('average_packet_size', 0),
            flow_data.get('avg_fwd_segment_size', 0),
            flow_data.get('avg_bwd_segment_size', 0),
            flow_data.get('fwd_header_length_1', 0),
            flow_data.get('fwd_avg_bytes_per_bulk', 0),
            flow_data.get('fwd_avg_packets_per_bulk', 0),
            flow_data.get('fwd_avg_bulk_rate', 0),
            flow_data.get('bwd_avg_bytes_per_bulk', 0),
            flow_data.get('bwd_avg_packets_per_bulk', 0),
            flow_data.get('bwd_avg_bulk_rate', 0),
            flow_data.get('subflow_fwd_packets', 0),
            flow_data.get('subflow_bwd_packets', 0),
            flow_data.get('subflow_fwd_bytes', 0),
            flow_data.get('subflow_bwd_bytes', 0),
            flow_data.get('init_win_bytes_forward', 0),
            flow_data.get('init_win_bytes_backward', 0),
            flow_data.get('act_data_pkt_fwd', 0),
            flow_data.get('min_seg_size_forward', 0),
            flow_data.get('active_mean', 0),
            flow_data.get('active_std', 0),
            flow_data.get('active_max', 0),
            flow_data.get('active_min', 0),
            flow_data.get('idle_mean', 0),
            flow_data.get('idle_std', 0),
            flow_data.get('idle_max', 0),
            flow_data.get('idle_min', 0)
        ]
        
        # Convert to numpy array and reshape for single sample
        feature_array = np.array(features, dtype=np.float32).reshape(1, -1)
        
        # Handle infinite values
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
        
        return feature_array
        
    except Exception as e:
        logger.error(f"Error preprocessing flow data: {e}")
        raise

def predict_with_model(feature_array: np.ndarray, model_obj: Any, context: Dict[str, Any]) -> Dict[str, Any]:
    """Make prediction with specific model"""
    try:
        # Apply scaling if scaler is available
        if context.get('scaler') is not None:
            feature_array = context['scaler'].transform(feature_array)
        
        # Get prediction
        prediction = model_obj.predict(feature_array)[0]
        
        # Get probabilities if available
        confidence = 0.0
        if hasattr(model_obj, 'predict_proba'):
            probabilities = model_obj.predict_proba(feature_array)[0]
            confidence = float(np.max(probabilities))
        
        # Map prediction to class name
        if context.get('label_encoder') is not None:
            predicted_class = context['label_encoder'].inverse_transform([prediction])[0]
        else:
            predicted_class = str(prediction)
        
        # Determine if it's an attack
        is_malicious = predicted_class != 'Normal' and predicted_class != 'normal'
        
        return {
            'prediction': predicted_class,
            'is_malicious': is_malicious,
            'confidence': confidence,
            'model_id': context.get('model_id', 'unknown')
        }
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return {
            'prediction': 'unknown',
            'is_malicious': False,
            'confidence': 0.0,
            'error': str(e)
        }

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'loaded_models': len(loaded_models),
        'cache_size': len(model_cache),
        'timestamp': time.time()
    })

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    user_id = request.headers.get('X-User-ID')
    selection_type = request.headers.get('X-Model-Selection-Type', 'primary')
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    try:
        model_info = get_user_selected_model(user_id, selection_type)
        if not model_info:
            return jsonify({'error': 'No model selected for user'}), 404
        
        return jsonify({
            'model_id': model_info['model_id'],
            'model_name': model_info['model_name'],
            'model_type': model_info['model_type'],
            'performance_metrics': model_info['performance_metrics']
        })
        
    except Exception as e:
        logger.error(f"Error getting model info: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/models', methods=['GET'])
def get_available_models():
    """Get available models for user"""
        user_id = request.headers.get('X-User-ID')
    
        if not user_id:
            return jsonify({'error': 'User ID required'}), 400
        
    try:
        conn = get_db_connection()
        if not conn:
            return jsonify({'error': 'Database connection failed'}), 500
        
        cursor = conn.cursor()
        
        # Get user's available models
        query = """
            SELECT 
            m.id, m.model_name, m.model_type, m.status,
            mv.version_number, mv.performance_metrics
            FROM ml_models m
            LEFT JOIN model_versions mv ON m.id = mv.model_id AND mv.is_active = true
        WHERE m.status = 'active'
            ORDER BY m.created_at DESC
        """
        
        cursor.execute(query)
        models = cursor.fetchall()
        
        result = []
        for model in models:
            result.append({
                'model_id': model[0],
                'model_name': model[1],
                'model_type': model[2],
                'status': model[3],
                'version': model[4],
                'performance_metrics': model[5]
            })
        
        cursor.close()
        conn.close()
        
        return jsonify({'models': result})
        
    except Exception as e:
        logger.error(f"Error getting available models: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict_single():
    """Predict for a single flow"""
    user_id = request.headers.get('X-User-ID')
    selection_type = request.headers.get('X-Model-Selection-Type', 'primary')
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    try:
        start_time = time.time()
        
        # Get flow data from request
        flow_data = request.get_json()
        if not flow_data:
            return jsonify({'error': 'No flow data provided'}), 400
        
        # Get user's selected model
        model_info = get_user_selected_model(user_id, selection_type)
        if not model_info:
            return jsonify({'error': 'No model selected for user'}), 404
        
        model_id = model_info['model_id']
        
        # Load model if not already loaded
        if model_id not in loaded_models:
            model_obj, context = load_model_from_database(model_id)
            loaded_models[model_id] = (model_obj, context)
        else:
            model_obj, context = loaded_models[model_id]
        
        # Preprocess data
        feature_array = preprocess_flow_data(flow_data)
        
        # Make prediction
        prediction_result = predict_with_model(feature_array, model_obj, context)
        
        inference_time = (time.time() - start_time) * 1000
        
        result = {
            'prediction': prediction_result['prediction'],
            'is_malicious': prediction_result['is_malicious'],
            'confidence': prediction_result['confidence'],
            'inference_time': inference_time,
            'model_id': model_id,
            'model_name': model_info['model_name']
        }
        
        logger.info(f"Prediction: {result['prediction']} (confidence: {result['confidence']:.3f}, time: {inference_time:.2f}ms)")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Predict for multiple flows"""
    user_id = request.headers.get('X-User-ID')
    selection_type = request.headers.get('X-Model-Selection-Type', 'primary')
    
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    
    try:
        start_time = time.time()
        
        # Get batch data from request
        data = request.get_json()
        flows = data.get('flows', [])
        
        if not flows:
            return jsonify({'error': 'No flows provided'}), 400
        
        # Get user's selected model
        model_info = get_user_selected_model(user_id, selection_type)
        if not model_info:
            return jsonify({'error': 'No model selected for user'}), 404
        
        model_id = model_info['model_id']
        
        # Load model if not already loaded
        if model_id not in loaded_models:
            model_obj, context = load_model_from_database(model_id)
            loaded_models[model_id] = (model_obj, context)
        else:
            model_obj, context = loaded_models[model_id]
        
        logger.info(f"Processing batch of {len(flows)} flows with model {model_id}")
        
        predictions = []
        successful_predictions = 0
        
        for i, flow_data in enumerate(flows):
            try:
                # Preprocess data
                feature_array = preprocess_flow_data(flow_data)
                
                # Make prediction
                prediction_result = predict_with_model(feature_array, model_obj, context)
                
                predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                    'prediction': prediction_result['prediction'],
                    'is_malicious': prediction_result['is_malicious'],
                    'confidence': prediction_result['confidence']
                })
                
                successful_predictions += 1
                
            except Exception as e:
                logger.error(f"Error processing flow {i}: {e}")
                predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                    'prediction': 'unknown',
                    'is_malicious': False,
                    'confidence': 0.0,
                    'error': str(e)
                })
        
        total_time = (time.time() - start_time) * 1000
        
        result = {
            'predictions': predictions,
            'total_flows': len(flows),
            'processed_flows': len(predictions),
            'successful_predictions': successful_predictions,
            'total_time_ms': total_time,
            'avg_time_per_flow_ms': total_time / len(flows) if flows else 0,
            'model_id': model_id,
            'model_name': model_info['model_name']
        }
        
        logger.info(f"Batch prediction complete: {successful_predictions}/{len(flows)} flows processed in {total_time:.2f}ms")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in batch prediction: {e}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

def main():
    """Main function to start the service"""
    # Get configuration from environment
    host = os.getenv('INFERENCE_HOST', '0.0.0.0')
    port = int(os.getenv('INFERENCE_PORT', 5000))
    debug = os.getenv('INFERENCE_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting dynamic inference service on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    
    # Start Flask app
    app.run(host=host, port=port, debug=debug, threaded=True)

if __name__ == '__main__':
    main()





