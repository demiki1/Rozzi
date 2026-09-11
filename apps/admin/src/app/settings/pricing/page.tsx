'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';

type ServiceArea = {
  id: string;
  name: string;
  status?: string;
  minimumOrderAmount?: number;
};

type PricingConfig = {
  id: string;
  serviceAreaId: string;
  isActive: boolean;

  serviceFeeRatePercent: number | string;
  serviceFeeCapAmount: number;

  baseDeliveryFee: number;
  perKmDeliveryFee: number;
  deliveryRadiusKm: number | string;

  surgeEnabled: boolean;
  surgeLevel: 'NORMAL' | 'SLIGHTLY_HIGH' | 'HIGH' | 'VERY_HIGH';
  surgeSlightlyHighAmount: number;
  surgeHighAmount: number;
  surgeVeryHighAmount: number;
  surgeMaxAmount: number;

  createdAt: string;
  updatedAt: string;
};

type PricingForm = {
  serviceFeeRatePercent: string;
  serviceFeeCapNaira: string;

  baseDeliveryFeeNaira: string;
  perKmDeliveryFeeNaira: string;
  deliveryRadiusKm: string;

  surgeEnabled: boolean;
  surgeLevel: PricingConfig['surgeLevel'];

  surgeSlightlyHighNaira: string;
  surgeHighNaira: string;
  surgeVeryHighNaira: string;
  surgeMaxNaira: string;
};

const DEFAULT_FORM: PricingForm = {
  serviceFeeRatePercent: '5',
  serviceFeeCapNaira: '1000',

  baseDeliveryFeeNaira: '450',
  perKmDeliveryFeeNaira: '100',
  deliveryRadiusKm: '8',

  surgeEnabled: true,
  surgeLevel: 'NORMAL',

  surgeSlightlyHighNaira: '100',
  surgeHighNaira: '200',
  surgeVeryHighNaira: '300',
  surgeMaxNaira: '300',
};

function toNaira(kobo: number | string | null | undefined) {
  const value = Number(kobo ?? 0);
  return Number.isFinite(value) ? String(value / 100) : '0';
}

function toKobo(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100);
}

function money(value: number | string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) return '₦0';

  return `₦${amount.toLocaleString('en-NG', {
    maximumFractionDigits: 0,
  })}`;
}

function configToForm(config: PricingConfig): PricingForm {
  return {
    serviceFeeRatePercent: String(config.serviceFeeRatePercent),
    serviceFeeCapNaira: toNaira(config.serviceFeeCapAmount),

    baseDeliveryFeeNaira: toNaira(config.baseDeliveryFee),
    perKmDeliveryFeeNaira: toNaira(config.perKmDeliveryFee),
    deliveryRadiusKm: String(config.deliveryRadiusKm),

    surgeEnabled: config.surgeEnabled,
    surgeLevel: config.surgeLevel,

    surgeSlightlyHighNaira: toNaira(config.surgeSlightlyHighAmount),
    surgeHighNaira: toNaira(config.surgeHighAmount),
    surgeVeryHighNaira: toNaira(config.surgeVeryHighAmount),
    surgeMaxNaira: toNaira(config.surgeMaxAmount),
  };
}

function isPositiveOrZero(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0;
}

function isPositive(value: string) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0;
}

