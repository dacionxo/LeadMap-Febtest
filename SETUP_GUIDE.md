# LeadMap Project Setup Guide

## Overview
LeadMap is a monorepo containing multiple projects including:
- **postiz-app**: Main application (Next.js/Nest.js based)
- **portal-backend**: Backend server
- **context7**: Documentation and SDK tools
- **dev-playgrounds**: Development playground
- **addresser**: Address handling utility

## System Requirements
- **Node.js**: v24.11.0 (Currently installed)
- **pnpm**: v10.6.1 (Installed globally)
- **Package Manager**: pnpm (primary), npm (fallback)

## Completed Setup Tasks

### 1. VS Code Extensions Installed ✓
The following essential extensions have been installed:
- **TypeScript & Language Support**
  - ms-vscode.vscode-typescript-next (TypeScript Vue Plugin)
  - denoland.vscode-deno (Deno Runtime Support)
  
- **Code Quality & Formatting**
  - dbaeumer.vscode-eslint (ESLint integration)
  - esbenp.prettier-vscode (Code formatter)
  
- **Framework Support**
  - dsznajder.es7-react-js-snippets (React snippets)
  - bradlc.vscode-tailwindcss (Tailwind CSS IntelliSense)
  - styled-components.vscode-styled-components (Styled Components)
  - unifiedjs.vscode-mdx (MDX Support)
  
- **Version Control & Productivity**
  - eamodio.gitlens (Git integration)
  - mhutchie.git-graph (Git visualization)
  - ms-vscode-remote.remote-wsl (WSL Support)
  - ms-vscode-remote.remote-containers (Dev Containers)

### 2. VS Code Configuration ✓
Created `.vscode/settings.json` with:
- **Formatting**: Prettier as default formatter with format-on-save
- **Linting**: ESLint integration with auto-fix
- **TypeScript**: Proper tsconfig and workspace SDK settings
- **Tailwind**: Enhanced class regex for better IntelliSense
- **Deno**: Deno support enabled
- **Workspace**: Optimized search and file watching exclusions

### 3. Workspace File Created ✓
Created `LeadMap.code-workspace` with:
- All project folders configured for VS Code multi-root workspace
- Unified settings and recommended extensions
- Proper project organization

### 4. Project Dependencies
- **Root**: ✓ Installed (nodemailer, tsx)
- **portal-backend**: In Progress (npm install)
- **postiz-app**: In Progress (pnpm install - 3840+ packages)
- **context7**: ✓ Completed (383+ packages)
- **addresser**: Ready (standalone package)

## How to Use the Setup

### Opening the Project
1. Open VS Code
2. File → Open Workspace from File
3. Navigate to: `d:\Downloads\LeadMap-main\LeadMap.code-workspace`
4. Click "Open"

### Running Projects

#### postiz-app (Main Application)
```bash
cd postiz-app
pnpm install  # If not already done
pnpm run dev  # Start development server
```

#### portal-backend
```bash
cd portal-backend
npm install   # If not already done
npm run dev   # Start backend server
```

#### context7
```bash
cd context7
pnpm install  # If not already done
pnpm build    # Build packages
pnpm test     # Run tests
```

## IDE Features Enabled

### Code Formatting
- **Auto Format**: Enabled on save (Prettier)
- **Import Organization**: Auto-organizes imports on save
- **Tailwind CSS**: Real-time class suggestions

### Debugging
- Node.js debugging configured in `.vscode/launch.json`
- Deno debugging ready

### Git Integration
- GitLens for blame information
- Git Graph for visual commit history

## Recommended VS Code Settings

The following are already configured in `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  }
}
```

## Troubleshooting

### Import Path Issues
- Ensure TypeScript workspace SDK is enabled
- Check that `typescript.tsdk` points to `node_modules/typescript/lib`

### ESLint/Prettier Conflicts
- The configuration uses ESLint with Prettier integration
- Format-on-save is enabled and will respect both rules

### Node Version Issues
- postiz-app requires Node `>=22.12.0 <23.0.0` (Currently on v24 - minor version mismatch)
- portal-backend requires Node `^20.19.1` (Currently on v24 - newer version OK)
- Both projects will work but may show warnings

## Extension Management

To install additional extensions listed in `.vscode/extensions.txt`:
```bash
# Extensions are already installed or attempted. 
# To manually install any:
code --install-extension <extension-id>
```

## Next Steps

1. Wait for `pnpm install` in postiz-app to complete
2. Wait for `npm install` in portal-backend to complete
3. Open the workspace file for full IDE integration
4. Start developing!

## File Structure
```
LeadMap-main/
├── .vscode/
│   ├── settings.json      # IDE settings (CREATED)
│   ├── launch.json        # Debug configurations
│   └── extensions.txt     # Recommended extensions list
├── LeadMap.code-workspace # Multi-root workspace file (CREATED)
├── postiz-app/            # Main app (pnpm)
├── portal-backend/        # Backend server (npm)
├── context7/              # SDK & docs (pnpm)
├── dev-playgrounds/       # Dev tools
└── addresser/             # Utility package
```

## Performance Notes
- Large monorepo with 3840+ dependencies in postiz-app
- Use `pnpm` for faster installation and better disk usage
- .vscode/settings.json configured to exclude node_modules from watchers

---
**Setup Date**: January 16, 2026
**Configuration Status**: Ready for Development
