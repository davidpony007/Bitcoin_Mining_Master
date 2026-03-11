#!/usr/bin/env bash
# =============================================================================
#  setup-mac.sh — Bitcoin Mining Master dev-environment bootstrap (macOS)
#
#  Usage:
#    chmod +x scripts/setup-mac.sh
#    ./scripts/setup-mac.sh
#
#  What it does:
#    1. Verifies prerequisites (Homebrew, Node 20, Docker, Git, Java ≥17)
#    2. Installs/updates Homebrew packages as needed
#    3. Copies .env example files if the real ones are missing
#    4. Installs backend & frontend npm dependencies
#    5. Starts Docker containers via docker compose
#    6. Verifies GitHub remote connectivity
# =============================================================================

set -euo pipefail

# ── helpers ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Colour

ok()   { echo -e "${GREEN}✔  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
fail() { echo -e "${RED}✘  $*${NC}"; exit 1; }
hdr()  { echo -e "\n${BOLD}── $* ────────────────────────────────────────────${NC}"; }

# Resolve the project root regardless of where this script is called from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"
echo -e "${BOLD}Bitcoin Mining Master — macOS dev-environment setup${NC}"
echo -e "Project root: ${PROJECT_ROOT}\n"

# ── 0. macOS app quarantine guard ────────────────────────────────────────────
hdr "0. macOS read-only / quarantine check"
if [[ "$PROJECT_ROOT" == */Downloads/* || "$PROJECT_ROOT" == */Volumes/* ]]; then
  warn "VS Code / this project appears to be running from a read-only location."
  warn "Please move the project folder out of Downloads (or remove quarantine):"
  echo  "    xattr -r -d com.apple.quarantine /path/to/Bitcoin_Mining_Master"
  warn "Then re-open VS Code from the new location."
else
  ok "Project is in a writable location."
fi

# ── 1. Homebrew ───────────────────────────────────────────────────────────────
hdr "1. Homebrew"
if ! command -v brew &>/dev/null; then
  warn "Homebrew not found. Installing…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi
ok "Homebrew $(brew --version | head -1)"

# ── 2. Node.js 20 ────────────────────────────────────────────────────────────
hdr "2. Node.js ≥20"
if ! command -v node &>/dev/null; then
  warn "Node.js not found. Installing via nvm (recommended)…"
  if ! command -v nvm &>/dev/null 2>&1; then
    brew install nvm
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$(brew --prefix nvm)/nvm.sh" ] && source "$(brew --prefix nvm)/nvm.sh"
  fi
  nvm install 20
  nvm use 20
fi
NODE_VER=$(node --version)
NODE_MAJOR="${NODE_VER#v}"; NODE_MAJOR="${NODE_MAJOR%%.*}"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  warn "Node.js $NODE_VER found but ≥20 is recommended."
  warn "Run: nvm install 20 && nvm use 20"
else
  ok "Node.js $NODE_VER"
fi
ok "npm $(npm --version)"

# ── 3. Java ≥17 (for Android / mobile builds) ────────────────────────────────
hdr "3. Java ≥17 (Android / Gradle)"
if ! command -v java &>/dev/null; then
  warn "Java not found. Installing Temurin 17 via Homebrew…"
  brew install --cask temurin@17
fi
JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/{print $2}')
JAVA_MAJOR="${JAVA_VER%%.*}"
# Handle "1.8" style versions
[[ "$JAVA_MAJOR" == "1" ]] && JAVA_MAJOR=$(echo "$JAVA_VER" | cut -d. -f2)
if [[ "$JAVA_MAJOR" -lt 17 ]]; then
  warn "Java $JAVA_VER found but ≥17 is required for Gradle (Android mobile)."
  warn "Install Temurin 17: brew install --cask temurin@17"
  warn "Then set JAVA_HOME in your shell profile:"
  echo  "    export JAVA_HOME=\$(/usr/libexec/java_home -v 17)"
else
  ok "Java $JAVA_VER"
  if [[ -z "${JAVA_HOME:-}" ]]; then
    warn "JAVA_HOME is not set. Add to your shell profile (~/.zshrc or ~/.bash_profile):"
    echo "    export JAVA_HOME=\$(/usr/libexec/java_home)"
  else
    ok "JAVA_HOME=$JAVA_HOME"
  fi
fi

# ── 4. Docker ─────────────────────────────────────────────────────────────────
hdr "4. Docker"
if ! command -v docker &>/dev/null; then
  warn "Docker CLI not found."
  warn "Install Docker Desktop from: https://docs.docker.com/desktop/mac/"
  fail "Please install Docker Desktop and re-run this script."
fi
if ! docker info &>/dev/null; then
  warn "Docker daemon is not running."
  warn "Please start Docker Desktop and wait until the whale icon is steady."
  fail "Docker is not running — cannot continue."
fi
ok "Docker $(docker --version)"

# ── 5. Git ────────────────────────────────────────────────────────────────────
hdr "5. Git"
if ! command -v git &>/dev/null; then
  brew install git
fi
ok "Git $(git --version)"

# ── 6. Environment variable files ────────────────────────────────────────────
hdr "6. Environment files (.env)"

if [[ ! -f backend/.env ]]; then
  warn "backend/.env not found — copying from backend/.env.example"
  cp backend/.env.example backend/.env
  warn "ACTION REQUIRED: Edit backend/.env and set:"
  echo "   • JWT_SECRET  (run: openssl rand -hex 32)"
  echo "   • DB_PASS     (if your MySQL has a password)"
  echo "   • Any other secrets"
else
  ok "backend/.env exists"
fi

if [[ ! -f web_frontend/.env.local ]]; then
  warn "web_frontend/.env.local not found — copying from web_frontend/.env.local.example"
  cp web_frontend/.env.local.example web_frontend/.env.local
  ok "web_frontend/.env.local created (defaults point to localhost:8888)"
else
  ok "web_frontend/.env.local exists"
fi

# ── 7. Backend dependencies ───────────────────────────────────────────────────
hdr "7. Backend npm dependencies"
# --legacy-peer-deps: some transitive deps (e.g. bull) declare peer
# dependencies that npm 7+ rejects by default; this flag matches the
# behaviour of npm 6 and keeps the install non-interactive.
(cd backend && npm install --legacy-peer-deps)
ok "backend/node_modules installed"

# ── 8. Frontend dependencies ──────────────────────────────────────────────────
hdr "8. Frontend npm dependencies"
# --legacy-peer-deps: react-resizable and echarts-for-react have peer dep
# conflicts against react 18; flag allows install without manual overrides.
(cd web_frontend && npm install --legacy-peer-deps)
ok "web_frontend/node_modules installed"

# ── 9. Docker containers ──────────────────────────────────────────────────────
hdr "9. Docker containers (docker compose)"
echo "Using docker-compose.yml (local dev stack)"
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build
ok "Containers started:"
docker compose ps

# ── 10. GitHub remote connectivity ────────────────────────────────────────────
hdr "10. GitHub remote"
REMOTE_URL=$(git remote get-url origin 2>/dev/null || echo "")
if [[ -z "$REMOTE_URL" ]]; then
  warn "No 'origin' remote found."
else
  ok "origin → $REMOTE_URL"
  if git ls-remote --exit-code origin &>/dev/null; then
    ok "GitHub remote is reachable (push/pull ready)"
  else
    warn "Cannot reach GitHub remote — check your SSH key or Personal Access Token."
    echo "  SSH:  ssh -T git@github.com"
    echo "  HTTPS: gh auth login"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Setup complete!  Next steps:${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════${NC}"
echo ""
echo "  1. Open VS Code in the project root:"
echo "     code ."
echo "     → Accept the prompt to install recommended extensions."
echo ""
echo "  2. Verify services are healthy:"
echo "     docker compose ps"
echo ""
echo "  3. Run backend tests:"
echo "     cd backend && npm test"
echo ""
echo "  4. Run frontend lint + format check:"
echo "     cd web_frontend && npm run lint && npm run format"
echo ""
echo "  5. Open the app:"
echo "     Frontend: http://localhost:3000"
echo "     Backend:  http://localhost:8888/api/health"
echo ""
echo "  Troubleshooting:"
echo "  • JDK 17 error in VS Code → install Temurin 17:"
echo "    brew install --cask temurin@17"
echo "    export JAVA_HOME=\$(/usr/libexec/java_home -v 17)"
echo "  • VS Code 'read-only volume' error → move app out of Downloads:"
echo "    Drag Visual Studio Code.app to /Applications/. If quarantine blocks"
echo "    opening after the move, run:"
echo "    xattr -r -d com.apple.quarantine /Applications/Visual\\ Studio\\ Code.app"
echo "  • Copilot 400 Bad Request → sign out & sign back in via"
echo "    VS Code > Accounts (bottom-left) > Sign in with GitHub"
echo ""
