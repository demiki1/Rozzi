"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const money = (k = 0) =>
  `₦${(Number(k) / 100).toLocaleString("en-NG", {
    maximumFractionDigits: 0,
  })}`;

export default function Advanced() {
  const [d, setD] = useState<any>();
  const [e, setE] = useState("");

  useEffect(() => {
    api("/api/rider/advanced/dashboard")
      .then(setD)
      .catch((x: any) =>
        setE(x.message || "Unable to load advanced dashboard.")
      );
  }, []);

  return (
    <main className="rider-main advanced-page">
      <Link href="/" className="back-link">
        ← Rider Home
      </Link>

      <span className="eyebrow">ADVANCED ROZZI</span>

      <h1>Your intelligent rider workspace</h1>

      <p className="lead">
        Personalized delivery tools, forecasts, demand signals and
        operational insights in one place.
      </p>

      {e && <div className="error">{e}</div>}

      <section className="advanced-hero card">
        <div>
          <span className="eyebrow">PERSONALIZED</span>

          <h2>
            {d?.hero?.headline || "Loading your dashboard…"}
          </h2>

          <p>
            {d?.hero?.subheadline ||
              "Preparing recommendations for you."}
          </p>
        </div>

        <div className="forecast">
          <b>{money(d?.earningsForecast?.today || 0)}</b>
          <span>estimated today</span>
        </div>
      </section>

      <div className="advanced-grid">
        <Link
          href="/advanced/recommendations"
          className="advanced-card card"
        >
          <b>Smart orders</b>
          <span>
            See delivery offers ranked for your route and profile.
          </span>
        </Link>

        <Link
          href="/advanced/predictions"
          className="advanced-card card"
        >
          <b>Earnings forecast</b>
          <span>
            Estimate your next day, week and month from your
            delivery history.
          </span>
        </Link>

        <Link
          href="/advanced/analytics"
          className="advanced-card card"
        >
          <b>Advanced analytics</b>
          <span>
            Understand delivery earnings, efficiency and
            operational trends.
          </span>
        </Link>

        <Link
          href="/advanced/demand"
          className="advanced-card card"
        >
          <b>Demand prediction</b>
          <span>
            Find the busiest zones based on recent order activity.
          </span>
        </Link>

        <Link
          href="/advanced/financing"
          className="advanced-card card"
        >
          <b>Financing</b>
          <span>
            Check rider and vehicle financing eligibility.
          </span>
        </Link>
      </div>

      <section className="card data-note">
        <b>Rider earnings remain delivery-only.</b>
        <p>
          Advanced tools can help you understand delivery
          opportunities and your earning patterns, but ROZZI does
          not provide Rider bonuses, referral rewards, loyalty
          rewards, challenge cash rewards or other incentive
          payments.
        </p>
      </section>
    </main>
  );
}