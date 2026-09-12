'use client';

import { useEffect, useState } from 'react';
import { DashboardShell, PageHeader, Button } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';

type Customer = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setCustomers(await api.get<Customer[]>('/api/account/admin/customers'));
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
  }

  useEffect(() => { void load(); }, []);

  async function toggle(customer: Customer) {
    try {
      await api.patch(`/api/account/admin/customers/${customer.id}/status`, { isActive: !customer.isActive });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <DashboardShell>
      <PageHeader title="Customers" description="Review customer accounts and control account access." />
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Verification</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-4"><div className="font-semibold text-gray-900">{customer.fullName}</div><div className="text-xs text-gray-500">Joined {new Date(customer.createdAt).toLocaleDateString()}</div></td>
                  <td className="px-4 py-4 text-gray-600">{customer.email || customer.phone || '—'}</td>
                  <td className="px-4 py-4 text-xs text-gray-600">{customer.isEmailVerified || customer.isPhoneVerified ? 'Verified' : 'Unverified'}</td>
                  <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${customer.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{customer.isActive ? 'Active' : 'Inactive'}</span></td>
                  <td className="px-4 py-4 text-right"><Button variant={customer.isActive ? 'secondary' : 'primary'} onClick={() => toggle(customer)}>{customer.isActive ? 'Deactivate' : 'Activate'}</Button></td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No customers found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
