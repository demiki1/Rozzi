'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../../../lib/api';

export default function Insurance() {
  const [x, setX] = useState<any[]>([]);
  const [f, setF] = useState<any>({
    provider: '',
    policyNumber: '',
    coverageType: '',
    startDate: '',
    expiryDate: '',
    documentUrl: '',
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = () =>
    api('/api/rider/services/insurance')
      .then(setX)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    void load();
  }, []);

  async function save(e: any) {
    e.preventDefault();

    try {
      await post('/api/rider/services/insurance', f);

      setMsg('Insurance record submitted for review.');

      setF({
        provider: '',
        policyNumber: '',
        coverageType: '',
        startDate: '',
        expiryDate: '',
        documentUrl: '',
      });

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

          <span className="eyebrow">INSURANCE</span>

          <h1>Insurance &amp; coverage</h1>

          <p>
            Keep active coverage records current before taking deliveries.
          </p>
        </div>
      </div>

      {msg && <div className="success-banner">{msg}</div>}

      {err && <div className="error">{err}</div>}

      <div className="service-two-col">
        <form className="card" onSubmit={save}>
          <h2>Add policy</h2>

          <input
            className="input"
            placeholder="Provider"
            value={f.provider}
            onChange={(e) =>
              setF({ ...f, provider: e.target.value })
            }
            required
          />

          <input
            className="input"
            placeholder="Policy number"
            value={f.policyNumber}
            onChange={(e) =>
              setF({ ...f, policyNumber: e.target.value })
            }
            required
          />

          <input
            className="input"
            placeholder="Coverage type"
            value={f.coverageType}
            onChange={(e) =>
              setF({ ...f, coverageType: e.target.value })
            }
            required
          />

          <label>
            Start date
            <input
              className="input"
              type="date"
              value={f.startDate}
              onChange={(e) =>
                setF({ ...f, startDate: e.target.value })
              }
              required
            />
          </label>

          <label>
            Expiry date
            <input
              className="input"
              type="date"
              value={f.expiryDate}
              onChange={(e) =>
                setF({ ...f, expiryDate: e.target.value })
              }
              required
            />
          </label>

          <input
            className="input"
            placeholder="Document URL (optional)"
            value={f.documentUrl}
            onChange={(e) =>
              setF({ ...f, documentUrl: e.target.value })
            }
          />

          <button className="btn accept" type="submit">
            Submit policy
          </button>
        </form>

        <section className="card">
          <h2>Your policies</h2>

          {!x.length ? (
            <p className="muted">No insurance records yet.</p>
          ) : (
            x.map((i) => (
              <article className="list-row" key={i.id}>
                <div>
                  <b>{i.provider}</b>
                  <span>
                    {i.coverageType} · {i.policyNumber}
                  </span>
                </div>

                <span className="status-badge status-warning">
                  {i.status}
                </span>

                <small>
                  Expires{' '}
                  {new Date(i.expiryDate).toLocaleDateString('en-NG')}
                </small>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}