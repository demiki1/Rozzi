'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,post} from '../../lib/api';
import {onOrderStatus} from '../../lib/realtime';

const steps:[string,string,string][]=[
 ['RIDER_ASSIGNED','Assigned','Arrived at pickup'],['RIDER_ARRIVED_PICKUP','At pickup','Picked up'],
 ['PICKED_UP','Picked up','Departed'],['IN_TRANSIT','In transit','Arrived at customer'],
 ['RIDER_ARRIVED','At customer','Confirm delivery']
];
const order=[ 'RIDER_ASSIGNED','RIDER_ARRIVED_PICKUP','PICKED_UP','IN_TRANSIT','RIDER_ARRIVED','DELIVERED' ];

export default function Current(){
 const[d,setD]=useState<any>(),[code,setCode]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){try{setD(await api('/api/rider/current-delivery'));setError('')}catch(e:any){setError(e.message||'Unable to load current delivery.')}}
 useEffect(()=>{load(); const off=onOrderStatus(()=>load()); const t=setInterval(load,15000); return()=>{off();clearInterval(t)}},[]);
 async function act(path:string){setBusy(true);try{await post(`/api/rider/deliveries/${d.id}/${path}`,path==='confirm-delivery'?{code}:undefined);setCode('');await load()}catch(e:any){setError(e.message||'Action failed.')}finally{setBusy(false)}}
 if(!d)return <main className="shell rider-current"><Link href="/">← Dashboard</Link><h1>Current delivery</h1>{error&&<div className="error">{error}</div>}<div className="card rider-empty"><h3>No active delivery</h3><p className="muted">Accept an offer to see your next delivery here.</p></div></main>;
 const s=d.order.status, action=steps.find(x=>x[0]===s), idx=Math.max(0,order.indexOf(s));
 return <main className="shell rider-current"><div className="back-row"><Link href="/">← Dashboard</Link><Link href="/deliveries">Offers</Link></div><div className="rider-heading"><div><span className="eyebrow">Current delivery</span><h1>{d.order.orderNumber}</h1><p className="muted">{d.order.vendor?.storeName||'Vendor'}</p></div><span className="status-badge status-info">{s.replaceAll('_',' ')}</span></div>{error&&<div className="error">{error}</div>}
 <div className="card delivery-progress-card"><div className="step-track">{order.map((x,i)=><div className={`step ${i<=idx?'done':''}`} key={x}><i>{i<idx?'✓':i===idx?'●':'·'}</i><span>{x.replaceAll('_',' ')}</span></div>)}</div></div>
 <div className="current-grid"><div className="card"><span className="eyebrow">Pickup</span><h3>{d.order.vendor?.storeName||'Vendor'}</h3><p className="muted">Go to the vendor and follow pickup instructions.</p></div><div className="card"><span className="eyebrow">Drop-off</span><h3>{d.order.address?.addressText||d.order.address?.addressLine1||'Customer address'}</h3>{d.order.customerNote&&<p className="muted">Note: {d.order.customerNote}</p>}</div></div>
 <div className="card action-card">{action&&action[2]==='Confirm delivery'?<><h3>Confirm customer delivery</h3><p className="muted">Ask the customer for the 4-digit delivery code. Never ask for their password or payment details.</p><input className="input" inputMode="numeric" maxLength={4} placeholder="4-digit customer code" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/><button className="btn success" disabled={busy||code.length!==4} onClick={()=>act('confirm-delivery')}>Confirm delivery</button></>:action&&<><h3>Next step: {action[2]}</h3><button className="btn success" disabled={busy} onClick={()=>act(action[2]==='Arrived at pickup'?'arrived-pickup':action[2]==='Picked up'?'picked-up':action[2]==='Departed'?'depart':'arrived')}>{busy?'Updating…':action[2]}</button></>}</div>
 </main>
}
