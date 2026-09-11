'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api} from '../../lib/api';

const money=(k=0)=>`₦${(Number(k)/100).toLocaleString('en-NG',{maximumFractionDigits:0})}`;
const date=(v?:string)=>v?new Date(v).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'—';

export default function History(){
 const[xs,setXs]=useState<any[]>([]),[stats,setStats]=useState<any>({}),[error,setError]=useState('');
 useEffect(()=>{Promise.all([api('/api/rider/deliveries/history'),api('/api/rider/deliveries/stats')]).then(([h,s])=>{setXs(h);setStats(s)}).catch(e=>setError(e.message||'Unable to load history.'))},[]);
 return <main className="shell"><nav className="nav"><Link className="brand" href="/">ROZZI RIDER</Link><div className="navlinks"><Link href="/current">Current</Link><Link href="/deliveries">Offers</Link></div></nav><div className="rider-heading"><div><span className="eyebrow">Performance</span><h1>Delivery history</h1><p className="muted">Completed jobs and delivery performance.</p></div></div>{error&&<div className="error">{error}</div>}<div className="rider-metrics"><div className="card"><span>Completed</span><strong>{stats.completedDeliveries||0}</strong></div><div className="card"><span>Total jobs</span><strong>{stats.totalDeliveries||0}</strong></div><div className="card"><span>Delivery fees</span><strong>{money(stats.totalDeliveryFees)}</strong></div><div className="card"><span>Avg. delivery</span><strong>{stats.averageDeliveryMinutes?`${stats.averageDeliveryMinutes}m`:'—'}</strong></div></div><div className="card history-table"><div className="history-head"><b>Recent deliveries</b><span>{xs.length} records</span></div>{!xs.length?<p className="muted">No delivery history yet.</p>:xs.map(x=><div className="history-row" key={x.id}><div><b>{x.order.orderNumber}</b><span>{x.order.vendor?.storeName||'Vendor'}</span></div><span>{date(x.deliveredAt||x.assignedAt)}</span><span className="status-badge status-active">{x.order.status.replaceAll('_',' ')}</span><strong>{money(x.order.deliveryFeeAmount)}</strong></div>)}</div></main>
}
