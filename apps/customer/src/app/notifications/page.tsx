'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { onNotification } from '../../lib/realtime';

type NotificationItem = {
  id: string;
  title?: string;
  message?: string;
  createdAt?: string;
};

type NotificationCategory =
  | 'all'
  | 'orders'
  | 'wallet'
  | 'offers'
  | 'account'
  | 'general';

type IconProps = {
  size?: number;
};

type IconComponent = (props: IconProps) => React.ReactNode;

function getCategory(
  notification: NotificationItem,
): Exclude<NotificationCategory, 'all'> {
  const text = `${notification.title || ''} ${
    notification.message || ''
  }`.toLowerCase();

  if (
    text.includes('order') ||
    text.includes('delivery') ||
    text.includes('rider') ||
    text.includes('pickup')
  ) {
    return 'orders';
  }

  if (
    text.includes('wallet') ||
    text.includes('payment') ||
    text.includes('fund') ||
    text.includes('withdraw')
  ) {
    return 'wallet';
  }

  if (
    text.includes('promo') ||
    text.includes('discount') ||
    text.includes('offer') ||
    text.includes('coupon')
  ) {
    return 'offers';
  }

  if (
    text.includes('password') ||
    text.includes('account') ||
    text.includes('security') ||
    text.includes('login')
  ) {
    return 'account';
  }

  return 'general';
}

function getCategoryLabel(category: string) {
  switch (category) {
    case 'orders':
      return 'Orders';

    case 'wallet':
      return 'Wallet';

    case 'offers':
      return 'Offers';

    case 'account':
      return 'Account';

    default:
      return 'ROZZI';
  }
}

function BellIcon({ size = 22 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
      <path d="M10 21h4" />
    </svg>
  );
}

function OrderIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
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

function WalletIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 17.5v-11Z" />
      <path d="M4 7h16" />
      <path d="M16 13h2" />
    </svg>
  );
}

function OfferIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m20 13-7 7-10-10V4h6L20 13Z" />
      <circle cx="7.5" cy="7.5" r="1" />
    </svg>
  );
}

function AccountIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c.8-3.2 3.2-5 7-5s6.2 1.8 7 5" />
    </svg>
  );
}

function GeneralIcon({ size = 20 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
    </svg>
  );
}

