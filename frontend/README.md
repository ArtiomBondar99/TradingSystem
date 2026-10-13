# Paper Trading Frontend

Trading terminal UI: React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, Zustand and Axios.

```bash
npm install
npm run dev       # dev server; /api/* is proxied to the backend on http://localhost:3000
npm run build     # type-check + production build into dist/
npm run lint      # Oxlint
```

The backend must be running (`cd ../backend && npm run dev`) for API calls to work.

## Structure

```
src/
├── App.tsx                 # QueryClientProvider + every route
├── pages/                  # One component per URL: Login, Register, Dashboard, Trading, Portfolio
├── components/
│   ├── charts/             # PriceChart (Lightweight Charts), toolbar, OHLC legend, data-source badge
│   ├── layout/             # AppLayout (top bar), AuthLayout, ProtectedRoute, GuestRoute
│   ├── portfolio/          # PositionsTable
│   ├── trading/            # MarketList, QuoteHeader, SymbolSearch, MarketStatusBadge
│   └── ui/                 # Panel, StatCard, FormField, ErrorMessage
├── hooks/                  # useAuthStore (Zustand: the JWT), TanStack Query hooks
├── services/               # Axios instance + one file per backend resource, API types
└── lib/format.ts           # Money / percent display helpers
```

## Where state lives

- **Server state** (user, portfolio, stocks): TanStack Query. It handles caching, loading/error states, deduplicating requests and refetching.
- **Client state** (the JWT only): a Zustand store persisted to `localStorage`, so a refresh keeps you logged in.

The Axios instance adds `Authorization: Bearer <token>` to every request. A `401` while logged in (an expired 15-minute token) logs the user out, and `ProtectedRoute` redirects to `/login`. On logout the query cache is cleared.

Money arrives from the backend as exact strings (`"1900.00"`). The frontend only formats it for display and never calculates balances. The backend is the source of truth.
