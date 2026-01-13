# 停止本地服务脚本

Write-Host "正在停止本地开发服务..." -ForegroundColor Yellow

# 确保 Scoop shims 在 PATH 中
$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"

# 停止 Redis
Write-Host "`n停止 Redis..." -ForegroundColor Yellow
try {
    redis-cli shutdown
    Write-Host "✓ Redis 已停止" -ForegroundColor Green
} catch {
    Write-Host "Redis 可能未运行或已停止" -ForegroundColor Gray
}

# 停止 MySQL
Write-Host "`n停止 MySQL..." -ForegroundColor Yellow
try {
    mysqladmin -u root shutdown
    Write-Host "✓ MySQL 已停止" -ForegroundColor Green
} catch {
    Write-Host "MySQL 可能未运行或已停止" -ForegroundColor Gray
}

Write-Host "`n所有服务已停止!" -ForegroundColor Green
