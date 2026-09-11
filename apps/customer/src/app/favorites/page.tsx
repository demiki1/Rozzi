'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';

type FavoriteProduct = {
  id: string;
  name: string;
  priceAmount: number;
  discountAmount?: number | null;
  unit?: string | null;
  isAvailable?: boolean;
  favoritedAt?: string;
  images?: Array<{
    url: string;
  }>;
  vendor?: {
    id: string;
    storeName: string;
    logoUrl?: string | null;
  };
  category?: {
    id: string;
    name: string;
  } | null;
};

type FavoriteVendor = {
  id: string;
  storeName: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  phone?: string | null;
  holidayMode?: boolean;
  busyMode?: boolean;
  favoritedAt?: string;
};

type FavoritesResponse = {
  products: FavoriteProduct[];
  vendors: FavoriteVendor[];
};

function formatNaira(kobo: number) {
  return `₦${(kobo / 100).toLocaleString('en-NG')}`;
}

function productPrice(product: FavoriteProduct) {
  const base = product.priceAmount || 0;
  const discount = product.discountAmount || 0;

  return discount > 0
    ? Math.max(0, base - discount)
    : base;
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function FavoritesPage() {
  const router = useRouter();

  const [favorites, setFavorites] =
    useState<FavoritesResponse>({
      products: [],
      vendors: [],
    });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState('');

  async function loadFavorites() {
    setError('');

    try {
      const currentToken =
        typeof window !== 'undefined'
          ? localStorage.getItem('rozzi_token')
          : null;

      if (!currentToken) {
        router.replace('/login?next=/favorites');
        return;
      }

      const data = await api<FavoritesResponse>(
        '/api/favorites',
      );

      setFavorites({
        products: Array.isArray(data?.products)
          ? data.products
          : [],
        vendors: Array.isArray(data?.vendors)
          ? data.vendors
          : [],
      });
    } catch (e: any) {
      const message = String(e?.message || '');

      if (
        message.toLowerCase().includes('unauthorized') ||
        message.toLowerCase().includes('session') ||
        message.includes('(401)')
      ) {
        router.replace('/login?next=/favorites');
        return;
      }

      setError(
        message ||
          'Unable to load your favorites. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  async function removeProduct(productId: string) {
    setRemoving(`product:${productId}`);
    setError('');

    try {
      await api(`/api/favorites/products/${productId}`, {
        method: 'DELETE',
      });

      setFavorites((current) => ({
        ...current,
        products: current.products.filter(
          (product) => product.id !== productId,
        ),
      }));
    } catch (e: any) {
      setError(
        e?.message ||
          'Unable to remove this product from favorites.',
      );
    } finally {
      setRemoving('');
    }
  }

  async function removeVendor(vendorId: string) {
    setRemoving(`vendor:${vendorId}`);
    setError('');

    try {
      await api(`/api/favorites/vendors/${vendorId}`, {
        method: 'DELETE',
      });

      setFavorites((current) => ({
        ...current,
        vendors: current.vendors.filter(
          (vendor) => vendor.id !== vendorId,
        ),
      }));
    } catch (e: any) {
      setError(
        e?.message ||
          'Unable to remove this vendor from favorites.',
      );
    } finally {
      setRemoving('');
    }
  }

  const totalFavorites =
    favorites.products.length +
    favorites.vendors.length;

  return (
    <main className="shell favorites-page">
      <nav className="nav">
        <Link className="brand" href="/">
          ROZZI
        </Link>

        <div className="navlinks">
          <Link href="/">Shop</Link>
          <Link href="/orders">Orders</Link>
          <Link href="/account">Account</Link>
          <Link href="/cart">Cart</Link>
        </div>
      </nav>

      <div className="favorites-container">
        <div className="favorites-header">
          <div>
            <span className="favorites-kicker">
              YOUR ROZZI
            </span>

            <h1>Favorites</h1>

            <p>
              Keep your favorite products and stores close
              so you can find them quickly next time.
            </p>
          </div>

          <Link
            href="/"
            className="favorites-shop-button"
          >
            Continue shopping
          </Link>
        </div>

        {error && (
          <div className="favorites-error">
            {error}
          </div>
        )}

        {loading ? (
          <section className="favorites-card">
            <div className="favorites-loading">
              <div className="favorites-spinner" />
              <p>Loading your favorites…</p>
            </div>
          </section>
        ) : totalFavorites === 0 ? (
          <section className="favorites-empty">
            <div className="favorites-empty-icon">
              ♥
            </div>

            <h2>No favorites yet</h2>

            <p>
              Save products and stores you love and they
              will appear here.
            </p>

            <Link
              href="/"
              className="favorites-primary-button"
            >
              Explore ROZZI
            </Link>
          </section>
        ) : (
          <>
            {favorites.products.length > 0 && (
              <section className="favorites-section">
                <div className="favorites-section-heading">
                  <div>
                    <span className="favorites-section-kicker">
                      PRODUCTS
                    </span>
                    <h2>
                      Favorite products
                    </h2>
                  </div>

                  <span className="favorites-count">
                    {favorites.products.length}
                  </span>
                </div>

                <div className="favorites-product-grid">
                  {favorites.products.map((product) => {
                    const price =
                      productPrice(product);

                    const originalPrice =
                      product.discountAmount &&
                      product.discountAmount > 0
                        ? product.priceAmount
                        : null;

                    const image =
                      product.images?.[0]?.url;

                    return (
                      <article
                        className="favorites-product-card"
                        key={product.id}
                      >
                        <Link
                          href={`/products/${product.id}`}
                          className="favorites-product-image"
                        >
                          {image ? (
                            <img
                              src={image}
                              alt={product.name}
                            />
                          ) : (
                            <div className="favorites-product-placeholder">
                              <span>
                                {product.name
                                  .charAt(0)
                                  .toUpperCase()}
                              </span>
                            </div>
                          )}

                          {!product.isAvailable && (
                            <span className="favorites-unavailable">
                              Currently unavailable
                            </span>
                          )}
                        </Link>

                        <div className="favorites-product-body">
                          <div className="favorites-product-top">
                            <div>
                              <span className="favorites-category">
                                {product.category?.name ||
                                  'Marketplace'}
                              </span>

                              <Link
                                href={`/products/${product.id}`}
                                className="favorites-product-name"
                              >
                                {product.name}
                              </Link>
                            </div>

                            <button
                              type="button"
                              className="favorites-heart-button"
                              onClick={() =>
                                removeProduct(
                                  product.id,
                                )
                              }
                              disabled={
                                removing ===
                                `product:${product.id}`
                              }
                              aria-label={`Remove ${product.name} from favorites`}
                              title="Remove from favorites"
                            >
                              ♥
                            </button>
                          </div>

                          {product.vendor && (
                            <p className="favorites-vendor-name">
                              {product.vendor.storeName}
                            </p>
                          )}

                          <div className="favorites-product-footer">
                            <div>
                              <strong>
                                {formatNaira(price)}
                              </strong>

                              {originalPrice && (
                                <del>
                                  {formatNaira(
                                    originalPrice,
                                  )}
                                </del>
                              )}
                            </div>

                            {product.unit && (
                              <span>
                                {product.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {favorites.vendors.length > 0 && (
              <section className="favorites-section">
                <div className="favorites-section-heading">
                  <div>
                    <span className="favorites-section-kicker">
                      STORES
                    </span>
                    <h2>
                      Favorite stores
                    </h2>
                  </div>

                  <span className="favorites-count">
                    {favorites.vendors.length}
                  </span>
                </div>

                <div className="favorites-vendor-grid">
                  {favorites.vendors.map((vendor) => {
                    const unavailable =
                      vendor.holidayMode ||
                      vendor.busyMode;

                    return (
                      <article
                        className="favorites-vendor-card"
                        key={vendor.id}
                      >
                        <div className="favorites-vendor-cover">
                          {vendor.coverImageUrl ? (
                            <img
                              src={
                                vendor.coverImageUrl
                              }
                              alt=""
                            />
                          ) : (
                            <div />
                          )}
                        </div>

                        <div className="favorites-vendor-content">
                          <div className="favorites-vendor-avatar">
                            {vendor.logoUrl ? (
                              <img
                                src={vendor.logoUrl}
                                alt={
                                  vendor.storeName
                                }
                              />
                            ) : (
                              initials(
                                vendor.storeName,
                              )
                            )}
                          </div>

                          <div className="favorites-vendor-main">
                            <div className="favorites-vendor-title-row">
                              <div>
                                <h3>
                                  {vendor.storeName}
                                </h3>

                                <span
                                  className={
                                    unavailable
                                      ? 'favorites-store-status is-busy'
                                      : 'favorites-store-status'
                                  }
                                >
                                  {vendor.holidayMode
                                    ? 'Holiday mode'
                                    : vendor.busyMode
                                      ? 'Busy right now'
                                      : 'Available'}
                                </span>
                              </div>

                              <button
                                type="button"
                                className="favorites-heart-button"
                                onClick={() =>
                                  removeVendor(
                                    vendor.id,
                                  )
                                }
                                disabled={
                                  removing ===
                                  `vendor:${vendor.id}`
                                }
                                aria-label={`Remove ${vendor.storeName} from favorites`}
                                title="Remove from favorites"
                              >
                                ♥
                              </button>
                            </div>

                            <div className="favorites-vendor-actions">
                              <Link
                                href="/"
                                className="favorites-outline-button"
                              >
                                Shop
                              </Link>

                              <button
                                type="button"
                                className="favorites-remove-button"
                                onClick={() =>
                                  removeVendor(
                                    vendor.id,
                                  )
                                }
                                disabled={
                                  removing ===
                                  `vendor:${vendor.id}`
                                }
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        <div className="favorites-back">
          <Link href="/account">
            ← Back to Account
          </Link>
        </div>
      </div>
    </main>
  );
}