'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setSession, post } from '../../lib/api';

function friendlyRegisterError(error: any) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return 'Unable to create your account. Please try again.';
  }

  if (
    normalized.includes('already exists') ||
    normalized.includes('email or phone')
  ) {
    return 'An account with this email or phone already exists.';
  }

  if (
    normalized.includes('invalid email') ||
    normalized.includes('email must be an email')
  ) {
    return 'Please enter a valid email address.';
  }

  if (normalized.includes('password')) {
    return message;
  }

  if (normalized.includes('401') || normalized.includes('unauthorized')) {
    return 'Unable to create your account. Please try again.';
  }

  return message;
}

type FormState = {
  fullName: string;
  email: string;
  password: string;
  vendorTypeId: string;
  storeName: string;
  description: string;
  phone: string;
  serviceAreaId: string;
  address: string;
  documentUrl: string;
  documentType: string;
};

const initialForm: FormState = {
  fullName: '',
  email: '',
  password: '',
  vendorTypeId: '',
  storeName: '',
  description: '',
  phone: '',
  serviceAreaId: '',
  address: '',
  documentUrl: '',
  documentType: 'BUSINESS_REGISTRATION',
};

export default function VendorRegister() {
  const router = useRouter();

  const [types, setTypes] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [f, setF] = useState<FormState>(initialForm);

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    Promise.all([
      api('/api/vendor-types'),
      api('/api/service-areas'),
    ])
      .then(([t, a]) => {
        setTypes(t);
        setAreas(a);
      })
      .catch((e) => setError(e.message || 'Unable to load registration options.'));
  }, []);

  const set = (key: keyof FormState, value: string) => {
    setF((current) => ({
      ...current,
      [key]: value,
    }));
  };

  function continueToStepTwo() {
    setError('');

    if (!f.fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const normalizedEmail = f.email.trim();

    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!f.password) {
      setError('Please enter a password.');
      return;
    }

    if (f.password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (!/[A-Za-z]/.test(f.password)) {
      setError('Password must contain at least one letter.');
      return;
    }

    if (!/\d/.test(f.password)) {
      setError('Password must contain at least one number.');
      return;
    }

    setStep(2);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const normalizedEmail = f.email.trim();

      const session = await post('/api/auth/register', {
        fullName: f.fullName.trim(),
        email: normalizedEmail,
        password: f.password,
        role: 'VENDOR',
      });

      setSession(session);

      await post('/api/vendor/register', {
        vendorTypeId: f.vendorTypeId,
        storeName: f.storeName.trim(),
        description: f.description.trim() || undefined,
        phone: f.phone.trim() || undefined,
        serviceAreaId: f.serviceAreaId,
        address: f.address.trim() || undefined,
      });

      if (f.documentUrl.trim()) {
        await post('/api/vendor/me/documents', {
          docType: f.documentType,
          fileUrl: f.documentUrl.trim(),
        });
      }

      router.push('/');
    } catch (e: any) {
      setError(friendlyRegisterError(e));
    } finally {
      setBusy(false);
    }
  }

  const progress = step === 1 ? 50 : 100;

  return (
    <main className="vendor-register">
      <div className="register-shell">
        <section className="brand-panel">
          <div className="brand-top">
            <div className="brand-logo">
              <img
                src="/rozzi-logo.png"
                alt="ROZZI"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span>ROZZI</span>
            </div>
            <span className="partner-label">VENDOR</span>
          </div>

          <div className="brand-content">
            <span className="brand-eyebrow">GROW WITH ROZZI</span>
            <h1>
              Turn your store into
              <span> a ROZZI shop.</span>
            </h1>
            <p>
              Reach nearby customers, manage your products and grow your
              business through the ROZZI marketplace.
            </p>

            <div className="benefits">
              <div className="benefit">
                <div className="benefit-icon">01</div>
                <div>
                  <strong>Set up your store</strong>
                  <span>Create your business profile in minutes.</span>
                </div>
              </div>

              <div className="benefit">
                <div className="benefit-icon">02</div>
                <div>
                  <strong>Reach local customers</strong>
                  <span>Show your products to customers in your service area.</span>
                </div>
              </div>

              <div className="benefit">
                <div className="benefit-icon">03</div>
                <div>
                  <strong>Sell & grow</strong>
                  <span>Manage orders and build your ROZZI business.</span>
                </div>
              </div>
            </div>
          </div>

          <div className="brand-footer">
            <span>ROZZI MARKETPLACE</span>
            <span>SHOP · SELL · DELIVER</span>
          </div>
        </section>

        <section className="form-panel">
          <div className="mobile-brand">
            <div className="mobile-logo">
              <img
                src="/rozzi-logo.png"
                alt="ROZZI"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <span>ROZZI</span>
            </div>
            <span>VENDOR</span>
          </div>

          <div className="form-top">
            <div>
              <span className="step-label">
                STEP {step} OF 2
              </span>
              <div className="progress-track" aria-hidden="true">
                <div
                  className="progress-value"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            <span className="step-copy">
              {step === 1 ? 'Your account' : 'Your store'}
            </span>
          </div>

          <div className="form-heading">
            <span className="section-kicker">
              {step === 1 ? 'WELCOME TO ROZZI' : 'STORE PROFILE'}
            </span>
            <h2>
              {step === 1 ? 'Create your vendor account' : 'Tell us about your store'}
            </h2>
            <p>
              {step === 1
                ? 'Start your journey as a ROZZI business partner.'
                : 'Give customers the information they need to discover your business.'}
            </p>
          </div>

          {error && (
            <div className="form-error" role="alert">
              <span>!</span>
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={submit} className="register-form">
            {step === 1 ? (
              <>
                <div className="field">
                  <label htmlFor="fullName">Full name</label>
                  <input
                    id="fullName"
                    className="input"
                    placeholder="Enter your full name"
                    value={f.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="email">Email address</label>
                  <input
                    id="email"
                    className="input"
                    placeholder="you@example.com"
                    type="email"
                    value={f.email}
                    onChange={(e) => set('email', e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div className="password-wrap">
                    <input
                      id="password"
                      className="input"
                      placeholder="Create a secure password"
                      type={showPassword ? 'text' : 'password'}
                      value={f.password}
                      onChange={(e) => set('password', e.target.value)}
                      autoComplete="new-password"
                      required
                      minLength={8}
                      maxLength={72}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                  <small>At least 8 characters, including a letter and a number.</small>
                </div>

                <button
                  type="button"
                  className="primary-button"
                  onClick={continueToStepTwo}
                >
                  Continue
                  <span>→</span>
                </button>
              </>
            ) : (
              <>
                <div className="field">
                  <label htmlFor="storeName">Store name</label>
                  <input
                    id="storeName"
                    className="input"
                    placeholder="e.g. Frank's Kitchen"
                    value={f.storeName}
                    onChange={(e) => set('storeName', e.target.value)}
                    required
                  />
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="vendorType">Business type</label>
                    <select
                      id="vendorType"
                      className="input"
                      value={f.vendorTypeId}
                      onChange={(e) => set('vendorTypeId', e.target.value)}
                      required
                    >
                      <option value="">Select type</option>
                      {types.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="serviceArea">Service area</label>
                    <select
                      id="serviceArea"
                      className="input"
                      value={f.serviceAreaId}
                      onChange={(e) => set('serviceAreaId', e.target.value)}
                      required
                    >
                      <option value="">Select area</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>
                          {area.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field-grid">
                  <div className="field">
                    <label htmlFor="phone">Phone number</label>
                    <input
                      id="phone"
                      className="input"
                      placeholder="+234..."
                      type="tel"
                      value={f.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      autoComplete="tel"
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="address">Store address</label>
                    <input
                      id="address"
                      className="input"
                      placeholder="Business address"
                      value={f.address}
                      onChange={(e) => set('address', e.target.value)}
                      autoComplete="street-address"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="description">
                    Store description <span>Optional</span>
                  </label>
                  <textarea
                    id="description"
                    className="input textarea"
                    placeholder="Tell customers what your store sells..."
                    value={f.description}
                    onChange={(e) => set('description', e.target.value)}
                    maxLength={500}
                    rows={3}
                  />
                </div>

                <div className="field">
                  <label htmlFor="documentUrl">
                    Business document URL <span>Optional</span>
                  </label>
                  <input
                    id="documentUrl"
                    className="input"
                    placeholder="https://..."
                    value={f.documentUrl}
                    onChange={(e) => set('documentUrl', e.target.value)}
                  />
                  <small>
                    You can provide a business registration document for your
                    verification review.
                  </small>
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      setError('');
                      setStep(1);
                    }}
                    disabled={busy}
                  >
                    ← Back
                  </button>

                  <button
                    className="primary-button"
                    type="submit"
                    disabled={busy}
                  >
                    {busy ? 'Creating store...' : 'Submit for approval'}
                    {!busy && <span>→</span>}
                  </button>
                </div>
              </>
            )}
          </form>

          <div className="form-footer">
            <span>Already registered?</span>{' '}
            <a href="/login">Sign in</a>
          </div>

          <p className="approval-note">
            <span>✓</span>
            Your store will be reviewed by ROZZI before it goes live.
          </p>
        </section>
      </div>

      <style jsx>{`
        .vendor-register {
          min-height: 100vh;
          padding: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background:
            radial-gradient(circle at 15% 20%, rgba(244, 166, 35, 0.12), transparent 30%),
            radial-gradient(circle at 85% 80%, rgba(126, 27, 41, 0.10), transparent 34%),
            #fbf8f3;
          color: #171313;
        }

        .register-shell {
          width: min(1120px, 100%);
          min-height: 700px;
          display: grid;
          grid-template-columns: 0.92fr 1.08fr;
          overflow: hidden;
          border: 1px solid rgba(102, 48, 33, 0.12);
          border-radius: 28px;
          background: #fffdf9;
          box-shadow: 0 28px 80px rgba(70, 30, 22, 0.13);
        }

        .brand-panel {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 42px;
          overflow: hidden;
          background:
            radial-gradient(circle at 90% 12%, rgba(246, 178, 42, 0.28), transparent 27%),
            linear-gradient(145deg, #5f121d 0%, #771a25 52%, #9d3b19 100%);
          color: white;
        }

        .brand-panel::before,
        .brand-panel::after {
          content: '';
          position: absolute;
          border: 1px solid rgba(255, 213, 112, 0.18);
          border-radius: 999px;
          pointer-events: none;
        }

        .brand-panel::before {
          width: 300px;
          height: 300px;
          right: -150px;
          top: 170px;
        }

        .brand-panel::after {
          width: 190px;
          height: 190px;
          left: -95px;
          bottom: 80px;
        }

        .brand-top,
        .brand-content,
        .brand-footer {
          position: relative;
          z-index: 1;
        }

        .brand-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .brand-logo,
        .mobile-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 900;
          letter-spacing: -0.03em;
          font-size: 22px;
        }

        .brand-logo img,
        .mobile-logo img {
          width: 42px;
          height: 42px;
          object-fit: contain;
          border-radius: 12px;
          background: white;
        }

        .partner-label {
          padding: 8px 11px;
          border: 1px solid rgba(255, 255, 255, 0.24);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        .brand-content {
          max-width: 450px;
          margin-top: 60px;
          margin-bottom: auto;
        }

        .brand-eyebrow,
        .section-kicker,
        .step-label {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .brand-eyebrow {
          color: #ffd35d;
        }

        .brand-content h1 {
          margin: 14px 0 18px;
          font-size: clamp(38px, 4vw, 58px);
          line-height: 0.98;
          letter-spacing: -0.055em;
        }

        .brand-content h1 span {
          color: #ffd35d;
        }

        .brand-content > p {
          max-width: 420px;
          margin: 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: 15px;
          line-height: 1.7;
        }

        .benefits {
          display: grid;
          gap: 16px;
          margin-top: 40px;
        }

        .benefit {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .benefit-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 38px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.10);
          border: 1px solid rgba(255, 255, 255, 0.13);
          color: #ffd35d;
          font-size: 10px;
          font-weight: 900;
        }

        .benefit strong,
        .benefit span {
          display: block;
        }

        .benefit strong {
          font-size: 13px;
          margin-bottom: 3px;
        }

        .benefit span {
          color: rgba(255, 255, 255, 0.60);
          font-size: 11px;
          line-height: 1.4;
        }

        .brand-footer {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding-top: 30px;
          color: rgba(255, 255, 255, 0.46);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.14em;
        }

        .form-panel {
          padding: 52px 58px 42px;
          background: #fffdf9;
        }

        .mobile-brand {
          display: none;
        }

        .form-top {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 42px;
        }

        .step-label {
          display: block;
          margin-bottom: 8px;
          color: #8d6a58;
        }

        .step-copy {
          color: #8d6a58;
          font-size: 11px;
          font-weight: 700;
        }

        .progress-track {
          width: 170px;
          height: 4px;
          overflow: hidden;
          border-radius: 999px;
          background: #eee5dc;
        }

        .progress-value {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #7b1727, #f28b1d);
          transition: width 220ms ease;
        }

        .form-heading {
          margin-bottom: 28px;
        }

        .section-kicker {
          color: #b16a22;
        }

        .form-heading h2 {
          margin: 8px 0 9px;
          color: #27181a;
          font-size: clamp(30px, 3vw, 42px);
          line-height: 1.03;
          letter-spacing: -0.045em;
        }

        .form-heading p {
          margin: 0;
          color: #806e66;
          font-size: 13px;
          line-height: 1.6;
        }

        .form-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 20px;
          padding: 12px 14px;
          border: 1px solid #f1c7c2;
          border-radius: 12px;
          background: #fff4f2;
          color: #8c2525;
          font-size: 12px;
        }

        .form-error span {
          width: 18px;
          height: 18px;
          flex: 0 0 18px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #8c2525;
          color: white;
          font-size: 11px;
          font-weight: 900;
        }

        .form-error p {
          margin: 1px 0 0;
        }

        .register-form {
          display: grid;
          gap: 17px;
        }

        .field {
          display: grid;
          gap: 7px;
        }

        .field-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .field label {
          color: #3b2928;
          font-size: 11px;
          font-weight: 850;
        }

        .field label span {
          color: #9c8c84;
          font-weight: 600;
        }

        .input {
          width: 100%;
          min-height: 48px;
          box-sizing: border-box;
          border: 1px solid #dfd4ca;
          border-radius: 12px;
          outline: none;
          background: #fffefa;
          color: #241719;
          padding: 13px 14px;
          font: inherit;
          font-size: 13px;
          transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }

        .input::placeholder {
          color: #aa9c94;
        }

        .input:focus {
          border-color: #9d3b19;
          background: white;
          box-shadow: 0 0 0 4px rgba(157, 59, 25, 0.08);
        }

        select.input {
          cursor: pointer;
        }

        .textarea {
          resize: vertical;
          min-height: 82px;
        }

        .field small {
          color: #95867e;
          font-size: 10px;
          line-height: 1.5;
        }

        .password-wrap {
          position: relative;
        }

        .password-wrap .input {
          padding-right: 66px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 12px;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: #8b3923;
          cursor: pointer;
          font-size: 10px;
          font-weight: 900;
          padding: 5px;
        }

        .primary-button,
        .secondary-button {
          min-height: 48px;
          border-radius: 12px;
          padding: 0 18px;
          font: inherit;
          font-size: 12px;
          font-weight: 900;
          cursor: pointer;
          transition: transform 150ms ease, box-shadow 150ms ease, opacity 150ms ease;
        }

        .primary-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          width: 100%;
          border: 0;
          background: #171414;
          color: white;
          box-shadow: 0 9px 20px rgba(23, 20, 20, 0.12);
        }

        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 12px 24px rgba(23, 20, 20, 0.16);
        }

        .primary-button span {
          color: #ffd15b;
          font-size: 15px;
        }

        .secondary-button {
          border: 1px solid #ddd1c7;
          background: #fffdf9;
          color: #4d3834;
        }

        .secondary-button:hover:not(:disabled) {
          background: #f8f1ea;
        }

        .primary-button:disabled,
        .secondary-button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .action-row {
          display: grid;
          grid-template-columns: 110px 1fr;
          gap: 12px;
          margin-top: 4px;
        }

        .form-footer {
          margin-top: 22px;
          color: #8c7c74;
          font-size: 11px;
        }

        .form-footer a {
          color: #c45117;
          font-weight: 900;
          text-decoration: none;
        }

        .form-footer a:hover {
          text-decoration: underline;
        }

        .approval-note {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 20px 0 0;
          padding-top: 18px;
          border-top: 1px solid #eee6de;
          color: #8a7a72;
          font-size: 10px;
          line-height: 1.5;
        }

        .approval-note span {
          color: #6f8e3a;
          font-weight: 900;
        }

        @media (max-width: 900px) {
          .vendor-register {
            padding: 18px;
          }

          .register-shell {
            grid-template-columns: 1fr;
            min-height: auto;
          }

          .brand-panel {
            display: none;
          }

          .mobile-brand {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 28px;
          }

          .mobile-brand > span {
            color: #8d6a58;
            font-size: 10px;
            font-weight: 900;
            letter-spacing: 0.14em;
          }

          .form-panel {
            padding: 30px 26px 28px;
          }
        }

        @media (max-width: 560px) {
          .vendor-register {
            min-height: 100dvh;
            padding: 0;
            align-items: stretch;
          }

          .register-shell {
            width: 100%;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .form-panel {
            padding: 24px 18px;
          }

          .form-top {
            margin-bottom: 30px;
          }

          .form-heading h2 {
            font-size: 31px;
          }

          .field-grid,
          .action-row {
            grid-template-columns: 1fr;
          }

          .secondary-button {
            order: 2;
          }

          .primary-button {
            order: 1;
          }

          .progress-track {
            width: 120px;
          }
        }
      `}</style>
    </main>
  );
}
