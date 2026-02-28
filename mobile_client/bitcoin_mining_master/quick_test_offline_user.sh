#!/bin/bash

# 离线用户功能快速测试脚本
# 使用方法: ./quick_test_offline_user.sh [场景编号]

set -e

DEVICE_ID="WCO7CAC6T8CA99OB"
PACKAGE_NAME="com.cloudminingtool.bitcoin_mining_master"
APP_DIR="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/mobile_client/bitcoin_mining_master"
BACKEND_DIR="/Users/davidpony/Desktop/工程文件夹/Bitcoin_Mining_Master/backend"

echo "🧪 离线用户功能测试工具"
echo "================================"
echo ""

# 显示菜单
show_menu() {
    echo "请选择测试场景:"
    echo "1) 场景1: 有网络首次启动"
    echo "2) 场景2: 无网络首次启动"
    echo "3) 场景3: 离线用户网络恢复同步"
    echo "4) 场景4: 已有账号再次启动"
    echo "5) 查看应用日志"
    echo "6) 查看SharedPreferences数据"
    echo "7) 清除应用数据"
    echo "0) 退出"
    echo ""
}

# 检查后端服务
check_backend() {
    echo "📡 检查后端服务状态..."
    if lsof -i:8888 > /dev/null 2>&1; then
        echo "✅ 后端服务运行中 (端口8888)"
    else
        echo "❌ 后端服务未运行"
        echo "   启动命令: cd $BACKEND_DIR && npm start"
        return 1
    fi
}

# 检查设备连接
check_device() {
    echo "📱 检查设备连接..."
    if adb devices | grep -q "$DEVICE_ID"; then
        echo "✅ 设备已连接: $DEVICE_ID"
    else
        echo "❌ 设备未连接"
        echo "   当前设备列表:"
        adb devices
        return 1
    fi
}

# 清除应用数据
clear_app_data() {
    echo "🗑️  清除应用数据..."
    adb shell pm clear $PACKAGE_NAME
    echo "✅ 应用数据已清除"
}

# 启用网络
enable_network() {
    echo "📡 启用网络连接..."
    adb shell svc wifi enable
    adb shell svc data enable
    sleep 2
    echo "✅ 网络已启用"
}

# 禁用网络
disable_network() {
    echo "📴 禁用网络连接..."
    adb shell svc wifi disable
    adb shell svc data disable
    sleep 2
    echo "✅ 网络已禁用"
}

# 启动应用
start_app() {
    echo "🚀 启动应用..."
    adb shell am start -n $PACKAGE_NAME/.MainActivity
    sleep 2
    echo "✅ 应用已启动"
}

# 查看日志
view_logs() {
    echo "📋 实时查看应用日志 (Ctrl+C 退出)..."
    adb logcat -s flutter:V | grep -E "user|User|offline|Offline|sync|Sync|网络|初始化|创建"
}

# 查看SharedPreferences
view_prefs() {
    echo "📂 查看SharedPreferences数据..."
    adb shell "run-as $PACKAGE_NAME cat /data/data/$PACKAGE_NAME/shared_prefs/FlutterSharedPreferences.xml" 2>/dev/null || {
        echo "❌ 无法读取SharedPreferences (应用可能未运行或无数据)"
        return 1
    }
}

# 场景1: 有网络首次启动
test_scenario_1() {
    echo ""
    echo "🧪 场景1: 有网络首次启动"
    echo "================================"
    
    check_backend || return 1
    check_device || return 1
    
    echo ""
    echo "步骤1: 清除应用数据"
    clear_app_data
    
    echo ""
    echo "步骤2: 确保网络连接"
    enable_network
    
    echo ""
    echo "步骤3: 启动应用"
    start_app
    
    echo ""
    echo "步骤4: 等待初始化 (10秒)..."
    sleep 10
    
    echo ""
    echo "步骤5: 查看用户数据"
    view_prefs | grep -E "user_id|invitation_code|is_offline_user"
    
    echo ""
    echo "📊 测试完成！"
    echo "期望结果:"
    echo "  - user_id格式: U{年月日时分秒}{5位随机数}"
    echo "  - invitation_code格式: INV{年月日时分秒}{5位随机数}"
    echo "  - is_offline_user: false"
}

