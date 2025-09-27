#!/usr/bin/env python3
"""
Working test script for Random Forest Model
"""

import joblib
import numpy as np
import sys

def main():
    print("=== Random Forest Model Test ===")
    sys.stdout.flush()
    
    try:
        # Load model
        print("Loading model...")
        sys.stdout.flush()
        model = joblib.load('random_forest_model.joblib')
        print(f"Model loaded: {type(model).__name__}")
        print(f"Expected features: {model.n_features_in_}")
        sys.stdout.flush()
        
        # Create test data with correct number of features
        print("Creating test data...")
        sys.stdout.flush()
        test_data = np.random.random((1, model.n_features_in_)).astype(np.float32)
        print(f"Test data shape: {test_data.shape}")
        sys.stdout.flush()
        
        # Make prediction
        print("Making prediction...")
        sys.stdout.flush()
        prediction = model.predict(test_data)
        print(f"Prediction: {prediction}")
        sys.stdout.flush()
        
        # Get probabilities
        if hasattr(model, 'predict_proba'):
            probabilities = model.predict_proba(test_data)
            print(f"Probabilities shape: {probabilities.shape}")
            print(f"Max probability: {np.max(probabilities):.3f}")
            print(f"Class probabilities: {probabilities[0]}")
            sys.stdout.flush()
        
        print("Test completed successfully!")
        sys.stdout.flush()
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()

if __name__ == '__main__':
    main()


