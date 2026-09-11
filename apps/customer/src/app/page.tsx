'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, post } from '../lib/api';

const categoryVisuals: Record<string, { icon: string; tone: string }> = {
  food: { icon: '🍲', tone: 'orange' },
  groceries: { icon: '🛒', tone: 'green' },
  health: { icon: '💊', tone: 'red' },
  'personal items': { icon: '🧴', tone: 'violet' },
  'mini gadgets': { icon: '📱', tone: 'blue' },
  gadgets: { icon: '🎧', tone: 'blue' },
  drinks: { icon: '🥤', tone: 'yellow' },
  fashion: { icon: '👕', tone: 'pink' },
  home: { icon: '🏠', tone: 'teal' },
};

const fallbackCategories = [
  { id: 'food', name: 'Food' },
  { id: 'groceries', name: 'Groceries' },
  { id: 'health', name: 'Health' },
  { id: 'personal', name: 'Personal Care' },
  { id: 'gadgets', name: 'Mini Gadgets' },
  { id: 'drinks', name: 'Drinks' },
];

function categoryStyle(name: string) {
  return categoryVisuals[name.toLowerCase()] ?? { icon: '✨', tone: 'orange' };
}

function money(value: number) {
  return `₦${(value / 100).toLocaleString('en-NG')}`;
}

function vendorName(product: any) {
  return product.vendor?.businessName || product.vendor?.name || product.vendor?.storeName || 'Local vendor';
}

function vendorKey(product: any) {
  return product.vendor?.id || vendorName(product);
}

