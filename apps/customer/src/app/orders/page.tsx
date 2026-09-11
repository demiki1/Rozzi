'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { onOrderStatus } from '../../lib/realtime';

type Order = {
  id: string;
  orderNumber?: string;
  status?: string;
  deliveryType?: string;
  totalAmount?: number;
  createdAt?: string;
  updatedAt?: string;
  items?: any[];
};

const money = (amount = 0) =>
  `₦${(Number(amount) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function formatStatus(status = '') {
  return status
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusKey(status = '') {
  return status.toUpperCase().replaceAll(' ', '_').replaceAll('-', '_');
}

function getStatusTone(status = '') {
  const key = statusKey(status);

  if (
    key.includes('DELIVERED') ||
    key.includes('COMPLETED')
  ) {
    return 'success';
  }

  if (
    key.includes('CANCEL') ||
    key.includes('FAILED') ||
    key.includes('REJECT')
  ) {
    return 'danger';
  }

  if (
    key.includes('PICKED') ||
    key.includes('OUT_FOR_DELIVERY') ||
    key.includes('ON_THE_WAY')
  ) {
    return 'orange';
  }

  return 'maroon';
}

function getStatusProgress(status = '') {
  const key = statusKey(status);

  if (
    key.includes('CANCEL') ||
    key.includes('FAILED') ||
    key.includes('REJECT')
  ) {
    return -1;
  }

  if (key.includes('DELIVERED') || key.includes('COMPLETED')) {
    return 4;
  }

  if (
    key.includes('OUT_FOR_DELIVERY') ||
    key.includes('ON_THE_WAY') ||
    key.includes('PICKED')
  ) {
    return 3;
  }

  if (
    key.includes('READY') ||
    key.includes('PREPARED')
  ) {
    return 2;
  }

  if (
    key.includes('PREPAR') ||
    key.includes('CONFIRM') ||
    key.includes('ACCEPT') ||
    key.includes('PROCESS')
  ) {
    return 1;
  }

  return 0;
}

function OrderIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h12v18H6z" />
      <path d="M9 7h6" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="m4 7.5 8 4.5 8-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 11a8.1 8.1 0 0 0-15.5-2" />
      <path d="M4 5v4h4" />
      <path d="M4 13a8.1 8.1 0 0 0 15.5 2" />
      <path d="M20 19v-4h-4" />
    </svg>
  );
}

export default function Orders() {
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>(
    'all',
  );

  async function load(showRefresh = false) {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError('');

      const result = await api('/api/orders/mine');

      setItems(Array.isArray(result) ? result : []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load your orders.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const off = onOrderStatus(() => {
      void load(true);
    });

    return off;
  }, []);

  const activeOrders = useMemo(
    () =>
      items.filter((order) => {
        const key = statusKey(order.status);

        return !(
          key.includes('DELIVERED') ||
          key.includes('COMPLETED') ||
          key.includes('CANCEL') ||
          key.includes('FAILED') ||
          key.includes('REJECT')
        );
      }),
    [items],
  );

  const completedOrders = useMemo(
    () =>
      items.filter((order) => {
        const key = statusKey(order.status);

        return (
          key.includes('DELIVERED') ||
          key.includes('COMPLETED') ||
          key.includes('CANCEL') ||
          key.includes('FAILED') ||
          key.includes('REJECT')
        );
      }),
    [items],
  );

  const visibleOrders =
    filter === 'active'
      ? activeOrders
      : filter === 'completed'
        ? completedOrders
        : items;

  return (
    <>
      <main className="rozzi-orders-page">
        <style jsx>{`
          .rozzi-orders-page {
            min-height: 100vh;
            background:
              radial-gradient(
                circle at 92% 0%,
                rgba(244, 119, 33, 0.08),
                transparent 28%
              ),
              #fffaf0;
            color: #171717;
          }

          .header {
            position: sticky;
            top: 0;
            z-index: 20;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(14px);
            border-bottom: 1px solid #eee8df;
          }

          .header-inner {
            max-width: 1180px;
            margin: 0 auto;
            min-height: 74px;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }

          .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            color: #4d1716;
            text-decoration: none;
            font-size: 25px;
            font-weight: 950;
            letter-spacing: -0.8px;
          }

          .logo {
            width: 42px;
            height: 42px;
            object-fit: contain;
            border-radius: 12px;
          }

          .nav {
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .nav-link {
            min-height: 42px;
            padding: 0 14px;
            display: inline-flex;
            align-items: center;
            border-radius: 12px;
            color: #4d4741;
            text-decoration: none;
            font-size: 14px;
            font-weight: 750;
          }

          .nav-link:hover {
            background: #f8f3eb;
            color: #4d1716;
          }

          .nav-active {
            background: #fff1e5;
            color: #e85d0d;
          }

          .page {
            max-width: 1180px;
            margin: 0 auto;
            padding: 34px 24px 70px;
          }

          .breadcrumb {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 22px;
            color: #77716b;
            font-size: 13px;
          }

          .breadcrumb a {
            color: #77716b;
            text-decoration: none;
          }

          .breadcrumb a:hover {
            color: #4d1716;
          }

          .hero {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 24px;
            margin-bottom: 28px;
          }

          .eyebrow {
            margin: 0 0 8px;
            color: #f47721;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            color: #4d1716;
            font-size: clamp(34px, 4vw, 48px);
            line-height: 1;
            letter-spacing: -1.8px;
          }

          .intro {
            max-width: 590px;
            margin: 10px 0 0;
            color: #6f747d;
            font-size: 15px;
            line-height: 1.65;
          }

          .refresh {
            min-height: 42px;
            padding: 0 14px;
            border: 1px solid #ded6cc;
            border-radius: 12px;
            background: #fff;
            color: #4d1716;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 800;
          }

          .refresh:hover {
            background: #fff7ee;
          }

          .stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-bottom: 24px;
          }

          .stat {
            padding: 19px 20px;
            border: 1px solid #eee8df;
            border-radius: 17px;
            background: #fff;
            box-shadow: 0 10px 28px rgba(48, 30, 15, 0.045);
          }

          .stat-label {
            color: #817a72;
            font-size: 12px;
            font-weight: 750;
          }

          .stat-value {
            margin-top: 6px;
            color: #4d1716;
            font-size: 25px;
            font-weight: 950;
          }

          .tabs {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 5px;
            margin-bottom: 15px;
            width: fit-content;
            border: 1px solid #eee8df;
            border-radius: 14px;
            background: #fff;
          }

          .tab {
            border: 0;
            min-height: 38px;
            padding: 0 15px;
            border-radius: 10px;
            background: transparent;
            color: #77716b;
            cursor: pointer;
            font-size: 13px;
            font-weight: 800;
          }

          .tab.active {
            background: #4d1716;
            color: #fff;
          }

          .orders {
            display: grid;
            gap: 14px;
          }

          .order-card {
            display: block;
            padding: 21px 22px;
            border: 1px solid #eee8df;
            border-radius: 19px;
            background: #fff;
            color: inherit;
            text-decoration: none;
            box-shadow: 0 12px 32px rgba(48, 30, 15, 0.055);
            transition:
              transform 0.18s ease,
              box-shadow 0.18s ease,
              border-color 0.18s ease;
          }

          .order-card:hover {
            transform: translateY(-2px);
            border-color: #e5d7ca;
            box-shadow: 0 17px 38px rgba(48, 30, 15, 0.09);
          }

          .order-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 18px;
          }

          .order-id {
            display: flex;
            align-items: center;
            gap: 11px;
          }

          .order-icon {
            width: 43px;
            height: 43px;
            border-radius: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fff1e5;
            color: #e85d0d;
          }

          .order-number {
            color: #2b2521;
            font-size: 15px;
            font-weight: 900;
          }

          .date {
            margin-top: 4px;
            color: #8a837b;
            font-size: 12px;
          }

          .badge {
            display: inline-flex;
            align-items: center;
            min-height: 30px;
            padding: 0 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 900;
          }

          .badge-maroon {
            background: #f7e9e7;
            color: #7a2925;
          }

          .badge-orange {
            background: #fff0e4;
            color: #c95512;
          }

          .badge-success {
            background: #eaf7ef;
            color: #247344;
          }

          .badge-danger {
            background: #fff0ef;
            color: #b63b30;
          }

          .order-middle {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            margin-top: 18px;
            padding-top: 17px;
            border-top: 1px solid #f0ebe4;
          }

          .meta {
            display: flex;
            align-items: center;
            gap: 7px;
            color: #77716b;
            font-size: 12px;
            font-weight: 700;
          }

          .total {
            color: #4d1716;
            font-size: 18px;
            font-weight: 950;
          }

          .order-bottom {
            margin-top: 17px;
          }

          .progress {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
          }

          .progress-line {
            height: 4px;
            border-radius: 999px;
            background: #eee9e3;
          }

          .progress-line.done {
            background: #f47721;
          }

          .progress-labels {
            display: flex;
            justify-content: space-between;
            gap: 5px;
            margin-top: 7px;
            color: #9a9289;
            font-size: 9px;
            font-weight: 750;
          }

          .view {
            margin-top: 16px;
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 4px;
            color: #4d1716;
            font-size: 12px;
            font-weight: 900;
          }

          .alert {
            margin-bottom: 20px;
            padding: 14px 16px;
            border: 1px solid #f1c7c2;
            border-radius: 14px;
            background: #fff4f2;
            color: #a92f22;
            font-size: 13px;
            font-weight: 700;
          }

          .empty {
            padding: 75px 25px;
            border: 1px solid #eee8df;
            border-radius: 22px;
            background: #fff;
            text-align: center;
            box-shadow: 0 15px 38px rgba(48, 30, 15, 0.055);
          }

          .empty-icon {
            width: 78px;
            height: 78px;
            margin: 0 auto 19px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 25px;
            background: #fff1e5;
            color: #f47721;
          }

          .empty h2 {
            margin: 0;
            color: #4d1716;
            font-size: 22px;
          }

          .empty p {
            max-width: 450px;
            margin: 9px auto 22px;
            color: #77716b;
            font-size: 14px;
            line-height: 1.6;
          }

          .shop {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 45px;
            padding: 0 20px;
            border-radius: 12px;
            background: #4d1716;
            color: #fff;
            text-decoration: none;
            font-size: 13px;
            font-weight: 850;
          }

          .skeleton {
            height: 145px;
            border-radius: 19px;
            background: linear-gradient(
              90deg,
              #f3efe9,
              #faf8f5,
              #f3efe9
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }

          @keyframes shimmer {
            0% {
              background-position: 200% 0;
            }

            100% {
              background-position: -200% 0;
            }
          }

          @media (max-width: 700px) {
            .header-inner {
              min-height: 64px;
              padding: 0 15px;
            }

            .logo {
              width: 36px;
              height: 36px;
            }

            .brand {
              font-size: 21px;
            }

            .nav-link {
              display: none;
            }

            .page {
              padding: 24px 14px 50px;
            }

            .hero {
              align-items: flex-start;
              flex-direction: column;
            }

            h1 {
              font-size: 36px;
            }

            .refresh {
              width: 100%;
              justify-content: center;
            }

            .stats {
              grid-template-columns: 1fr;
            }

            .tabs {
              width: 100%;
            }

            .tab {
              flex: 1;
              padding: 0 8px;
            }

            .order-card {
              padding: 17px;
              border-radius: 17px;
            }

            .order-top {
              align-items: flex-start;
            }

            .order-middle {
              align-items: flex-start;
              flex-direction: column;
              gap: 10px;
            }

            .total {
              font-size: 16px;
            }

            .progress-labels {
              font-size: 8px;
            }
          }
        `}</style>

        <header className="header">
          <div className="header-inner">
            <Link href="/" className="brand">
              <img
                src="/rozzi-logo.png"
                alt="ROZZI"
                className="logo"
              />
              ROZZI
            </Link>

            <nav className="nav">
              <Link href="/" className="nav-link">
                Shop
              </Link>

              <Link href="/orders" className="nav-link nav-active">
                Orders
              </Link>

              <Link href="/notifications" className="nav-link">
                Notifications
              </Link>

              <Link href="/cart" className="nav-link">
                Cart
              </Link>

              <Link href="/account" className="nav-link">
                My account
              </Link>
            </nav>
          </div>
        </header>

        <div className="page">
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight />
            <span>Orders</span>
          </div>

          <section className="hero">
            <div>
              <p className="eyebrow">ROZZI customer centre</p>
              <h1>My orders</h1>
              <p className="intro">
                Keep track of your ROZZI purchases, follow active
                deliveries and review your previous orders.
              </p>
            </div>

            <button
              type="button"
              className="refresh"
              onClick={() => load(true)}
              disabled={refreshing}
            >
              <RefreshIcon />
              {refreshing ? 'Refreshing…' : 'Refresh orders'}
            </button>
          </section>

          {error && (
            <div className="alert">
              {error}
            </div>
          )}

          <section className="stats">
            <div className="stat">
              <div className="stat-label">Total orders</div>
              <div className="stat-value">{items.length}</div>
            </div>

            <div className="stat">
              <div className="stat-label">Active orders</div>
              <div className="stat-value">
                {activeOrders.length}
              </div>
            </div>

            <div className="stat">
              <div className="stat-label">Completed / past</div>
              <div className="stat-value">
                {completedOrders.length}
              </div>
            </div>
          </section>

          <div className="tabs">
            <button
              type="button"
              className={`tab ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              All
            </button>

            <button
              type="button"
              className={`tab ${filter === 'active' ? 'active' : ''}`}
              onClick={() => setFilter('active')}
            >
              Active
            </button>

            <button
              type="button"
              className={`tab ${filter === 'completed' ? 'active' : ''}`}
              onClick={() => setFilter('completed')}
            >
              Past
            </button>
          </div>

          {loading ? (
            <div className="orders">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : !visibleOrders.length ? (
            <section className="empty">
              <div className="empty-icon">
                <PackageIcon />
              </div>

              <h2>
                {filter === 'active'
                  ? 'No active orders'
                  : filter === 'completed'
                    ? 'No past orders'
                    : 'You have no orders yet'}
              </h2>

              <p>
                {filter === 'active'
                  ? 'When you place an order, you will be able to follow its progress here.'
                  : 'Start shopping on ROZZI and your orders will appear here automatically.'}
              </p>

              <Link href="/" className="shop">
                Start shopping
              </Link>
            </section>
          ) : (
            <div className="orders">
              {visibleOrders.map((order) => {
                const progress = getStatusProgress(order.status);
                const tone = getStatusTone(order.status);

                const created =
                  order.createdAt || order.updatedAt;

                return (
                  <Link
                    href={`/orders/${order.id}`}
                    className="order-card"
                    key={order.id}
                  >
                    <div className="order-top">
                      <div className="order-id">
                        <div className="order-icon">
                          <OrderIcon />
                        </div>

                        <div>
                          <div className="order-number">
                            {order.orderNumber ||
                              `Order ${order.id.slice(0, 8)}`}
                          </div>

                          {created && (
                            <div className="date">
                              {new Date(created).toLocaleString(
                                'en-NG',
                                {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                },
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        className={`badge badge-${tone}`}
                      >
                        {formatStatus(
                          order.status || 'Pending',
                        )}
                      </span>
                    </div>

                    <div className="order-middle">
                      <div className="meta">
                        <MapPinIcon />
                        {formatStatus(
                          order.deliveryType || 'Delivery',
                        )}
                      </div>

                      <div className="total">
                        {money(order.totalAmount)}
                      </div>
                    </div>

                    {progress >= 0 && (
                      <div className="order-bottom">
                        <div className="progress">
                          {[0, 1, 2, 3, 4].map((step) => (
                            <div
                              key={step}
                              className={`progress-line ${
                                step <= progress ? 'done' : ''
                              }`}
                            />
                          ))}
                        </div>

                        <div className="progress-labels">
                          <span>Placed</span>
                          <span>Preparing</span>
                          <span>Ready</span>
                          <span>On the way</span>
                          <span>Delivered</span>
                        </div>
                      </div>
                    )}

                    <div className="view">
                      View order
                      <ChevronRight />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}