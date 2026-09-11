'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';
import {api,post} from '../../lib/api';
import {onNotification} from '../../lib/realtime';

export default function Offers(){
 const[offers,setOffers]=useState<any[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function load(){try{setOffers(await api('/api/rider/delivery-offers'));setError('')}catch(e:any){setError(e.message||'Unable to load offers.')}}
 useEffect(()=>{load();const off=onNotification(n=>{if(n?.type==='DELIVERY'||n?.title==='New delivery offer') void load();});const t=setInterval(load,5000);return()=>{off();clearInterval(t)}},[]);
 async function act(id:string,a:string){setBusy(id);try{await post(`/api/rider/delivery-offers/${id}/${a}`);await load()}catch(e:any){setError(e.message||'Offer is no longer available.')}finally{setBusy('')}}
 return <main className="shell"><nav className="nav"><Link className="brand" href="/">ROZZI RIDER</Link><div className="navlinks"><Link href="/current">Current</Link><Link href="/history">History</Link></div></nav><div className="rider-heading"><div><span className="eyebrow">Dispatch queue</span><h1>Delivery offers</h1><p className="muted">Accept a compatible job to start your route.</p></div></div>{error&&<div className="error">{error}</div>}{!offers.length?<div className="card rider-empty"><h3>No offers right now</h3><p className="muted">Keep your status online to receive new delivery opportunities.</p></div>:<div className="offer-grid">{offers.map(x=><div className="card offer-card" key={x.id}><div className="offer-top"><div><b>{x.delivery?.order?.orderNumber||'Delivery'}</b><span className="muted">New dispatch offer</span></div><span className="status-badge status-warning">OFFER</span></div><h3>{x.delivery?.order?.vendor?.storeName||'Vendor'}</h3><p className="muted">Fee ₦{((x.delivery?.order?.deliveryFeeAmount||0)/100).toLocaleString('en-NG')} · {x.distanceKm?`${Number(x.distanceKm).toFixed(1)} km from pickup`:'Distance unavailable'}</p><div className="offer-actions"><button className="btn success" disabled={!!busy} onClick={()=>act(x.id,'accept')}>{busy===x.id?'Accepting…':'Accept'}</button><button className="btn secondary" disabled={!!busy} onClick={()=>act(x.id,'decline')}>Decline</button></div></div>)}</div>}</main>
}
