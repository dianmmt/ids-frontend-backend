# SDN-IDS Project Startup Script
# This script helps you start all the necessary services

Write-Host "🚀 Starting SDN-IDS Security Platform..." -ForegroundColor Green
Write-Host ""

# Check if PostgreSQL is running
Write-Host "🔍 Checking PostgreSQL service..." -ForegroundColor Yellow
try {
    $pgStatus = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if ($pgStatus -and $pgStatus.Status -eq "Running") {
        Write-Host "✅ PostgreSQL is running" -ForegroundColor Green
    } else {
        Write-Host "⚠️ PostgreSQL service not found or not running" -ForegroundColor Yellow
        Write-Host "   Please ensure PostgreSQL is installed and running" -ForegroundColor Yellow
        Write-Host "   You can start it manually or install it if needed" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not check PostgreSQL service status" -ForegroundColor Yellow
}

Write-Host ""

# Start Backend
Write-Host "🔧 Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev" -WindowStyle Normal
Write-Host "✅ Backend server starting in new window" -ForegroundColor Green

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "🎨 Starting Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev" -WindowStyle Normal
Write-Host "✅ Frontend starting in new window" -ForegroundColor Green

Write-Host ""
Write-Host "🎉 SDN-IDS Platform is starting up!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Frontend will be available at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔌 Backend API will be available at: http://localhost:3001" -ForegroundColor Cyan
Write-Host "📊 Health check: http://localhost:3001/api/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔐 Default login credentials:" -ForegroundColor Yellow
Write-Host "   Admin: admin / admin123" -ForegroundColor White
Write-Host "   Analyst: analyst / analyst123" -ForegroundColor White
Write-Host "   Viewer: viewer / viewer123" -ForegroundColor White
Write-Host ""
Write-Host "⚠️ Remember to change default passwords in production!" -ForegroundColor Red
Write-Host ""
Write-Host "Press any key to exit this startup script..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
