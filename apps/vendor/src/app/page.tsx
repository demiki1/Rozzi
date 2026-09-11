'use client';

import Link from 'next/link';
import VendorShell from '../components/VendorShell';
import { useEffect, useMemo, useState } from 'react';
import { api, patch, post } from '../lib/api';

type DashboardData = {
  vendor: { id: string; storeName: string; status: string; isOpen: boolean; vendorType: string | null };
  metrics: {
    todaySales: number; todayOrders: number; pendingOrders: number; completedOrders: number;
    averageOrderValue: number; rating: number; reviewCount: number; productsCount: number;
    salesChange: number | null; orderChange: number | null;
  };
  chart: { date: string; label: string; revenue: number; orders: number }[];
  orderActivity: { new: number; preparing: number; ready: number; delivery: number; completed: number };
  popularProducts: { productId: string; name: string; orders: number; revenue: number }[];
  lowStockProducts: { id: string; name: string; quantity: number }[];
  recentOrders: { id: string; orderNumber: string; customerName: string; status: string; totalAmount: number; createdAt: string }[];
};

const money = (amount: number) => `₦${Math.round(amount / 100).toLocaleString('en-NG')}`;
const percent = (value: number | null) => value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
const statusLabel = (status: string) => status.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'V';
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };

function SalesChart({ data }: { data: DashboardData['chart'] }) {
  const max = Math.max(...data.map((item) => item.revenue), 1);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = 88 - (item.revenue / max) * 72;
    return `${x},${y}`;
  }).join(' ');
  const area = `0,100 ${points} 100,100`;

  return (
    <div className="sales-chart-wrap">
      <svg className="sales-chart" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Revenue over the last seven days">
        <defs><linearGradient id="rozziArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--rozzi-brand)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--rozzi-brand)" stopOpacity="0" /></linearGradient></defs>
        <line x1="0" y1="88" x2="100" y2="88" className="chart-grid-line" />
        <line x1="0" y1="52" x2="100" y2="52" className="chart-grid-line" />
        <line x1="0" y1="16" x2="100" y2="16" className="chart-grid-line" />
        <polygon points={area} fill="url(#rozziArea)" />
        <polyline points={points} fill="none" className="chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="chart-labels">{data.map((item) => <span key={item.date}>{item.label}</span>)}</div>
    </div>
  );
}

