#!/usr/bin/env python3
"""
Model Accuracy Checker
Checks model accuracy with known test data
"""

import os
import sys
import numpy as np
import pandas as pd
import joblib
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report

def load_model():
    """Load model components"""
    try:
        model = joblib.load('random_forest_model.pkl')
        scaler = joblib.load('scaler.pkl')
        label_encoder = joblib.load('label_encoder.pkl')
        
        print("✅ Model loaded successfully")
        print(f"Model type: {type(model).__name__}")
        print(f"Features: {model.n_features_in_}")
        print(f"Classes: {list(label_encoder.classes_)}")
        
        return model, scaler, label_encoder
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        return None, None, None

def create_test_data():
    """Create test data with known labels"""
    print("\n📊 Creating test data...")
    
    # Define test cases with expected labels
    test_cases = [
        {
            'label': 'Normal',
            'features': {
                'flow_duration': 10.0,
                'total_fwd_packets': 50,
                'total_backward_packets': 45,
                'total_length_of_fwd_packets': 5000,
                'total_length_of_bwd_packets': 4500,
                'flow_bytes_per_second': 500,
                'flow_packets_per_second': 5,
                'syn_flag_count': 1,
                'ack_flag_count': 90,
                'fin_flag_count': 0,
                'rst_flag_count': 0
            }
        },
        {
            'label': 'DDoS',
            'features': {
                'flow_duration': 0.1,
                'total_fwd_packets': 10000,
                'total_backward_packets': 0,
                'total_length_of_fwd_packets': 1000000,
                'total_length_of_bwd_packets': 0,
                'flow_bytes_per_second': 10000000,
                'flow_packets_per_second': 100000,
                'syn_flag_count': 10000,
                'ack_flag_count': 0,
                'fin_flag_count': 0,
                'rst_flag_count': 0
            }
        },
        {
            'label': 'Probe',
            'features': {
                'flow_duration': 0.5,
                'total_fwd_packets': 1000,
                'total_backward_packets': 0,
                'total_length_of_fwd_packets': 50000,
                'total_length_of_bwd_packets': 0,
                'flow_bytes_per_second': 100000,
                'flow_packets_per_second': 2000,
                'syn_flag_count': 1000,
                'ack_flag_count': 0,
                'fin_flag_count': 0,
                'rst_flag_count': 1000
            }
        },
        {
            'label': 'BFA',
            'features': {
                'flow_duration': 2.0,
                'total_fwd_packets': 100,
                'total_backward_packets': 100,
                'total_length_of_fwd_packets': 8000,
                'total_length_of_bwd_packets': 8000,
                'flow_bytes_per_second': 4000,
                'flow_packets_per_second': 50,
                'syn_flag_count': 100,
                'ack_flag_count': 100,
                'fin_flag_count': 0,
                'rst_flag_count': 0
            }
        }
    ]
    
    # Feature names (77 CICFlowMeter features)
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
        'urg_flag_count', 'cwe_flag_count', 'ece_flag_count',
        'down_up_ratio', 'average_packet_size', 'avg_fwd_segment_size', 'avg_bwd_segment_size',
        'fwd_header_length_1', 'fwd_avg_bytes_per_bulk', 'fwd_avg_packets_per_bulk', 'fwd_avg_bulk_rate',
        'bwd_avg_bytes_per_bulk', 'bwd_avg_packets_per_bulk', 'bwd_avg_bulk_rate',
        'subflow_fwd_packets', 'subflow_bwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_bytes',
        'init_win_bytes_forward', 'init_win_bytes_backward', 'act_data_pkt_fwd', 'min_seg_size_forward',
        'active_mean', 'active_std', 'active_max', 'active_min',
        'idle_mean', 'idle_std', 'idle_max', 'idle_min'
    ]
    
    # Create multiple samples for each test case
    X = []
    y = []
    
    for test_case in test_cases:
        # Create 10 variations of each test case
        for i in range(10):
            features = []
            for feature_name in feature_names:
                value = test_case['features'].get(feature_name, 0.0)
                # Add some noise to make it more realistic
                if value > 0:
                    noise = np.random.normal(0, value * 0.1)  # 10% noise
                    value = max(0, value + noise)
                features.append(value)
            
            X.append(features)
            y.append(test_case['label'])
    
    X = np.array(X)
    y = np.array(y)
    
    print(f"Created {len(X)} test samples")
    print(f"Classes: {np.unique(y)}")
    
    return X, y, feature_names

