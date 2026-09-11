"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

export default function Performance() {
  const [d, setD] = useState<any>(null);
  const [err, setErr] = useState("");

  async function load() {
    try {
      setErr("");
      setD(await api("/api/rider/performance/overview"));
    } catch (e: any) {
      setErr(e.message || "Unable to load performance.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const m = d?.metrics || {};
  const score = Number(m.riderScore || 0);

  const challenges = Array.isArray(d?.challenges)
    ? d.challenges
    : [];

  const achievements = Array.isArray(d?.achievements)
    ? d.achievements
    : [];

  return (
    <div className="performance-page">
      <header className="money-header">
        <div>
          <span className="eyebrow">RIDER PERFORMANCE</span>
          <h1>Performance</h1>
          <p>
            Track your delivery performance, service quality and
            operational progress.
          </p>
        </div>

        <Link href="/earnings" className="btn ghost">
          View earnings →
        </Link>
      </header>

      {err && <div className="error">{err}</div>}

      {d && (
        <>
          <section className="performance-hero card">
            <div className="score-ring">
              <strong>{score}</strong>
              <span>Rider Score</span>
            </div>

            <div className="performance-copy">
              <span className="eyebrow">PERFORMANCE OVERVIEW</span>

              <h2>Keep delivering well</h2>

              <p>
                Your Rider Score reflects the quality and consistency
                of your delivery activity.
              </p>

              <div className="score-track">
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(0, score)
                    )}%`,
                  }}
                />
              </div>

              <small>{score}/100 performance score</small>
            </div>

            <div className="performance-benefits">
              <b>What matters</b>
              <span>✓ Reliable delivery completion</span>
              <span>✓ Strong customer ratings</span>
              <span>✓ Good acceptance and completion rates</span>
              <span>✓ Timely deliveries</span>
            </div>
          </section>

          <section className="metric-grid">
            {[
              [
                "⏱",
                `${m.onTimeRate ?? 0}%`,
                "On-time",
              ],
              [
                "×",
                `${m.cancellationRate ?? 0}%`,
                "Cancellation",
              ],
            ].map(([icon, value, label]) => (
              <article
                className="metric-card card"
                key={String(label)}
              >
                <span>{icon}</span>
                <strong>{value}</strong>
                <small>{label}</small>
              </article>
            ))}
          </section>

          <section className="card score-card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">SCORECARD</span>
                <h2>What drives your score</h2>
              </div>

              <span>Operational score</span>
            </div>

            <div className="score-bars">
              {[
                [
                  "Rating",
                  m.rating
                    ? Math.round(
                        (Number(m.rating) / 5) * 100
                      )
                    : 0,
                ],
                [
                  "Acceptance",
                  Number(m.acceptanceRate ?? 0),
                ],
                [
                  "Completion",
                  Number(m.completionRate ?? 0),
                ],
                [
                  "On-time",
                  Number(m.onTimeRate ?? 0),
                ],
                [
                  "Cancellation control",
                  Math.max(
                    0,
                    100 - Number(m.cancellationRate ?? 0)
                  ),
                ],
              ].map(([label, value]) => {
                const numericValue = Math.min(
                  100,
                  Math.max(0, Number(value) || 0)
                );

                return (
                  <div key={String(label)}>
                    <div>
                      <span>{label}</span>
                      <b>{numericValue}%</b>
                    </div>

                    <div className="bar-track">
                      <i
                        style={{
                          width: `${numericValue}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="muted">
              On-time uses the current operational proxy of delivery
              completion within 45 minutes of assignment because ROZZI
              does not yet store a contractual ETA field.
            </p>
          </section>

          <section className="two-col">
            <div className="card">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">ACHIEVEMENTS</span>
                  <h2>Milestones</h2>
                </div>

                <span>{achievements.length} earned</span>
              </div>

              <div className="achievement-list">
                {achievements.map((a: any) => (
                  <div
                    className="achievement"
                    key={a.code}
                  >
                    <span className="achievement-icon">
                      {a.icon || "★"}
                    </span>

                    <div>
                      <b>{a.name}</b>
                      <p>{a.description}</p>
                    </div>

                    <small>Earned</small>
                  </div>
                ))}

                {!achievements.length && (
                  <p className="muted">
                    Complete deliveries and maintain good service
                    quality to build your performance history.
                  </p>
                )}
              </div>
            </div>

            <div className="card">
              <div className="panel-title">
                <div>
                  <span className="eyebrow">EARNINGS</span>
                  <h2>Delivery earnings only</h2>
                </div>

                <Link href="/earnings">
                  View →
                </Link>
              </div>

              <div className="performance-earning-note">
                <div>
                  <b>Your rider income</b>

                  <p>
                    ROZZI rider earnings come from completed
                    deliveries and the delivery fee assigned to
                    those deliveries.
                  </p>
                </div>

                <div className="earning-policy-list">
                  <span>✓ Completed delivery fees</span>
                  <span>✓ Applicable delivery surge</span>
                  <span>✓ Recorded in Rider earnings</span>
                </div>
              </div>

              <p className="muted">
                Performance scores, achievements and challenge
                progress do not create additional monetary rewards.
              </p>
            </div>
          </section>

          <section className="card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">CHALLENGES</span>
                <h2>Progress goals</h2>
              </div>

              <span>Non-monetary</span>
            </div>

            <p className="muted challenge-intro">
              These goals help you track your delivery activity.
              Completing them does not create a cash bonus or
              additional rider payment.
            </p>

            {challenges.length ? (
              <div className="challenge-grid">
                {challenges.map((c: any) => {
                  const target = Math.max(
                    1,
                    Number(c.target) || 1
                  );

                  const progress = Math.max(
                    0,
                    Number(c.progress) || 0
                  );

                  const percentage = Math.min(
                    100,
                    (progress / target) * 100
                  );

                  return (
                    <article
                      className="challenge"
                      key={c.id}
                    >
                      <div className="challenge-top">
                        <span>🎯</span>

                        <b>{c.title}</b>

                        <strong>
                          {c.status === "COMPLETED"
                            ? "Completed"
                            : "In progress"}
                        </strong>
                      </div>

                      <p>{c.description}</p>

                      <div className="challenge-progress">
                        <div>
                          <span>
                            {Math.min(progress, target)} /{" "}
                            {target}
                          </span>

                          <b>{c.status}</b>
                        </div>

                        <div className="bar-track">
                          <i
                            style={{
                              width: `${percentage}%`,
                            }}
                          />
                        </div>
                      </div>

                      <small className="muted">
                        Progress tracking only — no monetary
                        reward.
                      </small>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <b>No active progress goals</b>

                <p>
                  Delivery activity will appear here when ROZZI has
                  an applicable progress goal available.
                </p>
              </div>
            )}
          </section>
        </>
      )}

      <nav className="bottom-nav">
        <Link href="/">
          ⌂
          <span>Home</span>
        </Link>

        <Link
          className="active"
          href="/performance"
        >
          ★
          <span>Performance</span>
        </Link>

        <Link href="/deliveries">
          ▣
          <span>Orders</span>
        </Link>

        <Link href="/earnings">
          ₦
          <span>Earnings</span>
        </Link>

        <Link href="/profile">
          ●
          <span>Me</span>
        </Link>
      </nav>
    </div>
  );
}