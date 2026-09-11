'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../../lib/api';

type Ticket = {
  id: string;
  subject: string;
  message?: string;
  status?: string;
  createdAt?: string;
};

function formatDate(value?: string) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(status?: string) {
  return String(status || 'OPEN')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function loadTickets() {
    setError('');

    try {
      const data = await api<Ticket[]>('/api/support/tickets');
      setTickets(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load your support tickets.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTickets();
  }, []);

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();

    setError('');
    setNotice('');

    if (cleanSubject.length < 3) {
      setError('Please enter a short subject for your request.');
      return;
    }

    if (cleanMessage.length < 10) {
      setError('Please describe your issue in a little more detail.');
      return;
    }

    setSubmitting(true);

    try {
      await post('/api/support/tickets', {
        subject: cleanSubject,
        message: cleanMessage,
      });

      setSubject('');
      setMessage('');
      setNotice('Your support ticket has been opened. Our team will review it.');

      await loadTickets();
    } catch (e: any) {
      setError(e?.message || 'Unable to open your support ticket.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="support-page">
      <header className="support-header">
        <div className="support-header-inner">
          <Link href="/" className="support-brand" aria-label="ROZZI home">
            <span className="support-brand-mark">
              <img src="/rozzi-logo.png" alt="ROZZI" />
            </span>
            <span>ROZZI</span>
          </Link>

          <nav className="support-nav" aria-label="Support navigation">
            <Link href="/">Shop</Link>
            <Link href="/orders">Orders</Link>
            <Link href="/account">Account</Link>
          </nav>

          <Link href="/account" className="support-back">
            ← Account
          </Link>
        </div>
      </header>

      <div className="support-container">
        <section className="support-hero">
          <div>
            <span className="support-eyebrow">ROZZI CARE</span>
            <h1>How can we help?</h1>
            <p>
              Need help with an order, payment, delivery, account or anything
              else on ROZZI? Send us a message and our support team will take
              care of it.
            </p>
          </div>

          <div className="support-hero-badge">
            <span className="support-hero-dot" />
            ROZZI Support
          </div>
        </section>

        {error && (
          <div className="support-alert support-alert-error" role="alert">
            {error}
          </div>
        )}

        {notice && (
          <div className="support-alert support-alert-success" role="status">
            {notice}
          </div>
        )}

        <div className="support-layout">
          <section className="support-card support-form-card">
            <div className="support-card-heading">
              <div>
                <span className="support-kicker">CONTACT US</span>
                <h2>Open a support ticket</h2>
                <p>
                  Tell us what happened and we&apos;ll help you resolve it.
                </p>
              </div>
            </div>

            <form onSubmit={createTicket} className="support-form">
              <label>
                <span>Subject</span>
                <input
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g. My order has not arrived"
                  maxLength={120}
                  required
                />
              </label>

              <label>
                <span>How can we help?</span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Describe your issue, order or question..."
                  maxLength={2000}
                  rows={7}
                  required
                />
              </label>

              <button type="submit" disabled={submitting}>
                {submitting ? 'Opening ticket...' : 'Open support ticket'}
              </button>
            </form>
          </section>

          <aside className="support-card support-help-card">
            <span className="support-kicker">QUICK HELP</span>
            <h2>Before you contact us</h2>

            <div className="support-help-list">
              <div>
                <strong>Order issue?</strong>
                <span>Include your order number if you have it.</span>
              </div>

              <div>
                <strong>Payment issue?</strong>
                <span>Tell us what happened and when you made the payment.</span>
              </div>

              <div>
                <strong>Delivery issue?</strong>
                <span>Include useful details that can help our team investigate.</span>
              </div>
            </div>

            <Link href="/orders" className="support-help-link">
              View my orders <span>→</span>
            </Link>
          </aside>
        </div>

        <section className="support-tickets">
          <div className="support-section-heading">
            <div>
              <span className="support-kicker">YOUR ROZZI SUPPORT</span>
              <h2>Your tickets</h2>
            </div>

            {!loading && (
              <span className="support-count">
                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
              </span>
            )}
          </div>

          {loading ? (
            <div className="support-empty">
              <div className="support-spinner" />
              <p>Loading your support history...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="support-empty">
              <div className="support-empty-icon">?</div>
              <h3>No support tickets yet</h3>
              <p>
                When you contact ROZZI support, your conversations will appear
                here.
              </p>
            </div>
          ) : (
            <div className="support-ticket-list">
              {tickets.map((ticket) => (
                <article className="support-ticket" key={ticket.id}>
                  <div className="support-ticket-main">
                    <div className="support-ticket-title-row">
                      <h3>{ticket.subject}</h3>
                      <span
                        className={`support-status support-status-${String(
                          ticket.status || 'OPEN',
                        ).toLowerCase()}`}
                      >
                        {statusLabel(ticket.status)}
                      </span>
                    </div>

                    {ticket.message && (
                      <p className="support-ticket-message">
                        {ticket.message}
                      </p>
                    )}

                    <span className="support-ticket-date">
                      Opened {formatDate(ticket.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <style jsx>{`
        .support-page {
          min-height: 100vh;
          background: #faf8f4;
          color: #241615;
        }

        .support-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: rgba(255, 253, 249, 0.96);
          border-bottom: 1px solid #eee4da;
          backdrop-filter: blur(14px);
        }

        .support-header-inner {
          width: min(1180px, calc(100% - 40px));
          min-height: 76px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .support-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #731c2b;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: -0.6px;
          text-decoration: none;
        }

        .support-brand-mark {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 50%;
          background: #fff;
          border: 1px solid #ead8ca;
          box-shadow: 0 5px 16px rgba(70, 27, 17, 0.1);
        }

        .support-brand-mark img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .support-nav {
          display: flex;
          align-items: center;
          gap: 28px;
        }

        .support-nav a,
        .support-back {
          color: #4d3934;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .support-nav a:hover,
        .support-back:hover {
          color: #e35f1f;
        }

        .support-container {
          width: min(1080px, calc(100% - 40px));
          margin: 0 auto;
          padding: 52px 0 80px;
        }

        .support-hero {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 32px;
          margin-bottom: 30px;
          padding: 38px 42px;
          border-radius: 28px;
          background: linear-gradient(135deg, #4e1018 0%, #761f2b 52%, #a64b1b 100%);
          color: #fff;
          box-shadow: 0 20px 45px rgba(80, 27, 18, 0.14);
        }

        .support-eyebrow,
        .support-kicker {
          display: block;
          color: #e96c2a;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.5px;
          text-transform: uppercase;
        }

        .support-hero .support-eyebrow {
          color: #ffd36b;
        }

        .support-hero h1 {
          margin: 8px 0 10px;
          color: #fff;
          font-size: clamp(34px, 5vw, 54px);
          line-height: 0.98;
          letter-spacing: -2px;
        }

        .support-hero p {
          max-width: 680px;
          margin: 0;
          color: rgba(255, 255, 255, 0.84);
          font-size: 15px;
          line-height: 1.65;
        }

        .support-hero-badge {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 11px 15px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .support-hero-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #73d69b;
          box-shadow: 0 0 0 4px rgba(115, 214, 155, 0.13);
        }

        .support-alert {
          margin-bottom: 20px;
          padding: 13px 16px;
          border-radius: 13px;
          font-size: 14px;
          font-weight: 650;
        }

        .support-alert-error {
          color: #9b2431;
          background: #fff0f0;
          border: 1px solid #f2cccc;
        }

        .support-alert-success {
          color: #176a42;
          background: #edf9f2;
          border: 1px solid #c7ead7;
        }

        .support-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.55fr) minmax(280px, 0.85fr);
          gap: 22px;
          align-items: start;
        }

        .support-card {
          border: 1px solid #eadfd5;
          border-radius: 22px;
          background: #fffdfa;
          box-shadow: 0 10px 30px rgba(69, 39, 28, 0.055);
        }

        .support-form-card {
          padding: 30px;
        }

        .support-help-card {
          padding: 28px;
        }

        .support-card-heading {
          margin-bottom: 24px;
        }

        .support-card h2,
        .support-section-heading h2 {
          margin: 5px 0 7px;
          color: #281716;
          font-size: 23px;
          letter-spacing: -0.6px;
        }

        .support-card-heading p {
          margin: 0;
          color: #786861;
          font-size: 14px;
          line-height: 1.55;
        }

        .support-form {
          display: grid;
          gap: 17px;
        }

        .support-form label {
          display: grid;
          gap: 8px;
        }

        .support-form label > span {
          color: #3e2c28;
          font-size: 13px;
          font-weight: 800;
        }

        .support-form input,
        .support-form textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dfd1c7;
          border-radius: 13px;
          background: #fff;
          color: #291b18;
          padding: 13px 14px;
          font: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .support-form input {
          min-height: 48px;
        }

        .support-form textarea {
          min-height: 150px;
          resize: vertical;
          line-height: 1.55;
        }

        .support-form input:focus,
        .support-form textarea:focus {
          border-color: #e56a25;
          box-shadow: 0 0 0 3px rgba(229, 106, 37, 0.12);
        }

        .support-form button {
          min-height: 48px;
          margin-top: 2px;
          border: 0;
          border-radius: 12px;
          background: #7a1e2c;
          color: #fff;
          font: inherit;
          font-size: 14px;
          font-weight: 850;
          cursor: pointer;
          transition: transform 0.18s ease, background 0.18s ease;
        }

        .support-form button:hover:not(:disabled) {
          background: #611622;
          transform: translateY(-1px);
        }

        .support-form button:disabled {
          opacity: 0.62;
          cursor: not-allowed;
        }

        .support-help-card h2 {
          margin-top: 7px;
        }

        .support-help-list {
          display: grid;
          gap: 0;
          margin-top: 22px;
        }

        .support-help-list > div {
          display: grid;
          gap: 5px;
          padding: 16px 0;
          border-top: 1px solid #eee5dc;
        }

        .support-help-list strong {
          color: #30201c;
          font-size: 13px;
        }

        .support-help-list span {
          color: #796a63;
          font-size: 12px;
          line-height: 1.5;
        }

        .support-help-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 10px;
          padding: 13px 14px;
          border-radius: 12px;
          background: #fff2e8;
          color: #9b3e16;
          font-size: 13px;
          font-weight: 850;
          text-decoration: none;
        }

        .support-tickets {
          margin-top: 46px;
        }

        .support-section-heading {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 17px;
        }

        .support-count {
          color: #75665f;
          font-size: 12px;
          font-weight: 700;
        }

        .support-empty {
          min-height: 220px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 8px;
          padding: 30px;
          border: 1px dashed #dccfc5;
          border-radius: 20px;
          background: rgba(255, 253, 249, 0.72);
          text-align: center;
        }

        .support-empty p {
          margin: 0;
          color: #7c6d65;
          font-size: 13px;
        }

        .support-empty h3 {
          margin: 4px 0 0;
          color: #35231f;
          font-size: 17px;
        }

        .support-empty-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #fff0e6;
          color: #cf5c1f;
          font-size: 20px;
          font-weight: 900;
        }

        .support-spinner {
          width: 25px;
          height: 25px;
          border: 3px solid #eadbd0;
          border-top-color: #7a1e2c;
          border-radius: 50%;
          animation: support-spin 0.8s linear infinite;
        }

        .support-ticket-list {
          display: grid;
          gap: 12px;
        }

        .support-ticket {
          padding: 20px 22px;
          border: 1px solid #eadfd5;
          border-radius: 17px;
          background: #fffdfa;
          box-shadow: 0 7px 22px rgba(69, 39, 28, 0.04);
        }

        .support-ticket-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .support-ticket h3 {
          margin: 0;
          color: #33211e;
          font-size: 15px;
          line-height: 1.45;
        }

        .support-status {
          flex: 0 0 auto;
          padding: 5px 9px;
          border-radius: 999px;
          background: #f3eee9;
          color: #66564f;
          font-size: 10px;
          font-weight: 850;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .support-status-open,
        .support-status-pending {
          background: #fff1df;
          color: #a14e17;
        }

        .support-status-resolved,
        .support-status-closed {
          background: #eaf7ef;
          color: #277047;
        }

        .support-status-cancelled {
          background: #fceced;
          color: #9d3440;
        }

        .support-ticket-message {
          margin: 9px 0 8px;
          color: #76665e;
          font-size: 13px;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .support-ticket-date {
          color: #9a8b84;
          font-size: 11px;
        }

        @keyframes support-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .support-header-inner {
            width: min(100% - 24px, 1080px);
            min-height: 66px;
          }

          .support-nav {
            display: none;
          }

          .support-back {
            font-size: 12px;
          }

          .support-container {
            width: min(100% - 24px, 1080px);
            padding: 24px 0 60px;
          }

          .support-hero {
            display: block;
            padding: 28px 22px;
            border-radius: 22px;
          }

          .support-hero h1 {
            font-size: 36px;
            letter-spacing: -1.5px;
          }

          .support-hero p {
            font-size: 13px;
          }

          .support-hero-badge {
            margin-top: 22px;
          }

          .support-layout {
            grid-template-columns: 1fr;
          }

          .support-form-card,
          .support-help-card {
            padding: 22px;
          }

          .support-section-heading {
            align-items: center;
          }

          .support-ticket {
            padding: 17px;
          }

          .support-ticket-title-row {
            display: grid;
            gap: 9px;
          }

          .support-status {
            width: max-content;
          }
        }
      `}</style>
    </main>
  );
}
