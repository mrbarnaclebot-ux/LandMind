# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# LandMind server (Express + Socket.io + Prisma + Redis)
#
# Built from the REPOSITORY ROOT (npm workspaces monorepo):
#   docker build -f packages/server/Dockerfile .
#
# On Railway, select this file via RAILWAY_DOCKERFILE_PATH=packages/server/Dockerfile
#
# node:20-slim (Debian) is used instead of alpine because Prisma's query engine
# needs glibc + openssl; alpine (musl) requires extra openssl-compat wrangling.
# ---------------------------------------------------------------------------

# ---- Stage 1: build ------------------------------------------------------
FROM node:20-slim AS builder

# Prisma needs openssl to generate/run its query engine.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the whole repo so npm workspaces resolves correctly, then install.
# (Conservative approach: a single root `npm ci` installs every workspace and
# guarantees the workspace symlinks are wired up. contracts/ etc. are excluded
# via .dockerignore.)
COPY . .

# Install all workspaces (including dev deps — tsc/prisma needed to build).
RUN npm ci

WORKDIR /app/packages/server

# Generate the Prisma client (schema at packages/server/prisma/schema.prisma).
RUN npx prisma generate

# Compile TypeScript -> dist/
RUN npm run build

# Prune dev dependencies so we can copy a lean node_modules into runtime.
WORKDIR /app
RUN npm prune --omit=dev

# ---- Stage 2: runtime ----------------------------------------------------
FROM node:20-slim AS runtime

RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

WORKDIR /app

# Root-level artifacts (workspace hoisting puts most deps in /app/node_modules).
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules

# Server workspace: package.json, compiled output, Prisma schema + migrations,
# and the generated Prisma client (+ any nested node_modules).
COPY --from=builder /app/packages/server/package.json ./packages/server/package.json
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/prisma ./packages/server/prisma
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

WORKDIR /app/packages/server

# Railway injects PORT at runtime; the app binds process.env.PORT + 0.0.0.0.
EXPOSE 3001

# Apply pending migrations, then start the server. `migrate deploy` is
# idempotent and only applies migrations that have not yet run.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
