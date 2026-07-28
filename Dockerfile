# =============================================================================
# Architecture : UN seul conteneur, deux process (Next.js + Express/Socket.io)
# + binaire k6 pour les tests de charge WebSocket depuis le conteneur.
#
# Pourquoi pas deux services Docker ?
# - Le front et l'API partagent le même dossier data/ (JSON + uploads).
# - Déploiement VPS en une commande, pas de réseau inter-containers à configurer.
# - scripts/start-prod.sh lance les deux process (équivalent de dev:all en prod).
#
# IMPORTANT — variables NEXT_PUBLIC_* :
# Next.js les intègre au BUILD (pas au runtime). Les passer en --build-arg
# ou via un fichier .env lu par docker compose au moment du build.
# =============================================================================

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Injectées au build Next.js — voir DOCKER.md
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:4000
ARG NEXT_PUBLIC_APP_URL=
ARG TARGET_DATE=

ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV TARGET_DATE=$TARGET_DATE
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV SERVER_PORT=4000

ARG K6_VERSION=v2.1.0

# Healthcheck + outils réseau + k6 (tests de charge Socket.io)
RUN apk add --no-cache curl ca-certificates \
  && curl -fsSL "https://github.com/grafana/k6/releases/download/${K6_VERSION}/k6-${K6_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C /tmp \
  && mv /tmp/k6-${K6_VERSION}-linux-amd64/k6 /usr/local/bin/k6 \
  && rm -rf /tmp/k6-${K6_VERSION}-linux-amd64 \
  && chmod +x /usr/local/bin/k6 \
  && k6 version

COPY --from=builder /app/package.json /app/package-lock.json ./
# tsx : exécution du serveur Express TypeScript en prod (100 % JS, pas de native)
RUN npm ci --omit=dev && npm install tsx@4.19.2 --no-save

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/tests ./tests
# tsx résout les imports server/ → ../src/... au runtime (configDb, challengesDb, adminToken)
COPY --from=builder /app/src/config ./src/config
COPY --from=builder /app/src/lib/adminToken.ts ./src/lib/adminToken.ts
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# data/ est monté en volume à l'exécution (photos.json + uploads/)
RUN mkdir -p data/uploads && chmod +x scripts/start-prod.sh

EXPOSE 3000 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD sh -c "curl -fsS http://127.0.0.1:3000/ >/dev/null && curl -fsS http://127.0.0.1:4000/health >/dev/null"

CMD ["sh", "scripts/start-prod.sh"]
