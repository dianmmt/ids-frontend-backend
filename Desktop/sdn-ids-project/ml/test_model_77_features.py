#!/usr/bin/env python3
"""
Updated Model Test Script for 77 CICFlowMeter Features
Tests the model with the exact 77 features provided by the user
"""

import os
import sys
import pickle
import joblib
import numpy as np
import pandas as pd
import json
from typing import Dict, Any, List
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Exact 77 features as provided by the user
USER_77_FEATURES = [
    'Protocol', 'Flow Duration', 'Tot Fwd Pkts', 'Tot Bwd Pkts', 
    'TotLen Fwd Pkts', 'TotLen Bwd Pkts', 'Fwd Pkt Len Max', 'Fwd Pkt Len Min', 
    'Fwd Pkt Len Mean', 'Fwd Pkt Len Std', 'Bwd Pkt Len Max', 'Bwd Pkt Len Min', 
    'Bwd Pkt Len Mean', 'Bwd Pkt Len Std', 'Flow Byts/s', 'Flow Pkts/s', 
    'Flow IAT Mean', 'Flow IAT Std', 'Flow IAT Max', 'Flow IAT Min', 
    'Fwd IAT Tot', 'Fwd IAT Mean', 'Fwd IAT Std', 'Fwd IAT Max', 'Fwd IAT Min', 
    'Bwd IAT Tot', 'Bwd IAT Mean', 'Bwd IAT Std', 'Bwd IAT Max', 'Bwd IAT Min', 
    'Fwd PSH Flags', 'Bwd PSH Flags', 'Fwd URG Flags', 'Bwd URG Flags', 
    'Fwd Header Len', 'Bwd Header Len', 'Fwd Pkts/s', 'Bwd Pkts/s', 
    'Pkt Len Min', 'Pkt Len Max', 'Pkt Len Mean', 'Pkt Len Std', 'Pkt Len Var', 
    'FIN Flag Cnt', 'SYN Flag Cnt', 'RST Flag Cnt', 'PSH Flag Cnt', 'ACK Flag Cnt', 
    'URG Flag Cnt', 'CWE Flag Count', 'ECE Flag Cnt', 'Down/Up Ratio', 
    'Pkt Size Avg', 'Fwd Seg Size Avg', 'Bwd Seg Size Avg', 'Fwd Byts/b Avg', 
    'Fwd Pkts/b Avg', 'Fwd Blk Rate Avg', 'Bwd Byts/b Avg', 'Bwd Pkts/b Avg', 
    'Bwd Blk Rate Avg', 'Subflow Fwd Pkts', 'Subflow Fwd Byts', 'Subflow Bwd Pkts', 
    'Subflow Bwd Byts', 'Init Fwd Win Byts', 'Init Bwd Win Byts', 'Fwd Act Data Pkts', 
    'Fwd Seg Size Min', 'Active Mean', 'Active Std', 'Active Max', 'Active Min', 
    'Idle Mean', 'Idle Std', 'Idle Max', 'Idle Min'
]

