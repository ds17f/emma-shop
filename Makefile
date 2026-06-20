# Comet Tail Crafts — common commands.
# Run `make` or `make help` to see everything.

# --- config -----------------------------------------------------------------
IMAGE        ?= ghcr.io/ds17f/emma-shop
IMAGE_TAG    ?= latest
LOCAL_IMAGE  ?= emma-shop:test
# Set REMOTE_HOST to your SSH alias/host to enable `make deploy`.
REMOTE_HOST  ?=
REMOTE_PATH  ?= ~/emma-shop

.DEFAULT_GOAL := help

# --- help -------------------------------------------------------------------
.PHONY: help
help: ## Show this help
	@echo "Comet Tail Crafts — make targets:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# --- setup / dev ------------------------------------------------------------
.PHONY: install
install: ## Install dependencies (npm ci)
	npm ci

.PHONY: setup
setup: install ## First-time setup: deps + .env + migrate + seed sample data
	@test -f .env || cp .env.example .env
	@echo ">> Edit .env (AUTH_SECRET, Stripe keys, admin creds), then re-run targets below."
	npx prisma migrate dev
	npm run db:seed

.PHONY: dev
dev: ## Run the dev server (hot reload) on http://localhost:3000
	npm run dev

.PHONY: build
build: ## Production build (next build)
	npm run build

.PHONY: start
start: ## Run the production build locally (next start)
	npm start

.PHONY: lint
lint: ## Run ESLint
	npm run lint

.PHONY: typecheck
typecheck: ## Type-check without emitting
	npx tsc --noEmit

# --- database ---------------------------------------------------------------
.PHONY: db-migrate
db-migrate: ## Create + apply a dev migration (prompts for a name)
	npx prisma migrate dev

.PHONY: db-deploy
db-deploy: ## Apply pending migrations (production / non-interactive)
	npx prisma migrate deploy

.PHONY: db-seed
db-seed: ## Seed sample categories, products, and the admin user (DEV ONLY)
	npm run db:seed

.PHONY: db-studio
db-studio: ## Open Prisma Studio (browse/edit the database)
	npx prisma studio

.PHONY: db-reset
db-reset: ## DESTROY the local db, re-run migrations, re-seed (DEV ONLY)
	npx prisma migrate reset

# --- docker (local) ---------------------------------------------------------
.PHONY: docker-build
docker-build: ## Build the production Docker image locally (emma-shop:test)
	docker build -t $(LOCAL_IMAGE) .

.PHONY: docker-run
docker-run: docker-build ## Run the image locally on http://localhost:3002 (volume-backed db)
	-docker rm -f emma-local 2>/dev/null
	docker run -d --name emma-local -p 3002:3000 \
		--env-file .env \
		-e NODE_ENV=production \
		-e DATABASE_URL=file:/app/data/prod.db \
		-e AUTH_URL=http://localhost:3002 \
		-e AUTH_TRUST_HOST=true \
		-v emma-local-data:/app/data \
		-v emma-local-uploads:/app/public/uploads \
		$(LOCAL_IMAGE)
	@echo ">> http://localhost:3002  (admin at /admin)"

.PHONY: docker-logs
docker-logs: ## Tail logs from the local container
	docker logs -f emma-local

.PHONY: docker-stop
docker-stop: ## Stop + remove the local container
	-docker rm -f emma-local

.PHONY: docker-shell
docker-shell: ## Open a shell in the local container
	docker exec -it emma-local sh

# --- release / deploy -------------------------------------------------------
.PHONY: docker-push
docker-push: ## Build + push the image to GHCR (IMAGE:IMAGE_TAG vars)
	docker build -t $(IMAGE):$(IMAGE_TAG) .
	docker push $(IMAGE):$(IMAGE_TAG)

.PHONY: deploy
deploy: ## Deploy to the server (needs REMOTE_HOST=...). Pulls image + restarts.
	@test -n "$(REMOTE_HOST)" || { echo "Set REMOTE_HOST=your-ssh-host (see DEPLOY.md)"; exit 1; }
	$(MAKE) docker-push
	ssh $(REMOTE_HOST) "cd $(REMOTE_PATH) && docker compose pull && docker compose up -d"
	@echo ">> Deployed. Entrypoint runs migrations automatically."
