# ml/Dockerfile - Python ML Container
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better Docker layer caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy ML model and inference script
COPY model.pkl .
COPY inference.py .
COPY test_data.json .

# Create a simple API server for ML predictions
COPY ml_server.py .

# Expose port for ML API
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:5000/health')" || exit 1

# Start ML server
CMD ["python", "ml_server.py"]