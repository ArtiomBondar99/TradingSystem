# Paper Trading Frontend

React + TypeScript + Vite. Work in progress: for now a single page that checks the connection to the backend.

```bash
npm install
npm run dev       # dev server; /api/* is proxied to the backend on http://localhost:3000
npm run build     # type-check + production build into dist/
npm run lint      # Oxlint
```

The backend must be running (`cd ../backend && npm run dev`) for API calls to work.
