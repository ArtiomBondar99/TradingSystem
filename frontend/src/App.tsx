import { useEffect, useState } from 'react';

// Shape of GET /health (backend/src/health/health.service.ts)
type Health = { status: string; database: string };

// Phase 1 placeholder: proves the frontend reaches the backend through the
// Vite proxy (/api/health -> http://localhost:3000/health). Replaced by the
// real layout and routes in Phase 2.
function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json() as Promise<Health>;
      })
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  return (
    <main>
      <h1>Paper Trading</h1>
      {health && (
        <p className="status-up">
          Backend: {health.status} (database: {health.database})
        </p>
      )}
      {error && <p className="status-down">Backend unreachable: {error}</p>}
      {!health && !error && <p>Checking backend…</p>}
    </main>
  );
}

export default App;
