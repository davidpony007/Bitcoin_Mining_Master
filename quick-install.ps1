# 快速安装脚本 - Gradle构建完成后运行
# 使用方法: .\quick-install.ps1

$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "安装APK到模拟器..." -ForegroundColor Cyan

$apkPath = "android_clent\bitcoin_mining_master\android\app\build\outputs\apk\debug\app-debug.apk"

if (Test-Path $apkPath) {
    adb install -r $apkPath
    Write-Host "`n✓ 安装完成，启动应用..." -ForegroundColor Green
    adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
    Write-Host "`n🎉 应用已在模拟器中运行！" -ForegroundColor Green
} else {
    Write-Host "APK未找到，请等待构建完成" -ForegroundColor Yellow
    Write-Host "APK路径: $apkPath" -ForegroundColor Gray
}
