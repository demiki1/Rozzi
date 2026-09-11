'use client';
import {useEffect,useMemo,useState} from 'react';
import {api} from '../../lib/api';
import {onNotification} from '../../lib/realtime';

const labels:any={ORDER:'Orders',DELIVERY:'Deliveries',PAYMENT:'Payments',PAYOUT:'Payouts',INVENTORY:'Inventory',PROMOTION:'Promotions',REVIEW:'Reviews',ACCOUNT:'Account',SYSTEM:'System'};
const icons:any={ORDER:'▣',DELIVERY:'⌁',PAYMENT:'₦',PAYOUT:'₦',INVENTORY:'□',PROMOTION:'%',REVIEW:'★',ACCOUNT:'○',SYSTEM:'•'};
export default function NotificationsPage(){
 const [items,setItems]=useState<any[]>([]),[filter,setFilter]=useState('ALL'),[unread,setUnread]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [prefs,setPrefs]=useState<any[]>([]);
 const load=async()=>{try{setLoading(true);const [n,c,p]=await Promise.all([api('/api/notifications/mine'),api('/api/notifications/unread-count'),api('/api/notifications/preferences')]);setItems(n||[]);setUnread(Number(c||0));setPrefs(p||[]);}catch(e:any){setError(e?.message||'Unable to load notifications.');}finally{setLoading(false);}};
 useEffect(()=>{load(); const off=onNotification(n=>{setItems(prev=>[n,...prev.filter(x=>x.id!==n.id)].slice(0,100));setUnread(x=>x+1)}); return off;},[]);
 const visible=useMemo(()=>filter==='ALL'?items:filter==='UNREAD'?items.filter(x=>!x.readAt):items.filter(x=>x.type===filter),[items,filter]);
 const read=async(id:string)=>{await api(`/api/notifications/${id}/read`,{method:'PATCH'});setItems(x=>x.map(n=>n.id===id?{...n,readAt:new Date().toISOString()}:n));setUnread(x=>Math.max(0,x-1));};
 const readAll=async()=>{await api('/api/notifications/read-all',{method:'PATCH'});setItems(x=>x.map(n=>({...n,readAt:n.readAt||new Date().toISOString()})));setUnread(0)};
 const toggle=async(type:string,channel:string,enabled:boolean)=>{await api('/api/notifications/preferences',{method:'PATCH',body:JSON.stringify({type,channel,enabled})});setPrefs(x=>x.map(r=>r.type===type?{...r,channels:{...r.channels,[channel]:enabled}}:r));};
 return <div className="notifications-page">
  <div className="page-heading"><div><span className="eyebrow">Vendor workspace</span><h1>Notifications</h1><p>Stay on top of orders, deliveries, payouts, inventory and customer activity.</p></div><button className="secondary-button" onClick={readAll} disabled={!unread}>Mark all as read</button></div>
  {error&&<div className="state-error">{error}</div>}
  <div className="notification-layout">
   <section className="notification-card"><div className="notification-toolbar"><div className="notification-tabs">{['ALL','UNREAD','ORDER','DELIVERY','PAYMENT','INVENTORY','PROMOTION','REVIEW'].map(x=><button key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x==='ALL'?'All':x==='UNREAD'?'Unread':labels[x]||x}</button>)}</div><strong>{unread} unread</strong></div>
    {loading?<div className="empty-state">Loading notifications…</div>:visible.length===0?<div className="empty-state"><div className="empty-icon">♢</div><h3>You're all caught up</h3><p>New vendor activity will appear here.</p></div>:<div className="notification-list">{visible.map(n=><article key={n.id} className={`notification-row ${n.readAt?'read':''}`} onClick={()=>!n.readAt&&read(n.id)}><div className="notification-icon">{icons[n.type]||'•'}</div><div className="notification-body"><div><strong>{n.title}</strong><span className="notification-type">{labels[n.type]||'System'}</span></div><p>{n.message}</p><small>{new Date(n.createdAt).toLocaleString()}</small></div>{!n.readAt&&<span className="unread-dot"/>}</article>)}</div>}
   </section>
   <aside className="notification-card preferences-card"><div className="card-heading"><div><h2>Notification preferences</h2><p>Choose how you receive vendor updates.</p></div></div>{prefs.map(r=><div className="pref-row" key={r.type}><div><strong>{labels[r.type]||r.type}</strong><small>External alerts</small></div><div className="pref-switches">{Object.entries(r.channels||{}).map(([ch,val]:any)=><button key={ch} className={val?'pref-on':''} onClick={()=>toggle(r.type,ch,!val)}>{ch}</button>)}</div></div>)}</aside>
  </div>
 </div>
}
