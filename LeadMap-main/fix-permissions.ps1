# PowerShell Script to Fix Directory Permissions
# Run this script as Administrator

$targetPath = "D:\Downloads\LeadMap-main\LeadMap-main\app\dashboard\marketing\components\compose-email"
$componentsPath = "D:\Downloads\LeadMap-main\LeadMap-main\app\dashboard\marketing\components"

Write-Host "Fixing permissions for compose-email directory..."
Write-Host "Target path: $targetPath"

# Navigate to components directory
Set-Location $componentsPath

# Remove directory if it exists and has permission issues
if (Test-Path "compose-email") {
    Write-Host "Removing existing compose-email directory..."
    try {
        Remove-Item -Path "compose-email" -Recurse -Force -ErrorAction Stop
        Write-Host "Directory removed successfully"
    } catch {
        Write-Host "Could not remove directory: $_"
        Write-Host "Attempting to fix permissions instead..."
        
        # Try to remove read-only attribute
        $folder = Get-Item "compose-email" -Force
        $folder.Attributes = $folder.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly)
        
        # Try to set permissions
        try {
            $acl = Get-Acl "compose-email"
            $permission = $env:USERNAME,"FullControl","ContainerInherit,ObjectInherit","None","Allow"
            $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
            $acl.SetAccessRule($accessRule)
            Set-Acl "compose-email" $acl
            Write-Host "Permissions updated"
        } catch {
            Write-Host "Could not update permissions: $_"
            Write-Host "Please run this script as Administrator or fix permissions manually"
            exit 1
        }
    }
}

# Create directory structure
Write-Host "Creating directory structure..."
try {
    New-Item -ItemType Directory -Path "compose-email" -Force | Out-Null
    New-Item -ItemType Directory -Path "compose-email\hooks" -Force | Out-Null
    New-Item -ItemType Directory -Path "compose-email\components" -Force | Out-Null
    Write-Host "Directories created successfully!"
    
    # Verify by creating a test file
    $testFile = "compose-email\.gitkeep"
    Set-Content -Path $testFile -Value "# Directory created"
    if (Test-Path $testFile) {
        Remove-Item $testFile -Force
        Write-Host "SUCCESS: Directory is writable!"
    } else {
        Write-Host "WARNING: Could not create test file"
    }
} catch {
    Write-Host "ERROR: Could not create directories: $_"
    Write-Host "Please check permissions and try again"
    exit 1
}

Write-Host ""
Write-Host "Directory permissions fixed! You can now proceed with implementation."
Write-Host "Next step: Create files using code from COMPOSE_EMAIL_PHASE_2_IMPLEMENTATION_CODE.md"

