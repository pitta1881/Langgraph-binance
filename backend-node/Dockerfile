# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ /build/shared/

ARG VITE_API_URL=""
RUN npm run build


# ── Stage 2: Run gateway ────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

COPY backend-node/package.json backend-node/package-lock.json ./
RUN npm ci --omit=dev

COPY backend-node/src/ ./src/
COPY shared/ /shared/

COPY --from=frontend-build /build/frontend/dist ./public/

ENV NODE_ENV=production
EXPOSE 8000

CMD ["node_modules/.bin/tsx", "src/server.ts"]
