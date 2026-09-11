'use client';

import { FormEvent, useEffect, useState } from 'react';
import { DashboardShell, PageHeader } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';

type Setting = {
  key: string;
  value: unknown;
};

const SETTING_LABELS: Record<string, string> = {
  marketplaceName: 'Marketplace name',
  currency: 'Currency',
  minimumOrderAmount: 'Minimum order amount',
  defaultCommissionRate: 'Default commission rate (%)',
  dispatchAssignmentTimeoutSeconds: 'Dispatch assignment timeout (seconds)',
  dispatchMaxRiderDistanceKm: 'Maximum rider distance (km)',
  dispatchMaxAssignmentAttempts: 'Maximum assignment attempts',
};

const TEXT_FIELDS = new Set(['marketplaceName', 'currency']);

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const rows = await api.get<Setting[]>('/api/admin/settings');

      setSettings(rows);

      const next: Record<string, string> = {};

      rows.forEach((row) => {
        const keyMap: Record<string, string> = {
          'dispatch.assignmentTimeoutSeconds':
            'dispatchAssignmentTimeoutSeconds',
          'dispatch.maxRiderDistanceKm': 'dispatchMaxRiderDistanceKm',
          'dispatch.maxAssignmentAttempts':
            'dispatchMaxAssignmentAttempts',
        };

        const key = keyMap[row.key] || row.key;
        next[key] = String(row.value ?? '');
      });

      setForm(next);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to load marketplace settings.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateField = (key: string, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
    setSaved(false);
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();

    setSaved(false);
    setError('');
    setSaving(true);

    try {
      await api.patch('/api/admin/settings', {
        marketplaceName: form.marketplaceName,
        currency: form.currency,

        // Minimum order remains a general marketplace/service-area
        // operational setting for now.
        minimumOrderAmount: Number(form.minimumOrderAmount || 0),

        defaultCommissionRate: Number(
          form.defaultCommissionRate || 10,
        ),

        ordersEnabled: form.ordersEnabled === 'true',
        customerRegistrationEnabled:
          form.customerRegistrationEnabled !== 'false',
        vendorRegistrationEnabled:
          form.vendorRegistrationEnabled !== 'false',
        riderRegistrationEnabled:
          form.riderRegistrationEnabled !== 'false',

        dispatchAssignmentTimeoutSeconds: Number(
          form.dispatchAssignmentTimeoutSeconds || 60,
        ),
        dispatchMaxRiderDistanceKm: Number(
          form.dispatchMaxRiderDistanceKm || 8,
        ),
        dispatchMaxAssignmentAttempts: Number(
          form.dispatchMaxAssignmentAttempts || 5,
        ),
      });

      setSaved(true);
      await load();
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Unable to save marketplace settings.',
      );
    } finally {
      setSaving(false);
    }
  };

  const visibleFields = [
    'marketplaceName',
    'currency',
    'minimumOrderAmount',
    'defaultCommissionRate',
    'dispatchAssignmentTimeoutSeconds',
    'dispatchMaxRiderDistanceKm',
    'dispatchMaxAssignmentAttempts',
  ];

  return (
    <DashboardShell>
      <PageHeader
        title="Marketplace Settings"
        description="General platform configuration. Pricing is managed separately in Settings → Pricing."
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Settings saved successfully.
        </div>
      )}

      <div className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <strong>Pricing:</strong> Service fee, delivery pricing, delivery
        radius, and surge settings are managed from the dedicated Pricing
        page. This keeps pricing versioned and prevents general settings from
        overriding checkout pricing.
      </div>

      <form
        onSubmit={save}
        className="max-w-4xl space-y-6 rounded-xl border border-gray-200 bg-white p-6"
      >
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              Marketplace
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Basic marketplace configuration.
            </p>
          </div>

          {loading ? (
            <div className="py-8 text-sm text-gray-500">
              Loading settings...
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleFields.map((key) => (
                <label
                  key={key}
                  className="text-sm font-medium text-gray-700"
                >
                  {SETTING_LABELS[key] || key}

                  <input
                    type={TEXT_FIELDS.has(key) ? 'text' : 'number'}
                    value={form[key] || ''}
                    onChange={(event) =>
                      updateField(key, event.target.value)
                    }
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  />
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="border-t border-gray-100 pt-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              Platform availability
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Control which account types can currently register.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {[
              ['ordersEnabled', 'Orders enabled'],
              [
                'customerRegistrationEnabled',
                'Customer registration enabled',
              ],
              [
                'vendorRegistrationEnabled',
                'Vendor registration enabled',
              ],
              [
                'riderRegistrationEnabled',
                'Rider registration enabled',
              ],
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700"
              >
                <input
                  type="checkbox"
                  checked={form[key] !== 'false'}
                  onChange={(event) =>
                    updateField(key, String(event.target.checked))
                  }
                  className="h-4 w-4"
                />

                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>

        <div className="flex justify-end border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={loading || saving}
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </div>
      </form>
    </DashboardShell>
  );
}