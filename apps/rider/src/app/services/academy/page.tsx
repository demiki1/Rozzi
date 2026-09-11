'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, post } from '../../../lib/api';

export default function Academy() {
  const [x, setX] = useState<any[]>([]);
  const [err, setErr] = useState('');

  const load = () =>
    api('/api/rider/services/academy')
      .then(setX)
      .catch((e) => setErr(e.message));

  useEffect(() => {
    void load();
  }, []);

  async function start(id: string) {
    try {
      await post(`/api/rider/services/academy/${id}/start`);
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function complete(id: string) {
    try {
      await post(`/api/rider/services/academy/${id}/complete`, {
        scorePercent: 100,
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

          <span className="eyebrow">RIDER ACADEMY</span>

          <h1>Learn the ROZZI way</h1>

          <p>
            Complete the core rider training modules before taking on more
            responsibilities.
          </p>
        </div>
      </div>

      {err && <div className="error">{err}</div>}

      <div className="academy-grid">
        {x.map((m) => (
          <article
            className="card academy-card"
            key={m.id}
          >
            <div className="academy-top">
              <span>📚</span>

              <span className="status-badge status-warning">
                {m.status.replace('_', ' ')}
              </span>
            </div>

            <h2>{m.title}</h2>

            <p>{m.description}</p>

            <div className="progress-track">
              <i
                style={{
                  width:
                    m.status === 'COMPLETED'
                      ? '100%'
                      : m.status === 'IN_PROGRESS'
                        ? '50%'
                        : '0%',
                }}
              />
            </div>

            {m.status === 'NOT_STARTED' ? (
              <button
                className="btn accept"
                onClick={() => start(m.id)}
              >
                Start module
              </button>
            ) : m.status === 'IN_PROGRESS' ? (
              <button
                className="btn accept"
                onClick={() => complete(m.id)}
              >
                Mark complete
              </button>
            ) : (
              <span className="success-text">
                ✓ Completed
              </span>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}