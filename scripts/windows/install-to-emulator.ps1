# Flutter应用安装到模拟器脚本
# 用法: .\scripts\windows\install-to-emulator.ps1

Write-Host "========== 安装Flutter应用到Android模拟器 ==========" -ForegroundColor Cyan

# 设置环境变量
$env:JAVA_HOME = "$env:USERPROFILE\scoop\apps\android-studio\current\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\emulator;$env:USERPROFILE\scoop\apps\flutter\current\bin;$env:PATH"

Write-Host "`n1. 检查模拟器状态..." -ForegroundColor Yellow

$devices = & adb devices 2>&1 | Select-String "emulator"
if (-not $devices) {
    Write-Host "❌ 模拟器未运行" -ForegroundColor Red
    Write-Host "`n启动模拟器..." -ForegroundColor Cyan
    
    # 获取可用模拟器
    $avdList = & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds 2>$null
    if ($avdList) {
        $firstAVD = $avdList[0]
        Write-Host "启动: $firstAVD" -ForegroundColor Green
        Start-Process "$env:ANDROID_HOME\emulator\emulator.exe" -ArgumentList "-avd", $firstAVD -WindowStyle Normal
        
        Write-Host "等待模拟器启动..." -ForegroundColor Yellow
        Start-Sleep -Seconds 45
    } else {
        Write-Host "❌ 未找到模拟器，请先在Android Studio中创建" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✓ 模拟器已连接" -ForegroundColor Green

Write-Host "`n2. 切换到项目目录..." -ForegroundColor Yellow
Set-Location "$PSScriptRoot\..\..\android_clent\bitcoin_mining_master"

Write-Host "`n3. 构建并安装应用..." -ForegroundColor Yellow

# 尝试运行Flutter应用
try {
    flutter run -d emulator-5554 --no-pub
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n尝试使用Gradle直接构建..." -ForegroundColor Yellow
        Set-Location "android"
        
        .\gradlew.bat assembleDebug
        
        if ($LASTEXITCODE -eq 0) {
            $apkPath = "build\outputs\apk\debug\app-debug.apk"
            if (Test-Path $apkPath) {
                Write-Host "`n✓ APK构建成功: $apkPath" -ForegroundColor Green
                Write-Host "`n4. 安装APK到模拟器..." -ForegroundColor Yellow
                
                adb install -r $apkPath
                
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "`n✅ 应用安装成功！" -ForegroundColor Green
                    
                    # 启动应用
                    Write-Host "`n5. 启动应用..." -ForegroundColor Yellow
                    adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
                    
                    Write-Host "`n🎉 应用已在模拟器中运行！" -ForegroundColor Green
                } else {
                    Write-Host "`n❌ APK安装失败" -ForegroundColor Red
                }
            }
        }
    }
} catch {
    Write-Host "`n❌ 错误: $_" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
