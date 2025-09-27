#!/usr/bin/env python3
"""
Complete CICFlowMeter Feature Test Script for Random Forest Model
Tests the model with proper CICFlowMeter feature mapping and CSV support
"""

import joblib
import numpy as np
import pandas as pd
import sys
import os

def load_model():
    """Load the random forest model"""
    print("Loading model...")
    model = joblib.load('random_forest_model.joblib')
    print(f"Model loaded: {type(model).__name__}")
    print(f"Expected features: {model.n_features_in_}")
    return model

def load_label_encoder():
    """Load label encoder if available to decode numeric predictions."""
    candidates = ['label_encoder.joblib', 'label_encoder.pkl']
    for path in candidates:
        if os.path.exists(path):
            try:
                if path.endswith('.joblib'):
                    return joblib.load(path)
                import pickle
                with open(path, 'rb') as f:
                    return pickle.load(f)
            except Exception:
                continue
    return None

def create_feature_mapping():
    """Create mapping from CICFlowMeter column names to internal feature names"""
    return {
        'Protocol': 'protocol',
        'Flow Duration': 'flow_duration',
        'Total Fwd Packet': 'total_fwd_packets',
        'Total Bwd packets': 'total_backward_packets',
        'Total Length of Fwd Packet': 'total_length_of_fwd_packets',
        'Total Length of Bwd Packet': 'total_length_of_bwd_packets',
        'Fwd Packet Length Max': 'fwd_packet_length_max',
        'Fwd Packet Length Min': 'fwd_packet_length_min',
        'Fwd Packet Length Mean': 'fwd_packet_length_mean',
        'Fwd Packet Length Std': 'fwd_packet_length_std',
        'Bwd Packet Length Max': 'bwd_packet_length_max',
        'Bwd Packet Length Min': 'bwd_packet_length_min',
        'Bwd Packet Length Mean': 'bwd_packet_length_mean',
        'Bwd Packet Length Std': 'bwd_packet_length_std',
        'Flow Bytes/s': 'flow_bytes_per_second',
        'Flow Packets/s': 'flow_packets_per_second',
        'Flow IAT Mean': 'flow_iat_mean',
        'Flow IAT Std': 'flow_iat_std',
        'Flow IAT Max': 'flow_iat_max',
        'Flow IAT Min': 'flow_iat_min',
        'Fwd IAT Total': 'fwd_iat_total',
        'Fwd IAT Mean': 'fwd_iat_mean',
        'Fwd IAT Std': 'fwd_iat_std',
        'Fwd IAT Max': 'fwd_iat_max',
        'Fwd IAT Min': 'fwd_iat_min',
        'Bwd IAT Total': 'bwd_iat_total',
        'Bwd IAT Mean': 'bwd_iat_mean',
        'Bwd IAT Std': 'bwd_iat_std',
        'Bwd IAT Max': 'bwd_iat_max',
        'Bwd IAT Min': 'bwd_iat_min',
        'Fwd PSH Flags': 'fwd_psh_flags',
        'Bwd PSH Flags': 'bwd_psh_flags',
        'Fwd URG Flags': 'fwd_urg_flags',
        'Bwd URG Flags': 'bwd_urg_flags',
        'Fwd Header Length': 'fwd_header_length',
        'Bwd Header Length': 'bwd_header_length',
        'Fwd Packets/s': 'fwd_packets_per_second',
        'Bwd Packets/s': 'bwd_packets_per_second',
        'Packet Length Min': 'min_packet_length',
        'Packet Length Max': 'max_packet_length',
        'Packet Length Mean': 'packet_length_mean',
        'Packet Length Std': 'packet_length_std',
        'Packet Length Variance': 'packet_length_variance',
        'FIN Flag Count': 'fin_flag_count',
        'SYN Flag Count': 'syn_flag_count',
        'RST Flag Count': 'rst_flag_count',
        'PSH Flag Count': 'psh_flag_count',
        'ACK Flag Count': 'ack_flag_count',
        'URG Flag Count': 'urg_flag_count',
        'CWR Flag Count': 'cwe_flag_count',
        'ECE Flag Count': 'ece_flag_count',
        'Down/Up Ratio': 'down_up_ratio',
        'Average Packet Size': 'average_packet_size',
        'Fwd Segment Size Avg': 'avg_fwd_segment_size',
        'Bwd Segment Size Avg': 'avg_bwd_segment_size',
        'Fwd Bytes/Bulk Avg': 'fwd_avg_bytes_per_bulk',
        'Fwd Packet/Bulk Avg': 'fwd_avg_packets_per_bulk',
        'Fwd Bulk Rate Avg': 'fwd_avg_bulk_rate',
        'Bwd Bytes/Bulk Avg': 'bwd_avg_bytes_per_bulk',
        'Bwd Packet/Bulk Avg': 'bwd_avg_packets_per_bulk',
        'Bwd Bulk Rate Avg': 'bwd_avg_bulk_rate',
        'Subflow Fwd Packets': 'subflow_fwd_packets',
        'Subflow Bwd Packets': 'subflow_bwd_packets',
        'Subflow Fwd Bytes': 'subflow_fwd_bytes',
        'Subflow Bwd Bytes': 'subflow_bwd_bytes',
        'FWD Init Win Bytes': 'init_win_bytes_forward',
        'Bwd Init Win Bytes': 'init_win_bytes_backward',
        'Fwd Act Data Pkts': 'act_data_pkt_fwd',
        'Fwd Seg Size Min': 'min_seg_size_forward',
        'Active Mean': 'active_mean',
        'Active Std': 'active_std',
        'Active Max': 'active_max',
        'Active Min': 'active_min',
        'Idle Mean': 'idle_mean',
        'Idle Std': 'idle_std',
        'Idle Max': 'idle_max',
        'Idle Min': 'idle_min'
    }

