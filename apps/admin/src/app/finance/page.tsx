'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader, Button } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { formatNaira } from '@/lib/format';

interface Summary {
  gmv: number;
  platformRevenue: number;
  deliveryRevenue: number;
  riderPayouts: number;
  refunds: number;
  paymentFees: number;
  netContribution: number;
  pendingVendorSettlements: number;
  pendingRiderPayouts: number;
  averageOrderValue: number;
  orderCounts: { total: number; delivered: number; cancelled: number; failed: number };
}

interface PendingBalance {
  vendorId?: string;
  riderId?: string;
  storeName?: string;
  name?: string;
  pendingBalance: number;
}

type RangePreset = 'today' | '7d' | '30d';

function rangeFor(preset: RangePreset): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (preset === 'today') from.setHours(0, 0, 0, 0);
  if (preset === '7d') from.setDate(from.getDate() - 7);
  if (preset === '30d') from.setDate(from.getDate() - 30);
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function FinancePage() {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vendorBalances, setVendorBalances] = useState<PendingBalance[]>([]);
  const [riderBalances, setRiderBalances] = useState<PendingBalance[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    const { from, to } = rangeFor(preset);
    api
      .get<Summary>(`/api/admin/reports/summary?from=${from}&to=${to}`)
      .then(setSummary)
      .catch((e) => setError(e.message));
    api
      .get<PendingBalance[]>('/api/admin/settlements/vendors')
      .then(setVendorBalances)
      .catch((e) => setError(e.message));
    api
      .get<PendingBalance[]>('/api/admin/settlements/riders')
      .then(setRiderBalances)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [preset]);

  async function settleVendor(id: string) {
    setBusyId(id);
    try {
      await api.post(`/api/admin/settlements/vendors/${id}/settle`);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  async function payRider(id: string) {
    setBusyId(id);
    try {
      await api.post(`/api/admin/settlements/riders/${id}/pay`);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Finance"
        description="Reports are derived from the append-only ledger, not stored balances (§35) — settling here records that a payout happened outside this system; it doesn't execute a bank transfer (§77)."
      />

      <div className="mb-4 flex gap-2">
        {(['today', '7d', '30d'] as RangePreset[]).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              preset === p ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p === 'today' ? 'Today' : p === '7d' ? 'Last 7 days' : 'Last 30 days'}
          </button>
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {summary && (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">GMV (delivered orders)</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.gmv)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Platform revenue</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.platformRevenue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Delivery revenue</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.deliveryRevenue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Rider payouts (earned)</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.riderPayouts)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Payment fees</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.paymentFees)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Net contribution</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.netContribution)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Avg order value</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.averageOrderValue)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Delivered</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{summary.orderCounts.delivered}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Cancelled</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{summary.orderCounts.cancelled}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">Refunds</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{formatNaira(summary.refunds)}</p>
            
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Pending vendor settlements</h2>
          <ul className="divide-y divide-gray-100">
            {vendorBalances.map((v) => (
              <li key={v.vendorId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-gray-800">{v.storeName}</p>
                  <p className="text-xs text-gray-400">{formatNaira(v.pendingBalance)} pending</p>
                </div>
                <Button onClick={() => settleVendor(v.vendorId!)} disabled={busyId === v.vendorId}>
                  Mark settled
                </Button>
              </li>
            ))}
            {vendorBalances.length === 0 && <li className="py-4 text-sm text-gray-400">No pending balances.</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Pending rider payouts</h2>
          <ul className="divide-y divide-gray-100">
            {riderBalances.map((r) => (
              <li key={r.riderId} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="text-gray-800">{r.name}</p>
                  <p className="text-xs text-gray-400">{formatNaira(r.pendingBalance)} pending</p>
                </div>
                <Button onClick={() => payRider(r.riderId!)} disabled={busyId === r.riderId}>
                  Mark paid
                </Button>
              </li>
            ))}
            {riderBalances.length === 0 && <li className="py-4 text-sm text-gray-400">No pending balances.</li>}
          </ul>
        </div>
      </div>
    </DashboardShell>
  );
}
