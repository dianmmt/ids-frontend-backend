#!/usr/bin/env python3
"""
Data Collection Monitor
Monitors data collection and model performance in real-time
"""

import os
import sys
import time
import json
import logging
import numpy as np
import pandas as pd
import joblib
from typing import Dict, Any, List
from datetime import datetime, timedelta
import requests

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataCollectionMonitor:
    """Monitor data collection and model performance"""
    
    def __init__(self, model_folder: str = '.'):
        self.model_folder = model_folder
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.feature_names = None
        self.stats = {
            'total_predictions': 0,
            'correct_predictions': 0,
            'attack_events': 0,
            'normal_detections': 0,
            'prediction_times': [],
            'confidence_scores': [],
            'class_distribution': {},
            'errors': []
        }
        
    def load_model(self):
        """Load model components"""
        try:
            self.model = joblib.load(os.path.join(self.model_folder, 'random_forest_model.pkl'))
            self.scaler = joblib.load(os.path.join(self.model_folder, 'scaler.pkl'))
            self.label_encoder = joblib.load(os.path.join(self.model_folder, 'label_encoder.pkl'))
            
            # Define feature names
            self.feature_names = [
                'flow_duration', 'total_fwd_packets', 'total_backward_packets',
                'total_length_of_fwd_packets', 'total_length_of_bwd_packets',
                'fwd_packet_length_max', 'fwd_packet_length_min', 'fwd_packet_length_mean', 'fwd_packet_length_std',
                'bwd_packet_length_max', 'bwd_packet_length_min', 'bwd_packet_length_mean', 'bwd_packet_length_std',
                'flow_bytes_per_second', 'flow_packets_per_second', 'flow_iat_mean', 'flow_iat_std', 'flow_iat_max', 'flow_iat_min',
                'fwd_iat_total', 'fwd_iat_mean', 'fwd_iat_std', 'fwd_iat_max', 'fwd_iat_min',
                'bwd_iat_total', 'bwd_iat_mean', 'bwd_iat_std', 'bwd_iat_max', 'bwd_iat_min',
                'fwd_psh_flags', 'bwd_psh_flags', 'fwd_urg_flags', 'bwd_urg_flags',
                'fwd_header_length', 'bwd_header_length', 'fwd_packets_per_second', 'bwd_packets_per_second',
                'min_packet_length', 'max_packet_length', 'packet_length_mean', 'packet_length_std', 'packet_length_variance',
                'fin_flag_count', 'syn_flag_count', 'rst_flag_count', 'psh_flag_count', 'ack_flag_count',
                'urg_flag_count', 'cwe_flag_count', 'ece_flag_count',
                'down_up_ratio', 'average_packet_size', 'avg_fwd_segment_size', 'avg_bwd_segment_size',
                'fwd_header_length_1', 'fwd_avg_bytes_per_bulk', 'fwd_avg_packets_per_bulk', 'fwd_avg_bulk_rate',
                'bwd_avg_bytes_per_bulk', 'bwd_avg_packets_per_bulk', 'bwd_avg_bulk_rate',
                'subflow_fwd_packets', 'subflow_bwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_bytes',
                'init_win_bytes_forward', 'init_win_bytes_backward', 'act_data_pkt_fwd', 'min_seg_size_forward',
                'active_mean', 'active_std', 'active_max', 'active_min',
                'idle_mean', 'idle_std', 'idle_max', 'idle_min'
            ]
            
            logger.info("✅ Model loaded successfully")
            return True
            
        except Exception as e:
            logger.error(f"❌ Error loading model: {e}")
            return False
    
    def predict_flow(self, flow_data: Dict[str, Any]) -> Dict[str, Any]:
        """Predict attack for a single flow"""
        try:
            start_time = time.time()
            
            # Extract features in order
            features = []
            for feature_name in self.feature_names:
                features.append(flow_data.get(feature_name, 0.0))
            
            # Convert to numpy array
            feature_array = np.array(features).reshape(1, -1)
            
            # Apply scaling
            if self.scaler:
                feature_array = self.scaler.transform(feature_array)
            
            # Get prediction
            prediction = self.model.predict(feature_array)[0]
            probabilities = self.model.predict_proba(feature_array)[0]
            
            # Get class name
            predicted_class = 'Unknown'
            if self.label_encoder:
                predicted_class = self.label_encoder.inverse_transform([prediction])[0]
            
            # Calculate confidence
            confidence = float(np.max(probabilities))
            
            # Calculate processing time
            processing_time = (time.time() - start_time) * 1000  # ms
            
            # Update statistics
            self.stats['total_predictions'] += 1
            self.stats['prediction_times'].append(processing_time)
            self.stats['confidence_scores'].append(confidence)
            
            # Update class distribution
            if predicted_class not in self.stats['class_distribution']:
                self.stats['class_distribution'][predicted_class] = 0
            self.stats['class_distribution'][predicted_class] += 1
            
            # Update attack/normal counts
            if predicted_class != 'Normal':
                self.stats['attack_events'] += 1
            else:
                self.stats['normal_detections'] += 1
            
            return {
                'prediction': predicted_class,
                'confidence': confidence,
                'is_attack': predicted_class != 'Normal',
                'processing_time_ms': processing_time,
                'probabilities': {
                    self.label_encoder.classes_[i]: float(prob) 
                    for i, prob in enumerate(probabilities)
                } if self.label_encoder else {}
            }
            
        except Exception as e:
            self.stats['errors'].append(str(e))
            logger.error(f"Error predicting flow: {e}")
            return {
                'prediction': 'Unknown',
                'confidence': 0.0,
                'is_attack': False,
                'processing_time_ms': 0.0,
                'error': str(e)
            }
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get current statistics"""
        stats = self.stats.copy()
        
        # Calculate derived metrics
        if stats['total_predictions'] > 0:
            stats['accuracy'] = stats['correct_predictions'] / stats['total_predictions']
            stats['attack_rate'] = stats['attack_events'] / stats['total_predictions']
            stats['normal_rate'] = stats['normal_detections'] / stats['total_predictions']
        else:
            stats['accuracy'] = 0.0
            stats['attack_rate'] = 0.0
            stats['normal_rate'] = 0.0
        
        # Calculate timing statistics
        if stats['prediction_times']:
            stats['avg_processing_time'] = np.mean(stats['prediction_times'])
            stats['max_processing_time'] = np.max(stats['prediction_times'])
            stats['min_processing_time'] = np.min(stats['prediction_times'])
        else:
            stats['avg_processing_time'] = 0.0
            stats['max_processing_time'] = 0.0
            stats['min_processing_time'] = 0.0
        
        # Calculate confidence statistics
        if stats['confidence_scores']:
            stats['avg_confidence'] = np.mean(stats['confidence_scores'])
            stats['max_confidence'] = np.max(stats['confidence_scores'])
            stats['min_confidence'] = np.min(stats['confidence_scores'])
        else:
            stats['avg_confidence'] = 0.0
            stats['max_confidence'] = 0.0
            stats['min_confidence'] = 0.0
        
        return stats
    
    def print_statistics(self):
        """Print current statistics"""
        stats = self.get_statistics()
        
        print("\n📊 DATA COLLECTION STATISTICS")
        print("=" * 50)
        print(f"Total predictions: {stats['total_predictions']}")
        print(f"Attack detections: {stats['attack_events']}")
        print(f"Normal detections: {stats['normal_detections']}")
        print(f"Attack rate: {stats['attack_rate']:.2%}")
        print(f"Normal rate: {stats['normal_rate']:.2%}")
        print(f"Average processing time: {stats['avg_processing_time']:.2f} ms")
        print(f"Average confidence: {stats['avg_confidence']:.4f}")
        print(f"Errors: {len(stats['errors'])}")
        
        print("\n📈 CLASS DISTRIBUTION:")
        for class_name, count in sorted(stats['class_distribution'].items(), key=lambda x: x[1], reverse=True):
            percentage = (count / stats['total_predictions']) * 100 if stats['total_predictions'] > 0 else 0
            print(f"  {class_name}: {count} ({percentage:.1f}%)")
        
        if stats['errors']:
            print("\n❌ RECENT ERRORS:")
            for error in stats['errors'][-5:]:  # Show last 5 errors
                print(f"  {error}")
    
    def monitor_api_services(self, duration_minutes: int = 10):
        """Monitor API services for a specified duration"""
        logger.info(f"🔍 Monitoring API services for {duration_minutes} minutes...")
        
        start_time = time.time()
        end_time = start_time + (duration_minutes * 60)
        
        services = [
            'http://localhost:5003',  # Multi-class service
            'http://localhost:5000',  # Inference service
            'http://localhost:5002'   # Dynamic service
        ]
        
        while time.time() < end_time:
            print(f"\n⏰ {datetime.now().strftime('%H:%M:%S')} - Monitoring...")
            
            for i, service_url in enumerate(services):
                try:
                    # Test health
                    health_response = requests.get(f'{service_url}/health', timeout=5)
                    health_status = "✅" if health_response.status_code == 200 else "❌"
                    
                    # Test prediction
                    test_data = {
                        'flow_duration': 10.5,
                        'total_fwd_packets': 100,
                        'total_backward_packets': 50,
                        'total_length_of_fwd_packets': 50000,
                        'total_length_of_bwd_packets': 25000
                    }
                    
                    # Fill missing features
                    # Pad with zeros to match expected feature count (77)
                    for j in range(77 - len(test_data)):
                        test_data[f'feature_{j}'] = 0.0
                    
                    pred_response = requests.post(
                        f'{service_url}/predict',
                        json=test_data,
                        headers={'Content-Type': 'application/json'},
                        timeout=10
                    )
                    
                    pred_status = "✅" if pred_response.status_code == 200 else "❌"
                    
                    print(f"  Service {i+1}: Health {health_status} | Prediction {pred_status}")
                    
                    # If prediction successful, process the result
                    if pred_response.status_code == 200:
                        result = pred_response.json()
                        if 'prediction' in result:
                            predicted_class = result['prediction']
                            confidence = result.get('confidence', 0.0)
                            
                            # Update statistics
                            self.stats['total_predictions'] += 1
                            self.stats['confidence_scores'].append(confidence)
                            
                            if predicted_class not in self.stats['class_distribution']:
                                self.stats['class_distribution'][predicted_class] = 0
                            self.stats['class_distribution'][predicted_class] += 1
                            
                            if predicted_class != 'Normal':
                                self.stats['attack_events'] += 1
                            else:
                                self.stats['normal_detections'] += 1
                
                except requests.exceptions.ConnectionError:
                    print(f"  Service {i+1}: ❌ Not running")
                except Exception as e:
                    print(f"  Service {i+1}: ❌ Error - {e}")
            
            # Print statistics every 30 seconds
            if int(time.time()) % 30 == 0:
                self.print_statistics()
            
            time.sleep(10)  # Check every 10 seconds
        
        logger.info("✅ Monitoring complete!")
        self.print_statistics()
    
    def test_with_sample_data(self, sample_file: str = None):
        """Test model with sample data file"""
        if not sample_file or not os.path.exists(sample_file):
            logger.warning("No sample file provided, using generated data")
            self.test_with_generated_data()
            return
        
        logger.info(f"📁 Testing with sample data: {sample_file}")
        
        try:
            # Load sample data
            if sample_file.endswith('.csv'):
                df = pd.read_csv(sample_file)
            else:
                df = pd.read_json(sample_file)
            
            logger.info(f"Loaded {len(df)} samples")
            
            # Process each sample
            for idx, row in df.iterrows():
                if idx >= 100:  # Limit to first 100 samples
                    break
                
                # Convert row to flow data
                flow_data = row.to_dict()
                
                # Predict
                result = self.predict_flow(flow_data)
                
                if idx % 10 == 0:  # Print every 10th result
                    print(f"Sample {idx}: {result['prediction']} (confidence: {result['confidence']:.4f})")
            
            self.print_statistics()
            
        except Exception as e:
            logger.error(f"Error testing with sample data: {e}")
    
    def test_with_generated_data(self):
        """Test model with generated data"""
        logger.info("🎲 Testing with generated data...")
        
        # Generate test scenarios
        scenarios = [
            {
                'name': 'Normal Traffic',
                'data': {
                    'flow_duration': 10.0,
                    'total_fwd_packets': 50,
                    'total_backward_packets': 45,
                    'total_length_of_fwd_packets': 5000,
                    'total_length_of_bwd_packets': 4500,
                    'flow_bytes_per_second': 500,
                    'flow_packets_per_second': 5,
                    'syn_flag_count': 1,
                    'ack_flag_count': 90
                }
            },
            {
                'name': 'DDoS Attack',
                'data': {
                    'flow_duration': 0.1,
                    'total_fwd_packets': 10000,
                    'total_backward_packets': 0,
                    'total_length_of_fwd_packets': 1000000,
                    'total_length_of_bwd_packets': 0,
                    'flow_bytes_per_second': 10000000,
                    'flow_packets_per_second': 100000,
                    'syn_flag_count': 10000,
                    'ack_flag_count': 0
                }
            },
            {
                'name': 'Port Scan',
                'data': {
                    'flow_duration': 0.5,
                    'total_fwd_packets': 1000,
                    'total_backward_packets': 0,
                    'total_length_of_fwd_packets': 50000,
                    'total_length_of_bwd_packets': 0,
                    'flow_bytes_per_second': 100000,
                    'flow_packets_per_second': 2000,
                    'syn_flag_count': 1000,
                    'ack_flag_count': 0,
                    'rst_flag_count': 1000
                }
            }
        ]
        
        for scenario in scenarios:
            print(f"\nTesting {scenario['name']}:")
            result = self.predict_flow(scenario['data'])
            print(f"  Prediction: {result['prediction']}")
            print(f"  Confidence: {result['confidence']:.4f}")
            print(f"  Is Attack: {result['is_attack']}")
        
        self.print_statistics()

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Data Collection Monitor')
    parser.add_argument('--model-folder', default='.', help='Path to model folder')
    parser.add_argument('--monitor', type=int, help='Monitor API services for N minutes')
    parser.add_argument('--test-file', help='Test with sample data file')
    parser.add_argument('--generate-test', action='store_true', help='Test with generated data')
    
    args = parser.parse_args()
    
    # Create monitor
    monitor = DataCollectionMonitor(args.model_folder)
    
    # Load model
    if not monitor.load_model():
        print("❌ Failed to load model. Exiting.")
        return
    
    # Run tests
    if args.monitor:
        monitor.monitor_api_services(args.monitor)
    elif args.test_file:
        monitor.test_with_sample_data(args.test_file)
    elif args.generate_test:
        monitor.test_with_generated_data()
    else:
        # Default: test with generated data
        monitor.test_with_generated_data()

if __name__ == "__main__":
    main()