def check_accuracy(model, scaler, label_encoder, X, y):
    """Check model accuracy"""
    print("\n🎯 Checking model accuracy...")
    
    try:
        # Apply scaling
        if scaler:
            X_scaled = scaler.transform(X)
        else:
            X_scaled = X
        
        # Get predictions
        y_pred = model.predict(X_scaled)
        
        # Convert predictions to class names
        if label_encoder:
            y_pred_classes = label_encoder.inverse_transform(y_pred)
        else:
            y_pred_classes = y_pred
        
        # Calculate metrics
        accuracy = accuracy_score(y, y_pred_classes)
        precision = precision_score(y, y_pred_classes, average='weighted')
        recall = recall_score(y, y_pred_classes, average='weighted')
        f1 = f1_score(y, y_pred_classes, average='weighted')
        
        print(f"Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print(f"Precision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1 Score: {f1:.4f}")
        
        # Confusion matrix
        print("\n📊 Confusion Matrix:")
        cm = confusion_matrix(y, y_pred_classes)
        print(cm)
        
        # Classification report
        print("\n📋 Classification Report:")
        report = classification_report(y, y_pred_classes)
        print(report)
        
        # Detailed results
        print("\n🔍 Detailed Results:")
        for i in range(len(y)):
            correct = "✅" if y[i] == y_pred_classes[i] else "❌"
            print(f"Sample {i+1}: {correct} Expected: {y[i]}, Predicted: {y_pred_classes[i]}")
        
        return accuracy, precision, recall, f1
        
    except Exception as e:
        print(f"❌ Error checking accuracy: {e}")
        return 0, 0, 0, 0

def test_individual_predictions(model, scaler, label_encoder):
    """Test individual predictions with detailed output"""
    print("\n🔬 Testing individual predictions...")
    
    # Test cases
    test_cases = [
        {
            'name': 'Normal Traffic',
            'data': {
                'flow_duration': 10.0,
                'total_fwd_packets': 50,
                'total_backward_packets': 45,
                'total_length_of_fwd_packets': 5000,
                'total_length_of_bwd_packets': 4500,
                'flow_bytes_per_second': 500,
                'flow_packets_per_second': 5,
                'syn_flag_count': 1,
                'ack_flag_count': 90
            }
        },
        {
            'name': 'DDoS Attack',
            'data': {
                'flow_duration': 0.1,
                'total_fwd_packets': 10000,
                'total_backward_packets': 0,
                'total_length_of_fwd_packets': 1000000,
                'total_length_of_bwd_packets': 0,
                'flow_bytes_per_second': 10000000,
                'flow_packets_per_second': 100000,
                'syn_flag_count': 10000,
                'ack_flag_count': 0
            }
        }
    ]
    
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
        'urg_flag_count', 'cwe_flag_count', 'ece_flag_count',
        'down_up_ratio', 'average_packet_size', 'avg_fwd_segment_size', 'avg_bwd_segment_size',
        'fwd_header_length_1', 'fwd_avg_bytes_per_bulk', 'fwd_avg_packets_per_bulk', 'fwd_avg_bulk_rate',
        'bwd_avg_bytes_per_bulk', 'bwd_avg_packets_per_bulk', 'bwd_avg_bulk_rate',
        'subflow_fwd_packets', 'subflow_bwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_bytes',
        'init_win_bytes_forward', 'init_win_bytes_backward', 'act_data_pkt_fwd', 'min_seg_size_forward',
        'active_mean', 'active_std', 'active_max', 'active_min',
        'idle_mean', 'idle_std', 'idle_max', 'idle_min'
    ]
    
    for test_case in test_cases:
        print(f"\nTesting {test_case['name']}:")
        
        # Extract features
        features = []
        for feature_name in feature_names:
            features.append(test_case['data'].get(feature_name, 0.0))
        
        feature_array = np.array(features).reshape(1, -1)
        
        # Apply scaling
        if scaler:
            feature_array = scaler.transform(feature_array)
        
        # Get prediction
        prediction = model.predict(feature_array)[0]
        probabilities = model.predict_proba(feature_array)[0]
        
        # Get class name
        if label_encoder:
            predicted_class = label_encoder.inverse_transform([prediction])[0]
        else:
            predicted_class = str(prediction)
        
        # Calculate confidence
        confidence = float(np.max(probabilities))
        
        print(f"  Predicted: {predicted_class}")
        print(f"  Confidence: {confidence:.4f}")
        
        # Show all probabilities
        if label_encoder:
            prob_dict = {
                label_encoder.classes_[i]: float(prob) 
                for i, prob in enumerate(probabilities)
            }
            print("  All probabilities:")
            for class_name, prob in sorted(prob_dict.items(), key=lambda x: x[1], reverse=True):
                print(f"    {class_name}: {prob:.4f} ({prob*100:.1f}%)")

def main():
    """Main function"""
    print("🧪 MODEL ACCURACY CHECKER")
    print("=" * 50)
    
    # Load model
    model, scaler, label_encoder = load_model()
    if model is None:
        print("❌ Failed to load model. Exiting.")
        return
    
    # Create test data
    X, y, feature_names = create_test_data()
    
    # Check accuracy
    accuracy, precision, recall, f1 = check_accuracy(model, scaler, label_encoder, X, y)
    
    # Test individual predictions
    test_individual_predictions(model, scaler, label_encoder)
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 SUMMARY")
    print("=" * 50)
    print(f"Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    print(f"Precision: {precision:.4f}")
    print(f"Recall: {recall:.4f}")
    print(f"F1 Score: {f1:.4f}")
    
    if accuracy >= 0.9:
        print("✅ Model accuracy is excellent!")
    elif accuracy >= 0.8:
        print("⚠️  Model accuracy is good but could be improved")
    elif accuracy >= 0.7:
        print("⚠️  Model accuracy is moderate - consider retraining")
    else:
        print("❌ Model accuracy is poor - retraining recommended")

if __name__ == "__main__":
    main()
