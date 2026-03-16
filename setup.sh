#!/usr/bin/env bash
# =============================================================================
# Bitcoin Mining Master — Local Setup Script
# =============================================================================
# Usage:
#   chmod +x setup.sh
#   ./setup.sh
#
# This script:
#   1. Checks required tools (Node.js, Docker, git)
#   2. Copies .env example files if .env files are missing
#   3. Installs npm dependencies for backend and frontend
#   4. Prints next-step instructions for Docker and testing
# =============================================================================

set -euo pipefail

# ── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helpers ──────────────────────────────────────────────────────────────────
info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Resolve script directory (project root) ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "=============================================="
echo "  Bitcoin Mining Master — Local Setup"
echo "=============================================="
echo ""

# ── 1. Check prerequisites ───────────────────────────────────────────────────
info "Checking prerequisites..."

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  success "Node.js found: $NODE_VER"
else
  error "Node.js is not installed. Install from https://nodejs.org or run: brew install node"
fi

# npm
if command -v npm &>/dev/null; then
  success "npm found: $(npm --version)"
else
  error "npm is not installed. It should come with Node.js."
fi

# Docker
if command -v docker &>/dev/null; then
  success "Docker CLI found: $(docker --version | head -n1)"
  if docker info &>/dev/null; then
    success "Docker daemon is running."
  else
    warn "Docker is installed but the daemon is NOT running. Start Docker Desktop before running 'docker compose up'."
  fi
else
  warn "Docker is not installed. Install Docker Desktop from https://www.docker.com/products/docker-desktop"
  warn "Docker is required to run MySQL, Redis, backend, and frontend containers."
fi

# git
if command -v git &>/dev/null; then
  success "git found: $(git --version)"
else
  warn "git not found. Install with: xcode-select --install"
fi

echo ""

# ── 2. VS Code 'code' command hint ───────────────────────────────────────────
if ! command -v code &>/dev/null; then
  warn "'code' command not found in PATH."
  echo ""
  echo "  To enable it, open VS Code and run:"
  echo "    Cmd + Shift + P  →  Shell Command: Install 'code' command in PATH"
  echo ""
  echo "  Or add it manually to ~/.zshrc (copy and paste this line):"
  # Use single quotes so the literal string $PATH is printed, not the expanded value
  echo '    export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"'
  echo ""
else
  success "'code' command is available: $(code --version | head -n1)"
fi

# ── 3. Copy backend .env ─────────────────────────────────────────────────────
info "Setting up backend environment file..."

if [ -f "backend/.env" ]; then
  success "backend/.env already exists. Skipping."
else
  if [ -f "backend/.env.example" ]; then
    cp "backend/.env.example" "backend/.env"
    success "Copied backend/.env.example → backend/.env"
    warn "IMPORTANT: Open backend/.env and set a strong JWT_SECRET."
    warn "  Generate one with: openssl rand -hex 32"
  else
    warn "backend/.env.example not found. Skipping backend .env setup."
  fi
fi

# ── 4. Copy frontend .env.local ───────────────────────────────────────────────
info "Setting up frontend environment file..."

if [ -f "web_frontend/.env.local" ]; then
  success "web_frontend/.env.local already exists. Skipping."
else
  if [ -f "web_frontend/.env.local.example" ]; then
    cp "web_frontend/.env.local.example" "web_frontend/.env.local"
    success "Copied web_frontend/.env.local.example → web_frontend/.env.local"
  else
    warn "web_frontend/.env.local.example not found. Skipping frontend .env setup."
  fi
fi

echo ""

# ── 5. Install backend dependencies ──────────────────────────────────────────
info "Installing backend npm dependencies..."
(cd backend && npm install)
success "Backend dependencies installed."

echo ""

# ── 6. Install frontend dependencies ─────────────────────────────────────────
info "Installing web frontend npm dependencies..."
(cd web_frontend && npm install --legacy-peer-deps)
success "Frontend dependencies installed."

echo ""

# ── 7. Summary & next steps ──────────────────────────────────────────────────
echo "=============================================="
echo "  Setup complete!"
echo "=============================================="
echo ""
echo "Next steps:"
echo ""
echo "  1. Review and update backend/.env"
echo "     (especially JWT_SECRET — use: openssl rand -hex 32)"
echo ""
echo "  2. Start all Docker services (requires Docker Desktop running):"
echo "     docker compose up -d"
echo ""
echo "  3. Check container status:"
echo "     docker compose ps"
echo ""
echo "  4. Run backend tests:"
echo "     cd backend && npm test"
echo "     # or inside the container:"
echo "     docker compose exec backend npm test"
echo ""
echo "  5. Open the project in VS Code:"
echo "     code ."
echo ""
echo "  Web dashboard → http://localhost:3000"
echo "  Backend API   → http://localhost:8888"
echo ""
