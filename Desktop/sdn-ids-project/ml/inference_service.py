#!/usr/bin/env python3
"""
CICFlowMeter ML Inference Service
REST API wrapper for ML model inference
"""

import os
import sys
import json
import time
import logging
from typing import Dict, Any, List, Optional
from flask import Flask, request, jsonify
from flask_cors import CORS
import numpy as np
import pandas as pd
from functools import lru_cache
import threading

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

# Global variables for model and context with thread safety
model = None
model_context = None
model_loaded = False
_model_lock = threading.Lock()

# Cache for preprocessing to avoid repeated work
_preprocessing_cache = {}

def load_ml_model():
    """Load the ML model and preprocessing artifacts with thread safety"""
    global model, model_context, model_loaded
    
    with _model_lock:
        try:
            model_folder = os.getenv('MODEL_FOLDER', '.')
            logger.info(f"Loading model from folder: {model_folder}")
            
            model, model_context = load_model_from_folder(model_folder)
            model_loaded = True
            
            logger.info(f"Model loaded successfully. Framework: {model_context.get('framework', 'unknown')}")
            logger.info(f"Model folder: {model_context.get('folder', 'unknown')}")
            logger.info(f"Has scaler: {model_context.get('scaler') is not None}")
            logger.info(f"Has label encoder: {model_context.get('label_encoder') is not None}")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            model_loaded = False
            return False

@lru_cache(maxsize=1000)
def preprocess_flow_data(flow_data: Dict[str, Any]) -> np.ndarray:
    """Preprocess flow data for ML prediction with caching"""
    try:
        # Create a hashable key for caching
        flow_key = tuple(sorted(flow_data.items()))
        
        # Check cache first
        if flow_key in _preprocessing_cache:
            return _preprocessing_cache[flow_key]
        
        # Map flow data to feature array (84 features)
        feature_names = [
            'flow_duration', 'total_fwd_packets', 'total_backward_packets',
            'total_length_of_fwd_packets', 'total_length_of_bwd_packets',
            'fwd_packet_length_max', 'fwd_packet_length_min', 'fwd_packet_length_mean', 'fwd_packet_length_std',
            'bwd_packet_length_max', 'bwd_packet_length_min', 'bwd_packet_length_mean', 'bwd_packet_length_std',
            'flow_bytes_per_second', 'flow_packets_per_second', 'flow_iat_mean', 'flow_iat_std', 'flow_iat_max', 'flow_iat_min',
            'fwd_iat_total', 'fwd_iat_mean', 'fwd_iat_std', 'fwd_iat_max', 'fwd_iat_min',
            'bwd_iat_total', 'bwd_iat_mean', 'bwd_iat_std', 'bwd_iat_max', 'bwd_iat_min',
            'fwd_psh_flags', 'bwd_psh_flags', 'fwd_urg_flags', 'bwd_urg_flags',
            'fwd_header_length', 'bwd_header_length', 'fwd_packets_per_second', 'bwd_packets_per_second',
            'min_packet_length', 'max_packet_length', 'packet_length_mean', 'packet_length_std', 'packet_length_variance',
            'fin_flag_count', 'syn_flag_count', 'rst_flag_count', 'psh_flag_count', 'ack_flag_count',
            'urg_flag_count', 'cwe_flag_count', 'ece_flag_count', 'down_up_ratio', 'average_packet_size',
            'avg_fwd_segment_size', 'avg_bwd_segment_size', 'fwd_header_length_1',
            'fwd_avg_bytes_per_bulk', 'fwd_avg_packets_per_bulk', 'fwd_avg_bulk_rate',
            'bwd_avg_bytes_per_bulk', 'bwd_avg_packets_per_bulk', 'bwd_avg_bulk_rate',
            'subflow_fwd_packets', 'subflow_bwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_bytes',
            'init_win_bytes_forward', 'init_win_bytes_backward', 'act_data_pkt_fwd', 'min_seg_size_forward',
            'active_mean', 'active_std', 'active_max', 'active_min',
            'idle_mean', 'idle_std', 'idle_max', 'idle_min'
        ]
        
        # Extract features in order
        features = [flow_data.get(name, 0.0) for name in feature_names]
        
        # Convert to numpy array and reshape for single sample
        feature_array = np.array(features, dtype=np.float32).reshape(1, -1)
        
        # Handle infinite values
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Cache the result
        _preprocessing_cache[flow_key] = feature_array
        
        return feature_array
        
    except Exception as e:
        logger.error(f"Error preprocessing flow data: {e}")
        raise

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy' if model_loaded else 'unhealthy',
        'model_loaded': model_loaded,
        'model_type': type(model).__name__ if model else 'None',
        'framework': model_context.get('framework', 'unknown') if model_context else 'unknown',
        'timestamp': time.time()
    })

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 500
    
    return jsonify({
        'model_type': type(model).__name__,
        'framework': model_context.get('framework', 'unknown'),
        'has_scaler': model_context.get('scaler') is not None,
        'has_label_encoder': model_context.get('label_encoder') is not None,
        'n_features': model.n_features_in_ if hasattr(model, 'n_features_in_') else 'Unknown'
    })

