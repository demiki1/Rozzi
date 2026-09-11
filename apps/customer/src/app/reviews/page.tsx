"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Review = {
  id: string;
  orderId: string;
  vendorRating: number | null;
  riderRating: number | null;
  productRating: number | null;
  title: string | null;
  comment: string | null;
  photoUrls?: string[];
  createdAt: string;
  vendor?: {
    id: string;
    storeName: string;
    logoUrl?: string | null;
  } | null;
  product?: {
    id: string;
    name: string;
  } | null;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rozzi_token");
}

async function apiRequest<T>(path: string): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    let message = "Unable to load reviews.";

    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      // Keep default message.
    }

    throw new Error(
      Array.isArray(message) ? message.join(", ") : message
    );
  }

  return response.json();
}

function RatingStars({ rating }: { rating: number | null }) {
  const value = Math.max(0, Math.min(5, rating ?? 0));

  return (
    <span
      className="reviews-stars"
      aria-label={`${value} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <span
          key={index}
          className={
            index < value
              ? "reviews-star reviews-star-filled"
              : "reviews-star"
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-NG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReviews() {
      try {
        setLoading(true);
        setError("");

        const data = await apiRequest<Review[]>("/api/reviews/mine");

        if (active) {
          setReviews(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your reviews."
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadReviews();

    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="reviews-page">
      <header className="reviews-header">
        <div className="reviews-header-inner">
          <Link href="/account" className="reviews-back">
            ← Account
          </Link>

          <Link href="/" className="reviews-brand">
            <img
              src="/rozzi-logo.png"
              alt="ROZZI"
            />
          </Link>
        </div>
      </header>

      <section className="reviews-container">
        <div className="reviews-title-row">
          <div>
            <p className="reviews-eyebrow">YOUR EXPERIENCE</p>
            <h1>My Reviews</h1>
            <p>
              See the feedback you have shared about your ROZZI
              orders.
            </p>
          </div>

          <div className="reviews-count">
            <strong>{reviews.length}</strong>
            <span>
              {reviews.length === 1 ? "Review" : "Reviews"}
            </span>
          </div>
        </div>

        {loading && (
          <div className="reviews-card reviews-loading">
            <div className="reviews-spinner" />
            <p>Loading your reviews...</p>
          </div>
        )}

        {!loading && error && (
          <div className="reviews-card reviews-error">
            <div className="reviews-error-icon">!</div>

            <div>
              <h2>Couldn’t load your reviews</h2>
              <p>{error}</p>

              <button
                type="button"
                className="reviews-retry"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && reviews.length === 0 && (
          <div className="reviews-card reviews-empty">
            <div className="reviews-empty-icon">★</div>

            <h2>No reviews yet</h2>

            <p>
              Once you complete an order, you can share your
              experience with the vendor, rider, and product.
            </p>

            <Link href="/orders" className="reviews-primary-button">
              View my orders
            </Link>
          </div>
        )}

        {!loading && !error && reviews.length > 0 && (
          <div className="reviews-list">
            {reviews.map((review) => (
              <article key={review.id} className="reviews-card">
                <div className="reviews-card-top">
                  <div className="reviews-business">
                    <div className="reviews-avatar">
                      {review.vendor?.logoUrl ? (
                        <img
                          src={review.vendor.logoUrl}
                          alt=""
                        />
                      ) : (
                        <span>
                          {(
                            review.vendor?.storeName ||
                            "R"
                          )
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div>
                      <h2>
                        {review.vendor?.storeName ||
                          "ROZZI Vendor"}
                      </h2>

                      {review.product?.name && (
                        <p>{review.product.name}</p>
                      )}
                    </div>
                  </div>

                  <time dateTime={review.createdAt}>
                    {formatDate(review.createdAt)}
                  </time>
                </div>

                <div className="reviews-rating-grid">
                  {review.productRating !== null && (
                    <div className="reviews-rating">
                      <span>Product</span>
                      <RatingStars
                        rating={review.productRating}
                      />
                    </div>
                  )}

                  {review.vendorRating !== null && (
                    <div className="reviews-rating">
                      <span>Vendor</span>
                      <RatingStars
                        rating={review.vendorRating}
                      />
                    </div>
                  )}

                  {review.riderRating !== null && (
                    <div className="reviews-rating">
                      <span>Rider</span>
                      <RatingStars
                        rating={review.riderRating}
                      />
                    </div>
                  )}
                </div>

                {review.title && (
                  <h3 className="reviews-review-title">
                    {review.title}
                  </h3>
                )}

                {review.comment && (
                  <p className="reviews-comment">
                    {review.comment}
                  </p>
                )}

                {review.photoUrls &&
                  review.photoUrls.length > 0 && (
                    <div className="reviews-photos">
                      {review.photoUrls.map((url) => (
                        <img
                          key={url}
                          src={url}
                          alt="Review photo"
                        />
                      ))}
                    </div>
                  )}

                <div className="reviews-card-footer">
                  <Link
                    href={`/orders/${review.orderId}`}
                    className="reviews-order-link"
                  >
                    View order →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="reviews-info">
          <div className="reviews-info-icon">i</div>

          <div>
            <strong>How ROZZI reviews work</strong>
            <p>
              Reviews are connected to completed deliveries. You
              can rate your experience with the product, vendor,
              and rider when submitting feedback.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}