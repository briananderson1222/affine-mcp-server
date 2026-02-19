FROM node:20-alpine

WORKDIR /app

# Install git, clone the repo with tag support
RUN apk add --no-cache git && \
    git clone https://github.com/briananderson1222/affine-mcp-server.git /app/affine-mcp-server

WORKDIR /app/affine-mcp-server

# Install dependencies and build
RUN npm install && npm run build

# Install mcp-proxy globally in /app
RUN cd /app && npm install mcp-proxy

# Copy custom start script
COPY start-custom.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose the default port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Start the server
CMD ["/app/start.sh"]