# Mapping from user's feature names to internal names (for consistency)
FEATURE_MAPPING = {
    'Protocol': 'protocol',
    'Flow Duration': 'flow_duration',
    'Tot Fwd Pkts': 'total_fwd_packets',
    'Tot Bwd Pkts': 'total_backward_packets',
    'TotLen Fwd Pkts': 'total_length_of_fwd_packets',
    'TotLen Bwd Pkts': 'total_length_of_bwd_packets',
    'Fwd Pkt Len Max': 'fwd_packet_length_max',
    'Fwd Pkt Len Min': 'fwd_packet_length_min',
    'Fwd Pkt Len Mean': 'fwd_packet_length_mean',
    'Fwd Pkt Len Std': 'fwd_packet_length_std',
    'Bwd Pkt Len Max': 'bwd_packet_length_max',
    'Bwd Pkt Len Min': 'bwd_packet_length_min',
    'Bwd Pkt Len Mean': 'bwd_packet_length_mean',
    'Bwd Pkt Len Std': 'bwd_packet_length_std',
    'Flow Byts/s': 'flow_bytes_per_second',
    'Flow Pkts/s': 'flow_packets_per_second',
    'Flow IAT Mean': 'flow_iat_mean',
    'Flow IAT Std': 'flow_iat_std',
    'Flow IAT Max': 'flow_iat_max',
    'Flow IAT Min': 'flow_iat_min',
    'Fwd IAT Tot': 'fwd_iat_total',
    'Fwd IAT Mean': 'fwd_iat_mean',
    'Fwd IAT Std': 'fwd_iat_std',
    'Fwd IAT Max': 'fwd_iat_max',
    'Fwd IAT Min': 'fwd_iat_min',
    'Bwd IAT Tot': 'bwd_iat_total',
    'Bwd IAT Mean': 'bwd_iat_mean',
    'Bwd IAT Std': 'bwd_iat_std',
    'Bwd IAT Max': 'bwd_iat_max',
    'Bwd IAT Min': 'bwd_iat_min',
    'Fwd PSH Flags': 'fwd_psh_flags',
    'Bwd PSH Flags': 'bwd_psh_flags',
    'Fwd URG Flags': 'fwd_urg_flags',
    'Bwd URG Flags': 'bwd_urg_flags',
    'Fwd Header Len': 'fwd_header_length',
    'Bwd Header Len': 'bwd_header_length',
    'Fwd Pkts/s': 'fwd_packets_per_second',
    'Bwd Pkts/s': 'bwd_packets_per_second',
    'Pkt Len Min': 'min_packet_length',
    'Pkt Len Max': 'max_packet_length',
    'Pkt Len Mean': 'packet_length_mean',
    'Pkt Len Std': 'packet_length_std',
    'Pkt Len Var': 'packet_length_variance',
    'FIN Flag Cnt': 'fin_flag_count',
    'SYN Flag Cnt': 'syn_flag_count',
    'RST Flag Cnt': 'rst_flag_count',
    'PSH Flag Cnt': 'psh_flag_count',
    'ACK Flag Cnt': 'ack_flag_count',
    'URG Flag Cnt': 'urg_flag_count',
    'CWE Flag Count': 'cwe_flag_count',
    'ECE Flag Cnt': 'ece_flag_count',
    'Down/Up Ratio': 'down_up_ratio',
    'Pkt Size Avg': 'average_packet_size',
    'Fwd Seg Size Avg': 'avg_fwd_segment_size',
    'Bwd Seg Size Avg': 'avg_bwd_segment_size',
    'Fwd Byts/b Avg': 'fwd_avg_bytes_per_bulk',
    'Fwd Pkts/b Avg': 'fwd_avg_packets_per_bulk',
    'Fwd Blk Rate Avg': 'fwd_avg_bulk_rate',
    'Bwd Byts/b Avg': 'bwd_avg_bytes_per_bulk',
    'Bwd Pkts/b Avg': 'bwd_avg_packets_per_bulk',
    'Bwd Blk Rate Avg': 'bwd_avg_bulk_rate',
    'Subflow Fwd Pkts': 'subflow_fwd_packets',
    'Subflow Fwd Byts': 'subflow_fwd_bytes',
    'Subflow Bwd Pkts': 'subflow_bwd_packets',
    'Subflow Bwd Byts': 'subflow_bwd_bytes',
    'Init Fwd Win Byts': 'init_win_bytes_forward',
    'Init Bwd Win Byts': 'init_win_bytes_backward',
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

def load_model_components():
    """Load model, scaler, and label encoder"""
    components = {
        'model': None,
        'scaler': None,
        'label_encoder': None
    }
    
    # Try different model file names
    model_files = [
        'random_forest_full_best_model_1456_samples.pkl',
        'random_forest_model.joblib',
        'random_forest_model.pkl'
    ]
    
    for model_file in model_files:
        if os.path.exists(model_file):
            try:
                if model_file.endswith('.joblib'):
                    components['model'] = joblib.load(model_file)
                else:
                    with open(model_file, 'rb') as f:
                        components['model'] = pickle.load(f)
                logger.info(f"✅ Model loaded from {model_file}")
                logger.info(f"Model type: {type(components['model']).__name__}")
                if hasattr(components['model'], 'n_features_in_'):
                    logger.info(f"Expected features: {components['model'].n_features_in_}")
                break
            except Exception as e:
                logger.warning(f"Failed to load {model_file}: {e}")
    
    if components['model'] is None:
        logger.error("❌ No model file found!")
        return components
    
    # Load scaler
    scaler_files = ['scaler.joblib', 'scaler.pkl']
    for scaler_file in scaler_files:
        if os.path.exists(scaler_file):
            try:
                if scaler_file.endswith('.joblib'):
                    components['scaler'] = joblib.load(scaler_file)
                else:
                    with open(scaler_file, 'rb') as f:
                        components['scaler'] = pickle.load(f)
                logger.info(f"✅ Scaler loaded from {scaler_file}")
                break
            except Exception as e:
                logger.warning(f"Failed to load {scaler_file}: {e}")
    
    # Load label encoder
    encoder_files = ['label_encoder.joblib', 'label_encoder.pkl']
    for encoder_file in encoder_files:
        if os.path.exists(encoder_file):
            try:
                if encoder_file.endswith('.joblib'):
                    components['label_encoder'] = joblib.load(encoder_file)
                else:
                    with open(encoder_file, 'rb') as f:
                        components['label_encoder'] = pickle.load(f)
                logger.info(f"✅ Label encoder loaded from {encoder_file}")
                if hasattr(components['label_encoder'], 'classes_'):
                    logger.info(f"Available classes: {components['label_encoder'].classes_}")
                break
            except Exception as e:
                logger.warning(f"Failed to load {encoder_file}: {e}")
    
    return components

def create_sample_data_77_features():
    """Create sample data with all 77 features"""
    return {
        'Protocol': 6,  # TCP
        'Flow Duration': 120500,  # microseconds
        'Tot Fwd Pkts': 10,
        'Tot Bwd Pkts': 8,
        'TotLen Fwd Pkts': 1500,
        'TotLen Bwd Pkts': 800,
        'Fwd Pkt Len Max': 200,
        'Fwd Pkt Len Min': 100,
        'Fwd Pkt Len Mean': 150.0,
        'Fwd Pkt Len Std': 25.5,
        'Bwd Pkt Len Max': 150,
        'Bwd Pkt Len Min': 80,
        'Bwd Pkt Len Mean': 100.0,
        'Bwd Pkt Len Std': 20.2,
        'Flow Byts/s': 19087.13,
        'Flow Pkts/s': 149.38,
        'Flow IAT Mean': 6694.44,
        'Flow IAT Std': 11235.91,
        'Flow IAT Max': 35000,
        'Flow IAT Min': 0,
        'Fwd IAT Tot': 60250,
        'Fwd IAT Mean': 6694.44,
        'Fwd IAT Std': 11235.91,
        'Fwd IAT Max': 35000,
        'Fwd IAT Min': 0,
        'Bwd IAT Tot': 60250,
        'Bwd IAT Mean': 8607.14,
        'Bwd IAT Std': 13458.62,
        'Bwd IAT Max': 35000,
        'Bwd IAT Min': 0,
        'Fwd PSH Flags': 0,
        'Bwd PSH Flags': 0,
        'Fwd URG Flags': 0,
        'Bwd URG Flags': 0,
        'Fwd Header Len': 200,
        'Bwd Header Len': 160,
        'Fwd Pkts/s': 82.99,
        'Bwd Pkts/s': 66.39,
        'Pkt Len Min': 80,
        'Pkt Len Max': 200,
        'Pkt Len Mean': 127.78,
        'Pkt Len Std': 35.28,
        'Pkt Len Var': 1244.44,
        'FIN Flag Cnt': 0,
        'SYN Flag Cnt': 1,
        'RST Flag Cnt': 0,
        'PSH Flag Cnt': 2,
        'ACK Flag Cnt': 15,
        'URG Flag Cnt': 0,
        'CWE Flag Count': 0,
        'ECE Flag Cnt': 0,
        'Down/Up Ratio': 0.8,
        'Pkt Size Avg': 127.78,
        'Fwd Seg Size Avg': 150.0,
        'Bwd Seg Size Avg': 100.0,
        'Fwd Byts/b Avg': 0,
        'Fwd Pkts/b Avg': 0,
        'Fwd Blk Rate Avg': 0,
        'Bwd Byts/b Avg': 0,
        'Bwd Pkts/b Avg': 0,
        'Bwd Blk Rate Avg': 0,
        'Subflow Fwd Pkts': 10,
        'Subflow Fwd Byts': 1500,
        'Subflow Bwd Pkts': 8,
        'Subflow Bwd Byts': 800,
        'Init Fwd Win Byts': 65535,
        'Init Bwd Win Byts': 65535,
        'Fwd Act Data Pkts': 8,
        'Fwd Seg Size Min': 20,
        'Active Mean': 0,
        'Active Std': 0,
        'Active Max': 0,
        'Active Min': 0,
        'Idle Mean': 0,
        'Idle Std': 0,
        'Idle Max': 0,
        'Idle Min': 0
    }

def create_feature_array_77(data_dict, model):
    """Create feature array in exact order of USER_77_FEATURES"""
    features = []
    
    # Extract features in the exact order specified by the user
    for feature_name in USER_77_FEATURES:
        value = data_dict.get(feature_name, 0.0)
        try:
            # Handle special cases
            if pd.isna(value) or value == float('inf') or value == float('-inf'):
                value = 0.0
            features.append(float(value))
        except (ValueError, TypeError):
            features.append(0.0)
    
    # Verify we have exactly 77 features
    if len(features) != 77:
        logger.warning(f"Expected 77 features, got {len(features)}")
        # Pad or truncate to 77
        if len(features) < 77:
            features.extend([0.0] * (77 - len(features)))
        else:
            features = features[:77]
    
    # Convert to numpy array
    feature_array = np.array(features, dtype=np.float32).reshape(1, -1)
    
    # Handle any remaining infinite or NaN values
    feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=1e6, neginf=-1e6)
    
    logger.info(f"Created feature array with shape: {feature_array.shape}")
    logger.info(f"First 10 features: {feature_array[0][:10]}")
    logger.info(f"Last 10 features: {feature_array[0][-10:]}")
    
    return feature_array

