'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

function AcceptInvitation() {
  const q = useSearchParams();
  const router = useRouter();

  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);

  async function go() {
    if (pw.length < 8 || pw !== confirm) {
      setMsg('Use at least 8 characters and make both passwords match.');
      return;
    }

    setSaving(true);

    try {
      await api(
        `/api/vendor/team/invitations/accept?token=${encodeURIComponent(
          q.get('token') || ''
        )}`,
        {
          method: 'POST',
          body: JSON.stringify({ password: pw }),
        }
      );

      setMsg('Invitation accepted. You can now sign in.');

      setTimeout(() => router.push('/login'), 900);
    } catch (e: any) {
      setMsg(e.message || 'This invitation is invalid or expired.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
    >
      <section
        className="team-modal"
        style={{ position: 'relative' }}
      >
        <div className="team-eyebrow">
          ROZZI TEAM INVITATION
        </div>

        <h2>Set your password</h2>

        <p className="team-helper">
          Create a password to access the vendor workspace.
        </p>

        <label>
          Password
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
        </label>

        <label>
          Confirm password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        {msg && <div className="team-alert">{msg}</div>}

        <button
          className="team-primary"
          disabled={saving}
          onClick={go}
        >
          {saving ? 'Creating account…' : 'Accept invitation'}
        </button>
      </section>
    </main>
  );
}

export default function Accept() {
  return (
    <Suspense
      fallback={
        <main
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            padding: 20,
          }}
        >
          <section className="team-modal">
            <div className="team-eyebrow">
              ROZZI TEAM INVITATION
            </div>
            <h2>Loading invitation…</h2>
            <p className="team-helper">
              Preparing your invitation.
            </p>
          </section>
        </main>
      }
    >
      <AcceptInvitation />
    </Suspense>
  );
} 
