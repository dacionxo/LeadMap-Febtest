# GitHub CLI Installation Guide

## Installation Methods

### Method 1: Using winget (Windows Package Manager) - Recommended
```powershell
winget install --id GitHub.cli
```

### Method 2: Using Chocolatey
```powershell
choco install gh
```

### Method 3: Using Scoop
```powershell
scoop install gh
```

### Method 4: Direct Download
1. Visit: https://github.com/cli/cli/releases/latest
2. Download the Windows installer (`.msi` file)
3. Run the installer

## Verify Installation

After installation, verify it's working:
```powershell
gh --version
```

## Authentication

After installation, authenticate with GitHub:
```powershell
gh auth login
```

This will guide you through:
1. Choosing GitHub.com or GitHub Enterprise
2. Selecting authentication method (web browser or token)
3. Logging in to GitHub

## Common Commands

```powershell
# Check authentication status
gh auth status

# View your repositories
gh repo list

# Clone a repository
gh repo clone owner/repo

# Create a new repository
gh repo create

# View repository information
gh repo view

# Open repository in browser
gh repo view --web
```

## Troubleshooting

If `gh` command is not found after installation:

1. **Restart your terminal/PowerShell** - PATH changes require a new session
2. **Check installation location**: Usually installed to:
   - `C:\Program Files\GitHub CLI\gh.exe`
   - Or `%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe`

3. **Add to PATH manually** (if needed):
   ```powershell
   $env:PATH += ";C:\Program Files\GitHub CLI"
   ```

4. **Verify installation**:
   ```powershell
   Test-Path "C:\Program Files\GitHub CLI\gh.exe"
   ```

## Next Steps

After installation and authentication:
1. Navigate to your repository directory
2. Run `gh auth login` to authenticate
3. You can now use GitHub CLI commands

