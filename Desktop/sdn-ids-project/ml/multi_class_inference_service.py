#!/usr/bin/env python3
"""
Multi-Class ML Inference Service for CICFlowMeter Attack Detection
Supports Random Forest multi-class classification with proper attack type mapping
"""

import os
import sys
import json
import time
import logging
import numpy as np
import pandas as pd
import joblib
from typing import Dict, Any, List, Optional, Tuple
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Global variables for model and context
model = None
scaler = None
label_encoder = None
model_loaded = False

# Attack type mapping for display
ATTACK_TYPE_MAPPING = {
    'BFA': 'Brute Force Attack',
    'BOTNET': 'Botnet',
    'DDoS': 'Distributed Denial of Service',
    'DoS': 'Denial of Service',
    'Normal': 'Normal Traffic',
    'Probe': 'Network Probe/Scan',
    'U2R': 'User to Root Attack',
    'Web-Attack': 'Web Application Attack'
}

# Severity mapping based on attack type
SEVERITY_MAPPING = {
    'BFA': 'medium',
    'BOTNET': 'high',
    'DDoS': 'critical',
    'DoS': 'high',
    'Normal': 'low',
    'Probe': 'medium',
    'U2R': 'critical',
    'Web-Attack': 'high'
}

def load_ml_model():
    """Load the ML model and preprocessing artifacts"""
    global model, scaler, label_encoder, model_loaded
    
    try:
        model_folder = os.getenv('MODEL_FOLDER', '.')
        logger.info(f"Loading model from folder: {model_folder}")
        
        # Load model
        model_path = os.path.join(model_folder, 'random_forest_model.joblib')
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        model = joblib.load(model_path)
        logger.info(f"Model loaded: {type(model).__name__}")
        
        # Load scaler
        scaler_path = os.path.join(model_folder, 'scaler.joblib')
        if os.path.exists(scaler_path):
            scaler = joblib.load(scaler_path)
            logger.info("Scaler loaded successfully")
        else:
            logger.warning("Scaler file not found, using raw features")
        
        # Load label encoder
        encoder_path = os.path.join(model_folder, 'label_encoder.joblib')
        if os.path.exists(encoder_path):
            label_encoder = joblib.load(encoder_path)
            logger.info(f"Label encoder loaded with classes: {label_encoder.classes_}")
        else:
            logger.warning("Label encoder not found, using numeric labels")
        
        model_loaded = True
        logger.info("Multi-class ML model loaded successfully")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        model_loaded = False
        return False

