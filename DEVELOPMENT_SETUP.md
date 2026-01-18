# LeadMap Development Setup - Quick Start Guide

## ✅ Setup Completed

### Prerequisites

- **Node.js**: v24.11.0 (installed)
- **pnpm**: v10.6.1 (installed globally)
- **npm**: v11.6.1 (installed)
- **VS Code**: With workspace configuration

### Extensions Installed

✓ TypeScript Vue Plugin
✓ Deno Runtime Support
✓ ESLint integration
✓ Prettier formatter
✓ React snippets
✓ Tailwind CSS IntelliSense
✓ Styled Components support
✓ MDX support
✓ GitLens
✓ Git Graph

### Directory Structure

```
LeadMap-main/
├── .vscode/
│   ├── settings.json      # IDE settings configured
│   ├── launch.json        # Debug configurations
│   └── extensions.txt     # Recommended extensions
├── LeadMap.code-workspace # Multi-root workspace file
├── postiz-app/            # Main application (Next.js/NestJS)
│   ├── .env.local         # Local development config
│   ├── node_modules/      # Dependencies (installing...)
│   └── apps/              # Frontend, Backend, Orchestrator, SDK
├── portal-backend/        # Backend server (Node.js/Express)
│   ├── .env.local         # Local development config
│   ├── node_modules/      # Dependencies (installing...)
│   └── src/               # Source code
├── context7/              # Documentation and SDK tools
├── dev-playgrounds/       # Development playground
└── addresser/             # Address handling utility
```

## 🚀 Running the Projects

### Option 1: Run postiz-app (Main Application)

```bash
cd postiz-app
pnpm run dev  # Runs all apps in parallel: extension, orchestrator, backend, frontend
```

This will start:

- **Frontend**: http://localhost:4200
- **Backend**: http://localhost:3000
- **Orchestrator**: Running in background

### Option 2: Run Individual postiz-app Components

```bash
cd postiz-app

# Just frontend
pnpm run dev:frontend

# Just backend
pnpm run dev:backend

# Just orchestrator
pnpm run dev:orchestrator

# Just extension
pnpm run dev:extension
```

### Option 3: Run portal-backend

```bash
cd portal-backend
npm run dev  # Starts backend server on port 8080
```

### Option 4: Run context7 (Documentation/SDK)

```bash
cd context7
pnpm install  # Already done
pnpm build    # Build packages
pnpm test     # Run tests
```

## 🔧 Configuration

### Environment Variables

Both `.env.local` files have been created with development defaults:

**postiz-app/.env.local**

- DATABASE_URL: PostgreSQL connection (local)
- REDIS_URL: Redis connection (local)
- STORAGE_PROVIDER: Set to "local" for development

**portal-backend/.env.local**

- APP_ENVIRONMENT: Set to "localhost"
- PORT: 8080
- REPLIERS_API_KEY: Add your API key from https://login.repliers.com/
- MAPBOX_ACCESS_TOKEN: Add your token from https://www.mapbox.com/

### Database Setup

For postiz-app to run, you'll need:

1. PostgreSQL server running on localhost:5432
2. Redis server running on localhost:6379

Consider using Docker:

```bash
docker run -d -p 5432:5432 -e POSTGRES_USER=postiz-user -e POSTGRES_PASSWORD=postiz-password postgres
docker run -d -p 6379:6379 redis
```

## 📝 IDE Features

### Code Formatting

- **Auto Format**: Enabled on save (Prettier)
- **Import Organization**: Auto-organizes imports on save
- **ESLint**: Auto-fixes issues on save

### Debugging

- TypeScript debugging configured
- Deno debugging available
- Use `.vscode/launch.json` for configurations

### Git Integration

- **GitLens**: Show commit blame and history
- **Git Graph**: Visualize commit history
- Configured to ignore node_modules, .next, dist, build

## 🧪 Testing

### postiz-app

```bash
cd postiz-app
pnpm test
```

### portal-backend

```bash
cd portal-backend
npm test
```

## 📚 Building for Production

### postiz-app

```bash
cd postiz-app
pnpm run build
```

Builds:

- Frontend (Next.js)
- Backend (NestJS)
- Orchestrator

### portal-backend

```bash
cd portal-backend
npm run build
```

## ⚠️ Notes

### Node Version

- postiz-app specifies Node 22.12.0 <23.0.0, but will work with v24.11.0 (minor warnings)
- portal-backend specifies Node ^20.19.1, works fine with v24.11.0

### Package Manager

- postiz-app uses **pnpm** (monorepo workspace)
- portal-backend uses **npm**
- Both work alongside each other

### Workspace Features

- Multi-root VS Code workspace configured
- Unified ESLint and Prettier settings
- TypeScript workspace SDK enabled
- Tailwind CSS IntelliSense configured

## 🔗 Useful Links

- **postiz-app**: http://docs.postiz.com/configuration/reference
- **Repliers API**: https://login.repliers.com/
- **Mapbox**: https://www.mapbox.com/
- **PostgreSQL**: https://www.postgresql.org/
- **Redis**: https://redis.io/

## 💡 Next Steps

1. **Install dependencies** (in progress):

   ```bash
   cd postiz-app && pnpm install
   cd portal-backend && npm install
   ```

2. **Set up databases**:
   - PostgreSQL for postiz-app
   - Redis for postiz-app

3. **Update .env.local files** with your API keys:
   - REPLIERS_API_KEY
   - MAPBOX_ACCESS_TOKEN
   - Any social media API credentials

4. **Open the workspace**:
   - File → Open Workspace from File
   - Select: `LeadMap.code-workspace`

5. **Start developing**:
   ```bash
   pnpm run dev
   ```

---

**Setup Date**: January 16, 2026
**VS Code Ready**: ✅ Yes
**Dependencies Installing**: ⏳ In Progress
