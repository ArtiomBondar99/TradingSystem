import { useState, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { AuthLayout } from '../components/layout/AuthLayout';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { FormField } from '../components/ui/FormField';
import { useForgotPassword } from '../hooks/useAuth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const forgotMutation = useForgotPassword();

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    forgotMutation.mutate(email);
  }

  if (forgotMutation.isSuccess) {
    // "If an account exists": the backend doesn't tell us whether it does,
    // so the page can't either
    return (
      <AuthLayout title="Check your email" subtitle="The link is on its way.">
        <p role="status" className="text-sm leading-relaxed">
          If an account exists for{' '}
          <span className="font-medium">{forgotMutation.variables}</span>, we
          sent it a link to choose a new password. The link works once, for 30
          minutes. Not there? Check the spam folder.
        </p>
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-accent hover:underline">
            Back to log in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your email and we'll send you a link to reset it."
    >
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

        {forgotMutation.isError && <ErrorMessage error={forgotMutation.error} />}

        <button
          type="submit"
          disabled={forgotMutation.isPending}
          className="rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {forgotMutation.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
