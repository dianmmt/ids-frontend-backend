# ml/ml_server.py - Simple API server for ML predictions
from flask import Flask, request, jsonify
import pickle
import pandas as pd
import numpy as np
import json
import traceback
import os
from datetime import datetime

# Import your inference script
import inference

app = Flask(__name__)

# Global model variable
model = None
active_model_meta = {
    'name': None,
    'version': None,
    'format': None,
    'framework': None,
    'sha256': None
}

def load_model_from_bytes(content: bytes, fmt: str):
    """Load model from bytes according to format (pkl/h5/joblib)."""
    global model
    try:
        if fmt == 'pkl':
            model = pickle.loads(content)
            return True
        elif fmt == 'h5':
            # Lazy import to avoid heavy deps unless needed
            import io
            import tensorflow as tf  # noqa: F401
            from tensorflow import keras
            bio = io.BytesIO(content)
            model = keras.models.load_model(bio)
            return True
        elif fmt == 'joblib':
            # Lazy import to avoid heavy deps unless needed
            import joblib
            import io
            bio = io.BytesIO(content)
            model = joblib.load(bio)
            return True
        else:
            raise ValueError('Unsupported format')
    except Exception as e:
        print(f"❌ Error loading model from bytes: {str(e)}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy' if model is not None else 'unhealthy',
        'model_loaded': model is not None,
        'model_meta': active_model_meta,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/model/load', methods=['POST'])
def load_model():
    """Load a new model from bytes"""
    global model, active_model_meta
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        name = data.get('name', 'Unknown')
        version = data.get('version', '1.0.0')
        fmt = data.get('format', 'pkl')
        framework = data.get('framework', 'unknown')
        sha256 = data.get('sha256', '')
        base64_content = data.get('base64Content', '')
        
        if not base64_content:
            return jsonify({'error': 'No model content provided'}), 400
        
        # Decode base64 content
        import base64
        content = base64.b64decode(base64_content)
        
        # Load model
        if load_model_from_bytes(content, fmt):
            active_model_meta = {
                'name': name,
                'version': version,
                'format': fmt,
                'framework': framework,
                'sha256': sha256
            }
            
            return jsonify({
                'success': True,
                'message': f'Model {name} v{version} loaded successfully',
                'model_meta': active_model_meta
            })
        else:
            return jsonify({'error': 'Failed to load model'}), 500
            
    except Exception as e:
        print(f"❌ Error loading model: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict', methods=['POST'])
def predict():
    """Make prediction on flow data"""
    if model is None:
        return jsonify({'error': 'No model loaded'}), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Use inference script for prediction
        result = inference.predict_threat(data, model)
        
        return jsonify({
            'success': True,
            'prediction': result.get('prediction', 'unknown'),
            'is_malicious': result.get('is_malicious', False),
            'confidence': result.get('confidence', 0.0),
            'model_meta': active_model_meta
        })
        
    except Exception as e:
        print(f"❌ Error in prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Make batch predictions on multiple flows"""
    if model is None:
        return jsonify({'error': 'No model loaded'}), 500
    
    try:
        data = request.get_json()
        flows = data.get('flows', [])
        
        if not flows:
            return jsonify({'error': 'No flows provided'}), 400
        
        predictions = []
        for i, flow_data in enumerate(flows):
            try:
                result = inference.predict_threat(flow_data, model)
            predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                'prediction': result.get('prediction', 'unknown'),
                'is_malicious': result.get('is_malicious', False),
                    'confidence': result.get('confidence', 0.0)
                })
            except Exception as e:
                predictions.append({
                    'flow_id': flow_data.get('flow_id', f'flow_{i}'),
                    'prediction': 'unknown',
                    'is_malicious': False,
                    'confidence': 0.0,
                    'error': str(e)
            })
        
        return jsonify({
            'success': True,
            'predictions': predictions,
            'total_flows': len(flows),
            'model_meta': active_model_meta
        })
        
    except Exception as e:
        print(f"❌ Error in batch prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/test', methods=['GET'])
def test_prediction():
    """Test endpoint with sample data"""
    if model is None:
        return jsonify({'error': 'No model loaded'}), 500
    
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
        
        result = inference.predict_threat(sample_flow, model)
        
        return jsonify({
            'success': True,
            'sample_flow': sample_flow,
            'prediction': result.get('prediction', 'unknown'),
            'is_malicious': result.get('is_malicious', False),
            'confidence': result.get('confidence', 0.0),
            'model_meta': active_model_meta
        })
        
    except Exception as e:
        print(f"❌ Error in test prediction: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    print("🚀 Starting ML Service...")
    app.run(host='0.0.0.0', port=5000, debug=True)
