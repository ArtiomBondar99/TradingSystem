import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

// A labelled text input; every other prop goes straight to the <input>
export function FormField({ label, id, ...inputProps }: Props) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        className="w-full rounded border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
        {...inputProps}
      />
    </div>
  );
}
