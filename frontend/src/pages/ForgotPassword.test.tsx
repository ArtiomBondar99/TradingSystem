import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '../services/auth.service';
import { renderWithProviders } from '../test/render';
import ForgotPassword from './ForgotPassword';
import Login from './Login';

vi.mock('../services/auth.service');

describe('ForgotPassword', () => {
  beforeEach(() => {
    vi.mocked(api.forgotPassword).mockResolvedValue();
  });

  it('is linked from the login page', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>,
      { route: '/login' },
    );

    await userEvent.click(screen.getByRole('link', { name: 'Forgot password?' }));

    expect(
      screen.getByRole('heading', { name: 'Forgot password' }),
    ).toBeInTheDocument();
  });

  it('sends the email and says a link is on its way, without saying the account exists', async () => {
    renderWithProviders(<ForgotPassword />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(api.forgotPassword).toHaveBeenCalledWith('ada@example.com');
    expect(await screen.findByRole('status')).toHaveTextContent(
      'If an account exists for ada@example.com, we sent it a link',
    );
  });
});
