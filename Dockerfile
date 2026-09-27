# Multi-stage Dockerfile for Student Calendar with Events
FROM node:20-alpine AS builder

# Install build dependencies for C compilation
RUN apk add --no-cache gcc musl-dev make

WORKDIR /app

# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source files
COPY . .

# Compile C-Core binary for Linux x86_64
RUN gcc -Wall -Wextra -O2 c-core/calendar.c -o c-core/calendar_core

# Expose port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start server
CMD ["node", "backend/server.js"]
