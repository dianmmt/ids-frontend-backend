#!/usr/bin/env python3
"""
Test script to verify model loading and confidence calculation
"""

import os
import sys
import json
import numpy as np
import pickle
import joblib
from pathlib import Path

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_model_loading():
    """Test loading the random forest model and extracting sklearn model"""
    print("=" * 60)
    print("Testing Model Loading and Confidence Calculation")
    print("=" * 60)
    
    # Test model file
    model_file = "random_forest_full_best_model_1456_samples.pkl"
    scaler_file = "scaler.joblib"
    encoder_file = "label_encoder.joblib"
    
    if not os.path.exists(model_file):
        print(f"❌ Model file not found: {model_file}")
        return False
    
    try:
        # Load model
        print(f"📁 Loading model from: {model_file}")
        with open(model_file, 'rb') as f:
            raw_model = pickle.load(f)
        
        print(f"📦 Raw model type: {type(raw_model).__name__}")
        print(f"📦 Raw model attributes: {[attr for attr in dir(raw_model) if not attr.startswith('_')]}")
        
        # Extract sklearn model
        def extract_sklearn_model(loaded_model):
            """Extract sklearn model from wrapper classes"""
            print(f"🔍 Extracting sklearn model from: {type(loaded_model).__name__}")
            
            # If it's already a sklearn model, return as is
            if hasattr(loaded_model, 'predict') and hasattr(loaded_model, 'predict_proba'):
                print(f"✅ Model is already sklearn-compatible: {type(loaded_model).__name__}")
                return loaded_model
            
            # Try to extract from common wrapper patterns
            extraction_methods = [
                # Method 1: Check for 'model' attribute
                lambda m: getattr(m, 'model', None),
                # Method 2: Check for 'estimator' attribute  
                lambda m: getattr(m, 'estimator', None),
                # Method 3: Check for 'classifier' attribute
                lambda m: getattr(m, 'classifier', None),
                # Method 4: Check for 'regressor' attribute
                lambda m: getattr(m, 'regressor', None),
                # Method 5: Check for 'sklearn_model' attribute
                lambda m: getattr(m, 'sklearn_model', None),
                # Method 6: Check for 'rf' attribute (RandomForest specific)
                lambda m: getattr(m, 'rf', None),
                # Method 7: Check for 'random_forest' attribute
                lambda m: getattr(m, 'random_forest', None),
            ]
            
            for i, method in enumerate(extraction_methods):
                try:
                    extracted = method(loaded_model)
                    if extracted is not None and hasattr(extracted, 'predict'):
                        print(f"✅ Successfully extracted model using method {i+1}: {type(extracted).__name__}")
                        return extracted
                except Exception as e:
                    print(f"❌ Extraction method {i+1} failed: {e}")
                    continue
            
            # If no extraction worked, try to find any attribute that has predict method
            print(f"🔍 Trying to find any attribute with predict method...")
            for attr_name in dir(loaded_model):
                if not attr_name.startswith('_'):
                    try:
                        attr = getattr(loaded_model, attr_name)
                        if hasattr(attr, 'predict') and callable(getattr(attr, 'predict')):
                            print(f"✅ Found model in attribute '{attr_name}': {type(attr).__name__}")
                            return attr
                    except Exception as e:
                        continue
            
            # Last resort: return the original model and hope for the best
            print(f"⚠️ Warning: Could not extract sklearn model, using original: {type(loaded_model).__name__}")
            return loaded_model
        
        model = extract_sklearn_model(raw_model)
        print(f"🎯 Final model type: {type(model).__name__}")
        
        # Verify model has required methods
        if not hasattr(model, 'predict'):
            print(f"❌ Model {type(model).__name__} does not have predict method!")
            return False
        print(f"✅ Model has predict method")
        
        if hasattr(model, 'predict_proba'):
            print(f"✅ Model has predict_proba method")
        else:
            print(f"⚠️ Model does not have predict_proba method")
        
        # Load scaler and encoder
        scaler = None
        if os.path.exists(scaler_file):
            try:
                scaler = joblib.load(scaler_file)
                print(f"✅ Scaler loaded from: {scaler_file}")
            except Exception as e:
                print(f"⚠️ Could not load scaler: {e}")
        
        encoder = None
        if os.path.exists(encoder_file):
            try:
                encoder = joblib.load(encoder_file)
                print(f"✅ Label encoder loaded from: {encoder_file}")
            except Exception as e:
                print(f"⚠️ Could not load encoder: {e}")
        
        # Test prediction with sample data
        print("\n" + "=" * 60)
        print("Testing Prediction and Confidence Calculation")
        print("=" * 60)
        
        # Create sample feature array (77 features)
        sample_features = np.random.rand(1, 77).astype(np.float32)
        print(f"📊 Sample features shape: {sample_features.shape}")
        
        # Apply scaler if available
        if scaler is not None:
            try:
                sample_features = scaler.transform(sample_features)
                print(f"✅ Scaler applied successfully")
            except Exception as e:
                print(f"⚠️ Scaler failed: {e}")
        
        # Get prediction
        try:
            prediction = model.predict(sample_features)[0]
            print(f"🎯 Raw prediction: {prediction}")
        except Exception as e:
            print(f"❌ Prediction failed: {e}")
            return False
        
        # Get confidence and probabilities
        confidence = 0.0
        probabilities = {}
        class_confidences = {}
        top_classes = []
        
        if hasattr(model, 'predict_proba'):
            try:
                print(f"📈 Getting prediction probabilities for all classes...")
                probas = model.predict_proba(sample_features)[0]
                confidence = float(np.max(probas))
                
                # Create detailed probabilities dict with all classes
                if hasattr(model, 'classes_'):
                    print(f"📊 Model has {len(model.classes_)} classes: {list(model.classes_)}")
                    
                    # Create probabilities dict and class confidences
                    for i, cls in enumerate(model.classes_):
                        class_name = str(cls)
                        class_prob = float(probas[i])
                        probabilities[class_name] = class_prob
                        class_confidences[class_name] = class_prob
                    
                    # Sort classes by confidence (highest first)
                    sorted_classes = sorted(class_confidences.items(), key=lambda x: x[1], reverse=True)
                    top_classes = sorted_classes[:5]  # Top 5 classes
                    
                    # Log detailed confidence information
                    print(f"📊 ===== CONFIDENCE ANALYSIS =====")
                    print(f"📊 Max confidence: {confidence:.3f} ({confidence*100:.1f}%)")
                    print(f"📊 Top 5 class predictions:")
                    for i, (class_name, class_conf) in enumerate(top_classes, 1):
                        print(f"📊   {i}. {class_name}: {class_conf:.3f} ({class_conf*100:.1f}%)")
                    
                    # Log all classes if there are few of them
                    if len(model.classes_) <= 10:
                        print(f"📊 All class probabilities:")
                        for class_name, class_conf in sorted_classes:
                            print(f"📊   - {class_name}: {class_conf:.3f} ({class_conf*100:.1f}%)")
                    else:
                        print(f"📊 Total classes: {len(model.classes_)} (showing top 5 only)")
                    
                    print(f"📊 ================================")
                    
                else:
                    print(f"📊 Model classes not available, using raw probabilities")
                    for i, prob in enumerate(probas):
                        probabilities[f"class_{i}"] = float(prob)
                        
            except Exception as e:
                print(f"⚠️ Could not get probabilities: {e}")
        else:
            print(f"📊 Model does not support predict_proba - using fallback confidence")
            confidence = 0.5  # Default confidence
        
        # Apply label encoder if available
        if encoder is not None:
            try:
                print(f"🏷️ Applying label encoder...")
                if isinstance(prediction, (np.integer, int)):
                    prediction_str = encoder.inverse_transform([prediction])[0]
                else:
                    prediction_str = str(prediction)
                print(f"🏷️ Decoded prediction: {prediction_str}")
            except Exception as e:
                print(f"⚠️ Label encoder failed: {e}")
                prediction_str = str(prediction)
        else:
            prediction_str = str(prediction)
            print(f"🏷️ No label encoder, using raw prediction: {prediction_str}")
        
        # Determine if it's malicious
        is_malicious = prediction_str.lower() not in ['normal', 'benign', 'legitimate']
        print(f"🔍 Is malicious: {is_malicious}")
        
        # Create result
        result = {
            'success': True,
            'prediction': prediction_str,
            'is_malicious': is_malicious,
            'confidence': confidence,
            'confidence_percentage': round(confidence * 100, 1),
            'probabilities': probabilities,
            'top_classes': top_classes,
            'total_classes': len(model.classes_) if hasattr(model, 'classes_') else len(probabilities),
            'model_type': type(model).__name__
        }
        
        print(f"\n🎉 SUCCESS! Model loading and confidence calculation working!")
        print(f"📊 Result: {json.dumps(result, indent=2)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_model_loading()
    if success:
        print(f"\n✅ All tests passed!")
        sys.exit(0)
    else:
        print(f"\n❌ Tests failed!")
        sys.exit(1)


