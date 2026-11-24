#!/bin/bash

# Blokhouse Installation Script
# Node.js-based installation (no Docker required)

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
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

step() {
    echo -e "${CYAN}➜${NC} $1"
}

# Banner
echo -e "${MAGENTA}"
cat << "EOF"
╔═══════════════════════════════════════════╗
║                                           ║
║     🏠 Blokhouse CMDB Installation        ║
║        Node.js Edition (No Docker)        ║
║                                           ║
╚═══════════════════════════════════════════╝
EOF
echo -e "${NC}"

INSTALL_DIR="/opt/blokhouse"
REPO_URL="https://github.com/d4sw4r/blokhouse.git"

# Check if Node.js is installed
info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    error "Node.js is not installed!"
    echo ""
    echo "Please install Node.js >= 22:"
    echo "  https://nodejs.org/en/download/"
    echo ""
    echo "Or via package manager:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
    error "Node.js version must be >= 22 (current: $(node -v))"
    exit 1
fi
success "Node.js is installed ($(node -v))"

# Check if npm is installed
info "Checking npm installation..."
if ! command -v npm &> /dev/null; then
    error "npm is not installed!"
    exit 1
fi
success "npm is installed ($(npm -v))"

# Check if git is installed
info "Checking git installation..."
if ! command -v git &> /dev/null; then
    error "git is not installed!"
    echo ""
    echo "Please install git: sudo apt-get install git"
    exit 1
fi
success "git is installed"

# Clone or update repository
if [ -d "$INSTALL_DIR" ]; then
    step "Updating existing installation in $INSTALL_DIR..."
    cd "$INSTALL_DIR"
    git fetch origin
    git reset --hard origin/main
    git pull origin main
    success "Repository updated"
else
    step "Cloning repository to $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    success "Repository cloned"
fi

cd "$INSTALL_DIR"

# Install dependencies
step "Installing Node.js dependencies..."
npm install
success "Dependencies installed"

# Database: PostgreSQL is required.
# Either pass DATABASE_URL (e.g. DATABASE_URL=postgresql://user:pass@host:5432/blokhouse),
# or let the installer create a local database if PostgreSQL runs on this host.
if [ -f "$INSTALL_DIR/.env" ]; then
    warning ".env file already exists, keeping it"
else
    step "Creating .env configuration..."
    if [ -z "${DATABASE_URL:-}" ]; then
        if command -v psql &> /dev/null && id postgres &> /dev/null; then
            DB_PASSWORD=$(openssl rand -hex 16)
            step "Creating local PostgreSQL role and database 'blokhouse'..."
            if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = 'blokhouse'" | grep -q 1; then
                sudo -u postgres psql -q -v ON_ERROR_STOP=1 -c "ALTER ROLE blokhouse PASSWORD '$DB_PASSWORD'"
            else
                sudo -u postgres psql -q -v ON_ERROR_STOP=1 -c "CREATE ROLE blokhouse LOGIN PASSWORD '$DB_PASSWORD'"
            fi
            sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = 'blokhouse'" | grep -q 1 \
                || sudo -u postgres createdb -O blokhouse blokhouse
            DATABASE_URL="postgresql://blokhouse:$DB_PASSWORD@localhost:5432/blokhouse"
            success "Local database created"
        else
            error "PostgreSQL is required."
            echo ""
            echo "Either install PostgreSQL on this host (e.g. sudo apt-get install postgresql) and re-run,"
            echo "or pass an existing database:"
            echo "  curl -sSL https://raw.githubusercontent.com/d4sw4r/blokhouse/main/install.sh | \\"
            echo "    sudo DATABASE_URL=postgresql://user:pass@host:5432/blokhouse bash"
            exit 1
        fi
    fi
    NEXTAUTH_SECRET=$(openssl rand -hex 32)
    (
        umask 077
        {
            echo "# Blokhouse Configuration"
            echo "NEXTAUTH_SECRET=$NEXTAUTH_SECRET"
            echo "NEXTAUTH_URL=http://localhost:3000"
            echo "DATABASE_URL=$DATABASE_URL"
        } > "$INSTALL_DIR/.env"
    )
    success ".env file created"
fi

# Apply database migrations
step "Applying database migrations..."
set -a && source "$INSTALL_DIR/.env" && set +a
npx prisma migrate deploy
success "Database is up to date"

# Seed the initial admin (only if no admin exists yet)
step "Ensuring an admin user exists..."
PASSWORD_FILE="$INSTALL_DIR/data/initial-admin-password"
ADMIN_PASSWORD_FILE="$PASSWORD_FILE" npx prisma db seed
success "Admin user ready"

# Build the application
step "Building Next.js application..."
npm run build
success "Application built"

# Stop existing instance if running
if [ -f "$INSTALL_DIR/.app.pid" ]; then
    OLD_PID=$(cat "$INSTALL_DIR/.app.pid")
    if ps -p "$OLD_PID" > /dev/null 2>&1; then
        step "Stopping existing Blokhouse instance (PID: $OLD_PID)..."
        kill "$OLD_PID" || true
        sleep 2
        success "Old instance stopped"
    fi
    rm -f "$INSTALL_DIR/.app.pid"
fi

# Start the application
step "Starting Blokhouse..."
npm start > /dev/null 2>&1 &
APP_PID=$!
echo "$APP_PID" > "$INSTALL_DIR/.app.pid"
success "Application started (PID: $APP_PID)"

# Wait a moment for the app to start
sleep 3

# Check if process is still running
if ! ps -p "$APP_PID" > /dev/null 2>&1; then
    error "Application failed to start! Check logs."
    exit 1
fi

# Success message
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  ${MAGENTA}🎉 Installation Complete!${NC}"
echo ""
echo -e "  ${BLUE}Access Blokhouse at:${NC}"
echo -e "  👉 ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "  ${BLUE}Login:${NC}"
echo -e "  📧 Email:    ${YELLOW}admin@example.com${NC}"
if [ -f "$PASSWORD_FILE" ]; then
    echo -e "  🔑 Password: ${GREEN}sudo cat $PASSWORD_FILE${NC}"
    echo ""
    echo -e "  ${RED}⚠  Delete that file after your first login.${NC}"
else
    echo -e "  🔑 Password: unchanged (admin already existed)"
fi
echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
info "Application is running in the background (PID: $APP_PID)"
info "Installation directory: ${CYAN}$INSTALL_DIR${NC}"
echo ""
echo -e "${BLUE}Useful commands:${NC}"
echo -e "  View logs:     ${YELLOW}tail -f $INSTALL_DIR/logs/*.log${NC}"
echo -e "  Stop app:      ${YELLOW}kill \$(cat $INSTALL_DIR/.app.pid)${NC}"
echo -e "  Restart:       ${YELLOW}cd $INSTALL_DIR && npm start &${NC}"
echo ""
