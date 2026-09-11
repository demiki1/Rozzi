'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '../../../../lib/api';

function FlutterwaveCallbackContent() {
  const params = useSearchParams();
  const [message, setMessage] = useState('Verifying your payment securely...');
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const reference = params.get('tx_ref') || params.get('reference');
    const transactionId = params.get('transaction_id');

    if (!reference) {
      setMessage('Payment reference was not provided.');
      return;
    }

    const path = transactionId
      ? `/api/payments/verify/${encodeURIComponent(reference)}?transaction_id=${encodeURIComponent(transactionId)}`
      : `/api/payments/verify/${encodeURIComponent(reference)}`;

    api<any>(path)
      .then((result) => {
        if (result?.status === 'success' || result?.status === 'SUCCESS') {
          setOk(true);
          setMessage('Payment verified successfully.');
        } else {
          setMessage(
            `Payment status: ${
              result?.status || 'pending'
            }. You can return to your orders to check the latest status.`
          );
        }
      })
      .catch((e: any) =>
        setMessage(e.message || 'Payment verification failed.')
      );
  }, [params]);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">
        {ok ? 'Payment confirmed' : 'Payment verification'}
      </h1>

      <p className="mt-3">{message}</p>

      <a className="mt-6 inline-block underline" href="/orders">
        Go to orders
      </a>
    </main>
  );
}

export default function FlutterwaveCallback() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-xl p-8">
          <h1 className="text-2xl font-semibold">Payment verification</h1>
          <p className="mt-3">Verifying your payment securely...</p>
        </main>
      }
    >
      <FlutterwaveCallbackContent />
    </Suspense>
  );
}