'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {api} from '../../../../lib/api';
import {subscribeOrder} from '../../../../lib/realtime';
export default function Track(){
 const {id}=useParams<{id:string}>(); const [data,setData]=useState<any>(); const [error,setError]=useState('');
 async function load(){try{setData(await api(`/api/customer/orders/${id}/tracking`));setError('')}catch(e:any){setError(e.message)}}
 useEffect(()=>{load(); const off=subscribeOrder(id,()=>load(),d=>setData((prev:any)=>prev?({...prev,delivery:{...prev.delivery, rider:{...prev.delivery?.rider, location:d}}}):prev)); const t=setInterval(load,15000); return()=>{off();clearInterval(t)}},[id]);
 if(error)return <main className="shell"><Link href={`/orders/${id}`}>← Order</Link><div className="error">{error}</div></main>;
 if(!data)return <main className="shell">Loading tracking…</main>;
 const d=data.delivery; const r=d?.rider;
 return <main className="shell"><Link href={`/orders/${id}`}>← Order</Link><h1>Track {data.orderNumber}</h1><div className="card"><div className="tag">{data.status}</div><p className="muted">Tracking refreshes automatically.</p>{d? <><h2>Rider</h2><p>{r?.owner?.fullName||'Assigned rider'}</p><p>{r?.vehicleType||''} {r?.vehiclePlateNumber||''}</p>{r?.location&&<p>Current location: {Number(r.location.latitude).toFixed(5)}, {Number(r.location.longitude).toFixed(5)}</p>}</>:<p className="muted">A rider has not been assigned yet.</p>}</div><h2>Status timeline</h2>{(data.statusHistory||[]).map((h:any)=><div className="card row" key={h.id}><b>{h.toStatus}</b><span className="muted">{new Date(h.createdAt).toLocaleString()}</span></div>)}</main>
}
