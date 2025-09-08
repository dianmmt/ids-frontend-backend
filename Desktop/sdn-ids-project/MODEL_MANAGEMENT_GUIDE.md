# 🤖 Model Management System Guide

## 📋 Overview

The SDN-IDS project now includes a comprehensive **Model Management System** that allows users to upload, manage, and select ML models for attack detection. This system provides a complete workflow from model upload to deployment and usage tracking.

## 🏗️ Architecture

### **System Components**

1. **Database Schema** - Stores model metadata, files, and user selections
2. **Model Management API** - Handles upload, selection, and management operations
3. **Dynamic Inference Service** - Loads and uses user-selected models
4. **Frontend Interface** - Model management UI in settings
5. **Pipeline Integration** - Automatic model usage in attack detection

### **Data Flow**

```
User Upload → Database Storage → Model Selection → Dynamic Loading → Attack Detection
```

## 🗄️ Database Schema

### **New Tables**

#### **`model_files`**
Stores individual model files (model, scaler, encoder, metadata)
```sql
CREATE TABLE model_files (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES ml_models(id),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL, -- 'model', 'scaler', 'encoder', 'metadata'
    file_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    file_hash VARCHAR(64), -- SHA-256 hash
    upload_status VARCHAR(20) DEFAULT 'uploading'
);
```

#### **`model_versions`**
Tracks model versions and performance metrics
```sql
CREATE TABLE model_versions (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES ml_models(id),
    version_number VARCHAR(20) NOT NULL,
    version_description TEXT,
    is_active BOOLEAN DEFAULT FALSE,
    performance_metrics JSONB,
    training_data_info JSONB
);
```

#### **`model_selections`**
User-specific model selections
```sql
CREATE TABLE model_selections (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    model_id UUID REFERENCES ml_models(id),
    model_version_id BIGINT REFERENCES model_versions(id),
    selection_type VARCHAR(20) DEFAULT 'primary', -- 'primary', 'fallback', 'testing'
    is_active BOOLEAN DEFAULT TRUE
);
```

#### **`model_usage_logs`**
Tracks model usage and performance
```sql
CREATE TABLE model_usage_logs (
    id BIGSERIAL PRIMARY KEY,
    model_id UUID REFERENCES ml_models(id),
    user_id UUID REFERENCES users(id),
    usage_type VARCHAR(20) NOT NULL, -- 'prediction', 'training', 'testing'
    input_data_hash VARCHAR(64),
    prediction_result JSONB,
    processing_time_ms DECIMAL(10,3),
    success BOOLEAN NOT NULL
);
```

## 🔧 API Endpoints

### **Model Management**

#### **GET `/api/models`**
Get all available models with user selection status
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "model_name": "SDN IDS Model v2.1",
      "model_type": "RandomForest",
      "version_number": "2.1.0",
      "performance_metrics": {...},
      "file_count": 3,
      "total_size": 45000000,
      "user_selection_type": "primary"
    }
  ]
}
```

#### **POST `/api/models/upload`**
Upload new model files
```bash
curl -X POST /api/models/upload \
  -H "Authorization: Bearer <token>" \
  -F "modelName=My Model" \
  -F "modelType=RandomForest" \
  -F "versionNumber=1.0.0" \
  -F "versionDescription=My custom model" \
  -F "files=@model.joblib" \
  -F "files=@scaler.joblib" \
  -F "files=@encoder.joblib"
```

#### **POST `/api/models/:modelId/select`**
Select a model for the current user
```json
{
  "selectionType": "primary" // or "fallback", "testing"
}
```

#### **GET `/api/models/user/selected`**
Get user's selected models
```json
{
  "success": true,
  "data": [
    {
      "model_id": "uuid",
      "model_name": "SDN IDS Model v2.1",
      "selection_type": "primary",
      "model_path": "/uploads/models/model.joblib",
      "scaler_path": "/uploads/models/scaler.joblib",
      "encoder_path": "/uploads/models/encoder.joblib"
    }
  ]
}
```

#### **POST `/api/models/:modelId/test`**
Test a model with sample data
```json
{
  "testData": {
    "packet_count": 100,
    "byte_count": 50000,
    "duration": 10.5,
    "protocol": "TCP"
  }
}
```

### **Dynamic Inference Service**

#### **POST `/predict`** (Dynamic Service)
Make predictions using user's selected model
```bash
curl -X POST http://dynamic-inference-service:5000/predict \
  -H "X-User-ID: user-uuid" \
  -H "X-Model-Selection-Type: primary" \
  -H "Content-Type: application/json" \
  -d '{
    "packet_count": 100,
    "byte_count": 50000,
    "duration": 10.5,
    "protocol": "TCP"
  }'
