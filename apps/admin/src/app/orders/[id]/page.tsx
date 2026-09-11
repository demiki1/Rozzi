'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardShell, PageHeader, StatusBadge } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { formatNaira } from '@/lib/format';

interface OrderDetail {
  id: string;
  orderNumber: string;
  status: string;
  deliveryType: string;
  subtotalAmount: number;
  deliveryFeeAmount: number;
  serviceFeeAmount: number;
  discountAmount: number;
  totalAmount: number;
  customerNote: string | null;
  cancelReason: string | null;
  vendor: { storeName: string; phone: string | null };
  address: { addressText: string; landmark: string | null } | null;
  items: { id: string; nameSnapshot: string; quantity: number; unitPriceSnapshot: number; subtotalAmount: number }[];
  statusHistory: { id: string; toStatus: string; createdAt: string; note: string | null }[];
  delivery?: { id: string; assignedAt?: string | null; pickedUpAt?: string | null; deliveredAt?: string | null; rider?: { id: string; owner?: { fullName?: string | null; phone?: string | null } | null } | null } | null;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => api
      .get<OrderDetail>(`/api/orders/${id}`)
      .then((value) => { if (active) { setOrder(value); setError(null); } })
      .catch((e) => { if (active) setError(e.message); });
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id]);

  if (error) {
    return (
      <DashboardShell>
        <p className="text-sm text-red-600">{error}</p>
      </DashboardShell>
    );
  }

  if (!order) {
    return (
      <DashboardShell>
        <p className="text-sm text-gray-500">Loading…</p>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader title={`Order ${order.orderNumber}`} description={order.vendor.storeName} />

      <div className="mb-6 flex items-center gap-3">
        <StatusBadge status={order.status} />
        <span className="text-sm text-gray-500">{order.deliveryType}</span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">Items</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-100">
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 text-gray-700">
                      {item.nameSnapshot} × {item.quantity}
                    </td>
                    <td className="py-2 text-right text-gray-700">{formatNaira(item.subtotalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 space-y-1 border-t border-gray-100 pt-3 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Subtotal</span>
                <span>{formatNaira(order.subtotalAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Delivery fee</span>
                <span>{formatNaira(order.deliveryFeeAmount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Service fee</span>
                <span>{formatNaira(order.serviceFeeAmount)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Discount</span>
                  <span>-{formatNaira(order.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-gray-100 pt-1 font-semibold text-gray-900">
                <span>Total</span>
                <span>{formatNaira(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {order.address && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Delivery address</h2>
              <p className="text-sm text-gray-700">{order.address.addressText}</p>
              {order.address.landmark && <p className="text-sm text-gray-500">{order.address.landmark}</p>}
            </div>
          )}

          {order.customerNote && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">Customer note</h2>
              <p className="text-sm text-gray-700">{order.customerNote}</p>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Delivery bridge</h2>
            {order.delivery ? (
              <div className="space-y-1 text-sm text-gray-700">
                <p>Rider: {order.delivery.rider?.owner?.fullName || 'Searching / not assigned yet'}</p>
                {order.delivery.rider?.owner?.phone && <p>Phone: {order.delivery.rider.owner.phone}</p>}
                {order.delivery.assignedAt && <p>Assigned: {new Date(order.delivery.assignedAt).toLocaleString()}</p>}
                {order.delivery.pickedUpAt && <p>Picked up: {new Date(order.delivery.pickedUpAt).toLocaleString()}</p>}
                {order.delivery.deliveredAt && <p>Delivered: {new Date(order.delivery.deliveredAt).toLocaleString()}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No platform delivery record yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Timeline</h2>
          <ol className="space-y-3">
            {order.statusHistory.map((h) => (
              <li key={h.id} className="text-sm">
                <p className="font-medium text-gray-800">{h.toStatus.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-400">{new Date(h.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </DashboardShell>
  );
}
