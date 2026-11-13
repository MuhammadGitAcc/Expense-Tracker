import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '@/i18n';
import * as authApi from '@/api/auth.api';
import { store } from '@/app/store';
import { clearCredentials, selectAccessToken } from '@/features/auth/authSlice';
import { LoginForm } from '@/features/auth/LoginForm';
import { PATHS } from '@/routes/paths';

vi.mock('@/api/auth.api');

const user = { id: 'u-1', name: 'Demo', email: 'demo@example.com', language: 'en', theme: 'light' };

function VerifyEmailSpy() {
  const location = useLocation();
  return <p>verify page for {location.state?.email}</p>;
}

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[PATHS.login]}>
          <Routes>
            <Route path={PATHS.login} element={<LoginForm />} />
            <Route path={PATHS.verifyEmail} element={<VerifyEmailSpy />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(clearCredentials());
});

describe('LoginForm', () => {
  it('asks for the email and the password and sends nothing when they are empty', async () => {
    const actor = renderForm();

    await actor.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findAllByText('This field is required')).toHaveLength(2);
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('refuses an invalid email', async () => {
    const actor = renderForm();

    await actor.type(screen.getByLabelText('Email'), 'not-an-email');
    await actor.type(screen.getByLabelText('Password'), 'Secret@123');
    await actor.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('logs in: sends the cleaned email and keeps the token in the store', async () => {
    authApi.login.mockResolvedValue({ data: { user, accessToken: 'token-123' } });
    const actor = renderForm();

    await actor.type(screen.getByLabelText('Email'), '  Demo@Example.com ');
    await actor.type(screen.getByLabelText('Password'), 'Secret@123');
    await actor.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(authApi.login).toHaveBeenCalledTimes(1));
    expect(authApi.login.mock.calls[0][0]).toEqual({
      email: 'demo@example.com',
      password: 'Secret@123',
    });
    await waitFor(() => expect(selectAccessToken(store.getState())).toBe('token-123'));
  });

  it('shows the server message when the login is refused', async () => {
    authApi.login.mockRejectedValue({
      response: { status: 401, data: { message: 'Invalid email or password' } },
    });
    const actor = renderForm();

    await actor.type(screen.getByLabelText('Email'), 'demo@example.com');
    await actor.type(screen.getByLabelText('Password'), 'Wrong@123');
    await actor.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(selectAccessToken(store.getState())).toBeNull();
  });

  it('sends an unverified account to the verification page with its email', async () => {
    authApi.login.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Email not verified', code: 'EMAIL_NOT_VERIFIED' },
      },
    });
    const actor = renderForm();

    await actor.type(screen.getByLabelText('Email'), 'new@example.com');
    await actor.type(screen.getByLabelText('Password'), 'Secret@123');
    await actor.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByText('verify page for new@example.com')).toBeInTheDocument();
  });

  it('shows and hides the password with the eye button', async () => {
    const actor = renderForm();
    const field = screen.getByLabelText('Password');
    expect(field).toHaveAttribute('type', 'password');

    await actor.click(screen.getByRole('button', { name: /show password/i }));
    expect(field).toHaveAttribute('type', 'text');
  });
});
