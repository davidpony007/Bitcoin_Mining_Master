# Bitcoin Mining Master - 本地服务启动脚本
# 此脚本用于启动 Redis 和 MySQL 服务

Write-Host "正在启动本地开发服务..." -ForegroundColor Green

# 确保 Scoop shims 在 PATH 中
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"

# 检查 Redis 是否已在运行
Write-Host "`n检查 Redis 状态..." -ForegroundColor Yellow
try {
    $redisTest = redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "✓ Redis 已在运行" -ForegroundColor Green
    }
} catch {
    Write-Host "启动 Redis 服务器..." -ForegroundColor Yellow
    Start-Process redis-server -WindowStyle Hidden
    Start-Sleep -Seconds 2
    $redisTest = redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "✓ Redis 启动成功" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis 启动失败" -ForegroundColor Red
    }
}

# 检查 MySQL 是否已在运行
Write-Host "`n检查 MySQL 状态..." -ForegroundColor Yellow
try {
    $mysqlTest = mysql -u root -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ MySQL 已在运行" -ForegroundColor Green
    }
} catch {
    Write-Host "MySQL 未运行，需要手动启动" -ForegroundColor Yellow
    Write-Host "提示: 运行 'mysqld --console' 或在新窗口运行 'Start-Process mysqld -WindowStyle Hidden'" -ForegroundColor Cyan
}

Write-Host "`n服务状态检查完成!" -ForegroundColor Green
Write-Host "`nRedis 连接信息:" -ForegroundColor Cyan
Write-Host "  主机: localhost" -ForegroundColor White
Write-Host "  端口: 6379" -ForegroundColor White
Write-Host "`nMySQL 连接信息:" -ForegroundColor Cyan
Write-Host "  主机: localhost" -ForegroundColor White
Write-Host "  端口: 3306" -ForegroundColor White
Write-Host "  用户: root" -ForegroundColor White
Write-Host "  密码: (空)" -ForegroundColor White
Write-Host "`n提示: 如果 MySQL 未运行，请在新的 PowerShell 窗口执行:" -ForegroundColor Yellow
Write-Host "  cd '$PWD'; .\start-mysql.ps1" -ForegroundColor White
