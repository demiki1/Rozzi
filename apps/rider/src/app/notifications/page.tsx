'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { onNotification } from '../../lib/realtime';

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => api('/api/notifications/mine').then(x => alive && setItems(x || [])).catch(e => alive && setError(e.message || 'Unable to load notifications.'));
    load();
    const off = onNotification(n => setItems(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 100)));
    return () => { alive = false; off(); };
  }, []);
  async function read(id: string) { await api(`/api/notifications/${id}/read`, { method: 'PATCH' }); setItems(x => x.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n)); }
  async function readAll() { await api('/api/notifications/read-all', { method: 'PATCH' }); setItems(x => x.map(n => ({ ...n, readAt: n.readAt || new Date().toISOString() }))); }
  return <main className="shell"><Link href="/">← Dashboard</Link><div className="page-heading"><div><span className="eyebrow">Rider workspace</span><h1>Notifications</h1><p>Order, delivery, payment and account updates.</p></div><button className="btn" onClick={readAll}>Mark all as read</button></div>{error && <div className="error">{error}</div>}{items.length===0 ? <div className="card muted">No notifications yet.</div> : items.map(n=><article key={n.id} className={`card ${n.readAt?'':'unread'}`} onClick={()=>!n.readAt&&read(n.id)}><strong>{n.title}</strong><p>{n.message}</p><small className="muted">{new Date(n.createdAt).toLocaleString()}</small></article>)}</main>;
}
