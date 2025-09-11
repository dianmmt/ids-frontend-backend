#!/usr/bin/env python3
"""
Test script for multi-class CICFlowMeter model
Tests the model with sample data and displays results
"""

import os
import sys
import numpy as np
import joblib
from typing import Dict, Any

def test_model():
    """Test the multi-class model with sample data"""
    
    # Load model components
    try:
        model = joblib.load('random_forest_model.joblib')
        scaler = joblib.load('scaler.joblib')
        label_encoder = joblib.load('label_encoder.joblib')
        
        print("✅ Model components loaded successfully")
        print(f"Model type: {type(model).__name__}")
        print(f"Available classes: {label_encoder.classes_}")
        print(f"Number of features: {model.n_features_in_}")
        
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return False
    
    # Create sample data that matches your example
    sample_data = np.array([
        # Flow ID: 192.168.3.130-200.175.2.130-3632-33747-6
        # This should be a U2R attack based on your example
        [
            0.0,  # flow_duration
            0,    # total_fwd_packets
            0,    # total_backward_packets
            0,    # total_length_of_fwd_packets
            0,    # total_length_of_bwd_packets
            # ... (add all 84 features with appropriate values)
            # For now, using zeros as placeholder
        ] + [0.0] * 79  # Fill remaining features with zeros
    ])
    
    # Ensure we have the right number of features
    if len(sample_data[0]) != model.n_features_in_:
        print(f"❌ Feature count mismatch: expected {model.n_features_in_}, got {len(sample_data[0])}")
        return False
    
    try:
        # Scale the data
        data_scaled = scaler.transform(sample_data)
        
        # Get prediction
        prediction = model.predict(data_scaled)[0]
        predicted_class = label_encoder.inverse_transform([prediction])[0]
        
        # Get probabilities
        probabilities = model.predict_proba(data_scaled)[0]
        
        # Create probability dictionary
        prob_dict = {
            label_encoder.classes_[i]: float(prob) 
            for i, prob in enumerate(probabilities)
        }
        
        print(f"\n🎯 Prediction Results:")
        print(f"Predicted class: {predicted_class}")
        print(f"Confidence: {max(probabilities):.4f}")
        
        print(f"\n📊 All Probabilities:")
        for class_name, prob in sorted(prob_dict.items(), key=lambda x: x[1], reverse=True):
            print(f"  {class_name}: {prob:.4f} ({prob*100:.1f}%)")
        
        # Test with a more realistic U2R pattern
        print(f"\n🔬 Testing with U2R-like pattern...")
        u2r_data = sample_data.copy()
        # Modify some features to look more like U2R
        u2r_data[0][0] = 1.0  # flow_duration
        u2r_data[0][1] = 10   # total_fwd_packets
        u2r_data[0][2] = 5    # total_backward_packets
        u2r_data[0][3] = 1000 # total_length_of_fwd_packets
        u2r_data[0][4] = 500  # total_length_of_bwd_packets
        
        u2r_scaled = scaler.transform(u2r_data)
        u2r_prediction = model.predict(u2r_scaled)[0]
        u2r_class = label_encoder.inverse_transform([u2r_prediction])[0]
        u2r_probs = model.predict_proba(u2r_scaled)[0]
        
        u2r_prob_dict = {
            label_encoder.classes_[i]: float(prob) 
            for i, prob in enumerate(u2r_probs)
        }
        
        print(f"U2R Pattern - Predicted: {u2r_class}")
        print(f"U2R Pattern - Confidence: {max(u2r_probs):.4f}")
        print("Top 3 predictions:")
        for class_name, prob in sorted(u2r_prob_dict.items(), key=lambda x: x[1], reverse=True)[:3]:
            print(f"  {class_name}: {prob:.4f} ({prob*100:.1f}%)")
        
        return True
        
    except Exception as e:
        print(f"❌ Error during prediction: {e}")
        return False

def test_inference_service():
    """Test the inference service API"""
    import requests
    import json
    
    try:
        # Test health endpoint
        response = requests.get('http://localhost:5003/health', timeout=5)
        if response.status_code == 200:
            print("✅ Multi-class inference service is healthy")
            print(f"Service info: {response.json()}")
        else:
            print(f"❌ Service health check failed: {response.status_code}")
            return False
        
        # Test prediction endpoint
        sample_flow = {
            'flow_duration': 10.5,
            'total_fwd_packets': 100,
            'total_backward_packets': 50,
            'total_length_of_fwd_packets': 50000,
            'total_length_of_bwd_packets': 25000,
            # Add more features as needed
        }
        
        # Fill missing features with zeros
        for i in range(84 - len(sample_flow)):
            sample_flow[f'feature_{i}'] = 0.0
        
        response = requests.post(
            'http://localhost:5003/predict',
            json=sample_flow,
            headers={'Content-Type': 'application/json'},
            timeout=10
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Prediction successful")
            print(f"Result: {json.dumps(result, indent=2)}")
            return True
        else:
            print(f"❌ Prediction failed: {response.status_code} - {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to inference service. Make sure it's running on port 5003")
        return False
    except Exception as e:
        print(f"❌ Error testing inference service: {e}")
        return False

if __name__ == "__main__":
    print("🧪 Testing Multi-Class CICFlowMeter Model")
    print("=" * 50)
    
    # Test 1: Direct model testing
    print("\n1. Testing model directly...")
    model_success = test_model()
    
    # Test 2: Inference service testing
    print("\n2. Testing inference service...")
    service_success = test_inference_service()
    
    print("\n" + "=" * 50)
    if model_success and service_success:
        print("🎉 All tests passed!")
    else:
        print("❌ Some tests failed. Check the output above.")
        sys.exit(1)


