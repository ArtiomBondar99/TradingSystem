# TradingSystem: Paper Trading Platform

A stock trading simulator: analyze stocks, buy and sell with **virtual money only**, and track a portfolio. Every user starts with $100,000. No real-money trade is ever executed.

| Folder | What | Stack |
|---|---|---|
| [`backend/`](backend/README.md) | REST API, trading engine, wallet, portfolio | NestJS, TypeScript, PostgreSQL (Prisma), Redis, RabbitMQ |
| [`frontend/`](frontend/README.md) | Trading terminal UI (work in progress) | React, TypeScript, Vite |
| `docker-compose.yml` | PostgreSQL, Redis, RabbitMQ (+ the API with `--profile app`) | Docker |

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

The e2e tests use their own database (`<POSTGRES_DB>_test`) and Redis keyspace (`/1`), so they can run while `npm run dev` is running.

## Market data

Prices come from a **simulated** provider (no API key needed), labelled "Simulated data" everywhere in the UI. They follow US market hours (9:30–16:00 New York, trading days only) and stand still while the market is closed. Every 5 seconds the backend copies the latest price into the `stocks` table, and orders execute at that price.

## Simulated trading rules

Paper trading only: no order ever reaches a real exchange. Fills follow simple, realistic rules (`backend/src/orders/execution-rules.ts`):

- **Order types**: MARKET (now), LIMIT (at the limit or better), STOP (becomes a market order once the price crosses the stop, e.g. a stop-loss).
- **Market hours**: market orders only while the US market is open (9:30–16:00 New York); LIMIT and STOP orders wait for the open.
- **Slippage**: market fills are 5 basis points (0.05%) worse than the last price; a LIMIT fill is never worse than its limit.
- **Commission**: $0.005 per share, at least $1.00, at most 1% of the trade.
- **Reservations**: open BUY orders reserve their cash (plus commission), open SELL orders their shares.

Each rule can be changed in `.env` (see `.env.example`).
