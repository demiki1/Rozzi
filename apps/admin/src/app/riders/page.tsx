'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader, StatusBadge, Button } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { RiderSummary } from '@/lib/types';

export default function RidersPage() {
  const [pending, setPending] = useState<RiderSummary[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    api
      .get<RiderSummary[]>(`/api/admin/riders${status ? `?status=${status}` : ''}`)
      .then(setPending)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [status]);

  async function act(id: string, action: 'start-review' | 'approve' | 'reject' | 'suspend') {
    setBusyId(id);
    try {
      await api.post(`/api/admin/riders/${id}/${action}`, action === 'reject' ? {} : undefined);
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
        title="Riders"
        description="Riders awaiting verification. Only approved riders can go online (§27)."
      />

      <div className="mb-4 flex gap-2">{['','PENDING','UNDER_REVIEW','APPROVED','ACTIVE','SUSPENDED'].map((s) => <button key={s} onClick={() => setStatus(s)} className={`rounded-md border px-3 py-1.5 text-xs ${status === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>{s || 'ALL'}</button>)}</div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Zones</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Online</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pending.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-800">{r.owner?.fullName}</td>
                <td className="px-4 py-3 text-gray-600">
                  {r.vehicleType}
                  {r.vehiclePlateNumber ? ` · ${r.vehiclePlateNumber}` : ''}
                </td>
                <td className="px-4 py-3 text-gray-600">{r.zones?.map((z) => z.serviceArea.name).join(', ') || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.owner?.phone || r.owner?.email || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.isOnline ? 'ONLINE' : 'OFFLINE'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    {r.status === 'PENDING' && (
                      <Button variant="secondary" onClick={() => act(r.id, 'start-review')} disabled={busyId === r.id}>
                        Start review
                      </Button>
                    )}
                    <Button onClick={() => act(r.id, 'approve')} disabled={busyId === r.id}>
                      Approve
                    </Button>
                    <Button variant="danger" onClick={() => act(r.id, 'reject')} disabled={busyId === r.id}>
                      Reject
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {pending.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No riders awaiting verification.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
