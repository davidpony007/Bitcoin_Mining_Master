import sys
import subprocess
import re
import os

MIN_NODE_VERSION = (16, 0, 0)

def run_command(command):
    """Runs a command and returns its output."""
    try:
        result = subprocess.run(command, capture_output=True, text=True, shell=True, check=True, encoding='utf-8')
        return result.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        return None

def check_node_version():
    """Checks if Node.js is installed and meets the minimum version requirement."""
    print("--- 检查 Node.js 版本 ---")
    version_str = run_command("node -v")
    if not version_str:
        print("错误: 未找到 Node.js。请安装 Node.js (>= 16.0.0)。")
        print("官方网站: https://nodejs.org/\n")
        return False

    # version_str is like 'v16.13.0'
    match = re.search(r'v(\d+)\.(\d+)\.(\d+)', version_str)
    if not match:
        print(f"错误: 无法解析 Node.js 版本: {version_str}\n")
        return False

    current_version = tuple(map(int, match.groups()))
    if current_version >= MIN_NODE_VERSION:
        print(f"成功: Node.js 版本 {version_str} >= v{'.'.join(map(str, MIN_NODE_VERSION))}\n")
        return True
    else:
        print(f"错误: 需要 Node.js 版本 >= v{'.'.join(map(str, MIN_NODE_VERSION))}, 但当前版本是 {version_str}")
        print("请升级您的 Node.js 版本。\n")
        return False

def check_npm_version():
    """Checks if npm is installed."""
    print("--- 检查 npm ---")
    version_str = run_command("npm -v")
    if version_str:
        print(f"成功: 找到 npm 版本 {version_str}\n")
        return True
    else:
        print("错误: 未找到 npm。npm 通常与 Node.js 一起安装。\n")
        return False

def check_android_sdk():
    """Checks for Android SDK (ANDROID_HOME environment variable)."""
    print("--- 检查 Android SDK ---")
    android_home = os.getenv('ANDROID_HOME')
    if android_home:
        print(f"成功: 找到 ANDROID_HOME 环境变量: {android_home}\n")
        return True
    else:
        print("警告: 未设置 ANDROID_HOME 环境变量。")
        print("如果要进行 Android 客户端开发, 请安装 Android Studio 并设置 ANDROID_HOME。")
        print("官方网站: https://developer.android.com/studio\n")
        return False

def show_next_steps():
    """Shows instructions on how to start the application."""
    print("--- 如何启动应用 ---")
    print("环境检查通过！请按照以下步骤启动后端服务：")
    print("\n1. 进入后端目录:")
    print("   cd backend")
    print("\n2. 安装依赖 (如果尚未安装):")
    print("   npm install")
    print("\n3. 启动开发服务器:")
    print("   npm run dev")
    print("\n服务将在 http://localhost:8888 上运行。")
    print("\n--- 如何启动 Android 应用 ---")
    print("1. 打开 Android Studio。")
    print("2. 选择 'Open' 并导航到项目的 'android_clent/Bitcoin_Mining_Master' 目录。")
    print("3. 等待 Gradle 同步完成。")
    print("4. 在模拟器或真实设备上运行应用。")


if __name__ == "__main__":
    print("开始检查项目环境...\n")

    node_ok = check_node_version()
    npm_ok = check_npm_version()
    android_ok = check_android_sdk()

    print("--- 检查摘要 ---")
    if node_ok and npm_ok:
        print("恭喜！您的后端环境已为 Bitcoin_Mining_Master 正确设置。")
        if not android_ok:
            print("注意: Android 开发环境似乎未完全配置。如果不需要，可忽略此警告。")
        show_next_steps()
    else:
        print("您的环境存在一些问题。请查看上面的错误消息并解决它们。")
