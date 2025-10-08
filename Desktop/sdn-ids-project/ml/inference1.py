#!/usr/bin/env python3
"""
Network Intrusion Detection - Inference Script
Load trained models and make predictions on new data
"""

import os
import sys
import pickle
import pandas as pd
import numpy as np
import argparse
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')

# Add project root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from models.base_model import BaseModel
from sklearn.preprocessing import StandardScaler, LabelEncoder

class NetworkIntrusionInference:
    """Class for making predictions using trained models"""
    
    def __init__(self, model_path, scaler_path, label_encoder_path):
        """
        Initialize inference with trained components
        
        Args:
            model_path: Path to trained model (.pkl file)
            scaler_path: Path to fitted scaler (.pkl file)
            label_encoder_path: Path to fitted label encoder (.pkl file)
        """
        self.model_path = model_path
        self.scaler_path = scaler_path
        self.label_encoder_path = label_encoder_path
        
        # Load components
        self.model = None
        self.scaler = None
        self.label_encoder = None
        
        # Columns to remove (same as training)
        self.useless_columns = ['Flow ID', 'Timestamp', 'Src IP', 'Dst IP', 'Src Port', 'Dst Port']
        
        self._load_components()
    
    def _load_components(self):
        """Load trained model, scaler, and label encoder"""
        try:
            print("🔄 Loading trained components...")
            
            # Load model
            if not os.path.exists(self.model_path):
                raise FileNotFoundError(f"Model file not found: {self.model_path}")
            
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
            print(f"✅ Model loaded from: {self.model_path}")
            
            # Load scaler
            if not os.path.exists(self.scaler_path):
                raise FileNotFoundError(f"Scaler file not found: {self.scaler_path}")
            
            with open(self.scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
            print(f"✅ Scaler loaded from: {self.scaler_path}")
            
            # Load label encoder
            if not os.path.exists(self.label_encoder_path):
                raise FileNotFoundError(f"Label encoder file not found: {self.label_encoder_path}")
            
            with open(self.label_encoder_path, 'rb') as f:
                self.label_encoder = pickle.load(f)
            print(f"✅ Label encoder loaded from: {self.label_encoder_path}")
            
            print(f"📊 Available classes: {list(self.label_encoder.classes_)}")
            
        except Exception as e:
            print(f"❌ Error loading components: {str(e)}")
            raise
    
    def preprocess_data(self, data):
        """
        Preprocess input data similar to training pipeline
        
        Args:
            data: DataFrame or numpy array with network traffic features
            
        Returns:
            Preprocessed numpy array ready for prediction
        """
        try:
            # Convert to DataFrame if numpy array
            if isinstance(data, np.ndarray):
                # Assume it's already feature data without labels
                df = pd.DataFrame(data)
            else:
                df = data.copy()
            
            # Remove useless columns if they exist
            df = df.drop(columns=self.useless_columns, errors='ignore')
            
            # Remove Label column if it exists (for inference)
            if 'Label' in df.columns:
                df = df.drop('Label', axis=1)
            
            # Convert to numpy array and ensure float32
            X = df.values.astype('float32')
            
            # Remove infinite values
            finite_mask = ~np.isinf(X).any(axis=1)
            if not finite_mask.all():
                print(f"⚠️  Warning: Removed {np.sum(~finite_mask)} rows with infinite values")
                X = X[finite_mask]
            
            # Scale features using fitted scaler
            X_scaled = self.scaler.transform(X)
            
            return X_scaled
            
        except Exception as e:
            print(f"❌ Error preprocessing data: {str(e)}")
            raise
    
    def predict(self, data, return_probabilities=False):
        """
        Make predictions on new data
        
        Args:
            data: DataFrame or numpy array with network traffic features
            return_probabilities: Whether to return class probabilities
            
        Returns:
            Predictions (and probabilities if requested)
        """
        try:
            # Preprocess data
            X_processed = self.preprocess_data(data)
            
            # Make predictions
            if return_probabilities:
                # Get class probabilities
                probabilities = self.model.predict_proba(X_processed)
                predictions = self.model.predict(X_processed)
                
                # Convert predictions back to class names
                predicted_classes = self.label_encoder.inverse_transform(predictions)
                
                return predicted_classes, probabilities
            else:
                # Get predictions only
                predictions = self.model.predict(X_processed)
                
                # Convert predictions back to class names
                predicted_classes = self.label_encoder.inverse_transform(predictions)
                
                return predicted_classes
                
        except Exception as e:
            print(f"❌ Error making predictions: {str(e)}")
            raise
    
    def predict_single(self, data, return_probabilities=False):
        """
        Make prediction on a single sample
        
        Args:
            data: Single sample (1D array or Series)
            return_probabilities: Whether to return class probabilities
            
        Returns:
            Single prediction (and probabilities if requested)
        """
        # Ensure data is 2D for preprocessing
        if data.ndim == 1:
            data = data.reshape(1, -1)
        elif isinstance(data, pd.Series):
            data = data.values.reshape(1, -1)
        
        return self.predict(data, return_probabilities)
    
    def get_class_info(self):
        """Get information about available classes"""
        return {
            'classes': list(self.label_encoder.classes_),
            'num_classes': len(self.label_encoder.classes_),
            'class_mapping': dict(zip(range(len(self.label_encoder.classes_)), self.label_encoder.classes_))
        }

def create_sample_data():
    """Create sample network traffic data for testing"""
    # Sample network traffic features (without useless columns)
    sample_data = {
        'Flow Duration': [1000, 2000, 500],
        'Total Fwd Packets': [10, 20, 5],
        'Total Backward Packets': [8, 15, 3],
        'Total Length of Fwd Packets': [1200, 2400, 600],
        'Total Length of Bwd Packets': [800, 1800, 300],
        'Fwd Packet Length Max': [200, 300, 150],
        'Fwd Packet Length Min': [50, 100, 30],
        'Fwd Packet Length Mean': [120, 120, 120],
        'Fwd Packet Length Std': [50, 60, 40],
        'Bwd Packet Length Max': [150, 200, 100],
        'Bwd Packet Length Min': [30, 50, 20],
        'Bwd Packet Length Mean': [100, 120, 100],
        'Bwd Packet Length Std': [40, 50, 30],
        'Flow Bytes/s': [1000, 2000, 500],
        'Flow Packets/s': [10, 20, 5],
        'Flow IAT Mean': [100, 200, 50],
        'Flow IAT Std': [50, 100, 25],
        'Flow IAT Max': [500, 1000, 250],
        'Flow IAT Min': [10, 20, 5],
        'Fwd IAT Total': [1000, 2000, 500],
        'Fwd IAT Mean': [100, 100, 100],
        'Fwd IAT Std': [50, 60, 40],
        'Fwd IAT Max': [300, 400, 200],
        'Fwd IAT Min': [10, 20, 5],
        'Bwd IAT Total': [800, 1500, 300],
        'Bwd IAT Mean': [100, 100, 100],
        'Bwd IAT Std': [40, 50, 30],
        'Bwd IAT Max': [250, 300, 150],
        'Bwd IAT Min': [10, 20, 5],
        'Fwd PSH Flags': [0, 1, 0],
        'Bwd PSH Flags': [0, 0, 1],
        'Fwd URG Flags': [0, 0, 0],
        'Bwd URG Flags': [0, 0, 0],
        'Fwd Header Length': [20, 40, 20],
        'Bwd Header Length': [20, 30, 20],
        'Fwd Packets/s': [10, 20, 5],
        'Bwd Packets/s': [8, 15, 3],
        'Min Packet Length': [30, 50, 20],
        'Max Packet Length': [200, 300, 150],
        'Packet Length Mean': [110, 120, 110],
        'Packet Length Std': [45, 55, 35],
        'Packet Length Variance': [2025, 3025, 1225],
        'FIN Flag Count': [0, 1, 0],
        'SYN Flag Count': [1, 1, 1],
        'RST Flag Count': [0, 0, 0],
        'PSH Flag Count': [0, 1, 1],
        'ACK Flag Count': [1, 1, 1],
        'URG Flag Count': [0, 0, 0],
        'CWE Flag Count': [0, 0, 0],
        'ECE Flag Count': [0, 0, 0],
        'Down/Up Ratio': [0.8, 0.75, 0.6],
        'Average Packet Size': [110, 120, 110],
        'Avg Fwd Segment Size': [120, 120, 120],
        'Avg Bwd Segment Size': [100, 120, 100],
        'Fwd Header Length.1': [20, 40, 20],
        'Fwd Avg Bytes/Bulk': [0, 0, 0],
        'Fwd Avg Packets/Bulk': [0, 0, 0],
        'Fwd Avg Bulk Rate': [0, 0, 0],
        'Bwd Avg Bytes/Bulk': [0, 0, 0],
        'Bwd Avg Packets/Bulk': [0, 0, 0],
        'Bwd Avg Bulk Rate': [0, 0, 0],
        'Subflow Fwd Packets': [10, 20, 5],
        'Subflow Fwd Bytes': [1200, 2400, 600],
        'Subflow Bwd Packets': [8, 15, 3],
        'Subflow Bwd Bytes': [800, 1800, 300],
        'Init_Win_bytes_forward': [8192, 16384, 4096],
        'Init_Win_bytes_backward': [8192, 16384, 4096],
        'act_data_pkt_fwd': [0, 0, 0],
        'min_seg_size_forward': [20, 20, 20],
        'Active Mean': [0, 0, 0],
        'Active Std': [0, 0, 0],
        'Active Max': [0, 0, 0],
        'Active Min': [0, 0, 0],
        'Idle Mean': [100, 200, 50],
        'Idle Std': [50, 100, 25],
        'Idle Max': [500, 1000, 250],
        'Idle Min': [10, 20, 5]
    }
    
    return pd.DataFrame(sample_data)

def main():
    """Main function for command-line inference"""
    parser = argparse.ArgumentParser(description='Network Intrusion Detection Inference')
    parser.add_argument('--model_path', type=str, required=True,
                       help='Path to trained model (.pkl file)')
    parser.add_argument('--scaler_path', type=str, required=True,
                       help='Path to fitted scaler (.pkl file)')
    parser.add_argument('--label_encoder_path', type=str, required=True,
                       help='Path to fitted label encoder (.pkl file)')
    parser.add_argument('--data_path', type=str,
                       help='Path to CSV file with new data for prediction')
    parser.add_argument('--output_path', type=str,
                       help='Path to save predictions (optional)')
    parser.add_argument('--probabilities', action='store_true',
                       help='Include class probabilities in output')
    parser.add_argument('--sample', action='store_true',
                       help='Run inference on sample data for testing')
    
    args = parser.parse_args()
    
    try:
        print("🚀 " + "="*60)
        print("🚀 NETWORK INTRUSION DETECTION - INFERENCE")
        print("🚀 " + "="*60)
        print(f"🤖 Model: {args.model_path}")
        print(f"⚖️  Scaler: {args.scaler_path}")
        print(f"🏷️  Label Encoder: {args.label_encoder_path}")
        print("🚀 " + "="*60)
        
        # Initialize inference
        inference = NetworkIntrusionInference(
            args.model_path, 
            args.scaler_path, 
            args.label_encoder_path
        )
        
        # Get class information
        class_info = inference.get_class_info()
        print(f"\n📊 Available classes ({class_info['num_classes']}):")
        for i, class_name in enumerate(class_info['classes']):
            print(f"   {i}: {class_name}")
        
        # Load data for prediction
        if args.sample:
            print("\n🧪 Using sample data for testing...")
            data = create_sample_data()
            print(f"📊 Sample data shape: {data.shape}")
        elif args.data_path:
            if not os.path.exists(args.data_path):
                print(f"❌ Data file not found: {args.data_path}")
                return 1
            
            print(f"\n📁 Loading data from: {args.data_path}")
            data = pd.read_csv(args.data_path)
            print(f"📊 Data shape: {data.shape}")
        else:
            print("❌ Please provide either --data_path or use --sample for testing")
            return 1
        
        # Make predictions
        print("\n🔮 Making predictions...")
        start_time = datetime.now()
        
        if args.probabilities:
            predictions, probabilities = inference.predict(data, return_probabilities=True)
            
            # Create results DataFrame
            results = pd.DataFrame({
                'Prediction': predictions,
            })
            
            # Add probability columns
            for i, class_name in enumerate(class_info['classes']):
                results[f'Prob_{class_name}'] = probabilities[:, i]
            
            print(f"✅ Predictions completed in {(datetime.now() - start_time).total_seconds():.2f} seconds")
            print(f"📊 Results shape: {results.shape}")
            
            # Display results
            print("\n📋 Prediction Results:")
            print(results.head(10))
            
            if len(results) > 10:
                print(f"... and {len(results) - 10} more rows")
            
        else:
            predictions = inference.predict(data)
            
            # Create results DataFrame
            results = pd.DataFrame({
                'Prediction': predictions
            })
            
            print(f"✅ Predictions completed in {(datetime.now() - start_time).total_seconds():.2f} seconds")
            print(f"📊 Results shape: {results.shape}")
            
            # Display results
            print("\n📋 Prediction Results:")
            print(results.head(10))
            
            if len(results) > 10:
                print(f"... and {len(results) - 10} more rows")
        
        # Show prediction distribution
        print(f"\n📊 Prediction Distribution:")
        prediction_counts = results['Prediction'].value_counts()
        for class_name, count in prediction_counts.items():
            percentage = (count / len(results)) * 100
            print(f"   {class_name}: {count} ({percentage:.1f}%)")
        
        # Save results if requested
        if args.output_path:
            results.to_csv(args.output_path, index=False)
            print(f"\n💾 Results saved to: {args.output_path}")
        
        print("\n🎉 " + "="*60)
        print("🎉 INFERENCE COMPLETED SUCCESSFULLY!")
        print("🎉 " + "="*60)
        
        return 0
        
    except Exception as e:
        print(f"\n❌ Error during inference: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
