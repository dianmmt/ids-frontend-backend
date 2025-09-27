#!/usr/bin/env python3
"""
Comprehensive Model Validation Suite
Tests model accuracy, data collection, and attack detection capabilities
"""

import os
import sys
import json
import time
import logging
import numpy as np
import pandas as pd
import joblib
import requests
from typing import Dict, Any, List, Tuple, Optional
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report
from sklearn.model_selection import cross_val_score
import matplotlib.pyplot as plt
import seaborn as sns

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelValidationSuite:
    """Comprehensive model validation and testing suite"""
    
    def __init__(self, model_folder: str = '.'):
        self.model_folder = model_folder
        self.model = None
        self.scaler = None
        self.label_encoder = None
        self.feature_names = None
        self.results = {}
        
    def load_model_components(self) -> bool:
        """Load model, scaler, and label encoder"""
        try:
            # Load model
            model_path = os.path.join(self.model_folder, 'random_forest_model.joblib')
            if not os.path.exists(model_path):
                logger.error(f"Model file not found: {model_path}")
                return False
            self.model = joblib.load(model_path)
            
            # Load scaler
            scaler_path = os.path.join(self.model_folder, 'scaler.joblib')
            if os.path.exists(scaler_path):
                self.scaler = joblib.load(scaler_path)
            else:
                logger.warning("Scaler not found, using raw features")
            
            # Load label encoder
            encoder_path = os.path.join(self.model_folder, 'label_encoder.joblib')
            if os.path.exists(encoder_path):
                self.label_encoder = joblib.load(encoder_path)
            else:
                logger.warning("Label encoder not found")
            
            # Define feature names (77 CICFlowMeter features)
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
            
            logger.info("✅ Model components loaded successfully")
            logger.info(f"Model type: {type(self.model).__name__}")
            logger.info(f"Number of features: {self.model.n_features_in_}")
            logger.info(f"Available classes: {self.label_encoder.classes_ if self.label_encoder else 'N/A'}")
            
            return True
            
        except Exception as e:
            logger.error(f"❌ Error loading model components: {e}")
            return False
    
    def test_model_basic_functionality(self) -> Dict[str, Any]:
        """Test basic model functionality"""
        logger.info("🔍 Testing basic model functionality...")
        
        results = {
            'model_loaded': self.model is not None,
            'scaler_loaded': self.scaler is not None,
            'label_encoder_loaded': self.label_encoder is not None,
            'feature_count': self.model.n_features_in_ if self.model else 0,
            'class_count': len(self.label_encoder.classes_) if self.label_encoder else 0
        }
        
        # Test prediction with sample data
        if self.model:
            try:
                # Create sample data
                sample_data = np.zeros((1, self.model.n_features_in_))
                if self.scaler:
                    sample_data = self.scaler.transform(sample_data)
                
                prediction = self.model.predict(sample_data)[0]
                probabilities = self.model.predict_proba(sample_data)[0]
                
                results['prediction_works'] = True
                results['prediction'] = prediction
                results['max_confidence'] = float(np.max(probabilities))
                results['min_confidence'] = float(np.min(probabilities))
                
                if self.label_encoder:
                    predicted_class = self.label_encoder.inverse_transform([prediction])[0]
                    results['predicted_class'] = predicted_class
                
            except Exception as e:
                results['prediction_works'] = False
                results['prediction_error'] = str(e)
        
        return results
    
    def test_attack_scenarios(self) -> Dict[str, Any]:
        """Test model with various attack scenarios"""
        logger.info("🎯 Testing attack detection scenarios...")
        
        scenarios = {
            'normal_traffic': {
                'flow_duration': 10.0,
                'total_fwd_packets': 50,
                'total_backward_packets': 45,
                'total_length_of_fwd_packets': 5000,
                'total_length_of_bwd_packets': 4500,
                'flow_bytes_per_second': 500,
                'flow_packets_per_second': 5,
                'syn_flag_count': 1,
                'ack_flag_count': 90,
                'expected': 'Normal'
            },
            'ddos_attack': {
                'flow_duration': 0.1,
                'total_fwd_packets': 10000,
                'total_backward_packets': 0,
                'total_length_of_fwd_packets': 1000000,
                'total_length_of_bwd_packets': 0,
                'flow_bytes_per_second': 10000000,
                'flow_packets_per_second': 100000,
                'syn_flag_count': 10000,
                'ack_flag_count': 0,
                'expected': 'DDoS'
            },
            'port_scan': {
                'flow_duration': 0.5,
                'total_fwd_packets': 1000,
                'total_backward_packets': 0,
                'total_length_of_fwd_packets': 50000,
                'total_length_of_bwd_packets': 0,
                'flow_bytes_per_second': 100000,
                'flow_packets_per_second': 2000,
                'syn_flag_count': 1000,
                'ack_flag_count': 0,
                'rst_flag_count': 1000,
                'expected': 'Probe'
            },
            'brute_force': {
                'flow_duration': 2.0,
                'total_fwd_packets': 100,
                'total_backward_packets': 100,
                'total_length_of_fwd_packets': 8000,
                'total_length_of_bwd_packets': 8000,
                'flow_bytes_per_second': 4000,
                'flow_packets_per_second': 50,
                'syn_flag_count': 100,
                'ack_flag_count': 100,
                'expected': 'BFA'
            }
        }
        
        results = {}
        
        for scenario_name, scenario_data in scenarios.items():
            try:
                # Create feature array
                features = []
                for feature_name in self.feature_names:
                    features.append(scenario_data.get(feature_name, 0.0))
                
                feature_array = np.array(features).reshape(1, -1)
                
                # Apply scaling if available
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
                
                # Check if prediction matches expected
                correct = predicted_class == scenario_data['expected']
                
                results[scenario_name] = {
                    'predicted_class': predicted_class,
                    'expected_class': scenario_data['expected'],
                    'correct': correct,
                    'confidence': confidence,
                    'all_probabilities': {
                        self.label_encoder.classes_[i]: float(prob) 
                        for i, prob in enumerate(probabilities)
                    } if self.label_encoder else {}
                }
                
            except Exception as e:
                results[scenario_name] = {
                    'error': str(e),
                    'correct': False
                }
        
        return results
    
    def test_data_quality(self, test_data_path: str = None) -> Dict[str, Any]:
        """Test data quality and feature distribution"""
        logger.info("📊 Testing data quality...")
        
        results = {
            'data_available': False,
            'feature_count': 0,
            'sample_count': 0,
            'missing_values': 0,
            'infinite_values': 0,
            'feature_ranges': {},
            'class_distribution': {}
        }
        
        if test_data_path and os.path.exists(test_data_path):
            try:
                # Load test data
                if test_data_path.endswith('.csv'):
                    df = pd.read_csv(test_data_path)
                else:
                    df = pd.read_json(test_data_path)
                
                results['data_available'] = True
                results['sample_count'] = len(df)
                results['feature_count'] = len(df.columns)
                
                # Check for missing values
                results['missing_values'] = int(df.isnull().sum().sum())
                
                # Check for infinite values
                results['infinite_values'] = int(np.isinf(df.select_dtypes(include=[np.number])).sum().sum())
                
                # Feature ranges
                numeric_cols = df.select_dtypes(include=[np.number]).columns
                for col in numeric_cols:
                    results['feature_ranges'][col] = {
                        'min': float(df[col].min()),
                        'max': float(df[col].max()),
                        'mean': float(df[col].mean()),
                        'std': float(df[col].std())
                    }
                
                # Class distribution if label column exists
                label_cols = ['Label', 'label', 'class', 'target']
                for col in label_cols:
                    if col in df.columns:
                        results['class_distribution'] = df[col].value_counts().to_dict()
                        break
                
            except Exception as e:
                results['error'] = str(e)
        
        return results
    
    def test_model_performance(self, test_data_path: str = None) -> Dict[str, Any]:
        """Test model performance metrics"""
        logger.info("📈 Testing model performance...")
        
        results = {
            'performance_available': False,
            'accuracy': 0.0,
            'precision': 0.0,
            'recall': 0.0,
            'f1_score': 0.0,
            'confusion_matrix': None,
            'classification_report': None
        }
        
        if test_data_path and os.path.exists(test_data_path):
            try:
                # Load test data
                df = pd.read_csv(test_data_path)
                
                # Prepare features and labels
                feature_cols = [col for col in df.columns if col not in ['Flow ID', 'Timestamp', 'Src IP', 'Dst IP', 'Src Port', 'Dst Port', 'Label']]
                X = df[feature_cols].values
                y = df['Label'].values if 'Label' in df.columns else None
                
                if y is not None:
                    # Apply scaling if available
                    if self.scaler:
                        X = self.scaler.transform(X)
                    
                    # Get predictions
                    y_pred = self.model.predict(X)
                    
                    # Calculate metrics
                    results['performance_available'] = True
                    results['accuracy'] = float(accuracy_score(y, y_pred))
                    results['precision'] = float(precision_score(y, y_pred, average='weighted'))
                    results['recall'] = float(recall_score(y, y_pred, average='weighted'))
                    results['f1_score'] = float(f1_score(y, y_pred, average='weighted'))
                    
                    # Confusion matrix
                    cm = confusion_matrix(y, y_pred)
                    results['confusion_matrix'] = cm.tolist()
                    
                    # Classification report
                    report = classification_report(y, y_pred, output_dict=True)
                    results['classification_report'] = report
                
            except Exception as e:
                results['error'] = str(e)
        
        return results
    
    def test_api_endpoints(self) -> Dict[str, Any]:
        """Test API endpoints for model inference"""
        logger.info("🌐 Testing API endpoints...")
        
        endpoints = {
            'multi_class_service': 'http://localhost:5003',
            'inference_service': 'http://localhost:5000',
            'dynamic_service': 'http://localhost:5002'
        }
        
        results = {}
        
        for service_name, base_url in endpoints.items():
            try:
                # Test health endpoint
                health_response = requests.get(f'{base_url}/health', timeout=5)
                results[service_name] = {
                    'health_status': health_response.status_code == 200,
                    'health_response': health_response.json() if health_response.status_code == 200 else None
                }
                
                # Test prediction endpoint
                sample_data = {
                    'flow_duration': 10.5,
                    'total_fwd_packets': 100,
                    'total_backward_packets': 50,
                    'total_length_of_fwd_packets': 50000,
                    'total_length_of_bwd_packets': 25000
                }
                
                # Fill missing features
                for i in range(77 - len(sample_data)):
                    sample_data[f'feature_{i}'] = 0.0
                
                pred_response = requests.post(
                    f'{base_url}/predict',
                    json=sample_data,
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )
                
                results[service_name]['prediction_status'] = pred_response.status_code == 200
                results[service_name]['prediction_response'] = pred_response.json() if pred_response.status_code == 200 else None
                
            except requests.exceptions.ConnectionError:
                results[service_name] = {
                    'health_status': False,
                    'prediction_status': False,
                    'error': 'Connection refused - service not running'
                }
            except Exception as e:
                results[service_name] = {
                    'health_status': False,
                    'prediction_status': False,
                    'error': str(e)
                }
        
        return results
    
    def generate_report(self) -> str:
        """Generate comprehensive validation report"""
        logger.info("📋 Generating validation report...")
        
        report = []
        report.append("=" * 80)
        report.append("🔍 MODEL VALIDATION REPORT")
        report.append("=" * 80)
        report.append(f"Generated at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("")
        
        # Basic functionality
        if 'basic_functionality' in self.results:
            report.append("1. BASIC FUNCTIONALITY")
            report.append("-" * 40)
            basic = self.results['basic_functionality']
            report.append(f"Model loaded: {'✅' if basic['model_loaded'] else '❌'}")
            report.append(f"Scaler loaded: {'✅' if basic['scaler_loaded'] else '❌'}")
            report.append(f"Label encoder loaded: {'✅' if basic['label_encoder_loaded'] else '❌'}")
            report.append(f"Feature count: {basic['feature_count']}")
            report.append(f"Class count: {basic['class_count']}")
            if 'prediction_works' in basic:
                report.append(f"Prediction works: {'✅' if basic['prediction_works'] else '❌'}")
                if 'predicted_class' in basic:
                    report.append(f"Sample prediction: {basic['predicted_class']}")
                if 'max_confidence' in basic:
                    report.append(f"Max confidence: {basic['max_confidence']:.4f}")
            report.append("")
        
        # Attack scenarios
        if 'attack_scenarios' in self.results:
            report.append("2. ATTACK DETECTION SCENARIOS")
            report.append("-" * 40)
            scenarios = self.results['attack_scenarios']
            for scenario_name, scenario_result in scenarios.items():
                if 'error' in scenario_result:
                    report.append(f"{scenario_name}: ❌ Error - {scenario_result['error']}")
                else:
                    status = "✅" if scenario_result['correct'] else "❌"
                    report.append(f"{scenario_name}: {status} {scenario_result['predicted_class']} (expected: {scenario_result['expected_class']})")
                    report.append(f"  Confidence: {scenario_result['confidence']:.4f}")
            report.append("")
        
        # Data quality
        if 'data_quality' in self.results:
            report.append("3. DATA QUALITY")
            report.append("-" * 40)
            data_quality = self.results['data_quality']
            report.append(f"Data available: {'✅' if data_quality['data_available'] else '❌'}")
            if data_quality['data_available']:
                report.append(f"Sample count: {data_quality['sample_count']}")
                report.append(f"Feature count: {data_quality['feature_count']}")
                report.append(f"Missing values: {data_quality['missing_values']}")
                report.append(f"Infinite values: {data_quality['infinite_values']}")
            report.append("")
        
        # Performance metrics
        if 'model_performance' in self.results:
            report.append("4. MODEL PERFORMANCE")
            report.append("-" * 40)
            performance = self.results['model_performance']
            if performance['performance_available']:
                report.append(f"Accuracy: {performance['accuracy']:.4f} ({performance['accuracy']*100:.2f}%)")
                report.append(f"Precision: {performance['precision']:.4f}")
                report.append(f"Recall: {performance['recall']:.4f}")
                report.append(f"F1 Score: {performance['f1_score']:.4f}")
            else:
                report.append("Performance metrics not available (no test data)")
            report.append("")
        
        # API endpoints
        if 'api_endpoints' in self.results:
            report.append("5. API ENDPOINTS")
            report.append("-" * 40)
            endpoints = self.results['api_endpoints']
            for service_name, service_result in endpoints.items():
                health_status = "✅" if service_result.get('health_status', False) else "❌"
                pred_status = "✅" if service_result.get('prediction_status', False) else "❌"
                report.append(f"{service_name}:")
                report.append(f"  Health: {health_status}")
                report.append(f"  Prediction: {pred_status}")
                if 'error' in service_result:
                    report.append(f"  Error: {service_result['error']}")
            report.append("")
        
        # Recommendations
        report.append("6. RECOMMENDATIONS")
        report.append("-" * 40)
        
        # Check basic functionality
        if 'basic_functionality' in self.results:
            basic = self.results['basic_functionality']
            if not basic['model_loaded']:
                report.append("❌ Model not loaded - check model files")
            if not basic['scaler_loaded']:
                report.append("⚠️  Scaler not found - model may not work correctly")
            if not basic['label_encoder_loaded']:
                report.append("⚠️  Label encoder not found - predictions may be numeric")
        
        # Check attack scenarios
        if 'attack_scenarios' in self.results:
            scenarios = self.results['attack_scenarios']
            correct_predictions = sum(1 for s in scenarios.values() if s.get('correct', False))
            total_scenarios = len(scenarios)
            if correct_predictions < total_scenarios * 0.5:
                report.append("❌ Low attack detection accuracy - consider retraining model")
            elif correct_predictions < total_scenarios * 0.8:
                report.append("⚠️  Moderate attack detection accuracy - monitor performance")
            else:
                report.append("✅ Good attack detection accuracy")
        
        # Check performance
        if 'model_performance' in self.results:
            performance = self.results['model_performance']
            if performance['performance_available']:
                if performance['accuracy'] < 0.8:
                    report.append("❌ Low model accuracy - consider retraining")
                elif performance['accuracy'] < 0.9:
                    report.append("⚠️  Moderate model accuracy - monitor performance")
                else:
                    report.append("✅ Good model accuracy")
        
        report.append("")
        report.append("=" * 80)
        
        return "\n".join(report)
    
    def run_full_validation(self, test_data_path: str = None) -> Dict[str, Any]:
        """Run complete validation suite"""
        logger.info("🚀 Starting full model validation...")
        
        # Load model components
        if not self.load_model_components():
            return {'error': 'Failed to load model components'}
        
        # Run all tests
        self.results['basic_functionality'] = self.test_model_basic_functionality()
        self.results['attack_scenarios'] = self.test_attack_scenarios()
        self.results['data_quality'] = self.test_data_quality(test_data_path)
        self.results['model_performance'] = self.test_model_performance(test_data_path)
        self.results['api_endpoints'] = self.test_api_endpoints()
        
        # Generate report
        report = self.generate_report()
        self.results['report'] = report
        
        logger.info("✅ Validation complete!")
        return self.results

def main():
    """Main function to run validation"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Model Validation Suite')
    parser.add_argument('--model-folder', default='.', help='Path to model folder')
    parser.add_argument('--test-data', help='Path to test data CSV file')
    parser.add_argument('--output', help='Output file for report')
    
    args = parser.parse_args()
    
    # Run validation
    validator = ModelValidationSuite(args.model_folder)
    results = validator.run_full_validation(args.test_data)
    
    # Print report
    print(results['report'])
    
    # Save report if output file specified
    if args.output:
        with open(args.output, 'w') as f:
            f.write(results['report'])
        print(f"\n📄 Report saved to: {args.output}")

if __name__ == "__main__":
    main()
