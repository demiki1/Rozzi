'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { DashboardShell, PageHeader, StatusBadge, Icon, SectionCard } from '@/components/dashboard-shell';
import { api } from '@/lib/api-client';
import { formatNaira } from '@/lib/format';
import { OrderSummary, VendorSummary, RiderSummary, ServiceAreaSummary } from '@/lib/types';

interface FinanceSummary {
  gmv: number;
  platformRevenue: number;
  deliveryRevenue: number;
  riderPayouts: number;
  refunds: number;
  averageOrderValue: number;
  orderCounts: { total: number; delivered: number; cancelled: number; failed: number };
}
interface DeliveryRow {
  id: string;
  orderId: string;
  order?: { orderNumber: string; status: string };
  rider?: { owner?: { fullName?: string | null } | null } | null;
}

const chartHeights = [32, 45, 38, 57, 50, 64, 54, 72, 61, 77, 68, 84, 72, 91];

function Kpi({ label, value, meta, icon, tone = '' }: { label: string; value: string | number; meta: ReactNode; icon: 'orders'|'wallet'|'store'|'rider'; tone?: string }) {
  return (
    <div className="admin-card admin-kpi">
      <div className="admin-kpi-top"><span>{label}</span><span className={`admin-kpi-icon ${tone}`}><Icon name={icon} size={15} /></span></div>
      <div className="admin-kpi-value">{value}</div>
      <div className="admin-kpi-meta">{meta}</div>
    </div>
  );
}

