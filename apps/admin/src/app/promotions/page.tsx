'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';

interface Promotion {
  id: string;
  code: string;
  name: string;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  vendorId: string | null;
}

function formatAmount(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function PromotionsPage() {
  const [rows, setRows] = useState<Promotion[]>([]);
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      setError('');
      setRows(await api.get<Promotion[]>('/api/admin/promotions'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to load promotions.');
    }
  };

  useEffect(() => { void load(); }, []);

  async function add() {
    try {
      setError('');
      await api.post('/api/admin/promotions', {
        code: code.trim().toUpperCase(),
        name: code.trim().toUpperCase(),
        type: 'FIXED_AMOUNT',
        value: Number(amount),
        startsAt: new Date().toISOString(),
        endsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      setCode('');
      setAmount('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to create promotion.');
    }
  }

  async function deactivate(id: string) {
    if (busy) return;
    setBusy(id);
    try {
      setError('');
      await api.post(`/api/admin/promotions/${id}/deactivate`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unable to deactivate promotion.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <DashboardShell>
      <PageHeader title="Promotions & Coupons" description="Create and manage marketplace promotional codes. Marketplace promotions are ROZZI-funded; vendor promotions remain vendor-funded." />

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-5 flex gap-2 rounded-xl border bg-white p-5">
        <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="CODE" className="rounded border p-2" />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Discount (kobo)" className="rounded border p-2" inputMode="numeric" />
        <button disabled={!code.trim() || !amount || Number(amount) <= 0} onClick={() => void add()} className="rounded bg-brand-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">Create</button>
      </div>

      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border bg-white p-3 text-sm">
            <div>
              <b>{r.code}</b>
              <div className="mt-1 text-gray-600">
                {r.type === 'PERCENTAGE' ? `${r.value}%` : formatAmount(r.value)} discount
                {' · '}
                {r.vendorId ? 'Vendor-funded' : 'ROZZI-funded'}
                {' · '}
                {r.isActive ? 'Active' : 'Inactive'}
              </div>
            </div>
            {r.isActive && <button onClick={() => void deactivate(r.id)} disabled={busy === r.id} className="rounded border px-3 py-1.5 text-xs text-gray-700 disabled:opacity-50">Deactivate</button>}
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border bg-white p-5 text-sm text-gray-500">No promotions found.</div>}
      </div>
    </DashboardShell>
  );
}