def create_sample_data():
    """Create sample CICFlowMeter data"""
    return {
        'Protocol': 6,  # TCP
        'Flow Duration': 10.5,
        'Total Fwd Packet': 100,
        'Total Bwd packets': 50,
        'Total Length of Fwd Packet': 50000,
        'Total Length of Bwd Packet': 25000,
        'Fwd Packet Length Max': 1500,
        'Fwd Packet Length Min': 64,
        'Fwd Packet Length Mean': 500,
        'Fwd Packet Length Std': 200,
        'Bwd Packet Length Max': 1000,
        'Bwd Packet Length Min': 32,
        'Bwd Packet Length Mean': 500,
        'Bwd Packet Length Std': 150,
        'Flow Bytes/s': 7500,
        'Flow Packets/s': 15,
        'Flow IAT Mean': 1000,
        'Flow IAT Std': 200,
        'Flow IAT Max': 2000,
        'Flow IAT Min': 100,
        'Fwd IAT Total': 10000,
        'Fwd IAT Mean': 800,
        'Fwd IAT Std': 150,
        'Fwd IAT Max': 1500,
        'Fwd IAT Min': 50,
        'Bwd IAT Total': 5000,
        'Bwd IAT Mean': 1200,
        'Bwd IAT Std': 250,
        'Bwd IAT Max': 2000,
        'Bwd IAT Min': 100,
        'Fwd PSH Flags': 0,
        'Bwd PSH Flags': 0,
        'Fwd URG Flags': 0,
        'Bwd URG Flags': 0,
        'Fwd Header Length': 20,
        'Bwd Header Length': 20,
        'Fwd Packets/s': 10,
        'Bwd Packets/s': 5,
        'Packet Length Min': 32,
        'Packet Length Max': 1500,
        'Packet Length Mean': 500,
        'Packet Length Std': 200,
        'Packet Length Variance': 40000,
        'FIN Flag Count': 0,
        'SYN Flag Count': 1,
        'RST Flag Count': 0,
        'PSH Flag Count': 10,
        'ACK Flag Count': 90,
        'URG Flag Count': 0,
        'CWR Flag Count': 0,
        'ECE Flag Count': 0,
        'Down/Up Ratio': 2,
        'Average Packet Size': 500,
        'Fwd Segment Size Avg': 500,
        'Bwd Segment Size Avg': 500,
        'Fwd Bytes/Bulk Avg': 1000,
        'Fwd Packet/Bulk Avg': 2,
        'Fwd Bulk Rate Avg': 0.1,
        'Bwd Bytes/Bulk Avg': 500,
        'Bwd Packet/Bulk Avg': 1,
        'Bwd Bulk Rate Avg': 0.05,
        'Subflow Fwd Packets': 100,
        'Subflow Bwd Packets': 50,
        'Subflow Fwd Bytes': 50000,
        'Subflow Bwd Bytes': 25000,
        'FWD Init Win Bytes': 65535,
        'Bwd Init Win Bytes': 65535,
        'Fwd Act Data Pkts': 100,
        'Fwd Seg Size Min': 0,
        'Active Mean': 1000,
        'Active Std': 200,
        'Active Max': 2000,
        'Active Min': 100,
        'Idle Mean': 0,
        'Idle Std': 0,
        'Idle Max': 0,
        'Idle Min': 0
    }