# 场景2: 无网络首次启动
test_scenario_2() {
    echo ""
    echo "🧪 场景2: 无网络首次启动"
    echo "================================"
    
    check_device || return 1
    
    echo ""
    echo "步骤1: 清除应用数据"
    clear_app_data
    
    echo ""
    echo "步骤2: 禁用网络连接"
    disable_network
    
    echo ""
    echo "步骤3: 启动应用"
    start_app
    
    echo ""
    echo "步骤4: 等待初始化 (10秒)..."
    sleep 10
    
    echo ""
    echo "步骤5: 查看用户数据"
    view_prefs | grep -E "user_id|invitation_code|is_offline_user"
    
    echo ""
    echo "📊 测试完成！"
    echo "期望结果:"
    echo "  - user_id格式: OFFLINE_U{毫秒时间戳}{5位随机数}"
    echo "  - invitation_code格式: OFFLINE_INV{毫秒时间戳}{5位随机数}"
    echo "  - is_offline_user: true"
}

# 场景3: 离线用户网络恢复同步
test_scenario_3() {
    echo ""
    echo "🧪 场景3: 离线用户网络恢复同步"
    echo "================================"
    
    check_backend || return 1
    check_device || return 1
    
    echo ""
    echo "步骤1: 查看当前用户数据"
    view_prefs | grep -E "user_id|is_offline_user"
    
    echo ""
    read -p "确认当前是离线用户 (user_id以OFFLINE_U开头)? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 取消测试"
        return 1
    fi
    
    echo ""
    echo "步骤2: 恢复网络连接"
    enable_network
    
    echo ""
    echo "步骤3: 等待自动同步 (15秒)..."
    echo "   (请保持应用在前台运行)"
    sleep 15
    
    echo ""
    echo "步骤4: 查看同步后的用户数据"
    view_prefs | grep -E "user_id|invitation_code|is_offline_user"
    
    echo ""
    echo "📊 测试完成！"
    echo "期望结果:"
    echo "  - user_id格式: U{年月日时分秒}{5位随机数} (已更新)"
    echo "  - invitation_code格式: INV{年月日时分秒}{5位随机数} (已更新)"
    echo "  - is_offline_user: false (已更新)"
}

# 场景4: 已有账号再次启动
test_scenario_4() {
    echo ""
    echo "🧪 场景4: 已有账号再次启动"
    echo "================================"
    
    check_device || return 1
    
    echo ""
    echo "步骤1: 查看当前用户数据"
    view_prefs | grep -E "user_id|is_offline_user"
    
    echo ""
    read -p "确认已有正式账号 (user_id以U开头，非OFFLINE_)? [y/N] " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ 取消测试"
        return 1
    fi
    
    echo ""
    echo "步骤2: 重启应用"
    adb shell am force-stop $PACKAGE_NAME
    sleep 1
    start_app
    
    echo ""
    echo "步骤3: 等待启动 (5秒)..."
    sleep 5
    
    echo ""
    echo "步骤4: 验证用户数据未变化"
    view_prefs | grep -E "user_id|invitation_code|is_offline_user"
    
    echo ""
    echo "📊 测试完成！"
    echo "期望结果:"
    echo "  - user_id保持不变"
    echo "  - 启动速度快（无网络请求）"
}

# 主循环
while true; do
    show_menu
    read -p "请输入选项: " choice
    
    case $choice in
        1)
            test_scenario_1
            ;;
        2)
            test_scenario_2
            ;;
        3)
            test_scenario_3
            ;;
        4)
            test_scenario_4
            ;;
        5)
            view_logs
            ;;
        6)
            view_prefs
            ;;
        7)
            clear_app_data
            ;;
        0)
            echo "👋 再见！"
            exit 0
            ;;
        *)
            echo "❌ 无效选项"
            ;;
    esac
    
    echo ""
    echo "================================"
    read -p "按Enter继续..." dummy
    clear
done
