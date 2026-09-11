'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession } from '../../lib/api';

function friendlyLoginError(error: any) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return 'Unable to sign in. Please try again.';
  }

  if (
    normalized.includes('401') ||
    normalized.includes('unauthorized') ||
    normalized.includes('invalid credentials') ||
    normalized.includes('incorrect email or password')
  ) {
    return 'Incorrect email or password.';
  }

  if (
    normalized.includes('invalid email') ||
    normalized.includes('email must be an email')
  ) {
    return 'Please enter a valid email address.';
  }

  if (normalized.includes('verification')) {
    return 'Please verify your account before signing in.';
  }

  if (normalized.includes('inactive')) {
    return 'This account is currently inactive. Please contact ROZZI support.';
  }

  return message;
}

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError('');

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setBusy(true);

    try {
      const session = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          password,
        }),
      });

      setSession(session);
      router.push('/');
    } catch (error: any) {
      setError(friendlyLoginError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="authcard">
        <div className="brand">ROZZI RIDER</div>

        <h1>Rider sign in</h1>

        <p className="muted">
          Sign in to manage your deliveries and rider account.
        </p>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <label>
            Email

            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
          </label>

          <label>
            Password

            <div
              style={{
                position: 'relative',
              }}
            >
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
                style={{
                  paddingRight: 50,
                }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword((value) => !value)
                }
                aria-label={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                title={
                  showPassword
                    ? 'Hide password'
                    : 'Show password'
                }
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 18,
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <p
            className="muted"
            style={{
              marginTop: 8,
              marginBottom: 16,
            }}
          >
            <a href="/forgot-password">
              Forgot your password?
            </a>
          </p>

          <button
            className="btn"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="muted">
          Don&apos;t have a Rider account?{' '}
          <a href="/register">
            Create a rider account
          </a>
        </p>
      </div>
    </main>
  );
}