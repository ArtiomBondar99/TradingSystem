# ---------- Stage 1: build ----------
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first, so Docker can cache this layer
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# prisma.config.ts requires DATABASE_URL to exist; generate doesn't connect, so a placeholder is enough
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate
RUN npm run build

# ---------- Stage 2: migrate (one-shot job) ----------
# Needs the Prisma CLI and tsx, which are dev dependencies, so it reuses the
# build stage. docker-compose runs it once, BEFORE the API starts. Running
# migrations on app startup instead would make several API replicas race.
FROM build AS migrate
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed"]

# ---------- Stage 3: production ----------
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
# --omit=optional too: the Prisma CLI (+ Studio, TypeScript...) is an optional
# peer of @prisma/client, flagged "devOptional", and --omit=dev alone keeps it.
# That's ~400MB the API never uses (migrations run in the migrate stage).
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
