'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';

type IconName =
  | 'grid' | 'orders' | 'map' | 'store' | 'rider' | 'users' | 'box' | 'wallet'
  | 'megaphone' | 'star' | 'support' | 'school' | 'chart' | 'shield' | 'file'
  | 'plug' | 'settings' | 'bell' | 'search' | 'chevron' | 'logout' | 'menu' | 'x'
  | 'arrow' | 'clock' | 'check' | 'alert';

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { href: '/overview', label: 'Dashboard', icon: 'grid' as IconName },
      { href: '/deliveries', label: 'Live Operations', icon: 'map' as IconName },
    ],
  },
  {
    label: 'MARKETPLACE',
    items: [
      { href: '/orders', label: 'Orders', icon: 'orders' as IconName },
      { href: '/vendors', label: 'Vendors', icon: 'store' as IconName },
      { href: '/riders', label: 'Riders', icon: 'rider' as IconName },
      { href: '/categories', label: 'Catalog', icon: 'box' as IconName },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { href: '/finance', label: 'Finance', icon: 'wallet' as IconName },
    ],
  },
  {
    label: 'GROWTH',
    items: [
      { href: '/promotions', label: 'Promotions', icon: 'megaphone' as IconName },
      { href: '/advertising', label: 'Banners & Ads', icon: 'star' as IconName },
      { href: '/notifications', label: 'Notifications', icon: 'bell' as IconName },
    ],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { href: '/support', label: 'Support', icon: 'support' as IconName },
      { href: '/locations', label: 'Locations', icon: 'school' as IconName },
      { href: '/content', label: 'Content', icon: 'file' as IconName },
    ],
  },
  {
  label: 'SYSTEM',
  items: [
    { href: '/audit', label: 'Audit Logs', icon: 'shield' as IconName },
    { href: '/settings', label: 'Settings', icon: 'settings' as IconName },
    { href: '/settings/referrals', label: 'Refer & Earn', icon: 'users' as IconName },
    { href: '/settings/pricing', label: 'Pricing', icon: 'chart' as IconName },
  ],
},
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    orders: <><path d="M6 3h12l2 4H4l2-4Z"/><path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7"/><path d="M9 11h6"/><path d="M9 15h4"/></>,
    map: <><path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3Z"/><path d="M9 3v15"/><path d="M15 6v15"/></>,
    store: <><path d="M4 10v10h16V10"/><path d="M3 10 5 4h14l2 6"/><path d="M3 10c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3"/><path d="M9 20v-4h6v4"/></>,
    rider: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 18h6l2-6h-5l-2-3H6"/><path d="M15 12h3l2 3"/><path d="M11 9h2"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3 3 0 0 1 0 7"/><path d="M18 14a5 5 0 0 1 3 4.5"/></>,
    box: <><path d="m21 8-9 5-9-5 9-5 9 5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></>,
    wallet: <><path d="M4 6h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14"/><path d="M17 14h5"/></>,
    megaphone: <><path d="m3 11 18-5v12L3 13v-2Z"/><path d="M11 15v5"/><path d="M7 14.2 5.5 19"/></>,
    star: <><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></>,
    support: <><path d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2h-1"/><path d="M4 15H3a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h1"/><path d="M9 20h6"/></>,
    school: <><path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="M7 11v6c2 2 8 2 10 0v-6"/><path d="M21 9v7"/></>,
    chart: <><path d="M4 19V5"/><path d="M4 19h17"/><path d="m7 15 4-4 3 2 5-6"/></>,
    shield: <><path d="M12 3 20 6v5c0 5-3.3 8.4-8 10-4.7-1.6-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></>,
    file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/></>,
    plug: <><path d="M8 12V5"/><path d="M16 12V5"/><path d="M6 5h4"/><path d="M14 5h4"/><path d="M5 12h14"/><path d="M12 12v9"/></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1 1.5 1.2-1.8 3-1.8-.7a7.7 7.7 0 0 1-1.7 1l-.3 1.9h-3.5l-.3-1.9a7.7 7.7 0 0 1-1.7-1l-1.8.7-1.8-3 1.5-1.2.1-.1a7.5 7.5 0 0 1 0-2l-.1-.1-1.5-1.2 1.8-3 1.8.7a7.7 7.7 0 0 1 1.7-1L12 5.5h3.5l.3 1.9a7.7 7.7 0 0 1 1.7 1l1.8-.7 1.8 3-1.5 1.2-.1.1a7.5 7.5 0 0 1-.1 2Z"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M21 19V5a2 2 0 0 0-2-2h-6"/></>,
    menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    x: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    alert: <><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  const current = useMemo(() => {
    for (const group of NAV_GROUPS) {
      const item = group.items.find((x) => pathname?.startsWith(x.href));
      if (item) return item.label;
    }
    return 'Dashboard';
  }, [pathname]);

  if (loading || !user) {
    return <div className="admin-loading"><div className="admin-spinner" />Loading ROZZI Admin…</div>;
  }

  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="admin-brand">
          <div className="admin-brand-mark"><img src="/rozzi-logo.png" alt="ROZZI" /></div>
          <div>
            <div className="admin-brand-name">ROZZI</div>
            <div className="admin-brand-role">ADMIN CONSOLE</div>
          </div>
          <button className="admin-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close menu"><Icon name="x" /></button>
        </div>

        <div className="admin-sidebar-scroll">
          {NAV_GROUPS.map((group) => (
            <div className="admin-nav-group" key={group.label}>
              <div className="admin-nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`admin-nav-item ${active ? 'active' : ''}`}>
                    <span className="admin-nav-icon"><Icon name={item.icon} size={17} /></span>
                    <span>{item.label}</span>
                    {active && <span className="admin-nav-active-dot" />}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div className="admin-sidebar-footer">
          <div className="admin-security-chip"><span className="admin-online-dot" />System operational</div>
          <button onClick={logout} className="admin-logout"><Icon name="logout" size={17} /> Sign out</button>
        </div>
      </aside>

      {mobileOpen && <button className="admin-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="admin-mobile-menu" onClick={() => setMobileOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <div className="admin-breadcrumb"><span>ROZZI</span><span>/</span><strong>{current}</strong></div>
          <div className="admin-top-actions">
            <label className="admin-global-search">
              <Icon name="search" size={17} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ROZZI…" aria-label="Search ROZZI" />
              <kbd>⌘ K</kbd>
            </label>
            <Link href="/notifications" className="admin-icon-button" aria-label="Notifications">
              <Icon name="bell" size={18} /><span className="admin-notification-dot" />
            </Link>
            <div className="admin-user">
              <div className="admin-avatar">A</div>
              <div className="admin-user-meta"><strong>Administrator</strong> <span>{user.role}</span></div>
              <Icon name="chevron" size={14} />
            </div>
          </div>
        </header>
        <main className="admin-content">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, eyebrow, action }: { title: string; description?: string; eyebrow?: string; action?: ReactNode }) {
  return (
    <div className="admin-page-header">
      <div>
        {eyebrow && <div className="admin-eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="admin-page-actions">{action}</div>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    ACTIVE: 'success', APPROVED: 'success', DELIVERED: 'success', COMPLETED: 'success',
    PENDING: 'warning', PENDING_PAYMENT: 'warning', PENDING_VENDOR: 'warning', UNDER_REVIEW: 'warning',
    DRAFT: 'neutral', PAUSED: 'orange', SUSPENDED: 'danger', REJECTED: 'danger', CANCELLED: 'danger', FAILED: 'danger',
    INACTIVE: 'neutral', CLOSED: 'neutral', PREPARING: 'info', ACCEPTED: 'info', READY_FOR_PICKUP: 'info',
    RIDER_SEARCHING: 'purple', RIDER_ASSIGNED: 'purple', PICKED_UP: 'blue', IN_TRANSIT: 'blue', RIDER_ARRIVED: 'blue',
    REFUNDED: 'purple',
  };
  const label = status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className={`admin-status ${tone[status] || 'neutral'}`}><span />{label}</span>;
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button' }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'danger' | 'secondary' | 'ghost'; disabled?: boolean; type?: 'button' | 'submit' | 'reset';
}) {
  return <button type={type} onClick={onClick} disabled={disabled} className={`admin-button ${variant}`}><span>{children}</span></button>;
}

export function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`admin-card ${className}`}>{children}</section>;
}

export { Icon };
