# Paper Trading Backend

A backend for simulated stock trading with virtual money: every user starts with $100,000, buys and sells stocks at market price, and tracks their portfolio and trade history.

Built with NestJS, TypeScript, PostgreSQL (Prisma), Redis, RabbitMQ and Docker.

## Highlights

- **Safe under concurrency**: every order locks the user's wallet row (`SELECT ... FOR UPDATE`), so parallel requests can never spend the same cash or sell the same shares twice. Proven by e2e tests that fire 10 orders at once.
- **Idempotent orders**: send an `Idempotency-Key` header and a retried request returns the original order instead of trading again.
- **Exact money math**: `Decimal` everywhere, never JS floats; money is returned as strings like `"190.00"`.
- **Transactional outbox**: an `order.filled` event is saved in the same database transaction as the trade, then relayed to RabbitMQ. No event is lost, and no event is sent for a trade that didn't happen.
- **Redis cache** for stock prices, which fails open: if Redis is down, the API keeps serving from PostgreSQL.
- **Immutable audit trail**: executed trades are stored in a `transactions` table that a database trigger prevents from being updated or deleted.
- One error format for every response, with a `requestId` to find the request in the structured (Pino) logs.

## Getting started

Requires Node.js 24 and Docker.

```bash
npm install
cp .env.example .env        # then fill in the values
npm run dev                 # starts PostgreSQL, Redis and RabbitMQ in Docker + the API in watch mode
npx prisma migrate deploy   # first run only: create the tables
npx prisma db seed          # first run only: add the starting stocks (safe to re-run)
```

- API: `http://localhost:3000`
- **Interactive API docs (Swagger): `http://localhost:3000/docs`**
- RabbitMQ management UI: `http://localhost:15672`

### Everything in Docker (production-like)

```bash
docker compose --profile app up -d --build
```

This builds the API image, runs a one-shot `migrate` container (migrations + seed), and starts the API only after it succeeds.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start PostgreSQL, Redis, RabbitMQ + the API in watch mode |
| `npm run start:dev` | Start the API in watch mode (infrastructure must already be running) |
| `npm run build` | Compile to `dist/` |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs PostgreSQL and RabbitMQ) |
| `npm run lint` | Lint |

## Endpoints

Full request/response schemas are in Swagger at `/docs`.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | Service and database health check |
| POST | `/auth/register` | – | Create an account (starts with $100,000) |
| POST | `/auth/login` | – | Get a JWT access token |
| GET | `/users/me` | Bearer | Current user's profile |
| GET | `/wallet` | Bearer | Current user's cash balance |
| GET | `/stocks` | – | All tradable stocks with current prices (cached) |
| GET | `/stocks/:symbol` | – | One stock, e.g. `/stocks/AAPL` |
| POST | `/orders` | Bearer | Buy or sell at market price. Optional `Idempotency-Key` header |
| GET | `/portfolio` | Bearer | Holdings, market value and unrealized profit/loss |
| GET | `/transactions` | Bearer | Trade history, newest first, cursor-paginated (`?limit=&cursor=`) |

## API testing

Use Swagger at `/docs`, or import [`postman/paper-trading.postman_collection.json`](postman/paper-trading.postman_collection.json) into Postman and run **Auth → Login** first; the token is saved automatically.
