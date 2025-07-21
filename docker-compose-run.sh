#!/bin/bash

# Docker Compose script for Claude Flow UI

case "$1" in
    "up")
        echo "Starting Claude Flow UI with Docker Compose..."
        docker compose up -d --build --no-cache
        echo "Container started! Access the application at http://localhost:9001"
        ;;
    "down")
        echo "Stopping Claude Flow UI..."
        docker compose down
        echo "Container stopped and removed."
        ;;
    "logs")
        echo "Showing logs..."
        docker compose logs -f
        ;;
    "build")
        echo "Building with Docker Compose..."
        docker compose build --no-cache
        ;;
    "restart")
        echo "Restarting Claude Flow UI..."
        docker compose down
        docker compose up -d --build --no-cache
        ;;
    *)
        echo "Usage: $0 {up|down|logs|build|restart}"
        echo ""
        echo "Commands:"
        echo "  up      - Start the application"
        echo "  down    - Stop and remove the application"
        echo "  logs    - Show application logs"
        echo "  build   - Build the Docker image"
        echo "  restart - Restart the application"
        exit 1
        ;;
esac