export default function PricingPage() {
  const [serviceAreas, setServiceAreas] = useState<ServiceArea[]>([]);
  const [selectedServiceAreaId, setSelectedServiceAreaId] = useState('');

  const [config, setConfig] = useState<PricingConfig | null>(null);
  const [form, setForm] = useState<PricingForm>(DEFAULT_FORM);

  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedServiceArea = useMemo(
    () =>
      serviceAreas.find((area) => area.id === selectedServiceAreaId) ?? null,
    [serviceAreas, selectedServiceAreaId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadServiceAreas() {
      setLoadingAreas(true);
      setError('');

      try {
        const response = await api.get<ServiceArea[]>('/api/service-areas');

        if (cancelled) return;

        setServiceAreas(Array.isArray(response) ? response : []);

        if (response.length > 0) {
          setSelectedServiceAreaId((current) => current || response[0].id);
        }
      } catch (err) {
        if (cancelled) return;

        setError(
          err instanceof ApiError
            ? err.message
            : 'Unable to load service areas.',
        );
      } finally {
        if (!cancelled) setLoadingAreas(false);
      }
    }

    loadServiceAreas();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedServiceAreaId) return;

    let cancelled = false;

    async function loadConfig() {
      setLoadingConfig(true);
      setError('');
      setSuccess('');

      try {
        const response = await api.get<PricingConfig>(
          `/api/admin/pricing/service-areas/${selectedServiceAreaId}`,
        );

        if (cancelled) return;

        setConfig(response);
        setForm(configToForm(response));
      } catch (err) {
        if (cancelled) return;

        setConfig(null);

        setError(
          err instanceof ApiError
            ? err.message
            : 'Unable to load pricing configuration.',
        );
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }

    loadConfig();

    return () => {
      cancelled = true;
    };
  }, [selectedServiceAreaId]);

  function updateField<K extends keyof PricingForm>(
    field: K,
    value: PricingForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setSuccess('');
    setError('');
  }

  function validate(): string | null {
    const serviceRate = Number(form.serviceFeeRatePercent);

    if (!Number.isFinite(serviceRate) || serviceRate < 0 || serviceRate > 100) {
      return 'Service fee rate must be between 0% and 100%.';
    }

    if (!isPositiveOrZero(form.serviceFeeCapNaira)) {
      return 'Service fee cap must be zero or greater.';
    }

    if (!isPositiveOrZero(form.baseDeliveryFeeNaira)) {
      return 'Base delivery fee must be zero or greater.';
    }

    if (!isPositiveOrZero(form.perKmDeliveryFeeNaira)) {
      return 'Per-kilometre delivery fee must be zero or greater.';
    }

    if (!isPositive(form.deliveryRadiusKm)) {
      return 'Delivery radius must be greater than 0 km.';
    }

    if (!isPositiveOrZero(form.surgeSlightlyHighNaira)) {
      return 'Slightly High surge amount must be zero or greater.';
    }

    if (!isPositiveOrZero(form.surgeHighNaira)) {
      return 'High surge amount must be zero or greater.';
    }

    if (!isPositiveOrZero(form.surgeVeryHighNaira)) {
      return 'Very High surge amount must be zero or greater.';
    }

    if (!isPositiveOrZero(form.surgeMaxNaira)) {
      return 'Surge maximum must be zero or greater.';
    }

    const maxSurge = Number(form.surgeMaxNaira);

    if (maxSurge > 300) {
      return 'Surge maximum cannot exceed ₦300.';
    }

    if (Number(form.surgeSlightlyHighNaira) > maxSurge) {
      return 'Slightly High surge cannot exceed the surge maximum.';
    }

    if (Number(form.surgeHighNaira) > maxSurge) {
      return 'High surge cannot exceed the surge maximum.';
    }

    if (Number(form.surgeVeryHighNaira) > maxSurge) {
      return 'Very High surge cannot exceed the surge maximum.';
    }

    if (
      form.surgeLevel === 'SLIGHTLY_HIGH' &&
      Number(form.surgeSlightlyHighNaira) > maxSurge
    ) {
      return 'The selected surge level exceeds the configured maximum.';
    }

    if (
      form.surgeLevel === 'HIGH' &&
      Number(form.surgeHighNaira) > maxSurge
    ) {
      return 'The selected surge level exceeds the configured maximum.';
    }

    if (
      form.surgeLevel === 'VERY_HIGH' &&
      Number(form.surgeVeryHighNaira) > maxSurge
    ) {
      return 'The selected surge level exceeds the configured maximum.';
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedServiceAreaId) {
      setError('Select a service area first.');
      return;
    }

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      setSuccess('');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        serviceFeeRatePercent: Number(form.serviceFeeRatePercent),
        serviceFeeCapAmount: toKobo(form.serviceFeeCapNaira),

        baseDeliveryFee: toKobo(form.baseDeliveryFeeNaira),
        perKmDeliveryFee: toKobo(form.perKmDeliveryFeeNaira),
        deliveryRadiusKm: Number(form.deliveryRadiusKm),

        surgeEnabled: form.surgeEnabled,
        surgeLevel: form.surgeLevel,

        surgeSlightlyHighAmount: toKobo(form.surgeSlightlyHighNaira),
        surgeHighAmount: toKobo(form.surgeHighNaira),
        surgeVeryHighAmount: toKobo(form.surgeVeryHighNaira),
        surgeMaxAmount: toKobo(form.surgeMaxNaira),
      };

      const response = await api.patch<PricingConfig>(
        `/api/admin/pricing/service-areas/${selectedServiceAreaId}`,
        payload,
      );

      setConfig(response);
      setForm(configToForm(response));

      setSuccess(
        'Pricing saved successfully. The new pricing version applies to new orders.',
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Unable to save pricing configuration.',
      );
    } finally {
      setSaving(false);
    }
  }

  function resetToLoadedConfig() {
    if (!config) return;

    setForm(configToForm(config));
    setError('');
    setSuccess('');
  }

  const selectedSurgeAmount =
    form.surgeLevel === 'NORMAL'
      ? 0
      : form.surgeLevel === 'SLIGHTLY_HIGH'
        ? Number(form.surgeSlightlyHighNaira)
        : form.surgeLevel === 'HIGH'
          ? Number(form.surgeHighNaira)
          : Number(form.surgeVeryHighNaira);

  return (
    <>
      <style jsx>{`
        .pricing-page {
          max-width: 1180px;
          margin: 0 auto;
        }

        .pricing-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .pricing-eyebrow {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #9a5a16;
          margin-bottom: 7px;
        }

        .pricing-header h1 {
          margin: 0;
          font-size: clamp(26px, 3vw, 34px);
          line-height: 1.1;
          letter-spacing: -0.03em;
        }

        .pricing-header p {
          margin: 9px 0 0;
          max-width: 680px;
          color: #6b625d;
          line-height: 1.6;
        }

        .area-picker {
          min-width: 250px;
          padding: 15px;
          border: 1px solid #eadfd6;
          border-radius: 16px;
          background: #fffaf6;
        }

        .area-picker label {
          display: block;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #756b64;
          margin-bottom: 7px;
        }

        .area-picker select {
          width: 100%;
          min-height: 42px;
          border: 1px solid #d9cec5;
          border-radius: 10px;
          background: #fff;
          padding: 0 12px;
          font: inherit;
          color: #302925;
          outline: none;
        }

        .area-picker select:focus {
          border-color: #c97927;
          box-shadow: 0 0 0 3px rgba(201, 121, 39, 0.12);
        }

        .config-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 22px;
        }

        .status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          background: #eaf7ef;
          color: #1f7544;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #2ca35d;
        }

        .version {
          color: #81766e;
          font-size: 12px;
        }

        .notice {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          padding: 14px 16px;
          border-radius: 14px;
          margin-bottom: 22px;
          font-size: 13px;
          line-height: 1.55;
        }

        .notice.info {
          background: #fff6e9;
          border: 1px solid #f2d8b3;
          color: #6f4b25;
        }

        .notice.error {
          background: #fff0ef;
          border: 1px solid #f2c5c2;
          color: #a23932;
        }

        .notice.success {
          background: #edf9f2;
          border: 1px solid #c8ead5;
          color: #236f43;
        }

        .notice-icon {
          flex: 0 0 auto;
          font-weight: 900;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .card {
          background: #fff;
          border: 1px solid #eadfd6;
          border-radius: 18px;
          padding: 22px;
          box-shadow: 0 5px 22px rgba(67, 43, 27, 0.045);
        }

        .card.full {
          grid-column: 1 / -1;
        }

        .card-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .card-heading h2 {
          margin: 0;
          font-size: 17px;
          letter-spacing: -0.015em;
        }

        .card-heading p {
          margin: 5px 0 0;
          color: #7a7069;
          font-size: 12px;
          line-height: 1.5;
        }

        .card-icon {
          width: 38px;
          height: 38px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          background: #fff3e5;
          color: #b86619;
          font-weight: 900;
        }

        .fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .field {
          min-width: 0;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          display: block;
          margin-bottom: 7px;
          font-size: 12px;
          font-weight: 750;
          color: #403832;
        }

        .field-help {
          margin-top: 6px;
          color: #8a8078;
          font-size: 11px;
          line-height: 1.45;
        }

        .input-wrap {
          position: relative;
        }

        .input-prefix {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #82776f;
          font-size: 13px;
          pointer-events: none;
        }

        .input-suffix {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #82776f;
          font-size: 12px;
          pointer-events: none;
        }

        input,
        select {
          box-sizing: border-box;
          width: 100%;
          min-height: 44px;
          border: 1px solid #dcd1c8;
          border-radius: 11px;
          background: #fff;
          padding: 0 12px;
          font: inherit;
          font-size: 14px;
          color: #302925;
          outline: none;
          transition:
            border-color 0.15s ease,
            box-shadow 0.15s ease;
        }

        .input-wrap input.has-prefix {
          padding-left: 29px;
        }

        .input-wrap input.has-suffix {
          padding-right: 43px;
        }

        input:focus,
        select:focus {
          border-color: #c97927;
          box-shadow: 0 0 0 3px rgba(201, 121, 39, 0.11);
        }

        .toggle-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 14px 15px;
          border: 1px solid #eee3db;
          border-radius: 13px;
          background: #fffaf7;
          margin-bottom: 18px;
        }

        .toggle-copy strong {
          display: block;
          font-size: 13px;
        }

        .toggle-copy span {
          display: block;
          margin-top: 3px;
          color: #80756e;
          font-size: 11px;
        }

        .switch {
          position: relative;
          width: 48px;
          height: 27px;
          flex: 0 0 auto;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }

        .slider {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          background: #c9c0ba;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .slider::before {
          content: '';
          position: absolute;
          width: 21px;
          height: 21px;
          left: 3px;
          top: 3px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 2px 5px rgba(0, 0, 0, 0.16);
          transition: 0.18s ease;
        }

        .switch input:checked + .slider {
          background: #b86619;
        }

        .switch input:checked + .slider::before {
          transform: translateX(21px);
        }

        .surge-preview {
          margin-top: 18px;
          padding: 15px;
          border-radius: 13px;
          background: #f8f3ef;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .surge-preview span {
          color: #766b64;
          font-size: 12px;
        }

        .surge-preview strong {
          font-size: 16px;
        }

        .example {
          margin-top: 18px;
          border: 1px solid #eee3db;
          border-radius: 14px;
          overflow: hidden;
        }

        .example-title {
          padding: 11px 14px;
          background: #fffaf7;
          border-bottom: 1px solid #eee3db;
          font-size: 12px;
          font-weight: 800;
        }

        .example-row {
          display: flex;
          justify-content: space-between;
          padding: 9px 14px;
          font-size: 12px;
          color: #625851;
        }

        .example-row strong {
          color: #312a26;
        }

        .example-row.total {
          border-top: 1px solid #eee3db;
          background: #fff8f0;
          font-weight: 800;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #eee3db;
        }

        .button {
          min-height: 44px;
          border-radius: 11px;
          padding: 0 18px;
          border: 1px solid transparent;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition:
            transform 0.15s ease,
            opacity 0.15s ease,
            background 0.15s ease;
        }

        .button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .button.secondary {
          background: #fff;
          color: #514841;
          border-color: #dcd1c8;
        }

        .button.primary {
          background: #8e321e;
          color: #fff;
          box-shadow: 0 5px 14px rgba(142, 50, 30, 0.18);
        }

        .loading {
          min-height: 260px;
          display: grid;
          place-items: center;
          color: #766c65;
          font-size: 13px;
        }

        .empty {
          padding: 40px 20px;
          text-align: center;
          background: #fff;
          border: 1px solid #eadfd6;
          border-radius: 18px;
          color: #766c65;
        }

        @media (max-width: 820px) {
          .pricing-header {
            flex-direction: column;
          }

          .area-picker {
            width: 100%;
            box-sizing: border-box;
          }

          .grid {
            grid-template-columns: 1fr;
          }

          .card.full {
            grid-column: auto;
          }
        }

        @media (max-width: 560px) {
          .card {
            padding: 17px;
            border-radius: 15px;
          }

          .fields {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .actions {
            flex-direction: column-reverse;
          }

          .button {
            width: 100%;
          }
        }
      `}</style>

      <div className="pricing-page">
        <div className="pricing-header">
          <div>
            <div className="pricing-eyebrow">System Configuration</div>
            <h1>Pricing</h1>
            <p>
              Control ROZZI service fees, delivery pricing, delivery radius and
              surge charges for each service area.
            </p>
          </div>

          <div className="area-picker">
            <label htmlFor="service-area">Service area</label>

            <select
              id="service-area"
              value={selectedServiceAreaId}
              onChange={(event) =>
                setSelectedServiceAreaId(event.target.value)
              }
              disabled={loadingAreas}
            >
              {loadingAreas ? (
                <option>Loading service areas...</option>
              ) : serviceAreas.length === 0 ? (
                <option value="">No service areas found</option>
              ) : (
                serviceAreas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {selectedServiceArea && (
          <div className="config-meta">
            <span className="status">
              <span className="status-dot" />
              {config?.isActive ? 'Active pricing' : 'Inactive pricing'}
            </span>

            <span className="version">
              {selectedServiceArea.name}
              {config?.updatedAt
                ? ` • Updated ${new Date(config.updatedAt).toLocaleString(
                    'en-NG',
                  )}`
                : ''}
            </span>
          </div>
        )}

        {error && (
          <div className="notice error" role="alert">
            <span className="notice-icon">!</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="notice success" role="status">
            <span className="notice-icon">✓</span>
            <span>{success}</span>
          </div>
        )}

        <div className="notice info">
          <span className="notice-icon">i</span>
          <span>
            Pricing changes are versioned. Saving a configuration creates a
            new pricing version for <strong>new orders</strong>. Existing
            orders keep the amounts that were charged when they were created.
          </span>
        </div>

        {loadingAreas || loadingConfig ? (
          <div className="loading">
            {loadingAreas
              ? 'Loading service areas...'
              : 'Loading pricing configuration...'}
          </div>
        ) : !selectedServiceAreaId ? (
          <div className="empty">
            Select a service area to manage its pricing.
          </div>
        ) : !config ? (
          <div className="empty">
            Pricing configuration could not be loaded for this service area.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid">
              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Service fee</h2>
                    <p>
                      Applied to the net merchandise subtotal after discounts.
                    </p>
                  </div>
                  <div className="card-icon">%</div>
                </div>

                <div className="fields">
                  <div className="field">
                    <label htmlFor="service-fee-rate">Fee rate</label>
                    <div className="input-wrap">
                      <input
                        id="service-fee-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={form.serviceFeeRatePercent}
                        onChange={(event) =>
                          updateField(
                            'serviceFeeRatePercent',
                            event.target.value,
                          )
                        }
                      />
                      <span className="input-suffix">%</span>
                    </div>
                    <div className="field-help">
                      Current recommended configuration: 5%.
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="service-fee-cap">Maximum fee</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="service-fee-cap"
                        className="has-prefix"
                        type="number"
                        min="0"
                        step="1"
                        value={form.serviceFeeCapNaira}
                        onChange={(event) =>
                          updateField(
                            'serviceFeeCapNaira',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                    <div className="field-help">
                      Prevents the percentage fee from exceeding this amount.
                    </div>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Delivery pricing</h2>
                    <p>
                      Default delivery calculation for this service area.
                    </p>
                  </div>
                  <div className="card-icon">km</div>
                </div>

                <div className="fields">
                  <div className="field">
                    <label htmlFor="base-delivery">Base delivery fee</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="base-delivery"
                        className="has-prefix"
                        type="number"
                        min="0"
                        step="1"
                        value={form.baseDeliveryFeeNaira}
                        onChange={(event) =>
                          updateField(
                            'baseDeliveryFeeNaira',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="per-km">Per kilometre</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="per-km"
                        className="has-prefix"
                        type="number"
                        min="0"
                        step="1"
                        value={form.perKmDeliveryFeeNaira}
                        onChange={(event) =>
                          updateField(
                            'perKmDeliveryFeeNaira',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="field full">
                    <label htmlFor="delivery-radius">Delivery radius</label>
                    <div className="input-wrap">
                      <input
                        id="delivery-radius"
                        className="has-suffix"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={form.deliveryRadiusKm}
                        onChange={(event) =>
                          updateField('deliveryRadiusKm', event.target.value)
                        }
                      />
                      <span className="input-suffix">km</span>
                    </div>
                    <div className="field-help">
                      Orders beyond this radius are not eligible for standard
                      delivery in this service area.
                    </div>
                  </div>
                </div>
              </section>

              <section className="card full">
                <div className="card-heading">
                  <div>
                    <h2>Surge pricing</h2>
                    <p>
                      Add a controlled surcharge during periods of high
                      delivery demand.
                    </p>
                  </div>
                  <div className="card-icon">↑</div>
                </div>

                <div className="toggle-row">
                  <div className="toggle-copy">
                    <strong>Enable surge pricing</strong>
                    <span>
                      When disabled, the surge charge is always ₦0.
                    </span>
                  </div>

                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={form.surgeEnabled}
                      onChange={(event) =>
                        updateField('surgeEnabled', event.target.checked)
                      }
                    />
                    <span className="slider" />
                  </label>
                </div>

                <div className="fields">
                  <div className="field">
                    <label htmlFor="surge-level">Current surge level</label>
                    <select
                      id="surge-level"
                      value={form.surgeLevel}
                      disabled={!form.surgeEnabled}
                      onChange={(event) =>
                        updateField(
                          'surgeLevel',
                          event.target
                            .value as PricingConfig['surgeLevel'],
                        )
                      }
                    >
                      <option value="NORMAL">Normal — ₦0</option>
                      <option value="SLIGHTLY_HIGH">
                        Slightly High — ₦
                        {Number(
                          form.surgeSlightlyHighNaira || 0,
                        ).toLocaleString('en-NG')}
                      </option>
                      <option value="HIGH">
                        High — ₦
                        {Number(form.surgeHighNaira || 0).toLocaleString(
                          'en-NG',
                        )}
                      </option>
                      <option value="VERY_HIGH">
                        Very High — ₦
                        {Number(
                          form.surgeVeryHighNaira || 0,
                        ).toLocaleString('en-NG')}
                      </option>
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="surge-max">Hard maximum</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="surge-max"
                        className="has-prefix"
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        value={form.surgeMaxNaira}
                        onChange={(event) =>
                          updateField(
                            'surgeMaxNaira',
                            event.target.value,
                          )
                        }
                        disabled={!form.surgeEnabled}
                      />
                    </div>
                    <div className="field-help">
                      ROZZI's configured hard cap is ₦300.
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="surge-slight">Slightly High</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="surge-slight"
                        className="has-prefix"
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        value={form.surgeSlightlyHighNaira}
                        onChange={(event) =>
                          updateField(
                            'surgeSlightlyHighNaira',
                            event.target.value,
                          )
                        }
                        disabled={!form.surgeEnabled}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="surge-high">High</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="surge-high"
                        className="has-prefix"
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        value={form.surgeHighNaira}
                        onChange={(event) =>
                          updateField(
                            'surgeHighNaira',
                            event.target.value,
                          )
                        }
                        disabled={!form.surgeEnabled}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="surge-very-high">Very High</label>
                    <div className="input-wrap">
                      <span className="input-prefix">₦</span>
                      <input
                        id="surge-very-high"
                        className="has-prefix"
                        type="number"
                        min="0"
                        max="300"
                        step="1"
                        value={form.surgeVeryHighNaira}
                        onChange={(event) =>
                          updateField(
                            'surgeVeryHighNaira',
                            event.target.value,
                          )
                        }
                        disabled={!form.surgeEnabled}
                      />
                    </div>
                  </div>
                </div>

                <div className="surge-preview">
                  <span>
                    Current surcharge
                    {form.surgeEnabled
                      ? ` • ${form.surgeLevel.replace(/_/g, ' ')}`
                      : ' • Disabled'}
                  </span>
                  <strong>
                    {money(form.surgeEnabled ? selectedSurgeAmount : 0)}
                  </strong>
                </div>
              </section>

              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Pricing example</h2>
                    <p>Illustrative calculation using the current values.</p>
                  </div>
                </div>

                <div className="example">
                  <div className="example-title">
                    Example: ₦5,000 merchandise • 2 km delivery
                  </div>

                  <div className="example-row">
                    <span>Net merchandise subtotal</span>
                    <strong>₦5,000</strong>
                  </div>

                  <div className="example-row">
                    <span>Service fee</span>
                    <strong>
                      {money(
                        Math.min(
                          5000 * (Number(form.serviceFeeRatePercent) / 100),
                          Number(form.serviceFeeCapNaira),
                        ),
                      )}
                    </strong>
                  </div>

                  <div className="example-row">
                    <span>Delivery</span>
                    <strong>
                      {money(
                        Number(form.baseDeliveryFeeNaira) +
                          2 * Number(form.perKmDeliveryFeeNaira),
                      )}
                    </strong>
                  </div>

                  <div className="example-row">
                    <span>Surge</span>
                    <strong>
                      {money(form.surgeEnabled ? selectedSurgeAmount : 0)}
                    </strong>
                  </div>

                  <div className="example-row total">
                    <span>Estimated total</span>
                    <strong>
                      {money(
                        5000 +
                          Math.min(
                            5000 * (Number(form.serviceFeeRatePercent) / 100),
                            Number(form.serviceFeeCapNaira),
                          ) +
                          Number(form.baseDeliveryFeeNaira) +
                          2 * Number(form.perKmDeliveryFeeNaira) +
                          (form.surgeEnabled ? selectedSurgeAmount : 0),
                      )}
                    </strong>
                  </div>
                </div>
              </section>

              <section className="card">
                <div className="card-heading">
                  <div>
                    <h2>Minimum order</h2>
                    <p>
                      Minimum order value remains controlled by the service
                      area.
                    </p>
                  </div>
                </div>

                                  <div className="example">
                  <div className="example-row">
                    <span>Service area</span>
                    <strong>{selectedServiceArea?.name ?? '—'}</strong>
                  </div>

                  <div className="example-row">
                    <span>Minimum order</span>
                    <strong>
                      {selectedServiceArea?.minimumOrderAmount !== undefined
                        ? money(
                            selectedServiceArea.minimumOrderAmount / 100,
                          )
                        : 'Configured separately'}
                    </strong>
                  </div>

                  <div className="example-row">
                    <span>Delivery radius</span>
                    <strong>{form.deliveryRadiusKm} km</strong>
                  </div>
                </div>
              </section>
            </div>

            <div className="actions">
              <button
                type="button"
                className="button secondary"
                onClick={resetToLoadedConfig}
                disabled={saving}
              >
                Reset changes
              </button>

              <button
                type="submit"
                className="button primary"
                disabled={saving}
              >
                {saving ? 'Saving pricing...' : 'Save pricing configuration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}