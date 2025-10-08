#!/usr/bin/env python3
"""
Script để kiểm tra ML service có thể khởi động được không
Chạy: python check_ml_service.py
"""

import os
import sys
import subprocess
import time
import requests
from pathlib import Path

def check_python_environment():
    """Kiểm tra Python environment"""
    print("=" * 60)
    print("Checking Python Environment")
    print("=" * 60)
    
    # Check Python version
    python_version = sys.version
    print(f"Python version: {python_version}")
    
    # Check if we're in the right directory
    current_dir = Path.cwd()
    print(f"Current directory: {current_dir}")
    
    # Check if ml_server.py exists
    ml_server_path = current_dir / "ml_server.py"
    if ml_server_path.exists():
        print(f"✅ ml_server.py found: {ml_server_path}")
    else:
        print(f"❌ ml_server.py not found in {current_dir}")
        return False
    
    # Check if required files exist
    required_files = [
        "random_forest_full_best_model_1456_samples.pkl",
        "scaler.pkl", 
        "label_encoder.pkl"
    ]
    
    for file in required_files:
        file_path = current_dir / file
        if file_path.exists():
            print(f"✅ {file} found")
        else:
            print(f"❌ {file} not found")
            return False
    
    return True

def check_dependencies():
    """Kiểm tra dependencies"""
    print("\n" + "=" * 60)
    print("Checking Dependencies")
    print("=" * 60)
    
    required_packages = [
        'flask',
        'flask_cors', 
        'psycopg2',
        'joblib',
        'numpy'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"✅ {package} installed")
        except ImportError:
            print(f"❌ {package} not installed")
            missing_packages.append(package)
    
    if missing_packages:
        print(f"\nMissing packages: {', '.join(missing_packages)}")
        print("Install with: pip install " + " ".join(missing_packages))
        return False
    
    return True

def test_ml_server_startup():
    """Test ML server startup"""
    print("\n" + "=" * 60)
    print("Testing ML Server Startup")
    print("=" * 60)
    
    # Set environment variables
    env = os.environ.copy()
    env.update({
        'DB_HOST': 'localhost',
        'DB_PORT': '5432',
        'DB_NAME': 'sdn_ids',
        'DB_USER': 'sdn_user',
        'DB_PASSWORD': 'sdn_password',
        'PORT': '5000',
        'HOST': '0.0.0.0',
        'PYTHONUNBUFFERED': '1'
    })
    
    try:
        # Start ML server
        print("Starting ML server...")
        process = subprocess.Popen(
            [sys.executable, 'ml_server.py'],
            cwd=Path.cwd(),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        # Wait a bit for startup
        time.sleep(5)
        
        # Check if process is still running
        if process.poll() is None:
            print("✅ ML server process is running")
            
            # Test health endpoint
            try:
                response = requests.get('http://localhost:5000/health', timeout=5)
                if response.status_code == 200:
                    data = response.json()
                    print("✅ Health endpoint responding")
                    print(f"   Status: {data.get('status')}")
                    print(f"   Model loaded: {data.get('model_loaded')}")
                    print(f"   Model ID: {data.get('model_id')}")
                else:
                    print(f"❌ Health endpoint returned {response.status_code}")
            except requests.exceptions.RequestException as e:
                print(f"❌ Health endpoint failed: {e}")
            
            # Stop the process
            process.terminate()
            process.wait(timeout=10)
            print("✅ ML server stopped cleanly")
            
        else:
            # Process exited, get output
            stdout, stderr = process.communicate()
            print("❌ ML server process exited")
            print("STDOUT:", stdout)
            print("STDERR:", stderr)
            return False
            
    except Exception as e:
        print(f"❌ Error testing ML server: {e}")
        return False
    
    return True

def main():
    """Main function"""
    print("ML Service Startup Checker")
    print("=" * 60)
    
    # Check Python environment
    if not check_python_environment():
        print("\n❌ Python environment check failed")
        return 1
    
    # Check dependencies
    if not check_dependencies():
        print("\n❌ Dependencies check failed")
        return 1
    
    # Test ML server startup
    if not test_ml_server_startup():
        print("\n❌ ML server startup test failed")
        return 1
    
    print("\n" + "=" * 60)
    print("✅ All checks passed! ML service should work correctly.")
    print("=" * 60)
    
    return 0

if __name__ == "__main__":
    sys.exit(main())

