FROM node:20-alpine AS development

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci

# Install nodemon for development
RUN npm install -g nodemon

# Copy source (will be overridden by volume mount in docker-compose)
COPY backend/. ./

# Expose port
EXPOSE 3001

# Run server with nodemon for auto-reload
CMD ["nodemon", "server.js"]

# Production stage (optional)
FROM node:20-alpine AS production

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy source
COPY backend/. ./

# Expose port
EXPOSE 3001

# Run server in production mode
CMD ["node", "server.js"]