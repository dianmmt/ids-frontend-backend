#!/usr/bin/env python3
"""
Test script to simulate class 4 tie-breaking logic
"""

import numpy as np
import json

def simulate_class4_tie_breaking():
    """Simulate the class 4 tie-breaking logic"""
    print("=" * 80)
    print("🧪 SIMULATING CLASS 4 TIE-BREAKING LOGIC")
    print("=" * 80)
    
    # Simulate different scenarios
    scenarios = [
        {
            "name": "Class 4 wins with higher probability",
            "probabilities": {
                "4": 0.6,
                "1": 0.3,
                "2": 0.1
            }
        },
        {
            "name": "Class 4 ties with class 1 (should choose class 1)",
            "probabilities": {
                "4": 0.4,
                "1": 0.4,
                "2": 0.2
            }
        },
        {
            "name": "Class 4 ties with class 2 (should choose class 2)",
            "probabilities": {
                "4": 0.35,
                "2": 0.35,
                "1": 0.3
            }
        },
        {
            "name": "Class 1 wins, no class 4 tie",
            "probabilities": {
                "1": 0.5,
                "4": 0.3,
                "2": 0.2
            }
        },
        {
            "name": "Class 4 wins clearly",
            "probabilities": {
                "4": 0.8,
                "1": 0.15,
                "2": 0.05
            }
        },
        {
            "name": "Real scenario: Class 4 vs Class 3 (should choose Class 3)",
            "probabilities": {
                "4": 0.299,  # 29.9%
                "3": 0.290,  # 29.0%
                "5": 0.195,  # 19.5%
                "0": 0.094,  # 9.4%
                "7": 0.047,  # 4.7%
                "1": 0.038,  # 3.8%
                "2": 0.026,  # 2.6%
                "6": 0.010   # 1.0%
            }
        }
    ]
    
    for scenario in scenarios:
        print(f"\n{'='*60}")
        print(f"📊 Scenario: {scenario['name']}")
        print(f"{'='*60}")
        
        probabilities = scenario['probabilities']
        
        # Sort classes by probability (highest first)
        sorted_classes = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
        top_classes = sorted_classes[:5]
        
        # Get original prediction
        original_prediction = sorted_classes[0][0]
        original_confidence = sorted_classes[0][1]
        
        print(f"📈 Original probabilities:")
        for class_name, prob in sorted_classes:
            print(f"   • Class {class_name}: {prob:.3f} ({prob*100:.1f}%)")
        
        print(f"\n🎯 Original prediction: Class {original_prediction} ({original_confidence*100:.1f}%)")
        
        # Apply class 4 tie-breaking logic with approximate threshold
        prediction = original_prediction
        confidence = original_confidence
        tie_breaking_applied = False
        
        if len(sorted_classes) >= 2:
            top_class = sorted_classes[0]
            second_class = sorted_classes[1]
            
            # Define threshold for "approximately equal" (e.g., within 2%)
            threshold = 0.02  # 2% threshold
            
            # Check if class 4 has highest probability and is approximately equal to another class
            if (top_class[0] == '4' or top_class[0] == 4):
                probability_diff = abs(top_class[1] - second_class[1])
                
                print(f"\n🔍 CLASS 4 ANALYSIS:")
                print(f"   • Class 4 probability: {top_class[1]:.3f} ({top_class[1]*100:.1f}%)")
                print(f"   • Second class '{second_class[0]}' probability: {second_class[1]:.3f} ({second_class[1]*100:.1f}%)")
                print(f"   • Probability difference: {probability_diff:.3f} ({probability_diff*100:.1f}%)")
                print(f"   • Threshold: {threshold:.3f} ({threshold*100:.1f}%)")
                
                if probability_diff <= threshold:
                    print(f"\n🎯 CLASS 4 TIE-BREAKING LOGIC ACTIVATED (within threshold)")
                    print(f"   • Class 4 and class '{second_class[0]}' are approximately equal")
                    print(f"   • Choosing second class '{second_class[0]}' instead of class 4")
                    
                    # Update prediction to use second class
                    prediction = int(second_class[0]) if second_class[0].isdigit() else second_class[0]
                    confidence = second_class[1]
                    tie_breaking_applied = True
                    
                    # Reorder top_classes to reflect the change
                    top_classes = [second_class] + [cls for cls in sorted_classes if cls != second_class][:4]
                    
                    print(f"   ✅ Final prediction changed to: Class {prediction}")
                    print(f"   ✅ Final confidence: {confidence:.3f} ({confidence*100:.1f}%)")
                else:
                    print(f"\n✅ Class 4 wins with clear margin, no tie-breaking needed")
                    print(f"   • Margin: {probability_diff*100:.1f}% (above {threshold*100:.1f}% threshold)")
            else:
                print(f"\n✅ Class 4 is not the top prediction, using normal logic")
        
        # Determine if it's malicious
        is_malicious = str(prediction).lower() not in ['normal', 'benign', 'legitimate', '1']
        
        # Create result
        result = {
            'scenario': scenario['name'],
            'original_prediction': original_prediction,
            'final_prediction': prediction,
            'original_confidence': original_confidence,
            'final_confidence': confidence,
            'tie_breaking_applied': tie_breaking_applied,
            'is_malicious': is_malicious,
            'top_classes': top_classes,
            'all_probabilities': probabilities
        }
        
        print(f"\n📊 FINAL RESULT:")
        print(f"   • Original: Class {original_prediction} ({original_confidence*100:.1f}%)")
        print(f"   • Final: Class {prediction} ({confidence*100:.1f}%)")
        print(f"   • Tie-breaking applied: {tie_breaking_applied}")
        print(f"   • Is malicious: {is_malicious}")
        
        if tie_breaking_applied:
            print(f"   🎯 SUCCESS: Class 4 tie-breaking logic worked correctly!")
        else:
            print(f"   ✅ Normal prediction logic used")
    
    print(f"\n{'='*80}")
    print("🎉 Class 4 Tie-Breaking Logic Simulation Completed!")
    print("📝 This logic will help avoid false positives when class 4 ties with other classes")
    print(f"{'='*80}")

if __name__ == "__main__":
    simulate_class4_tie_breaking()
