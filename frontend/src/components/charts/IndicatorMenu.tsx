import { useEffect, useRef, useState } from 'react';
import {
  INDICATORS,
  useIndicatorSettings,
  type IndicatorId,
} from '../../hooks/useIndicatorSettings';
import { INDICATOR_COLORS } from './indicatorLayers';

type Props = {
  // VWAP is only offered on intraday charts
  intraday: boolean;
};

const IDS = Object.keys(INDICATORS) as IndicatorId[];

// "Indicators" button in the chart toolbar, with a panel to switch each
// indicator on/off and edit its parameters
export function IndicatorMenu({ intraday }: Props) {
  const { settings, toggle, setParam, reset } = useIndicatorSettings();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeCount = IDS.filter(
    (id) => id !== 'volume' && settings[id].enabled,
  ).length;

  // Close when clicking anywhere outside the menu
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`rounded px-2 py-1 text-xs whitespace-nowrap transition-colors ${
          open || activeCount > 0
            ? 'bg-panel-hover text-fg'
            : 'text-muted hover:text-fg'
        }`}
      >
        Indicators{activeCount > 0 && ` (${activeCount})`}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Indicators"
          className="absolute top-full right-0 z-30 mt-1 w-80 rounded-lg border border-line bg-panel p-2 shadow-xl sm:right-auto sm:left-0"
        >
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
            {IDS.map((id) => {
              const definition = INDICATORS[id];
              const setting = settings[id];
              const unavailable = definition.intradayOnly && !intraday;
              const color =
                INDICATOR_COLORS[id as keyof typeof INDICATOR_COLORS];

              return (
                <li key={id} className="py-2">
                  <label
                    className={`flex items-start gap-2 px-1 ${unavailable ? 'opacity-50' : 'cursor-pointer'}`}
                  >
                    <input
                      type="checkbox"
                      checked={setting.enabled && !unavailable}
                      disabled={unavailable}
                      onChange={() => toggle(id)}
                      className="mt-0.5 accent-accent"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-sm">
                        {color && (
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        )}
                        {definition.label}
                        {definition.placement === 'pane' && (
                          <span className="text-[10px] text-muted">
                            own pane
                          </span>
                        )}
                      </span>
                      <span className="block text-xs text-muted">
                        {unavailable
                          ? 'Intraday timeframes only (below 1D)'
                          : definition.description}
                      </span>
                    </span>
                  </label>

                  {setting.enabled &&
                    !unavailable &&
                    Object.keys(definition.params).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2 pl-7">
                        {Object.entries(definition.params).map(
                          ([param, range]) => (
                            <NumberField
                              // A new value from outside (e.g. "Reset") gives
                              // a fresh field instead of syncing state in an effect
                              key={`${param}:${setting.params[param]}`}
                              label={range.label}
                              value={setting.params[param]}
                              min={range.min}
                              max={range.max}
                              step={range.step}
                              onCommit={(value) => setParam(id, param, value)}
                            />
                          ),
                        )}
                      </div>
                    )}
                </li>
              );
            })}
          </ul>

          <button
            type="button"
            onClick={reset}
            className="mt-1 w-full rounded px-2 py-1 text-xs text-muted hover:bg-panel-hover hover:text-fg"
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
};

// Typing "1" on the way to "14" must not fetch an RSI(1): the value is only
// committed on Enter or when the field loses focus, and clamped to range
function NumberField({
  label,
  value,
  min,
  max,
  step,
  onCommit,
}: NumberFieldProps) {
  const [draft, setDraft] = useState(String(value));

  function commit() {
    const parsed = Number(draft);
    if (draft.trim() === '' || Number.isNaN(parsed)) {
      setDraft(String(value));
      return;
    }
    const clamped = Math.min(Math.max(parsed, min), max);
    const rounded = step >= 1 ? Math.round(clamped) : clamped;
    setDraft(String(rounded));
    if (rounded !== value) {
      onCommit(rounded);
    }
  }

  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      {label}
      <input
        type="number"
        inputMode="decimal"
        value={draft}
        min={min}
        max={max}
        step={step}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => event.key === 'Enter' && commit()}
        className="w-16 rounded border border-line bg-surface px-1.5 py-0.5 text-fg tabular-nums outline-none focus:border-accent"
      />
    </label>
  );
}