def preprocess_flow_data(flow_data: Dict[str, Any]) -> np.ndarray:
    """Preprocess flow data for ML prediction - matches CICFlowMeter features"""
    try:
        # Map flow data to CICFlowMeter feature array (84 features)
        # This should match the exact order used in training
        features = [
            # Basic flow info (dropped in training but needed for preprocessing)
            flow_data.get('flow_duration', 0),
            flow_data.get('total_fwd_packets', 0),
            flow_data.get('total_backward_packets', 0),
            flow_data.get('total_length_of_fwd_packets', 0),
            flow_data.get('total_length_of_bwd_packets', 0),
            
            # Packet length features
            flow_data.get('fwd_packet_length_max', 0),
            flow_data.get('fwd_packet_length_min', 0),
            flow_data.get('fwd_packet_length_mean', 0),
            flow_data.get('fwd_packet_length_std', 0),
            flow_data.get('bwd_packet_length_max', 0),
            flow_data.get('bwd_packet_length_min', 0),
            flow_data.get('bwd_packet_length_mean', 0),
            flow_data.get('bwd_packet_length_std', 0),
            
            # Flow timing features
            flow_data.get('flow_bytes_per_second', 0),
            flow_data.get('flow_packets_per_second', 0),
            flow_data.get('flow_iat_mean', 0),
            flow_data.get('flow_iat_std', 0),
            flow_data.get('flow_iat_max', 0),
            flow_data.get('flow_iat_min', 0),
            
            # Forward IAT features
            flow_data.get('fwd_iat_total', 0),
            flow_data.get('fwd_iat_mean', 0),
            flow_data.get('fwd_iat_std', 0),
            flow_data.get('fwd_iat_max', 0),
            flow_data.get('fwd_iat_min', 0),
            
            # Backward IAT features
            flow_data.get('bwd_iat_total', 0),
            flow_data.get('bwd_iat_mean', 0),
            flow_data.get('bwd_iat_std', 0),
            flow_data.get('bwd_iat_max', 0),
            flow_data.get('bwd_iat_min', 0),
            
            # Protocol features
            flow_data.get('fwd_psh_flags', 0),
            flow_data.get('bwd_psh_flags', 0),
            flow_data.get('fwd_urg_flags', 0),
            flow_data.get('bwd_urg_flags', 0),
            flow_data.get('fwd_header_length', 0),
            flow_data.get('bwd_header_length', 0),
            flow_data.get('fwd_packets_per_second', 0),
            flow_data.get('bwd_packets_per_second', 0),
            
            # Window size features
            flow_data.get('min_packet_length', 0),
            flow_data.get('max_packet_length', 0),
            flow_data.get('packet_length_mean', 0),
            flow_data.get('packet_length_std', 0),
            flow_data.get('packet_length_variance', 0),
            
            # Flag counts
            flow_data.get('fin_flag_count', 0),
            flow_data.get('syn_flag_count', 0),
            flow_data.get('rst_flag_count', 0),
            flow_data.get('psh_flag_count', 0),
            flow_data.get('ack_flag_count', 0),
            flow_data.get('urg_flag_count', 0),
            flow_data.get('cwe_flag_count', 0),
            flow_data.get('ece_flag_count', 0),
            
            # Additional features
            flow_data.get('down_up_ratio', 0),
            flow_data.get('average_packet_size', 0),
            flow_data.get('avg_fwd_segment_size', 0),
            flow_data.get('avg_bwd_segment_size', 0),
            
            # Extended CICFlowMeter features
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

def predict_attack_class(feature_array: np.ndarray) -> Tuple[str, Dict[str, float], float]:
    """Predict attack class and return probabilities"""
    try:
        # Apply scaling if scaler is available
        if scaler is not None:
            feature_array = scaler.transform(feature_array)
        
        # Get prediction
        prediction = model.predict(feature_array)[0]
        
        # Get probabilities for all classes
        probabilities = model.predict_proba(feature_array)[0]
        
        # Map prediction to class name
        if label_encoder is not None:
            predicted_class = label_encoder.inverse_transform([prediction])[0]
        else:
            predicted_class = str(prediction)
        
        # Create probability dictionary
        prob_dict = {}
        if label_encoder is not None:
            for i, class_name in enumerate(label_encoder.classes_):
                prob_dict[class_name] = float(probabilities[i])
        else:
            for i, prob in enumerate(probabilities):
                prob_dict[f'Class_{i}'] = float(prob)
        
        # Get confidence (max probability)
        confidence = float(np.max(probabilities))
        
        return predicted_class, prob_dict, confidence
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return 'Unknown', {}, 0.0

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy' if model_loaded else 'unhealthy',
        'model_loaded': model_loaded,
        'model_type': type(model).__name__ if model else 'None',
        'has_scaler': scaler is not None,
        'has_label_encoder': label_encoder is not None,
        'available_classes': label_encoder.classes_.tolist() if label_encoder else [],
        'timestamp': time.time()
    })

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    if not model_loaded:
        return jsonify({'error': 'Model not loaded'}), 500
    
    return jsonify({
        'model_type': type(model).__name__,
        'has_scaler': scaler is not None,
        'has_label_encoder': label_encoder is not None,
        'available_classes': label_encoder.classes_.tolist() if label_encoder else [],
        'n_features': model.n_features_in_ if hasattr(model, 'n_features_in_') else 'Unknown',
        'attack_type_mapping': ATTACK_TYPE_MAPPING,
        'severity_mapping': SEVERITY_MAPPING
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
        predicted_class, prob_dict, confidence = predict_attack_class(feature_array)
        
        # Determine if it's an attack
        is_attack = predicted_class != 'Normal'
        
        # Map to display name and severity
        attack_type = ATTACK_TYPE_MAPPING.get(predicted_class, predicted_class)
        severity = SEVERITY_MAPPING.get(predicted_class, 'low')
        
        inference_time = (time.time() - start_time) * 1000
        
        result = {
            'prediction': predicted_class,
            'is_malicious': is_attack,
            'attack_type': attack_type,
            'severity': severity,
            'confidence': confidence,
            'probabilities': prob_dict,
            'inference_time': inference_time,
            'model_type': 'multi_class_random_forest'
        }
        
        logger.info(f"Prediction: {predicted_class} (confidence: {confidence:.3f}, time: {inference_time:.2f}ms)")
        
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
                predicted_class, prob_dict, confidence = predict_attack_class(feature_array)
                
                # Determine if it's an attack
                is_attack = predicted_class != 'Normal'
                
                # Map to display name and severity
                attack_type = ATTACK_TYPE_MAPPING.get(predicted_class, predicted_class)
                severity = SEVERITY_MAPPING.get(predicted_class, 'low')
                
                predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                    'prediction': predicted_class,
                    'is_malicious': is_attack,
                    'attack_type': attack_type,
                    'severity': severity,
                    'confidence': confidence,
                    'probabilities': prob_dict
                })
                
                successful_predictions += 1
                
            except Exception as e:
                logger.error(f"Error processing flow {i}: {e}")
                predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                    'prediction': 'Unknown',
                    'is_malicious': False,
                    'attack_type': 'Unknown',
                    'severity': 'low',
                    'confidence': 0.0,
                    'probabilities': {},
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
        # Create sample flow data that matches CICFlowMeter format
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
        predicted_class, prob_dict, confidence = predict_attack_class(feature_array)
        
        is_attack = predicted_class != 'Normal'
        attack_type = ATTACK_TYPE_MAPPING.get(predicted_class, predicted_class)
        severity = SEVERITY_MAPPING.get(predicted_class, 'low')
        
        inference_time = (time.time() - start_time) * 1000
        
        return jsonify({
            'sample_flow': sample_flow,
            'prediction': predicted_class,
            'is_malicious': is_attack,
            'attack_type': attack_type,
            'severity': severity,
            'confidence': confidence,
            'probabilities': prob_dict,
            'inference_time_ms': inference_time,
            'model_type': 'multi_class_random_forest'
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
    
    logger.info(f"Starting multi-class inference service on {host}:{port}")
    logger.info(f"Debug mode: {debug}")
    
    # Start Flask app
    app.run(host=host, port=port, debug=debug, threaded=True)

if __name__ == '__main__':
    main()