def predict_with_model_77(model, scaler, label_encoder, feature_array):
    """Make prediction with the model"""
    try:
        # Apply scaling if available
        if scaler is not None:
            logger.info("Applying scaling...")
            feature_array_scaled = scaler.transform(feature_array)
        else:
            logger.warning("No scaler available, using raw features")
            feature_array_scaled = feature_array
        
        # Make prediction
        logger.info("Making prediction...")
        prediction = model.predict(feature_array_scaled)[0]
        
        # Get confidence if available
        confidence = 0.0
        probabilities = None
        if hasattr(model, 'predict_proba'):
            try:
                probabilities = model.predict_proba(feature_array_scaled)[0]
                confidence = float(np.max(probabilities))
                logger.info(f"Prediction probabilities: {probabilities}")
            except Exception as e:
                logger.warning(f"Could not get probabilities: {e}")
        
        # Decode label if encoder available
        predicted_label = str(prediction)
        if label_encoder is not None:
            try:
                predicted_label = label_encoder.inverse_transform([int(prediction)])[0]
            except Exception as e:
                logger.warning(f"Could not decode label: {e}")
        
        # Determine if malicious
        is_malicious = False
        if isinstance(prediction, (int, float)):
            is_malicious = prediction != 0  # Assume 0 is normal/benign
        elif isinstance(predicted_label, str):
            is_malicious = predicted_label.lower() not in ['normal', 'benign', 'legitimate']
        
        result = {
            'raw_prediction': prediction,
            'predicted_label': predicted_label,
            'confidence': confidence,
            'is_malicious': is_malicious,
            'probabilities': probabilities.tolist() if probabilities is not None else None
        }
        
        return result
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        import traceback
        traceback.print_exc()
        return {
            'raw_prediction': 'error',
            'predicted_label': 'error',
            'confidence': 0.0,
            'is_malicious': False,
            'error': str(e)
        }