export default function OverviewPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [vendors, setVendors] = useState<VendorSummary[]>([]);
  const [riders, setRiders] = useState<RiderSummary[]>([]);
  const [areas, setAreas] = useState<ServiceAreaSummary[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<'Revenue'|'Orders'|'GMV'|'Commission'>('Revenue');

  const load = async () => {
    const now = new Date();
    const from = new Date(now);
    from.setHours(0,0,0,0);
    const safe = async <T,>(promise: Promise<T>, fallback: T) => {
      try { return await promise; } catch { return fallback; }
    };
    const [o,v,r,a,d,f] = await Promise.all([
      safe(api.get<OrderSummary[]>('/api/admin/orders'), []),
      safe(api.get<VendorSummary[]>('/api/admin/vendors'), []),
      safe(api.get<RiderSummary[]>('/api/admin/riders'), []),
      safe(api.get<ServiceAreaSummary[]>('/api/admin/service-areas'), []),
      safe(api.get<DeliveryRow[]>('/api/admin/deliveries'), []),
      safe(api.get<FinanceSummary>(`/api/admin/reports/summary?from=${from.toISOString()}&to=${now.toISOString()}`), null),
    ]);
    setOrders(o); setVendors(v); setRiders(r); setAreas(a); setDeliveries(d); setFinance(f);
    if (!o.length && !v.length && !r.length && !a.length && !d.length && !f) {
      setError('No live admin data could be loaded. Check the API connection.');
    } else setError(null);
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const todayOrders = useMemo(() => {
    const start = new Date(); start.setHours(0,0,0,0);
    return orders.filter((o) => new Date(o.createdAt) >= start).length;
  }, [orders]);
  const activeVendors = vendors.filter((v) => v.status === 'APPROVED' && v.isOpen !== false).length;
  const onlineRiders = riders.filter((r) => r.status === 'APPROVED' || r.status === 'ACTIVE').filter((r) => r.isOnline).length;
  const liveDeliveries = deliveries.filter((d) => !['DELIVERED','CANCELLED','FAILED','REFUNDED'].includes(d.order?.status || ''));

  const attention = [
    { tone:'red', title:`${orders.filter((o) => ['RIDER_SEARCHING'].includes(o.status)).length} orders waiting for rider`, meta:'Dispatch queue', href:'/orders' },
    { tone:'orange', title:`${vendors.filter((v) => v.status === 'PENDING').length} vendor applications pending`, meta:'Vendor approvals', href:'/vendors' },
    { tone:'yellow', title:`${riders.filter((r) => r.status === 'PENDING' || r.status === 'UNDER_REVIEW').length} rider reviews awaiting action`, meta:'Rider verification', href:'/riders' },
    { tone:'orange', title:`${finance?.orderCounts.failed ?? 0} failed orders today`, meta:'Payment / fulfillment', href:'/orders' },
  ];

  return (
    <DashboardShell>
      <PageHeader
        eyebrow="ROZZI COMMAND CENTER"
        title="Good evening 👋"
        description="Here's what's happening across the ROZZI marketplace today."
        action={<Link className="admin-button primary" href="/deliveries"><Icon name="map" size={14} /><span>Open live operations</span></Link>}
      />

      {error && <div className="admin-card" style={{padding:'12px 15px', marginBottom:15, color:'#b91c1c', background:'#fff7f7', fontSize:11}}>{error}</div>}

      <div className="admin-kpis">
        <Kpi label="Orders today" value={todayOrders || finance?.orderCounts.total || 0} meta={<><span className="admin-up">Live</span> · refreshed every 30s</>} icon="orders" />
        <Kpi label="GMV today" value={finance ? formatNaira(finance.gmv) : '—'} meta={finance ? <><span className="admin-up">Tracked</span> · delivered orders</> : 'Waiting for finance data'} icon="wallet" />
        <Kpi label="Active vendors" value={activeVendors} meta={`${vendors.filter(v => v.status === 'PENDING').length} awaiting approval`} icon="store" />
        <Kpi label="Online riders" value={onlineRiders} meta={`${liveDeliveries.length} live deliveries`} icon="rider" />
      </div>

      <div className="admin-grid-main">
        <SectionCard>
          <div className="admin-panel-head">
            <div><h2>Marketplace performance</h2><p>Operational trend snapshot</p></div>
            <div className="admin-chart-tabs">{(['Revenue','Orders','GMV','Commission'] as const).map((x) => <button key={x} onClick={() => setMetric(x)} className={`admin-chart-tab ${metric===x?'active':''}`}>{x}</button>)}</div>
          </div>
          <div className="admin-chart">
            <div className="admin-chart-area">
              <div className="admin-chart-grid"><span/><span/><span/><span/></div>
              <div className="admin-bars">{chartHeights.map((h,i)=><div key={i} className="admin-bar" style={{height:`${h}%`, animationDelay:`${i*25}ms`}} />)}</div>
            </div>
            <div className="admin-chart-labels">{['6am','8am','10am','12pm','2pm','4pm','6pm','8pm'].map(x=><span key={x}>{x}</span>)}</div>
          </div>
        </SectionCard>

        <SectionCard className="admin-attention">
          <div className="admin-panel-head">
            <div><h2>Needs attention</h2><p>Issues worth acting on now</p></div>
            <Icon name="alert" size={16} />
          </div>
          <div className="admin-attention-list">
            {attention.map((item, i) => (
              <Link href={item.href} key={i} className="admin-alert-row" style={{textDecoration:'none'}}>
                <span className={`admin-alert-icon ${item.tone}`}><Icon name={item.tone==='yellow'?'clock':'alert'} size={13}/></span>
                <span><span className="admin-alert-title">{item.title}</span><span className="admin-alert-meta">{item.meta}</span></span>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="admin-bottom-grid">
        <SectionCard>
          <div className="admin-panel-head">
            <div><h2>Live order activity</h2><p>Latest orders across ROZZI</p></div>
            <Link className="admin-link" href="/orders">View all <Icon name="arrow" size={12}/></Link>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Customer</th><th>Vendor</th><th>Status</th><th>Value</th></tr></thead>
              <tbody>
                {orders.slice(0,7).map(o => (
                  <tr key={o.id}>
                    <td><Link href={`/orders/${o.id}`} className="admin-order-id">{o.orderNumber}</Link></td>
                    <td>{o.customer?.fullName || '—'}</td>
                    <td>{o.vendor?.storeName || '—'}</td>
                    <td><StatusBadge status={o.status}/></td>
                    <td>{formatNaira(o.totalAmount)}</td>
                  </tr>
                ))}
                {!orders.length && <tr><td colSpan={5} style={{textAlign:'center',color:'#a8a29e'}}>No recent orders.</td></tr>}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard>
          <div className="admin-panel-head">
            <div><h2>Operations pulse</h2><p>Current marketplace state</p></div>
            <Link className="admin-link" href="/deliveries">Open <Icon name="arrow" size={12}/></Link>
          </div>
          <div className="admin-activity">
            <div className="admin-activity-row"><span className="admin-activity-dot"/><div className="admin-activity-text"><strong>{liveDeliveries.length}</strong> deliveries currently in the dispatch view<div className="admin-activity-time">Live queue</div></div></div>
            <div className="admin-activity-row"><span className="admin-activity-dot"/><div className="admin-activity-text"><strong>{onlineRiders}</strong> approved riders are online<div className="admin-activity-time">Rider network</div></div></div>
            <div className="admin-activity-row"><span className="admin-activity-dot"/><div className="admin-activity-text"><strong>{areas.filter(a=>a.status==='ACTIVE').length}</strong> service areas are active<div className="admin-activity-time">Coverage</div></div></div>
            <div className="admin-activity-row"><span className="admin-activity-dot"/><div className="admin-activity-text"><strong>{vendors.filter(v=>v.status==='PENDING').length}</strong> vendors need approval<div className="admin-activity-time">Marketplace onboarding</div></div></div>
          </div>
        </SectionCard>
      </div>

      <div className="admin-quick-actions">
        <Link href="/vendors" className="admin-card admin-quick-action"><span className="admin-quick-action-icon"><Icon name="store"/></span><span><strong>Review vendors</strong><span>Approve applications</span></span></Link>
        <Link href="/riders" className="admin-card admin-quick-action"><span className="admin-quick-action-icon"><Icon name="rider"/></span><span><strong>Review riders</strong><span>Verification queue</span></span></Link>
        <Link href="/orders" className="admin-card admin-quick-action"><span className="admin-quick-action-icon"><Icon name="orders"/></span><span><strong>Manage orders</strong><span>Search & intervene</span></span></Link>
        <Link href="/finance" className="admin-card admin-quick-action"><span className="admin-quick-action-icon"><Icon name="wallet"/></span><span><strong>Open finance</strong><span>Revenue & settlements</span></span></Link>
      </div>
    </DashboardShell>
  );
}
