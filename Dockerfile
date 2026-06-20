# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:22-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
WORKDIR /app

# Build tools for the better-sqlite3 native module + openssl for Prisma.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# ---------- runtime stage ----------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app

# openssl is required by Prisma at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# node_modules carries the compiled better-sqlite3 binding plus the Prisma CLI
# and tsx used by the entrypoint (migrate + admin bootstrap).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Data dir (SQLite) and uploads dir are mounted as volumes in production.
RUN chmod +x docker-entrypoint.sh && mkdir -p /app/data /app/public/uploads

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
