#!/usr/bin/env python3
"""
Simple test script to debug the random forest model
"""

import os
import pickle
import numpy as np

def main():
    print("Starting simple test...")
    
    model_path = 'random_forest_testing.pkl'
    
    # Check if model exists
    if not os.path.exists(model_path):
        print(f"Model file {model_path} not found!")
        return
    
    print(f"Model file {model_path} exists")
    
    try:
        # Load model
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        print(f"Model loaded successfully. Type: {type(model).__name__}")
        
        if hasattr(model, 'n_features_in_'):
            print(f"Expected features: {model.n_features_in_}")
        
        # Create simple test data (77 features)
        test_data = np.random.random((1, 77)).astype(np.float32)
        print(f"Test data shape: {test_data.shape}")
        
        # Make prediction
        prediction = model.predict(test_data)
        print(f"Prediction: {prediction}")
        
        if hasattr(model, 'predict_proba'):
            probabilities = model.predict_proba(test_data)
            print(f"Probabilities shape: {probabilities.shape}")
            print(f"Max probability: {np.max(probabilities)}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()


