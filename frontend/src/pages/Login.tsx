import { useState, type SubmitEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { AuthLayout } from '../components/layout/AuthLayout';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { FormField } from '../components/ui/FormField';
import { useLogin } from '../hooks/useAuth';
import type { LoginLocationState } from '../services/types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const loginMutation = useLogin();
  const location = useLocation();
  const passwordReset = (location.state as LoginLocationState)?.passwordReset;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    // Stop the browser's default full-page form submit
    event.preventDefault();
    loginMutation.mutate({ email, password });
  }

  return (
    <AuthLayout title="Log in" subtitle="Welcome back to your trading account.">
      {passwordReset && (
        <p
          role="status"
          className="mb-4 rounded border border-up/40 bg-up/10 px-3 py-2 text-sm text-up"
        >
          Password changed. Log in with your new password.
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <div>
          <FormField
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className="mt-1.5 text-right">
            <Link
              to="/forgot-password"
              className="text-xs text-accent hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {loginMutation.isError && <ErrorMessage error={loginMutation.error} />}

        <button
          type="submit"
          disabled={loginMutation.isPending}
          className="rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loginMutation.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        No account?{' '}
        <Link to="/register" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
