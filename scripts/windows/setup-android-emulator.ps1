# 自动配置Android模拟器脚本
# 用法: .\setup-android-emulator.ps1

Write-Host "========== 配置Android模拟器 ==========" -ForegroundColor Cyan

# 设置环境变量
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:ANDROID_HOME\tools\bin;$env:PATH"

Write-Host "`n1. 检查Android Studio和SDK..." -ForegroundColor Yellow

if (-not (Test-Path $env:ANDROID_HOME)) {
    Write-Host "❌ Android SDK未找到，请先打开Android Studio进行初始设置" -ForegroundColor Red
    Write-Host "   路径: $env:USERPROFILE\scoop\apps\android-studio\current\bin\studio64.exe" -ForegroundColor Gray
    exit 1
}

Write-Host "✓ Android SDK找到: $env:ANDROID_HOME" -ForegroundColor Green

Write-Host "`n2. 检查可用的系统镜像..." -ForegroundColor Yellow

# 列出已安装的系统镜像
$images = & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds 2>$null

if ($images) {
    Write-Host "✓ 找到已创建的模拟器:" -ForegroundColor Green
    $images | ForEach-Object { Write-Host "  - $_" -ForegroundColor Cyan }
    
    Write-Host "`n3. 启动模拟器..." -ForegroundColor Yellow
    $firstEmulator = $images[0]
    Write-Host "启动模拟器: $firstEmulator" -ForegroundColor Cyan
    
    Start-Process "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList "-avd", $firstEmulator, "-netdelay", "none", "-netspeed", "full" -WindowStyle Normal
    
    Write-Host "`n✓ 模拟器正在启动..." -ForegroundColor Green
    Write-Host "等待模拟器完全启动后，运行 Flutter 应用：" -ForegroundColor Yellow
    Write-Host "  cd android_clent\bitcoin_mining_master" -ForegroundColor Gray
    Write-Host "  flutter devices" -ForegroundColor Gray
    Write-Host "  flutter run" -ForegroundColor Gray
} else {
    Write-Host "❌ 未找到模拟器，需要创建" -ForegroundColor Red
    Write-Host "`n请按以下步骤操作：" -ForegroundColor Yellow
    Write-Host "1. 打开 Android Studio" -ForegroundColor Gray
    Write-Host "2. 点击 Tools → Device Manager" -ForegroundColor Gray
    Write-Host "3. 点击 Create Device" -ForegroundColor Gray
    Write-Host "4. 选择 Pixel 5 → Next" -ForegroundColor Gray
    Write-Host "5. 下载 API 34 系统镜像 → Next → Finish" -ForegroundColor Gray
    Write-Host "6. 点击启动按钮" -ForegroundColor Gray
    Write-Host "`n或者运行此命令再次尝试：" -ForegroundColor Yellow
    Write-Host "  .\scripts\windows\setup-android-emulator.ps1" -ForegroundColor Cyan
}

Write-Host "`n========================================" -ForegroundColor Cyan
