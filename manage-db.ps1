# SDN-IDS Database Management Script
# This script helps you manage the PostgreSQL database in Docker

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("start", "stop", "restart", "status", "logs", "reset", "backup", "restore")]
    [string]$Action = "status"
)

Write-Host "🗄️ SDN-IDS Database Management" -ForegroundColor Green
Write-Host ""

switch ($Action) {
    "start" {
        Write-Host "🚀 Starting PostgreSQL database..." -ForegroundColor Yellow
        docker-compose -f docker-compose.db.yml up -d
        Write-Host "✅ Database started successfully!" -ForegroundColor Green
        Write-Host "⏳ Waiting for database to be ready..." -ForegroundColor Yellow
        Start-Sleep -Seconds 10
        Write-Host "🔍 Testing connection..." -ForegroundColor Yellow
        docker exec sdn-ids-postgres pg_isready -U sdn_user -d sdn_ids
    }
    
    "stop" {
        Write-Host "🛑 Stopping PostgreSQL database..." -ForegroundColor Yellow
        docker-compose -f docker-compose.db.yml down
        Write-Host "✅ Database stopped successfully!" -ForegroundColor Green
    }
    
    "restart" {
        Write-Host "🔄 Restarting PostgreSQL database..." -ForegroundColor Yellow
        docker-compose -f docker-compose.db.yml restart
        Write-Host "✅ Database restarted successfully!" -ForegroundColor Green
    }
    
    "status" {
        Write-Host "📊 Database Status:" -ForegroundColor Yellow
        docker-compose -f docker-compose.db.yml ps
        
        Write-Host "`n🔍 Connection Test:" -ForegroundColor Yellow
        try {
            $result = docker exec sdn-ids-postgres pg_isready -U sdn_user -d sdn_ids 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ Database is ready and accepting connections" -ForegroundColor Green
            } else {
                Write-Host "❌ Database is not ready" -ForegroundColor Red
            }
        } catch {
            Write-Host "❌ Could not test database connection" -ForegroundColor Red
        }
        
        Write-Host "`n🌐 Services:" -ForegroundColor Yellow
        Write-Host "   PostgreSQL: localhost:5432" -ForegroundColor Cyan
        Write-Host "   PgAdmin: http://localhost:8080" -ForegroundColor Cyan
    }
    
    "logs" {
        Write-Host "📋 Database Logs:" -ForegroundColor Yellow
        docker-compose -f docker-compose.db.yml logs postgres
    }
    
    "reset" {
        Write-Host "⚠️ WARNING: This will delete all data and recreate the database!" -ForegroundColor Red
        $confirm = Read-Host "Are you sure? Type 'yes' to continue"
        if ($confirm -eq "yes") {
            Write-Host "🗑️ Removing database containers and volumes..." -ForegroundColor Yellow
            docker-compose -f docker-compose.db.yml down -v
            Write-Host "🚀 Recreating database..." -ForegroundColor Yellow
            docker-compose -f docker-compose.db.yml up -d
            Write-Host "✅ Database reset completed!" -ForegroundColor Green
        } else {
            Write-Host "❌ Database reset cancelled" -ForegroundColor Yellow
        }
    }
    
    "backup" {
        $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
        $backupFile = "sdn-ids-backup-$timestamp.sql"
        Write-Host "💾 Creating database backup: $backupFile" -ForegroundColor Yellow
        
        try {
            docker exec sdn-ids-postgres pg_dump -U sdn_user -d sdn_ids > $backupFile
            Write-Host "✅ Backup created successfully: $backupFile" -ForegroundColor Green
        } catch {
            Write-Host "❌ Backup failed" -ForegroundColor Red
        }
    }
    
    "restore" {
        Write-Host "📁 Available backup files:" -ForegroundColor Yellow
        Get-ChildItem -Filter "sdn-ids-backup-*.sql" | ForEach-Object { Write-Host "   $($_.Name)" -ForegroundColor Cyan }
        
        $backupFile = Read-Host "Enter backup filename to restore"
        if (Test-Path $backupFile) {
            Write-Host "🔄 Restoring database from: $backupFile" -ForegroundColor Yellow
            try {
                Get-Content $backupFile | docker exec -i sdn-ids-postgres psql -U sdn_user -d sdn_ids
                Write-Host "✅ Database restored successfully!" -ForegroundColor Green
            } catch {
                Write-Host "❌ Restore failed" -ForegroundColor Red
            }
        } else {
            Write-Host "❌ Backup file not found: $backupFile" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "💡 Usage:" -ForegroundColor Yellow
Write-Host "   .\manage-db.ps1 start     - Start the database" -ForegroundColor White
Write-Host "   .\manage-db.ps1 stop      - Stop the database" -ForegroundColor White
Write-Host "   .\manage-db.ps1 restart   - Restart the database" -ForegroundColor White
Write-Host "   .\manage-db.ps1 status    - Show database status" -ForegroundColor White
Write-Host "   .\manage-db.ps1 logs      - Show database logs" -ForegroundColor White
Write-Host "   .\manage-db.ps1 reset     - Reset database (delete all data)" -ForegroundColor White
Write-Host "   .\manage-db.ps1 backup    - Create database backup" -ForegroundColor White
Write-Host "   .\manage-db.ps1 restore   - Restore database from backup" -ForegroundColor White
