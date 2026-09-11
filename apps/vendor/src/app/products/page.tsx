'use client';

import VendorShell from '../../components/VendorShell';
import { useEffect, useMemo, useState } from 'react';
import { api, patch, post } from '../../lib/api';

type ProductImage = { id?: string; url: string; sortOrder?: number };
type Variant = { id?: string; name: string; priceOverride?: number | null; inventory?: { quantity: number } | null };
type Product = {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  priceAmount: number;
  discountAmount?: number | null;
  unit?: string | null;
  weightGrams?: number | null;
  preparationTimeMinutes?: number | null;
  isAvailable: boolean;
  category?: { id: string; name: string } | null;
  images?: ProductImage[];
  variants?: Variant[];
  inventory?: { quantity: number } | null;
};
type Category = { id: string; name: string };

type DraftVariant = { name: string; priceOverride: string; initialStock: string };

const naira = (kobo: number) => `₦${(kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function Products() {
  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'out' | 'draft'>('all');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockDelta, setStockDelta] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [discount, setDiscount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('');
  const [weight, setWeight] = useState('');
  const [preparationTime, setPreparationTime] = useState('');
  const [initialStock, setInitialStock] = useState('');
  const [variants, setVariants] = useState<DraftVariant[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [availability, setAvailability] = useState(true);

  async function load() {
    try {
      setLoading(true); setError('');
      const [products, cats] = await Promise.all([api<Product[]>('/api/vendor/products'), api<Category[]>('/api/categories')]);
      setItems(Array.isArray(products) ? products : []);
      setCategories(Array.isArray(cats) ? cats : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load products.');
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function resetBuilder() {
    setStep(1); setName(''); setDescription(''); setSku(''); setPrice(''); setDiscount(''); setCategoryId('');
    setUnit(''); setWeight(''); setPreparationTime(''); setInitialStock(''); setVariants([]); setImageFiles([]); setAvailability(true); setEditing(null);
  }

  function openCreate() { resetBuilder(); setShowBuilder(true); }
  function openEdit(product: Product) {
    setEditing(product); setStep(1); setShowBuilder(true); setName(product.name); setDescription(product.description || ''); setSku(product.sku || '');
    setPrice(String(product.priceAmount / 100)); setDiscount(product.discountAmount == null ? '' : String(product.discountAmount / 100));
    setCategoryId(product.category?.id || ''); setUnit(product.unit || ''); setWeight(product.weightGrams == null ? '' : String(product.weightGrams)); setPreparationTime(product.preparationTimeMinutes == null ? '' : String(product.preparationTimeMinutes));
    setInitialStock(product.inventory ? String(product.inventory.quantity) : ''); setAvailability(product.isAvailable);
    setVariants((product.variants || []).map(v => ({ name: v.name, priceOverride: v.priceOverride == null ? '' : String(v.priceOverride / 100), initialStock: String(v.inventory?.quantity ?? 0) })));
    setImageFiles([]);
  }

  function addVariant() { setVariants(v => [...v, { name: '', priceOverride: '', initialStock: '' }]); }
  function removeVariant(index: number) { setVariants(v => v.filter((_, i) => i !== index)); }
  function updateVariant(index: number, key: keyof DraftVariant, value: string) { setVariants(v => v.map((x, i) => i === index ? { ...x, [key]: value } : x)); }

  function selectImages(files: FileList | null) {
    if (!files) return;
    const selected = Array.from(files);
    if (selected.length > 10) return setError('You can select a maximum of 10 images.');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const invalid = selected.find(f => !allowed.includes(f.type));
    if (invalid) return setError('Only JPEG, PNG and WebP images are allowed.');
    setError(''); setImageFiles(selected);
  }

  async function uploadImages(productId: string) {
    if (!imageFiles.length) return;
    for (let index = 0; index < imageFiles.length; index++) {
      const file = imageFiles[index];
      const presign = await post('/api/storage/presign', { contentType: file.type, sizeBytes: file.size });
      const response = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error(`Failed to upload image ${index + 1}.`);
      await post('/api/storage/complete', { key: presign.key });
      if (!presign.publicUrl) throw new Error('Storage did not return a public image URL.');
      await post(`/api/vendor/products/${productId}/images`, { images: [{ url: presign.publicUrl, sortOrder: index }] });
    }
  }

  async function saveProduct() {
    try {
      setSaving(true); setError(''); setSuccess('');
      if (!name.trim()) throw new Error('Product name is required.');
      if (!categoryId) throw new Error('Select a category.');
      const priceNumber = Number(price);
      if (!Number.isFinite(priceNumber) || priceNumber < 0) throw new Error('Enter a valid product price.');
      const discountNumber = discount === '' ? undefined : Number(discount);
      if (discountNumber !== undefined && (!Number.isFinite(discountNumber) || discountNumber < 0 || discountNumber > priceNumber)) throw new Error('Discount must be valid and cannot exceed the product price.');
      const validVariants = variants.filter(v => v.name.trim()).map(v => ({ name: v.name.trim(), ...(v.priceOverride === '' ? {} : { priceOverride: Math.round(Number(v.priceOverride) * 100) }), initialStock: Math.max(0, Math.round(Number(v.initialStock || 0))) }));
      let product: Product;
      if (editing) {
        product = await patch(`/api/vendor/products/${editing.id}`, {
          name: name.trim(), description: description.trim() || undefined, sku: sku.trim() || undefined,
          priceAmount: Math.round(priceNumber * 100), discountAmount: discount === '' ? undefined : Math.round(discountNumber! * 100),
          unit: unit.trim() || undefined, weightGrams: weight === '' ? undefined : Math.max(0, Math.round(Number(weight))), preparationTimeMinutes: preparationTime === '' ? undefined : Math.max(0, Math.round(Number(preparationTime))), isAvailable: availability,
        });
        if (imageFiles.length) await uploadImages(product.id);
        setSuccess('Product updated successfully.');
      } else {
        product = await post('/api/vendor/products', {
          name: name.trim(), categoryId, description: description.trim() || undefined, sku: sku.trim() || undefined,
          priceAmount: Math.round(priceNumber * 100), discountAmount: discount === '' ? undefined : Math.round(discountNumber! * 100),
          unit: unit.trim() || undefined, weightGrams: weight === '' ? undefined : Math.max(0, Math.round(Number(weight))), preparationTimeMinutes: preparationTime === '' ? undefined : Math.max(0, Math.round(Number(preparationTime))),
          initialStock: validVariants.length ? 0 : Math.max(0, Math.round(Number(initialStock || 0))), variants: validVariants.length ? validVariants : undefined, isAvailable: availability,
        });
        if (imageFiles.length) await uploadImages(product.id);
        setSuccess('Product created successfully.');
      }
      setShowBuilder(false); resetBuilder(); await load();
    } catch (e: any) { setError(e?.message || 'Failed to save product.'); }
    finally { setSaving(false); }
  }

  async function toggleAvailability(product: Product) {
    try { setError(''); await patch(`/api/vendor/products/${product.id}`, { isAvailable: !product.isAvailable }); setSuccess(product.isAvailable ? 'Product hidden from customers.' : 'Product is now active.'); await load(); }
    catch (e: any) { setError(e?.message || 'Failed to update product.'); }
  }

  async function duplicate(product: Product) {
    try {
  setError('');
  const copy = await post(`/api/vendor/products/${product.id}/duplicate`, {});
  setSuccess(`Created “${copy.name}” as a draft copy.`);
  await load();
}
    catch (e: any) { setError(e?.message || 'Failed to duplicate product.'); }
  }

  async function adjustStock() {
    if (!stockProduct) return;
    const delta = Number(stockDelta);
    if (!Number.isInteger(delta) || delta === 0) return setError('Enter a whole-number stock adjustment.');
    try { setError(''); await patch(`/api/vendor/products/${stockProduct.id}/stock`, { quantityDelta: delta }); setSuccess('Stock updated successfully.'); setStockProduct(null); setStockDelta(''); await load(); }
    catch (e: any) { setError(e?.message || 'Failed to update stock.'); }
  }

  const filtered = useMemo(() => items.filter(p => {
    const q = search.toLowerCase().trim();
    const quantity = p.variants?.length ? p.variants.reduce((sum, v) => sum + (v.inventory?.quantity ?? 0), 0) : (p.inventory?.quantity ?? 0);
    const matchesSearch = !q || p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    const matchesFilter = filter === 'all' || (filter === 'active' && p.isAvailable) || (filter === 'out' && quantity <= 0) || (filter === 'draft' && !p.isAvailable);
    return matchesSearch && matchesFilter;
  }), [items, search, filter]);

  const totalActive = items.filter(p => p.isAvailable).length;
  const totalOut = items.filter(p => (p.variants?.length ? p.variants.reduce((s, v) => s + (v.inventory?.quantity ?? 0), 0) : (p.inventory?.quantity ?? 0)) <= 0).length;

  return <VendorShell>
    <main className="shell product-page">
      <div className="page-heading-row">
        <div><div className="eyebrow">CATALOG</div><h1>Products</h1><p className="muted">Manage your catalogue, pricing, availability and stock from one place.</p></div>
        <button className="btn primary" onClick={openCreate}>＋ Add Product</button>
      </div>

      {(error || success) && <div className={error ? 'error-banner' : 'success-banner'}>{error || success}</div>}

      <div className="product-summary-grid">
        <div className="metric-card"><span>Total products</span><strong>{items.length}</strong><small>Across your catalogue</small></div>
        <div className="metric-card"><span>Active</span><strong>{totalActive}</strong><small>Visible to customers</small></div>
        <div className="metric-card"><span>Out of stock</span><strong>{totalOut}</strong><small>Needs attention</small></div>
        <div className="metric-card"><span>Categories</span><strong>{categories.length}</strong><small>Available catalogue groups</small></div>
      </div>

      <section className="card product-list-card">
        <div className="product-toolbar">
          <div className="catalog-tabs">
            {([['all','All'],['active','Active'],['out','Out of stock'],['draft','Hidden']] as const).map(([key,label]) => <button key={key} className={`catalog-tab ${filter === key ? 'active' : ''}`} onClick={() => setFilter(key)}>{label}</button>)}
          </div>
          <div className="product-search">⌕<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products or SKU..." /></div>
        </div>
        {loading ? <div className="product-state"><div className="spinner"/><h3>Loading catalogue</h3><p>Getting your products...</p></div> : filtered.length === 0 ? <div className="product-state"><div className="state-icon">📦</div><h3>{search ? 'No products found' : 'Your catalogue is empty'}</h3><p>{search ? 'Try a different product name or SKU.' : 'Add your first product to start building your store.'}</p>{!search && <button className="btn primary" onClick={openCreate}>＋ Add Product</button>}</div> : <div className="product-table-wrap">
          <div className="product-table-head"><span>Product</span><span>Category</span><span>Price</span><span>Stock</span><span>Status</span><span>Actions</span></div>
          {filtered.map(product => {
            const quantity = product.variants?.length ? product.variants.reduce((s,v) => s + (v.inventory?.quantity ?? 0), 0) : (product.inventory?.quantity ?? 0);
            const image = product.images?.[0]?.url;
            return <div className="product-row" key={product.id}>
              <button className="product-main" onClick={() => setSelectedProduct(product)}><div className="product-thumb">{image ? <img src={image} alt=""/> : <span>{product.name.charAt(0).toUpperCase()}</span>}</div><div><strong>{product.name}</strong><small>{product.sku || 'No SKU'}{product.variants?.length ? ` · ${product.variants.length} variants` : ''}</small></div></button>
              <span>{product.category?.name || '—'}</span>
              <span><strong>{naira(product.discountAmount ?? product.priceAmount)}</strong>{product.discountAmount != null && <del>{naira(product.priceAmount)}</del>}</span>
              <span className={quantity <= 0 ? 'stock-danger' : quantity <= 10 ? 'stock-warning' : ''}>{quantity}{product.unit ? ` ${product.unit}` : ''}</span>
              <span><b className={`status-badge ${product.isAvailable ? 'status-active' : 'status-hidden'}`}>{product.isAvailable ? 'Active' : 'Hidden'}</b></span>
              <div className="product-actions"><button onClick={() => openEdit(product)}>Edit</button><button onClick={() => duplicate(product)}>Duplicate</button><button onClick={() => setStockProduct(product)}>Stock</button><button onClick={() => toggleAvailability(product)}>{product.isAvailable ? 'Hide' : 'Publish'}</button></div>
            </div>;
          })}
        </div>}
      </section>

      {showBuilder && <div className="modal-backdrop"><section className="product-builder" role="dialog" aria-modal="true">
        <header className="builder-header"><div><div className="eyebrow">PRODUCT BUILDER</div><h2>{editing ? 'Edit product' : 'Add product'}</h2><p>{editing ? 'Update the product information customers see.' : 'Create a polished catalogue item in a few steps.'}</p></div><button className="drawer-close" onClick={() => { setShowBuilder(false); resetBuilder(); }}>×</button></header>
        <div className="builder-steps">{['Basic information','Pricing','Inventory','Options','Availability'].map((label,i) => <button key={label} className={step === i+1 ? 'current' : step > i+1 ? 'done' : ''} onClick={() => setStep(i+1)}><span>{step > i+1 ? '✓' : i+1}</span>{label}</button>)}</div>
        <div className="builder-body">
          {step === 1 && <div className="builder-grid"><label>Product name<input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Jollof Rice"/></label><label>Category<select className="input" value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Select a category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>SKU <span className="field-optional">Optional</span><input className="input" value={sku} onChange={e=>setSku(e.target.value)} placeholder="e.g. JR-001"/></label><label className="full-field">Description <span className="field-optional">Optional</span><textarea className="input" rows={5} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe the product, what customers should know, or key specifications..."/></label><div className="full-field"><label>Product images <span className="field-optional">Up to 10</span></label><input className="file-input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>selectImages(e.target.files)}/>{imageFiles.length > 0 && <div className="selected-files">{imageFiles.map((f,i)=><span key={`${f.name}-${i}`}>{f.name}</span>)}</div>}</div></div>}
          {step === 2 && <div className="builder-grid"><label>Price in naira<input className="input" type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="3500"/></label><label>Discount price <span className="field-optional">Optional</span><input className="input" type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)} placeholder="3000"/></label><label>Unit <span className="field-optional">Optional</span><select className="input" value={unit} onChange={e=>setUnit(e.target.value)}><option value="">Select unit</option><option>piece</option><option>plate</option><option>pack</option><option>bottle</option><option>kg</option><option>gram</option><option>litre</option><option>set</option></select></label><label>Weight in grams <span className="field-optional">Optional</span><input className="input" type="number" min="0" value={weight} onChange={e=>setWeight(e.target.value)} placeholder="e.g. 500"/></label><div className="builder-note full-field"><strong>Pricing tip</strong><span>Use a discount price only when you want customers to see a reduced selling price. The original price will remain visible as the crossed-out reference.</span></div></div>}
          {step === 3 && <div><div className="builder-grid">{variants.length === 0 && <label>Stock quantity<input className="input" type="number" min="0" value={initialStock} onChange={e=>setInitialStock(e.target.value)} placeholder="e.g. 50"/></label>}<label>Low-stock alert <span className="field-optional">Coming with Inventory</span><input className="input" disabled placeholder="10"/></label><label>Preparation time (minutes) <span className="field-optional">Optional</span><input className="input" type="number" min="0" value={preparationTime} onChange={e=>setPreparationTime(e.target.value)} placeholder="20"/></label></div><div className="builder-section"><div><h3>Variants</h3><p className="muted">Use variants for sellable versions such as size, flavor or model. Advanced option groups will be configured in the Variants/Add-ons module.</p></div><button className="btn secondary" onClick={addVariant}>＋ Add variant</button>{variants.map((v,i)=><div className="variant-editor" key={i}><input className="input" value={v.name} onChange={e=>updateVariant(i,'name',e.target.value)} placeholder="Variant name e.g. Large"/><input className="input" type="number" min="0" step="0.01" value={v.priceOverride} onChange={e=>updateVariant(i,'priceOverride',e.target.value)} placeholder="Price override"/><input className="input" type="number" min="0" value={v.initialStock} onChange={e=>updateVariant(i,'initialStock',e.target.value)} placeholder="Initial stock"/><button className="icon-button danger-text" onClick={()=>removeVariant(i)}>×</button></div>)}</div></div>}
          {step === 4 && <div className="coming-panel"><div className="state-icon">🧩</div><h3>Variants & Add-ons are getting their own workspace</h3><p>This step is intentionally reserved for the dedicated Options/Add-ons system we will build next. Your current product can still use simple variants above.</p><div className="feature-list"><span>✓ Required / optional groups</span><span>✓ Minimum / maximum selections</span><span>✓ Price overrides</span><span>✓ Availability controls</span></div></div>}
          {step === 5 && <div className="availability-panel"><div className="availability-toggle"><div><h3>Product availability</h3><p>Control whether customers can currently order this product.</p></div><button className={`toggle ${availability ? 'on' : ''}`} onClick={()=>setAvailability(v=>!v)}><span/></button></div><div className="preview-card"><div className="preview-image">{imageFiles[0] ? <img src={URL.createObjectURL(imageFiles[0])} alt="Preview"/> : <span>{name ? name.charAt(0).toUpperCase() : 'P'}</span>}</div><div><b>{name || 'Product name'}</b><p>{description || 'Your product description will appear here.'}</p><strong>{discount ? `₦${Number(discount).toLocaleString('en-NG')}` : price ? `₦${Number(price).toLocaleString('en-NG')}` : '₦0'}</strong></div></div></div>}
        </div>
        <footer className="builder-footer"><button className="btn secondary" disabled={step === 1 || saving} onClick={()=>setStep(s=>Math.max(1,s-1))}>Back</button><div><span className="step-count">Step {step} of 5</span>{step < 5 ? <button className="btn primary" onClick={()=>setStep(s=>Math.min(5,s+1))}>Continue</button> : <button className="btn primary" disabled={saving} onClick={saveProduct}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button>}</div></footer>
      </section></div>}

      {stockProduct && <div className="modal-backdrop"><section className="small-modal"><button className="drawer-close modal-x" onClick={()=>setStockProduct(null)}>×</button><div className="eyebrow">INVENTORY</div><h2>Adjust stock</h2><p className="muted">{stockProduct.name}</p><input className="input" type="number" step="1" value={stockDelta} onChange={e=>setStockDelta(e.target.value)} placeholder="+10 to add, -2 to deduct"/><p className="stock-help">Use a positive number to add stock or a negative number to deduct stock.</p><div className="modal-actions"><button className="btn secondary" onClick={()=>setStockProduct(null)}>Cancel</button><button className="btn primary" onClick={adjustStock}>Update stock</button></div></section></div>}

      {selectedProduct && <div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setSelectedProduct(null)}}><section className="product-preview-drawer"><header className="drawer-header"><div><div className="eyebrow">PRODUCT</div><h2>{selectedProduct.name}</h2></div><button className="drawer-close" onClick={()=>setSelectedProduct(null)}>×</button></header><div className="drawer-scroll"><div className="detail-product-hero">{selectedProduct.images?.[0]?.url ? <img src={selectedProduct.images[0].url} alt=""/> : <div>{selectedProduct.name.charAt(0)}</div>}<div><b className={`status-badge ${selectedProduct.isAvailable ? 'status-active' : 'status-hidden'}`}>{selectedProduct.isAvailable ? 'Active' : 'Hidden'}</b><h3>{naira(selectedProduct.discountAmount ?? selectedProduct.priceAmount)}</h3>{selectedProduct.discountAmount != null && <del>{naira(selectedProduct.priceAmount)}</del>}</div></div><div className="detail-section"><h3>Details</h3><p className="detail-copy">{selectedProduct.description || 'No product description added.'}</p></div><div className="detail-section"><h3>Catalogue information</h3><div className="summary-lines"><span>Category <b>{selectedProduct.category?.name || '—'}</b></span><span>SKU <b>{selectedProduct.sku || '—'}</b></span><span>Unit <b>{selectedProduct.unit || '—'}</b></span><span>Preparation <b>{selectedProduct.preparationTimeMinutes ? `${selectedProduct.preparationTimeMinutes} min` : '—'}</b></span></div></div><div className="detail-section"><h3>Variants <span>{selectedProduct.variants?.length || 0}</span></h3>{selectedProduct.variants?.length ? selectedProduct.variants.map(v=><div className="mini-variant" key={v.id || v.name}><span>{v.name}</span><b>{v.priceOverride != null ? naira(v.priceOverride) : naira(selectedProduct.priceAmount)}</b></div>) : <p className="muted">No variants configured.</p>}</div></div><footer className="drawer-footer"><button className="btn secondary" onClick={()=>{setSelectedProduct(null);openEdit(selectedProduct)}}>Edit product</button><button className="btn primary" onClick={()=>{setSelectedProduct(null);setStockProduct(selectedProduct)}}>Adjust stock</button></footer></section></div>}
    </main>
  </VendorShell>;
}
