# Move project to English path and rebuild
# This solves the Chinese characters in path issue

Write-Host "========== Fix Chinese Path Issue ==========" -ForegroundColor Cyan

$sourceDir = "c:\Users\93130\.vscode\代码工程\Bitcoin_Mining_Master"
$targetDir = "c:\Dev\Bitcoin_Mining_Master"

Write-Host "`nProblem: Project path contains Chinese characters" -ForegroundColor Yellow
Write-Host "Source: $sourceDir" -ForegroundColor Gray
Write-Host "Target: $targetDir" -ForegroundColor Green

if (Test-Path $targetDir) {
    Write-Host "`nTarget directory already exists." -ForegroundColor Yellow
    $response = Read-Host "Delete and recreate? (y/n)"
    if ($response -eq 'y') {
        Remove-Item $targetDir -Recurse -Force
        Write-Host "Removed existing directory" -ForegroundColor Gray
    } else {
        Write-Host "Cancelled" -ForegroundColor Red
        exit
    }
}

Write-Host "`nCopying project to English path..." -ForegroundColor Cyan
Write-Host "This may take a few minutes...`n" -ForegroundColor Gray

# Create parent directory
New-Item -ItemType Directory -Path "c:\Dev" -Force | Out-Null

# Copy entire project
Copy-Item -Path $sourceDir -Destination $targetDir -Recurse -Force

Write-Host "✓ Project copied successfully!" -ForegroundColor Green
Write-Host "`nNew project location: $targetDir" -ForegroundColor Cyan

# Clean build cache
$buildDir = "$targetDir\android_clent\bitcoin_mining_master\build"
if (Test-Path $buildDir) {
    Remove-Item $buildDir -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "✓ Cleaned build cache" -ForegroundColor Gray
}

Write-Host "`nNow building APK from new location..." -ForegroundColor Yellow
Set-Location "$targetDir\android_clent\bitcoin_mining_master"

# Setup environment
$env:PATH = "$env:USERPROFILE\scoop\apps\flutter\current\bin;$env:USERPROFILE\scoop\apps\android-studio\current\jbr\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
$env:JAVA_HOME = "$env:USERPROFILE\scoop\apps\android-studio\current\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "`nStarting flutter build..." -ForegroundColor Cyan
flutter build apk --debug

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========== BUILD SUCCESS ==========" -ForegroundColor Green
    
    $apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
    if (Test-Path $apkPath) {
        $apkFile = Get-Item $apkPath
        $sizeMB = [math]::Round($apkFile.Length/1MB, 2)
        Write-Host "APK: $apkPath" -ForegroundColor Cyan
        Write-Host "Size: $sizeMB MB" -ForegroundColor Cyan
        
        # Install to emulator
        Write-Host "`nInstalling to emulator..." -ForegroundColor Yellow
        adb install -r $apkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Install Success!" -ForegroundColor Green
            Write-Host "`nLaunching app..." -ForegroundColor Cyan
            adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
            Write-Host "`n========== APP IS RUNNING ==========" -ForegroundColor Green
        }
    }
} else {
    Write-Host "`n========== BUILD FAILED ==========" -ForegroundColor Red
}

Write-Host "`n======================================" -ForegroundColor Cyan
Write-Host "New project location: $targetDir" -ForegroundColor Cyan
