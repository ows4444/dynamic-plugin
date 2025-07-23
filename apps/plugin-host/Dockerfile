# Multi-stage Dockerfile for Plugin Host Service
FROM node:18-alpine AS base

# Install dependencies for production builds
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/plugin-host/package*.json ./apps/plugin-host/
COPY libs/shared/common/package*.json ./libs/shared/common/
COPY libs/shared/plugin-sdk/package*.json ./libs/shared/plugin-sdk/
COPY libs/shared/plugin-types/package*.json ./libs/shared/plugin-types/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development stage
FROM base AS development
# Install all dependencies including dev
RUN npm ci
# Copy source code
COPY . .
# Expose development ports
EXPOSE 3001
EXPOSE 9229
CMD ["npm", "run", "start:dev"]

# Build stage
FROM base AS builder
# Install all dependencies for building
RUN npm ci
# Copy source code
COPY . .
# Build the application
RUN npm run build:plugin-host
# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package*.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/plugins /app/storage && \
    chown -R nestjs:nodejs /app/logs /app/plugins /app/storage

# Switch to non-root user
USER nestjs

# Set environment variables
ENV NODE_ENV=production
ENV SERVICE_NAME=plugin-host
ENV PORT=3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Expose port
EXPOSE 3001

# Start the application
CMD ["node", "dist/apps/plugin-host/main.js"]