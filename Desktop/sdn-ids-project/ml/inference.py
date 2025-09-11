#!/usr/bin/env python3
"""
ML Inference Module
Handles model loading and prediction for various ML frameworks
"""

import os
import pickle
import joblib
import numpy as np
import pandas as pd
from typing import Any, Dict, Tuple, Optional
import json

def preprocess_input(X, scaler):
    """Preprocess input data with scaler if available"""
    if scaler is not None:
        try:
            return scaler.transform(X)
        except Exception as e:
            print(f"Warning: Scaler failed, using raw features: {e}")
            return X
    return X

def load_model_from_folder(folder_path: str) -> Tuple[Any, Dict[str, Any]]:
    """Load model and preprocessing artifacts from folder"""
    model_obj = None
    scaler = None
    label_encoder = None
    framework = 'unknown'
    
    # Try to load different model formats
    model_files = {
        'pkl': 'model.pkl',
        'joblib': 'model.joblib',
        'h5': 'model.h5',
        'pkl_alt': 'sdn_ids_model.pkl',
        'joblib_alt': 'random_forest_model.joblib'
    }
    
    # Try to load model
    for fmt, filename in model_files.items():
        model_path = os.path.join(folder_path, filename)
        if os.path.exists(model_path):
            try:
                if fmt in ['pkl', 'pkl_alt']:
                    with open(model_path, 'rb') as f:
                        model_obj = pickle.load(f)
                    framework = 'scikit-learn'
                elif fmt in ['joblib', 'joblib_alt']:
                    model_obj = joblib.load(model_path)
                    framework = 'scikit-learn'
                elif fmt == 'h5':
                    import tensorflow as tf
                    from tensorflow import keras
                    model_obj = keras.models.load_model(model_path)
                    framework = 'tensorflow'
                
                print(f"✅ Model loaded from {model_path} ({framework})")
                break
            except Exception as e:
                print(f"❌ Failed to load {model_path}: {e}")
                continue
    
    if model_obj is None:
        raise FileNotFoundError("No valid model file found in folder")
    
    # Try to load scaler
    scaler_files = ['scaler.pkl', 'scaler.joblib']
    for scaler_file in scaler_files:
        scaler_path = os.path.join(folder_path, scaler_file)
        if os.path.exists(scaler_path):
            try:
                if scaler_file.endswith('.pkl'):
                    with open(scaler_path, 'rb') as f:
                        scaler = pickle.load(f)
                else:
                    scaler = joblib.load(scaler_path)
                print(f"✅ Scaler loaded from {scaler_path}")
                break
            except Exception as e:
                print(f"❌ Failed to load scaler {scaler_path}: {e}")
    
    # Try to load label encoder
    encoder_files = ['label_encoder.pkl', 'label_encoder.joblib']
    for encoder_file in encoder_files:
        encoder_path = os.path.join(folder_path, encoder_file)
        if os.path.exists(encoder_path):
            try:
                if encoder_file.endswith('.pkl'):
                    with open(encoder_path, 'rb') as f:
                        label_encoder = pickle.load(f)
                else:
                    label_encoder = joblib.load(encoder_path)
                print(f"✅ Label encoder loaded from {encoder_path}")
                break
            except Exception as e:
                print(f"❌ Failed to load label encoder {encoder_path}: {e}")
    
    # Load metadata if available
    metadata_path = os.path.join(folder_path, 'metadata.json')
    metadata = {}
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
        except Exception as e:
            print(f"❌ Failed to load metadata: {e}")
    
    context = {
        'model': model_obj,
        'scaler': scaler,
        'label_encoder': label_encoder,
        'framework': framework,
        'folder': folder_path,
        'metadata': metadata
    }
    
    return model_obj, context

def predict(X, model, label_encoder):
    """Make prediction with model and label encoder"""
    try:
        # Get prediction
        if hasattr(model, 'predict'):
            prediction = model.predict(X)
        else:
            # For models without predict method, try to call directly
            prediction = model(X)
        
        # Convert to numpy array if needed
        if hasattr(prediction, 'numpy'):
            prediction = prediction.numpy()
        
        prediction = np.array(prediction)
        
        # Handle single prediction
        if prediction.ndim > 1:
            prediction = prediction.flatten()
        
        # Apply label encoder if available
        if label_encoder is not None:
            try:
                # Handle both single and multiple predictions
                if len(prediction.shape) == 0 or prediction.shape[0] == 1:
                    # Single prediction
                    pred_value = prediction[0] if prediction.shape[0] == 1 else prediction
                    if isinstance(pred_value, (np.integer, int)):
                        prediction = label_encoder.inverse_transform([pred_value])[0]
                    else:
                        prediction = str(pred_value)
                else:
                    # Multiple predictions
                    prediction = label_encoder.inverse_transform(prediction)
            except Exception as e:
                print(f"Warning: Label encoder failed: {e}")
                prediction = str(prediction[0]) if len(prediction) > 0 else 'unknown'
        else:
            # Convert to string if no label encoder
            prediction = str(prediction[0]) if len(prediction) > 0 else 'unknown'
        
        return prediction
        
    except Exception as e:
        print(f"Error in prediction: {e}")
        return 'unknown'

def predict_threat(features: Dict[str, float], model) -> Dict[str, Any]:
    """Predict threat for given features"""
    try:
        # Convert features to array
        feature_array = np.array(list(features.values())).reshape(1, -1)
        
        # Handle infinite values
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
        
        # Get prediction
        prediction = model.predict(feature_array)[0]
        
        # Get confidence if available
        confidence = 0.0
        if hasattr(model, 'predict_proba'):
            try:
                probabilities = model.predict_proba(feature_array)[0]
                confidence = float(np.max(probabilities))
            except Exception as e:
                print(f"Warning: Could not get probabilities: {e}")
        
        # Determine if it's malicious
        is_malicious = False
        if isinstance(prediction, str):
            is_malicious = prediction.lower() not in ['normal', 'benign', 'legitimate']
        elif isinstance(prediction, (int, float)):
            # For binary classification, assume 1 is malicious
            is_malicious = prediction == 1
        else:
            is_malicious = str(prediction).lower() not in ['normal', 'benign', 'legitimate']
        
        return {
            'prediction': str(prediction),
            'is_malicious': is_malicious,
            'confidence': confidence
        }
        
    except Exception as e:
        print(f"Error in threat prediction: {e}")
        return {
            'prediction': 'unknown',
            'is_malicious': False,
            'confidence': 0.0
        }

def main():
    """Test the inference module"""
    try:
        # Test loading model
        model_folder = os.getenv('MODEL_FOLDER', '.')
        model, context = load_model_from_folder(model_folder)
        
        print(f"Model loaded: {type(model).__name__}")
        print(f"Framework: {context['framework']}")
        print(f"Has scaler: {context['scaler'] is not None}")
        print(f"Has label encoder: {context['label_encoder'] is not None}")
        
        # Test prediction
        test_features = {
            'flow_duration': 10.5,
            'total_fwd_packets': 100,
            'total_backward_packets': 50,
            'total_length_of_fwd_packets': 50000,
            'total_length_of_bwd_packets': 25000
        }
        
        result = predict_threat(test_features, model)
        print(f"Test prediction: {result}")
        
    except Exception as e:
        print(f"Error in main: {e}")

if __name__ == '__main__':
    main()





