# ── Stage 1: install all deps + build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Enable Corepack so the node:20 image uses Yarn Berry (v4)
RUN corepack enable

# Copy manifests, yarn config, and local plugin source first (needed for file: dependency)
COPY package.json yarn.lock .yarnrc.yml ./
COPY src/plugins ./src/plugins

RUN yarn install --immutable

# Copy remaining source
COPY . .

# Strapi config reads env vars at build time — provide safe dummy values
# Real values are injected at runtime via Fly.io secrets
RUN APP_KEYS=build-only-key1,build-only-key2 \
    API_TOKEN_SALT=build-only-salt \
    ADMIN_JWT_SECRET=build-only-admin-jwt \
    TRANSFER_TOKEN_SALT=build-only-transfer-salt \
    JWT_SECRET=build-only-jwt \
    ENCRYPTION_KEY=build-only-encryption \
    yarn build


# ── Stage 2: production runner ──────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# NOTE: deliberately no `corepack enable` here. package.json pins
# packageManager=yarn@4.9.3 (needed so the builder's `yarn install --immutable`
# honors the Berry lockfile), but the runner never runs an install — it only
# receives node_modules from the builder. Enabling corepack here made Berry
# activate against a directory with no install state and abort with
# "The project in /app/package.json doesn't seem to have been installed",
# and made every container boot download yarn.js from the network first.
# The runtime invokes the strapi binary directly instead of going through yarn.

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

# Runtime files only
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/.strapi ./.strapi
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/favicon.png ./favicon.png

EXPOSE 1337

CMD ["node", "node_modules/.bin/strapi", "start"]
