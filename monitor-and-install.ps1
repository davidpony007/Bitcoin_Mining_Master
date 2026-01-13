# Monitor Gradle build and auto install APK

Write-Host "========== Monitor APK Build ==========" -ForegroundColor Cyan

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

$apkPath = "android_clent\bitcoin_mining_master\android\app\build\outputs\apk\debug\app-debug.apk"
$maxWaitMinutes = 10
$startTime = Get-Date

Write-Host "Waiting for APK..." -ForegroundColor Yellow
Write-Host "APK Path: $apkPath" -ForegroundColor Gray

while ($true) {
    if (Test-Path $apkPath) {
        Write-Host "`nAPK Build Success!" -ForegroundColor Green
        
        $apkFile = Get-Item $apkPath
        $sizeMB = [math]::Round($apkFile.Length/1MB, 2)
        Write-Host "Size: $sizeMB MB" -ForegroundColor Cyan
        
        Write-Host "`nChecking emulator..." -ForegroundColor Yellow
        $devices = adb devices
        
        if ($devices -match "emulator") {
            Write-Host "Emulator connected" -ForegroundColor Green
            
            Write-Host "`nInstalling APK..." -ForegroundColor Cyan
            adb install -r $apkPath
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "`nInstall Success!" -ForegroundColor Green
                
                Write-Host "`nLaunching app..." -ForegroundColor Cyan
                adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
                
                Write-Host "`nApp is running!" -ForegroundColor Green
                break
            } else {
                Write-Host "`nInstall failed" -ForegroundColor Red
                break
            }
        } else {
            Write-Host "Emulator not connected" -ForegroundColor Red
            break
        }
    }
    
    $elapsed = (Get-Date) - $startTime
    if ($elapsed.TotalMinutes -gt $maxWaitMinutes) {
        Write-Host "`nTimeout after $maxWaitMinutes minutes" -ForegroundColor Yellow
        break
    }
    
    Write-Host "." -NoNewline -ForegroundColor Gray
    Start-Sleep -Seconds 10
}

Write-Host "`n======================================" -ForegroundColor Cyan
