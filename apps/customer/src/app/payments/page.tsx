'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';

type PaymentStatus =
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'ABANDONED'
  | 'REFUNDED';

type PaymentProvider =
  | 'PAYSTACK'
  | 'FLUTTERWAVE'
  | 'WALLET';

type RefundStatus =
  | 'REQUESTED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED';

type Refund = {
  id: string;
  amount: number;
  reason?: string | null;
  status: RefundStatus;
  providerReference?: string | null;
  processedAt?: string | null;
  createdAt: string;
};

type Payment = {
  id: string;
  orderId: string;
  provider: PaymentProvider;
  reference: string;
  providerTransactionId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    createdAt: string;
  };
  refunds: Refund[];
};

function formatMoney(amountKobo: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amountKobo / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function providerLabel(provider: PaymentProvider) {
  switch (provider) {
    case 'WALLET':
      return 'ROZZI Wallet';
    case 'PAYSTACK':
      return 'Bank / Provider Transfer';
    case 'FLUTTERWAVE':
      return 'Bank / Provider Transfer';
    default:
      return provider;
  }
}

function statusLabel(status: PaymentStatus) {
  switch (status) {
    case 'SUCCESS':
      return 'Successful';
    case 'PENDING':
      return 'Pending';
    case 'FAILED':
      return 'Failed';
    case 'ABANDONED':
      return 'Abandoned';
    case 'REFUNDED':
      return 'Refunded';
    default:
      return status;
  }
}

function statusClass(status: PaymentStatus) {
  switch (status) {
    case 'SUCCESS':
      return 'payment-status payment-status-success';
    case 'PENDING':
      return 'payment-status payment-status-pending';
    case 'FAILED':
    case 'ABANDONED':
      return 'payment-status payment-status-failed';
    case 'REFUNDED':
      return 'payment-status payment-status-refunded';
    default:
      return 'payment-status';
  }
}

function refundStatusLabel(status: RefundStatus) {
  switch (status) {
    case 'REQUESTED':
      return 'Requested';
    case 'PROCESSING':
      return 'Processing';
    case 'PROCESSED':
      return 'Processed';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadPayments() {
    setLoading(true);
    setError('');

    try {
      const data = await api<Payment[]>('/api/payments/mine');
      setPayments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(
        err?.message ||
          'We could not load your payment history. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('rozzi_token')
        : null;

    if (!token) {
      window.location.href = '/login?next=/payments';
      return;
    }

    loadPayments();
  }, []);

  const summary = useMemo(() => {
    const successful = payments.filter(
      (payment) => payment.status === 'SUCCESS',
    );

    const totalPaid = successful.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    const refunded = payments.reduce(
      (sum, payment) =>
        sum +
        payment.refunds
          .filter((refund) => refund.status === 'PROCESSED')
          .reduce(
            (refundSum, refund) => refundSum + refund.amount,
            0,
          ),
      0,
    );

    return {
      successfulCount: successful.length,
      totalPaid,
      refunded,
    };
  }, [payments]);

  if (loading) {
    return (
      <main className="payments-page">
        <header className="payments-header">
          <div className="payments-header-inner">
            <Link href="/" className="payments-logo">
              <img src="/rozzi-logo.png" alt="ROZZI" />
            </Link>

            <nav className="payments-nav">
              <Link href="/">Shop</Link>
              <Link href="/orders">Orders</Link>
              <Link href="/account">Account</Link>
            </nav>
          </div>
        </header>

        <div className="payments-container">
          <div className="payments-title">
            <span className="payments-eyebrow">ACCOUNT</span>
            <h1>Payments</h1>
            <p>Your ROZZI payment history.</p>
          </div>

          <div className="payments-loading">
            <div className="payments-spinner" />
            <strong>Loading payment history</strong>
            <span>Please wait while we retrieve your payments.</span>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="payments-page">
      <header className="payments-header">
        <div className="payments-header-inner">
          <Link href="/" className="payments-logo">
            <img src="/rozzi-logo.png" alt="ROZZI" />
          </Link>

          <nav className="payments-nav">
            <Link href="/">Shop</Link>
            <Link href="/orders">Orders</Link>
            <Link href="/account">Account</Link>
          </nav>

          <Link href="/account" className="payments-account-link">
            Back to Account
          </Link>
        </div>
      </header>

      <div className="payments-container">
        <div className="payments-title-row">
          <div className="payments-title">
            <span className="payments-eyebrow">ACCOUNT</span>
            <h1>Payments</h1>
            <p>
              Keep track of how you have paid for your ROZZI orders.
            </p>
          </div>

          <Link href="/wallet" className="payments-wallet-button">
            Open ROZZI Wallet
          </Link>
        </div>

        {error && (
          <div className="payments-error">
            <div>
              <strong>Unable to load payments</strong>
              <p>{error}</p>
            </div>

            <button
              type="button"
              onClick={loadPayments}
              className="payments-retry"
            >
              Try again
            </button>
          </div>
        )}

        {!error && (
          <>
            <section className="payments-summary-grid">
              <article className="payments-summary-card">
                <span>Total successful payments</span>
                <strong>
                  {formatMoney(summary.totalPaid)}
                </strong>
                <small>
                  Across {summary.successfulCount}{' '}
                  successful payment
                  {summary.successfulCount === 1 ? '' : 's'}
                </small>
              </article>

              <article className="payments-summary-card">
                <span>Refunded</span>
                <strong>
                  {formatMoney(summary.refunded)}
                </strong>
                <small>
                  Successfully processed refunds
                </small>
              </article>

              <article className="payments-summary-card payments-summary-highlight">
                <span>Preferred payment</span>
                <strong>ROZZI Wallet</strong>
                <small>
                  Use your wallet when you have sufficient balance.
                </small>
              </article>
            </section>

            <section className="payments-card">
              <div className="payments-card-heading">
                <div>
                  <span className="payments-section-kicker">
                    TRANSACTION HISTORY
                  </span>
                  <h2>Your payments</h2>
                  <p>
                    Every payment recorded against your ROZZI orders.
                  </p>
                </div>
              </div>

              {payments.length === 0 ? (
                <div className="payments-empty">
                  <div className="payments-empty-icon">₦</div>
                  <div>
                    <h3>No payments yet</h3>
                    <p>
                      Your payment history will appear here after
                      you make your first order payment.
                    </p>
                  </div>
                  <Link href="/" className="payments-primary-button">
                    Start shopping
                  </Link>
                </div>
              ) : (
                <div className="payments-list">
                  {payments.map((payment) => (
                    <article
                      key={payment.id}
                      className="payment-item"
                    >
                      <div className="payment-item-main">
                        <div className="payment-icon">
                          {payment.provider === 'WALLET'
                            ? '₦'
                            : '↗'}
                        </div>

                        <div className="payment-item-info">
                          <div className="payment-item-top">
                            <strong>
                              {providerLabel(payment.provider)}
                            </strong>

                            <span
                              className={statusClass(
                                payment.status,
                              )}
                            >
                              {statusLabel(payment.status)}
                            </span>
                          </div>

                          <p>
                            Order{' '}
                            <Link
                              href={`/orders/${payment.orderId}`}
                            >
                              {payment.order.orderNumber}
                            </Link>
                          </p>

                          <small>
                            {formatDate(
                              payment.paidAt ??
                                payment.createdAt,
                            )}
                          </small>
                        </div>
                      </div>

                      <div className="payment-item-amount">
                        <strong>
                          {formatMoney(
                            payment.amount,
                            payment.currency,
                          )}
                        </strong>

                        <span>
                          Ref: {payment.reference}
                        </span>
                      </div>

                      {payment.refunds.length > 0 && (
                        <div className="payment-refunds">
                          <div className="payment-refunds-heading">
                            <strong>Refund activity</strong>
                          </div>

                          {payment.refunds.map((refund) => (
                            <div
                              key={refund.id}
                              className="payment-refund-row"
                            >
                              <div>
                                <strong>
                                  {formatMoney(
                                    refund.amount,
                                    payment.currency,
                                  )}
                                </strong>

                                <span>
                                  {refund.reason ||
                                    'Refund for this order'}
                                </span>
                              </div>

                              <div>
                                <b>
                                  {refundStatusLabel(
                                    refund.status,
                                  )}
                                </b>

                                <small>
                                  {formatDate(
                                    refund.processedAt ??
                                      refund.createdAt,
                                  )}
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="payments-info-card">
              <div className="payments-info-icon">✓</div>
              <div>
                <strong>Your payments are securely recorded</strong>
                <p>
                  Payment status shown here comes from ROZZI&apos;s
                  payment records. Provider payments are confirmed
                  server-side before an order is marked as paid.
                </p>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}