'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, patch } from '../../lib/api';

type CartItem = {
  id: string;
  quantity: number;
  unitPriceAmount?: number;
  product?: {
    id?: string;
    name?: string;
    description?: string;
    priceAmount?: number;
    images?: Array<{
      url?: string;
    }>;
  };
  options?: any[];
  selectedOptions?: any[];
};

type Cart = {
  id?: string;
  items?: CartItem[];
};

const money = (amount = 0) =>
  `₦${(Number(amount) / 100).toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function Icon({
  children,
  size = 20,
}: {
  children: React.ReactNode;
  size?: number;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

function CartIcon({ size = 22 }: { size?: number }) {
  return (
    <Icon size={size}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="20" r="1" />
        <circle cx="19" cy="20" r="1" />
        <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
      </svg>
    </Icon>
  );
}

function ArrowLeft() {
  return (
    <Icon size={18}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M19 12H5" />
        <path d="m12 19-7-7 7-7" />
      </svg>
    </Icon>
  );
}

function TrashIcon() {
  return (
    <Icon size={17}>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h16" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M6 7l1 13h10l1-13" />
        <path d="M9 7V4h6v3" />
      </svg>
    </Icon>
  );
}

function PlusIcon() {
  return (
    <Icon size={16}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    </Icon>
  );
}

function MinusIcon() {
  return (
    <Icon size={16}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M5 12h14" />
      </svg>
    </Icon>
  );
}

function ShieldIcon() {
  return (
    <Icon size={18}>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6l8-3Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    </Icon>
  );
}

function ChevronRight() {
  return (
    <Icon size={17}>
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m9 18 6-6-6-6" />
      </svg>
    </Icon>
  );
}

export default function Cart() {
  const [cart, setCart] = useState<Cart>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function load() {
    try {
      setError('');
      const result = await api('/api/cart');
      setCart(result);
    } catch (e: any) {
      setError(e?.message || 'Unable to load your cart.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const items = cart?.items || [];

  const subtotal = useMemo(() => {
    return items.reduce((total, item) => {
      const price =
        Number(item.unitPriceAmount ?? item.product?.priceAmount ?? 0) || 0;

      return total + price * Number(item.quantity || 0);
    }, 0);
  }, [items]);

  async function updateQuantity(item: CartItem, quantity: number) {
    if (quantity < 1) return;

    try {
      setError('');
      setMessage('');
      setUpdatingId(item.id);

      await patch(`/api/cart/items/${item.id}`, {
        quantity,
      });

      await load();
    } catch (e: any) {
      setError(e?.message || 'Unable to update this item.');
    } finally {
      setUpdatingId(null);
    }
  }

  async function removeItem(item: CartItem) {
    try {
      setError('');
      setMessage('');
      setRemovingId(item.id);

      const base =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('rozzi_token')
          : null;

      const response = await fetch(
        `${base}/api/cart/items/${item.id}`,
        {
          method: 'DELETE',
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
          credentials: 'include',
        },
      );

      if (!response.ok) {
        let body: any = null;

        try {
          body = await response.json();
        } catch {}

        throw new Error(
          body?.error?.message ||
            body?.message ||
            'Unable to remove this item.',
        );
      }

      setMessage(`${item.product?.name || 'Item'} removed from your cart.`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Unable to remove this item.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <main className="rozzi-cart-page">
        <style jsx>{`
          .rozzi-cart-page {
            min-height: 100vh;
            background:
              radial-gradient(
                circle at 90% 0%,
                rgba(244, 119, 33, 0.08),
                transparent 28%
              ),
              #fffaf0;
            color: #171717;
          }

          .cart-header {
            position: sticky;
            top: 0;
            z-index: 20;
            background: rgba(255, 255, 255, 0.96);
            backdrop-filter: blur(14px);
            border-bottom: 1px solid #eee8df;
          }

          .header-inner {
            max-width: 1180px;
            margin: 0 auto;
            min-height: 74px;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
          }

          .brand {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            text-decoration: none;
            color: #4d1716;
            font-size: 25px;
            font-weight: 900;
            letter-spacing: -0.8px;
          }

          .brand-logo {
            width: 42px;
            height: 42px;
            object-fit: contain;
            border-radius: 12px;
          }

          .header-links {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .header-link {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 42px;
            padding: 0 14px;
            border-radius: 12px;
            color: #49433d;
            text-decoration: none;
            font-size: 14px;
            font-weight: 700;
          }

          .header-link:hover {
            background: #f8f3eb;
            color: #4d1716;
          }

          .cart-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-height: 42px;
            padding: 0 15px;
            border-radius: 12px;
            background: #4d1716;
            color: #fff;
            text-decoration: none;
            font-size: 14px;
            font-weight: 800;
          }

          .page-wrap {
            max-width: 1180px;
            margin: 0 auto;
            padding: 34px 24px 70px;
          }

          .breadcrumb {
            display: flex;
            align-items: center;
            gap: 7px;
            margin-bottom: 22px;
            color: #77716b;
            font-size: 13px;
          }

          .breadcrumb a {
            color: #77716b;
            text-decoration: none;
          }

          .breadcrumb a:hover {
            color: #4d1716;
          }

          .heading-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 28px;
          }

          .eyebrow {
            margin: 0 0 8px;
            color: #f47721;
            font-size: 12px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          h1 {
            margin: 0;
            color: #4d1716;
            font-size: clamp(32px, 4vw, 48px);
            line-height: 1;
            letter-spacing: -1.8px;
          }

          .heading-copy {
            margin: 10px 0 0;
            max-width: 590px;
            color: #6f747d;
            font-size: 15px;
            line-height: 1.65;
          }

          .content-grid {
            display: grid;
            grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.75fr);
            gap: 22px;
            align-items: start;
          }

          .panel {
            background: #fff;
            border: 1px solid #eee8df;
            border-radius: 22px;
            box-shadow: 0 16px 45px rgba(48, 30, 15, 0.07);
            overflow: hidden;
          }

          .panel-header {
            padding: 22px 24px;
            border-bottom: 1px solid #eee8df;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
          }

          .panel-title {
            margin: 0;
            color: #24211e;
            font-size: 18px;
            font-weight: 850;
          }

          .item-count {
            color: #7b756e;
            font-size: 13px;
            font-weight: 700;
          }

          .cart-item {
            display: grid;
            grid-template-columns: 94px minmax(0, 1fr) auto;
            gap: 18px;
            align-items: center;
            padding: 22px 24px;
            border-bottom: 1px solid #f0ebe4;
          }

          .cart-item:last-child {
            border-bottom: 0;
          }

          .product-image {
            width: 94px;
            height: 94px;
            border-radius: 16px;
            overflow: hidden;
            background: #f8f4ee;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #b2aaa1;
          }

          .product-image img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }

          .product-name {
            margin: 0;
            color: #2b2521;
            font-size: 16px;
            line-height: 1.35;
            font-weight: 850;
          }

          .product-description {
            margin: 6px 0 0;
            color: #817a72;
            font-size: 13px;
            line-height: 1.45;
          }

          .unit-price {
            margin-top: 10px;
            color: #4d1716;
            font-size: 15px;
            font-weight: 900;
          }

          .item-actions {
            margin-top: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .quantity {
            display: inline-flex;
            align-items: center;
            border: 1px solid #ded6cc;
            border-radius: 11px;
            overflow: hidden;
            background: #fff;
          }

          .quantity button {
            width: 34px;
            height: 34px;
            border: 0;
            background: #fff;
            color: #4d1716;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }

          .quantity button:hover {
            background: #fff5eb;
          }

          .quantity-value {
            min-width: 34px;
            text-align: center;
            font-size: 13px;
            font-weight: 850;
          }

          .remove-btn {
            border: 0;
            background: transparent;
            color: #8a8178;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 0;
            cursor: pointer;
            font-size: 12px;
            font-weight: 750;
          }

          .remove-btn:hover {
            color: #c0392b;
          }

          .remove-btn:disabled,
          .quantity button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
          }

          .item-total {
            min-width: 105px;
            text-align: right;
            color: #241f1c;
            font-size: 16px;
            font-weight: 900;
          }

          .summary {
            position: sticky;
            top: 96px;
          }

          .summary-inner {
            padding: 24px;
          }

          .summary-title {
            margin: 0 0 20px;
            color: #2a2420;
            font-size: 19px;
            font-weight: 900;
          }

          .summary-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 15px;
            padding: 10px 0;
            color: #6f6962;
            font-size: 14px;
          }

          .summary-row strong {
            color: #302a26;
          }

          .summary-divider {
            height: 1px;
            margin: 9px 0;
            background: #eee8df;
          }

          .total-row {
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            gap: 15px;
            padding: 16px 0 20px;
          }

          .total-label {
            color: #29231f;
            font-size: 15px;
            font-weight: 850;
          }

          .total-value {
            color: #4d1716;
            font-size: 26px;
            font-weight: 950;
            letter-spacing: -0.7px;
          }

          .checkout {
            width: 100%;
            min-height: 52px;
            border-radius: 14px;
            background: linear-gradient(135deg, #f47721, #e85d0d);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            text-decoration: none;
            font-size: 15px;
            font-weight: 900;
            box-shadow: 0 12px 24px rgba(244, 119, 33, 0.22);
          }

          .checkout:hover {
            transform: translateY(-1px);
          }

          .secure-note {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-top: 17px;
            padding: 13px;
            border-radius: 13px;
            background: #f7f8f5;
            color: #687064;
            font-size: 12px;
            line-height: 1.5;
          }

          .secure-note svg {
            color: #21a45b;
          }

          .shopping-link {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            width: 100%;
            margin-top: 12px;
            min-height: 44px;
            border: 1px solid #ded6cc;
            border-radius: 13px;
            color: #4d1716;
            text-decoration: none;
            font-size: 13px;
            font-weight: 850;
          }

          .shopping-link:hover {
            background: #fff8ef;
          }

          .info-card {
            margin-top: 16px;
            padding: 20px;
            border-radius: 18px;
            background: #4d1716;
            color: #fff;
          }

          .info-card-title {
            margin: 0 0 8px;
            font-size: 15px;
            font-weight: 900;
          }

          .info-card-copy {
            margin: 0;
            color: rgba(255, 255, 255, 0.72);
            font-size: 12px;
            line-height: 1.6;
          }

          .alert {
            margin-bottom: 20px;
            padding: 14px 16px;
            border-radius: 14px;
            font-size: 13px;
            font-weight: 700;
          }

          .alert-error {
            border: 1px solid #f1c7c2;
            background: #fff4f2;
            color: #a92f22;
          }

          .alert-success {
            border: 1px solid #cce5d6;
            background: #f2faf5;
            color: #247344;
          }

          .empty {
            padding: 70px 25px;
            text-align: center;
          }

          .empty-icon {
            width: 76px;
            height: 76px;
            margin: 0 auto 20px;
            border-radius: 24px;
            background: #fff3e8;
            color: #f47721;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .empty h2 {
            margin: 0;
            color: #4d1716;
            font-size: 22px;
          }

          .empty p {
            max-width: 410px;
            margin: 9px auto 22px;
            color: #77716b;
            font-size: 14px;
            line-height: 1.6;
          }

          .empty-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 45px;
            padding: 0 20px;
            border-radius: 12px;
            background: #4d1716;
            color: #fff;
            text-decoration: none;
            font-size: 13px;
            font-weight: 850;
          }

          .skeleton {
            height: 115px;
            margin: 18px 24px;
            border-radius: 16px;
            background: linear-gradient(
              90deg,
              #f4f0eb,
              #faf8f5,
              #f4f0eb
            );
            background-size: 200% 100%;
            animation: shimmer 1.5s infinite;
          }

          @keyframes shimmer {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }

          .mobile-total {
            display: none;
          }

          @media (max-width: 900px) {
            .content-grid {
              grid-template-columns: 1fr;
            }

            .summary {
              position: static;
            }

            .summary-panel {
              order: 2;
            }

            .items-panel {
              order: 1;
            }
          }

          @media (max-width: 640px) {
            .header-inner {
              min-height: 64px;
              padding: 0 16px;
            }

            .brand-logo {
              width: 36px;
              height: 36px;
            }

            .brand {
              font-size: 21px;
            }

            .header-link {
              display: none;
            }

            .cart-pill {
              min-height: 38px;
              padding: 0 11px;
              font-size: 12px;
            }

            .page-wrap {
              padding: 24px 14px 50px;
            }

            .breadcrumb {
              margin-bottom: 18px;
            }

            .heading-row {
              margin-bottom: 22px;
            }

            h1 {
              font-size: 34px;
            }

            .heading-copy {
              font-size: 13px;
            }

            .panel {
              border-radius: 17px;
            }

            .panel-header {
              padding: 18px;
            }

            .cart-item {
              grid-template-columns: 72px minmax(0, 1fr);
              gap: 13px;
              padding: 17px;
            }

            .product-image {
              width: 72px;
              height: 72px;
              border-radius: 13px;
            }

            .item-total {
              display: none;
            }

            .product-name {
              font-size: 14px;
            }

            .product-description {
              font-size: 12px;
            }

            .unit-price {
              margin-top: 7px;
              font-size: 13px;
            }

            .item-actions {
              margin-top: 11px;
            }

            .quantity button {
              width: 32px;
              height: 32px;
            }

            .mobile-total {
              display: block;
              margin-left: auto;
              color: #4d1716;
              font-size: 14px;
              font-weight: 900;
            }

            .summary-inner {
              padding: 19px;
            }
          }
        `}</style>

        <header className="cart-header">
          <div className="header-inner">
            <Link href="/" className="brand">
              <img
                src="/rozzi-logo.png"
                alt="ROZZI"
                className="brand-logo"
              />
              <span>ROZZI</span>
            </Link>

            <div className="header-links">
              <Link href="/" className="header-link">
                Shop
              </Link>

              <Link href="/orders" className="header-link">
                Orders
              </Link>

              <Link href="/account" className="header-link">
                My account
              </Link>

              <Link href="/cart" className="cart-pill">
                <CartIcon size={18} />
                Cart
              </Link>
            </div>
          </div>
        </header>

        <div className="page-wrap">
          <div className="breadcrumb">
            <Link href="/">Home</Link>
            <ChevronRight />
            <span>Cart</span>
          </div>

          <div className="heading-row">
            <div>
              <p className="eyebrow">ROZZI marketplace</p>
              <h1>Your cart</h1>
              <p className="heading-copy">
                Review your items before checkout. You can update quantities
                or remove anything you no longer need.
              </p>
            </div>
          </div>

          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          {message && !error && (
            <div className="alert alert-success">
              {message}
            </div>
          )}

          {loading ? (
            <div className="content-grid">
              <section className="panel">
                <div className="panel-header">
                  <h2 className="panel-title">Your items</h2>
                </div>
                <div className="skeleton" />
                <div className="skeleton" />
              </section>

              <aside className="panel">
                <div className="summary-inner">
                  <div
                    className="skeleton"
                    style={{ margin: 0, height: 250 }}
                  />
                </div>
              </aside>
            </div>
          ) : !items.length ? (
            <section className="panel">
              <div className="empty">
                <div className="empty-icon">
                  <CartIcon size={34} />
                </div>

                <h2>Your cart is empty</h2>

                <p>
                  Looks like you haven't added anything yet. Explore ROZZI
                  and find food, groceries, essentials, gadgets and more.
                </p>

                <Link href="/" className="empty-btn">
                  Start shopping
                </Link>
              </div>
            </section>
          ) : (
            <div className="content-grid">
              <section className="panel items-panel">
                <div className="panel-header">
                  <h2 className="panel-title">Your items</h2>
                  <span className="item-count">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {items.map((item) => {
                  const price =
                    Number(
                      item.unitPriceAmount ??
                        item.product?.priceAmount ??
                        0,
                    ) || 0;

                  const total = price * Number(item.quantity || 0);

                  const image =
                    item.product?.images?.[0]?.url ||
                    '';

                  return (
                    <article className="cart-item" key={item.id}>
                      <div className="product-image">
                        {image ? (
                          <img
                            src={image}
                            alt={item.product?.name || 'Product'}
                          />
                        ) : (
                          <CartIcon size={30} />
                        )}
                      </div>

                      <div>
                        <h3 className="product-name">
                          {item.product?.name || 'Product'}
                        </h3>

                        {item.product?.description && (
                          <p className="product-description">
                            {item.product.description.length > 90
                              ? `${item.product.description.slice(0, 90)}…`
                              : item.product.description}
                          </p>
                        )}

                        <div className="unit-price">
                          {money(price)}
                        </div>

                        <div className="item-actions">
                          <div className="quantity">
                            <button
                              type="button"
                              disabled={
                                updatingId === item.id ||
                                removingId === item.id ||
                                item.quantity <= 1
                              }
                              onClick={() =>
                                updateQuantity(
                                  item,
                                  Number(item.quantity) - 1,
                                )
                              }
                              aria-label="Decrease quantity"
                            >
                              <MinusIcon />
                            </button>

                            <span className="quantity-value">
                              {item.quantity}
                            </span>

                            <button
                              type="button"
                              disabled={
                                updatingId === item.id ||
                                removingId === item.id
                              }
                              onClick={() =>
                                updateQuantity(
                                  item,
                                  Number(item.quantity) + 1,
                                )
                              }
                              aria-label="Increase quantity"
                            >
                              <PlusIcon />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="remove-btn"
                            disabled={
                              removingId === item.id ||
                              updatingId === item.id
                            }
                            onClick={() => removeItem(item)}
                          >
                            <TrashIcon />
                            {removingId === item.id
                              ? 'Removing…'
                              : 'Remove'}
                          </button>

                          <span className="mobile-total">
                            {money(total)}
                          </span>
                        </div>
                      </div>

                      <div className="item-total">
                        {money(total)}
                      </div>
                    </article>
                  );
                })}
              </section>

              <aside className="summary-panel">
                <div className="panel summary">
                  <div className="summary-inner">
                    <h2 className="summary-title">
                      Order summary
                    </h2>

                    <div className="summary-row">
                      <span>Subtotal</span>
                      <strong>{money(subtotal)}</strong>
                    </div>

                    <div className="summary-row">
                      <span>Delivery</span>
                      <strong>Calculated at checkout</strong>
                    </div>

                    <div className="summary-divider" />

                    <div className="total-row">
                      <span className="total-label">
                        Estimated total
                      </span>
                      <span className="total-value">
                        {money(subtotal)}
                      </span>
                    </div>

                    <Link href="/checkout" className="checkout">
                      Proceed to checkout
                      <ChevronRight />
                    </Link>

                    <div className="secure-note">
                      <span style={{ color: '#21a45b' }}>
                        <ShieldIcon />
                      </span>
                      <span>
                        Your order and payment details are protected.
                        Final delivery and applicable service fees are
                        confirmed during checkout.
                      </span>
                    </div>

                    <Link href="/" className="shopping-link">
                      <ArrowLeft />
                      Continue shopping
                    </Link>
                  </div>
                </div>

                <div className="info-card">
                  <h3 className="info-card-title">
                    Everything you need, one place.
                  </h3>
                  <p className="info-card-copy">
                    Shop food, groceries, daily essentials, gadgets and
                    more from businesses available around you.
                  </p>
                </div>
              </aside>
            </div>
          )}
        </div>
      </main>
    </>
  );
}