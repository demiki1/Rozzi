'use client';

import VendorShell from '../../components/VendorShell';
import { api, post } from '../../lib/api';
import { useEffect, useMemo, useState } from 'react';
import { onOrderStatus } from '../../lib/realtime';

type OrderStatus =
  | 'PENDING_VENDOR' | 'ACCEPTED' | 'PREPARING' | 'READY_FOR_PICKUP'
  | 'RIDER_SEARCHING' | 'RIDER_ASSIGNED' | 'RIDER_ARRIVED_PICKUP' | 'PICKED_UP'
  | 'IN_TRANSIT' | 'RIDER_ARRIVED' | 'DELIVERED' | 'CANCELLED' | 'FAILED' | 'REFUNDED' | string;

type Order = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  subtotalAmount: number;
  deliveryFeeAmount: number;
  serviceFeeAmount: number;
  discountAmount: number;
  totalAmount: number;
  deliveryType: 'DELIVERY' | 'PICKUP';
  deliveryModel?: string;
  scheduledFor?: string | null;
  customerNote?: string | null;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; fullName: string; phone?: string | null };
  address?: { addressLine1?: string; addressLine2?: string | null; city?: string; state?: string } | null;
  items: Array<{ id: string; nameSnapshot: string; unitPriceSnapshot: number; quantity: number; subtotalAmount: number; variantId?: string | null }>;
  delivery?: { rider?: { id: string; user?: { fullName?: string; phone?: string | null } } | null } | null;
  payments?: Array<{ status: string; amount: number; provider: string; paidAt?: string | null; reference: string }>;
  statusHistory?: Array<{ fromStatus?: string | null; toStatus: string; createdAt: string; note?: string | null }>;
};

const statuses = [
  ['ALL', 'All'], ['PENDING_VENDOR', 'New'], ['ACCEPTED', 'Accepted'], ['PREPARING', 'Preparing'],
  ['READY_FOR_PICKUP', 'Ready'], ['RIDER_ASSIGNED', 'Rider assigned'], ['PICKED_UP', 'Picked up'],
  ['DELIVERED', 'Completed'], ['CANCELLED', 'Cancelled'],
] as const;

