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
      origin: (process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:3000,http://frontend:5173,http://sdn_ids_frontend:5173,http://127.0.0.1:3000,http://127.0.0.1:5173')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean),
    },
  },
};

export default config;
