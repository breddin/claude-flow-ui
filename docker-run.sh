#!/bin/bash

# Build and run Claude Flow UI in Docker on port 9001

echo "Building Docker image..."
docker build -t claude-flow-ui .

echo "Running container on port 9001..."
docker run -d -p 9001:9001 --name claude-flow-ui claude-flow-ui

echo "Container started! Access the application at http://localhost:9001"
echo ""
echo "To stop the container, run: docker stop claude-flow-ui"
echo "To remove the container, run: docker rm claude-flow-ui"
echo "Alternative: Use 'docker compose up -d' to run with Docker Compose"
