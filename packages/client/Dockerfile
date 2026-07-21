# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# LandMind client (Vite + React static SPA), served by Caddy.
#
# Built from the REPOSITORY ROOT (npm workspaces monorepo):
#   docker build -f packages/client/Dockerfile \
#     --build-arg VITE_API_URL=https://api.example.com .
#
# On Railway, select this file via RAILWAY_DOCKERFILE_PATH=packages/client/Dockerfile
# and set VITE_API_URL as a build-time (service) variable so it is baked in.
# ---------------------------------------------------------------------------

# ---- Stage 1: build ------------------------------------------------------
FROM node:20-slim AS builder

WORKDIR /app

# Vite inlines import.meta.env.VITE_* at BUILD time, so VITE_API_URL must be
# present as an env var before `npm run build`.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

# Copy the whole repo so npm workspaces resolves correctly, then install.
COPY . .
RUN npm ci

# Build the client workspace -> packages/client/dist
RUN npm run build --workspace=@landmind/client

# ---- Stage 2: serve ------------------------------------------------------
FROM caddy:2-alpine AS runtime

# SPA static files.
COPY --from=builder /app/packages/client/dist /srv

# Caddy config: serve /srv, SPA fallback to index.html, listen on $PORT.
COPY packages/client/Caddyfile /etc/caddy/Caddyfile

# Railway injects PORT; Caddyfile reads {$PORT} with an 8080 default.
EXPOSE 8080

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
