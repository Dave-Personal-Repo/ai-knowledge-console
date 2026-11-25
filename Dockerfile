# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

LABEL org.opencontainers.image.title="ai-knowledge-console" \
      org.opencontainers.image.description="Owner-gated console for the AI knowledge hub" \
      org.opencontainers.image.source="https://github.com/Dave-Personal-Repo/ai-knowledge-console"

# git + gh + python3 are what the hub's `kb` CLI needs to verify the GitHub identity.
# curl is for the healthcheck; gosu lets the entrypoint fix mounted permissions before dropping root.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl git gh python3 gosu \
  && rm -rf /var/lib/apt/lists/*

# UID/GID 1001 matches the bot image so state volumes stay consistent across projects.
RUN groupadd --system --gid 1001 console \
  && useradd --system --uid 1001 --gid console --create-home --home-dir /home/console console \
  && mkdir -p /app /knowledge /home/console/.config/gh /home/console/.local/state \
  && chown -R console:console /app /home/console

WORKDIR /app

COPY --chown=console:console package.json ./
COPY --chown=console:console server.js ./
COPY --chown=console:console public ./public
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ENV HOME=/home/console \
    HOST=0.0.0.0 \
    PORT=4310 \
    KB_ROOT=/knowledge/ai-knowledge \
    KB_SENSITIVE_ROOT=/knowledge/ai-knowledge-sensitive \
    GH_CONFIG_DIR=/home/console/.config/gh \
    PATH=/knowledge/ai-knowledge/scripts:${PATH} \
    TZ=UTC

EXPOSE 4310

HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/api/session" | grep -q '"allowed":true' || exit 1

# Root only long enough to prepare the read-only auth mount and the state volume.
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/app/server.js"]
