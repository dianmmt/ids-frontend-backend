# Start SDN-IDS Database with Auto-Initialization
# This script starts the PostgreSQL database with automatic schema creation and sample data insertion

Write-Host "🚀 Starting SDN-IDS Database..." -ForegroundColor Green

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Stop any existing containers
Write-Host "🛑 Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.db.yml down

# Remove existing volume if it exists (to force re-initialization)
Write-Host "🗑️  Removing existing database volume..." -ForegroundColor Yellow
docker volume rm sdn-ids-project_postgres_data 2>$null

# Start the database
Write-Host "🚀 Starting database containers..." -ForegroundColor Green
docker-compose -f docker-compose.db.yml up -d

# Wait for PostgreSQL to be ready
Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check if containers are running
Write-Host "🔍 Checking container status..." -ForegroundColor Yellow
docker-compose -f docker-compose.db.yml ps

Write-Host ""
Write-Host "🎉 Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 Database Information:" -ForegroundColor Cyan
Write-Host "   • Database: sdn_ids" -ForegroundColor White
Write-Host "   • Username: sdn_user" -ForegroundColor White
Write-Host "   • Password: sdn_password" -ForegroundColor White
Write-Host "   • Port: 5432" -ForegroundColor White
Write-Host ""
Write-Host "🌐 pgAdmin Access:" -ForegroundColor Cyan
Write-Host "   • URL: http://localhost:8080" -ForegroundColor White
Write-Host "   • Email: admin@sdn-ids.com" -ForegroundColor White
Write-Host "   • Password: admin123" -ForegroundColor White
Write-Host ""
Write-Host "📚 What was automatically created:" -ForegroundColor Cyan
Write-Host "   • Complete database schema with 8 tables" -ForegroundColor White
Write-Host "   • Sample data for all tables" -ForegroundColor White
Write-Host "   • Indexes and triggers for performance" -ForegroundColor White
Write-Host "   • Sample users, network topology, and security events" -ForegroundColor White
Write-Host ""
Write-Host "🔧 To view the ERD diagram:" -ForegroundColor Cyan
Write-Host "   1. Open pgAdmin at http://localhost:8080" -ForegroundColor White
Write-Host "   2. Connect to the database server" -ForegroundColor White
Write-Host "   3. Right-click on 'sdn_ids' database" -ForegroundColor White
Write-Host "   4. Select 'ERD Tool'" -ForegroundColor White
Write-Host ""
Write-Host "💡 To reset the database, run this script again!" -ForegroundColor Yellow

