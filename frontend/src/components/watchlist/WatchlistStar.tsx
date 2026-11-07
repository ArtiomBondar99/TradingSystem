import { useIsWatched, useToggleWatchlist } from '../../hooks/useWatchlist';

type Props = { symbol: string };

// ★ on the watchlist, ☆ not. One click adds or removes it.
export function WatchlistStar({ symbol }: Props) {
  const watched = useIsWatched(symbol);
  const toggle = useToggleWatchlist();

  return (
    <button
      type="button"
      // A toggle button: screen readers announce "pressed" / "not pressed"
      aria-pressed={watched}
      aria-label={
        watched
          ? `Remove ${symbol} from watchlist`
          : `Add ${symbol} to watchlist`
      }
      title={
        toggle.isError
          ? 'Could not update the watchlist. Try again.'
          : watched
            ? 'Remove from watchlist'
            : 'Add to watchlist'
      }
      onClick={() => toggle.mutate({ symbol, watched })}
      className={`rounded p-1 transition-colors hover:bg-panel-hover ${
        watched ? 'text-warn' : 'text-muted hover:text-fg'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="size-5"
        fill={watched ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
      </svg>
    </button>
  );
}
