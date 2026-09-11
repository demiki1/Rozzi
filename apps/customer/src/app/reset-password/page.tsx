'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { post } from '../../lib/api';

function friendlyError(error: any) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return 'Unable to reset your password. Please try again.';
  }

  if (
    normalized.includes('invalid or expired reset token') ||
    normalized.includes('expired reset token')
  ) {
    return 'This password reset link is invalid or has expired. Please request a new one.';
  }

  if (
    normalized.includes('password must') ||
    normalized.includes('password is too short')
  ) {
    return message;
  }

  return message;
}

function ResetForm() {
  const searchParams = useSearchParams();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMsg('');
    setErr('');

    const token = searchParams.get('token');

    if (!token) {
      setErr(
        'This password reset link is missing its reset token. Please request a new link.',
      );
      return;
    }

    if (password.length < 8) {
      setErr('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(password)) {
      setErr('Password must contain at least one letter.');
      return;
    }

    if (!/\d/.test(password)) {
      setErr('Password must contain at least one number.');
      return;
    }

    if (password !== confirmPassword) {
      setErr('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      await post('/api/auth/reset-password', {
        token,
        password,
      });

      setMsg('Password changed successfully. You can now sign in.');
      setPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      setErr(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <div className="card" style={{ maxWidth: 520, margin: '40px auto' }}>
        <h1>Choose a new password</h1>

        <p className="muted">
          Create a new password for your ROZZI account.
        </p>

        <form onSubmit={submit}>
          <label>
            New password

            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showPassword ? 'text' : 'password'}
                minLength={8}
                maxLength={72}
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{ paddingRight: 48 }}
              />

              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={
                  showPassword ? 'Hide password' : 'Show password'
                }
                title={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <label>
            Confirm new password

            <div style={{ position: 'relative' }}>
              <input
                className="input"
                type={showConfirmPassword ? 'text' : 'password'}
                minLength={8}
                maxLength={72}
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                style={{ paddingRight: 48 }}
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword((value) => !value)
                }
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
                title={
                  showConfirmPassword
                    ? 'Hide confirmation password'
                    : 'Show confirmation password'
                }
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: 18,
                }}
              >
                {showConfirmPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          <div className="muted" style={{ margin: '12px 0' }}>
            <strong>Password requirements:</strong>
            <br />
            • At least 8 characters
            <br />
            • At least one letter
            <br />
            • At least one number
          </div>

          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Updating password…' : 'Update password'}
          </button>
        </form>

        {msg && (
          <p role="status" style={{ marginTop: 16 }}>
            {msg}
          </p>
        )}

        {err && (
          <p className="error" role="alert" style={{ marginTop: 16 }}>
            {err}
          </p>
        )}

        {msg && (
          <p style={{ marginTop: 20 }}>
            <Link href="/login">Continue to sign in</Link>
          </p>
        )}
      </div>
    </main>
  );
}

export default function Reset() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <p>Loading...</p>
        </main>
      }
    >
      <ResetForm />
    </Suspense>
  );
}