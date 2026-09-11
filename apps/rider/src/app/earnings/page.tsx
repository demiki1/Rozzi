"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const money = (k = 0) =>
  `₦${(Number(k) / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;

export default function Earnings() {
  const [d, setD] = useState<any>(null);
  const [range, setRange] = useState(30);
  const [err, setErr] = useState("");

  useEffect(() => {
    const from = new Date(
      Date.now() - (range - 1) * 86400000
    ).toISOString();

    setErr("");

    api(
      `/api/rider/finance/earnings?from=${encodeURIComponent(from)}`
    )
      .then(setD)
      .catch((e: any) =>
        setErr(e.message || "Unable to load earnings.")
      );
  }, [range]);

  const daily = Array.isArray(d?.daily) ? d.daily : [];
  const entries = Array.isArray(d?.entries) ? d.entries : [];

  const maxDailyAmount = Math.max(
    1,
    ...daily.map((x: any) => Number(x.amount) || 0)
  );

  return (
    <div className="money-page">
      <header className="money-header">
        <div>
          <span className="eyebrow">MONEY</span>
          <h1>Earnings</h1>
          <p>
            Track your earnings from completed deliveries and delivery
            fees.
          </p>
        </div>

        <Link href="/wallet" className="btn ghost">
          Wallet →
        </Link>
      </header>

      {err && <div className="error">{err}</div>}

      <div className="range-tabs">
        {[7, 30, 90].map((x) => (
          <button
            key={x}
            className={range === x ? "selected" : ""}
            onClick={() => setRange(x)}
          >
            {x} days
          </button>
        ))}
      </div>

      {d && (
        <>
          <section className="earnings-hero card">
            <div>
              <span>Total earnings</span>
              <strong>{money(d.total)}</strong>
            </div>

            <div>
              <span>Delivery earnings</span>
              <b>{money(d.deliveryEarnings)}</b>
            </div>

            <div>
              <span>Completed deliveries</span>
              <b>{d.transactionCount ?? 0}</b>
            </div>
          </section>

          <section className="card chart-card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">TREND</span>
                <h2>Daily delivery earnings</h2>
              </div>

              <span>
                {d.transactionCount ?? 0} earnings
              </span>
            </div>

            {daily.length ? (
              <div className="bars">
                {daily.slice(-14).map((x: any) => {
                  const amount = Number(x.amount) || 0;

                  return (
                    <div className="bar-col" key={x.date}>
                      <div
                        className="bar"
                        style={{
                          height: `${Math.max(
                            8,
                            Math.min(
                              100,
                              (amount / maxDailyAmount) * 100
                            )
                          )}%`,
                        }}
                      />

                      <span>{String(x.date).slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">
                No delivery earnings recorded for this period.
              </p>
            )}
          </section>

          <section className="card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">ACTIVITY</span>
                <h2>Recent delivery earnings</h2>
              </div>
            </div>

            {entries.length ? (
              entries.slice(0, 12).map((x: any) => (
                <div className="money-row" key={x.id}>
                  <div>
                    <b>
                      {x.description ||
                        "Completed delivery"}
                    </b>

                    <span>
                      {new Date(
                        x.createdAt
                      ).toLocaleString("en-NG")}
                    </span>
                  </div>

                  <strong
                    className={
                      Number(x.amount) >= 0
                        ? "positive"
                        : "negative"
                    }
                  >
                    {Number(x.amount) >= 0 ? "+" : "−"}
                    {money(Math.abs(Number(x.amount) || 0))}
                  </strong>
                </div>
              ))
            ) : (
              <p className="muted">
                No delivery earnings recorded yet.
              </p>
            )}
          </section>

          <section className="card earning-policy-card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">
                  ROZZI EARNING POLICY
                </span>
                <h2>How Rider earnings work</h2>
              </div>
            </div>

            <div className="earning-policy-list">
              <span>✓ Earnings come from completed deliveries</span>
              <span>✓ Delivery fees are recorded as Rider earnings</span>
              <span>✓ Applicable delivery surge is included in delivery earnings</span>
              <span>✓ Earnings can be withdrawn through your wallet</span>
            </div>

            <p className="muted">
              ROZZI does not currently provide Rider bonuses,
              referral rewards, challenge cash rewards, loyalty
              rewards, tips or other incentive payments.
            </p>
          </section>
        </>
      )}
    </div>
  );
}