# TradingSystem: Paper Trading Platform

[![CI](https://github.com/ArtiomBondar99/TradingSystem/actions/workflows/ci.yml/badge.svg)](https://github.com/ArtiomBondar99/TradingSystem/actions/workflows/ci.yml)

A stock trading simulator: analyze stocks, buy and sell with **virtual money only**, and track a portfolio. Every user starts with $100,000. No real-money trade is ever executed.

| Folder | What | Stack |
|---|---|---|
| [`backend/`](backend/README.md) | REST API, trading engine, wallet, portfolio | NestJS, TypeScript, PostgreSQL (Prisma), Redis, RabbitMQ |
| [`frontend/`](frontend/README.md) | Trading terminal UI (work in progress) | React, TypeScript, Vite |
| `docker-compose.yml` | PostgreSQL, Redis, RabbitMQ, Mailpit (+ the API with `--profile app`) | Docker |

The two apps are independent npm projects, each with its own `package.json` and lockfile.

## Getting started

Requires Node.js 24 and Docker.

```bash
cp .env.example .env              # one .env for the whole repo, then fill in the values

# Terminal 1: backend
cd backend
npm install
npm run dev                       # PostgreSQL, Redis, RabbitMQ in Docker + the API on :3000
npx prisma migrate deploy         # first run only
npx prisma db seed                # first run only

# Terminal 2: frontend
cd frontend
npm install
npm run dev                       # http://localhost:5173 (next free port if taken)
```

In development the browser only talks to the Vite dev server, which forwards `/api/*` to the backend at `http://localhost:3000` (see `frontend/vite.config.ts`), so no CORS setup is needed.

- API docs (Swagger): http://localhost:3000/docs
- RabbitMQ UI: http://localhost:15672
- Mailpit, the development inbox (password reset emails land here, never in a real mailbox): http://localhost:8025

### Backend in Docker (production-like)

```bash
docker compose --profile app up -d --build
```

## Tests

```bash
cd backend
npm test                   # unit tests
npm run test:e2e:prepare   # once, and after new migrations: creates/updates the test database
npm run test:e2e           # end-to-end, against real PostgreSQL, Redis and RabbitMQ (docker compose must be up)
```

Frontend (Vitest + React Testing Library, in jsdom: no browser or backend needed):

```bash
cd frontend
npm test                   # once
npm run test:watch         # re-runs on save
```

The backend e2e tests use their own database (`<POSTGRES_DB>_test`) and Redis keyspace (`/1`), so they can run while `npm run dev` is running.

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push to `main` and every pull request: backend lint, type check, unit tests, e2e tests against real PostgreSQL/Redis/RabbitMQ containers, and build; frontend lint, tests, type check and build; and a build of the backend Docker image.

## Market data

Two providers, chosen with `MARKET_DATA_PROVIDER` in `.env`:

- **`simulated`** (default, no API key): generated prices, labelled "Simulated data" everywhere in the UI. They follow US market hours (9:30–16:00 New York, trading days only) and stand still while the market is closed.
- **`alpaca`**: real prices from [Alpaca](https://alpaca.markets)'s market data API. Needs `ALPACA_API_KEY_ID` and `ALPACA_API_SECRET_KEY` (a free paper account is enough). The free plan streams only the IEX exchange (~2–3% of US volume), so prices can differ slightly from the consolidated market price; the UI labels them "Real-time" with that note.

Every few seconds (1 s simulated, 2 s Alpaca) the backend copies the latest prices of all stocks into the `stocks` table in a single provider request, and orders execute at that price. The e2e tests always use the simulated provider.

## Simulated trading rules

Paper trading only: no order ever reaches a real exchange. Fills follow simple, realistic rules (`backend/src/orders/execution-rules.ts`):

- **Order types**: MARKET (now), LIMIT (at the limit or better), STOP (becomes a market order once the price crosses the stop, e.g. a stop-loss).
- **Market hours**: market orders only while the US market is open (9:30–16:00 New York); LIMIT and STOP orders wait for the open.
- **Slippage**: market fills are 5 basis points (0.05%) worse than the last price; a LIMIT fill is never worse than its limit.
- **Commission**: $0.005 per share, at least $1.00, at most 1% of the trade.
- **Reservations**: open BUY orders reserve their cash (plus commission), open SELL orders their shares.

Each rule can be changed in `.env` (see `.env.example`).
