# ml/dynamic_inference_service.py
import os
import time
import joblib
import numpy as np
import logging
import threading
from typing import Any, Dict, Tuple
from psycopg2.extras import RealDictCursor



# Logger setup
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Thread lock for safe model loading
_model_lock = threading.Lock()

def load_scaler_encoder() -> Tuple[Any, Any]:
    """
    Always load scaler and label encoder from ml/ folder.
    Returns (scaler, label_encoder) or (None, None) if not found.
    """
    scaler = None
    encoder = None
    scaler_path = os.path.join("ml", "scaler.pkl")
    encoder_path = os.path.join("ml", "label_encoder.pkl")

    if os.path.exists(scaler_path):
        try:
            scaler = joblib.load(scaler_path)
            logger.info("Scaler loaded successfully from ml/scaler.pkl")
        except Exception as e:
            logger.error(f"Failed to load scaler: {e}")

    if os.path.exists(encoder_path):
        try:
            encoder = joblib.load(encoder_path)
            logger.info("Label encoder loaded successfully from ml/label_encoder.pkl")
        except Exception as e:
            logger.error(f"Failed to load label encoder: {e}")

    return scaler, encoder


def load_model_from_database(model_id: str) -> Tuple[Any, Dict[str, Any]]:
    """
    Load model file from database metadata.
    Scaler & LabelEncoder are always loaded from ml/ folder.
    """
    with _model_lock:
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor(cursor_factory=RealDictCursor)

                # Only load model file
                query = """
                SELECT file_path
                FROM model_files
                WHERE model_id = %s 
                  AND file_type = 'model' 
                  AND upload_status = 'completed'
                LIMIT 1
                """
                cursor.execute(query, (model_id,))
                result = cursor.fetchone()

                if not result:
                    raise Exception(f"No model file found for model_id={model_id}")

                model_path = result["file_path"]
                if not os.path.exists(model_path):
                    raise Exception(f"Model file not found at {model_path}")

                # Load model object
                model_obj = joblib.load(model_path)
                logger.info(f"Model {model_id} loaded successfully from {model_path}")

                # Always load scaler & encoder from ml/
                scaler, label_encoder = load_scaler_encoder()

                context = {
                    "model_id": model_id,
                    "scaler": scaler,
                    "label_encoder": label_encoder,
                    "loaded_at": time.time()
                }

                return model_obj, context

        except Exception as e:
            logger.error(f"Error loading model {model_id}: {e}")
            raise


def run_inference(model: Any, context: Dict[str, Any], X_input: np.ndarray) -> Dict[str, Any]:
    """
    Run inference with preprocessing, scaling, and decoding labels.
    """
    try:
        scaler = context.get("scaler")
        label_encoder = context.get("label_encoder")

        # Apply scaling if scaler is available
        if scaler:
            X_input = scaler.transform(X_input)

        # Predict
        y_pred = model.predict(X_input)

        # Manual mapping if label encoder fails or is not available
        # Mapping: 0=BFA, 1=BOTNET, 2=DDoS, 3=DoS, 4=Normal, 5=Probe, 6=U2R, 7=Web-Attack
        label_mapping = {
            0: 'BFA',
            1: 'BOTNET', 
            2: 'DDoS',
            3: 'DoS',
            4: 'Normal',
            5: 'Probe',
            6: 'U2R',
            7: 'Web-Attack'
        }

        # Decode labels if encoder exists
        if label_encoder:
            try:
                y_pred_decoded = label_encoder.inverse_transform(y_pred)
            except Exception as e:
                logger.error(f"Label encoder failed: {e}, using manual mapping")
                y_pred_decoded = np.array([label_mapping.get(int(pred), f'Unknown_{pred}') for pred in y_pred])
        else:
            logger.warning("No label encoder available, using manual mapping")
            y_pred_decoded = np.array([label_mapping.get(int(pred), f'Unknown_{pred}') for pred in y_pred])

        result = {
            "predictions": y_pred_decoded.tolist(),
            "raw_predictions": y_pred.tolist(),
            "model_id": context["model_id"],
            "timestamp": time.time()
        }

        return result

    except Exception as e:
        logger.error(f"Inference failed: {e}")
        raise
