# Check Local Services Status
Write-Host "Checking local development services status..." -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Gray

$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"

# Check Redis
Write-Host "`n[Redis Status]" -ForegroundColor Yellow
try {
    $redisVersion = redis-server --version 2>&1 | Select-Object -First 1
    Write-Host "  Version: $redisVersion" -ForegroundColor White
    
    $redisTest = redis-cli ping 2>&1
    if ($redisTest -eq "PONG") {
        Write-Host "  Status: Running" -ForegroundColor Green
    } else {
        Write-Host "  Status: Not Running" -ForegroundColor Red
    }
} catch {
    Write-Host "  Status: Not Installed" -ForegroundColor Red
}

# Check MySQL
Write-Host "`n[MySQL Status]" -ForegroundColor Yellow
try {
    $mysqlVersion = mysql --version 2>&1
    Write-Host "  Version: $mysqlVersion" -ForegroundColor White
    
    $mysqlTest = mysql -u root -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  Status: Running" -ForegroundColor Green
    } else {
        Write-Host "  Status: Not Running" -ForegroundColor Red
    }
} catch {
    Write-Host "  Status: Not Installed" -ForegroundColor Red
}

# Check Node.js
Write-Host "`n[Node.js Status]" -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    $npmVersion = npm --version 2>&1
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
    Write-Host "  npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  Status: Not Installed" -ForegroundColor Red
}

Write-Host "`n" + "=" * 50 -ForegroundColor Gray
Write-Host "Check Complete!" -ForegroundColor Cyan
