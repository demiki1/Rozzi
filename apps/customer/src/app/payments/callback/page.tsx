'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../../lib/api';

function PaymentCallbackContent() {
  const search = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('Verifying your payment…');

  useEffect(() => {
    const reference = search.get('reference');
    const transactionId = search.get('transaction_id');

    if (!reference) {
      setMessage('Payment reference is missing.');
      return;
    }

    api(
      `/api/payments/verify/${encodeURIComponent(reference)}${
        transactionId
          ? `?transaction_id=${encodeURIComponent(transactionId)}`
          : ''
      }`,
    )
      .then(() => {
        setMessage('Payment verified. Redirecting to your order…');
        setTimeout(() => router.push('/orders'), 700);
      })
      .catch((e: any) =>
        setMessage(e.message || 'Payment verification failed.'),
      );
  }, [search, router]);

  return (
    <main className="shell">
      <h1>ROZZI Payment</h1>
      <p>{message}</p>
      <button className="btn" onClick={() => router.push('/orders')}>
        Back to orders
      </button>
    </main>
  );
}

export default function PaymentCallback() {
  return (
    <Suspense
      fallback={
        <main className="shell">
          <h1>ROZZI Payment</h1>
          <p>Loading payment details…</p>
        </main>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  );
}