type Props = {
  // e.g. "hidden sm:inline" to show only the icon on phones
  textClassName?: string;
};

// Two candlesticks: the app's mark
export function Logo({ textClassName = '' }: Props) {
  return (
    <span className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-fg">
      <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
        <rect x="5" y="3" width="1.5" height="18" rx="0.75" fill="#26a69a" />
        <rect x="3" y="7" width="5.5" height="9" rx="1" fill="#26a69a" />
        <rect x="16" y="2" width="1.5" height="17" rx="0.75" fill="#ef5350" />
        <rect x="14" y="5" width="5.5" height="8" rx="1" fill="#ef5350" />
      </svg>
      <span className={textClassName}>PaperTrade</span>
    </span>
  );
}
