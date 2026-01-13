# Build APK in VS Code Terminal (No Interaction Mode)
# This script bypasses PowerShell interactive prompts

Write-Host "========== Building APK in VS Code ==========" -ForegroundColor Cyan

# Navigate to Flutter project
Set-Location -Path "$PSScriptRoot\android_clent\bitcoin_mining_master"

# Setup environment
$env:PATH = "$env:USERPROFILE\scoop\apps\flutter\current\bin;$env:USERPROFILE\scoop\apps\android-studio\current\jbr\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
$env:JAVA_HOME = "$env:USERPROFILE\scoop\apps\android-studio\current\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

Write-Host "`nProject Directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "Flutter Version:" -ForegroundColor Gray
flutter --version

Write-Host "`nStarting APK build..." -ForegroundColor Yellow
Write-Host "This may take 5-10 minutes on first build`n" -ForegroundColor Gray

# Use Start-Process to run in background without interaction
$buildProcess = Start-Process -FilePath "flutter" -ArgumentList "build","apk","--debug","--no-tree-shake-icons" -NoNewWindow -PassThru -Wait

if ($buildProcess.ExitCode -eq 0) {
    Write-Host "`n========== BUILD SUCCESS ==========" -ForegroundColor Green
    
    $apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
    if (Test-Path $apkPath) {
        $apkFile = Get-Item $apkPath
        $sizeMB = [math]::Round($apkFile.Length/1MB, 2)
        Write-Host "APK Location: $apkPath" -ForegroundColor Cyan
        Write-Host "APK Size: $sizeMB MB" -ForegroundColor Cyan
        
        # Check emulator
        Write-Host "`nChecking emulator connection..." -ForegroundColor Yellow
        $devices = adb devices 2>&1 | Select-String "emulator"
        
        if ($devices) {
            Write-Host "Emulator found: $devices" -ForegroundColor Green
            
            Write-Host "`nInstalling APK..." -ForegroundColor Cyan
            adb install -r $apkPath
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nInstall SUCCESS!" -ForegroundColor Green
                
                Write-Host "`nLaunching app..." -ForegroundColor Cyan
                adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
                
                Write-Host "`n========== APP IS RUNNING ==========" -ForegroundColor Green
            } else {
                Write-Host "`nInstall failed. Manual install:" -ForegroundColor Red
                Write-Host "adb install -r $apkPath" -ForegroundColor Yellow
            }
        } else {
            Write-Host "`nNo emulator connected." -ForegroundColor Yellow
            Write-Host "Manual install: adb install -r $apkPath" -ForegroundColor Gray
        }
    } else {
        Write-Host "`nAPK not found at expected location" -ForegroundColor Red
    }
} else {
    Write-Host "`n========== BUILD FAILED ==========" -ForegroundColor Red
    Write-Host "Exit Code: $($buildProcess.ExitCode)" -ForegroundColor Red
}

Write-Host "`n======================================" -ForegroundColor Cyan
