#!/bin/bash

# Blokhouse Installation Script
# This script sets up and starts the Blokhouse CMDB with Docker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║                                       ║"
echo "║   Blokhouse CMDB Installation         ║"
echo "║                                       ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check if Docker is installed
info "Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    error "Docker is not installed!"
    echo ""
    echo "Please install Docker first:"
    echo "  https://docs.docker.com/get-docker/"
    exit 1
fi
success "Docker is installed ($(docker --version | cut -d ' ' -f3 | tr -d ','))"

# Check if Docker Compose is available
info "Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    error "Docker Compose is not available!"
    echo ""
    echo "Please install Docker Compose:"
    echo "  https://docs.docker.com/compose/install/"
    exit 1
fi
success "Docker Compose is available ($(docker compose version --short))"

# Check if Docker daemon is running
info "Checking Docker daemon..."
if ! docker info &> /dev/null; then
    error "Docker daemon is not running!"
    echo ""
    echo "Please start Docker and try again."
    exit 1
fi
success "Docker daemon is running"

# Check if .env file exists, if not create from .env.example (if available)
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        info "Creating .env file from .env.example..."
        cp .env.example .env
        success ".env file created"
        warning "Please review and update .env with your settings if needed"
    else
        info "No .env or .env.example found (using docker-compose defaults)"
    fi
else
    success ".env file already exists"
fi

echo ""
info "Starting Blokhouse with Docker Compose..."
echo ""

# Start Docker Compose
if docker compose up -d --build; then
    echo ""
    success "Blokhouse is starting up!"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo -e "  🎉 Installation complete!"
    echo ""
    echo -e "  ${BLUE}Access Blokhouse at:${NC}"
    echo -e "  👉 ${GREEN}http://localhost:3000${NC}"
    echo ""
    echo -e "  ${BLUE}Default login:${NC}"
    echo -e "  📧 Email:    ${YELLOW}admin@example.com${NC}"
    echo -e "  🔑 Password: ${YELLOW}admin${NC}"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    warning "Note: Database migrations may take a moment on first start."
    warning "If the app doesn't respond, wait 30 seconds and try again."
    echo ""
    info "View logs: ${YELLOW}docker compose logs -f${NC}"
    info "Stop: ${YELLOW}docker compose down${NC}"
    echo ""
else
    echo ""
    error "Failed to start Docker Compose!"
    echo ""
    echo "Check the logs with: docker compose logs"
    exit 1
fi
