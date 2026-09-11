"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";

const money = (k = 0) =>
  `₦${(Number(k) / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;

export default function Transactions() {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    api("/api/rider/finance/transactions")
      .then(setRows)
      .catch((e: any) =>
        setErr(e.message || "Unable to load transactions.")
      );
  }, []);

  return (
    <div className="money-page">
      <header className="money-header">
        <div>
          <span className="eyebrow">WALLET</span>
          <h1>Transactions</h1>
          <p>
            View your delivery earnings, reversals and wallet
            transactions in one place.
          </p>
        </div>

        <Link href="/wallet" className="btn ghost">
          ← Wallet
        </Link>
      </header>

      {err && <div className="error">{err}</div>}

      <section className="card">
        <div className="panel-title">
          <div>
            <span className="eyebrow">LEDGER</span>
            <h2>Transaction history</h2>
          </div>

          <span>{rows.length} records</span>
        </div>

        {rows.map((x) => (
          <div className="money-row" key={x.id}>
            <div>
              <b>
                {x.description ||
                  String(x.type || "TRANSACTION").replaceAll("_", " ")}
              </b>

              <span>
                {new Date(x.createdAt).toLocaleString("en-NG")}
              </span>
            </div>

            <strong
              className={
                Number(x.amount) >= 0 ? "positive" : "negative"
              }
            >
              {Number(x.amount) >= 0 ? "+" : "−"}
              {money(Math.abs(Number(x.amount) || 0))}
            </strong>
          </div>
        ))}

        {!rows.length && !err && (
          <div className="empty-state">
            No wallet transactions yet.
          </div>
        )}
      </section>
    </div>
  );
}