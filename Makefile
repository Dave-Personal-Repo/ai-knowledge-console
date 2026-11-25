.PHONY: build up down restart logs health check

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

restart:
	docker compose restart

logs:
	docker compose logs -f

health:
	curl -fsS "http://127.0.0.1:$${KCONSOLE_PORT:-4310}/api/session" | python3 -m json.tool

check:
	npm run check
	docker compose config --quiet