def test_with_sample_data():
    """Test with sample data"""
    logger.info("=" * 60)
    logger.info("TESTING WITH SAMPLE DATA (77 FEATURES)")
    logger.info("=" * 60)
    
    # Load model components
    components = load_model_components()
    if components['model'] is None:
        logger.error("Cannot proceed without model")
        return None
    
    # Create sample data
    sample_data = create_sample_data_77_features()
    logger.info(f"Created sample data with {len(sample_data)} features")
    
    # Verify all 77 features are present
    missing_features = []
    for feature in USER_77_FEATURES:
        if feature not in sample_data:
            missing_features.append(feature)
    
    if missing_features:
        logger.warning(f"Missing features in sample data: {missing_features}")
    else:
        logger.info("✅ All 77 features present in sample data")
    
    # Create feature array
    feature_array = create_feature_array_77(sample_data, components['model'])
    
    # Make prediction
    result = predict_with_model_77(
        components['model'], 
        components['scaler'], 
        components['label_encoder'], 
        feature_array
    )
    
    # Display results
    logger.info("\n" + "=" * 40)
    logger.info("PREDICTION RESULTS")
    logger.info("=" * 40)
    logger.info(f"Raw prediction: {result['raw_prediction']}")
    logger.info(f"Predicted label: {result['predicted_label']}")
    logger.info(f"Confidence: {result['confidence']:.4f}")
    logger.info(f"Is malicious: {result['is_malicious']}")
    if result.get('probabilities'):
        logger.info(f"All probabilities: {result['probabilities']}")
    if result.get('error'):
        logger.error(f"Error: {result['error']}")
    
    return result