export default function VendorDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingStore, setUpdatingStore] = useState(false);
  const [actingOrder, setActingOrder] = useState<string | null>(null);

  async function load() {
    try {
      setError('');
      const result = await api<DashboardData>('/api/vendor/dashboard');
      setData(result);
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleStore() {
    if (!data) return;
    try {
      setError('');
      setUpdatingStore(true);
      await patch('/api/vendor/me/open-status', { isOpen: !data.vendor.isOpen });
      await load();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Failed to update store status.');
    } finally { setUpdatingStore(false); }
  }

  async function actOnOrder(orderId: string, action: string) {
    try {
      setError(''); setActingOrder(orderId);
      await post(`/api/vendor/orders/${orderId}/${action}`);
      await load();
    } catch (e: any) {
      setError(typeof e?.message === 'string' ? e.message : 'Unable to update the order.');
    } finally { setActingOrder(null); }
  }

  const maxActivity = useMemo(() => data ? Math.max(...Object.values(data.orderActivity), 1) : 1, [data]);

  if (loading) return <VendorShell><div className="dashboard-loading"><div className="loading-spinner" /><p>Loading your dashboard…</p></div></VendorShell>;
  if (!data) return <VendorShell><div className="dashboard-error"><div className="error-icon">!</div><h1>We couldn't load your dashboard</h1><p>{error || 'Please try again.'}</p><button className="btn" onClick={load}>Try again</button></div></VendorShell>;

  const { vendor, metrics } = data;
  const attentionCount = data.lowStockProducts.length + metrics.pendingOrders;

  return (
    <VendorShell>
      <div className="dashboard-page">
        {error && <div className="error dashboard-error-banner" role="alert">{error}</div>}

        <section className="dashboard-welcome">
          <div>
            <p className="eyebrow">Vendor workspace</p>
            <h1>{greeting()}, {vendor.storeName || 'there'} <span aria-hidden="true">👋</span></h1>
            <p>Here&apos;s what&apos;s happening with your store today.</p>
          </div>
          <div className="welcome-actions">
            <button className={`store-status-button ${vendor.isOpen ? 'open' : 'closed'}`} onClick={toggleStore} disabled={updatingStore}>
              <span className="status-dot" />
              {updatingStore ? 'Updating…' : vendor.isOpen ? 'Store Open' : 'Store Closed'}
            </button>
            <Link href="/settings" className="btn outline">Store settings</Link>
          </div>
        </section>

        <section className="metric-grid" aria-label="Store performance summary">
          <article className="metric-card featured">
            <div className="metric-card-top"><span>Today&apos;s sales</span><span className="metric-icon">₦</span></div>
            <strong>{money(metrics.todaySales)}</strong>
            <div className="metric-foot"><span className={metrics.salesChange != null && metrics.salesChange >= 0 ? 'trend positive' : 'trend'}>{percent(metrics.salesChange)}</span><span>vs same day last week</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-card-top"><span>Today&apos;s orders</span><span className="metric-icon">▣</span></div>
            <strong>{metrics.todayOrders.toLocaleString()}</strong>
            <div className="metric-foot"><span className={metrics.orderChange != null && metrics.orderChange >= 0 ? 'trend positive' : 'trend'}>{percent(metrics.orderChange)}</span><span>vs same day last week</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-card-top"><span>Average order</span><span className="metric-icon">↗</span></div>
            <strong>{money(metrics.averageOrderValue)}</strong>
            <div className="metric-foot"><span>7-day average</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-card-top"><span>Store rating</span><span className="metric-icon star">★</span></div>
            <strong>{metrics.rating ? metrics.rating.toFixed(1) : '—'}</strong>
            <div className="metric-foot"><span>{metrics.reviewCount.toLocaleString()} reviews</span></div>
          </article>
        </section>

        <section className="dashboard-main-grid">
          <article className="panel sales-panel">
            <div className="panel-heading">
              <div><p className="eyebrow">Performance</p><h2>Revenue</h2></div>
              <span className="period-pill">Last 7 days</span>
            </div>
            <div className="chart-total">{money(data.chart.reduce((sum, item) => sum + item.revenue, 0))}</div>
            <SalesChart data={data.chart} />
          </article>

          <article className="panel activity-panel">
            <div className="panel-heading"><div><p className="eyebrow">Live workload</p><h2>Order activity</h2></div></div>
            <div className="activity-list">
              {([['New', data.orderActivity.new, 'new'], ['Preparing', data.orderActivity.preparing, 'preparing'], ['Ready', data.orderActivity.ready, 'ready'], ['Out for delivery', data.orderActivity.delivery, 'delivery'], ['Completed', data.orderActivity.completed, 'completed']] as const).map(([label, count, key]) => (
                <div className="activity-row" key={key}>
                  <div className="activity-label"><span className={`activity-dot ${key}`} />{label}</div>
                  <div className="activity-track"><span style={{ width: `${Math.max(4, (count / maxActivity) * 100)}%` }} /></div>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
            <Link href="/orders" className="panel-link">Open orders center <span>→</span></Link>
          </article>
        </section>

        <section className="dashboard-bottom-grid">
          <article className="panel">
            <div className="panel-heading"><div><p className="eyebrow">Products</p><h2>Popular products</h2></div><Link href="/products" className="panel-link">View all</Link></div>
            {data.popularProducts.length ? <div className="popular-list">{data.popularProducts.map((product, index) => (
              <div className="popular-row" key={product.productId}><span className="rank">{String(index + 1).padStart(2, '0')}</span><div className="popular-copy"><strong>{product.name}</strong><span>{product.orders} units sold</span></div><strong>{money(product.revenue)}</strong></div>
            ))}</div> : <div className="empty-state compact"><span className="empty-icon">□</span><p>No delivered product sales yet.</p><Link href="/products">Manage products</Link></div>}
          </article>

          <article className="panel attention-panel">
            <div className="panel-heading"><div><p className="eyebrow">Action center</p><h2>Attention required</h2></div><span className={`attention-count ${attentionCount ? 'has-items' : ''}`}>{attentionCount}</span></div>
            <div className="attention-list">
              {metrics.pendingOrders > 0 && <Link href="/orders" className="attention-row"><span className="attention-icon warning">!</span><div><strong>{metrics.pendingOrders} order{metrics.pendingOrders === 1 ? '' : 's'} need{metrics.pendingOrders === 1 ? 's' : ''} attention</strong><span>Review and accept new orders</span></div><span>→</span></Link>}
              {data.lowStockProducts.slice(0, 4).map((product) => <Link href="/products" className="attention-row" key={product.id}><span className="attention-icon danger">!</span><div><strong>{product.name} is low on stock</strong><span>{product.quantity} remaining</span></div><span>→</span></Link>)}
              {!attentionCount && <div className="clear-state"><span>✓</span><div><strong>You&apos;re all caught up</strong><p>No urgent actions right now.</p></div></div>}
            </div>
          </article>
        </section>

        <section className="panel recent-panel">
          <div className="panel-heading"><div><p className="eyebrow">Operations</p><h2>Recent orders</h2></div><Link href="/orders" className="panel-link">View all orders <span>→</span></Link></div>
          {data.recentOrders.length ? <div className="recent-orders-table">
            <div className="recent-head"><span>Order</span><span>Customer</span><span>Amount</span><span>Status</span><span>Time</span><span /></div>
            {data.recentOrders.map((order) => <div className="recent-row" key={order.id}>
              <Link href="/orders" className="order-number">{order.orderNumber}</Link>
              <div className="customer-cell"><span className="mini-avatar">{initials(order.customerName)}</span><span>{order.customerName}</span></div>
              <strong>{money(order.totalAmount)}</strong>
              <span className={`status-badge status-${order.status.toLowerCase()}`}>{statusLabel(order.status)}</span>
              <time>{new Date(order.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</time>
              <div className="quick-action">
                {order.status === 'PENDING_VENDOR' && <button onClick={() => actOnOrder(order.id, 'accept')} disabled={actingOrder === order.id}>{actingOrder === order.id ? '…' : 'Accept'}</button>}
                {order.status === 'ACCEPTED' && <button onClick={() => actOnOrder(order.id, 'preparing')} disabled={actingOrder === order.id}>{actingOrder === order.id ? '…' : 'Prepare'}</button>}
                {order.status === 'PREPARING' && <button onClick={() => actOnOrder(order.id, 'ready')} disabled={actingOrder === order.id}>{actingOrder === order.id ? '…' : 'Ready'}</button>}
              </div>
            </div>)}
          </div> : <div className="empty-state"><span className="empty-icon">▣</span><h3>No orders yet</h3><p>Your newest orders will appear here as customers shop with you.</p></div>}
        </section>
      </div>
    </VendorShell>
  );
}