const money = (kobo = 0) => `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
const labelStatus = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
const initials = (name = 'Customer') => name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase();
const relativeTime = (value: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
};

export default function Orders() {
  const [items, setItems] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [active, setActive] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  async function load() {
    setError('');
    try {
      const data = await api<Order[]>('/api/vendor/orders');
      setItems(data);
      setSelected(current => current ? data.find(o => o.id === current.id) || current : null);
    } catch (e: any) {
      setError(e.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15000);
    const off = onOrderStatus(() => { void load(); });
    return () => { window.clearInterval(timer); off(); };
  }, []);

  const counts = useMemo(() => {
    const map: Record<string, number> = { ALL: items.length };
    for (const o of items) map[o.status] = (map[o.status] || 0) + 1;
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(o => {
      const statusMatch = active === 'ALL' || o.status === active;
      const searchMatch = !q || [o.orderNumber, o.customer?.fullName, o.customer?.phone]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      return statusMatch && searchMatch;
    });
  }, [items, active, search]);

  async function act(id: string, path: string, body?: unknown) {
    setBusyId(id);
    setError('');
    try {
      await post(`/api/vendor/orders/${id}/${path}`, body);
      await load();
    } catch (e: any) {
      setError(e.message || 'The order could not be updated.');
    } finally {
      setBusyId(null);
    }
  }

  async function rejectOrder() {
    if (!selected) return;
    await act(selected.id, 'reject', { reason: rejectReason.trim() || 'Rejected by vendor' });
    setRejecting(false);
    setRejectReason('');
  }

  const action = (order: Order) => {
    if (order.status === 'PENDING_VENDOR') return { label: 'Accept order', path: 'accept' };
    if (order.status === 'ACCEPTED') return { label: 'Start preparing', path: 'preparing' };
    if (order.status === 'PREPARING') return { label: 'Mark ready', path: 'ready' };
    if (order.status === 'READY_FOR_PICKUP' && (order.deliveryType === 'PICKUP' || order.deliveryModel === 'SELF_DELIVERY')) return { label: 'Complete order', path: 'delivered' };
    return null;
  };

  return (
    <VendorShell>
      <main className="orders-page">
        <section className="page-heading-row">
          <div>
            <span className="eyebrow">Operations</span>
            <h1>Orders</h1>
            <p>Manage incoming orders, preparation and fulfilment from one place.</p>
          </div>
          <button className="btn outline" onClick={load} disabled={loading}>↻ Refresh</button>
        </section>

        {error && <div className="error-banner" role="alert"><strong>Something went wrong.</strong><span>{error}</span></div>}

        <section className="orders-toolbar panel">
          <div className="order-tabs" role="tablist" aria-label="Order status filters">
            {statuses.map(([value, text]) => (
              <button key={value} className={active === value ? 'order-tab active' : 'order-tab'} onClick={() => setActive(value)}>
                {text}<span>{counts[value] || 0}</span>
              </button>
            ))}
          </div>
          <div className="orders-search">
            <span>⌕</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search order ID or customer..." aria-label="Search orders" />
            {search && <button onClick={() => setSearch('')} aria-label="Clear search">×</button>}
          </div>
        </section>

        <section className="orders-table panel">
          <div className="panel-heading">
            <div><h2>{active === 'ALL' ? 'All orders' : labelStatus(active)}</h2><span>{filtered.length} {filtered.length === 1 ? 'order' : 'orders'}</span></div>
            <span className="live-pill"><i /> Live queue</span>
          </div>

          {loading ? <div className="table-state"><div className="loading-spinner" /><p>Loading orders...</p></div> : filtered.length === 0 ? (
            <div className="table-state"><div className="empty-icon">▣</div><h3>No orders here</h3><p>{search ? 'Try a different search.' : 'New orders will appear in this queue when customers place them.'}</p></div>
          ) : (
            <div className="orders-scroll">
              <div className="orders-head"><span>Order</span><span>Customer</span><span>Items</span><span>Amount</span><span>Status</span><span>Time</span><span /></div>
              {filtered.map(order => {
                const next = action(order);
                return <div key={order.id} className="order-row" role="button" tabIndex={0} onClick={() => setSelected(order)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(order); } }}>
                  <span className="order-no">#{order.orderNumber.replace(/^VEL-/, 'RZ')}</span>
                  <span className="order-customer"><i>{initials(order.customer?.fullName)}</i><b>{order.customer?.fullName || 'Customer'}</b></span>
                  <span>{order.items.length} {order.items.length === 1 ? 'item' : 'items'}</span>
                  <strong>{money(order.totalAmount)}</strong>
                  <span className={`status-badge status-${order.status.toLowerCase()}`}>{labelStatus(order.status)}</span>
                  <time>{relativeTime(order.createdAt)}</time>
                  <span className="row-arrow">›</span>
                  {next && <span className="row-action"><button type="button" disabled={busyId === order.id} onClick={e => { e.stopPropagation(); act(order.id, next.path); }}>{busyId === order.id ? '...' : next.label}</button></span>}
                </div>;
              })}
            </div>
          )}
        </section>

        {selected && <OrderDrawer order={selected} onClose={() => setSelected(null)} busy={busyId === selected.id} action={action(selected)} onAction={() => { const next = action(selected); if (next) act(selected.id, next.path); }} onReject={() => setRejecting(true)} />}
        {rejecting && <div className="modal-backdrop" onMouseDown={() => setRejecting(false)}><div className="confirm-modal" onMouseDown={e => e.stopPropagation()}>
          <span className="modal-icon danger">!</span><h2>Reject this order?</h2><p>The customer will see that the order was cancelled. Give a reason so the action is clear and auditable.</p>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="e.g. Item is unavailable" rows={3} />
          <div className="modal-actions"><button className="btn outline" onClick={() => setRejecting(false)}>Keep order</button><button className="btn danger-button" disabled={busyId === selected?.id} onClick={rejectOrder}>Reject order</button></div>
        </div></div>}
      </main>
    </VendorShell>
  );
}

function OrderDrawer({ order, onClose, busy, action, onAction, onReject }: { order: Order; onClose: () => void; busy: boolean; action: { label: string; path: string } | null; onAction: () => void; onReject: () => void }) {
  const payment = order.payments?.[0];
  const rider = order.delivery?.rider;
  const address = [order.address?.addressLine1, order.address?.addressLine2, order.address?.city, order.address?.state].filter(Boolean).join(', ');
  return <div className="drawer-backdrop" onMouseDown={onClose}>
    <aside className="order-drawer" onMouseDown={e => e.stopPropagation()} aria-label={`Order ${order.orderNumber}`}>
      <header className="drawer-header"><div><span className="eyebrow">Order details</span><h2>#{order.orderNumber.replace(/^VEL-/, 'RZ')}</h2></div><button className="drawer-close" onClick={onClose} aria-label="Close order details">×</button></header>
      <div className="drawer-scroll">
        <div className="drawer-status-row"><span className={`status-badge status-${order.status.toLowerCase()}`}>{labelStatus(order.status)}</span><time>{new Date(order.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}</time></div>
        <section className="detail-section"><h3>Customer</h3><div className="customer-detail"><i>{initials(order.customer?.fullName)}</i><div><strong>{order.customer?.fullName || 'Customer'}</strong>{order.customer?.phone && <a href={`tel:${order.customer.phone}`}>{order.customer.phone}</a>}</div></div></section>
        <section className="detail-section"><h3>Items <span>{order.items.reduce((n, i) => n + i.quantity, 0)} units</span></h3><div className="detail-items">{order.items.map(item => <div className="detail-item" key={item.id}><div><strong>{item.nameSnapshot}</strong><span>{item.quantity} × {money(item.unitPriceSnapshot)}</span>{item.variantId && <small>Variant selected</small>}</div><strong>{money(item.subtotalAmount)}</strong></div>)}</div></section>
        <section className="detail-section"><h3>Payment</h3><div className="summary-lines"><span>Subtotal <b>{money(order.subtotalAmount)}</b></span><span>Delivery <b>{money(order.deliveryFeeAmount)}</b></span><span>Service fee <b>{money(order.serviceFeeAmount)}</b></span>{order.discountAmount > 0 && <span>Discount <b>-{money(order.discountAmount)}</b></span>}<span className="total-line">Total <b>{money(order.totalAmount)}</b></span></div><div className={`payment-state ${payment?.status === 'SUCCESS' ? 'paid' : ''}`}>{payment?.status === 'SUCCESS' ? '✓ Payment received' : `Payment ${payment?.status?.toLowerCase() || 'status unavailable'}`}</div></section>
        <section className="detail-section"><h3>{order.deliveryType === 'PICKUP' ? 'Pickup' : 'Delivery'}</h3>{address && <p className="detail-copy">{address}</p>}{order.customerNote && <div className="note-box"><b>Customer note</b><span>{order.customerNote}</span></div>}{rider && <div className="rider-card"><i>R</i><div><strong>{rider.user?.fullName || 'Assigned rider'}</strong><span>Rider assigned</span>{rider.user?.phone && <a href={`tel:${rider.user.phone}`}>{rider.user.phone}</a>}</div></div>}{!rider && order.deliveryType === 'DELIVERY' && <p className="muted">A rider has not been assigned yet.</p>}</section>
        <section className="detail-section"><h3>Order timeline</h3><div className="timeline">{(order.statusHistory || []).map((event, i) => <div className="timeline-item" key={`${event.createdAt}-${i}`}><i /><div><strong>{labelStatus(event.toStatus)}</strong><span>{new Date(event.createdAt).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })}{event.note ? ` · ${event.note}` : ''}</span></div></div>)}</div></section>
      </div>
      <footer className="drawer-footer">{order.status === 'PENDING_VENDOR' && <button className="btn danger-button ghost-danger" onClick={onReject} disabled={busy}>Reject</button>}{action && <button className="btn" onClick={onAction} disabled={busy}>{busy ? 'Updating...' : action.label}</button>}{!action && order.status !== 'PENDING_VENDOR' && <span className="drawer-complete-note">No vendor action required right now.</span>}</footer>
    </aside>
  </div>;
}
