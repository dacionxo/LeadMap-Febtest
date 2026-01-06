# PowerShell Script to Fix Directory Permissions for compose-email
# Run this script as Administrator or from PowerShell

$componentsPath = "D:\Downloads\LeadMap-main\LeadMap-main\app\dashboard\marketing\components"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Fixing permissions for compose-email directory" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to components directory
if (Test-Path $componentsPath) {
    Set-Location $componentsPath
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green
} else {
    Write-Host "ERROR: Components directory not found: $componentsPath" -ForegroundColor Red
    exit 1
}

# Remove directory if it exists and has permission issues
if (Test-Path "compose-email") {
    Write-Host "Removing existing compose-email directory..." -ForegroundColor Yellow
    try {
        Remove-Item -Path "compose-email" -Recurse -Force -ErrorAction Stop
        Write-Host "Directory removed successfully" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove directory: $_" -ForegroundColor Red
        Write-Host "Attempting to fix permissions instead..." -ForegroundColor Yellow
        
        # Try to remove read-only attribute
        try {
            $folder = Get-Item "compose-email" -Force
            $folder.Attributes = $folder.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
            Write-Host "Read-only attribute removed" -ForegroundColor Green
        } catch {
            Write-Host "Could not remove read-only attribute: $_" -ForegroundColor Red
        }
        
        # Try to set permissions
        try {
            $acl = Get-Acl "compose-email"
            $permission = $env:USERNAME,"FullControl","ContainerInherit,ObjectInherit","None","Allow"
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
            $acl.SetAccessRule($accessRule)
            Set-Acl "compose-email" $acl
            Write-Host "Permissions updated" -ForegroundColor Green
        } catch {
            Write-Host "Could not update permissions: $_" -ForegroundColor Red
            Write-Host "Please run this script as Administrator" -ForegroundColor Yellow
            exit 1
        }
    }
}

# Create directory structure
Write-Host ""
Write-Host "Creating directory structure..." -ForegroundColor Yellow
try {
    $dir1 = New-Item -ItemType Directory -Path "compose-email" -Force
    Write-Host "Created: compose-email" -ForegroundColor Green
    
    $dir2 = New-Item -ItemType Directory -Path "compose-email\hooks" -Force
    Write-Host "Created: compose-email\hooks" -ForegroundColor Green
    
    $dir3 = New-Item -ItemType Directory -Path "compose-email\components" -Force
    Write-Host "Created: compose-email\components" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Directories created successfully!" -ForegroundColor Green
    
    # Verify by creating a test file
    Write-Host ""
    Write-Host "Verifying write permissions..." -ForegroundColor Yellow
    $testFile = "compose-email\.gitkeep"
    Set-Content -Path $testFile -Value "# Directory created"
    if (Test-Path $testFile) {
        Remove-Item $testFile -Force
        Write-Host "SUCCESS: Directory is writable!" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Could not create test file" -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Could not create directories: $_" -ForegroundColor Red
    Write-Host "Please check permissions and try again" -ForegroundColor Yellow
    Write-Host "You may need to run PowerShell as Administrator" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Permissions fixed successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. The directory structure is ready" -ForegroundColor White
Write-Host "2. Files can now be created in compose-email directory" -ForegroundColor White
Write-Host "3. Use code from COMPOSE_EMAIL_PHASE_2_IMPLEMENTATION_CODE.md" -ForegroundColor White
Write-Host ""



