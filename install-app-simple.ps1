# Simple APK Install Script

Write-Host "========== Bitcoin Mining Master APK Install ==========" -ForegroundColor Cyan

# Setup environment
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

$apkPath = "android_clent\bitcoin_mining_master\build\app\outputs\flutter-apk\app-debug.apk"

if (Test-Path $apkPath) {
    $apkFile = Get-Item $apkPath
    $sizeMB = [math]::Round($apkFile.Length/1MB, 2)
    
    Write-Host "`nAPK Found!" -ForegroundColor Green
    Write-Host "  File: $apkPath" -ForegroundColor Cyan
    Write-Host "  Size: $sizeMB MB" -ForegroundColor Cyan
    Write-Host "  Modified: $($apkFile.LastWriteTime)" -ForegroundColor Cyan
    
    # Check emulator
    Write-Host "`nChecking emulator..." -ForegroundColor Yellow
    $devices = adb devices | Select-String "emulator"
    
    if ($devices) {
        Write-Host "Emulator connected: $devices" -ForegroundColor Green
        
        Write-Host "`nInstalling APK..." -ForegroundColor Cyan
        adb install -r $apkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`nInstall Success!" -ForegroundColor Green
            
            Write-Host "`nLaunching app..." -ForegroundColor Cyan
            adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
            
            Write-Host "`n✓ App is running on emulator!" -ForegroundColor Green
        } else {
            Write-Host "`nInstall failed. Try: adb install -r $apkPath" -ForegroundColor Red
        }
    } else {
        Write-Host "No emulator connected. Start emulator first." -ForegroundColor Red
        Write-Host "Run: emulator -avd Medium_Phone_API_36.1" -ForegroundColor Yellow
    }
} else {
    Write-Host "`nAPK not found: $apkPath" -ForegroundColor Red
    Write-Host "Run: flutter build apk --debug" -ForegroundColor Yellow
}

Write-Host "`n======================================" -ForegroundColor Cyan
