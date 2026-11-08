import { useState, type SubmitEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthLayout } from '../components/layout/AuthLayout';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { FormField } from '../components/ui/FormField';
import { useResetPassword } from '../hooks/useAuth';
import type { LoginLocationState } from '../services/types';

// Opened from the emailed link: /reset-password?token=...
export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const resetMutation = useResetPassword();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    // A typo in a password field can't be seen: typing it twice catches it
    if (password !== confirm) {
      setMismatch(true);
      return;
    }
    setMismatch(false);
    resetMutation.mutate(
      { token, password },
      {
        onSuccess: () =>
          navigate('/login', {
            replace: true,
            state: { passwordReset: true } satisfies LoginLocationState,
          }),
      },
    );
  }

  if (!token) {
    return (
      <AuthLayout
        title="Reset password"
        subtitle="This page needs the link from the email."
      >
        <p role="alert" className="text-sm">
          The link is incomplete. Open it again from the email, or ask for a
          new one.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link to="/forgot-password" className="text-accent hover:underline">
            Send me a new link
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="You'll log in with it from now on."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="password"
          label="New password (at least 8 characters)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormField
          id="confirm"
          label="Repeat the new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />

        {mismatch && (
          <p
            role="alert"
            className="rounded border border-down/40 bg-down/10 px-3 py-2 text-sm text-down"
          >
            The two passwords are different.
          </p>
        )}
        {resetMutation.isError && (
          <>
            <ErrorMessage error={resetMutation.error} />
            <Link
              to="/forgot-password"
              className="-mt-2 text-sm text-accent hover:underline"
            >
              Send me a new link
            </Link>
          </>
        )}

        <button
          type="submit"
          disabled={resetMutation.isPending}
          className="rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {resetMutation.isPending ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </AuthLayout>
  );
}
