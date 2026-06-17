# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:22-alpine AS frontend-build

WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
COPY shared/ /build/shared/

# Vite reads VITE_* from process.env at build time. ARG declares them so
# Railway forwards the service env vars into the build context; ENV re-exports
# them so the npm build subprocess actually sees them in process.env.
ARG VITE_API_URL=""
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ARG VITE_ADMIN_EMAILS=""
ENV VITE_API_URL=$VITE_API_URL \
    VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_ADMIN_EMAILS=$VITE_ADMIN_EMAILS
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
