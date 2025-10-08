#!/usr/bin/env python3
"""
Script để test label decoding
Kiểm tra xem model có decode đúng số thành tên attack type không
"""

import joblib
import numpy as np
import os

# Change to ml directory if needed
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

print("=" * 60)
print("KIỂM TRA LABEL ENCODER")
print("=" * 60)

# Load label encoder
try:
    label_encoder = joblib.load('label_encoder.pkl')
    print("✓ Label encoder loaded successfully")
    print(f"\nKiểu dữ liệu: {type(label_encoder)}")
    
    if hasattr(label_encoder, 'classes_'):
        print(f"\nTổng số classes: {len(label_encoder.classes_)}")
        print("\n" + "=" * 60)
        print("MAPPING CHI TIẾT:")
        print("=" * 60)
        for numeric_label, class_name in enumerate(label_encoder.classes_):
            print(f"  {numeric_label} = {class_name}")
        
        print("\n" + "=" * 60)
        print("TEST DECODING:")
        print("=" * 60)
        
        # Test decode từng số
        test_numbers = [0, 1, 2, 3, 4, 5, 6, 7]
        for num in test_numbers:
            try:
                decoded = label_encoder.inverse_transform([num])[0]
                print(f"  {num} → {decoded}")
            except Exception as e:
                print(f"  {num} → ERROR: {e}")
        
        print("\n" + "=" * 60)
        print("TEST ARRAY DECODING:")
        print("=" * 60)
        
        # Test decode array
        test_array = np.array([0, 2, 4, 6])
        try:
            decoded_array = label_encoder.inverse_transform(test_array)
            print(f"  Input: {test_array}")
            print(f"  Output: {decoded_array}")
        except Exception as e:
            print(f"  ERROR: {e}")
            
    else:
        print("✗ Không tìm thấy thuộc tính 'classes_'")
        
except Exception as e:
    print(f"✗ Lỗi khi load label encoder: {e}")

print("\n" + "=" * 60)
print("MANUAL MAPPING (FALLBACK):")
print("=" * 60)

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

print("Manual mapping dictionary:")
for num, name in label_mapping.items():
    print(f"  {num} = {name}")

print("\nTest manual mapping:")
test_predictions = [0, 2, 4, 6, 99]
for pred in test_predictions:
    result = label_mapping.get(int(pred), f'Unknown_{pred}')
    print(f"  {pred} → {result}")

print("\n" + "=" * 60)
print("TEST HOÀN TẤT")
print("=" * 60)

