'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../../../lib/api';

export default function Equipment() {
  const [x, setX] = useState<any[]>([]);
  const [item, setItem] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () =>
    api('/api/rider/services/equipment')
      .then(setX)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    void load();
  }, []);

  async function request() {
    if (!item) return;

    try {
      await post('/api/rider/services/equipment', {
        itemType: item,
      });

      setMsg('Equipment request submitted.');
      setItem('');
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function replace(id: string) {
    try {
      await post(`/api/rider/services/equipment/${id}/replacement`);

      setMsg('Replacement request submitted.');
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <main className="rider-main standalone">
      <div className="page-head">
        <div>
          <Link href="/services">← Rider Services</Link>

          <span className="eyebrow">EQUIPMENT</span>

          <h1>Rider equipment</h1>

          <p>
            Track issued equipment and request replacements when needed.
          </p>
        </div>
      </div>

      {msg && <div className="success-banner">{msg}</div>}

      {err && <div className="error">{err}</div>}

      <section className="card">
        <h2>Request equipment</h2>

        <div className="form-grid">
          <select
            className="input"
            value={item}
            onChange={(e) => setItem(e.target.value)}
          >
            <option value="">Choose equipment</option>
            <option>Delivery bag</option>
            <option>Helmet</option>
            <option>ROZZI jacket</option>
            <option>Phone holder</option>
            <option>Uniform</option>
          </select>

          <button
            className="btn accept"
            onClick={request}
          >
            Request
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Your equipment</h2>

        {!x.length ? (
          <p className="muted">No equipment records yet.</p>
        ) : (
          x.map((i) => (
            <article
              className="list-row"
              key={i.id}
            >
              <div>
                <b>{i.itemType}</b>
                <span>
                  {i.serialNumber || 'No serial number'}
                </span>
              </div>

              <span className="status-badge status-warning">
                {i.status}
              </span>

              {['ISSUED', 'DAMAGED', 'LOST'].includes(i.status) && (
                <button
                  className="btn ghost"
                  onClick={() => replace(i.id)}
                >
                  Request replacement
                </button>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}