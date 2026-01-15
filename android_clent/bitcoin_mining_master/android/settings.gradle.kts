pluginManagement {
    val flutterSdkPath = run {
        val properties = java.util.Properties()
        java.io.File("local.properties").inputStream().use { stream ->
            java.io.InputStreamReader(stream, "UTF-8").use { reader ->
                properties.load(reader)
            }
        }
        val flutterSdkPath = properties.getProperty("flutter.sdk")
        require(flutterSdkPath != null) { "flutter.sdk not set in local.properties" }
        flutterSdkPath
    }

    val flutterGradlePath = java.io.File(flutterSdkPath, "packages/flutter_tools/gradle")
    includeBuild(flutterGradlePath.absolutePath)

    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

plugins {
    id("dev.flutter.flutter-plugin-loader") version "1.0.0"
    id("com.android.application") version "8.11.1" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
}

include(":app")
