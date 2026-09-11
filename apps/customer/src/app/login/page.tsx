'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setSession } from '../../lib/api';

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="m4 4 16 16" />
    </svg>
  ) : (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

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

      router.push('/account');
      router.refresh();
    } catch (error: any) {
      setError(friendlyLoginError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="authcard">
        <div className="brand">ROZZI</div>

        <h1>Welcome back</h1>

        <p className="muted">
          Sign in to shop, track orders and manage your account.
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
            <span>Password</span>

            <div className="password-field">
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Enter your password"
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? 'Hide password' : 'Show password'
                }
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon open={showPassword} />
              </button>
            </div>
          </label>

          <div className="auth-forgot">
            <Link href="/forgot-password">Forgot your password?</Link>
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p>
          New to ROZZI?{' '}
          <Link href="/register">
            Create an account
          </Link>
        </p>
      </div>
    </main>
  );
}