export default function Home() {
  const [banners, setBanners] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [area, setArea] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('');

  const vendorUrl = process.env.NEXT_PUBLIC_VENDOR_URL || 'http://localhost:3003';
  const riderUrl = process.env.NEXT_PUBLIC_RIDER_URL || 'http://localhost:3004';

  useEffect(() => {
    let cancelled = false;
    async function loadHome() {
      try {
        const [b, a, c, p] = await Promise.all([
          api('/api/advertising/banners/HOME'),
          api('/api/service-areas'),
          api('/api/categories'),
          api('/api/products'),
        ]);
        const serviceAreas = Array.isArray(a) ? a : [];
        const listings = await Promise.all(serviceAreas.map((serviceArea) => api(`/api/service-areas/${serviceArea.id}/vendors`)));
        const visibleVendors = Array.from(new Map(listings.flat().map((vendor: any) => [vendor.id, vendor])).values());
        if (cancelled) return;
        setBanners(Array.isArray(b) ? b : []);
        setAreas(serviceAreas);
        setCats(Array.isArray(c) && c.length ? c : fallbackCategories);
        setProducts(p?.items ?? []);
        setVendors(visibleVendors);
      } catch (e: any) {
        if (!cancelled) setErr(e.message || 'We could not load the marketplace right now.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadHome();
    return () => { cancelled = true; };
  }, []);

  async function search() {
    setErr('');
    setLoading(true);
    try {
      const result = await api('/api/products?' + new URLSearchParams({
        ...(q ? { search: q } : {}),
        ...(area ? { serviceAreaId: area } : {}),
        ...(activeCategory ? { categoryId: activeCategory } : {}),
      }).toString());
      setProducts(result.items ?? []);
    } catch (e: any) {
      setErr(e.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function chooseCategory(id: string) {
    const next = activeCategory === id ? '' : id;
    setActiveCategory(next);
    setLoading(true);
    setErr('');
    api('/api/products?' + new URLSearchParams({
      ...(q ? { search: q } : {}),
      ...(area ? { serviceAreaId: area } : {}),
      ...(next ? { categoryId: next } : {}),
    }).toString())
      .then((result) => setProducts(result.items ?? []))
      .catch((e) => setErr(e.message || 'Could not load that category.'))
      .finally(() => setLoading(false));
  }

  async function addToCart(productId: string) {
    try {
      await post('/api/cart/items', { productId, quantity: 1 });
      setCartCount((count) => count + 1);
    } catch (e: any) {
      setErr(e.message || 'Please log in to add items to your cart.');
    }
  }

  function toggleFavorite(id: string) {
    setFavoriteIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  const vendorCards = useMemo(() => vendors.slice(0, 6), [vendors]);
  const firstProductByVendor = useMemo(() => new Map(products.map((product) => [product.vendor?.id, product])), [products]);

  const quickProducts = products.slice(0, 4);
  const recommendedProducts = products.slice(4, 10).length ? products.slice(4, 10) : products.slice(0, 6);

  return (
    <div className="customer-app">
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="logo-lockup" aria-label="ROZZI home">
            <span className="logo-mark"><img src="/rozzi-logo.png" alt="ROZZI Marketplace" /></span>
            <span className="logo-word">ROZZI</span>
          </Link>

          <button className="location-chip" onClick={() => document.getElementById('delivery-area')?.focus()}>
            <span className="icon-bubble">⌖</span>
            <span><small>Deliver to</small><strong>{areas.find((a) => a.id === area)?.name || 'Choose area'}</strong></span>
            <span className="chevron">⌄</span>
          </button>

          <div className="header-search">
            <span>⌕</span>
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Search food, groceries, gadgets..." />
            <button onClick={search}>Search</button>
          </div>

          <nav className="desktop-nav" aria-label="Customer navigation">
            <Link href="/orders">Orders</Link>
            <Link href="/wallet">Wallet</Link>
            <Link href="/notifications" className="nav-icon" aria-label="Notifications">♢</Link>
            <Link href="/cart" className="cart-link"><span>🛒</span><b>{cartCount || ''}</b></Link>
            <Link href="/login" className="account-link"><span>●</span><em>Account</em></Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero-wrap shell">
          <div className="hero-card hero-card-clean">
            <div className="hero-copy">
              <h1>Everything you need.<br /><span>Delivered with a smile.</span></h1>
              <p>Food, groceries, essentials, and more — all from trusted local vendors.</p>
              <div className="hero-search">
                <span>⌕</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="What are you looking for today?" />
                <button onClick={search}>Find it</button>
              </div>
              <div className="popular-searches"><span>Popular:</span><button onClick={() => { setQ('Jollof Rice'); search(); }}>Jollof Rice</button><button onClick={() => { setQ('Groceries'); search(); }}>Groceries</button><button onClick={() => { setQ('Drinks'); search(); }}>Drinks</button><button onClick={() => { setQ('Accessories'); search(); }}>Accessories</button></div>
            </div>
          </div>
        </section>

        <section className="shell section-block">
          <div className="section-heading"><div><span className="section-kicker">EXPLORE</span><h2>What are you shopping for?</h2></div><button className="link-button" onClick={() => { setActiveCategory(''); search(); }}>View all <span>→</span></button></div>
          <div className="category-scroller">
            {(cats.length ? cats : fallbackCategories).map((c) => {
              const visual = categoryStyle(c.name);
              return <button key={c.id} className={`category-card ${visual.tone} ${activeCategory === c.id ? 'active' : ''}`} onClick={() => chooseCategory(c.id)}><span className="category-icon">{visual.icon}</span><strong>{c.name}</strong><small>Explore now <span>→</span></small></button>;
            })}
          </div>
        </section>

        {banners.length > 0 && <section className="shell section-block">
          <div className="section-heading"><div><span className="section-kicker">ROZZI DEALS</span><h2>Special offers for you</h2></div><button className="link-button">See all <span>→</span></button></div>
          <div className="promo-grid">{banners.slice(0, 3).map((b, i) => <a className={`promo-card promo-${i % 3}`} key={b.id} href={b.targetUrl || '#'}><div><span className="promo-pill">LIMITED TIME</span><h3>{b.title || 'Save more with ROZZI'}</h3><p>Fresh deals from stores near you.</p><span className="promo-cta">Shop deal →</span></div><img src={b.imageUrl} alt={b.title || 'ROZZI offer'} /></a>)}</div>
        </section>}

        <section className="shell section-block">
          <div className="section-heading"><div><span className="section-kicker">NEAR YOU</span><h2>Popular near you</h2></div><span className="muted-label">Curated for your area</span></div>
          <div className="vendor-grid">{vendorCards.map((vendor) => { const product = firstProductByVendor.get(vendor.id); return <article className="vendor-card" key={vendor.id}><div className="vendor-image"><span className="vendor-badge">⚡ Fast</span>{vendor.coverImageUrl ? <img src={vendor.coverImageUrl} alt={`${vendor.storeName} cover`} /> : <div className="image-placeholder">🛍️</div>}<button className="heart" onClick={() => toggleFavorite(vendor.id)}>{favoriteIds.includes(vendor.id) ? '♥' : '♡'}</button>{vendor.logoUrl && <span className="vendor-logo"><img src={vendor.logoUrl} alt={`${vendor.storeName} logo`} /></span>}</div><div className="vendor-info"><h3>{vendor.storeName || 'Local vendor'}</h3><div className="vendor-meta"><span>★ 4.8</span><span>•</span><span>15–25 min</span></div><p>{vendor.vendorType?.name || 'Marketplace'} · Local store</p><div className="vendor-bottom"><span>🛵 From ₦500</span>{product ? <Link href={`/products/${product.id}`}>View store</Link> : <span>New on ROZZI</span>}</div></div></article>; })}</div>
          {!vendorCards.length && !loading && <div className="empty-state"><span>🛍️</span><h3>More stores are coming</h3><p>We're getting local vendors ready for ROZZI.</p></div>}
        </section>

        <section className="shell section-block quick-section">
          <div className="section-heading"><div><span className="section-kicker orange-kicker">⚡ FAST LANE</span><h2>Quick delivery</h2><p>Get your essentials without the wait.</p></div><button className="link-button">View all <span>→</span></button></div>
          <div className="product-grid">{quickProducts.map((p) => <ProductCard key={p.id} p={p} favorite={favoriteIds.includes(p.id)} onFavorite={() => toggleFavorite(p.id)} onAdd={() => addToCart(p.id)} />)}</div>
        </section>

        <section className="shell section-block">
          <div className="section-heading"><div><span className="section-kicker">PICKED FOR YOU</span><h2>Recommended for you</h2></div><span className="muted-label">Based on what's popular</span></div>
          <div className="product-grid">{recommendedProducts.map((p) => <ProductCard key={p.id} p={p} favorite={favoriteIds.includes(p.id)} onFavorite={() => toggleFavorite(p.id)} onAdd={() => addToCart(p.id)} />)}</div>
          {!products.length && !loading && <div className="empty-state"><span>🧺</span><h3>Your marketplace is waiting</h3><p>Once products are available in your area, they'll appear here.</p></div>}
          {loading && <div className="product-grid">{[1,2,3,4].map((n) => <div className="skeleton-card" key={n}><div className="skeleton-image" /><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></div>)}</div>}
        </section>

        <section className="shell section-block favorites-strip">
          <div className="favorite-copy"><span className="section-kicker">YOUR SHORTLIST</span><h2>Keep your favorites close.</h2><p>Save stores and products you love so your next ROZZI order is even faster.</p><Link href="/login" className="outline-btn">Sign in to save favorites</Link></div>
          <div className="favorite-art"><span>♡</span><span>♡</span><span>♥</span><span>♡</span></div>
        </section>

        <section className="network shell section-block">
          <div className="network-header"><span className="section-kicker light-kicker">THE ROZZI NETWORK</span><h2>More than a marketplace.</h2><p>Shop, sell or deliver — there is a place for everyone in the ROZZI community.</p></div>
          <div className="network-grid">
            <a className="network-card shop" href="/register"><span className="network-icon">🛍️</span><div><small>FOR CUSTOMERS</small><h3>Shop with ROZZI</h3><p>Discover local food, groceries and everyday essentials.</p><strong>Start shopping →</strong></div></a>
            <a className="network-card vendor" href={`${vendorUrl}/register`}><span className="network-icon">🏪</span><div><small>FOR BUSINESS OWNERS</small><h3>Sell on ROZZI</h3><p>Reach more customers and grow your local business.</p><strong>Become a vendor →</strong></div></a>
            <a className="network-card rider" href={`${riderUrl}/register`}><span className="network-icon">🛵</span><div><small>FOR DELIVERY RIDERS</small><h3>Deliver with ROZZI</h3><p>Join the delivery network and earn on your schedule.</p><strong>Become a rider →</strong></div></a>
          </div>
        </section>

        {err && <div className="toast-error" role="alert"><span>!</span><div><strong>Something needs attention</strong><p>{err}</p></div><button onClick={() => setErr('')}>×</button></div>}
      </main>

      {cartCount > 0 && <Link href="/cart" className="floating-cart"><span className="cart-icon">🛒</span><span><strong>{cartCount} {cartCount === 1 ? 'item' : 'items'}</strong><small>Ready to checkout</small></span><b>→</b></Link>}

      <nav className="mobile-bottom-nav"><Link href="/" className="active"><span>⌂</span>Home</Link><button onClick={() => document.querySelector<HTMLInputElement>('.header-search input')?.focus()}><span>⌕</span>Search</button><Link href="/cart"><span>🛒</span>Cart</Link><Link href="/orders"><span>▣</span>Orders</Link><Link href="/login"><span>●</span>Account</Link></nav>

      <footer className="footer"><div className="shell footer-inner"><div><Link href="/" className="footer-logo">ROZZI</Link><p>Shop · Order · Deliver</p></div><div><strong>Explore</strong><Link href="/orders">Orders</Link><Link href="/wallet">Wallet</Link><Link href="/support">Support</Link></div><div><strong>Join ROZZI</strong><a href={`${vendorUrl}/register`}>Sell on ROZZI</a><a href={`${riderUrl}/register`}>Deliver with ROZZI</a></div></div><div className="copyright">© {new Date().getFullYear()} ROZZI Marketplace. Built for local commerce.</div></footer>

      <style jsx>{`
        /* Self-contained responsive hero override.
           The hero stays proportional as the viewport shrinks/expands. */
        .hero-card-clean {
          position: relative;
          height: auto !important;
          min-height: 410px !important;
          display: flex !important;
          align-items: center !important;
          overflow: hidden !important;
          background: linear-gradient(115deg, #4b1010 0%, #6f2016 48%, #b45118 100%) !important;
          background-image: linear-gradient(115deg, #4b1010 0%, #6f2016 48%, #b45118 100%) !important;
        }

        /* Remove decorative circles/hero artwork from the old design. */
        .hero-card-clean::before,
        .hero-card-clean::after {
          display: none !important;
          content: none !important;
        }

        .hero-card-clean .hero-copy {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 760px;
        }

        @media (max-width: 900px) {
          .hero-card-clean {
            min-height: 350px !important;
          }
        }

        @media (max-width: 600px) {
          .hero-wrap {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .hero-card-clean {
            min-height: 0 !important;
            height: auto !important;
            border-radius: 22px !important;
            padding: 30px 24px !important;
          }

          .hero-card-clean .hero-copy {
            max-width: none;
          }

          .hero-card-clean h1 {
            font-size: clamp(30px, 8vw, 40px) !important;
            line-height: 1.04 !important;
            margin-bottom: 14px !important;
          }

          .hero-card-clean p {
            font-size: 13px !important;
            line-height: 1.55 !important;
            margin-bottom: 20px !important;
          }

          .hero-card-clean .hero-search {
            width: 100% !important;
          }

          .hero-card-clean .popular-searches {
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
        }

        @media (max-width: 380px) {
          .hero-card-clean {
            padding: 26px 18px !important;
          }

          .hero-card-clean h1 {
            font-size: 29px !important;
          }

          .hero-card-clean .hero-search button {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

function ProductCard({ p, favorite, onFavorite, onAdd }: { p: any; favorite: boolean; onFavorite: () => void; onAdd: () => void }) {
  const price = Number(p.priceAmount ?? 0);
  const discount = Number(p.discountAmount ?? 0);
  const finalPrice = Math.max(0, price - discount);
  return <article className="product-card"><Link href={`/products/${p.id}`} className="product-image-wrap"><span className="delivery-badge">⚡ 15–20 min</span>{p.images?.[0]?.url ? <img src={p.images[0].url} alt={p.name} /> : <div className="image-placeholder product-placeholder">{categoryStyle(p.category?.name || '').icon}</div>}<button className="heart" aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'} onClick={(e) => { e.preventDefault(); onFavorite(); }}>{favorite ? '♥' : '♡'}</button></Link><div className="product-content"><div className="product-category">{p.category?.name || 'Marketplace'}</div><Link href={`/products/${p.id}`}><h3>{p.name}</h3></Link><div className="product-vendor">{vendorName(p)} <span>•</span> <span>★ 4.8</span></div><div className="product-price-row"><div>{discount > 0 && <del>{money(price)}</del>}<strong>{money(finalPrice)}</strong></div><button className="add-btn" aria-label={`Add ${p.name} to cart`} onClick={onAdd}>+</button></div></div></article>;
}
