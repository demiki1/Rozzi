"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

type Refund = {
  id: string;
  amount: number;
  reason: string;
  status: string;
  providerReference?: string | null;
  processedAt?: string | null;
  createdAt: string;
  order?: {
    id: string;
    orderNumber: string;
    status: string;
  } | null;
  payment?: {
    provider: string;
    reference: string;
    status: string;
  } | null;
};

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount?: number;
  total?: number;
  createdAt?: string;
};

function formatNaira(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusClass(status: string) {
  switch (status.toUpperCase()) {
    case "SUCCEEDED":
    case "SUCCESS":
    case "COMPLETED":
    case "PROCESSED":
    case "APPROVED":
      return "refund-status refund-status-success";

    case "REJECTED":
    case "FAILED":
    case "CANCELLED":
      return "refund-status refund-status-danger";

    case "PROCESSING":
    case "PENDING":
      return "refund-status refund-status-warning";

    default:
      return "refund-status";
  }
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);

  const [error, setError] = useState("");
  const [ordersError, setOrdersError] = useState("");

  const [showRequestForm, setShowRequestForm] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

  async function loadRefunds() {
    try {
      setLoading(true);
      setError("");

      const data = await api<Refund[]>(
        "/api/support/refunds"
      );

      setRefunds(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your refund requests."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadOrders() {
    try {
      setOrdersLoading(true);
      setOrdersError("");

      /*
       * The customer Orders page is the source of the customer's
       * real order history. We use it here only to populate the
       * refund-request selector.
       */
     const data = await api<Order[]>("/api/orders/mine");

      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setOrdersError(
        err instanceof Error
          ? err.message
          : "Unable to load your orders."
      );
    } finally {
      setOrdersLoading(false);
    }
  }

  useEffect(() => {
    loadRefunds();
    loadOrders();
  }, []);

  function openRequestForm() {
    setSubmitError("");
    setSubmitSuccess("");
    setShowRequestForm(true);
  }

  function closeRequestForm() {
    if (submitting) return;

    setShowRequestForm(false);
    setSelectedOrderId("");
    setAmount("");
    setReason("");
    setSubmitError("");
  }

  async function submitRefundRequest(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!selectedOrderId) {
      setSubmitError("Please select an order.");
      return;
    }

    if (!reason.trim()) {
      setSubmitError("Please provide a reason for the refund.");
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");
      setSubmitSuccess("");

      const payload: {
        orderId: string;
        reason: string;
        amount?: number;
      } = {
        orderId: selectedOrderId,
        reason: reason.trim(),
      };

      if (amount.trim()) {
        const parsedAmount = Number(amount);

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
          setSubmitError("Enter a valid refund amount.");
          setSubmitting(false);
          return;
        }

        /*
         * ROZZI stores monetary values in kobo.
         * Customer enters normal naira here.
         */
        payload.amount = Math.round(parsedAmount * 100);
      }

      await api("/api/support/refunds", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setSubmitSuccess(
        "Your refund request has been submitted. An admin will review it."
      );

      setShowRequestForm(false);
      setSelectedOrderId("");
      setAmount("");
      setReason("");

      await loadRefunds();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Unable to submit your refund request."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="refunds-page">
      <header className="refunds-header">
        <div className="refunds-header-inner">
          <Link href="/account" className="refunds-back">
            Account
          </Link>

          <Link href="/" className="refunds-brand">
            <img src="/rozzi-logo.png" alt="ROZZI" />
          </Link>
        </div>
      </header>

      <section className="refunds-container">
        <div className="refunds-title-row">
          <div>
            <p className="refunds-eyebrow">PAYMENT SUPPORT</p>
            <h1>Refunds</h1>
            <p>
              Request a refund and track the status of your
              previous requests.
            </p>
          </div>

          <button
            type="button"
            className="refunds-primary-button"
            onClick={openRequestForm}
          >
            Request a refund
          </button>
        </div>

        {submitSuccess && (
          <div className="refunds-success-banner">
            <span>âœ“</span>
            <p>{submitSuccess}</p>
          </div>
        )}

        {showRequestForm && (
          <section className="refunds-request-card">
            <div className="refunds-request-heading">
              <div>
                <p className="refunds-eyebrow">NEW REQUEST</p>
                <h2>Request a refund</h2>
              </div>

              <button
                type="button"
                className="refunds-close"
                onClick={closeRequestForm}
                disabled={submitting}
                aria-label="Close refund form"
              >
                Ã—
              </button>
            </div>

            <div className="refunds-admin-note">
              <div className="refunds-admin-note-icon">i</div>
              <div>
                <strong>Admin review required</strong>
                <p>
                  Your request will be submitted for review.
                  Only ROZZI Admin can approve or process a
                  refund.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="refunds-form-error">
                {submitError}
              </div>
            )}

            {ordersError && (
              <div className="refunds-form-error">
                {ordersError}
              </div>
            )}

            <form
              className="refunds-form"
              onSubmit={submitRefundRequest}
            >
              <label>
                <span>Order</span>

                <select
                  value={selectedOrderId}
                  onChange={(event) =>
                    setSelectedOrderId(event.target.value)
                  }
                  disabled={submitting || ordersLoading}
                  required
                >
                  <option value="">
                    {ordersLoading
                      ? "Loading orders..."
                      : "Select an order"}
                  </option>

                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} â€”{" "}
                      {statusLabel(order.status)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>
                  Amount <em>optional</em>
                </span>

                <div className="refunds-input-prefix">
                  <span>â‚¦</span>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(event) =>
                      setAmount(event.target.value)
                    }
                    placeholder="Leave blank for full eligible amount"
                    disabled={submitting}
                  />
                </div>
              </label>

              <label>
                <span>Reason</span>

                <textarea
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  placeholder="Tell us why you are requesting a refund..."
                  rows={5}
                  maxLength={1000}
                  disabled={submitting}
                  required
                />

                <small>
                  {reason.length}/1000
                </small>
              </label>

              <div className="refunds-form-actions">
                <button
                  type="button"
                  className="refunds-secondary-button"
                  onClick={closeRequestForm}
                  disabled={submitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="refunds-primary-button"
                  disabled={submitting}
                >
                  {submitting
                    ? "Submitting..."
                    : "Submit request"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="refunds-section">
          <div className="refunds-section-heading">
            <div>
              <h2>Refund history</h2>
              <p>Your submitted refund requests.</p>
            </div>

            <span className="refunds-total">
              {refunds.length}{" "}
              {refunds.length === 1 ? "request" : "requests"}
            </span>
          </div>

          {loading && (
            <div className="refunds-state-card">
              <div className="refunds-spinner" />
              <p>Loading refund history...</p>
            </div>
          )}

          {!loading && error && (
            <div className="refunds-state-card refunds-error-state">
              <div className="refunds-state-icon">!</div>
              <h3>Couldnâ€™t load refunds</h3>
              <p>{error}</p>

              <button
                type="button"
                className="refunds-secondary-button"
                onClick={loadRefunds}
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && refunds.length === 0 && (
            <div className="refunds-state-card">
              <div className="refunds-empty-icon">↻</div>
              <h3>No refund requests</h3>
              <p>
                You have not submitted any refund requests yet.
              </p>

              <button
                type="button"
                className="refunds-primary-button"
                onClick={openRequestForm}
              >
                Request a refund
              </button>
            </div>
          )}

          {!loading && !error && refunds.length > 0 && (
            <div className="refunds-list">
              {refunds.map((refund) => (
                <article
                  key={refund.id}
                  className="refunds-history-card"
                >
                  <div className="refunds-history-top">
                    <div>
                      <p className="refunds-order-label">
                        ORDER
                      </p>

                      <h3>
                        {refund.order?.orderNumber ||
                          "ROZZI Order"}
                      </h3>

                      <time dateTime={refund.createdAt}>
                        Requested {formatDate(refund.createdAt)}
                      </time>
                    </div>

                    <span
                      className={statusClass(refund.status)}
                    >
                      {statusLabel(refund.status)}
                    </span>
                  </div>

                  <div className="refunds-details">
                    <div>
                      <span>Requested amount</span>
                      <strong>
                        {formatNaira(refund.amount)}
                      </strong>
                    </div>

                    <div>
                      <span>Reason</span>
                      <strong className="refunds-reason">
                        {refund.reason}
                      </strong>
                    </div>
                  </div>

                  {refund.payment && (
                    <div className="refunds-payment">
                      <span>Payment</span>
                      <strong>
                        {refund.payment.provider} Â·{" "}
                        {refund.payment.reference}
                      </strong>
                    </div>
                  )}

                  {refund.providerReference && (
                    <div className="refunds-payment">
                      <span>Refund reference</span>
                      <strong>
                        {refund.providerReference}
                      </strong>
                    </div>
                  )}

                  {refund.processedAt && (
                    <div className="refunds-payment">
                      <span>Processed</span>
                      <strong>
                        {formatDate(refund.processedAt)}
                      </strong>
                    </div>
                  )}

                  <div className="refunds-history-footer">
                    {refund.order?.id ? (
                      <Link
                        href={`/orders/${refund.order.id}`}
                        className="refunds-order-link"
                      >
                        View order â†’
                      </Link>
                    ) : (
                      <span />
                    )}

                    <span className="refunds-review-note">
                      Admin review
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="refunds-info">
          <div className="refunds-info-icon">i</div>

          <div>
            <strong>Refund process</strong>
            <p>
              Submit your request with a clear reason. Your
              request enters the ROZZI admin review process.
              Customers cannot approve, process, or reject
              refunds themselves.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}