function ChevronRight({ size = 17 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
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

function getIcon(category: string) {
  switch (category) {
    case 'orders':
      return <OrderIcon />;

    case 'wallet':
      return <WalletIcon />;

    case 'offers':
      return <OfferIcon />;

    case 'account':
      return <AccountIcon />;

    default:
      return <GeneralIcon />;
  }
}

const notificationFilters: {
  key: NotificationCategory;
  label: string;
  icon: IconComponent;
}[] = [
  {
    key: 'all',
    label: 'All',
    icon: BellIcon,
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: OrderIcon,
  },
  {
    key: 'wallet',
    label: 'Wallet',
    icon: WalletIcon,
  },
  {
    key: 'offers',
    label: 'Offers',
    icon: OfferIcon,
  },
  {
    key: 'account',
    label: 'Account',
    icon: AccountIcon,
  },
  {
    key: 'general',
    label: 'General',
    icon: GeneralIcon,
  },
];

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] =
    useState<NotificationCategory>('all');

  useEffect(() => {
    let alive = true;

    const load = async () => {
      try {
        setError('');

        const result = await api('/api/notifications/mine');

        if (alive) {
          setItems(
            Array.isArray(result)
              ? result
              : [],
          );
        }
      } catch (e: any) {
        if (alive) {
          setError(
            e?.message ||
              'Unable to load your notifications.',
          );
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    void load();

    const off = onNotification((notification) => {
      if (!alive) {
        return;
      }

      setItems((previous) =>
        [
          notification,
          ...previous.filter(
            (item) => item.id !== notification.id,
          ),
        ].slice(0, 100),
      );
    });

    return () => {
      alive = false;
      off();
    };
  }, []);

  const categories = useMemo(() => {
    const counts: Record<
      NotificationCategory,
      number
    > = {
      all: items.length,
      orders: 0,
      wallet: 0,
      offers: 0,
      account: 0,
      general: 0,
    };

    items.forEach((item) => {
      counts[getCategory(item)] += 1;
    });

    return counts;
  }, [items]);

  const visibleItems = useMemo(() => {
    if (filter === 'all') {
      return items;
    }

    return items.filter(
      (item) => getCategory(item) === filter,
    );
  }, [items, filter]);

  return (
    <>
      <main className="rozzi-notifications-page">
        <style jsx>{`
          .rozzi-notifications-page {
            min-height: 100vh;
            background:
              radial-gradient(
                circle at 90% 0%,
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

          .nav-link.active {
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
            gap: 20px;
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
            max-width: 610px;
            margin: 10px 0 0;
            color: #6f747d;
            font-size: 15px;
            line-height: 1.65;
          }

          .live {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 39px;
            padding: 0 12px;
            border: 1px solid #cfe5d6;
            border-radius: 999px;
            background: #f2faf5;
            color: #247344;
            font-size: 12px;
            font-weight: 850;
          }

          .live-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #21a45b;
            box-shadow: 0 0 0 4px rgba(33, 164, 91, 0.12);
          }

          .layout {
            display: grid;
            grid-template-columns: 235px minmax(0, 1fr);
            gap: 20px;
            align-items: start;
          }

          .filters {
            position: sticky;
            top: 96px;
            padding: 16px;
            border: 1px solid #eee8df;
            border-radius: 20px;
            background: #fff;
            box-shadow: 0 12px 30px rgba(48, 30, 15, 0.05);
          }

          .filter-title {
            margin: 4px 8px 12px;
            color: #2b2521;
            font-size: 13px;
            font-weight: 900;
          }

          .filter {
            width: 100%;
            min-height: 44px;
            padding: 0 11px;
            border: 0;
            border-radius: 11px;
            background: transparent;
            color: #6f6962;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 800;
            text-align: left;
          }

          .filter:hover {
            background: #faf6f0;
            color: #4d1716;
          }

          .filter.active {
            background: #4d1716;
            color: #fff;
          }

          .filter-left {
            display: flex;
            align-items: center;
            gap: 9px;
          }

          .count {
            min-width: 24px;
            padding: 3px 6px;
            border-radius: 999px;
            background: #f1ece5;
            color: #756e66;
            text-align: center;
            font-size: 10px;
          }

          .filter.active .count {
            background: rgba(255, 255, 255, 0.16);
            color: #fff;
          }

          .feed {
            display: grid;
            gap: 13px;
          }

          .notification {
            display: grid;
            grid-template-columns: 48px minmax(0, 1fr);
            gap: 15px;
            padding: 20px;
            border: 1px solid #eee8df;
            border-radius: 18px;
            background: #fff;
            box-shadow: 0 10px 28px rgba(48, 30, 15, 0.045);
            transition:
              transform 0.18s ease,
              box-shadow 0.18s ease;
          }

          .notification:hover {
            transform: translateY(-1px);
            box-shadow: 0 15px 32px rgba(48, 30, 15, 0.07);
          }

          .notification-icon {
            width: 48px;
            height: 48px;
            border-radius: 15px;
            background: #fff1e5;
            color: #e85d0d;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .notification-content {
            min-width: 0;
          }

          .notification-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 15px;
          }

          .title {
            margin: 0;
            color: #2c2622;
            font-size: 15px;
            line-height: 1.4;
            font-weight: 900;
          }

          .category {
            flex-shrink: 0;
            min-height: 25px;
            padding: 0 8px;
            border-radius: 999px;
            background: #f8f2eb;
            color: #81786f;
            display: inline-flex;
            align-items: center;
            font-size: 9px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .message {
            margin: 7px 0 0;
            color: #716b64;
            font-size: 13px;
            line-height: 1.6;
          }

          .time {
            display: block;
            margin-top: 11px;
            color: #9a9289;
            font-size: 11px;
            font-weight: 650;
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
            padding: 78px 25px;
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
            max-width: 440px;
            margin: 9px auto 0;
            color: #77716b;
            font-size: 14px;
            line-height: 1.6;
          }

          .skeleton {
            height: 112px;
            border-radius: 18px;
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

          @media (max-width: 800px) {
            .layout {
              grid-template-columns: 1fr;
            }

            .filters {
              position: static;
              display: flex;
              align-items: center;
              gap: 5px;
              overflow-x: auto;
              padding: 7px;
            }

            .filter-title {
              display: none;
            }

            .filter {
              width: auto;
              flex: 0 0 auto;
              padding: 0 11px;
            }

            .filter-left {
              gap: 6px;
            }
          }

          @media (max-width: 640px) {
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

            .live {
              width: fit-content;
            }

            .notification {
              grid-template-columns: 40px minmax(0, 1fr);
              gap: 12px;
              padding: 16px;
            }

            .notification-icon {
              width: 40px;
              height: 40px;
              border-radius: 12px;
            }

            .notification-top {
              display: block;
            }

            .category {
              margin-top: 7px;
            }

            .message {
              font-size: 12px;
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

              <Link href="/orders" className="nav-link">
                Orders
              </Link>

              <Link
                href="/notifications"
                className="nav-link active"
              >
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
            <span>Notifications</span>
          </div>

          <section className="hero">
            <div>
              <p className="eyebrow">
                ROZZI customer centre
              </p>

              <h1>Notifications</h1>

              <p className="intro">
                Stay up to date with your ROZZI orders,
                payments, account activity and available
                offers.
              </p>
            </div>

            <div className="live">
              <span className="live-dot" />
              Live updates enabled
            </div>
          </section>

          {error && (
            <div className="alert">
              {error}
            </div>
          )}

          <div className="layout">
            <aside className="filters">
              <div className="filter-title">
                Notification centre
              </div>

              {notificationFilters.map(
                ({
                  key,
                  label,
                  icon: IconComponent,
                }) => {
                  const count =
                    categories[key] || 0;

                  return (
                    <button
                      type="button"
                      key={key}
                      className={`filter ${
                        filter === key
                          ? 'active'
                          : ''
                      }`}
                      onClick={() =>
                        setFilter(key)
                      }
                    >
                      <span className="filter-left">
                        <IconComponent size={17} />
                        {label}
                      </span>

                      <span className="count">
                        {count}
                      </span>
                    </button>
                  );
                },
              )}
            </aside>

            <section className="feed">
              {loading ? (
                <>
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </>
              ) : !visibleItems.length ? (
                <div className="empty">
                  <div className="empty-icon">
                    <BellIcon size={32} />
                  </div>

                  <h2>
                    {filter === 'all'
                      ? 'You’re all caught up'
                      : `No ${filter} notifications`}
                  </h2>

                  <p>
                    {filter === 'all'
                      ? 'When something important happens on your ROZZI account, you’ll see it here.'
                      : 'Notifications in this category will appear here when ROZZI has something to share with you.'}
                  </p>
                </div>
              ) : (
                visibleItems.map(
                  (notification) => {
                    const category =
                      getCategory(
                        notification,
                      );

                    return (
                      <article
                        className="notification"
                        key={notification.id}
                      >
                        <div className="notification-icon">
                          {getIcon(category)}
                        </div>

                        <div className="notification-content">
                          <div className="notification-top">
                            <h2 className="title">
                              {notification.title ||
                                'ROZZI notification'}
                            </h2>

                            <span className="category">
                              {getCategoryLabel(
                                category,
                              )}
                            </span>
                          </div>

                          <p className="message">
                            {notification.message ||
                              'You have a new update from ROZZI.'}
                          </p>

                          {notification.createdAt && (
                            <time className="time">
                              {new Date(
                                notification.createdAt,
                              ).toLocaleString(
                                'en-NG',
                                {
                                  dateStyle:
                                    'medium',
                                  timeStyle:
                                    'short',
                                },
                              )}
                            </time>
                          )}
                        </div>
                      </article>
                    );
                  },
                )
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  );
}