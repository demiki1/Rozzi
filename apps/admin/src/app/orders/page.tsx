'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardShell, PageHeader, StatusBadge } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { formatNaira } from '@/lib/format';
import { OrderSummary, OrderStatus } from '@/lib/types';
import { onOrderStatus } from '@/lib/realtime';

const STATUS_OPTIONS: OrderStatus[] = [
  'PENDING_PAYMENT',
  'PAID',
  'PENDING_VENDOR',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'RIDER_SEARCHING',
  'RIDER_ASSIGNED',
  'RIDER_ARRIVED_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'RIDER_ARRIVED',
  'DELIVERED',
  'CANCELLED',
  'FAILED',
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      setLoading(true);
      const qs = status ? `?status=${status}` : '';
      api
        .get<OrderSummary[]>(`/api/admin/orders${qs}`)
        .then((rows) => { if (active) { setOrders(rows); setError(null); } })
        .catch((e) => { if (active) setError(e.message); })
        .finally(() => { if (active) setLoading(false); });
    };
    load();
    const timer = window.setInterval(load, 15000);
    const off = onOrderStatus(() => load());
    return () => { active = false; window.clearInterval(timer); off(); };
  }, [status]);

  return (
    <DashboardShell>
      <PageHeader title="Orders" description="All orders across every vendor and location." />

      <div className="mb-4 flex items-center gap-3">
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Placed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-medium text-brand-700 hover:underline">
                    {o.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{o.customer?.fullName}</td>
                <td className="px-4 py-3 text-gray-700">{o.vendor?.storeName}</td>
                <td className="px-4 py-3 text-gray-700">{formatNaira(o.totalAmount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={o.status} />
                </td>
                <td className="px-4 py-3 text-gray-400">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No orders found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
