#!/bin/bash

# Claude Flow UI - Docker Startup Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Check if .env.docker exists
if [ ! -f .env.docker ]; then
    print_warning ".env.docker file not found. Creating from template..."
    cp .env.docker.example .env.docker
    print_warning "Please edit .env.docker with your database credentials and API keys before continuing."
    print_warning "Required variables: DB_USER, DB_PASSWORD, ANTHROPIC_API_KEY"
    echo ""
    echo "Would you like to edit .env.docker now? (y/n)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        ${EDITOR:-nano} .env.docker
    else
        print_warning "Remember to edit .env.docker before running the application."
    fi
fi

print_status "Starting Claude Flow UI with Docker..."

# Stop any existing containers
print_status "Stopping existing containers..."
docker compose -f docker-compose.dev.yml --env-file .env.docker down

# Build and start services
print_status "Building and starting services..."
docker compose -f docker-compose.dev.yml --env-file .env.docker up --build --no-deps --force-recreate -d

# Wait for services to be ready
print_status "Waiting for services to start..."
sleep 10

# Check if services are running
if docker compose -f docker-compose.dev.yml ps | grep -q "Up"; then
    print_success "Services started successfully!"
    echo ""
    echo "🚀 Claude Flow UI is now running:"
    echo "   Frontend: http://localhost:3000"
    echo "   Backend:  http://localhost:3001"
    echo ""
    echo "📊 To view logs:"
    echo "   Frontend: docker compose -f docker-compose.dev.yml logs -f frontend"
    echo "   Backend:  docker compose -f docker-compose.dev.yml logs -f backend"
    echo ""
    echo "🛑 To stop services:"
    echo "   docker compose -f docker-compose.dev.yml down"
else
    print_error "Failed to start services. Check the logs:"
    docker compose -f docker-compose.dev.yml logs
    exit 1
fi
