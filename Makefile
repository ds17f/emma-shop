# Comet Tail Crafts — common commands.
# Run `make` or `make help` to see everything.

# --- config -----------------------------------------------------------------
IMAGE        ?= ghcr.io/ds17f/emma-shop
IMAGE_TAG    ?= latest
LOCAL_IMAGE  ?= emma-shop:test

# Deploy target. emma-shop is a guest on the same Hetzner box deadly's prod runs
# on, but it does NOT reach into deadly's repo. The server's IP is resolved live
# from the Hetzner Cloud API (the source of truth), so a recreated box just works.
#   HCLOUD_TOKEN  Hetzner API token (export it; same one deadly uses). Required
#                 unless you set REMOTE_HOST yourself.
#   REMOTE_HOST   Override auto-resolution with an explicit host/ssh-config alias.
#   SSH_KEY       Optional path to the private key; omit to use ssh-agent/config.
# If .secrets/ holds the token/key (e.g. symlinked from deadly-monorepo), use
# them automatically; otherwise fall back to the env / ssh-agent. .secrets/ is
# gitignored, so this never leaks into the repo.
HCLOUD_TOKEN ?= $(shell tr -d '[:space:]' < .secrets/hetzner-key.txt 2>/dev/null)
HCLOUD_LABEL ?= env=prod
SSH_USER     ?= deploy
SSH_KEY      ?= $(wildcard .secrets/ssh-key-2026-03-15.key)
REMOTE_HOST  ?=
REMOTE_PATH  ?= /opt/emma-shop

SSH_OPTS  = $(if $(SSH_KEY),-i $(SSH_KEY),)
SERVER_IP = $(shell curl -sf -H "Authorization: Bearer $(HCLOUD_TOKEN)" \
              "https://api.hetzner.cloud/v1/servers?label_selector=$(HCLOUD_LABEL)" \
              | python3 -c "import sys,json;print(json.load(sys.stdin)['servers'][0]['public_net']['ipv4']['ip'])" 2>/dev/null)
DEPLOY_TARGET = $(if $(REMOTE_HOST),$(REMOTE_HOST),$(SSH_USER)@$(SERVER_IP))

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

.PHONY: server-ip
server-ip: ## Print the box's current public IP (resolved from the Hetzner API)
	@test -n "$(HCLOUD_TOKEN)" || { echo "Set HCLOUD_TOKEN to resolve the server."; exit 1; }
	@test -n "$(SERVER_IP)" || { echo "No server found for label '$(HCLOUD_LABEL)' (check HCLOUD_TOKEN)."; exit 1; }
	@echo "$(SERVER_IP)"

.PHONY: deploy
deploy: ## Build+push image, resolve the box from Hetzner, then pull+restart there
	@if [ -z "$(REMOTE_HOST)" ] && [ -z "$(HCLOUD_TOKEN)" ]; then \
		echo "Set HCLOUD_TOKEN (Hetzner API token) to auto-resolve the server,"; \
		echo "or REMOTE_HOST=<host|ssh-alias> to target it directly. See DEPLOY.md."; exit 1; fi
	@test -n "$(REMOTE_HOST)$(SERVER_IP)" || { echo "Could not resolve server IP from Hetzner (check HCLOUD_TOKEN / label '$(HCLOUD_LABEL)')."; exit 1; }
	$(MAKE) docker-push
	@echo ">> Deploying $(IMAGE):$(IMAGE_TAG) to $(DEPLOY_TARGET):$(REMOTE_PATH)"
	scp $(SSH_OPTS) docker-compose.yml $(DEPLOY_TARGET):$(REMOTE_PATH)/
	ssh $(SSH_OPTS) $(DEPLOY_TARGET) \
		"cd $(REMOTE_PATH) && IMAGE_TAG=$(IMAGE_TAG) docker compose pull && IMAGE_TAG=$(IMAGE_TAG) docker compose up -d && docker image prune -f"
	@echo ">> Deployed. Entrypoint applies migrations + ensures the admin automatically."
