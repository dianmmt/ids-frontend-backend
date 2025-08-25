# Simplified Makefile for SDN-IDS with ML
.PHONY: help install start stop restart clean logs test-ml health

# Colors
GREEN  := \033[32m
YELLOW := \033[33m
BLUE   := \033[34m
RED    := \033[31m
RESET  := \033[0m

help: ## Show this help message
	@echo "$(GREEN)SDN-IDS System with ML Model$(RESET)"
	@echo "$(BLUE)Available commands:$(RESET)"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(YELLOW)%-15s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Complete installation (first time setup)
	@echo "$(GREEN)Installing SDN-IDS system...$(RESET)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(YELLOW)Created .env file. Please update if needed.$(RESET)"; \
	fi
	@echo "$(BLUE)Building Docker images...$(RESET)"
	@docker-compose build
	@echo "$(BLUE)Starting services...$(RESET)"
	@docker-compose up -d
	@echo "$(YELLOW)Waiting for services to be ready...$(RESET)"
	@sleep 30
	@make health
	@echo ""
	@echo "$(GREEN)✅ Installation completed!$(RESET)"
	@echo "$(BLUE)🖥️  Frontend: http://localhost$(RESET)"
	@echo "$(BLUE)🔧 Backend API: http://localhost:3001$(RESET)"
	@echo "$(BLUE)🤖 ML API: http://localhost:5000$(RESET)"
	@echo "$(BLUE)💾 Database: localhost:5432$(RESET)"

start: ## Start all services
	@echo "$(GREEN)Starting SDN-IDS system...$(RESET)"
	@docker-compose up -d
	@echo "$(YELLOW)Waiting for services...$(RESET)"
	@sleep 20
	@make health

stop: ## Stop all services
	@echo "$(YELLOW)Stopping SDN-IDS system...$(RESET)"
	@docker-compose stop
	@echo "$(GREEN)System stopped.$(RESET)"

restart: ## Restart all services
	@echo "$(BLUE)Restarting SDN-IDS system...$(RESET)"
	@docker-compose restart
	@sleep 15
	@make health

clean: ## Stop and remove all containers and images
	@echo "$(RED)Cleaning up Docker resources...$(RESET)"
	@docker-compose down --rmi all -v --remove-orphans
	@docker system prune -f
	@echo "$(GREEN)Cleanup completed.$(RESET)"

logs: ## Show logs for all services
	@docker-compose logs -f

logs-ml: ## Show ML service logs
	@docker-compose logs -f ml

logs-backend: ## Show backend logs
	@docker-compose logs -f backend

logs-db: ## Show database logs
	@docker-compose logs -f database

health: ## Check health of all services
	@echo "$(BLUE)Checking system health...$(RESET)"
	@echo -n "Database: "
	@docker-compose exec -T database pg_isready -U sdn_user -d sdn_ids >/dev/null 2>&1 && \
		echo "$(GREEN)✓ OK$(RESET)" || echo "$(RED)✗ ERROR$(RESET)"
	@echo -n "ML Service: "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health | \
		sed 's/200/$(GREEN)✓ OK$(RESET)/; s/[45][0-9][0-9]/$(RED)✗ ERROR$(RESET)/; s/000/$(RED)✗ NO RESPONSE$(RESET)/'
	@echo ""
	@echo -n "Backend API: "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health | \
		sed 's/200/$(GREEN)✓ OK$(RESET)/; s/[45][0-9][0-9]/$(RED)✗ ERROR$(RESET)/; s/000/$(RED)✗ NO RESPONSE$(RESET)/'
	@echo ""
	@echo -n "Frontend: "
	@curl -s -o /dev/null -w "%{http_code}" http://localhost/ | \
		sed 's/200/$(GREEN)✓ OK$(RESET)/; s/[45][0-9][0-9]/$(RED)✗ ERROR$(RESET)/; s/000/$(RED)✗ NO RESPONSE$(RESET)/'
	@echo ""

test-ml: ## Test ML model prediction
	@echo "$(BLUE)Testing ML model...$(RESET)"
	@echo "$(YELLOW)1. ML Health Check:$(RESET)"
	@curl -s http://localhost:5000/health | jq '.' || echo "$(RED)ML service not responding$(RESET)"
	@echo ""
	@echo "$(YELLOW)2. Model Information:$(RESET)"
	@curl -s http://localhost:5000/model/info | jq '.' || echo "$(RED)Cannot get model info$(RESET)"
	@echo ""
	@echo "$(YELLOW)3. Test Prediction:$(RESET)"
	@curl -s http://localhost:5000/test | jq '.' || echo "$(RED)Test prediction failed$(RESET)"
	@echo ""
	@echo "$(YELLOW)4. Sample Flow Prediction:$(RESET)"
	@curl -s -X POST http://localhost:5000/predict \
		-H "Content-Type: application/json" \
		-d '{"packet_count": 1000, "byte_count": 50000, "duration_seconds": 10, "protocol": "TCP", "source_port": 80, "destination_port": 443}' | \
		jq '.' || echo "$(RED)Sample prediction failed$(RESET)"

test-api: ## Test backend API with ML integration
	@echo "$(BLUE)Testing Backend API with ML...$(RESET)"
	@echo "$(YELLOW)1. Backend Health:$(RESET)"
	@curl -s http://localhost:3001/api/health | jq '.'
	@echo ""
	@echo "$(YELLOW)2. ML Service Health via Backend:$(RESET)"
	@curl -s http://localhost:3001/api/ml/health | jq '.'
	@echo ""
	@echo "$(YELLOW)3. ML Prediction via Backend:$(RESET)"
	@curl -s -X POST http://localhost:3001/api/ml/predict \
		-H "Content-Type: application/json" \
		-d '{"packet_count": 1500, "byte_count": 75000, "duration_seconds": 15, "protocol": "TCP"}' | \
		jq '.'

dev: ## Start in development mode
	@echo "$(BLUE)Starting in development mode...$(RESET)"
	@docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
	@sleep 20
	@make health

update-model: ## Update ML model (copy new model.pkl)
	@echo "$(BLUE)Updating ML model...$(RESET)"
	@if [ ! -f ./ml/model.pkl ]; then \
		echo "$(RED)Error: model.pkl not found in ml/ directory$(RESET)"; \
		exit 1; \
	fi
	@docker-compose restart ml
	@sleep 10
	@echo "$(GREEN)Model updated successfully!$(RESET)"
	@make test-ml

backup: ## Backup database
	@echo "$(BLUE)Creating database backup...$(RESET)"
	@mkdir -p backups
	@docker-compose exec -T database pg_dump -U sdn_user sdn_ids > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup created in backups/ directory$(RESET)"

shell-ml: ## Access ML container shell
	@docker-compose exec ml bash

shell-backend: ## Access backend container shell
	@docker-compose exec backend sh

shell-db: ## Access database shell
	@docker-compose exec database psql -U sdn_user -d sdn_ids

status: ## Show container status
	@echo "$(BLUE)Container Status:$(RESET)"
	@docker-compose ps

monitor: ## Monitor system resources
	@echo "$(BLUE)System Resource Usage:$(RESET)"
	@docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

quick-demo: ## Quick demo with sample data
	@echo "$(GREEN)Running quick demo...$(RESET)"
	@make test-ml
	@echo ""
	@echo "$(BLUE)Sample attack detection:$(RESET)"
	@curl -s -X POST http://localhost:3001/api/ml/predict \
		-H "Content-Type: application/json" \
		-d '{"packet_count": 50000, "byte_count": 1000000, "duration_seconds": 1, "protocol": "TCP", "source_port": 12345, "destination_port": 80}' | \
		jq '.prediction, .confidence, .is_malicious, .attack_type'
	@echo ""
	@echo "$(GREEN)Demo completed! Check results above.$(RESET)"

setup-model: ## Setup instructions for ML model
	@echo "$(BLUE)ML Model Setup Instructions:$(RESET)"
	@echo "1. $(YELLOW)Place your trained model:$(RESET)"
	@echo "   cp your_model.pkl ml/model.pkl"
	@echo ""
	@echo "2. $(YELLOW)Update your inference script:$(RESET)"
	@echo "   cp your_inference.py ml/inference.py"
	@echo ""
	@echo "3. $(YELLOW)Update Python requirements if needed:$(RESET)"
	@echo "   edit ml/requirements.txt"
	@echo ""
	@echo "4. $(YELLOW)Test your model:$(RESET)"
	@echo "   make update-model"
	@echo "   make test-ml"
	@echo ""
	@echo "$(GREEN)Current ML files:$(RESET)"
	@ls -la ml/ 2>/dev/null || echo "$(RED)ml/ directory not found$(RESET)"