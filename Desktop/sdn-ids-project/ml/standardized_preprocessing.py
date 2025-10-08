#!/usr/bin/env python3
"""
Standardized Preprocessing Module for SDN-IDS
Ensures consistent feature extraction across all ML services
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, List
import logging

logger = logging.getLogger(__name__)

# Standard CICFlowMeter feature names in exact order (77 features including Protocol)
STANDARD_FEATURE_NAMES = [
    # Protocol (1 feature) - FIRST feature as required by model
    'protocol',
    
    # Basic flow info (5 features)
    'flow_duration', 'total_fwd_packets', 'total_backward_packets',
    'total_length_of_fwd_packets', 'total_length_of_bwd_packets',
    
    # Packet length features (8 features)
    'fwd_packet_length_max', 'fwd_packet_length_min', 'fwd_packet_length_mean', 'fwd_packet_length_std',
    'bwd_packet_length_max', 'bwd_packet_length_min', 'bwd_packet_length_mean', 'bwd_packet_length_std',
    
    # Flow timing features (6 features)
    'flow_bytes_per_second', 'flow_packets_per_second', 'flow_iat_mean', 'flow_iat_std', 'flow_iat_max', 'flow_iat_min',
    
    # Forward IAT features (5 features)
    'fwd_iat_total', 'fwd_iat_mean', 'fwd_iat_std', 'fwd_iat_max', 'fwd_iat_min',
    
    # Backward IAT features (5 features)
    'bwd_iat_total', 'bwd_iat_mean', 'bwd_iat_std', 'bwd_iat_max', 'bwd_iat_min',
    
    # Protocol features (8 features)
    'fwd_psh_flags', 'bwd_psh_flags', 'fwd_urg_flags', 'bwd_urg_flags',
    'fwd_header_length', 'bwd_header_length', 'fwd_packets_per_second', 'bwd_packets_per_second',
    
    # Window size features (5 features)
    'packet_length_min', 'packet_length_max', 'packet_length_mean', 'packet_length_std', 'packet_length_variance',
    
    # Flag counts (8 features)
    'fin_flag_count', 'syn_flag_count', 'rst_flag_count', 'psh_flag_count', 'ack_flag_count',
    'urg_flag_count', 'cwe_flag_count', 'ece_flag_count',
    
    # Additional features (4 features)
    'down_up_ratio', 'packet_size_avg', 'fwd_segment_size_avg', 'bwd_segment_size_avg',
    
    # Extended CICFlowMeter features (22 features)
    'fwd_bytes_per_byte_avg', 'fwd_packets_per_byte_avg', 'fwd_block_rate_avg',
    'bwd_bytes_per_byte_avg', 'bwd_packets_per_byte_avg', 'bwd_block_rate_avg',
    'subflow_fwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_packets', 'subflow_bwd_bytes',
    'init_fwd_win_bytes', 'init_bwd_win_bytes', 'fwd_act_data_packets', 'fwd_segment_size_min',
    'active_mean', 'active_std', 'active_max', 'active_min',
    'idle_mean', 'idle_std', 'idle_max', 'idle_min'
]

def standardize_flow_data(flow_data: Dict[str, Any]) -> np.ndarray:
    """
    Standardize flow data to CICFlowMeter format with 77 features
    
    Args:
        flow_data: Dictionary containing flow/packet data or array of features
        
    Returns:
        numpy array with 77 standardized features
    """
    try:
        # Handle case where flow_data is already a feature array
        if isinstance(flow_data, (list, np.ndarray)):
            feature_array = np.array(flow_data, dtype=np.float32).reshape(1, -1)
            # Ensure we have exactly 77 features
            if feature_array.shape[1] != len(STANDARD_FEATURE_NAMES):
                logger.warning(f"Feature array has {feature_array.shape[1]} features, expected {len(STANDARD_FEATURE_NAMES)}")
                # Pad or truncate to correct size
                if feature_array.shape[1] < len(STANDARD_FEATURE_NAMES):
                    padding = np.zeros((1, len(STANDARD_FEATURE_NAMES) - feature_array.shape[1]), dtype=np.float32)
                    feature_array = np.hstack([feature_array, padding])
                else:
                    feature_array = feature_array[:, :len(STANDARD_FEATURE_NAMES)]
            
            # Handle infinite values
            feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
            return feature_array
        
        # Create feature mapping with defaults for dictionary input
        features = {}
        
        # Protocol - CICFlowMeter CSV already provides numeric values (TCP=6, UDP=17, etc.)
        protocol_value = flow_data.get('protocol', 6)  # Default to TCP (6)
        if isinstance(protocol_value, str):
            # Handle case where protocol might be passed as string number
            try:
                features['protocol'] = float(protocol_value)
            except ValueError:
                features['protocol'] = 6.0  # Default to TCP if invalid
        else:
            features['protocol'] = float(protocol_value) if protocol_value is not None else 6.0
        
        # Basic flow info
        features['flow_duration'] = flow_data.get('flow_duration', flow_data.get('duration', 0.0))
        features['total_fwd_packets'] = flow_data.get('total_fwd_packets', flow_data.get('packet_count', 1))
        features['total_backward_packets'] = flow_data.get('total_backward_packets', 0)
        features['total_length_of_fwd_packets'] = flow_data.get('total_length_of_fwd_packets', flow_data.get('byte_count', 0))
        features['total_length_of_bwd_packets'] = flow_data.get('total_length_of_bwd_packets', 0)
        
        # Packet length features
        features['fwd_packet_length_max'] = flow_data.get('fwd_packet_length_max', flow_data.get('byte_count', 0))
        features['fwd_packet_length_min'] = flow_data.get('fwd_packet_length_min', flow_data.get('byte_count', 0))
        features['fwd_packet_length_mean'] = flow_data.get('fwd_packet_length_mean', flow_data.get('avg_packet_size', flow_data.get('byte_count', 0)))
        features['fwd_packet_length_std'] = flow_data.get('fwd_packet_length_std', 0.0)
        features['bwd_packet_length_max'] = flow_data.get('bwd_packet_length_max', 0)
        features['bwd_packet_length_min'] = flow_data.get('bwd_packet_length_min', 0)
        features['bwd_packet_length_mean'] = flow_data.get('bwd_packet_length_mean', 0)
        features['bwd_packet_length_std'] = flow_data.get('bwd_packet_length_std', 0)
        
        # Flow timing features
        features['flow_bytes_per_second'] = flow_data.get('flow_bytes_per_second', flow_data.get('bytes_per_second', 0))
        features['flow_packets_per_second'] = flow_data.get('flow_packets_per_second', flow_data.get('packets_per_second', 0))
        features['flow_iat_mean'] = flow_data.get('flow_iat_mean', 0)
        features['flow_iat_std'] = flow_data.get('flow_iat_std', 0)
        features['flow_iat_max'] = flow_data.get('flow_iat_max', 0)
        features['flow_iat_min'] = flow_data.get('flow_iat_min', 0)
        
        # Forward IAT features
        features['fwd_iat_total'] = flow_data.get('fwd_iat_total', 0)
        features['fwd_iat_mean'] = flow_data.get('fwd_iat_mean', 0)
        features['fwd_iat_std'] = flow_data.get('fwd_iat_std', 0)
        features['fwd_iat_max'] = flow_data.get('fwd_iat_max', 0)
        features['fwd_iat_min'] = flow_data.get('fwd_iat_min', 0)
        
        # Backward IAT features
        features['bwd_iat_total'] = flow_data.get('bwd_iat_total', 0)
        features['bwd_iat_mean'] = flow_data.get('bwd_iat_mean', 0)
        features['bwd_iat_std'] = flow_data.get('bwd_iat_std', 0)
        features['bwd_iat_max'] = flow_data.get('bwd_iat_max', 0)
        features['bwd_iat_min'] = flow_data.get('bwd_iat_min', 0)
        
        # Protocol features
        features['fwd_psh_flags'] = flow_data.get('fwd_psh_flags', 0)
        features['bwd_psh_flags'] = flow_data.get('bwd_psh_flags', 0)
        features['fwd_urg_flags'] = flow_data.get('fwd_urg_flags', 0)
        features['bwd_urg_flags'] = flow_data.get('bwd_urg_flags', 0)
        features['fwd_header_length'] = flow_data.get('fwd_header_length', 0)
        features['bwd_header_length'] = flow_data.get('bwd_header_length', 0)
        features['fwd_packets_per_second'] = flow_data.get('fwd_packets_per_second', 0)
        features['bwd_packets_per_second'] = flow_data.get('bwd_packets_per_second', 0)
        
        # Window size features
        features['packet_length_min'] = flow_data.get('packet_length_min', flow_data.get('byte_count', 0))
        features['packet_length_max'] = flow_data.get('packet_length_max', flow_data.get('byte_count', 0))
        features['packet_length_mean'] = flow_data.get('packet_length_mean', flow_data.get('avg_packet_size', flow_data.get('byte_count', 0)))
        features['packet_length_std'] = flow_data.get('packet_length_std', 0)
        features['packet_length_variance'] = flow_data.get('packet_length_variance', 0)
        
        # Flag counts
        features['fin_flag_count'] = flow_data.get('fin_flag_count', 0)
        features['syn_flag_count'] = flow_data.get('syn_flag_count', 0)
        features['rst_flag_count'] = flow_data.get('rst_flag_count', 0)
        features['psh_flag_count'] = flow_data.get('psh_flag_count', 0)
        features['ack_flag_count'] = flow_data.get('ack_flag_count', 0)
        features['urg_flag_count'] = flow_data.get('urg_flag_count', 0)
        features['cwe_flag_count'] = flow_data.get('cwe_flag_count', 0)
        features['ece_flag_count'] = flow_data.get('ece_flag_count', 0)
        
        # Additional features
        features['down_up_ratio'] = flow_data.get('down_up_ratio', 0)
        features['packet_size_avg'] = flow_data.get('packet_size_avg', flow_data.get('avg_packet_size', flow_data.get('byte_count', 0)))
        features['fwd_segment_size_avg'] = flow_data.get('fwd_segment_size_avg', 0)
        features['bwd_segment_size_avg'] = flow_data.get('bwd_segment_size_avg', 0)
        
        # Extended CICFlowMeter features
        features['fwd_bytes_per_byte_avg'] = flow_data.get('fwd_bytes_per_byte_avg', 0)
        features['fwd_packets_per_byte_avg'] = flow_data.get('fwd_packets_per_byte_avg', 0)
        features['fwd_block_rate_avg'] = flow_data.get('fwd_block_rate_avg', 0)
        features['bwd_bytes_per_byte_avg'] = flow_data.get('bwd_bytes_per_byte_avg', 0)
        features['bwd_packets_per_byte_avg'] = flow_data.get('bwd_packets_per_byte_avg', 0)
        features['bwd_block_rate_avg'] = flow_data.get('bwd_block_rate_avg', 0)
        features['subflow_fwd_packets'] = flow_data.get('subflow_fwd_packets', 0)
        features['subflow_fwd_bytes'] = flow_data.get('subflow_fwd_bytes', 0)
        features['subflow_bwd_packets'] = flow_data.get('subflow_bwd_packets', 0)
        features['subflow_bwd_bytes'] = flow_data.get('subflow_bwd_bytes', 0)
        features['init_fwd_win_bytes'] = flow_data.get('init_fwd_win_bytes', 0)
        features['init_bwd_win_bytes'] = flow_data.get('init_bwd_win_bytes', 0)
        features['fwd_act_data_packets'] = flow_data.get('fwd_act_data_packets', 0)
        features['fwd_segment_size_min'] = flow_data.get('fwd_segment_size_min', 0)
        features['active_mean'] = flow_data.get('active_mean', 0)
        features['active_std'] = flow_data.get('active_std', 0)
        features['active_max'] = flow_data.get('active_max', 0)
        features['active_min'] = flow_data.get('active_min', 0)
        features['idle_mean'] = flow_data.get('idle_mean', 0)
        features['idle_std'] = flow_data.get('idle_std', 0)
        features['idle_max'] = flow_data.get('idle_max', 0)
        features['idle_min'] = flow_data.get('idle_min', 0)
        
        # Extract features in standard order
        feature_array = np.array([features.get(name, 0.0) for name in STANDARD_FEATURE_NAMES], dtype=np.float32)
        
        # Reshape for single sample
        feature_array = feature_array.reshape(1, -1)
        
        # Handle infinite values and ensure proper data types
        feature_array = np.nan_to_num(feature_array, nan=0.0, posinf=0.0, neginf=0.0)
        
        logger.debug(f"Standardized {len(STANDARD_FEATURE_NAMES)} features from flow data")
        
        return feature_array
        
    except Exception as e:
        logger.error(f"Error standardizing flow data: {e}")
        # Return zero array with correct shape as fallback
        return np.zeros((1, len(STANDARD_FEATURE_NAMES)), dtype=np.float32)

def get_feature_names() -> List[str]:
    """Get the list of standard feature names"""
    return STANDARD_FEATURE_NAMES.copy()

def validate_feature_count(feature_array: np.ndarray) -> bool:
    """Validate that feature array has the correct number of features"""
    expected_count = len(STANDARD_FEATURE_NAMES)
    actual_count = feature_array.shape[1] if feature_array.ndim > 1 else len(feature_array)
    
    if actual_count != expected_count:
        logger.warning(f"Feature count mismatch: expected {expected_count}, got {actual_count}")
        return False
    
    return True

if __name__ == '__main__':
    # Test the standardization function
    test_data = {
        'duration': 10.5,
        'packet_count': 100,
        'byte_count': 5000,
        'avg_packet_size': 50,
        'source_ip': '192.168.1.1',
        'destination_ip': '10.0.0.1'
    }
    
    features = standardize_flow_data(test_data)
    print(f"Standardized features shape: {features.shape}")
    print(f"Expected features: {len(STANDARD_FEATURE_NAMES)}")
    print(f"Validation: {validate_feature_count(features)}")


