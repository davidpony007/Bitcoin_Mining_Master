# Configure China Maven Mirrors for Gradle
# Solves network issues downloading Android dependencies

Write-Host "========== Configure Maven Mirrors ==========" -ForegroundColor Cyan

$buildGradle = "c:\Dev\Bitcoin_Mining_Master\android_clent\bitcoin_mining_master\android\build.gradle.kts"
$settingsGradle = "c:\Dev\Bitcoin_Mining_Master\android_clent\bitcoin_mining_master\android\settings.gradle.kts"

# Backup originals
Copy-Item $buildGradle "$buildGradle.backup" -Force
Copy-Item $settingsGradle "$settingsGradle.backup" -Force

Write-Host "Configuring China Maven mirrors..." -ForegroundColor Yellow

# Update build.gradle.kts
$buildContent = @'
allprojects {
    repositories {
        // Aliyun Maven Mirror (Fast in China)
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/central") }
        maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        
        // Original repositories as fallback
        google()
        mavenCentral()
        maven { url = uri("https://storage.googleapis.com/download.flutter.io") }
    }
}

rootProject.buildDir = File(rootDir, "../build")
subprojects {
    project.buildDir = File(rootDir, "../build/${project.name}")
}
subprojects {
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.buildDir)
}
'@

Set-Content -Path $buildGradle -Value $buildContent -Encoding UTF8

# Update settings.gradle.kts
$settingsContent = @'
pluginManagement {
    repositories {
        maven { url = uri("https://maven.aliyun.com/repository/public") }
        maven { url = uri("https://maven.aliyun.com/repository/google") }
        maven { url = uri("https://maven.aliyun.com/repository/gradle-plugin") }
        google()
        mavenCentral()
        gradlePluginPortal()
    }

    val flutterSdkPath = run {
        val properties = java.util.Properties()
        file("local.properties").inputStream().use { properties.load(it) }
        val flutterSdkPath = properties.getProperty("flutter.sdk")
        require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
        flutterSdkPath
    }

    includeBuild("$flutterSdkPath/packages/flutter_tools/gradle")
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.0" apply false
}

include(":app")
'@

Set-Content -Path $settingsGradle -Value $settingsContent -Encoding UTF8

Write-Host "✓ Maven mirrors configured!" -ForegroundColor Green
Write-Host "`nNow building APK..." -ForegroundColor Cyan

# Build APK
Set-Location "c:\Dev\Bitcoin_Mining_Master\android_clent\bitcoin_mining_master"

$env:PATH = "$env:USERPROFILE\scoop\apps\flutter\current\bin;$env:USERPROFILE\scoop\apps\android-studio\current\jbr\bin;$env:LOCALAPPDATA\Android\Sdk\platform-tools;$env:PATH"
$env:JAVA_HOME = "$env:USERPROFILE\scoop\apps\android-studio\current\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"

flutter build apk --debug

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========== BUILD SUCCESS ==========" -ForegroundColor Green
    
    $apkPath = "build\app\outputs\flutter-apk\app-debug.apk"
    if (Test-Path $apkPath) {
        $apkFile = Get-Item $apkPath
        $sizeMB = [math]::Round($apkFile.Length/1MB, 2)
        Write-Host "APK: $apkPath ($sizeMB MB)" -ForegroundColor Cyan
        
        # Install to emulator
        Write-Host "`nInstalling to emulator..." -ForegroundColor Yellow
        adb install -r $apkPath
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Install Success!" -ForegroundColor Green
            adb shell am start -n com.example.bitcoin_mining_master/.MainActivity
            Write-Host "`n========== APP IS RUNNING ==========" -ForegroundColor Green
        }
    }
} else {
    Write-Host "`n========== BUILD FAILED ==========" -ForegroundColor Red
}

Write-Host "`n======================================" -ForegroundColor Cyan
