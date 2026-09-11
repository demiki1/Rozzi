'use client';

import { useEffect, useState } from 'react';

import {
  DashboardShell,
  PageHeader,
  SectionCard,
  StatusBadge,
  Button,
} from '@/components/dashboard-shell';

import { api } from '@/lib/api-client';

type ReferralConfig = {
  id: string;
  isActive: boolean;
  rewardRatePercent: number | string;
  maxRewardAmount: number;
  minimumTransactionAmount: number;
  holdDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
};

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  actor?: {
    fullName?: string | null;
    email?: string | null;
  } | null;
  before?: unknown;
  after?: unknown;
  createdAt: string;
};

type ConfigResponse = {
  current: ReferralConfig;
  history: ReferralConfig[];
  audit: AuditEntry[];
};

const toNaira = (kobo: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(kobo / 100);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export default function ReferralSettingsPage() {
  const [data, setData] = useState<ConfigResponse | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [rewardRate, setRewardRate] = useState('4');
  const [maxReward, setMaxReward] = useState('500');
  const [minimumTransaction, setMinimumTransaction] = useState('5000');
  const [holdDuration, setHoldDuration] = useState('10');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api.get<ConfigResponse>(
        '/api/admin/referrals/config',
      );

      setData(result);

      if (result.current) {
        setIsActive(result.current.isActive);
        setRewardRate(
          String(result.current.rewardRatePercent),
        );
        setMaxReward(
          String(result.current.maxRewardAmount / 100),
        );
        setMinimumTransaction(
          String(result.current.minimumTransactionAmount / 100),
        );
        setHoldDuration(
          String(result.current.holdDurationMinutes),
        );
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load referral settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');

    try {
      const rewardRateNumber = Number(rewardRate);
      const maxRewardNaira = Number(maxReward);
      const minimumNaira = Number(minimumTransaction);
      const holdMinutes = Number(holdDuration);

      if (
        !Number.isFinite(rewardRateNumber) ||
        rewardRateNumber < 0 ||
        rewardRateNumber > 100
      ) {
        throw new Error(
          'Reward rate must be between 0% and 100%.',
        );
      }

      if (
        !Number.isInteger(maxRewardNaira) ||
        maxRewardNaira < 1
      ) {
        throw new Error(
          'Maximum reward must be a whole naira amount greater than zero.',
        );
      }

      if (
        !Number.isInteger(minimumNaira) ||
        minimumNaira < 1
      ) {
        throw new Error(
          'Minimum transaction must be a whole naira amount greater than zero.',
        );
      }

      if (
        !Number.isInteger(holdMinutes) ||
        holdMinutes < 0
      ) {
        throw new Error(
          'Hold duration must be a whole number of minutes.',
        );
      }

      await api.patch('/api/admin/referrals/config', {
        isActive,
        rewardRatePercent: rewardRateNumber,
        maxRewardAmountKobo: maxRewardNaira * 100,
        minimumTransactionAmountKobo:
          minimumNaira * 100,
        holdDurationMinutes: holdMinutes,
      });

      setSaved(true);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to save referral settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <PageHeader
          title="Refer & Earn"
          description="Configure the ROZZI customer referral programme."
        />

        <SectionCard>
          <p className="text-sm text-gray-500">
            Loading referral configuration…
          </p>
        </SectionCard>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="GROWTH / REFERRALS"
        title="Refer & Earn"
        description="Control the customer referral programme, reward rules, hold period, and configuration history."
      />

      {error && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Referral programme configuration saved successfully.
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionCard>
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Programme configuration
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Changes create a new configuration version.
                Existing referrals retain their original terms.
              </p>
            </div>

            {isActive ? (
              <StatusBadge status="ACTIVE" />
            ) : (
              <StatusBadge status="PAUSED" />
            )}
          </div>

          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
              <div>
                <div className="font-medium text-gray-900">
                  Refer & Earn programme
                </div>

                <div className="mt-1 text-sm text-gray-500">
                  Allow new customers to register through referral links.
                </div>
              </div>

              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) =>
                  setIsActive(e.target.checked)
                }
                className="h-5 w-5"
              />
            </label>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm font-medium text-gray-700">
                Reward rate (%)
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={rewardRate}
                  onChange={(e) =>
                    setRewardRate(e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5"
                />

                <span className="mt-1 block text-xs text-gray-500">
                  Default: 4%
                </span>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Maximum reward (₦)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxReward}
                  onChange={(e) =>
                    setMaxReward(e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5"
                />

                <span className="mt-1 block text-xs text-gray-500">
                  Default: ₦500
                </span>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Minimum qualifying transaction (₦)
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={minimumTransaction}
                  onChange={(e) =>
                    setMinimumTransaction(e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5"
                />

                <span className="mt-1 block text-xs text-gray-500">
                  Must be met by one transaction, not cumulatively.
                </span>
              </label>

              <label className="text-sm font-medium text-gray-700">
                Reward hold (minutes)
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={holdDuration}
                  onChange={(e) =>
                    setHoldDuration(e.target.value)
                  }
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2.5"
                />

                <span className="mt-1 block text-xs text-gray-500">
                  Default: 10 minutes after verification.
                </span>
              </label>
            </div>

            <div className="flex justify-end border-t border-gray-100 pt-5">
              <Button
                type="button"
                onClick={() => void save()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save configuration'}
              </Button>
            </div>
          </div>
        </SectionCard>

        <SectionCard>
          <h2 className="text-lg font-semibold text-gray-900">
            Current reward example
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Based on the current configuration.
          </p>

          <div className="mt-5 space-y-3">
            {[5000, 6000, 10000, 12500].map(
              (amount) => {
                const reward = Math.min(
                  Math.floor(
                    amount *
                      (Number(rewardRate) / 100),
                  ),
                  Number(maxReward) || 0,
                );

                return (
                  <div
                    key={amount}
                    className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
                  >
                    <span className="text-sm text-gray-600">
                      ₦{amount.toLocaleString('en-NG')}
                    </span>

                    <strong className="text-sm text-gray-900">
                      ₦{reward.toLocaleString('en-NG')}
                    </strong>
                  </div>
                );
              },
            )}
          </div>

          <div className="mt-5 rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800">
            The qualifying amount is the eligible merchandise
            value of a single completed transaction. Delivery
            and service fees are excluded.
          </div>
        </SectionCard>
      </div>

      <SectionCard className="mt-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Configuration history
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Historical versions are preserved so existing referrals
            remain governed by the terms captured at registration.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-3">Created</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Rate</th>
                <th className="px-3 py-3">Cap</th>
                <th className="px-3 py-3">Minimum</th>
                <th className="px-3 py-3">Hold</th>
              </tr>
            </thead>

            <tbody>
              {data?.history?.map((config) => (
                <tr
                  key={config.id}
                  className="border-b border-gray-100"
                >
                  <td className="px-3 py-4 text-gray-600">
                    {formatDate(config.createdAt)}
                  </td>

                  <td className="px-3 py-4">
                    <StatusBadge
                      status={
                        config.isActive
                          ? 'ACTIVE'
                          : 'INACTIVE'
                      }
                    />
                  </td>

                  <td className="px-3 py-4 font-medium">
                    {config.rewardRatePercent}%
                  </td>

                  <td className="px-3 py-4">
                    {toNaira(config.maxRewardAmount)}
                  </td>

                  <td className="px-3 py-4">
                    {toNaira(
                      config.minimumTransactionAmount,
                    )}
                  </td>

                  <td className="px-3 py-4">
                    {config.holdDurationMinutes} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard className="mt-5">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-gray-900">
            Administrative audit trail
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Configuration changes are recorded with the previous
            and new values.
          </p>
        </div>

        <div className="space-y-3">
          {data?.audit?.length ? (
            data.audit.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border border-gray-200 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-sm text-gray-900">
                      Referral configuration changed
                    </strong>

                    <p className="mt-1 text-xs text-gray-500">
                      {entry.actor?.fullName ||
                        entry.actor?.email ||
                        'Administrator'}
                    </p>
                  </div>

                  <span className="text-xs text-gray-500">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">
              No referral configuration changes have been
              recorded yet.
            </p>
          )}
        </div>
      </SectionCard>
    </DashboardShell>
  );
}
