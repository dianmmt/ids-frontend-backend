# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS development

WORKDIR /app
# Allow overriding npm registry and proxies at build time
ARG NPM_REGISTRY=https://registry.npmjs.org
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

# Improve npm resilience in CI/containers
ENV NPM_CONFIG_REGISTRY=${NPM_REGISTRY} \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_NETWORK_TIMEOUT=600000

COPY frontend/package*.json ./
# Use BuildKit cache to avoid re-downloading deps on every build
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund
COPY frontend/. ./

# Install Vite cho development
RUN npm install -g vite

# Expose port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]

# Production build (giữ nguyên)
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=development /app .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]