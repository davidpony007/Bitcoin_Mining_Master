@echo off
setlocal

echo ========== Bitcoin Mining Master APK Build ==========

cd /d %~dp0android_clent\bitcoin_mining_master

set PATH=%USERPROFILE%\scoop\apps\flutter\current\bin;%USERPROFILE%\scoop\apps\android-studio\current\jbr\bin;%LOCALAPPDATA%\Android\Sdk\platform-tools;%PATH%
set JAVA_HOME=%USERPROFILE%\scoop\apps\android-studio\current\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk

echo Building APK...
flutter build apk --debug --no-tree-shake-icons

if %ERRORLEVEL% == 0 (
    echo.
    echo Build Success!
    echo.
    echo Installing to emulator...
    adb install -r build\app\outputs\flutter-apk\app-debug.apk
    
    if %ERRORLEVEL% == 0 (
        echo.
        echo Install Success! Launching app...
        adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
        echo.
        echo App is running!
    ) else (
        echo Install failed
    )
) else (
    echo Build failed
)

pause
