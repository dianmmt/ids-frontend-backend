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

def load_model():
    """Load the trained ML model"""
    global model
    try:
        with open('model.pkl', 'rb') as f:
            model = pickle.load(f)
        print("✅ ML Model loaded successfully!")
        return True
    except Exception as e:
        print(f"❌ Error loading model: {str(e)}")
        return False

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/predict', methods=['POST'])
def predict():
    """Main prediction endpoint"""
    try:
        # Get input data
        data = request.json
        
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
        
        # Extract flow features from input
        flow_features = extract_features(data)
        
        # Use your inference.py script
        result = inference.predict_threat(flow_features, model)
        
        # Format response
        response = {
            'prediction': result.get('prediction', 'unknown'),
            'confidence': float(result.get('confidence', 0.0)),
            'is_malicious': result.get('is_malicious', False),
            'attack_type': result.get('attack_type', 'benign'),
            'inference_time': result.get('inference_time', 0),
            'timestamp': datetime.now().isoformat()
        }
        
        return jsonify(response)
        
    except Exception as e:
        error_msg = f"Prediction error: {str(e)}"
        print(f"❌ {error_msg}")
        traceback.print_exc()
        return jsonify({'error': error_msg}), 500

@app.route('/predict/batch', methods=['POST'])
def predict_batch():
    """Batch prediction endpoint for multiple flows"""
    try:
        data = request.json
        
        if not data or 'flows' not in data:
            return jsonify({'error': 'No flows data provided'}), 400
        
        flows = data['flows']
        predictions = []
        
        for flow in flows:
            flow_features = extract_features(flow)
            result = inference.predict_threat(flow_features, model)
            
            predictions.append({
                'flow_id': flow.get('flow_id', 'unknown'),
                'prediction': result.get('prediction', 'unknown'),
                'confidence': float(result.get('confidence', 0.0)),
                'is_malicious': result.get('is_malicious', False),
                'attack_type': result.get('attack_type', 'benign')
            })
        
        return jsonify({
            'predictions': predictions,
            'total_flows': len(predictions),
            'malicious_count': sum(1 for p in predictions if p['is_malicious']),
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        error_msg = f"Batch prediction error: {str(e)}"
        print(f"❌ {error_msg}")
        return jsonify({'error': error_msg}), 500

@app.route('/model/info', methods=['GET'])
def model_info():
    """Get model information"""
    try:
        if model is None:
            return jsonify({'error': 'Model not loaded'}), 500
        
        # Try to get model information
        model_info = {
            'model_type': type(model).__name__,
            'model_loaded': True,
            'features_count': getattr(model, 'n_features_in_', 'unknown'),
            'model_file': 'model.pkl'
        }
        
        # Add more model-specific info if available
        if hasattr(model, 'feature_names_in_'):
            model_info['feature_names'] = model.feature_names_in_.tolist()
        
        if hasattr(model, 'classes_'):
            model_info['classes'] = model.classes_.tolist()
            
        return jsonify(model_info)
        
    except Exception as e:
        return jsonify({'error': f"Error getting model info: {str(e)}"}), 500

@app.route('/test', methods=['GET'])
def test_prediction():
    """Test endpoint with sample data"""
    try:
        # Load test data
        with open('test_data.json', 'r') as f:
            test_data = json.load(f)
        
        # Run prediction on test data
        flow_features = extract_features(test_data)
        result = inference.predict_threat(flow_features, model)
        
        return jsonify({
            'test_input': test_data,
            'prediction_result': result,
            'status': 'success'
        })
        
    except Exception as e:
        return jsonify({
            'error': f"Test prediction failed: {str(e)}",
            'status': 'failed'
        }), 500

def extract_features(flow_data):
    """Extract ML features from flow data"""
    try:
        # Basic flow features that most ML models expect
        features = {
            'packet_count': flow_data.get('packet_count', 0),
            'byte_count': flow_data.get('byte_count', 0),
            'duration': flow_data.get('duration_seconds', 0),
            'protocol': flow_data.get('protocol', 'TCP'),
            'src_port': flow_data.get('source_port', 0),
            'dst_port': flow_data.get('destination_port', 0),
        }
        
        # Calculate derived features
        if features['duration'] > 0:
            features['packets_per_second'] = features['packet_count'] / features['duration']
            features['bytes_per_second'] = features['byte_count'] / features['duration']
        else:
            features['packets_per_second'] = 0
            features['bytes_per_second'] = 0
        
        if features['packet_count'] > 0:
            features['avg_packet_size'] = features['byte_count'] / features['packet_count']
        else:
            features['avg_packet_size'] = 0
        
        # Convert protocol to numeric (simple encoding)
        protocol_map = {'TCP': 6, 'UDP': 17, 'ICMP': 1}
        features['protocol_num'] = protocol_map.get(features['protocol'], 0)
        
        return features
        
    except Exception as e:
        print(f"❌ Feature extraction error: {str(e)}")
        raise

def initialize_app():
    """Initialize the ML application"""
    print("🚀 Starting ML Server...")
    
    # Load the ML model
    if not load_model():
        print("❌ Failed to load ML model. Exiting...")
        exit(1)
    
    print("✅ ML Server initialized successfully!")

if __name__ == '__main__':
    initialize_app()
    
    # Start Flask server
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )