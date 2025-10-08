import dotenv from 'dotenv';

dotenv.config();

const config = {
  database: {
    user: process.env.DB_USER || 'sdn_user',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'sdn_ids',
    password: process.env.DB_PASSWORD || 'sdn_password',
    port: process.env.DB_PORT || 5432,
  },
  security: {
    jwt: {
      secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
      expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    },
    bcrypt: {
      saltRounds: 12,
    },
  },
  server: {
    port: process.env.PORT || 3001,
    cors: {
      // Support comma-separated origins in CORS_ORIGIN, fallback to common dev ports
      // Include Docker container origins and localhost variants
      // For development, be more permissive with localhost and container origins
      origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://127.0.0.1:3000,http://127.0.0.1:5173,http://192.168.163.156:3000,http://192.168.163.156:5173')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
    },
  },
  ml: {
    service: {
      port: process.env.ML_SERVICE_PORT || 5000,
      host: process.env.ML_SERVICE_HOST || 'localhost',
      // Timeout cho việc chờ model upload từ máy khác (milliseconds)
      uploadTimeout: parseInt(process.env.ML_UPLOAD_TIMEOUT) || 5000, // 5 giây thay vì 30 giây
      // Model mặc định khi không có model từ database hoặc upload quá lâu
      defaultModel: {
        name: 'random_forest_full_best',
        modelFile: 'random_forest_full_best_model_1456_samples.pkl',
        scalerFile: 'scaler.pkl',
        encoderFile: 'label_encoder.pkl'
      }
    }
  },
 
};

export default config;