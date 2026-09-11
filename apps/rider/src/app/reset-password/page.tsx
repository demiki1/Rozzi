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

  return message;
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label>
      {label}

      <div style={{ position: 'relative' }}>
        <input
          className="input"
          type={visible ? 'text' : 'password'}
          minLength={8}
          maxLength={72}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="new-password"
          placeholder={
            label === 'New password'
              ? 'Enter your new password'
              : 'Confirm your new password'
          }
          style={{ paddingRight: 48 }}
          required
        />

        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 0,
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 18,
            padding: 4,
            lineHeight: 1,
          }}
        >
          {visible ? '🙈' : '👁️'}
        </button>
      </div>
    </label>
  );
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
        'This password reset link is missing its reset token. Please request a new one.',
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

      setMsg(
        'Password changed successfully. You can now sign in.',
      );

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
      <div
        className="card"
        style={{ maxWidth: 520, margin: '40px auto' }}
      >
        <h1>Choose a new password</h1>

        <p className="muted">
          Create a new password for your ROZZI Rider account.
        </p>

        <form onSubmit={submit}>
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggle={() =>
              setShowPassword((value) => !value)
            }
          />

          <PasswordField
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirmPassword}
            onToggle={() =>
              setShowConfirmPassword((value) => !value)
            }
          />

          <div className="muted" style={{ margin: '12px 0' }}>
            <strong>Password requirements:</strong>
            <br />
            • At least 8 characters
            <br />
            • At least one letter
            <br />
            • At least one number
          </div>

          <button
            className="btn"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Updating password…' : 'Update password'}
          </button>
        </form>

        {msg && (
          <p role="status" style={{ marginTop: 16 }}>
            {msg}
          </p>
        )}

        {err && (
          <p
            className="error"
            role="alert"
            style={{ marginTop: 16 }}
          >
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

export default function ResetPassword() {
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