def map_features(cicflowmeter_data, feature_mapping):
    """Map CICFlowMeter features to internal names"""
    mapped_data = {}
    for cicflowmeter_name, internal_name in feature_mapping.items():
        if cicflowmeter_name in cicflowmeter_data:
            mapped_data[internal_name] = cicflowmeter_data[cicflowmeter_name]
        else:
            mapped_data[internal_name] = 0.0
    return mapped_data

def create_feature_array(mapped_data, model):
    """Create feature array in the correct order for the model"""
    # Define the expected feature order
    expected_features = [
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
        'avg_fwd_segment_size', 'avg_bwd_segment_size', 'fwd_avg_bytes_per_bulk', 'fwd_avg_packets_per_bulk', 'fwd_avg_bulk_rate',
        'bwd_avg_bytes_per_bulk', 'bwd_avg_packets_per_bulk', 'bwd_avg_bulk_rate',
        'subflow_fwd_packets', 'subflow_bwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_bytes',
        'init_win_bytes_forward', 'init_win_bytes_backward', 'act_data_pkt_fwd', 'min_seg_size_forward',
        'active_mean', 'active_std', 'active_max', 'active_min',
        'idle_mean', 'idle_std', 'idle_max', 'idle_min'
    ]
    
    # Take only the first N features that the model expects
    expected_features = expected_features[:model.n_features_in_]
    
    # If we don't have enough features, pad with zeros
    while len(expected_features) < model.n_features_in_:
        expected_features.append('padding_feature')
    
    # Extract features in the correct order
    features = []
    for feature_name in expected_features:
        value = mapped_data.get(feature_name, 0.0)
        try:
            features.append(float(value))
        except (ValueError, TypeError):
            features.append(0.0)
    
    # Convert to numpy array and reshape for single sample
    feature_array = np.array(features, dtype=np.float32).reshape(1, -1)
    
    # Handle infinite values
    feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
    
    return feature_array

def predict_with_model(model, feature_array, label_encoder=None):
    """Make prediction with the model"""
    prediction = model.predict(feature_array)[0]
    
    # Get confidence if available
    confidence = 0.0
    if hasattr(model, 'predict_proba'):
        probabilities = model.predict_proba(feature_array)
        confidence = float(np.max(probabilities))
    
    # Determine if it's malicious
    is_malicious = prediction == 1 if isinstance(prediction, (int, float)) else False
    
    # Decode human-readable label if possible
    label_name = None
    if label_encoder is not None:
        try:
            label_name = label_encoder.inverse_transform([int(prediction)])[0]
        except Exception:
            label_name = str(prediction)
    else:
        label_name = str(prediction)
    
    return {
        'prediction': prediction,
        'label': label_name,
        'confidence': confidence,
        'is_malicious': is_malicious
    }

