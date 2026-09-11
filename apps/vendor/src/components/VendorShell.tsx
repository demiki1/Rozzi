'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import { logout } from '../lib/api';

const groups = [
  {
    label: 'Workspace',
    items: [
      { href: '/', label: 'Dashboard', icon: '⌂' },
      { href: '/orders', label: 'Orders', icon: '▣' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { href: '/products', label: 'Products', icon: '□' },
      { href: '/products/categories', label: 'Categories', icon: '▦' },
      { href: '/products/variants', label: 'Variants', icon: '◇' },
      { href: '/products/options', label: 'Options & Add-ons', icon: '⊞' },
      { href: '/advanced', label: 'Advanced & Bulk', icon: '⚡' },
      { href: '/inventory', label: 'Inventory', icon: '▤' },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/store', label: 'Store', icon: '⌂' },
      { href: '/store/outlets', label: 'Outlets', icon: '⌘' },
      { href: '/promotions', label: 'Promotions', icon: '◇' },
      { href: '/advertising', label: 'Advertising', icon: '↗' },
      { href: '/analytics', label: 'Analytics', icon: '▥' },
      { href: '/finance', label: 'Finance', icon: '₦' },
      { href: '/deliveries', label: 'Deliveries', icon: '⇢' },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { href: '/customers', label: 'Customers', icon: '♙' },
      { href: '/reviews', label: 'Reviews', icon: '★' },
      { href: '/team', label: 'Team', icon: '♧' },
    ],
  },
];

export function VendorShell({
  children,
  title,
}: {
  children: ReactNode;
  title?: string;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function signOut() {
    logout();
    window.location.href = '/login';
  }

  return (
    <div className="vendor-app">
      <aside className="vendor-sidebar">
        <div className="vendor-brand">
          <div className="vendor-brand-mark">
            <img src="/rozzi-logo.png" alt="ROZZI" />
          </div>
          <div>
            <strong>ROZZI</strong>
            <span>Vendor Center</span>
          </div>
        </div>

        <div className="store-switcher">
          <div className="store-avatar">
            <img src="/rozzi-logo.png" alt="" />
          </div>
          <div className="store-switcher-copy">
            <strong>My Store</strong>
            <span>Vendor account</span>
          </div>
          <span className="store-chevron">⌄</span>
        </div>

        <nav className="sidebar-nav" aria-label="Vendor navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>

              {group.items.map((item) => (
<Link
  key={item.href}
  href={item.href}
  className={`sidebar-link ${
    isActive(item.href) ? 'active' : ''
  }`}
>
  <span className="sidebar-icon" aria-hidden="true">
    {item.icon}
  </span>

  <span>{item.label}</span>
</Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link
            className={`sidebar-link ${
              isActive('/onboarding') ? 'active' : ''
            }`}
            href="/onboarding"
          >
            <span className="sidebar-icon">✓</span>
            <span>Onboarding &amp; Verification</span>
          </Link>

          <Link
            className={`sidebar-link ${
              isActive('/notifications') ? 'active' : ''
            }`}
            href="/notifications"
          >
            <span className="sidebar-icon">♢</span>
            <span>Notifications</span>
            <span className="notification-count">!</span>
          </Link>

          <Link
            className={`sidebar-link ${
              isActive('/support') ? 'active' : ''
            }`}
            href="/support"
          >
            <span className="sidebar-icon">?</span>
            <span>Support</span>
          </Link>

          <Link
            className={`sidebar-link ${
              isActive('/settings') ? 'active' : ''
            }`}
            href="/settings"
          >
            <span className="sidebar-icon">⚙</span>
            <span>Settings</span>
          </Link>
        </div>
      </aside>

      <div className="vendor-main">
        <header className="vendor-topbar">
          <div className="topbar-page-title">
            <span className="topbar-kicker">Vendor workspace</span>

            <strong>
              {title ||
                (pathname === '/'
                  ? 'Dashboard'
                  : pathname.split('/')[1]?.replace(/-/g, ' '))}
            </strong>
          </div>

          <div className="topbar-actions">
            <Link
              className="icon-button notification-button"
              aria-label="Notifications"
              href="/notifications"
            >
              ♢
              <span className="notification-dot" />
            </Link>

            <button
              className="profile-button"
              aria-label="Vendor profile"
            >
              <span className="profile-avatar">
                <img src="/rozzi-logo.png" alt="" />
              </span>

              <span className="profile-copy">
                <strong>Vendor</strong>
                <small>Account</small>
              </span>

              <span className="profile-chevron">⌄</span>
            </button>

            <button
              className="logout-button"
              onClick={signOut}
            >
              Log out
            </button>
          </div>
        </header>

        <main className="vendor-content">
          {children}
        </main>
      </div>

      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile vendor navigation"
      >
        <Link
          href="/"
          className={isActive('/') ? 'active' : ''}
        >
          <span>⌂</span>
          <small>Home</small>
        </Link>

        <Link
          href="/orders"
          className={isActive('/orders') ? 'active' : ''}
        >
          <span>▣</span>
          <small>Orders</small>
        </Link>

        <Link
          href="/products"
          className={isActive('/products') ? 'active' : ''}
        >
          <span>□</span>
          <small>Products</small>
        </Link>

        <Link
          href="/finance"
          className={isActive('/finance') ? 'active' : ''}
        >
          <span>₦</span>
          <small>Finance</small>
        </Link>

        <Link
          href="/more"
          className={isActive('/more') ? 'active' : ''}
        >
          <span>☰</span>
          <small>More</small>
        </Link>
      </nav>
    </div>
  );
}

export default VendorShell;