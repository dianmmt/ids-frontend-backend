# SDN-IDS Project Startup Script (Docker Version)
# This script helps you start all the necessary services using Docker

Write-Host "🚀 Starting SDN-IDS Security Platform with Docker..." -ForegroundColor Green
Write-Host ""

# Check if Docker is running
Write-Host "🔍 Checking Docker service..." -ForegroundColor Yellow
try {
    $dockerStatus = docker info 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Docker is running" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker is not running or not accessible" -ForegroundColor Red
        Write-Host "   Please start Docker Desktop and try again" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "❌ Docker is not installed or not accessible" -ForegroundColor Red
    Write-Host "   Please install Docker Desktop and try again" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Start PostgreSQL database
Write-Host "🗄️ Starting PostgreSQL Database..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.db.yml up -d
    Write-Host "✅ PostgreSQL database starting..." -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start PostgreSQL database" -ForegroundColor Red
    exit 1
}

# Wait for database to be ready
Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Test database connection
Write-Host "🔍 Testing database connection..." -ForegroundColor Yellow
try {
    $testResult = docker exec sdn-ids-postgres pg_isready -U sdn_user -d sdn_ids
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database is ready!" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Database might still be starting up..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not test database connection yet..." -ForegroundColor Yellow
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
Write-Host "🗄️ PostgreSQL will be available at: localhost:5432" -ForegroundColor Cyan
Write-Host "🔧 PgAdmin will be available at: http://localhost:8080" -ForegroundColor Cyan
Write-Host ""
Write-Host "🔐 PgAdmin credentials:" -ForegroundColor Yellow
Write-Host "   Email: admin@sdn-ids.com" -ForegroundColor White
Write-Host "   Password: admin123" -ForegroundColor White
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
