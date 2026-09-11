'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader, StatusBadge, Button } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { onOrderStatus } from '@/lib/realtime';

interface DeliveryRow {
  id: string;
  orderId: string;
  order?: { orderNumber: string; status: string };
  rider?: { owner?: { fullName?: string | null; phone?: string | null } | null } | null;
  assignedAt?: string | null;
}

export default function DeliveriesPage() {
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => api.get<DeliveryRow[]>('/api/admin/deliveries').then(setRows).catch((e) => setError(e.message));

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 10000);
    const off = onOrderStatus(() => load());
    return () => { window.clearInterval(timer); off(); };
  }, []);

  async function reassign(id: string) {
    setBusy(id);
    try { await api.post(`/api/admin/deliveries/${id}/reassign`); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }

  async function sweep() {
    setBusy('sweep');
    try { await api.post('/api/admin/deliveries/sweep-timeouts'); await load(); }
    catch (e: any) { setError(e.message); }
    finally { setBusy(null); }
  }

  return (
    <DashboardShell>
      <PageHeader title="Deliveries" description="Operational view of rider dispatch, assignment and delivery progress." />
      <div className="mb-4 flex justify-end"><Button variant="secondary" onClick={sweep} disabled={busy !== null}>Sweep expired offers</Button></div>
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500"><tr>
            <th className="px-4 py-3">Order</th><th className="px-4 py-3">Rider</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assigned</th><th className="px-4 py-3 text-right">Action</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((d) => <tr key={d.id}>
              <td className="px-4 py-3 font-medium">{d.order?.orderNumber || d.orderId}</td>
              <td className="px-4 py-3 text-gray-600">{d.rider?.owner?.fullName || 'Searching'}</td>
              <td className="px-4 py-3"><StatusBadge status={d.order?.status || 'RIDER_SEARCHING'} /></td>
              <td className="px-4 py-3 text-gray-500">{d.assignedAt ? new Date(d.assignedAt).toLocaleString() : '—'}</td>
              <td className="px-4 py-3 text-right">{d.order?.status === 'RIDER_ASSIGNED' && <Button variant="secondary" onClick={() => reassign(d.id)} disabled={busy !== null}>Reassign</Button>}</td>
            </tr>)}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No deliveries found.</td></tr>}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}