@app.route('/predict', methods=['POST'])
def predict_single():
    """Predict for a single flow"""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        start_time = time.time()
        
        # Get flow data from request
        flow_data = request.get_json()
        if not flow_data:
            return jsonify({'error': 'No flow data provided'}), 400
        
        # Preprocess data
        feature_array = preprocess_flow_data(flow_data)
        
        # Make prediction
        prediction_result = predict_threat(feature_array, model)
        
        inference_time = (time.time() - start_time) * 1000
        
        result = {
            'prediction': prediction_result.get('prediction', 'unknown'),
            'is_malicious': prediction_result.get('is_malicious', False),
            'confidence': prediction_result.get('confidence', 0.0),
            'inference_time': inference_time,
            'model_type': model_context.get('framework', 'unknown')
        }
        
        logger.info(f"Prediction: {result['prediction']} (confidence: {result['confidence']:.3f}, time: {inference_time:.2f}ms)")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Predict for multiple flows"""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        start_time = time.time()
        
        # Get batch data from request
        data = request.get_json()
        flows = data.get('flows', [])
        
        if not flows:
            return jsonify({'error': 'No flows provided'}), 400
        
        logger.info(f"Processing batch of {len(flows)} flows")
        
        predictions = []
        successful_predictions = 0
        
        for i, flow_data in enumerate(flows):
            try:
                # Preprocess data
                feature_array = preprocess_flow_data(flow_data)
                
                # Make prediction
                prediction_result = predict_threat(feature_array, model)
                
                predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                    'prediction': prediction_result.get('prediction', 'unknown'),
                    'is_malicious': prediction_result.get('is_malicious', False),
                    'confidence': prediction_result.get('confidence', 0.0)
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
            'avg_time_per_flow_ms': total_time / len(flows) if flows else 0
        }
        
        logger.info(f"Batch prediction complete: {successful_predictions}/{len(flows)} flows processed in {total_time:.2f}ms")
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error in batch prediction: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/test', methods=['GET'])
def test_prediction():
    """Test endpoint with sample data"""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        # Create sample flow data
        sample_flow = {
            'flow_duration': 10.5,
            'total_fwd_packets': 100,
            'total_backward_packets': 50,
            'total_length_of_fwd_packets': 50000,
            'total_length_of_bwd_packets': 25000,
            'fwd_packet_length_max': 1500,
            'fwd_packet_length_min': 64,
            'fwd_packet_length_mean': 500,
            'fwd_packet_length_std': 200,
            'bwd_packet_length_max': 1000,
            'bwd_packet_length_min': 32,
            'bwd_packet_length_mean': 500,
            'bwd_packet_length_std': 150,
            'flow_bytes_per_second': 7500,
            'flow_packets_per_second': 15,
            'flow_iat_mean': 1000,
            'flow_iat_std': 200,
            'flow_iat_max': 2000,
            'flow_iat_min': 100,
            'fwd_iat_total': 10000,
            'fwd_iat_mean': 800,
            'fwd_iat_std': 150,
            'fwd_iat_max': 1500,
            'fwd_iat_min': 50,
            'bwd_iat_total': 5000,
            'bwd_iat_mean': 1200,
            'bwd_iat_std': 250,
            'bwd_iat_max': 2000,
            'bwd_iat_min': 100,
            'fwd_psh_flags': 0,
            'bwd_psh_flags': 0,
            'fwd_urg_flags': 0,
            'bwd_urg_flags': 0,
            'fwd_header_length': 20,
            'bwd_header_length': 20,
            'fwd_packets_per_second': 10,
            'bwd_packets_per_second': 5,
            'min_packet_length': 32,
            'max_packet_length': 1500,
            'packet_length_mean': 500,
            'packet_length_std': 200,
            'packet_length_variance': 40000,
            'fin_flag_count': 0,
            'syn_flag_count': 1,
            'rst_flag_count': 0,
            'psh_flag_count': 10,
            'ack_flag_count': 90,
            'urg_flag_count': 0,
            'cwe_flag_count': 0,
            'ece_flag_count': 0,
            'down_up_ratio': 2,
            'average_packet_size': 500,
            'avg_fwd_segment_size': 500,
            'avg_bwd_segment_size': 500,
            'fwd_header_length_1': 20,
            'fwd_avg_bytes_per_bulk': 1000,
            'fwd_avg_packets_per_bulk': 2,
            'fwd_avg_bulk_rate': 0.1,
            'bwd_avg_bytes_per_bulk': 500,
            'bwd_avg_packets_per_bulk': 1,
            'bwd_avg_bulk_rate': 0.05,
            'subflow_fwd_packets': 100,
            'subflow_bwd_packets': 50,
            'subflow_fwd_bytes': 50000,
            'subflow_bwd_bytes': 25000,
            'init_win_bytes_forward': 65535,
            'init_win_bytes_backward': 65535,
            'act_data_pkt_fwd': 100,
            'min_seg_size_forward': 0,
            'active_mean': 1000,
            'active_std': 200,
            'active_max': 2000,
            'active_min': 100,
            'idle_mean': 0,
            'idle_std': 0,
            'idle_max': 0,
            'idle_min': 0
        }
        
        # Make prediction
        start_time = time.time()
        feature_array = preprocess_flow_data(sample_flow)
        prediction_result = predict_threat(feature_array, model)
        
        inference_time = (time.time() - start_time) * 1000
        
        return jsonify({
            'sample_flow': sample_flow,
            'prediction': prediction_result.get('prediction', 'unknown'),
            'is_malicious': prediction_result.get('is_malicious', False),
            'confidence': prediction_result.get('confidence', 0.0),
            'inference_time_ms': inference_time,
            'model_type': model_context.get('framework', 'unknown')
        })
        
    except Exception as e:
        logger.error(f"Error in test prediction: {e}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

def main():
    """Main function to start the service"""
    # Load model on startup
    if not load_ml_model():
        logger.error("Failed to load model. Exiting.")
        sys.exit(1)
    
    # Get configuration from environment
    host = os.getenv('INFERENCE_HOST', '0.0.0.0')
    port = int(os.getenv('INFERENCE_PORT', 5000))
    debug = os.getenv('INFERENCE_DEBUG', 'false').lower() == 'true'
    
    logger.info(f"Starting ML inference service on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    
    # Start Flask app
    app.run(host=host, port=port, debug=debug, threaded=True)

if __name__ == '__main__':
    main()





