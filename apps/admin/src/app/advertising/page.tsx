'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DashboardShell, PageHeader, Button } from '../../components/dashboard-shell';
import { api } from '../../lib/api-client';

type CreativeKind = 'banner' | 'ad';

type Creative = {
  id: string;
  title: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
  targetUrl?: string | null;
  placement: string;
  displayOrder: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  impressions?: number;
  clicks?: number;
};

const emptyForm = {
  title: '', imageUrl: '', mobileImageUrl: '', targetUrl: '', placement: 'HOME',
  displayOrder: '0', isActive: true, startsAt: '', endsAt: '',
};

function toInputDate(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

export default function Advertising() {
  const [banners, setBanners] = useState<Creative[]>([]);
  const [ads, setAds] = useState<Creative[]>([]);
  const [kind, setKind] = useState<CreativeKind>('banner');
  const [editing, setEditing] = useState<{ kind: CreativeKind; id: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const [b, a] = await Promise.all([
        api.get<Creative[]>('/api/advertising/admin/banners'),
        api.get<Creative[]>('/api/advertising/admin/ads'),
      ]);
      setBanners(b); setAds(a);
    } catch (e: any) { setError(e.message || 'Unable to load advertising.'); }
  }

  useEffect(() => { void load(); }, []);

  function startCreate(nextKind: CreativeKind) {
    setKind(nextKind); setEditing(null); setForm(emptyForm); setError('');
  }

  function startEdit(nextKind: CreativeKind, item: Creative) {
    setKind(nextKind); setEditing({ kind: nextKind, id: item.id });
    setForm({
      title: item.title || '', imageUrl: item.imageUrl || '', mobileImageUrl: item.mobileImageUrl || '',
      targetUrl: item.targetUrl || '', placement: item.placement || 'HOME',
      displayOrder: String(item.displayOrder ?? 0), isActive: item.isActive,
      startsAt: toInputDate(item.startsAt), endsAt: toInputDate(item.endsAt),
    });
    setError('');
  }

  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      if (!form.title.trim() || !form.imageUrl.trim() || !form.startsAt || !form.endsAt) throw new Error('Title, image URL, start time and end time are required.');
      const payload: Record<string, unknown> = {
        title: form.title.trim(), imageUrl: form.imageUrl.trim(), targetUrl: form.targetUrl.trim() || null,
        placement: form.placement.trim().toUpperCase(), displayOrder: Number(form.displayOrder) || 0,
        isActive: form.isActive, startsAt: toIso(form.startsAt), endsAt: toIso(form.endsAt),
      };
      if (kind === 'banner' && form.mobileImageUrl.trim()) payload.mobileImageUrl = form.mobileImageUrl.trim();
      const base = kind === 'banner' ? '/api/advertising/admin/banners' : '/api/advertising/admin/ads';
      if (editing?.id) await api.patch(`${base}/${editing.id}`, payload);
      else await api.post(base, payload);
      setForm(emptyForm); setEditing(null); await load();
    } catch (e: any) { setError(e.message || 'Unable to save.'); }
    finally { setBusy(false); }
  }

  async function remove(nextKind: CreativeKind, id: string) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    setBusy(true); setError('');
    try {
      const base = nextKind === 'banner' ? '/api/advertising/admin/banners' : '/api/advertising/admin/ads';
      await api.delete(`${base}/${id}`); await load();
      if (editing?.id === id) { setEditing(null); setForm(emptyForm); }
    } catch (e: any) { setError(e.message || 'Unable to delete.'); }
    finally { setBusy(false); }
  }

  async function toggle(nextKind: CreativeKind, item: Creative) {
    setBusy(true); setError('');
    try {
      const base = nextKind === 'banner' ? '/api/advertising/admin/banners' : '/api/advertising/admin/ads';
      await api.patch(`${base}/${item.id}`, { isActive: !item.isActive }); await load();
    } catch (e: any) { setError(e.message || 'Unable to update status.'); }
    finally { setBusy(false); }
  }

  function Editor() {
    return <form onSubmit={save} className="rounded border p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between"><h2 className="font-semibold">{editing ? 'Edit' : 'Create'} {kind === 'banner' ? 'Banner' : 'Advertisement'}</h2><Button type="button" variant="secondary" onClick={() => { setEditing(null); setForm(emptyForm); }}>Clear</Button></div>
      <div className="grid gap-3 md:grid-cols-2">
        <label>Title<input className="mt-1 w-full rounded border p-2" value={form.title} onChange={e => setForm({...form,title:e.target.value})} /></label>
        <label>Placement<input className="mt-1 w-full rounded border p-2" value={form.placement} onChange={e => setForm({...form,placement:e.target.value})} placeholder="HOME" /></label>
        <label>Image URL<input className="mt-1 w-full rounded border p-2" value={form.imageUrl} onChange={e => setForm({...form,imageUrl:e.target.value})} /></label>
        {kind === 'banner' && <label>Mobile image URL<input className="mt-1 w-full rounded border p-2" value={form.mobileImageUrl} onChange={e => setForm({...form,mobileImageUrl:e.target.value})} /></label>}
        <label>Target URL<input className="mt-1 w-full rounded border p-2" value={form.targetUrl} onChange={e => setForm({...form,targetUrl:e.target.value})} placeholder="https://..." /></label>
        <label>Display order<input type="number" className="mt-1 w-full rounded border p-2" value={form.displayOrder} onChange={e => setForm({...form,displayOrder:e.target.value})} /></label>
        <label>Starts<input type="datetime-local" className="mt-1 w-full rounded border p-2" value={form.startsAt} onChange={e => setForm({...form,startsAt:e.target.value})} /></label>
        <label>Ends<input type="datetime-local" className="mt-1 w-full rounded border p-2" value={form.endsAt} onChange={e => setForm({...form,endsAt:e.target.value})} /></label>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={e => setForm({...form,isActive:e.target.checked})} /> Active</label>
      <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : `Create ${kind === 'banner' ? 'banner' : 'advertisement'}`}</Button>
    </form>;
  }

  function List({ title, nextKind, items }: { title: string; nextKind: CreativeKind; items: Creative[] }) {
    return <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="font-semibold">{title}</h2><Button onClick={() => startCreate(nextKind)}>+ New</Button></div>{items.length === 0 ? <p className="text-sm text-gray-500">No items yet.</p> : <div className="space-y-2">{items.map(x => <div key={x.id} className="rounded border p-3 flex gap-3 justify-between items-center"><div className="min-w-0"><b>{x.title}</b><div className="text-xs text-gray-500">{x.placement} · order {x.displayOrder} · {x.isActive?'Active':'Inactive'} · {new Date(x.startsAt).toLocaleString()} → {new Date(x.endsAt).toLocaleString()}</div>{nextKind==='ad' && <div className="text-xs text-gray-500">{x.impressions ?? 0} impressions · {x.clicks ?? 0} clicks</div>}</div><div className="flex gap-2 shrink-0"><Button onClick={() => startEdit(nextKind,x)} variant="secondary">Edit</Button><Button onClick={() => toggle(nextKind,x)} variant="secondary">{x.isActive?'Disable':'Enable'}</Button><Button onClick={() => remove(nextKind,x.id)} variant="secondary">Delete</Button></div></div>)}</div>}</section>;
  }

  return <DashboardShell><PageHeader title="Banners & Ads" description="Create, schedule, publish and manage marketplace advertising." />{error && <p className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm">{error}</p>}<div className="space-y-8">{Editor()}<List title="Banners" nextKind="banner" items={banners} /><List title="Advertisements" nextKind="ad" items={ads} /></div></DashboardShell>;
}
