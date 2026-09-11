'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { post } from '../../lib/api';

function VerifyContent() {
  const sp = useSearchParams();
  const [msg, setMsg] = useState('Verifying...');

  useEffect(() => {
    const token = sp.get('token');

    if (!token) {
      setMsg('Missing verification token.');
      return;
    }

    post('/api/auth/verify-email', { token })
      .then(() => setMsg('Email verified successfully.'))
      .catch((e: any) => setMsg(e.message || 'Email verification failed.'));
  }, [sp]);

  return (
    <main className="shell">
      <h1>Rozzi account verification</h1>
      <p>{msg}</p>
    </main>
  );
}

export default function Verify() {
  return (
    <Suspense fallback={<main className="shell"><p>Verifying...</p></main>}>
      <VerifyContent />
    </Suspense>
  );
}