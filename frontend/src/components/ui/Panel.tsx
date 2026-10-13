import type { ReactNode } from 'react';

type Props = {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

// The bordered box every dashboard widget sits in
export function Panel({ title, action, className = '', children }: Props) {
  return (
    <section className={`rounded-lg border border-line bg-panel ${className}`}>
      {title && (
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
