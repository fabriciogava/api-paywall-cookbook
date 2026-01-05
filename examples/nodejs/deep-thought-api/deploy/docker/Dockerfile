# Deep Thought API - Docker Deployment
# 
# Build: docker build -f deploy/docker/Dockerfile -t deep-thought-api .
# Run:   docker run -p 3000:3000 -e RESOURCE_WALLET_ADDRESS=your-wallet deep-thought-api

FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci

# Copy source code
COPY src/ ./src/
COPY deploy/node/ ./deploy/node/
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Copy package files for production install
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV FACILITATOR_URL=https://gateway.kobaru.io

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the server
CMD ["node", "dist/deploy/node/server.js"]
