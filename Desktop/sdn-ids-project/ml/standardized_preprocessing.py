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

# Standard CICFlowMeter feature names in exact order
STANDARD_FEATURE_NAMES = [
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
    'min_packet_length', 'max_packet_length', 'packet_length_mean', 'packet_length_std', 'packet_length_variance',
    
    # Flag counts (8 features)
    'fin_flag_count', 'syn_flag_count', 'rst_flag_count', 'psh_flag_count', 'ack_flag_count',
    'urg_flag_count', 'cwe_flag_count', 'ece_flag_count',
    
    # Additional features (4 features)
    'down_up_ratio', 'average_packet_size', 'avg_fwd_segment_size', 'avg_bwd_segment_size',
    
    # Extended CICFlowMeter features (22 features)
    'fwd_header_length_1', 'fwd_avg_bytes_per_bulk', 'fwd_avg_packets_per_bulk', 'fwd_avg_bulk_rate',
    'bwd_avg_bytes_per_bulk', 'bwd_avg_packets_per_bulk', 'bwd_avg_bulk_rate',
    'subflow_fwd_packets', 'subflow_bwd_packets', 'subflow_fwd_bytes', 'subflow_bwd_bytes',
    'init_win_bytes_forward', 'init_win_bytes_backward', 'act_data_pkt_fwd', 'min_seg_size_forward',
    'active_mean', 'active_std', 'active_max', 'active_min',
    'idle_mean', 'idle_std', 'idle_max', 'idle_min'
]

def standardize_flow_data(flow_data: Dict[str, Any]) -> np.ndarray:
    """
    Standardize flow data to CICFlowMeter format with 77 features
    
    Args:
        flow_data: Dictionary containing flow/packet data
        
    Returns:
        numpy array with 77 standardized features
    """
    try:
        # Create feature mapping with defaults
        features = {}
        
        # Basic flow info
        features['flow_duration'] = flow_data.get('duration', 0.0)
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
        features['min_packet_length'] = flow_data.get('min_packet_length', flow_data.get('byte_count', 0))
        features['max_packet_length'] = flow_data.get('max_packet_length', flow_data.get('byte_count', 0))
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
        features['average_packet_size'] = flow_data.get('average_packet_size', flow_data.get('avg_packet_size', flow_data.get('byte_count', 0)))
        features['avg_fwd_segment_size'] = flow_data.get('avg_fwd_segment_size', 0)
        features['avg_bwd_segment_size'] = flow_data.get('avg_bwd_segment_size', 0)
        
        # Extended CICFlowMeter features
        features['fwd_header_length_1'] = flow_data.get('fwd_header_length_1', 0)
        features['fwd_avg_bytes_per_bulk'] = flow_data.get('fwd_avg_bytes_per_bulk', 0)
        features['fwd_avg_packets_per_bulk'] = flow_data.get('fwd_avg_packets_per_bulk', 0)
        features['fwd_avg_bulk_rate'] = flow_data.get('fwd_avg_bulk_rate', 0)
        features['bwd_avg_bytes_per_bulk'] = flow_data.get('bwd_avg_bytes_per_bulk', 0)
        features['bwd_avg_packets_per_bulk'] = flow_data.get('bwd_avg_packets_per_bulk', 0)
        features['bwd_avg_bulk_rate'] = flow_data.get('bwd_avg_bulk_rate', 0)
        features['subflow_fwd_packets'] = flow_data.get('subflow_fwd_packets', 0)
        features['subflow_bwd_packets'] = flow_data.get('subflow_bwd_packets', 0)
        features['subflow_fwd_bytes'] = flow_data.get('subflow_fwd_bytes', 0)
        features['subflow_bwd_bytes'] = flow_data.get('subflow_bwd_bytes', 0)
        features['init_win_bytes_forward'] = flow_data.get('init_win_bytes_forward', 0)
        features['init_win_bytes_backward'] = flow_data.get('init_win_bytes_backward', 0)
        features['act_data_pkt_fwd'] = flow_data.get('act_data_pkt_fwd', 0)
        features['min_seg_size_forward'] = flow_data.get('min_seg_size_forward', 0)
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


