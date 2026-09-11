'use client';

import { useEffect, useMemo, useState } from 'react';
import VendorShell from '../../components/VendorShell';
import { onOrderStatus } from '../../lib/realtime';
import { api, post } from '../../lib/api';

const money = (kobo = 0) => `₦${(Number(kobo) / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
const statusLabel: Record<string, string> = {
  RIDER_SEARCHING: 'Finding rider', RIDER_ASSIGNED: 'Rider assigned',
  RIDER_ARRIVED_PICKUP: 'At pickup', PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit', RIDER_ARRIVED: 'Arrived',
  DELIVERED: 'Delivered', CANCELLED: 'Cancelled', FAILED: 'Failed', REFUNDED: 'Refunded',
};
const statusClass = (s: string) => s === 'DELIVERED' ? 'status-active' :
  ['CANCELLED','FAILED','REFUNDED'].includes(s) ? 'status-muted' :
  s === 'RIDER_SEARCHING' ? 'status-warning' : 'status-info';
const formatDate = (v?: string) => v ? new Date(v).toLocaleString('en-NG', { dateStyle:'medium', timeStyle:'short' }) : '—';
const progress = (s: string) => {
  const steps = ['RIDER_SEARCHING','RIDER_ASSIGNED','PICKED_UP','IN_TRANSIT','RIDER_ARRIVED','DELIVERED'];
  const i = steps.indexOf(s);
  return i < 0 ? 0 : Math.round((i / (steps.length - 1)) * 100);
};

export default function DeliveriesPage() {
  const [rows,setRows] = useState<any[]>([]), [stats,setStats] = useState<any>({});
  const [loading,setLoading] = useState(true), [error,setError] = useState('');
  const [saved,setSaved] = useState(''), [query,setQuery] = useState(''), [filter,setFilter] = useState('ALL');
  const [selected,setSelected] = useState<any>(null);

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [deliveries,summary] = await Promise.all([api('/api/vendor/deliveries'),api('/api/vendor/deliveries/stats')]);
      setRows(deliveries); setStats(summary);
    } catch(e:any) { setError(e.message || 'Could not load deliveries.'); }
    finally { setLoading(false); }
  };
  useEffect(()=>{ const off=onOrderStatus(()=>{ void load(); }); load(); return off; },[]);

  const filtered = useMemo(() => rows.filter(d => {
    const q=query.trim().toLowerCase();
    const matchesQ=!q || d.order?.orderNumber?.toLowerCase().includes(q) ||
      d.order?.customer?.fullName?.toLowerCase().includes(q) || d.rider?.owner?.fullName?.toLowerCase().includes(q);
    const s=d.order.status;
    const matchesF=filter==='ALL' ||
      (filter==='ACTIVE' && !['DELIVERED','CANCELLED','FAILED','REFUNDED'].includes(s)) ||
      (filter==='SEARCHING' && s==='RIDER_SEARCHING') ||
      (filter==='ASSIGNED' && ['RIDER_ASSIGNED','RIDER_ARRIVED_PICKUP'].includes(s)) ||
      (filter==='TRANSIT' && ['PICKED_UP','IN_TRANSIT','RIDER_ARRIVED'].includes(s)) ||
      (filter==='DELIVERED' && s==='DELIVERED');
    return matchesQ && matchesF;
  }),[rows,query,filter]);

  async function dispatch(d:any) {
    setError('');
    try { await post(`/api/delivery/${d.order.id}/dispatch`); setSaved('Rider search started'); await load(); setTimeout(()=>setSaved(''),2200); }
    catch(e:any) { setError(e.message || 'Could not start dispatch.'); }
  }

  return <VendorShell>
    <div className="deliveries-page">
      <div className="page-heading-row"><div><span className="eyebrow">Logistics workspace</span><h1>Deliveries</h1><p className="page-subtitle">Track rider assignment, pickup progress, and delivery completion from one place.</p></div><button className="btn secondary" onClick={load}>↻ Refresh</button></div>
      {error&&<div className="error">{error}</div>}{saved&&<div className="success">{saved}</div>}

      <div className="delivery-metrics">
        <div><span>Active deliveries</span><strong>{stats.active||0}</strong><small>{stats.awaitingRider||0} waiting for rider</small></div>
        <div><span>Assigned</span><strong>{stats.assigned||0}</strong><small>{stats.pickedUp||0} currently on route</small></div>
        <div><span>Delivered</span><strong>{stats.delivered||0}</strong><small>Platform delivery jobs</small></div>
        <div><span>Avg. delivery</span><strong>{stats.avgDeliveryMinutes?`${stats.avgDeliveryMinutes}m`:'—'}</strong><small>Pickup to completion</small></div>
        <div><span>Pickup orders</span><strong>{stats.pickupCount||0}</strong><small>No rider required</small></div>
        <div><span>Self-delivery</span><strong>{stats.selfDeliveryCount||0}</strong><small>Vendor-managed delivery</small></div>
      </div>

      <div className="delivery-toolbar">
        <input className="input" placeholder="Search order, customer, or rider…" value={query} onChange={e=>setQuery(e.target.value)}/>
        <div className="delivery-filters">{[['ALL','All'],['ACTIVE','Active'],['SEARCHING','Finding rider'],['ASSIGNED','Assigned'],['TRANSIT','On route'],['DELIVERED','Delivered']].map(([v,l])=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{l}</button>)}</div>
      </div>

      {loading?<div className="card delivery-state">Loading delivery operations…</div>:
       !filtered.length?<div className="card delivery-state"><div className="state-icon">⇢</div><h3>{query||filter!=='ALL'?'No deliveries match this view':'No delivery jobs yet'}</h3><p>When a customer chooses platform delivery and an order is ready, it will appear here for rider dispatch and tracking.</p></div>:
       <div className="delivery-list">{filtered.map(d=>{
         const s=d.order.status, terminal=['DELIVERED','CANCELLED','FAILED','REFUNDED'].includes(s);
         return <article className="delivery-card" key={d.id}>
           <div className="delivery-card-top"><div><span className="delivery-order">{d.order.orderNumber}</span><h3>{d.order.customer?.fullName||'Customer'}</h3><p>{formatDate(d.order.createdAt)} · {d.order.deliveryModel?.replaceAll('_',' ')}</p></div><span className={`status-badge ${statusClass(s)}`}>{statusLabel[s]||s}</span></div>
           <div className="delivery-route"><div><span className="route-dot pickup"/><div><small>Pickup</small><b>Store</b></div></div><div className="route-line"><span style={{width:`${progress(s)}%`}}/></div><div><span className="route-dot dropoff"/><div><small>Drop-off</small><b>{d.order.address?.label||d.order.address?.addressLine1||'Customer address'}</b></div></div></div>
           <div className="delivery-card-grid">
             <div><span>Rider</span><b>{d.rider?.owner?.fullName||(s==='RIDER_SEARCHING'?'Searching…':'Not assigned')}</b><small>{d.rider?.vehicleType?.replaceAll('_',' ')||'—'}</small></div>
             <div><span>Customer</span><b>{d.order.customer?.phone||'—'}</b><small>{d.order.address?.landmark||'No landmark'}</small></div>
             <div><span>Delivery fee</span><b>{money(d.order.deliveryFeeAmount)}</b><small>{d.rider?'Rider assigned':`${d.attempts?.length||0} offers`}</small></div>
           </div>
           <div className="delivery-card-bottom"><div className="delivery-progress-copy"><span>Delivery progress</span><b>{progress(s)}%</b></div><div className="delivery-actions">
             {!terminal&&s==='READY_FOR_PICKUP'&&<button className="btn" onClick={()=>dispatch(d)}>Find a rider</button>}
             {s==='RIDER_SEARCHING'&&<button className="btn secondary" onClick={()=>dispatch(d)}>Retry dispatch</button>}
             <button className="btn secondary" onClick={()=>setSelected(d)}>View delivery</button>
           </div></div>
         </article>;
       })}</div>}

      {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><div className="modal delivery-modal" onClick={e=>e.stopPropagation()}>
        <div className="modal-head"><div><span className="eyebrow">Delivery details</span><h2>{selected.order.orderNumber}</h2></div><button onClick={()=>setSelected(null)}>×</button></div>
        <div className="delivery-detail-status"><span className={`status-badge ${statusClass(selected.order.status)}`}>{statusLabel[selected.order.status]||selected.order.status}</span><span>{selected.order.deliveryModel?.replaceAll('_',' ')}</span></div>
        <div className="delivery-detail-grid">
          <section><span>Customer</span><strong>{selected.order.customer?.fullName||'—'}</strong><p>{selected.order.customer?.phone||'—'}</p></section>
          <section><span>Drop-off</span><strong>{selected.order.address?.label||'Customer address'}</strong><p>{selected.order.address?.addressLine1||selected.order.address?.address||'—'}</p></section>
          <section><span>Rider</span><strong>{selected.rider?.owner?.fullName||'Not assigned'}</strong><p>{selected.rider?.vehicleType?.replaceAll('_',' ')||'—'}{selected.rider?.vehiclePlateNumber?` · ${selected.rider.vehiclePlateNumber}`:''}</p></section>
          <section><span>Order value</span><strong>{money(selected.order.totalAmount)}</strong><p>Delivery fee {money(selected.order.deliveryFeeAmount)}</p></section>
        </div>
        <div className="delivery-timeline"><h3>Delivery timeline</h3>{[['RIDER_SEARCHING','Rider search',selected.order.status!=='READY_FOR_PICKUP'],['RIDER_ASSIGNED','Rider assigned',!!selected.assignedAt],['PICKED_UP','Picked up',!!selected.pickedUpAt],['IN_TRANSIT','In transit',['IN_TRANSIT','RIDER_ARRIVED','DELIVERED'].includes(selected.order.status)],['RIDER_ARRIVED','Rider arrived',['RIDER_ARRIVED','DELIVERED'].includes(selected.order.status)],['DELIVERED','Delivered',!!selected.deliveredAt]].map(([k,l,d]:any)=><div className={`timeline-row ${d?'done':''}`} key={k}><i>{d?'✓':'·'}</i><span>{l}</span></div>)}</div>
        {selected.rider?.location&&<div className="live-rider-note"><span>Live rider location</span><b>Updated {formatDate(selected.rider.location.updatedAt)}</b><small>{Number(selected.rider.location.latitude).toFixed(5)}, {Number(selected.rider.location.longitude).toFixed(5)}</small></div>}
        <div className="modal-actions"><button className="btn secondary" onClick={()=>setSelected(null)}>Close</button>{selected.order.status==='READY_FOR_PICKUP'&&<button className="btn" onClick={()=>{setSelected(null);dispatch(selected)}}>Find a rider</button>}</div>
      </div></div>}
    </div>
  </VendorShell>;
}
