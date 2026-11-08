import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../hooks/useAuthStore';
import * as api from '../services/auth.service';
import { renderWithProviders } from '../test/render';
import Login from './Login';
import ResetPassword from './ResetPassword';

vi.mock('../services/auth.service');

// Both pages, so the test can see where a successful reset leads
function renderAt(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<p>Forgot page</p>} />
    </Routes>,
    { route },
  );
}

async function fillAndSubmit(password: string, confirm = password) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/^New password/), password);
  await user.type(screen.getByLabelText('Repeat the new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Set new password' }));
  return user;
}

describe('ResetPassword', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: null });
    vi.mocked(api.resetPassword).mockResolvedValue();
  });

  it('sends the token from the link and opens login with a notice', async () => {
    renderAt('/reset-password?token=abc123');

    await fillAndSubmit('NewStrongPass1');

    expect(api.resetPassword).toHaveBeenCalledWith('abc123', 'NewStrongPass1');
    expect(
      await screen.findByText('Password changed. Log in with your new password.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('logs out a browser that was logged in with the old password', async () => {
    useAuthStore.setState({ token: 'old.session.jwt' });
    renderAt('/reset-password?token=abc123');

    await fillAndSubmit('NewStrongPass1');

    await screen.findByRole('heading', { name: 'Log in' });
    expect(useAuthStore.getState().token).toBeNull();
  });

  it('does not send two different passwords', async () => {
    renderAt('/reset-password?token=abc123');

    await fillAndSubmit('NewStrongPass1', 'NewStrongPass2');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The two passwords are different.',
    );
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it('shows the server error and offers a new link when the link expired', async () => {
    vi.mocked(api.resetPassword).mockRejectedValue(
      new AxiosError('Bad Request', '400', undefined, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: {
          message: 'This reset link is invalid or has expired. Request a new one.',
        },
      }),
    );
    renderAt('/reset-password?token=old');

    const user = await fillAndSubmit('NewStrongPass1');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This reset link is invalid or has expired',
    );
    await user.click(screen.getByRole('link', { name: 'Send me a new link' }));
    expect(screen.getByText('Forgot page')).toBeInTheDocument();
  });

  it('explains a link without a token instead of showing the form', () => {
    renderAt('/reset-password');

    expect(screen.getByRole('alert')).toHaveTextContent('The link is incomplete');
    expect(screen.queryByLabelText(/^New password/)).not.toBeInTheDocument();
  });
});
