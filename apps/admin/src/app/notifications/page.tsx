'use client';
import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { onNotification } from '@/lib/realtime';

export default function NotificationsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.get<any[]>('/api/notifications/mine').then(x => alive && setItems(x || [])).catch(e => alive && setError(e.message));
    load();
    const off = onNotification(n => setItems(prev => [n, ...prev.filter(x => x.id !== n.id)].slice(0, 100)));
    return () => { alive = false; off(); };
  }, []);
  async function read(id:string){await api.patch(`/api/notifications/${id}/read`);setItems(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n));}
  async function readAll(){await api.patch('/api/notifications/read-all');setItems(x=>x.map(n=>({...n,readAt:n.readAt||new Date().toISOString()})));}
  return <DashboardShell><PageHeader title="Notifications" description="Operational, order, finance and account alerts."/><div className="mb-4 flex justify-end"><button onClick={readAll} className="rounded-md border px-3 py-1.5 text-sm">Mark all as read</button></div>{error&&<p className="mb-4 text-sm text-red-600">{error}</p>}<div className="space-y-3">{items.length===0?<div className="rounded-xl border bg-white p-8 text-center text-gray-400">No notifications yet.</div>:items.map(n=><article key={n.id} onClick={()=>!n.readAt&&read(n.id)} className={`cursor-pointer rounded-xl border bg-white p-4 ${n.readAt?'':'border-brand-200'}`}><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{n.title}</h3><p className="mt-1 text-sm text-gray-600">{n.message}</p></div>{!n.readAt&&<span className="mt-1 h-2 w-2 rounded-full bg-brand-600"/>}</div><small className="mt-2 block text-gray-400">{new Date(n.createdAt).toLocaleString()}</small></article>)}</div></DashboardShell>;
}
