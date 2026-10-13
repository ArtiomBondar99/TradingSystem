import { NavLink, Outlet } from 'react-router';
import { useCurrentUser } from '../../hooks/useAuth';
import { useAuthStore } from '../../hooks/useAuthStore';
import { usePortfolio } from '../../hooks/usePortfolio';
import { formatMoney } from '../../lib/format';
import { Logo } from './Logo';
import { SimulatedBadge } from './SimulatedBadge';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/trading', label: 'Trading', end: false },
  { to: '/portfolio', label: 'Portfolio', end: false },
];

// The frame around every logged-in page: top bar + the current page below
export function AppLayout() {
  const logout = useAuthStore((state) => state.logout);
  const { data: user } = useCurrentUser();
  const { data: portfolio } = usePortfolio();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-panel">
        <div className="flex h-12 items-center gap-3 px-4 sm:gap-6">
          <Logo textClassName="hidden sm:inline" />

          <nav className="flex h-full min-w-0 gap-1 overflow-x-auto">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center border-b-2 px-2 text-sm whitespace-nowrap transition-colors sm:px-3 ${
                    isActive
                      ? 'border-accent text-fg'
                      : 'border-transparent text-muted hover:text-fg'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden md:inline">
              <SimulatedBadge />
            </span>

            {portfolio && (
              <span className="hidden sm:inline">
                <span className="text-muted">Cash </span>
                <span className="font-medium tabular-nums">
                  {formatMoney(portfolio.cashBalance)}
                </span>
              </span>
            )}

            {user && (
              <span className="hidden text-muted lg:inline">
                {user.firstName} {user.lastName}
              </span>
            )}

            <button
              type="button"
              onClick={logout}
              className="rounded px-2 py-1 whitespace-nowrap text-muted transition-colors hover:bg-panel-hover hover:text-fg"
            >
              Log out
            </button>
          </div>
        </div>

        {/* Phones have no room for the badge in the bar, but it must stay
            visible: give it its own strip */}
        <div className="flex justify-center border-t border-line py-1 md:hidden">
          <SimulatedBadge />
        </div>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
