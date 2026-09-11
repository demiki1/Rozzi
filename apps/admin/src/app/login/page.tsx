'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';

import { useAuth } from '@/context/auth-context';

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

  if (normalized.includes('not an admin')) {
    return 'This account does not have administrator access.';
  }

  if (normalized.includes('verification')) {
    return 'Please verify your account before signing in.';
  }

  if (normalized.includes('inactive')) {
    return 'This account is currently inactive. Please contact ROZZI support.';
  }

  return message;
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5 19 6v5.2c0 4.4-2.8 7.8-7 9.3-4.2-1.5-7-4.9-7-9.3V6l7-2.5Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m9.3 12 1.8 1.8 3.8-4"
      />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3 21 21"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.6 10.7a2 2 0 0 0 2.7 2.7"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.9 5.2A10.8 10.8 0 0 1 12 5c5.2 0 8.5 4.7 9.5 7-.4.9-1.2 2.2-2.4 3.4"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6.2 6.2C4.4 7.5 3.2 9.3 2.5 11c1 2.3 4.3 7 9.5 7 1.1 0 2.1-.2 3-.6"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12s3.4-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="2.7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12h13"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m13 6 6 6-6 6"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

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

    setSubmitting(true);

    try {
      await login(normalizedEmail, password);
    } catch (err: any) {
      setError(friendlyLoginError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f7f1e9] text-[#241416]">
      {/* Background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#f4a340]/20 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 -left-40 h-[520px] w-[520px] rounded-full bg-[#7f1828]/10 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        {/* Brand header */}
        <header className="flex items-center justify-between">
          <Link
            href="/login"
            className="group inline-flex items-center gap-3"
            aria-label="ROZZI Admin"
          >
            <span className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#7f1828] shadow-[0_10px_30px_rgba(127,24,40,0.2)]">
              <span className="absolute inset-[5px] rounded-[12px] border border-[#f7c85b]/70" />
              <span className="text-lg font-black tracking-[-0.06em] text-[#f7c85b]">
                R
              </span>
            </span>

            <span className="leading-none">
              <span className="block text-[21px] font-black tracking-[-0.04em] text-[#7f1828]">
                ROZZI
              </span>
              <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.2em] text-[#8b7771]">
                Marketplace
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-[#e6d9cc] bg-white/70 px-3 py-2 text-xs font-semibold text-[#6f5d58] shadow-sm sm:flex">
            <span className="h-2 w-2 rounded-full bg-[#138a4b]" />
            Secure admin access
          </div>
        </header>

        {/* Main */}
        <section className="flex flex-1 items-center justify-center py-12 lg:py-16">
          <div className="grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-[#eadfd5] bg-white shadow-[0_30px_90px_rgba(66,38,27,0.12)] lg:grid-cols-[0.92fr_1.08fr]">
            {/* Brand panel */}
            <div className="relative hidden overflow-hidden bg-[#6f1524] p-10 text-white lg:flex lg:flex-col lg:justify-between">
              <div
                aria-hidden="true"
                className="absolute -right-24 -top-24 h-72 w-72 rounded-full border-[45px] border-[#f6a13a]/20"
              />

              <div
                aria-hidden="true"
                className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full border-[55px] border-[#f7c85b]/10"
              />

              <div className="relative">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#f7c85b]">
                  ROZZI Command Center
                </span>

                <h2 className="mt-7 max-w-sm text-4xl font-black leading-[1.05] tracking-[-0.045em]">
                  Run the marketplace with confidence.
                </h2>

                <p className="mt-5 max-w-sm text-sm leading-6 text-white/70">
                  Manage orders, vendors, riders, customers, finance,
                  operations and marketplace activity from one secure
                  workspace.
                </p>
              </div>

              <div className="relative mt-12 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-lg font-black text-[#f7c85b]">
                    Live
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    Operations
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                  <div className="text-lg font-black text-[#f7c85b]">
                    Secure
                  </div>
                  <div className="mt-1 text-xs text-white/60">
                    Admin access
                  </div>
                </div>
              </div>
            </div>

            {/* Login panel */}
            <div className="p-7 sm:p-10 lg:p-12">
              <div className="mx-auto max-w-md">
                <div className="mb-8">
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff2df] text-[#c85b1b]">
                    <ShieldIcon />
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c85b1b]">
                    Administration
                  </span>

                  <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-[#281619] sm:text-4xl">
                    Welcome back.
                  </h1>

                  <p className="mt-2 text-sm leading-6 text-[#806e68]">
                    Sign in to your ROZZI administration workspace.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label
                      htmlFor="admin-email"
                      className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-[#4f403d]"
                    >
                      Email address
                    </label>

                    <input
                      id="admin-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="admin@example.com"
                      className="h-13 w-full rounded-xl border border-[#ded2c8] bg-[#fffdfa] px-4 text-sm text-[#281619] outline-none transition placeholder:text-[#aa9b94] focus:border-[#c85b1b] focus:ring-4 focus:ring-[#f4a340]/15"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label
                        htmlFor="admin-password"
                        className="block text-xs font-bold uppercase tracking-[0.08em] text-[#4f403d]"
                      >
                        Password
                      </label>
                    </div>

                    <div className="relative">
                      <input
                        id="admin-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Enter your password"
                        className="h-13 w-full rounded-xl border border-[#ded2c8] bg-[#fffdfa] px-4 pr-12 text-sm text-[#281619] outline-none transition placeholder:text-[#aa9b94] focus:border-[#c85b1b] focus:ring-4 focus:ring-[#f4a340]/15"
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
                        className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#806e68] transition hover:bg-[#f7eee6] hover:text-[#7f1828]"
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>

                    <div className="mt-3 text-right">
                      <Link
                        href="/forgot-password"
                        className="text-xs font-bold text-[#a33b24] transition hover:text-[#7f1828] hover:underline"
                      >
                        Forgot your password?
                      </Link>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="rounded-xl border border-[#e8b9b9] bg-[#fff3f3] px-4 py-3 text-sm font-medium leading-5 text-[#a52828]"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#7f1828] px-4 text-sm font-bold text-white shadow-[0_12px_25px_rgba(127,24,40,0.18)] transition hover:bg-[#69131f] hover:shadow-[0_15px_30px_rgba(127,24,40,0.23)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>
                      {submitting
                        ? 'Signing in…'
                        : 'Sign in to ROZZI Admin'}
                    </span>

                    {!submitting && (
                      <span className="transition-transform group-hover:translate-x-0.5">
                        <ArrowIcon />
                      </span>
                    )}
                  </button>
                </form>

                <div className="mt-8 flex items-start gap-3 rounded-xl border border-[#eee3da] bg-[#fcf8f4] p-4">
                  <div className="mt-0.5 text-[#138a4b]">
                    <ShieldIcon />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#453532]">
                      Authorized administrators only
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[#8a7973]">
                      This workspace contains sensitive marketplace,
                      financial and operational information.
                    </p>
                  </div>
                </div>

                <p className="mt-8 text-center text-[11px] text-[#a0928c]">
                  ROZZI Marketplace Administration
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-2 border-t border-[#e9ddd3] pt-5 text-[10px] font-medium text-[#9a8b85] sm:flex-row">
          <span>© ROZZI Marketplace</span>
          <span>Administration portal</span>
        </footer>
      </div>
    </main>
  );
}