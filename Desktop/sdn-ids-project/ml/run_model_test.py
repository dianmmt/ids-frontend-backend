#!/usr/bin/env python3
"""
Simple Model Test Runner
Quick way to test the model with 77 features
"""

import os
import sys
import logging
from test_model_77_features import main as test_77_features
from model_validation_suite import ModelValidationSuite

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def run_quick_test():
    """Run quick model test with 77 features"""
    print("🚀 QUICK MODEL TEST - 77 FEATURES")
    print("=" * 50)
    
    try:
        # Run the 77-feature test
        test_77_features()
        return True
    except Exception as e:
        logger.error(f"Quick test failed: {e}")
        return False

def run_comprehensive_test():
    """Run comprehensive model validation"""
    print("🔍 COMPREHENSIVE MODEL VALIDATION")
    print("=" * 50)
    
    try:
        validator = ModelValidationSuite('.')
        results = validator.run_full_validation()
        
        if 'report' in results:
            print(results['report'])
        
        return True
    except Exception as e:
        logger.error(f"Comprehensive test failed: {e}")
        return False

def main():
    """Main function"""
    print("MODEL TESTING SUITE")
    print("=" * 60)
    print("1. Quick Test (77 features)")
    print("2. Comprehensive Validation")
    print("3. Both tests")
    print("=" * 60)
    
    choice = input("Select test type (1/2/3): ").strip()
    
    if choice == '1':
        run_quick_test()
    elif choice == '2':
        run_comprehensive_test()
    elif choice == '3':
        print("Running both tests...\n")
        run_quick_test()
        print("\n" + "="*60 + "\n")
        run_comprehensive_test()
    else:
        print("Invalid choice. Running quick test by default.")
        run_quick_test()

if __name__ == '__main__':
    main()
