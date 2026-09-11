'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

function friendlyRegisterError(error: any) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return 'Unable to create your account. Please try again.';
  }

  if (
    normalized.includes('already exists') ||
    normalized.includes('conflict')
  ) {
    return 'An account with this email or phone already exists.';
  }

  if (
    normalized.includes('email') &&
    normalized.includes('valid')
  ) {
    return 'Please enter a valid email address.';
  }

  if (normalized.includes('password')) {
    return 'Password must contain at least one letter and one number and be at least 8 characters.';
  }

  if (
    normalized.includes('referral code') ||
    normalized.includes('referral program') ||
    normalized.includes('refer')
  ) {
    return 'This referral link is no longer valid. You can still create your account without it.';
  }

  return message;
}

const pageStyles = `
  .rozzi-register-page {
    min-height: 100vh;
    background:
      radial-gradient(circle at 8% 10%, rgba(255, 174, 72, .13), transparent 28%),
      radial-gradient(circle at 92% 88%, rgba(126, 25, 38, .08), transparent 30%),
      #fbf8f3;
    color: #171515;
    display: flex;
    flex-direction: column;
  }

  .rozzi-register-header {
    height: 76px;
    border-bottom: 1px solid rgba(126, 25, 38, .10);
    background: rgba(255, 253, 249, .88);
    backdrop-filter: blur(16px);
    display: flex;
    align-items: center;
  }

  .rozzi-register-header-inner {
    width: min(1160px, calc(100% - 40px));
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
  }

  .rozzi-register-logo {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: #741b28;
    font-weight: 900;
    letter-spacing: -.04em;
    font-size: 24px;
  }

  .rozzi-register-logo-mark {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    border: 1px solid rgba(126, 25, 38, .12);
    box-shadow: 0 7px 18px rgba(68, 22, 20, .10);
    display: grid;
    place-items: center;
  }

  .rozzi-register-logo-mark img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .rozzi-register-header-link {
    color: #5f5552;
    text-decoration: none;
    font-size: 14px;
    font-weight: 700;
  }

  .rozzi-register-header-link span {
    color: #ef641d;
    margin-left: 5px;
  }

  .rozzi-register-main {
    width: min(1160px, calc(100% - 40px));
    margin: 0 auto;
    flex: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(430px, 500px);
    align-items: center;
    gap: 76px;
    padding: 58px 0 70px;
  }

  .rozzi-register-intro {
    max-width: 510px;
    padding-left: 12px;
  }

  .rozzi-register-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 999px;
    background: #fff0df;
    color: #8b3a19;
    font-size: 11px;
    font-weight: 900;
    letter-spacing: .12em;
    text-transform: uppercase;
  }

  .rozzi-register-kicker-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #f47a20;
    box-shadow: 0 0 0 4px rgba(244, 122, 32, .13);
  }

  .rozzi-register-intro h1 {
    margin: 20px 0 16px;
    color: #701a27;
    font-size: clamp(42px, 5vw, 68px);
    line-height: .98;
    letter-spacing: -.055em;
    max-width: 520px;
  }

  .rozzi-register-intro h1 span {
    color: #ef6b1c;
  }

  .rozzi-register-intro > p {
    margin: 0;
    max-width: 475px;
    color: #6e625e;
    font-size: 17px;
    line-height: 1.65;
  }

  .rozzi-register-benefits {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 30px;
  }

  .rozzi-register-benefit {
    padding: 16px;
    border: 1px solid rgba(126, 25, 38, .09);
    border-radius: 16px;
    background: rgba(255,255,255,.68);
  }

  .rozzi-register-benefit strong {
    display: block;
    color: #251d1b;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .rozzi-register-benefit small {
    color: #887b76;
    font-size: 12px;
    line-height: 1.45;
  }

  .rozzi-register-card {
    width: 100%;
    background: rgba(255,255,255,.94);
    border: 1px solid rgba(126, 25, 38, .10);
    border-radius: 26px;
    box-shadow: 0 24px 70px rgba(63, 26, 21, .12);
    padding: 34px;
  }

  .rozzi-register-card-head {
    margin-bottom: 25px;
  }

  .rozzi-register-card-head h2 {
    margin: 0 0 7px;
    color: #1c1716;
    font-size: 29px;
    line-height: 1.1;
    letter-spacing: -.035em;
  }

  .rozzi-register-card-head p {
    margin: 0;
    color: #81736e;
    font-size: 13px;
    line-height: 1.55;
  }

  .rozzi-register-referral {
    margin-bottom: 20px;
    padding: 13px 14px;
    border-radius: 13px;
    border: 1px solid rgba(239, 107, 28, .20);
    background: #fff7ed;
    color: #77411f;
    font-size: 12px;
    line-height: 1.5;
  }

  .rozzi-register-error {
    margin-bottom: 18px;
    padding: 12px 14px;
    border-radius: 12px;
    border: 1px solid rgba(174, 38, 48, .18);
    background: #fff1f1;
    color: #9d2530;
    font-size: 12px;
    line-height: 1.5;
  }

  .rozzi-register-form {
    display: grid;
    gap: 16px;
  }

  .rozzi-register-field {
    display: grid;
    gap: 7px;
  }

  .rozzi-register-field label {
    color: #2a2220;
    font-size: 12px;
    font-weight: 800;
  }

  .rozzi-register-input-wrap {
    position: relative;
  }

  .rozzi-register-input {
    width: 100%;
    min-height: 50px;
    box-sizing: border-box;
    border: 1px solid #ded5ce;
    border-radius: 12px;
    background: #fffdfa;
    color: #211b19;
    outline: none;
    padding: 0 14px;
    font: inherit;
    font-size: 14px;
    transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
  }

  .rozzi-register-input::placeholder {
    color: #aaa09a;
  }

  .rozzi-register-input:focus {
    border-color: #ef6b1c;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(239, 107, 28, .10);
  }

  .rozzi-register-password-input {
    padding-right: 52px;
  }

  .rozzi-register-password-toggle {
    position: absolute;
    top: 50%;
    right: 7px;
    transform: translateY(-50%);
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: #796e69;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .rozzi-register-password-toggle:hover {
    background: #f7f1eb;
    color: #741b28;
  }

  .rozzi-register-hint {
    color: #938680;
    font-size: 11px;
    line-height: 1.4;
  }

  .rozzi-register-submit {
    width: 100%;
    min-height: 52px;
    border: 0;
    border-radius: 12px;
    background: #181616;
    color: #fff;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 900;
    margin-top: 3px;
    transition: transform .18s ease, box-shadow .18s ease, opacity .18s ease;
  }

  .rozzi-register-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(24, 22, 22, .18);
  }

  .rozzi-register-submit:disabled {
    opacity: .58;
    cursor: not-allowed;
  }

  .rozzi-register-footer {
    margin: 18px 0 0;
    text-align: center;
    color: #8b7e78;
    font-size: 12px;
  }

  .rozzi-register-footer a {
    color: #ef641d;
    font-weight: 900;
    text-decoration: none;
  }

  .rozzi-register-terms {
    margin: 18px 0 0;
    color: #a09690;
    text-align: center;
    font-size: 10px;
    line-height: 1.5;
  }

  @media (max-width: 900px) {
    .rozzi-register-main {
      grid-template-columns: 1fr;
      gap: 34px;
      max-width: 560px;
      padding-top: 42px;
    }

    .rozzi-register-intro {
      max-width: none;
      padding-left: 0;
      text-align: center;
    }

    .rozzi-register-intro h1 {
      margin-left: auto;
      margin-right: auto;
    }

    .rozzi-register-intro > p {
      margin-left: auto;
      margin-right: auto;
    }

    .rozzi-register-kicker {
      justify-content: center;
    }
  }

  @media (max-width: 560px) {
    .rozzi-register-header {
      height: 66px;
    }

    .rozzi-register-header-inner,
    .rozzi-register-main {
      width: min(100% - 28px, 500px);
    }

    .rozzi-register-header-link {
      font-size: 12px;
    }

    .rozzi-register-logo {
      font-size: 21px;
    }

    .rozzi-register-logo-mark {
      width: 36px;
      height: 36px;
      border-radius: 10px;
    }

    .rozzi-register-main {
      padding: 32px 0 46px;
    }

    .rozzi-register-intro h1 {
      font-size: 42px;
    }

    .rozzi-register-intro > p {
      font-size: 14px;
    }

    .rozzi-register-benefits {
      grid-template-columns: 1fr;
    }

    .rozzi-register-card {
      padding: 23px 18px;
      border-radius: 20px;
    }

    .rozzi-register-card-head h2 {
      font-size: 25px;
    }
  }
`;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const code = searchParams.get('ref')?.trim();

    if (code) {
      setReferralCode(code);
    }
  }, [searchParams]);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');

    const normalizedName = name.trim();
    const normalizedEmail = email.trim();
    const normalizedPhone = phone.trim();
    const normalizedReferralCode = referralCode.trim();

    if (normalizedName.length < 2) {
      setError('Please enter your full name.');
      return;
    }

    if (!normalizedEmail && !normalizedPhone) {
      setError('Please provide either an email address or phone number.');
      return;
    }

    if (
      normalizedEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      setError('Please enter a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const payload: {
        fullName: string;
        email?: string;
        phone?: string;
        password: string;
        role: 'CUSTOMER';
        referralCode?: string;
      } = {
        fullName: normalizedName,
        password,
        role: 'CUSTOMER',
      };

      if (normalizedEmail) {
        payload.email = normalizedEmail;
      }

      if (normalizedPhone) {
        payload.phone = normalizedPhone;
      }

      if (normalizedReferralCode) {
        payload.referralCode = normalizedReferralCode;
      }

      const result = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setSession(result);
      router.push('/account');
      router.refresh();
    } catch (e: any) {
      setError(friendlyRegisterError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rozzi-register-page">
      <style dangerouslySetInnerHTML={{ __html: pageStyles }} />

      <header className="rozzi-register-header">
        <div className="rozzi-register-header-inner">
          <Link
            href="/"
            className="rozzi-register-logo"
            aria-label="ROZZI home"
          >
            <span className="rozzi-register-logo-mark">
              <img src="/rozzi-logo.png" alt="ROZZI Marketplace" />
            </span>
            <span>ROZZI</span>
          </Link>

          <Link href="/login" className="rozzi-register-header-link">
            Already have an account?<span>Sign in</span>
          </Link>
        </div>
      </header>

      <main className="rozzi-register-main">
        <section className="rozzi-register-intro">
          <div className="rozzi-register-kicker">
            <span className="rozzi-register-kicker-dot" />
            Welcome to ROZZI
          </div>

          <h1>
            Shop more.
            <br />
            <span>Live easier.</span>
          </h1>

          <p>
            Create your ROZZI account and discover food, groceries,
            essentials, health products, gadgets and more from trusted
            local vendors.
          </p>

          <div className="rozzi-register-benefits">
            <div className="rozzi-register-benefit">
              <strong>Everything in one place</strong>
              <small>Shop across multiple categories without the hassle.</small>
            </div>

            <div className="rozzi-register-benefit">
              <strong>Fast local delivery</strong>
              <small>Get your orders delivered conveniently to your area.</small>
            </div>

            <div className="rozzi-register-benefit">
              <strong>Track your orders</strong>
              <small>Follow your order from checkout to delivery.</small>
            </div>

            <div className="rozzi-register-benefit">
              <strong>Earn with referrals</strong>
              <small>Invite new customers and earn ROZZI Credits.</small>
            </div>
          </div>
        </section>

        <section className="rozzi-register-card">
          <div className="rozzi-register-card-head">
            <h2>Create your account</h2>
            <p>
              Join ROZZI in a few simple steps. Your account lets you shop,
              track orders and manage your preferences.
            </p>
          </div>

          {referralCode && (
            <div className="rozzi-register-referral">
              <strong>Referral link detected.</strong>{' '}
              Your referral will be recorded when your account is created.
            </div>
          )}

          {error && (
            <div className="rozzi-register-error" role="alert">
              {error}
            </div>
          )}

          <form className="rozzi-register-form" onSubmit={submit}>
            <div className="rozzi-register-field">
              <label htmlFor="register-name">Full name</label>
              <input
                id="register-name"
                className="rozzi-register-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div className="rozzi-register-field">
              <label htmlFor="register-email">Email address</label>
              <input
                id="register-email"
                className="rozzi-register-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
              />
            </div>

            <div className="rozzi-register-field">
              <label htmlFor="register-phone">Phone number</label>
              <input
                id="register-phone"
                className="rozzi-register-input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="+234..."
              />
            </div>

            <div className="rozzi-register-field">
              <label htmlFor="register-password">Password</label>

              <div className="rozzi-register-input-wrap">
                <input
                  id="register-password"
                  className="rozzi-register-input rozzi-register-password-input"
                  type={showPassword ? 'text' : 'password'}
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Create a password"
                  required
                />

                <button
                  type="button"
                  className="rozzi-register-password-toggle"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>

              <small className="rozzi-register-hint">
                At least 8 characters, including a letter and a number.
              </small>
            </div>

            <div className="rozzi-register-field">
              <label htmlFor="register-confirm-password">
                Confirm password
              </label>

              <div className="rozzi-register-input-wrap">
                <input
                  id="register-confirm-password"
                  className="rozzi-register-input rozzi-register-password-input"
                  type={showConfirmPassword ? 'text' : 'password'}
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Confirm your password"
                  required
                />

                <button
                  type="button"
                  className="rozzi-register-password-toggle"
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
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>

            <button
              className="rozzi-register-submit"
              type="submit"
              disabled={busy}
            >
              {busy ? 'Creating your account...' : 'Create account'}
            </button>
          </form>

          <p className="rozzi-register-footer">
            Already registered? <Link href="/login">Sign in</Link>
          </p>

          <p className="rozzi-register-terms">
            By creating an account, you agree to use ROZZI responsibly and
            provide accurate account information.
          </p>
        </section>
      </main>
    </div>
  );
}

export default function Register() {
  return (
    <Suspense
      fallback={
        <main className="rozzi-register-page">
          <style dangerouslySetInnerHTML={{ __html: pageStyles }} />
          <div
            style={{
              minHeight: '100vh',
              display: 'grid',
              placeItems: 'center',
              color: '#741b28',
              fontWeight: 800,
            }}
          >
            Loading ROZZI registration...
          </div>
        </main>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
