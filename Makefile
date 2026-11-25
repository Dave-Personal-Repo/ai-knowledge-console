# ai-knowledge-console — everyday commands.
#
# `make` with no target prints this list. State copied from the host stays in .agent-auth/,
# which is gitignored; nothing here writes to the knowledge clones.

SHELL := /bin/bash
.DEFAULT_GOAL := help

COMPOSE := docker compose
PORT := $(shell sed -n 's/^KCONSOLE_PORT=//p' .env 2>/dev/null | tail -n1)
PORT := $(if $(PORT),$(PORT),4310)

.PHONY: help auth opencode-auth up down restart logs logs-tail status health ui open shell build prune test check clean

help: ## Show this help
	@echo "ai-knowledge-console"
	@echo ""
	@awk 'BEGIN { FS = ":.*?## " } /^[a-zA-Z_-]+:.*?## / { printf "  \033[36m%-13s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "First time here?  make up"

# ---------------------------------------------------------------- setup

auth: ## Copy host OpenAI, Anthropic, OpenCode and Codex/Claude state into .agent-auth/
	@./scripts/agent-auth.sh

opencode-auth: auth ## Alias for auth

# ---------------------------------------------------------------- run

up: auth ## Refresh auth, build, start detached, and open the dashboard
	@./scripts/docker-up.sh

down: ## Stop the container (keeps its state volume)
	@$(COMPOSE) down

restart: auth ## Refresh auth, rebuild, and recreate the container
	@$(COMPOSE) down
	@./scripts/docker-up.sh

logs: ## Follow the logs (Ctrl-C stops following, the console keeps running)
	@$(COMPOSE) logs -f --tail=200

logs-tail: ## Print the last 200 log lines and return
	@$(COMPOSE) logs --tail=200

status: ## Container state, health, and the dashboard URL
	@$(COMPOSE) ps
	@echo ""
	@echo "Dashboard: http://127.0.0.1:$(PORT)/"
	@if curl -fsS --max-time 3 "http://127.0.0.1:$(PORT)/api/session" | grep -q '"allowed":true'; then \
	  echo "Health:    UP"; \
	else \
	  echo "Health:    not authorised — try: make logs"; \
	fi

health: ## Print the session gate JSON
	@curl -fsS "http://127.0.0.1:$(PORT)/api/session" | python3 -m json.tool

ui: ## Open the dashboard in the default browser
	@url="http://127.0.0.1:$(PORT)/"; \
	echo "Opening $$url"; \
	if command -v open >/dev/null 2>&1; then open "$$url"; \
	elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$$url"; \
	else echo "Open $$url manually"; fi

open: ui ## Alias for ui

shell: ## Open a shell in the running container
	@$(COMPOSE) exec console sh

# ---------------------------------------------------------------- development

build: ## Build the image without starting it (old images are deleted)
	@$(COMPOSE) build
	@./scripts/docker-prune.sh

prune: ## Delete old console images left by earlier builds
	@./scripts/docker-prune.sh

test: ## Run the local test suite
	@npm test

check: ## Check JS syntax and Compose config
	@npm run check
	@$(COMPOSE) config --quiet

clean: ## Stop the container AND delete its state volume (destructive)
	@printf 'This deletes the container and its state volume. Continue? [y/N] '; \
	read -r answer; \
	case "$$answer" in \
	  y|Y) $(COMPOSE) down -v --remove-orphans ;; \
	  *) echo "cancelled" ;; \
	esac
