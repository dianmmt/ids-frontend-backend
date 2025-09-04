import os
import io
import joblib
import numpy as np
import pandas as pd
from typing import Any, Dict, Tuple

try:
    # Optional: TensorFlow for .h5 models
    import tensorflow as tf  # noqa: F401
    from tensorflow import keras
except Exception:
    keras = None

def preprocess_input(X, scaler):
    """
    Preprocess input data: kiểm tra infinite values và scale.
    Args:
        X: numpy array hoặc DataFrame, shape (n_samples, n_features)
        scaler: StandardScaler đã load
    Returns:
        X_scaled: Dữ liệu đã scale, sẵn sàng cho predict
    """
    # Nếu input là DataFrame, chuyển sang numpy
    if isinstance(X, pd.DataFrame):
        X = X.values.astype('float32')
    else:
        X = np.array(X, dtype='float32')

    # Kiểm tra và loại bỏ infinite values
    finite_mask = ~np.isinf(X).any(axis=1)
    if not np.all(finite_mask):
        print(f"Warning: {np.sum(~finite_mask)} samples with infinite values were removed.")
        X = X[finite_mask]

    # Scale dữ liệu (if scaler provided)
    if scaler is not None:
        X = scaler.transform(X)
    return X

def load_model_from_folder(folder_path: str) -> Tuple[Any, Dict[str, Any]]:
    """
    Load model and preprocessing artifacts from a folder.
    Supports:
      - scikit-learn (.pkl/.joblib for model, scaler, label_encoder)
      - Keras .h5 models
    Returns: (model, context) where context may include scaler, label_encoder, metadata
    """
    folder = os.path.abspath(folder_path or '.')
    context: Dict[str, Any] = {
        'folder': folder,
        'scaler': None,
        'label_encoder': None,
        'framework': None
    }

    # Prefer Keras H5 if exists
    h5_candidates = [
        os.path.join(folder, 'model.h5'),
        os.path.join(folder, 'keras_model.h5')
    ]
    for h5 in h5_candidates:
        if os.path.exists(h5):
            if keras is None:
                raise RuntimeError('TensorFlow/Keras not available for .h5 model')
            model = keras.models.load_model(h5)
            context['framework'] = 'tensorflow'
            # optional scaler/encoder
            scaler_path = os.path.join(folder, 'scaler.joblib')
            if os.path.exists(scaler_path):
                context['scaler'] = joblib.load(scaler_path)
            label_path = os.path.join(folder, 'label_encoder.joblib')
            if os.path.exists(label_path):
                context['label_encoder'] = joblib.load(label_path)
            return model, context

    # Fallback to scikit-learn model
    skl_candidates = [
        os.path.join(folder, 'model.pkl'),
        os.path.join(folder, 'random_forest_model.joblib'),
        os.path.join(folder, 'model.joblib')
    ]
    model_obj = None
    for p in skl_candidates:
        if os.path.exists(p):
            if p.endswith('.pkl'):
                model_obj = joblib.load(p)
            else:
                model_obj = joblib.load(p)
            context['framework'] = 'scikit-learn'
            break

    if model_obj is None:
        raise FileNotFoundError('No supported model file found in folder')

    scaler_path = os.path.join(folder, 'scaler.joblib')
    if os.path.exists(scaler_path):
        context['scaler'] = joblib.load(scaler_path)
    label_path = os.path.join(folder, 'label_encoder.joblib')
    if os.path.exists(label_path):
        context['label_encoder'] = joblib.load(label_path)

    return model_obj, context

def predict(X, model, label_encoder):
    """
    Dự đoán class cho input mới.
    Args:
        X: numpy array hoặc DataFrame, shape (n_samples, n_features)
        model: RandomForestClassifier đã load
        label_encoder: LabelEncoder đã load
    Returns:
        predictions: List các class names
    """
    # Backward-compatible default loaders (if not provided externally)
    scaler = None
    if os.path.exists('scaler.joblib'):
        scaler = joblib.load('scaler.joblib')
    if model is None:
        # Try to find a model alongside
        if os.path.exists('random_forest_model.joblib'):
            model = joblib.load('random_forest_model.joblib')
        elif os.path.exists('model.pkl'):
            model = joblib.load('model.pkl')
        elif os.path.exists('model.h5') and keras is not None:
            model = keras.models.load_model('model.h5')
    if label_encoder is None and os.path.exists('label_encoder.joblib'):
        label_encoder = joblib.load('label_encoder.joblib')

    # Preprocess input
    X_scaled = preprocess_input(X, scaler)

    # Dự đoán
    # Predict across frameworks
    if hasattr(model, 'predict'):
        y_pred = model.predict(X_scaled)
    else:
        raise RuntimeError('Loaded model has no predict method')

    # If probabilistic outputs, choose class indices
    if isinstance(y_pred, np.ndarray) and y_pred.ndim > 1 and y_pred.shape[1] > 1:
        y_idx = np.argmax(y_pred, axis=1)
    else:
        y_idx = y_pred

    # Map to class names if encoder available
    if label_encoder is not None:
        try:
            y_classes = label_encoder.inverse_transform(y_idx)
            return y_classes
        except Exception:
            pass
    return y_idx

def predict_threat(features: Dict[str, float], model) -> Dict[str, Any]:
    """
    Predict threat-level output for a single flow features dict.
    Returns standard keys used by the backend.
    """
    # Simple example mapping; customize as needed
    feature_values = np.array([[
        features.get('packet_count', 0),
        features.get('byte_count', 0),
        features.get('duration', 0),
        features.get('packets_per_second', 0),
        features.get('bytes_per_second', 0),
        features.get('avg_packet_size', 0),
        features.get('protocol_num', 0),
        features.get('src_port', 0),
        features.get('dst_port', 0),
    ]], dtype='float32')

    # Attempt default scaler load
    scaler = joblib.load('scaler.joblib') if os.path.exists('scaler.joblib') else None
    X = preprocess_input(feature_values, scaler)

    # Predict
    if hasattr(model, 'predict_proba'):
        proba = model.predict_proba(X)
        if isinstance(proba, list):
            proba = np.array(proba)
        if proba.ndim == 2 and proba.shape[1] > 1:
            conf = float(np.max(proba))
        else:
            conf = float(proba.squeeze().mean())
    else:
        # For Keras/others
        try:
            raw = model.predict(X)
            conf = float(np.max(raw)) if isinstance(raw, np.ndarray) else 0.5
        except Exception:
            conf = 0.5

    # Placeholder logic for classification outcome
    pred = None
    try:
        pred = model.predict(X)
        if isinstance(pred, np.ndarray) and pred.ndim > 1:
            pred = np.argmax(pred, axis=1)
        if isinstance(pred, np.ndarray):
            pred = pred.squeeze().item() if pred.size == 1 else int(pred[0])
    except Exception:
        pred = 0

    is_malicious = bool(pred == 1)
    return {
        'prediction': 'malicious' if is_malicious else 'benign',
        'confidence': conf,
        'is_malicious': is_malicious,
        'attack_type': 'anomaly' if is_malicious else 'benign',
        'inference_time': 0
    }

if __name__ == "__main__":
    # Example usage
    example_folder = os.getenv('MODEL_FOLDER', '.')
    try:
        mdl, ctx = load_model_from_folder(example_folder)
        X_new = np.random.randn(5, 8).astype('float32')
        print('Predict demo:', predict(X_new, mdl, ctx.get('label_encoder')))
    except Exception as e:
        print('Load/predict demo failed:', e)