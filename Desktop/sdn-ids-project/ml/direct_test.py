#!/usr/bin/env python3
"""
Direct test of the random forest model
"""

import joblib
import numpy as np

print("Loading model...")
model = joblib.load('random_forest_model.joblib')
print(f"Model loaded: {type(model).__name__}")

if hasattr(model, 'n_features_in_'):
    print(f"Expected features: {model.n_features_in_}")

# Create test data with 77 features (matching your trained model)
test_data = np.random.random((1, 77)).astype(np.float32)
print(f"Test data shape: {test_data.shape}")

# Make prediction
prediction = model.predict(test_data)
print(f"Prediction: {prediction}")

if hasattr(model, 'predict_proba'):
    probabilities = model.predict_proba(test_data)
    print(f"Probabilities shape: {probabilities.shape}")
    print(f"Max probability: {np.max(probabilities)}")
    print(f"Class probabilities: {probabilities[0]}")


