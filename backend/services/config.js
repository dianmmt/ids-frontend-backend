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
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    },
  },
};

export default config;
