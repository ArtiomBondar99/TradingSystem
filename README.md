# Paper Trading Backend

A backend for simulated stock trading using virtual money.

Built with NestJS, TypeScript, PostgreSQL and Prisma.

## Getting started

Requires Node.js 24 and Docker.

```bash
npm install
cp .env.example .env        # then fill in the values
npm run dev                 # starts PostgreSQL in Docker + the API in watch mode
npx prisma migrate deploy   # first run only: create the tables
```

The API runs on `http://localhost:3000`. It restarts automatically when you save a file.

To run the API itself in Docker instead (production-like):

```bash
docker compose --profile app up -d --build
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start PostgreSQL + the API in watch mode |
| `npm run start:dev` | Start the API in watch mode (database must already be running) |
| `npm run build` | Compile to `dist/` |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (needs PostgreSQL) |
| `npm run lint` | Lint |

## API testing

Import [`postman/paper-trading.postman_collection.json`](postman/paper-trading.postman_collection.json) into Postman and run **Auth → Login** first; the token is saved automatically.

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/health` | – | Service and database health check |
| POST | `/auth/register` | – | Create an account (starts with $100,000) |
| POST | `/auth/login` | – | Get a JWT access token |
| GET | `/users/me` | Bearer | Current user's profile |
| GET | `/wallet` | Bearer | Current user's cash balance |
