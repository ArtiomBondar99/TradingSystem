import { getErrorMessage } from '../../services/api';

type Props = { error: unknown };

export function ErrorMessage({ error }: Props) {
  return (
    <p
      role="alert"
      className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down"
    >
      {getErrorMessage(error)}
    </p>
  );
}
