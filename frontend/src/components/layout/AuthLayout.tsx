import type { ReactNode } from 'react';
import { Logo } from './Logo';
import { SimulatedBadge } from './SimulatedBadge';

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

// Centered card shared by the Login and Register pages
export function AuthLayout({ title, subtitle, children }: Props) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo />
          <SimulatedBadge />
        </div>

        <div className="rounded-lg border border-line bg-panel p-6">
          <h1 className="text-xl font-semibold">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
