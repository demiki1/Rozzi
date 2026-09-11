'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, post } from '../../lib/api';

const money = (k = 0) =>
  `₦${(Number(k) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const naira = (value: number) =>
  `₦${value.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

function Icon({
  type,
  size = 20,
}: {
  type:
    | 'wallet'
    | 'plus'
    | 'withdraw'
    | 'history'
    | 'bank'
    | 'shield'
    | 'arrow'
    | 'check'
    | 'clock'
    | 'alert';
  size?: number;
}) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (type === 'wallet')
    return (
      <svg {...p}>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
        <path d="M4 8h15" />
        <path d="M16 13h4" />
        <circle cx="16" cy="13" r=".7" fill="currentColor" />
      </svg>
    );

  if (type === 'plus')
    return (
      <svg {...p}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    );

  if (type === 'withdraw')
    return (
      <svg {...p}>
        <path d="M12 4v15" />
        <path d="m6 13 6 6 6-6" />
      </svg>
    );

  if (type === 'history')
    return (
      <svg {...p}>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    );

  if (type === 'bank')
    return (
      <svg {...p}>
        <path d="m3 9 9-5 9 5" />
        <path d="M5 10v7M9 10v7M15 10v7M19 10v7" />
        <path d="M3 20h18M2 17h20" />
      </svg>
    );

  if (type === 'shield')
    return (
      <svg {...p}>
        <path d="M12 3 20 6v5c0 5-3.3 8.2-8 10-4.7-1.8-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );

  if (type === 'arrow')
    return (
      <svg {...p}>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </svg>
    );

  if (type === 'check')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    );

  if (type === 'clock')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );

  return (
    <svg {...p}>
      <path d="M12 3 2.8 20h18.4L12 3Z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

function transactionType(type: string) {
  return String(type || 'TRANSACTION')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isCredit(type: string, amount: number) {
  const value = String(type || '').toUpperCase();

  return (
    value === 'TOP_UP' ||
    value === 'REFUND' ||
    value === 'CREDIT' ||
    value === 'CASHBACK' ||
    value === 'REWARD' ||
    (amount > 0 && value !== 'WITHDRAWAL')
  );
}

function transactionStatus(status: string) {
  const value = String(status || '').toUpperCase();

  if (['SUCCESS', 'COMPLETED'].includes(value)) return 'success';
  if (['PENDING', 'REQUESTED'].includes(value)) return 'pending';
  if (['FAILED', 'REJECTED', 'CANCELLED'].includes(value)) return 'failed';

  return 'neutral';
}

function WalletContent() {
  const search = useSearchParams();

  const [wallet, setWallet] = useState<any>(null);

  const [topUpAmount, setTopUpAmount] = useState('1000');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function loadWallet() {
    try {
      setError('');
      const data = await api('/api/wallet');
      setWallet(data);
    } catch (e: any) {
      setError(e?.message || 'Unable to load your wallet.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWallet();
  }, []);

  useEffect(() => {
    const reference = search.get('topup_reference');

    if (!reference) return;

    (async () => {
      try {
        setMessage('Verifying your wallet funding...');

        await post('/api/wallet/top-up/verify', {
          reference,
        });

        setMessage('Wallet funded successfully.');

        await loadWallet();

        window.history.replaceState({}, '', '/wallet');
      } catch (e: any) {
        setError(e?.message || 'Unable to verify wallet funding.');
      }
    })();
  }, [search]);

  async function topUp() {
    const value = Number(topUpAmount);

    if (!Number.isFinite(value) || value < 100) {
      setError('Enter a valid amount of at least ₦100.');
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await post('/api/wallet/top-up', {
        amount: Math.round(value * 100),
      });

      if (!result?.authorizationUrl) {
        throw new Error('No payment authorization URL was returned.');
      }

      window.location.href = result.authorizationUrl;
    } catch (e: any) {
      setError(e?.message || 'Unable to start wallet funding.');
      setBusy(false);
    }
  }

  async function withdraw() {
    const value = Number(withdrawAmount);

    if (!Number.isFinite(value) || value < 100) {
      setError('Enter a valid withdrawal amount of at least ₦100.');
      return;
    }

    if (
      !bankName.trim() ||
      !accountName.trim() ||
      !/^\d{10}$/.test(accountNumber)
    ) {
      setError(
        'Enter your bank name, account name and valid 10-digit account number.'
      );
      return;
    }

    setBusy(true);
    setError('');
    setMessage('');

    try {
      const result = await post('/api/wallet/withdraw', {
        amount: Math.round(value * 100),
        bankName,
        accountName,
        accountNumber,
      });

      setMessage(
        `Withdrawal ${result.reference || ''} has been requested successfully.`
      );

      setWithdrawAmount('');
      setAccountNumber('');

      await loadWallet();
    } catch (e: any) {
      setError(e?.message || 'Unable to request this withdrawal.');
    } finally {
      setBusy(false);
    }
  }

  function scrollToSection(id: string) {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) {
    return (
      <main className="wallet-page">
        <style jsx>{styles}</style>

        <div className="wallet-loading">
          <div className="loading-logo">
            <img src="/rozzi-logo.png" alt="ROZZI" />
          </div>

          <div className="spinner" />

          <strong>Loading your ROZZI Wallet</strong>

          <span>Getting your latest balance...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="wallet-page">
      <style jsx>{styles}</style>

      {/* HEADER */}

      <header className="wallet-header">
        <div className="wallet-header-inner">
          <Link href="/" className="wallet-brand">
            <img src="/rozzi-logo.png" alt="ROZZI" />
            <span>ROZZI</span>
          </Link>

          <nav className="wallet-nav">
            <Link href="/">Shop</Link>
            <Link href="/orders">Orders</Link>
            <Link href="/wallet" className="active">
              Wallet
            </Link>
          </nav>

          <Link href="/account" className="wallet-account">
            <span className="account-avatar">M</span>
            <span>My account</span>
          </Link>
        </div>
      </header>

      <div className="wallet-container">

        {/* PAGE INTRO */}

        <div className="wallet-breadcrumb">
          <Link href="/">← Back to ROZZI</Link>
          <span>/</span>
          <strong>Wallet</strong>
        </div>

        <section className="wallet-intro">
          <div>
            <span className="wallet-kicker">ROZZI WALLET</span>

            <h1>
              Your money,
              <br />
              <span>made simple.</span>
            </h1>

            <p>
              Fund your wallet, manage eligible withdrawals and keep track of
              your ROZZI wallet activity in one place.
            </p>
          </div>

          <div className="secure-badge">
            <Icon type="shield" size={17} />
            Secure wallet
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="wallet-alert error-alert">
            <div className="alert-icon">
              <Icon type="alert" size={17} />
            </div>

            <div>
              <strong>Something needs your attention</strong>
              <span>{error}</span>
            </div>

            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* SUCCESS */}

        {message && (
          <div className="wallet-alert success-alert">
            <div className="alert-icon">
              <Icon type="check" size={17} />
            </div>

            <div>
              <strong>Wallet update</strong>
              <span>{message}</span>
            </div>

            <button onClick={() => setMessage('')}>×</button>
          </div>
        )}

        {/* BALANCE CARD */}

        <section className="wallet-balance-card">
          <div className="balance-decoration one" />
          <div className="balance-decoration two" />

          <div className="balance-card-top">
            <div className="balance-wallet-icon">
              <Icon type="wallet" size={25} />
            </div>

            <div>
              <span>Available balance</span>
              <strong>ROZZI Wallet</strong>
            </div>

            <span className="currency">NGN</span>
          </div>

          <div className="balance-value">
            {money(wallet?.balance)}
          </div>

          <p className="balance-description">
            Your available ROZZI wallet balance
          </p>

          <div className="balance-actions">
            <button
              className="balance-primary"
              onClick={() => scrollToSection('fund-wallet')}
            >
              <Icon type="plus" size={18} />
              Add money
            </button>

            <button
              className="balance-secondary"
              onClick={() => scrollToSection('withdraw-wallet')}
            >
              <Icon type="withdraw" size={18} />
              Withdraw
            </button>

            <button
              className="balance-secondary"
              onClick={() => scrollToSection('transactions')}
            >
              <Icon type="history" size={18} />
              Transactions
            </button>
          </div>
        </section>

        {/* QUICK STATS */}

        <section className="wallet-stats">

          <div className="wallet-stat">
            <div className="stat-icon orange">
              <Icon type="history" size={18} />
            </div>

            <div>
              <strong>
                {wallet?.transactions?.length || 0}
              </strong>

              <span>Recent transactions</span>
            </div>
          </div>

          <div className="wallet-stat">
            <div className="stat-icon green">
              <Icon type="check" size={18} />
            </div>

            <div>
              <strong>{wallet?.currency || 'NGN'}</strong>
              <span>Wallet currency</span>
            </div>
          </div>

          <div className="wallet-stat">
            <div className="stat-icon gold">
              <Icon type="shield" size={18} />
            </div>

            <div>
              <strong>Protected</strong>
              <span>Account wallet</span>
            </div>
          </div>

        </section>

        {/* MAIN GRID */}

        <div className="wallet-grid">

          <div className="wallet-main">

            {/* FUND */}

            <section className="wallet-panel" id="fund-wallet">

              <div className="panel-header">
                <div>
                  <span className="panel-kicker">FUND WALLET</span>

                  <h2>Add money to your wallet</h2>

                  <p>
                    Choose an amount and continue securely to payment.
                  </p>
                </div>

                <div className="panel-icon orange">
                  <Icon type="plus" size={20} />
                </div>
              </div>

              <div className="quick-amounts">
                {[1000, 2000, 5000, 10000].map((value) => (
                  <button
                    key={value}
                    className={
                      Number(topUpAmount) === value
                        ? 'quick-amount selected'
                        : 'quick-amount'
                    }
                    onClick={() => setTopUpAmount(String(value))}
                  >
                    {naira(value)}
                  </button>
                ))}
              </div>

              <label className="wallet-label">
                Amount

                <div className="amount-input">
                  <span>₦</span>

                  <input
                    value={topUpAmount}
                    onChange={(e) =>
                      setTopUpAmount(
                        e.target.value.replace(/[^\d.]/g, '')
                      )
                    }
                    placeholder="1,000"
                    inputMode="decimal"
                  />

                  <small>NGN</small>
                </div>
              </label>

              <button
                className="wallet-action-button orange-button"
                onClick={topUp}
                disabled={busy}
              >
                {busy ? 'Opening secure payment...' : 'Continue to payment'}

                {!busy && <Icon type="arrow" size={17} />}
              </button>

              <div className="wallet-info">
                <Icon type="shield" size={16} />

                <span>
                  Your payment is handled securely through the configured
                  ROZZI payment provider.
                </span>
              </div>

            </section>

            {/* WITHDRAW */}

            <section className="wallet-panel" id="withdraw-wallet">

              <div className="panel-header">
                <div>
                  <span className="panel-kicker">WITHDRAW</span>

                  <h2>Move money to your bank</h2>

                  <p>
                    Request a withdrawal from your available wallet balance.
                  </p>
                </div>

                <div className="panel-icon maroon">
                  <Icon type="bank" size={20} />
                </div>
              </div>

              <div className="wallet-form-grid">

                <label className="wallet-label full">
                  Amount

                  <div className="amount-input">
                    <span>₦</span>

                    <input
                      value={withdrawAmount}
                      onChange={(e) =>
                        setWithdrawAmount(
                          e.target.value.replace(/[^\d.]/g, '')
                        )
                      }
                      placeholder="10,000"
                      inputMode="decimal"
                    />

                    <small>NGN</small>
                  </div>
                </label>

                <label className="wallet-label">
                  Bank name

                  <input
                    className="wallet-input"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. Access Bank"
                  />
                </label>

                <label className="wallet-label">
                  Account name

                  <input
                    className="wallet-input"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Name on bank account"
                  />
                </label>

                <label className="wallet-label full">
                  Account number

                  <input
                    className="wallet-input"
                    value={accountNumber}
                    onChange={(e) =>
                      setAccountNumber(
                        e.target.value.replace(/\D/g, '').slice(0, 10)
                      )
                    }
                    placeholder="10-digit account number"
                    inputMode="numeric"
                  />
                </label>

              </div>

              <button
                className="wallet-action-button dark-button"
                onClick={withdraw}
                disabled={busy}
              >
                {busy ? 'Submitting withdrawal...' : 'Request withdrawal'}

                {!busy && <Icon type="withdraw" size={17} />}
              </button>

              <div className="wallet-info neutral">
                <Icon type="clock" size={16} />

                <span>
                  Withdrawal requests are recorded and processed according
                  to your wallet status.
                </span>
              </div>

            </section>

            {/* TRANSACTIONS */}

            <section className="wallet-panel" id="transactions">

              <div className="panel-header">
                <div>
                  <span className="panel-kicker">ACTIVITY</span>

                  <h2>Recent transactions</h2>

                  <p>
                    Your latest ROZZI wallet activity.
                  </p>
                </div>

                <div className="panel-icon green">
                  <Icon type="history" size={20} />
                </div>
              </div>

              {wallet?.transactions?.length ? (

                <div className="transactions">

                  {wallet.transactions.map((transaction: any) => {

                    const amountValue = Number(transaction.amount || 0);

                    const credit = isCredit(
                      transaction.type,
                      amountValue
                    );

                    return (
                      <div
                        className="transaction"
                        key={transaction.id}
                      >

                        <div
                          className={
                            credit
                              ? 'transaction-icon credit'
                              : 'transaction-icon debit'
                          }
                        >
                          <Icon
                            type={credit ? 'plus' : 'withdraw'}
                            size={17}
                          />
                        </div>

                        <div className="transaction-details">

                          <strong>
                            {transactionType(transaction.type)}
                          </strong>

                          <span>
                            {transaction.description ||
                              transaction.reference ||
                              'ROZZI Wallet transaction'}
                          </span>

                        </div>

                        <div className="transaction-amount">

                          <strong
                            className={
                              credit
                                ? 'credit-amount'
                                : 'debit-amount'
                            }
                          >
                            {credit ? '+' : '−'}
                            {money(Math.abs(amountValue))}
                          </strong>

                          <span>
                            {transaction.createdAt
                              ? new Date(
                                  transaction.createdAt
                                ).toLocaleDateString('en-NG', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </span>

                        </div>

                        <span
                          className={`transaction-status ${transactionStatus(
                            transaction.status
                          )}`}
                        >
                          {String(
                            transaction.status || 'recorded'
                          ).toLowerCase()}
                        </span>

                      </div>
                    );
                  })}

                </div>

              ) : (

                <div className="wallet-empty">

                  <div className="empty-icon">
                    <Icon type="history" size={24} />
                  </div>

                  <h3>No transactions yet</h3>

                  <p>
                    Your ROZZI wallet activity will appear here after
                    your first wallet transaction.
                  </p>

                  <button
                    onClick={() => scrollToSection('fund-wallet')}
                  >
                    Add money
                  </button>

                </div>

              )}

            </section>

          </div>

          {/* SIDEBAR */}

          <aside className="wallet-sidebar">

            <section className="wallet-side-card">

              <div className="side-heading">

                <div className="side-icon">
                  <Icon type="wallet" size={19} />
                </div>

                <div>
                  <h3>How your wallet works</h3>
                  <p>Simple and connected to ROZZI.</p>
                </div>

              </div>

              <div className="wallet-steps">

                <div className="wallet-step">
                  <span>01</span>

                  <div>
                    <strong>Fund</strong>
                    <p>
                      Add money using the available payment method.
                    </p>
                  </div>
                </div>

                <div className="wallet-step">
                  <span>02</span>

                  <div>
                    <strong>Use</strong>
                    <p>
                      Use your wallet for eligible ROZZI payments.
                    </p>
                  </div>
                </div>

                <div className="wallet-step">
                  <span>03</span>

                  <div>
                    <strong>Track</strong>
                    <p>
                      Monitor your wallet activity and withdrawals.
                    </p>
                  </div>
                </div>

              </div>

            </section>

            <section className="wallet-security">

              <div className="security-icon">
                <Icon type="shield" size={22} />
              </div>

              <h3>Security first</h3>

              <p>
                Your wallet is connected to your authenticated ROZZI
                account. Never share your password or verification codes.
              </p>

              <Link href="/support">
                Need help? Contact support →
              </Link>

            </section>

            {wallet?.withdrawals?.length > 0 && (

              <section className="wallet-side-card">

                <div className="side-heading">

                  <div className="side-icon">
                    <Icon type="bank" size={19} />
                  </div>

                  <div>
                    <h3>Withdrawal requests</h3>
                    <p>Your latest requests.</p>
                  </div>

                </div>

                <div className="withdrawal-list">

                  {wallet.withdrawals
                    .slice(0, 4)
                    .map((withdrawal: any) => (

                      <div
                        className="withdrawal-item"
                        key={withdrawal.id}
                      >

                        <div>
                          <strong>
                            {money(withdrawal.amount)}
                          </strong>

                          <span>
                            {withdrawal.accountNumberLast4
                              ? `•••• ${withdrawal.accountNumberLast4}`
                              : 'Bank withdrawal'}
                          </span>
                        </div>

                        <small
                          className={`transaction-status ${transactionStatus(
                            withdrawal.status
                          )}`}
                        >
                          {String(
                            withdrawal.status || ''
                          ).toLowerCase()}
                        </small>

                      </div>

                    ))}

                </div>

              </section>

            )}

          </aside>

        </div>

        {/* FOOTER */}

        <footer className="wallet-footer">
          <span>© {new Date().getFullYear()} ROZZI</span>

          <span>
            Your marketplace. Your wallet. Your convenience.
          </span>

          <Link href="/support">Help & Support</Link>
        </footer>

      </div>
    </main>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <main className="wallet-page">
          <div className="wallet-loading">
            <div className="loading-logo">
              <img src="/rozzi-logo.png" alt="ROZZI" />
            </div>

            <div className="spinner" />

            <strong>Loading your ROZZI Wallet</strong>
          </div>
        </main>
      }
    >
      <WalletContent />
    </Suspense>
  );
}

const styles = `

.wallet-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at 90% 0%, rgba(244,119,33,.09), transparent 28%),
    #fcfbf8;
  color: #171717;
}

/* HEADER */

.wallet-header {
  position: sticky;
  top: 0;
  z-index: 50;
  background: rgba(255,255,255,.94);
  backdrop-filter: blur(18px);
  border-bottom: 1px solid #eee8df;
}

.wallet-header-inner {
  width: min(1180px, calc(100% - 40px));
  height: 74px;
  margin: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 25px;
}

.wallet-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #4d1716;
  text-decoration: none;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -.04em;
}

.wallet-brand img {
  width: 42px;
  height: 42px;
  object-fit: contain;
}

.wallet-nav {
  display: flex;
  align-items: center;
  gap: 30px;
}

.wallet-nav a {
  color: #777;
  font-size: 12px;
  font-weight: 800;
  text-decoration: none;
  position: relative;
}

.wallet-nav a:hover {
  color: #e85d0d;
}

.wallet-nav a.active {
  color: #4d1716;
}

.wallet-nav a.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -29px;
  height: 3px;
  border-radius: 99px;
  background: #f47721;
}

.wallet-account {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #302522;
  text-decoration: none;
  font-size: 11px;
  font-weight: 800;
}

.account-avatar {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: #4d1716;
  color: #fff;
}

/* CONTAINER */

.wallet-container {
  width: min(1180px, calc(100% - 40px));
  margin: auto;
  padding: 24px 0 45px;
}

.wallet-breadcrumb {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #a19891;
  font-size: 11px;
  font-weight: 700;
}

.wallet-breadcrumb a {
  color: #70645d;
  text-decoration: none;
}

.wallet-breadcrumb strong {
  color: #4d1716;
}

/* INTRO */

.wallet-intro {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 25px;
  padding: 30px 0 24px;
}

.wallet-kicker,
.panel-kicker {
  display: block;
  color: #e85d0d;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .15em;
}

.wallet-intro h1 {
  margin: 9px 0 13px;
  color: #4d1716;
  font-size: clamp(34px, 5vw, 52px);
  line-height: 1;
  letter-spacing: -.055em;
}

.wallet-intro h1 span {
  color: #f47721;
}

.wallet-intro p {
  max-width: 620px;
  margin: 0;
  color: #7c746e;
  font-size: 13px;
  line-height: 1.7;
}

.secure-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border-radius: 99px;
  background: #edf7ee;
  border: 1px solid #d9ebdb;
  color: #39713e;
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

/* ALERTS */

.wallet-alert {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  margin-bottom: 16px;
  padding: 13px;
  border-radius: 14px;
  border: 1px solid;
}

.wallet-alert .alert-icon {
  width: 32px;
  height: 32px;
  flex: 0 0 32px;
  display: grid;
  place-items: center;
  border-radius: 10px;
}

.wallet-alert > div:nth-child(2) {
  display: grid;
  gap: 3px;
  flex: 1;
}

.wallet-alert strong {
  font-size: 11px;
}

.wallet-alert span {
  font-size: 11px;
  line-height: 1.5;
}

.wallet-alert button {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 20px;
  cursor: pointer;
}

.error-alert {
  color: #92342d;
  background: #fff2ef;
  border-color: #efcdc7;
}

.error-alert .alert-icon {
  background: #ffe0da;
}

.success-alert {
  color: #39713e;
  background: #f1f8f0;
  border-color: #d6e9d5;
}

.success-alert .alert-icon {
  background: #dcefd9;
}

/* BALANCE */

.wallet-balance-card {
  min-height: 310px;
  position: relative;
  overflow: hidden;
  padding: 32px;
  border-radius: 28px;
  color: #fff;
  background:
    radial-gradient(circle at 90% 15%, rgba(255,189,24,.32), transparent 22%),
    linear-gradient(125deg, #35100f, #541716 54%, #8e301b);
  box-shadow: 0 25px 65px rgba(77,23,22,.18);
}

.balance-decoration {
  position: absolute;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,.1);
}

.balance-decoration.one {
  width: 390px;
  height: 390px;
  right: -140px;
  top: -240px;
}

.balance-decoration.two {
  width: 280px;
  height: 280px;
  right: -70px;
  bottom: -210px;
  background: rgba(255,189,24,.06);
}

.balance-card-top {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
}

.balance-wallet-icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  background: rgba(255,255,255,.12);
  border: 1px solid rgba(255,255,255,.1);
}

.balance-card-top > div:nth-child(2) {
  display: grid;
  gap: 3px;
}

.balance-card-top span {
  font-size: 11px;
  opacity: .75;
}

.balance-card-top strong {
  font-size: 13px;
}

.currency {
  margin-left: auto;
  padding: 7px 10px;
  border-radius: 99px;
  background: rgba(255,255,255,.1);
  font-size: 9px !important;
  font-weight: 900;
  letter-spacing: .08em;
  opacity: 1 !important;
}

.balance-value {
  position: relative;
  margin-top: 29px;
  font-size: clamp(42px, 7vw, 64px);
  font-weight: 900;
  line-height: 1;
  letter-spacing: -.06em;
}

.balance-description {
  position: relative;
  margin: 9px 0 0;
  color: rgba(255,255,255,.67);
  font-size: 10px;
}

.balance-actions {
  position: relative;
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
  margin-top: 29px;
}

.balance-actions button {
  min-height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 0 15px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  transition: .2s;
}

.balance-actions button:hover {
  transform: translateY(-2px);
}

.balance-primary {
  border: 0;
  background: #fff;
  color: #4d1716;
}

.balance-secondary {
  border: 1px solid rgba(255,255,255,.18);
  background: rgba(255,255,255,.09);
  color: #fff;
}

/* STATS */

.wallet-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 13px;
  margin: 14px 0;
}

.wallet-stat {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 16px;
  border: 1px solid #eee8df;
  border-radius: 17px;
  background: #fff;
  box-shadow: 0 7px 25px rgba(42,31,21,.035);
}

.stat-icon {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  border-radius: 12px;
}

.stat-icon.orange {
  color: #c55b19;
  background: #fff0e2;
}

.stat-icon.green {
  color: #39713e;
  background: #eaf6eb;
}

.stat-icon.gold {
  color: #a66c12;
  background: #fff5d8;
}

.wallet-stat > div:last-child {
  display: grid;
  gap: 2px;
}

.wallet-stat strong {
  font-size: 15px;
}

.wallet-stat span {
  color: #918780;
  font-size: 9px;
  font-weight: 700;
}

/* GRID */

.wallet-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(285px, .75fr);
  gap: 17px;
  align-items: start;
}

.wallet-main,
.wallet-sidebar {
  display: grid;
  gap: 17px;
}

.wallet-panel,
.wallet-side-card {
  background: #fff;
  border: 1px solid #eee8df;
  border-radius: 21px;
  box-shadow: 0 7px 25px rgba(42,31,21,.035);
}

.wallet-panel {
  padding: 24px;
  scroll-margin-top: 95px;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 21px;
}

.panel-header h2 {
  margin: 6px 0 4px;
  color: #30231e;
  font-size: 20px;
  letter-spacing: -.03em;
}

.panel-header p {
  margin: 0;
  color: #93877f;
  font-size: 10px;
  line-height: 1.5;
}

.panel-icon {
  width: 43px;
  height: 43px;
  flex: 0 0 43px;
  display: grid;
  place-items: center;
  border-radius: 13px;
}

.panel-icon.orange {
  color: #c15c1b;
  background: #fff0e4;
}

.panel-icon.maroon {
  color: #701c24;
  background: #f8e9e9;
}

.panel-icon.green {
  color: #39713e;
  background: #eaf6eb;
}

/* QUICK AMOUNTS */

.quick-amounts {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 9px;
  margin-bottom: 17px;
}

.quick-amount {
  height: 42px;
  border: 1px solid #e6ddd4;
  border-radius: 11px;
  background: #fcfbf9;
  color: #655950;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}

.quick-amount:hover,
.quick-amount.selected {
  color: #a64c16;
  border-color: #efb68c;
  background: #fff0e3;
}

/* FORMS */

.wallet-label {
  display: grid;
  gap: 7px;
  margin-bottom: 15px;
  color: #40332c;
  font-size: 10px;
  font-weight: 900;
}

.wallet-form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 14px;
}

.wallet-label.full {
  grid-column: 1 / -1;
}

.amount-input {
  height: 52px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 13px;
  border: 1px solid #ded5cc;
  border-radius: 13px;
  background: #fff;
}

.amount-input:focus-within {
  border-color: #efa76c;
  box-shadow: 0 0 0 4px rgba(244,119,33,.08);
}

.amount-input > span {
  color: #6d1a20;
  font-size: 17px;
  font-weight: 900;
}

.amount-input input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #211914;
  font-size: 15px;
  font-weight: 800;
}

.amount-input small {
  color: #a19790;
  font-size: 9px;
  font-weight: 900;
}

.wallet-input {
  width: 100%;
  height: 52px;
  padding: 0 13px;
  border: 1px solid #ded5cc;
  border-radius: 13px;
  outline: 0;
  background: #fff;
  color: #211914;
  font-size: 11px;
}

.wallet-input:focus {
  border-color: #efa76c;
  box-shadow: 0 0 0 4px rgba(244,119,33,.08);
}

.wallet-input::placeholder {
  color: #b1a59d;
}

/* BUTTONS */

.wallet-action-button {
  width: 100%;
  min-height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 0;
  border-radius: 13px;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
  transition: .2s;
}

.wallet-action-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.wallet-action-button:disabled {
  opacity: .55;
  cursor: wait;
}

.orange-button {
  background: #f47721;
  box-shadow: 0 9px 22px rgba(244,119,33,.18);
}

.dark-button {
  background: #4d1716;
}

/* INFO */

.wallet-info {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 12px;
  padding: 11px 12px;
  border-radius: 11px;
  color: #55705a;
  background: #f1f7f0;
  font-size: 9px;
  line-height: 1.5;
}

.wallet-info.neutral {
  color: #766c65;
  background: #f6f4f1;
}

/* TRANSACTIONS */

.transactions {
  border-top: 1px solid #f0e9e2;
}

.transaction {
  display: grid;
  grid-template-columns: 41px minmax(0,1fr) auto auto;
  align-items: center;
  gap: 11px;
  padding: 13px 0;
  border-bottom: 1px solid #f0e9e2;
}

.transaction-icon {
  width: 39px;
  height: 39px;
  display: grid;
  place-items: center;
  border-radius: 12px;
}

.transaction-icon.credit {
  color: #39713e;
  background: #eaf6eb;
}

.transaction-icon.debit {
  color: #963a31;
  background: #fbeae7;
}

.transaction-details {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.transaction-details strong {
  color: #352821;
  font-size: 11px;
}

.transaction-details span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #9a8e86;
  font-size: 9px;
}

.transaction-amount {
  display: grid;
  gap: 3px;
  text-align: right;
}

.transaction-amount strong {
  font-size: 11px;
}

.transaction-amount span {
  color: #9b9089;
  font-size: 9px;
}

.credit-amount {
  color: #39713e;
}

.debit-amount {
  color: #963a31;
}

.transaction-status {
  padding: 5px 8px;
  border-radius: 99px;
  font-size: 8px;
  font-weight: 900;
  text-transform: capitalize;
}

.transaction-status.success {
  color: #39713e;
  background: #e9f5e9;
}

.transaction-status.pending {
  color: #91661e;
  background: #fff3d8;
}

.transaction-status.failed {
  color: #92372f;
  background: #fbe9e6;
}

.transaction-status.neutral {
  color: #71665e;
  background: #f0eeeb;
}

/* EMPTY */

.wallet-empty {
  display: grid;
  justify-items: center;
  text-align: center;
  padding: 42px 20px 34px;
}

.empty-icon {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: #b45a1d;
  background: #fff0e2;
}

.wallet-empty h3 {
  margin: 13px 0 5px;
  color: #30231e;
  font-size: 15px;
}

.wallet-empty p {
  max-width: 400px;
  margin: 0;
  color: #958a82;
  font-size: 10px;
  line-height: 1.6;
}

.wallet-empty button {
  margin-top: 14px;
  padding: 9px 14px;
  border: 0;
  border-radius: 10px;
  background: #4d1716;
  color: #fff;
  font-size: 10px;
  font-weight: 900;
  cursor: pointer;
}

/* SIDEBAR */

.wallet-side-card {
  padding: 20px;
}

.side-heading {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.side-icon {
  width: 40px;
  height: 40px;
  flex: 0 0 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: #701c24;
  background: #f8e9e9;
}

.side-heading h3 {
  margin: 2px 0 4px;
  color: #352821;
  font-size: 14px;
}

.side-heading p {
  margin: 0;
  color: #9a8d85;
  font-size: 9px;
}

.wallet-steps {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.wallet-step {
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 10px;
}

.wallet-step > span {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 9px;
  color: #ad551b;
  background: #fff0e3;
  font-size: 8px;
  font-weight: 900;
}

.wallet-step strong {
  color: #352821;
  font-size: 11px;
}

.wallet-step p {
  margin: 3px 0 0;
  color: #968a82;
  font-size: 9px;
  line-height: 1.5;
}

/* SECURITY */

.wallet-security {
  padding: 21px;
  border-radius: 21px;
  color: #fff;
  background: linear-gradient(145deg, #681c20, #441113);
}

.security-icon {
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  margin-bottom: 14px;
  border-radius: 13px;
  background: rgba(255,255,255,.1);
}

.wallet-security h3 {
  margin: 0 0 7px;
  font-size: 15px;
}

.wallet-security p {
  margin: 0;
  color: rgba(255,255,255,.7);
  font-size: 10px;
  line-height: 1.65;
}

.wallet-security a {
  display: inline-block;
  margin-top: 14px;
  color: #ffd09d;
  text-decoration: none;
  font-size: 9px;
  font-weight: 900;
}

/* WITHDRAWAL LIST */

.withdrawal-list {
  margin-top: 15px;
  border-top: 1px solid #f0e9e2;
}

.withdrawal-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 11px 0;
  border-bottom: 1px solid #f0e9e2;
}

.withdrawal-item > div {
  display: grid;
  gap: 3px;
}

.withdrawal-item strong {
  font-size: 11px;
}

.withdrawal-item span {
  color: #978b83;
  font-size: 8px;
}

/* FOOTER */

.wallet-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
  margin-top: 31px;
  padding-top: 17px;
  border-top: 1px solid #e9e1d9;
  color: #9b8f87;
  font-size: 9px;
  font-weight: 700;
}

.wallet-footer a {
  color: #c25b19;
  text-decoration: none;
}

/* LOADING */

.wallet-loading {
  min-height: 100vh;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
  color: #887c74;
}

.loading-logo {
  width: 62px;
  height: 62px;
  display: grid;
  place-items: center;
  border-radius: 18px;
  background: #fff;
  border: 1px solid #eee8df;
  box-shadow: 0 12px 35px rgba(42,31,21,.07);
}

.loading-logo img {
  width: 45px;
  height: 45px;
  object-fit: contain;
}

.wallet-loading strong {
  color: #4d1716;
  font-size: 14px;
}

.wallet-loading > span {
  font-size: 10px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #f3dfd0;
  border-top-color: #f47721;
  border-radius: 50%;
  animation: wallet-spin .8s linear infinite;
}

@keyframes wallet-spin {
  to {
    transform: rotate(360deg);
  }
}

/* TABLET */

@media (max-width: 900px) {
  .wallet-grid {
    grid-template-columns: 1fr;
  }
}

/* MOBILE */

@media (max-width: 680px) {

  .wallet-header-inner,
  .wallet-container {
    width: calc(100% - 24px);
  }

  .wallet-header-inner {
    height: 64px;
  }

  .wallet-nav {
    display: none;
  }

  .wallet-account span:last-child {
    display: none;
  }

  .wallet-brand span {
    font-size: 19px;
  }

  .wallet-brand img {
    width: 38px;
    height: 38px;
  }

  .wallet-intro {
    align-items: flex-start;
    flex-direction: column;
    padding-top: 24px;
  }

  .wallet-intro h1 {
    font-size: 37px;
  }

  .secure-badge {
    align-self: flex-start;
  }

  .wallet-balance-card {
    min-height: 285px;
    padding: 23px;
    border-radius: 22px;
  }

  .balance-value {
    font-size: 44px;
  }

  .balance-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .balance-actions button {
    width: 100%;
  }

  .balance-actions button:last-child {
    grid-column: 1 / -1;
  }

  .wallet-stats {
    grid-template-columns: 1fr;
  }

  .wallet-panel {
    padding: 18px;
    border-radius: 18px;
  }

  .quick-amounts {
    grid-template-columns: repeat(2, 1fr);
  }

  .wallet-form-grid {
    grid-template-columns: 1fr;
  }

  .wallet-label.full {
    grid-column: auto;
  }

  .transaction {
    grid-template-columns: 40px minmax(0,1fr) auto;
  }

  .transaction-amount {
    display: none;
  }

  .transaction-status {
    grid-column: 2 / -1;
    justify-self: start;
    margin-top: -4px;
  }

  .wallet-footer {
    flex-wrap: wrap;
  }
}

@media (max-width: 430px) {

  .wallet-brand span {
    display: none;
  }

  .wallet-container {
    padding-top: 17px;
  }

  .wallet-intro h1 {
    font-size: 32px;
  }

  .balance-value {
    font-size: 40px;
  }

  .balance-actions {
    grid-template-columns: 1fr;
  }

  .balance-actions button:last-child {
    grid-column: auto;
  }

  .wallet-footer {
    display: grid;
  }
}

`;