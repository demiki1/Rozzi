'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, post, setSession } from '../../lib/api';

const vehicles = [
  'BICYCLE',
  'MOTORCYCLE',
  'TRICYCLE',
  'CAR',
  'VAN',
  'ON_FOOT',
];

function friendlyRegisterError(error: any) {
  const message = String(error?.message || '').trim();
  const normalized = message.toLowerCase();

  if (!message) {
    return 'Unable to create your rider account. Please try again.';
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

  if (
    normalized.includes('401') ||
    normalized.includes('unauthorized')
  ) {
    return 'Unable to create your rider account. Please try again.';
  }

  return message;
}

export default function RiderRegister() {
  const router = useRouter();

  const [areas, setAreas] = useState<any[]>([]);

  const [f, setF] = useState({
    fullName: '',
    email: '',
    password: '',
    vehicleType: 'MOTORCYCLE',
    vehiclePlateNumber: '',
    address: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankName: '',
    documentUrl: '',
    documentType: 'IDENTITY',
    serviceAreaIds: [] as string[],
  });

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    api('/api/service-areas')
      .then(setAreas)
      .catch((e) => setError(e.message));
  }, []);

  const set = (key: string, value: any) => {
    setF((current) => ({
      ...current,
      [key]: value,
    }));
  };

  function toggle(id: string) {
    setF((current) => ({
      ...current,
      serviceAreaIds: current.serviceAreaIds.includes(id)
        ? current.serviceAreaIds.filter((areaId) => areaId !== id)
        : [...current.serviceAreaIds, id],
    }));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError('');

    const normalizedFullName = f.fullName.trim();
    const normalizedEmail = f.email.trim();

    if (!normalizedFullName) {
      setError('Please enter your full name.');
      return;
    }

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

    if (!f.serviceAreaIds.length) {
      setError('Please select at least one service area.');
      return;
    }

    setBusy(true);

    try {
      const session = await post('/api/auth/register', {
        fullName: normalizedFullName,
        email: normalizedEmail,
        password: f.password,
        role: 'RIDER',
      });

      setSession(session);

      await post('/api/rider/register', {
        vehicleType: f.vehicleType,
        vehiclePlateNumber:
          f.vehiclePlateNumber.trim() || undefined,
        address: f.address.trim() || undefined,
        emergencyContactName:
          f.emergencyContactName.trim() || undefined,
        emergencyContactPhone:
          f.emergencyContactPhone.trim() || undefined,
        bankAccountName:
          f.bankAccountName.trim() || undefined,
        bankAccountNumber:
          f.bankAccountNumber.trim() || undefined,
        bankName: f.bankName.trim() || undefined,
        serviceAreaIds: f.serviceAreaIds,
      });

      if (f.documentUrl.trim()) {
        await post('/api/rider/me/documents', {
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

  return (
    <main className="auth">
      <div
        className="authcard"
        style={{ maxWidth: 620 }}
      >
        <div className="brand">ROZZI RIDER</div>

        <h1>Become a rider</h1>

        <p className="muted">
          Submit your rider profile for verification before going
          online.
        </p>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submit}>
          <input
            className="input"
            placeholder="Full name"
            value={f.fullName}
            onChange={(e) => set('fullName', e.target.value)}
            autoComplete="name"
            required
          />

          <input
            className="input"
            placeholder="you@example.com"
            type="email"
            value={f.email}
            onChange={(e) => set('email', e.target.value)}
            autoComplete="email"
            required
          />

          <div style={{ position: 'relative' }}>
            <input
              className="input"
              placeholder="Password (8+ chars, letter + number)"
              type={showPassword ? 'text' : 'password'}
              value={f.password}
              onChange={(e) => set('password', e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
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

          <p className="muted" style={{ marginTop: 4 }}>
            Password must contain at least 8 characters, one letter
            and one number.
          </p>

          <select
            className="input"
            value={f.vehicleType}
            onChange={(e) =>
              set('vehicleType', e.target.value)
            }
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle} value={vehicle}>
                {vehicle}
              </option>
            ))}
          </select>

          <input
            className="input"
            placeholder="Vehicle plate number"
            value={f.vehiclePlateNumber}
            onChange={(e) =>
              set('vehiclePlateNumber', e.target.value)
            }
          />

          <input
            className="input"
            placeholder="Address"
            value={f.address}
            onChange={(e) => set('address', e.target.value)}
            autoComplete="street-address"
          />

          <h3>Service areas</h3>

          <div className="card">
            {areas.length === 0 ? (
              <p className="muted">
                Loading available service areas…
              </p>
            ) : (
              areas.map((area) => (
                <label className="row" key={area.id}>
                  <input
                    type="checkbox"
                    checked={f.serviceAreaIds.includes(area.id)}
                    onChange={() => toggle(area.id)}
                  />

                  <span>{area.name}</span>
                </label>
              ))
            )}
          </div>

          <input
            className="input"
            placeholder="Emergency contact name"
            value={f.emergencyContactName}
            onChange={(e) =>
              set('emergencyContactName', e.target.value)
            }
          />

          <input
            className="input"
            placeholder="Emergency contact phone"
            type="tel"
            value={f.emergencyContactPhone}
            onChange={(e) =>
              set('emergencyContactPhone', e.target.value)
            }
          />

          <input
            className="input"
            placeholder="Bank account name"
            value={f.bankAccountName}
            onChange={(e) =>
              set('bankAccountName', e.target.value)
            }
          />

          <input
            className="input"
            placeholder="Bank account number"
            value={f.bankAccountNumber}
            onChange={(e) =>
              set('bankAccountNumber', e.target.value)
            }
          />

          <input
            className="input"
            placeholder="Bank name"
            value={f.bankName}
            onChange={(e) => set('bankName', e.target.value)}
          />

          <input
            className="input"
            placeholder="Identity document URL (optional)"
            value={f.documentUrl}
            onChange={(e) =>
              set('documentUrl', e.target.value)
            }
          />

          <button
            className="btn"
            type="submit"
            disabled={busy || !f.serviceAreaIds.length}
          >
            {busy ? 'Submitting…' : 'Submit for approval'}
          </button>
        </form>

        <p className="muted">
          Already registered?{' '}
          <a href="/login">Sign in</a>
        </p>
      </div>
    </main>
  );
}