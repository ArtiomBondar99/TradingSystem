import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSymbolSearch } from '../../hooks/useMarketData';

// Search box in the top bar: type a symbol or company name, pick a result
// (click, or arrows + Enter) to open its chart
export function SymbolSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debouncedQuery = useDebouncedValue(query);
  const { data: results = [] } = useSymbolSearch(debouncedQuery);

  const showResults = open && query.trim().length > 0 && results.length > 0;

  function select(symbol: string) {
    navigate(`/trading/${symbol}`);
    setQuery('');
    setOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter' && results[highlighted]) {
      select(results[highlighted].symbol);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="relative w-56">
      <input
        type="search"
        placeholder="Search symbol or company"
        aria-label="Search stocks"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="w-full rounded border border-line bg-surface px-3 py-1 text-sm outline-none placeholder:text-muted focus:border-accent"
      />

      {showResults && (
        <ul
          role="listbox"
          className="absolute top-full z-20 mt-1 w-72 overflow-hidden rounded border border-line bg-panel shadow-lg"
        >
          {results.map((result, index) => (
            <li
              key={result.symbol}
              role="option"
              aria-selected={index === highlighted}
            >
              <button
                type="button"
                // Keep focus in the input, so its onBlur doesn't close the
                // list before this click lands
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(result.symbol)}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm ${
                  index === highlighted ? 'bg-panel-hover' : ''
                }`}
              >
                <span className="font-medium">{result.symbol}</span>
                <span className="truncate text-xs text-muted">
                  {result.name}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
