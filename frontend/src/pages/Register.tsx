import { useState, type ChangeEvent, type SubmitEvent } from 'react';
import { Link } from 'react-router';
import { AuthLayout } from '../components/layout/AuthLayout';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { FormField } from '../components/ui/FormField';
import { useRegister } from '../hooks/useAuth';

export default function Register() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const registerMutation = useRegister();

  // One handler for every field: the input's name says which one changed
  function updateField(event: ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    registerMutation.mutate(form);
  }

  return (
    <AuthLayout
      title="Create account"
      subtitle="Start with $100,000 in virtual cash. No real money, ever."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="firstName"
            name="firstName"
            label="First name"
            autoComplete="given-name"
            required
            maxLength={50}
            value={form.firstName}
            onChange={updateField}
          />
          <FormField
            id="lastName"
            name="lastName"
            label="Last name"
            autoComplete="family-name"
            required
            maxLength={50}
            value={form.lastName}
            onChange={updateField}
          />
        </div>
        <FormField
          id="email"
          name="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={updateField}
        />
        {/* Same rules as the backend's RegisterDto, so most mistakes are
            caught before a request. The backend still validates everything. */}
        <FormField
          id="password"
          name="password"
          label="Password (at least 8 characters)"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
          value={form.password}
          onChange={updateField}
        />

        {registerMutation.isError && (
          <ErrorMessage error={registerMutation.error} />
        )}

        <button
          type="submit"
          disabled={registerMutation.isPending}
          className="rounded bg-accent py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {registerMutation.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}
