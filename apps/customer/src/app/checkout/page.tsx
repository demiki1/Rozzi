'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, post } from '../../lib/api';

export default function Checkout() {
  const r = useRouter();

  const [areas, setAreas] = useState<any[]>([]);
  const [addresses, setAddresses] = useState<any[]>([]);

  const [area, setArea] = useState('');
  const [address, setAddress] = useState('');

  const [type, setType] = useState('DELIVERY');
  const [model, setModel] = useState('PLATFORM_DELIVERY');

  const [promo, setPromo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [showNewAddress, setShowNewAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState('');
  const [addressText, setAddressText] = useState('');
  const [landmark, setLandmark] = useState('');
  const [instructions, setInstructions] = useState('');
  const [savingAddress, setSavingAddress] = useState(false);

  useEffect(() => {
    Promise.all([
      api('/api/service-areas'),
      api('/api/customer/addresses'),
    ])
      .then(([a, b]) => {
        setAreas(a);
        setAddresses(b);

        if (a[0]) {
          setArea(a[0].id);
        }

        if (b[0]) {
          setAddress(b[0].id);
        } else {
          setShowNewAddress(true);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  async function saveAddress() {
    if (!addressLabel.trim() || !addressText.trim()) {
      setError('Please enter an address label and your delivery address.');
      return;
    }

    setSavingAddress(true);
    setError('');

    try {
      const created = await post('/api/customer/addresses', {
        label: addressLabel.trim(),
        addressText: addressText.trim(),
        landmark: landmark.trim() || undefined,
        instructions: instructions.trim() || undefined,
      });

      setAddresses((current) => [created, ...current]);
      setAddress(created.id);

      setAddressLabel('');
      setAddressText('');
      setLandmark('');
      setInstructions('');
      setShowNewAddress(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingAddress(false);
    }
  }

  async function submit() {
    if (type === 'DELIVERY' && !address) {
      setError('Please select or add a delivery address.');
      return;
    }

    if (!area) {
      setError('Please select a service area.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const o = await post('/api/orders/checkout', {
        serviceAreaId: area,
        deliveryType: type,
        deliveryModel:
          type === 'DELIVERY' ? model : undefined,
        addressId:
          type === 'DELIVERY' ? address : undefined,
        promotionCode: promo || undefined,
        note: note || undefined,
      });

      r.push(`/orders/${o.id}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <h1>Checkout</h1>

      {error && <div className="error">{error}</div>}

      <div className="card formgrid">

        <label>
          Service area
          <select
            className="input"
            value={area}
            onChange={(e) => setArea(e.target.value)}
          >
            <option value="">Choose service area</option>

            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          Fulfilment
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="DELIVERY">Delivery</option>
            <option value="PICKUP">Pickup</option>
          </select>
        </label>

        {type === 'DELIVERY' && (
          <>
            <label>
              Delivery model
              <select
                className="input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                <option value="PLATFORM_DELIVERY">
                  Rozzi rider
                </option>

                <option value="SELF_DELIVERY">
                  Vendor delivery
                </option>
              </select>
            </label>

            <label>
              Delivery address

              <select
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              >
                <option value="">
                  Select an address
                </option>

                {addresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.addressText}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className="btn"
              onClick={() => setShowNewAddress((value) => !value)}
            >
              {showNewAddress
                ? 'Cancel'
                : '+ Add new delivery address'}
            </button>

            {showNewAddress && (
              <div className="card">

                <h2>Add delivery address</h2>

                <label>
                  Address label
                  <input
                    className="input"
                    placeholder="e.g. Hostel, Home, Lodge"
                    value={addressLabel}
                    onChange={(e) =>
                      setAddressLabel(e.target.value)
                    }
                  />
                </label>

                <label>
                  Delivery address
                  <textarea
                    className="input"
                    placeholder="Enter your full delivery address"
                    value={addressText}
                    onChange={(e) =>
                      setAddressText(e.target.value)
                    }
                    rows={3}
                  />
                </label>

                <label>
                  Landmark
                  <input
                    className="input"
                    placeholder="e.g. Near school gate"
                    value={landmark}
                    onChange={(e) =>
                      setLandmark(e.target.value)
                    }
                  />
                </label>

                <label>
                  Delivery instructions
                  <textarea
                    className="input"
                    placeholder="Optional instructions for the rider"
                    value={instructions}
                    onChange={(e) =>
                      setInstructions(e.target.value)
                    }
                    rows={3}
                  />
                </label>

                <button
                  type="button"
                  className="btn success"
                  onClick={saveAddress}
                  disabled={savingAddress}
                >
                  {savingAddress
                    ? 'Saving address...'
                    : 'Save address'}
                </button>

              </div>
            )}
          </>
        )}

        <label>
          Promotion code
          <input
            className="input"
            value={promo}
            onChange={(e) => setPromo(e.target.value)}
          />
        </label>

        <label>
          Order note
          <textarea
            className="input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

      </div>

      <button
        className="btn"
        onClick={submit}
        disabled={busy}
      >
        {busy ? 'Placing order...' : 'Place order'}
      </button>
    </main>
  );
}