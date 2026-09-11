'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '../../lib/api-client';

function friendlyError(error: any) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return 'Unable to process your request. Please try again.';
  }

  if (
    normalized.includes('invalid email') ||
    normalized.includes('email must be an email')
  ) {
    return 'Please enter a valid email address.';
  }

  if (
    normalized.includes('401') ||
    normalized.includes('unauthorized')
  ) {
    return 'Unable to process your request. Please try again.';
  }

  return message;
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMsg('');
    setErr('');

    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedEmail && !normalizedPhone) {
      setErr('Please enter your email address or phone number.');
      return;
    }

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setErr('Please enter a valid email address.');
      return;
    }

    setBusy(true);

    try {
     const response: any = await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify(
          normalizedEmail
            ? { email: normalizedEmail }
            : { phone: normalizedPhone },
        ),
      });

      setMsg(
        response?.message ||
          'If an account matches, a reset message will be sent.',
      );
    } catch (error: any) {
      setErr(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <div className="authcard">
        <div className="brand">ROZZI ADMIN</div>

        <h1>Reset your password</h1>

        <p className="muted">
          Enter the email address or phone number associated with
          your ROZZI Admin account. If an account matches, we&apos;ll
          send reset instructions.
        </p>

        <form onSubmit={submit}>
          <label>
            Email address

            <input
              className="input"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (e.target.value) setPhone('');
              }}
              autoComplete="email"
            />
          </label>

          <div
            className="muted"
            style={{
              textAlign: 'center',
              margin: '10px 0',
            }}
          >
            OR
          </div>

          <label>
            Phone number

            <input
              className="input"
              type="tel"
              placeholder="08012345678"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                if (e.target.value) setEmail('');
              }}
              autoComplete="tel"
            />
          </label>

          <button
            className="btn"
            type="submit"
            disabled={busy}
          >
            {busy ? 'Sending…' : 'Send reset instructions'}
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

        <p className="muted" style={{ marginTop: 20 }}>
          Remember your password?{' '}
          <Link href="/login">Back to sign in</Link>
        </p>
      </div>
    </main>
  );
}