```

#### **GET `/models/available`** (Dynamic Service)
Get available models for a user
```bash
curl -H "X-User-ID: user-uuid" \
  http://dynamic-inference-service:5000/models/available
```

## 🎨 Frontend Interface

### **Model Management Component**

The `ModelManagement.tsx` component provides:

1. **Model Upload Interface**
   - Drag & drop file upload
   - Model metadata input
   - Multiple file support (model, scaler, encoder)

2. **Model Selection**
   - Primary/fallback model selection
   - Model activation/deactivation
   - Selection status indicators

3. **Model Testing**
   - Test models with sample data
   - Performance metrics display
   - Real-time prediction results

4. **Usage Statistics**
   - Model usage tracking
   - Performance analytics
   - Success/failure rates

### **Settings Integration**

The Settings component now includes:
- Link to Advanced Model Management
- Quick model status overview
- Active model count display

## 🚀 Usage Workflow

### **1. Upload a Model**

1. Navigate to **Settings → Machine Learning**
2. Click **"Advanced Model Management"**
3. Click **"Upload Model"**
4. Fill in model metadata:
   - Model Name
   - Model Type (RandomForest, SVM, etc.)
   - Version Number
   - Description
5. Upload files:
   - Model file (.joblib, .pkl, .h5)
   - Scaler file (scaler.joblib)
   - Encoder file (encoder.joblib)
6. Click **"Upload Model"**

### **2. Select a Model**

1. In Model Management, find your uploaded model
2. Click **"Select Primary"** to set as primary model
3. Or use **"Select Fallback"** for backup model
4. The system will automatically use your selected model

### **3. Test a Model**

1. Click the **Play button** on any model
2. Modify test data if needed
3. Click **"Test Model"**
4. View prediction results and performance

### **4. Monitor Usage**

1. View model details by clicking on a model card
2. Check usage statistics in the sidebar
3. Monitor success rates and processing times

## 🔄 Integration with Attack Detection

### **Automatic Model Selection**

The system automatically uses the user's selected model for attack detection:

1. **Pipeline Processor** queries unprocessed flows
2. **ML Predictor** calls dynamic inference service with user context
3. **Dynamic Inference Service** loads user's selected model
4. **Prediction** is made using the selected model
5. **Results** are stored with model tracking information

### **User Context**

Every prediction includes:
- User ID for model selection
- Model ID for tracking
- Processing time for performance monitoring
- Success/failure logging

## 🛠️ Configuration

### **Environment Variables**

#### **Backend**
```bash
DYNAMIC_INFERENCE_API_URL=http://dynamic-inference-service:5000
MODEL_UPLOAD_DIR=/app/uploads/models
```

#### **Dynamic Inference Service**
```bash
DB_HOST=database
DB_PORT=5432
DB_NAME=sdn_ids
DB_USER=sdn_user
DB_PASSWORD=sdn_password
INFERENCE_HOST=0.0.0.0
INFERENCE_PORT=5000
```

### **Docker Compose**

The system includes a new `dynamic-inference-service` container:

```yaml
dynamic-inference-service:
  build:
    context: ./ml
    dockerfile: Dockerfile.dynamic
  environment:
    - DB_HOST=database
    - DB_PORT=5432
    - DB_NAME=sdn_ids
    - DB_USER=sdn_user
    - DB_PASSWORD=sdn_password
  ports:
    - "5002:5000"
  volumes:
    - ./ml:/app:ro
    - ./uploads:/app/uploads
```

## 📊 Model Performance Tracking

### **Metrics Collected**

1. **Usage Statistics**
   - Total predictions made
   - Success/failure rates
   - Average processing time
   - Last used timestamp

2. **Performance Metrics**
   - Model accuracy
   - F1 score
   - Precision/Recall
   - Training data info

3. **System Metrics**
   - Model loading time
   - Memory usage
   - CPU utilization

### **Usage Analytics**

The system provides comprehensive analytics:

```sql
-- Get model usage statistics
SELECT 
  m.model_name,
  COUNT(*) as total_usage,
  AVG(processing_time_ms) as avg_processing_time,
  COUNT(CASE WHEN success = true THEN 1 END) as successful_predictions
