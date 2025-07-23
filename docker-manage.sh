#!/bin/bash

# Claude Flow UI - Docker Management Script
# Uses modern Docker Compose v2 syntax

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

COMPOSE_FILE="docker-compose.dev.yml"
ENV_FILE=".env.docker"

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    fi
}

# Display usage information
usage() {
    echo "Claude Flow UI - Docker Management"
    echo ""
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  start     Start all services (default)"
    echo "  stop      Stop all services"
    echo "  restart   Restart all services"
    echo "  logs      Show logs for all services"
    echo "  logs-fe   Show frontend logs"
    echo "  logs-be   Show backend logs"
    echo "  build     Rebuild all images (with --no-cache)"
    echo "  rebuild   Force rebuild with no cache and restart"
    echo "  clean     Stop and remove all containers, networks, and volumes"
    echo "  status    Show service status"
    echo "  shell-fe  Open shell in frontend container"
    echo "  shell-be  Open shell in backend container"
    echo ""
}

# Start services
start_services() {
    check_docker
    
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "$ENV_FILE not found. Creating from template..."
        cp .env.docker.example "$ENV_FILE"
        print_warning "Please edit $ENV_FILE with your configuration before continuing."
        return 1
    fi
    
    print_status "Starting Claude Flow UI services..."
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up --build --no-deps --force-recreate -d
    
    sleep 5
    print_success "Services started successfully!"
    show_info
}

# Stop services
stop_services() {
    check_docker
    print_status "Stopping Claude Flow UI services..."
    docker compose -f "$COMPOSE_FILE" down
    print_success "Services stopped."
}

# Restart services
restart_services() {
    stop_services
    start_services
}

# Show logs
show_logs() {
    check_docker
    docker compose -f "$COMPOSE_FILE" logs -f
}

# Show frontend logs
show_frontend_logs() {
    check_docker
    docker compose -f "$COMPOSE_FILE" logs -f frontend
}

# Show backend logs
show_backend_logs() {
    check_docker
    docker compose -f "$COMPOSE_FILE" logs -f backend
}

# Build images
build_images() {
    check_docker
    print_status "Building Docker images with no cache..."
    docker compose -f "$COMPOSE_FILE" build --no-cache --parallel
    print_success "Images built successfully!"
}

# Force rebuild and restart
rebuild_all() {
    check_docker
    print_status "Force rebuilding and restarting all services..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans
    docker compose -f "$COMPOSE_FILE" build --no-cache --parallel
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d
    print_success "Services rebuilt and restarted!"
    show_info
}

# Clean up everything
clean_all() {
    check_docker
    print_warning "This will remove all containers, networks, and volumes."
    echo "Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_status "Cleaning up..."
        docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
        docker system prune -f
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Show service status
show_status() {
    check_docker
    echo "Service Status:"
    docker compose -f "$COMPOSE_FILE" ps
}

# Open shell in frontend container
shell_frontend() {
    check_docker
    print_status "Opening shell in frontend container..."
    docker compose -f "$COMPOSE_FILE" exec frontend /bin/sh
}

# Open shell in backend container
shell_backend() {
    check_docker
    print_status "Opening shell in backend container..."
    docker compose -f "$COMPOSE_FILE" exec backend /bin/sh
}

# Show application info
show_info() {
    echo ""
    echo "🚀 Claude Flow UI is running:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:3001"
    echo ""
    echo "📊 Useful commands:"
    echo "   View logs:    ./docker-manage.sh logs"
    echo "   Stop:         ./docker-manage.sh stop"
    echo "   Restart:      ./docker-manage.sh restart"
    echo ""
}

# Main script logic
case "${1:-help}" in
    build)
        build_images
        ;;
    start|up)
        start_services
        ;;
    rebuild)
        rebuild_all
        ;;
    stop|down)
        stop_services
        ;;
    logs)
        show_logs "${2:-all}"
        ;;
    status)
        show_status
        ;;
    info)
        show_info
        ;;
    restart)
        restart_services
        ;;
    clean)
        clean_all
        ;;
    help|*)
        show_usage
        ;;
esac
