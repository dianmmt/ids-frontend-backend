# Database Auto-Initialization

This directory contains scripts that automatically run when the PostgreSQL container starts for the first time.

## How It Works

PostgreSQL automatically executes all `.sql` files in the `/docker-entrypoint-initdb.d` directory when the database is first created. The files are executed in alphabetical order.

## Scripts

### 01-init-schema.sql
- Creates all core database tables, indexes, and triggers
- Consolidated production schema: keeps only tables used by backend services
- Includes: `users`, `network_nodes`, `network_flows`, `ml_models`, `attack_detections`,
  `performance_metrics`, `security_rules`, `audit_logs`, and performance tables used by the app:
  `performance_alerts`, `ml_performance`, `database_performance`, `network_statistics`, `system_health`
- Removed legacy dev-only tables/views: `system_metrics`, `performance_history`, related triggers/functions
- Runs first (alphabetical order)

### 02-insert-sample-data.sql
- Inserts sample data for testing and development
- Includes users, network nodes, flows, attack detections, metrics, and alerts
- Runs second (alphabetical order)

### 03-model-registry.sql
- Adds model registry tables: `model_registry`, `model_artifacts`
- Adds `folder_path` column to `ml_models` and supportive views/triggers
- Runs third (alphabetical order)

## What Happens on First Run

1. **Database Creation**: PostgreSQL creates the `sdn_ids` database
2. **Schema Creation**: `01-init-schema.sql` creates all tables and structures
3. **Sample Data**: `02-insert-sample-data.sql` populates tables with realistic data
4. **Model Registry**: `03-model-registry.sql` adds secure model storage
5. **Ready to Use**: Database is immediately available with full schema and sample data

## Sample Data Includes

- **Users**: admin, analysts, viewers with different roles
- **Network Topology**: Controller, switches, hosts with realistic IPs
- **ML Models**: Sample machine learning models with performance metrics
- **Network Flows**: Sample traffic flows with risk scores
- **Attack Detections**: Various security events (DDoS, SQL injection, etc.)
- **Performance Metrics**: CPU, memory, and flow statistics
- **Security Rules**: Firewall and IDS rules
- **Audit Logs**: Sample system activity logs
 - **Performance Tables**: ML, DB, network, health snapshots; alerts

## Accessing the Database

### pgAdmin
- URL: http://localhost:8080
- Email: admin@sdn-ids.com
- Password: admin123

### Direct Connection
- Host: localhost
- Port: 5432
- Database: sdn_ids
- Username: sdn_user
- Password: sdn_password

## ERD Tool in pgAdmin

1. Open pgAdmin in your browser
2. Connect to the database server
3. Right-click on the `sdn_ids` database
4. Select "ERD Tool" to view the database schema diagram
5. All tables and relationships will be automatically displayed

## Resetting the Database

To reset and reinitialize the database:

1. Stop the containers: `docker-compose -f docker-compose.db.yml down`
2. Remove the volume: `docker volume rm sdn-ids-project_postgres_data`
3. Start again: `docker-compose -f docker-compose.db.yml up -d`

## Notes

- Scripts only run on first database creation
- If you need to re-run scripts, you must remove the PostgreSQL data volume
- All scripts use `IF NOT EXISTS` and `ON CONFLICT` to prevent errors
- Sample data is realistic and suitable for development/testing

