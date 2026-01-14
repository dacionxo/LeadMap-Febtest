# Script to duplicate repository to a new remote
# Usage: .\duplicate-repo.ps1 -NewRepoUrl "https://github.com/username/new-repo-name.git"

param(
    [Parameter(Mandatory=$true)]
    [string]$NewRepoUrl
)

Write-Host "Duplicating repository to: $NewRepoUrl" -ForegroundColor Cyan

# Add new remote
Write-Host "Adding new remote 'duplicate'..." -ForegroundColor Yellow
git remote add duplicate $NewRepoUrl

# Verify remote was added
Write-Host "`nCurrent remotes:" -ForegroundColor Green
git remote -v

# Push all branches to new remote
Write-Host "`nPushing all branches to new repository..." -ForegroundColor Yellow
git push duplicate --all

# Push all tags to new remote
Write-Host "`nPushing all tags to new repository..." -ForegroundColor Yellow
git push duplicate --tags

Write-Host "`n✓ Repository duplicated successfully!" -ForegroundColor Green
Write-Host "New repository URL: $NewRepoUrl" -ForegroundColor Cyan
Write-Host "`nTo remove the duplicate remote later, run: git remote remove duplicate" -ForegroundColor Gray
