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
from typing import Any, Dict, Tuple, Optional, Union
import json
import logging
from functools import lru_cache
from standardized_preprocessing import standardize_flow_data, validate_feature_count

# Configure logging
logger = logging.getLogger(__name__)

def preprocess_input(X: np.ndarray, scaler: Optional[Any]) -> np.ndarray:
    """Preprocess input data with scaler if available"""
    if scaler is not None:
        try:
            return scaler.transform(X)
        except Exception as e:
            logger.warning(f"Scaler failed, using raw features: {e}")
            return X
    return X

@lru_cache(maxsize=1)
def load_model_from_folder(folder_path: str) -> Tuple[Any, Dict[str, Any]]:
    """Load model and preprocessing artifacts from folder with caching"""
    model_obj = None
    scaler = None
    label_encoder = None
    framework = 'unknown'
    
    # Try to load different model formats in order of preference
    model_files = {
        'joblib': 'random_forest_model.joblib',
        'joblib_alt': 'model.joblib',
        'pkl': 'model.pkl',
        'pkl_alt': 'sdn_ids_model.pkl',
        'h5': 'model.h5'
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
                
                logger.info(f"Model loaded from {model_path} ({framework})")
                break
            except Exception as e:
                logger.warning(f"Failed to load {model_path}: {e}")
                continue
    
    if model_obj is None:
        raise FileNotFoundError("No valid model file found in folder")
    
    # Try to load scaler
    scaler_files = ['scaler.joblib', 'scaler.pkl']
    for scaler_file in scaler_files:
        scaler_path = os.path.join(folder_path, scaler_file)
        if os.path.exists(scaler_path):
            try:
                if scaler_file.endswith('.pkl'):
                    with open(scaler_path, 'rb') as f:
                        scaler = pickle.load(f)
                else:
                    scaler = joblib.load(scaler_path)
                logger.info(f"Scaler loaded from {scaler_path}")
                break
            except Exception as e:
                logger.warning(f"Failed to load scaler {scaler_path}: {e}")
    
    # Try to load label encoder
    encoder_files = ['label_encoder.joblib', 'label_encoder.pkl']
    for encoder_file in encoder_files:
        encoder_path = os.path.join(folder_path, encoder_file)
        if os.path.exists(encoder_path):
            try:
                if encoder_file.endswith('.pkl'):
                    with open(encoder_path, 'rb') as f:
                        label_encoder = pickle.load(f)
                else:
                    label_encoder = joblib.load(encoder_path)
                logger.info(f"Label encoder loaded from {encoder_path}")
                break
            except Exception as e:
                logger.warning(f"Failed to load label encoder {encoder_path}: {e}")
    
    # Load metadata if available
    metadata_path = os.path.join(folder_path, 'metadata.json')
    metadata = {}
    if os.path.exists(metadata_path):
        try:
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load metadata: {e}")
    
    context = {
        'model': model_obj,
        'scaler': scaler,
        'label_encoder': label_encoder,
        'framework': framework,
        'folder': folder_path,
        'metadata': metadata
    }
    
    return model_obj, context

def predict(X: np.ndarray, model: Any, label_encoder: Optional[Any]) -> Union[str, np.ndarray]:
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
                logger.warning(f"Label encoder failed: {e}")
                prediction = str(prediction[0]) if len(prediction) > 0 else 'unknown'
        else:
            # Convert to string if no label encoder
            prediction = str(prediction[0]) if len(prediction) > 0 else 'unknown'
        
        return prediction
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return 'unknown'

def predict_threat(features: Dict[str, float], model: Any, scaler: Optional[Any] = None, label_encoder: Optional[Any] = None) -> Dict[str, Any]:
    """Predict threat for given features using standardized preprocessing"""
    try:
        # Use standardized preprocessing
        feature_array = standardize_flow_data(features)
        
        # Validate feature count
        if not validate_feature_count(feature_array):
            logger.warning("Feature count validation failed, using fallback")
            # Get actual feature count from model
            feature_count = model.n_features_in_ if hasattr(model, 'n_features_in_') else 77
            feature_array = np.zeros((1, feature_count), dtype=np.float32)
        
        # Apply scaler if available
        if scaler is not None:
            try:
                feature_array = scaler.transform(feature_array)
            except Exception as e:
                logger.warning(f"Scaler failed: {e}")
        
        # Get prediction
        prediction = model.predict(feature_array)[0]
        
        # Get confidence if available
        confidence = 0.0
        if hasattr(model, 'predict_proba'):
            try:
                probabilities = model.predict_proba(feature_array)[0]
                confidence = float(np.max(probabilities))
            except Exception as e:
                logger.warning(f"Could not get probabilities: {e}")
        
        # Apply label encoder if available
        if label_encoder is not None:
            try:
                if isinstance(prediction, (np.integer, int)):
                    prediction = label_encoder.inverse_transform([prediction])[0]
                else:
                    prediction = str(prediction)
            except Exception as e:
                logger.warning(f"Label encoder failed: {e}")
                prediction = str(prediction)
        else:
            prediction = str(prediction)
        
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
        logger.error(f"Error in threat prediction: {e}")
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
        
        logger.info(f"Model loaded: {type(model).__name__}")
        logger.info(f"Framework: {context['framework']}")
        logger.info(f"Has scaler: {context['scaler'] is not None}")
        logger.info(f"Has label encoder: {context['label_encoder'] is not None}")
        
        # Test prediction with standardized preprocessing
        test_features = {
            'duration': 10.5,
            'packet_count': 100,
            'byte_count': 50000,
            'avg_packet_size': 500,
            'source_ip': '192.168.1.1',
            'destination_ip': '10.0.0.1'
        }
        
        result = predict_threat(test_features, model, context.get('scaler'), context.get('label_encoder'))
        logger.info(f"Test prediction: {result}")
        
    except Exception as e:
        logger.error(f"Error in main: {e}")

if __name__ == '__main__':
    main()





