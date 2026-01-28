#!/usr/bin/env bash
set -euo pipefail

# Configuration
BACKEND_PORT="${BACKEND_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
DB_NAME="laundry_services"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║         🧺 Laundry Services AI Platform                   ║"
echo "║                    Startup Script                          ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Navigate to project root
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_ROOT"

# Load environment variables from root .env if exists
if [ -f ".env" ]; then
  echo -e "${GREEN}==> Loading environment variables from .env...${NC}"
  export $(grep -v '^#' .env | xargs)
fi

# Set default DATABASE_URL if not provided
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo -e "${YELLOW}==> DATABASE_URL not set, using default...${NC}"
  DB_USER="${USER:-$(whoami)}"
  export DATABASE_URL="postgresql://${DB_USER}@localhost:5432/${DB_NAME}?schema=public"
fi
echo -e "   📊 DATABASE_URL: ${DATABASE_URL}"
echo ""

# ============ PORT CLEANUP ============
echo -e "${GREEN}==> Cleaning up processes on ports ${BACKEND_PORT} and ${FRONTEND_PORT}...${NC}"
for PORT in ${BACKEND_PORT} ${FRONTEND_PORT}; do
  if lsof -ti tcp:"${PORT}" >/dev/null 2>&1; then
    echo -e "   ${YELLOW}Found processes on port ${PORT}, killing them...${NC}"
    lsof -ti tcp:"${PORT}" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
done
echo -e "   ${GREEN}✅ Ports are clear${NC}"
echo ""

# ============ POSTGRESQL CHECK ============
echo -e "${GREEN}==> Checking PostgreSQL status...${NC}"
if ! command -v psql &> /dev/null; then
  echo -e "${YELLOW}   ⚠️  psql command not found. Assuming PostgreSQL is configured correctly.${NC}"
else
  # Try to connect to PostgreSQL server
  if ! psql -h localhost -c "SELECT 1;" postgres >/dev/null 2>&1 && \
     ! psql -c "SELECT 1;" postgres >/dev/null 2>&1; then
    echo ""
    echo -e "${RED}❌ ERROR: Cannot connect to PostgreSQL server.${NC}"
    echo ""
    echo "Please start PostgreSQL:"
    echo "  macOS:  brew services start postgresql"
    echo "  Linux:  sudo systemctl start postgresql"
    echo ""
    exit 1
  fi
  echo -e "   ${GREEN}✅ PostgreSQL server is running${NC}"

  # Create database if it doesn't exist
  echo ""
  echo -e "${GREEN}==> Ensuring database '${DB_NAME}' exists...${NC}"
  if ! psql -h localhost -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "${DB_NAME}" && \
     ! psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "${DB_NAME}"; then
    echo -e "   ${YELLOW}Creating database '${DB_NAME}'...${NC}"
    createdb "${DB_NAME}" 2>/dev/null || createdb -h localhost "${DB_NAME}" 2>/dev/null || {
      echo -e "${RED}Could not create database automatically.${NC}"
      echo "Please create it manually: createdb ${DB_NAME}"
      exit 1
    }
    echo -e "   ${GREEN}✅ Database created successfully!${NC}"
  else
    echo -e "   ${GREEN}✅ Database '${DB_NAME}' already exists${NC}"
  fi
fi
echo ""

# ============ BACKEND SETUP ============
echo -e "${GREEN}==> Setting up backend...${NC}"
cd "$PROJECT_ROOT/backend"

# Install backend dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo -e "   📦 Installing backend dependencies..."
  npm install
else
  echo -e "   ${GREEN}✅ Backend dependencies already installed${NC}"
fi

# Create/Update backend .env file
echo -e "   📝 Updating backend .env file..."
cat > .env << EOF
DATABASE_URL="${DATABASE_URL}"
JWT_SECRET="${JWT_SECRET:-laundry-services-jwt-secret-change-in-production-2024}"
PORT=${BACKEND_PORT}
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-your-openrouter-api-key}"
OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-3-haiku}"
NODE_ENV=development
EOF
echo -e "   ${GREEN}✅ Backend .env updated${NC}"

# Generate Prisma client
echo -e "   🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo -e "   📊 Running Prisma migrations..."
npx prisma db push 2>/dev/null || {
  echo -e "   ${YELLOW}Migration failed. Trying to create initial schema...${NC}"
  npx prisma db push --force-reset
}

# Check if database needs seeding
echo ""
echo -e "${GREEN}==> Checking if database needs seeding...${NC}"
CUSTOMER_COUNT=$(psql "${DATABASE_URL}" -t -c "SELECT COUNT(*) FROM \"Customer\";" 2>/dev/null | tr -d ' ' || echo "0")
if [ "${CUSTOMER_COUNT}" = "0" ] || [ -z "${CUSTOMER_COUNT}" ]; then
  echo -e "   ${YELLOW}Database appears empty. Running comprehensive seed...${NC}"
  npx prisma db push --force-reset --accept-data-loss
  npm run seed
else
  echo -e "   ${GREEN}✅ Database already contains data (${CUSTOMER_COUNT} customers)${NC}"
  echo -e "   ${YELLOW}   Tip: To reseed, run: cd backend && npm run seed${NC}"
fi
echo ""

# ============ FRONTEND SETUP ============
echo -e "${GREEN}==> Setting up frontend...${NC}"
cd "$PROJECT_ROOT/frontend"

# Install frontend dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  echo -e "   📦 Installing frontend dependencies..."
  npm install
else
  echo -e "   ${GREEN}✅ Frontend dependencies already installed${NC}"
fi
echo ""

# ============ CLEANUP FUNCTION ============
cleanup() {
  echo ""
  echo -e "${YELLOW}==> Shutting down servers...${NC}"
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  echo -e "${GREEN}✅ Servers stopped. Goodbye!${NC}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ============ START SERVERS ============
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║         🚀 Starting Laundry Services AI Platform          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Start backend server
echo -e "${GREEN}==> Starting backend server on port ${BACKEND_PORT}...${NC}"
cd "$PROJECT_ROOT/backend"
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend server
echo -e "${GREEN}==> Starting frontend server on port ${FRONTEND_PORT}...${NC}"
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!

# Wait for frontend to start
sleep 3

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                                                            ║"
echo "║         ✅ Application is running!                         ║"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║   🌐 Frontend:  http://localhost:${FRONTEND_PORT}                    ║"
echo "║   🔌 Backend:   http://localhost:${BACKEND_PORT}                     ║"
echo "║   📡 WebSocket: ws://localhost:${BACKEND_PORT}                       ║"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║   🔑 Quick Login Credentials (password: password123)       ║"
echo "║   ─────────────────────────────────────────────────────    ║"
echo "║   👑 Admin:    admin@laundry.com                          ║"
echo "║   📊 Manager:  manager@laundry.com                        ║"
echo "║   🚚 Driver:   driver1@laundry.com                        ║"
echo "║   👤 Customer: john.smith@email.com                       ║"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║   📝 Features:                                             ║"
echo "║   • Real-time order tracking (WebSocket)                   ║"
echo "║   • Route optimization for drivers                         ║"
echo "║   • AI demand forecasting                                  ║"
echo "║   • Quality issue reporting                                ║"
echo "║   • Driver mobile dashboard                                ║"
echo "║   • Subscription management                                ║"
echo "║                                                            ║"
echo "╠════════════════════════════════════════════════════════════╣"
echo "║                                                            ║"
echo "║   Press Ctrl+C to stop the servers                         ║"
echo "║                                                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
