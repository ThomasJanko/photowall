# =============================================================================
# Architecture : UN seul conteneur, deux process (Next.js + Express/Socket.io).
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
ARG NEXT_PUBLIC_BACKEND=local
ARG NEXT_PUBLIC_SERVER_URL=http://localhost:4000
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_SUPABASE_URL=
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY=
ARG TARGET_DATE=

ENV NEXT_PUBLIC_BACKEND=$NEXT_PUBLIC_BACKEND
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV TARGET_DATE=$TARGET_DATE
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV SERVER_PORT=4000

# Healthcheck + outils réseau légers
RUN apk add --no-cache curl

COPY --from=builder /app/package.json /app/package-lock.json ./
# tsx : exécution du serveur Express TypeScript en prod (100 % JS, pas de native)
RUN npm ci --omit=dev && npm install tsx@4.19.2 --no-save

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/scripts ./src
COPY --from=builder /app/next.config.ts ./

# data/ est monté en volume à l'exécution (photos.json + uploads/)
RUN mkdir -p data/uploads && chmod +x scripts/start-prod.sh

EXPOSE 3000 4000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://127.0.0.1:3000/ || exit 1

CMD ["sh", "scripts/start-prod.sh"]
