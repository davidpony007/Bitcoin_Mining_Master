# Bitcoin Mining Master

A full-stack Bitcoin mining simulator application, including a Node.js backend API, React + TypeScript web dashboard, and a Flutter mobile client.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1 — Enable the `code` Command in Terminal](#step-1--enable-the-code-command-in-terminal)
- [Step 2 — Move VS Code Out of Downloads (macOS)](#step-2--move-vs-code-out-of-downloads-macos)
- [Step 3 — Clone the Repository & Open in VS Code](#step-3--clone-the-repository--open-in-vs-code)
- [Step 4 — Restore Environment Files](#step-4--restore-environment-files)
- [Step 5 — Install Dependencies](#step-5--install-dependencies)
- [Step 6 — Start Docker Containers](#step-6--start-docker-containers)
- [Step 7 — Run Tests](#step-7--run-tests)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Prerequisites

Make sure the following are installed before getting started:

| Tool | Version | Install |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | 18 or 20 LTS | `brew install node` or https://nodejs.org |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Latest | https://www.docker.com/products/docker-desktop |
| [VS Code](https://code.visualstudio.com/) | Latest | https://code.visualstudio.com |
| [Git](https://git-scm.com/) | Any | `xcode-select --install` |

---

## Step 1 — Enable the `code` Command in Terminal

If you type `code .` in the terminal and get:

```
zsh: command not found: code
```

follow these steps to install the VS Code shell command:

1. **Open VS Code** (from Launchpad or `/Applications/Visual Studio Code.app`)
2. Press **`Cmd + Shift + P`** to open the Command Palette
3. Type and select:
   ```
   Shell Command: Install 'code' command in PATH
   ```
4. **Close the current terminal window** and open a new one
5. Verify it works:
   ```bash
   code --version
   ```

> **Alternative — add manually to your shell profile:**
> ```bash
> # For zsh (default on macOS Ventura/Sonoma/Sequoia)
> echo 'export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"' >> ~/.zshrc
> source ~/.zshrc
> ```
> *(Single-quoted so that `$PATH` is written literally to the file and expanded at shell startup.)*
> Then re-run `code --version` to confirm.

---

## Step 2 — Move VS Code Out of Downloads (macOS)

If VS Code shows a notification:
> *"Cannot update while running on a read-only volume. Please move the application out of the Downloads directory."*

This means VS Code is still in your `~/Downloads` folder instead of `/Applications`. Fix it:

1. Quit VS Code completely (`Cmd + Q`)
2. Open **Finder** → go to `~/Downloads`
3. Drag **`Visual Studio Code.app`** to the **Applications** folder
4. Open VS Code from **Applications** (or Spotlight: `Cmd + Space` → "Visual Studio Code")
5. Re-run [Step 1](#step-1--enable-the-code-command-in-terminal) to reinstall the shell command

---

## Step 3 — Clone the Repository & Open in VS Code

```bash
# Clone the repository
git clone https://github.com/davidpony007/Bitcoin_Mining_Master.git

# Enter the project directory
cd Bitcoin_Mining_Master

# Open in VS Code
code .
```

If `code` is not yet available, open VS Code manually and use:
**File → Open Folder…** → select the `Bitcoin_Mining_Master` folder.

---

## Step 4 — Restore Environment Files

The project uses `.env` files for configuration. These are not committed to Git for security reasons. Copy the provided examples and fill in your values:

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and set at minimum:

```env
JWT_SECRET=<generate with: openssl rand -hex 32>
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=bitcoin_mining_master
DB_USER=root
DB_PASS=
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

> When using Docker Compose, `DB_HOST` should be `mysql` and `REDIS_HOST` should be `redis` (service names).

### Web Frontend

```bash
cd web_frontend
cp .env.local.example .env.local
```

The default `.env.local` points to `http://localhost:8888/api` which works with the Docker setup.

---

## Step 5 — Install Dependencies

### Backend

```bash
cd backend
npm install
```

### Web Frontend

```bash
cd web_frontend
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required due to some peer dependency conflicts between React 18 and certain Ant Design packages.

---

## Step 6 — Start Docker Containers

Make sure **Docker Desktop is running** before executing any `docker` commands.

### Start all services (recommended for local development)

```bash
# From the project root
docker compose up -d
```

This starts:
- **MySQL 8.0** on port `3306`
- **Redis 6** on port `6379`
- **Backend API** on port `8888`
- **Web Frontend** (Vite dev server) on port `3000`

### Check container status

```bash
docker compose ps
```

All containers should show `Up` (healthy).

### View logs

```bash
# All services
docker compose logs -f

# Single service
docker compose logs -f backend
docker compose logs -f mysql
```

### Stop containers

```bash
docker compose down
```

> **Note:** If the backend fails to start, check that the `.env` file is present inside `backend/` (see [Step 4](#step-4--restore-environment-files)).

---

## Step 7 — Run Tests

### Backend Tests (Jest)

```bash
cd backend
npm test
```

Or, if Docker containers are running (recommended — tests need a real DB/Redis):

```bash
docker compose exec backend npm test
```

### Individual test files

```bash
cd backend
npx jest test/auth.test.js
npx jest test/user.test.js
npx jest test/userStatus.test.js
npx jest test/public.test.js
```

### Web Frontend Lint

```bash
cd web_frontend
npm run lint
```

---

## Troubleshooting

### `zsh: command not found: code`
See [Step 1](#step-1--enable-the-code-command-in-terminal).

### VS Code "Cannot update while running on a read-only volume"
See [Step 2](#step-2--move-vs-code-out-of-downloads-macos).

### `fatal: not a git repository`
You are in the wrong directory or copied files without cloning. Run:
```bash
git clone https://github.com/davidpony007/Bitcoin_Mining_Master.git
cd Bitcoin_Mining_Master
```

### Docker containers won't start

1. Make sure Docker Desktop is open and running
2. Check for port conflicts:
   ```bash
   lsof -i :3306   # MySQL
   lsof -i :6379   # Redis
   lsof -i :8888   # Backend
   lsof -i :3000   # Frontend
   ```
3. Check container logs:
   ```bash
   docker compose logs backend
   ```

### Backend fails — `Error: .env not found` or missing DB config
Run `cp .env.example .env` inside the `backend/` folder (see [Step 4](#step-4--restore-environment-files)).

### `npm install` peer dependency errors
Use the `--legacy-peer-deps` flag:
```bash
npm install --legacy-peer-deps
```

### `JDK 17 or higher is required` (VS Code notification)
This notification comes from the **Gradle for Java** VS Code extension used by the Flutter/Android part of the project. To fix it:

1. Install JDK 17+:
   ```bash
   brew install openjdk@17
   ```
2. Add to your shell profile:
   ```bash
   # Apple Silicon Mac (M1/M2/M3/M4):
   echo 'export JAVA_HOME=/opt/homebrew/opt/openjdk@17' >> ~/.zshrc
   # Intel Mac:
   # echo 'export JAVA_HOME=/usr/local/opt/openjdk@17' >> ~/.zshrc
   #
   # Or use brew --prefix for automatic detection:
   echo 'export JAVA_HOME=$(brew --prefix openjdk@17)' >> ~/.zshrc
   source ~/.zshrc
   ```
3. Reload VS Code (`Cmd + Shift + P` → **Developer: Reload Window**)

---

## Project Structure

```
Bitcoin_Mining_Master/
├── backend/                # Node.js + Express API
│   ├── src/                # Source code
│   ├── test/               # Jest tests
│   ├── sql/                # Database init scripts
│   ├── .env.example        # Environment variables template
│   └── package.json
├── web_frontend/           # React 18 + TypeScript dashboard
│   ├── src/                # Source code (components, pages, store)
│   ├── .env.local.example  # Frontend env template
│   └── package.json
├── mobile_client/          # Flutter mobile app
│   └── bitcoin_mining_master/
├── nginx/                  # Nginx production config
├── scripts/                # Setup and utility shell scripts
├── docker-compose.yml      # Local development (all services)
├── docker-compose.dev.yml  # Backend-only dev environment
└── docker-compose.prod.yml # Production environment
```
