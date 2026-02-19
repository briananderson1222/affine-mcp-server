FROM node:20-alpine

WORKDIR /app

# Install git and clone the repo with tag support
RUN apk add --no-cache git && \
    git clone https://github.com/briananderson1222/affine-mcp-server.git /app/affine-mcp-server

WORKDIR /app/affine-mcp-server

# Install dependencies and build
RUN npm install && npm run build

# Copy startup script to root app folder
COPY start.sh /app/

# Make start script executable
RUN chmod +x /app/start.sh

# Update start.sh to point to the right location
RUN sed -i 's|./node_modules/.bin/affine-mcp|/app/affine-mcp-server/node_modules/.bin/affine-mcp|g' /app/start.sh

# Expose the default port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the server
CMD ["/app/start.sh"]