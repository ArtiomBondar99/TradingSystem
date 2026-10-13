import { QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { AppLayout } from './components/layout/AppLayout';
import { GuestRoute } from './components/layout/GuestRoute';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Portfolio from './pages/Portfolio';
import Register from './pages/Register';
import { queryClient } from './services/queryClient';

// Every URL of the app in one place. Layout routes (no path) wrap their
// children: GuestRoute/ProtectedRoute decide who may enter, AppLayout draws
// the top bar around the page.
const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <Login /> },
      { path: '/register', element: <Register /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Dashboard /> },
          {
            path: '/trading/:symbol?',
            // Code splitting: the chart library is big (~180 kB), so the
            // Trading page is downloaded only when someone opens it
            lazy: async () => ({
              Component: (await import('./pages/Trading')).default,
            }),
          },
          { path: '/portfolio', element: <Portfolio /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
