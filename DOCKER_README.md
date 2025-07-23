# Docker Setup for Claude Flow UI

This setup uses **Docker Compose v2** to run the Claude Flow UI application with separate containers for the frontend and backend.

## Prerequisites

- Docker Desktop with Docker Compose v2 support
- Access to the Sensu PostgreSQL database

## Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.docker.example .env.docker
   ```

2. **Edit the environment file:**
   ```bash
   nano .env.docker
   ```
   
   Update these required variables:
   - `DB_USER` - Your Sensu database username
   - `DB_PASSWORD` - Your Sensu database password
   - `ANTHROPIC_API_KEY` - Your Anthropic API key

3. **Start the application:**
   ```bash
   ./docker-manage.sh start
   ```

4. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## Management Commands

The `docker-manage.sh` script provides easy management:

```bash
# Start services
./docker-manage.sh start

# Stop services
./docker-manage.sh stop

# Restart services
./docker-manage.sh restart

# View logs
./docker-manage.sh logs
./docker-manage.sh logs-fe    # Frontend only
./docker-manage.sh logs-be    # Backend only

# Rebuild images
./docker-manage.sh build

# Check status
./docker-manage.sh status

# Open shell in containers
./docker-manage.sh shell-fe   # Frontend container
./docker-manage.sh shell-be   # Backend container

# Clean up everything
./docker-manage.sh clean
```

## Architecture

- **Frontend Container**: React development server (port 3000)
- **Backend Container**: Express.js API server (port 3001)
- **Database**: Connects to existing Sensu PostgreSQL database

## Environment Variables

Key environment variables in `.env.docker`:

### Database Configuration
- `DB_HOST` - Database hostname
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name
- `DB_USER` - Database username
- `DB_PASSWORD` - Database password

### Authentication
- `JWT_SECRET` - Secret key for JWT tokens
- `VISUALIZEHR_SALT` - Salt for password hashing

### API Keys
- `ANTHROPIC_API_KEY` - Anthropic Claude API key

## Troubleshooting

### Port Conflicts
If ports 3000 or 3001 are already in use:
1. Stop any local development servers
2. Or modify the ports in `docker-compose.dev.yml`

### Database Connection Issues
1. Verify database credentials in `.env.docker`
2. Check network connectivity to the Sensu database
3. View backend logs: `./docker-manage.sh logs-be`

### Docker Issues
1. Ensure Docker Desktop is running
2. Try rebuilding: `./docker-manage.sh build`
3. Clean and restart: `./docker-manage.sh clean && ./docker-manage.sh start`

## File Structure

```
├── docker-compose.dev.yml    # Docker Compose configuration
├── Dockerfile.frontend       # Frontend container definition
├── Dockerfile.backend        # Backend container definition
├── .env.docker.example       # Environment template
├── .env.docker               # Your environment config (create this)
├── docker-manage.sh          # Management script
└── docker-start.sh           # Simple startup script
```

## Development Notes

- The containers mount the local source code as volumes for hot reloading
- Frontend proxy configuration routes `/api/*` to the backend container
- Both containers use Alpine Linux for smaller image sizes
- PostgreSQL client tools are available in the backend container for debugging