def test_with_sample_data(model, label_encoder):
    """Test with sample CICFlowMeter data"""
    print("\n=== Testing with Sample CICFlowMeter Data ===")
    
    # Create sample data
    sample_data = create_sample_data()
    print(f"Sample data contains {len(sample_data)} features")
    
    # Create feature mapping
    feature_mapping = create_feature_mapping()
    
    # Map features
    mapped_data = map_features(sample_data, feature_mapping)
    print(f"Mapped {len(mapped_data)} features")
    
    # Create feature array
    feature_array = create_feature_array(mapped_data, model)
    print(f"Feature array shape: {feature_array.shape}")
    print(f"First 10 features: {feature_array[0][:10]}")
    
    # Make prediction
    result = predict_with_model(model, feature_array, label_encoder)
    
    print(f"Prediction (id): {result['prediction']}")
    print(f"Prediction (label): {result['label']}")
    print(f"Confidence: {result['confidence']:.3f}")
    print(f"Is Malicious: {result['is_malicious']}")
    
    return result

def test_with_csv(model, csv_file, label_encoder):
    """Test with CSV data from CICFlowMeter"""
    print(f"\n=== Testing with CSV Data: {csv_file} ===")
    
    try:
        # Load CSV data
        df = pd.read_csv(csv_file)
        print(f"Loaded CSV with {len(df)} rows and {len(df.columns)} columns")
        
        # Create feature mapping
        feature_mapping = create_feature_mapping()
        
        # Test with first few rows
        test_rows = min(5, len(df))
        results = []
        
        for i in range(test_rows):
            print(f"\nTesting row {i+1}:")
            row_data = df.iloc[i].to_dict()
            
            # Map CICFlowMeter features
            mapped_data = map_features(row_data, feature_mapping)
            
            # Create feature array
            feature_array = create_feature_array(mapped_data, model)
            
            # Make prediction
            result = predict_with_model(model, feature_array, label_encoder)
            
            results.append({
                'row_index': i,
                'prediction': result['prediction'],
                'label': result['label'],
                'is_malicious': result['is_malicious'],
                'confidence': result['confidence']
            })
            
            print(f"  Prediction (id): {result['prediction']}")
            print(f"  Prediction (label): {result['label']}")
            print(f"  Confidence: {result['confidence']:.3f}")
            print(f"  Is Malicious: {result['is_malicious']}")
        
        return results
        
    except Exception as e:
        print(f"Error testing with CSV data: {e}")
        return None

def main():
    print("=== Complete CICFlowMeter Random Forest Model Test ===")
    sys.stdout.flush()
    
    try:
        # Load model
        model = load_model()
        label_encoder = load_label_encoder()
        if label_encoder is None:
            print("Warning: label encoder not found; showing numeric class IDs")
        sys.stdout.flush()
        
        # Test with sample data
        sample_result = test_with_sample_data(model, label_encoder)
        sys.stdout.flush()
        
        # Ask for CSV file
        print("\n" + "="*50)
        csv_file = input("Enter path to CICFlowMeter CSV file (or press Enter to skip): ").strip()
        
        if csv_file and os.path.exists(csv_file):
            csv_results = test_with_csv(model, csv_file, label_encoder)
            sys.stdout.flush()
        else:
            print("Skipping CSV test")
        
        print("\n=== Test Summary ===")
        print(f"Model: {type(model).__name__}")
        print(f"Expected features: {model.n_features_in_}")
        print(f"Sample prediction (id): {sample_result['prediction']}")
        print(f"Sample prediction (label): {sample_result['label']}")
        print(f"Sample confidence: {sample_result['confidence']:.3f}")
        print(f"Sample is malicious: {sample_result['is_malicious']}")
        print("=== Test Complete ===")
        sys.stdout.flush()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()

if __name__ == '__main__':
    main()