FROM model_usage_logs mul
JOIN ml_models m ON mul.model_id = m.id
WHERE mul.created_at > NOW() - INTERVAL '30 days'
GROUP BY m.id, m.model_name;
```

## 🔒 Security Features

### **File Validation**
- File type validation (.joblib, .pkl, .h5, .json, .txt)
- File size limits (500MB per file)
- SHA-256 hash verification
- Malware scanning (optional)

### **Access Control**
- User authentication required
- Model ownership tracking
- Selection permissions
- Usage logging

### **Data Protection**
- Encrypted file storage
- Secure file paths
- Access logging
- Audit trails

## 🚨 Troubleshooting

### **Common Issues**

#### **Model Upload Fails**
```bash
# Check file permissions
ls -la uploads/models/

# Check disk space
df -h

# Check logs
docker logs sdn-ids-backend
```

#### **Model Selection Not Working**
```bash
# Check database connection
docker exec -it sdn-ids-database psql -U sdn_user -d sdn_ids -c "SELECT * FROM model_selections;"

# Check dynamic inference service
curl http://localhost:5002/health
```

#### **Predictions Failing**
```bash
# Check model files exist
ls -la uploads/models/

# Check model loading
curl -H "X-User-ID: test-user" http://localhost:5002/models/available

# Check logs
docker logs sdn-ids-dynamic-inference
```

### **Performance Optimization**

#### **Model Caching**
- Models are cached in memory for faster access
- Cache is refreshed every 5 minutes
- Manual cache clearing available

#### **Batch Processing**
- Process multiple flows together
- Reduce API overhead
- Better throughput

#### **Database Optimization**
- Indexed queries for fast model selection
- Connection pooling
- Query optimization

## 📈 Future Enhancements

### **Planned Features**

1. **Model Versioning**
   - Automatic version management
   - Rollback capabilities
   - A/B testing support

2. **Auto-Retraining**
   - Automatic model updates
   - Performance monitoring
   - Drift detection

3. **Model Marketplace**
   - Share models between users
   - Public model repository
   - Community contributions

4. **Advanced Analytics**
   - Model comparison tools
   - Performance dashboards
   - Predictive analytics

5. **MLOps Integration**
   - CI/CD pipelines
   - Automated testing
   - Deployment automation

## 🎯 Best Practices

### **Model Management**

1. **Naming Convention**
   - Use descriptive model names
   - Include version numbers
   - Add performance metrics

2. **File Organization**
   - Keep related files together
   - Use consistent naming
   - Document model purpose

3. **Testing**
   - Test models before deployment
   - Use diverse test data
   - Monitor performance metrics

4. **Monitoring**
   - Track usage patterns
   - Monitor performance degradation
   - Set up alerts for failures

### **Security**

1. **Access Control**
   - Limit model access to authorized users
   - Use strong authentication
   - Regular access reviews

2. **Data Protection**
   - Encrypt sensitive models
   - Secure file storage
   - Regular backups

3. **Audit Logging**
   - Log all model operations
   - Monitor access patterns
   - Regular security reviews

## 📚 API Reference

### **Complete API Documentation**

For detailed API documentation, see:
- [Model Management API](docs/api/model-management.md)
- [Dynamic Inference API](docs/api/dynamic-inference.md)
- [Database Schema](docs/database/schema.md)

### **SDK Examples**

#### **JavaScript/Node.js**
```javascript
import { ModelManager } from '@sdn-ids/model-manager';

const manager = new ModelManager({
  apiUrl: 'http://localhost:3001/api',
  token: 'your-auth-token'
});

// Upload model
await manager.uploadModel({
  name: 'My Model',
  type: 'RandomForest',
  files: ['model.joblib', 'scaler.joblib']
});

// Select model
await manager.selectModel('model-id', 'primary');

// Test model
const result = await manager.testModel('model-id', testData);
```

#### **Python**
```python
from sdn_ids_client import ModelManager

manager = ModelManager(
    api_url='http://localhost:3001/api',
    token='your-auth-token'
)

# Upload model
manager.upload_model(
    name='My Model',
    model_type='RandomForest',
    files=['model.joblib', 'scaler.joblib']
)

# Select model
manager.select_model('model-id', 'primary')

# Test model
result = manager.test_model('model-id', test_data)
```

## 🎉 Conclusion

The Model Management System provides a complete solution for managing ML models in the SDN-IDS project. It enables users to upload, select, and use their own models for attack detection while providing comprehensive tracking and analytics.

The system is designed to be:
- **User-friendly** - Intuitive interface for model management
- **Secure** - Robust security and access control
- **Scalable** - Handles multiple users and models
- **Performant** - Optimized for fast model loading and inference
- **Extensible** - Easy to add new features and capabilities

With this system, users have full control over their ML models and can easily deploy and manage them for network intrusion detection.