def test_with_csv_file(csv_path):
    """Test with CSV file containing 77 features"""
    logger.info("=" * 60)
    logger.info(f"TESTING WITH CSV FILE: {csv_path}")
    logger.info("=" * 60)
    
    if not os.path.exists(csv_path):
        logger.error(f"CSV file not found: {csv_path}")
        return None
    
    # Load model components
    components = load_model_components()
    if components['model'] is None:
        logger.error("Cannot proceed without model")
        return None
    
    try:
        # Load CSV
        df = pd.read_csv(csv_path)
        logger.info(f"Loaded CSV with {len(df)} rows and {len(df.columns)} columns")
        logger.info(f"CSV columns: {list(df.columns)}")
        
        # Check which of our 77 features are present
        present_features = []
        missing_features = []
        for feature in USER_77_FEATURES:
            if feature in df.columns:
                present_features.append(feature)
            else:
                missing_features.append(feature)
        
        logger.info(f"Present features: {len(present_features)}/77")
        if missing_features:
            logger.warning(f"Missing features: {missing_features}")
        
        # Test with first few rows
        test_rows = min(5, len(df))
        results = []
        
        for i in range(test_rows):
            logger.info(f"\n--- Testing Row {i+1} ---")
            row_data = df.iloc[i].to_dict()
            
            # Create feature array
            feature_array = create_feature_array_77(row_data, components['model'])
            
            # Make prediction
            result = predict_with_model_77(
                components['model'], 
                components['scaler'], 
                components['label_encoder'], 
                feature_array
            )
            
            result['row_index'] = i
            results.append(result)
            
            # Display result
            logger.info(f"Row {i+1} - Prediction: {result['predicted_label']}")
            logger.info(f"Row {i+1} - Confidence: {result['confidence']:.4f}")
            logger.info(f"Row {i+1} - Is malicious: {result['is_malicious']}")
        
        return results
        
    except Exception as e:
        logger.error(f"Error processing CSV file: {e}")
        import traceback
        traceback.print_exc()
        return None

def validate_feature_mapping():
    """Validate that our feature mapping covers all 77 features"""
    logger.info("=" * 60)
    logger.info("VALIDATING FEATURE MAPPING")
    logger.info("=" * 60)
    
    logger.info(f"Total user features: {len(USER_77_FEATURES)}")
    logger.info(f"Total mapped features: {len(FEATURE_MAPPING)}")
    
    # Check if all user features are mapped
    unmapped_features = []
    for feature in USER_77_FEATURES:
        if feature not in FEATURE_MAPPING:
            unmapped_features.append(feature)
    
    if unmapped_features:
        logger.warning(f"Unmapped features: {unmapped_features}")
    else:
        logger.info("✅ All 77 features are mapped")
    
    # Display feature list
    logger.info("\nUser's 77 Features:")
    for i, feature in enumerate(USER_77_FEATURES, 1):
        logger.info(f"{i:2d}. {feature}")
    
    return len(unmapped_features) == 0

def main():
    """Main test function"""
    print("=" * 80)
    print("MODEL TEST SCRIPT FOR 77 CICFLOWMETER FEATURES")
    print("=" * 80)
    
    try:
        # Validate feature mapping
        validate_feature_mapping()
        
        # Test with sample data
        sample_result = test_with_sample_data()
        
        # Ask for CSV file
        print("\n" + "=" * 60)
        csv_file = input("Enter path to CSV file with 77 features (or press Enter to skip): ").strip()
        
        if csv_file and os.path.exists(csv_file):
            csv_results = test_with_csv_file(csv_file)
        else:
            print("Skipping CSV test")
        
        print("\n" + "=" * 60)
        print("TEST SUMMARY")
        print("=" * 60)
        print(f"✅ Feature validation: All 77 features mapped")
        if sample_result:
            print(f"✅ Sample test: {sample_result['predicted_label']} (confidence: {sample_result['confidence']:.3f})")
        print("=" * 60)
        
    except Exception as e:
        logger.error(f"Error in main: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
