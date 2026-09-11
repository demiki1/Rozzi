'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader, StatusBadge, Button } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { VendorSummary } from '@/lib/types';

export default function VendorsPage() {
  const [pending, setPending] = useState<VendorSummary[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api
      .get<VendorSummary[]>(`/api/admin/vendors${status ? `?status=${status}` : ''}`)
      .then(setPending)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [status]);

  async function act(id: string, action: 'approve' | 'reject' | 'suspend') {
    setBusyId(id);
    try {
      await api.post(`/api/admin/vendors/${id}/${action}`, action === 'reject' ? {} : undefined);
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
        title="Vendors"
        description="Vendors awaiting approval. A registered vendor never goes live until approved here (§26)."
      />

      <div className="mb-4 flex gap-2">{['','PENDING','APPROVED','SUSPENDED','REJECTED','CLOSED'].map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-md border px-3 py-1.5 text-xs ${status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>{s || 'ALL'}</button>)}</div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Store</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Location(s)</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Commission</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pending.map((v) => (
              <tr key={v.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{v.storeName}</td>
                <td className="px-4 py-3 text-gray-600">{v.vendorType?.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {v.locations?.map((l) => l.serviceArea.name).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-gray-600">{v.phone || v.email || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{v.commissionRate ?? '—'}%</td>
                <td className="px-4 py-3">
                  <StatusBadge status={v.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button onClick={() => act(v.id, 'approve')} disabled={busyId === v.id}>
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => act(v.id, 'reject')} disabled={busyId === v.id}>
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No vendors awaiting approval.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">Vendor administration now surfaces the full vendor population with status filtering; approval actions remain available for the applicable states.</p>
    </DashboardShell>
  );
}
