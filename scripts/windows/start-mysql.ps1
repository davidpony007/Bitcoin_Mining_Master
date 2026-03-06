# MySQL 服务启动脚本

Write-Host "正在启动 MySQL 服务器..." -ForegroundColor Green

# 确保 Scoop shims 在 PATH 中
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"

# 启动 MySQL
Write-Host "MySQL 正在启动，请保持此窗口打开..." -ForegroundColor Yellow
Write-Host "按 Ctrl+C 可以停止 MySQL 服务" -ForegroundColor Cyan
Write-Host ""

try {
    mysqld --console
} catch {
    Write-Host "MySQL 启动出错: $_" -ForegroundColor Red
    Read-Host "按 Enter 键关闭窗口"
}
