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

# ---------- Stage 2: production ----------
FROM node:24-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/main.js"]
