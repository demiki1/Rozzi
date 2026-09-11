'use client';
import { useEffect, useState } from 'react';
import VendorShell from '../../components/VendorShell';
import { api, patch, post } from '../../lib/api';

const DAYS = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
const LABELS: Record<string,string> = {monday:'Monday',tuesday:'Tuesday',wednesday:'Wednesday',thursday:'Thursday',friday:'Friday',saturday:'Saturday',sunday:'Sunday'};
const naira=(k:number)=>`₦${(Number(k||0)/100).toLocaleString('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2})}`;

export default function StorePage(){
 const [v,setV]=useState<any>(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[saved,setSaved]=useState('');
 const [uploading,setUploading]=useState<'logoUrl'|'coverImageUrl'|null>(null);
 const [form,setForm]=useState<any>({storeName:'',description:'',logoUrl:'',coverImageUrl:'',phone:'',email:'',address:'',deliveryRadiusKm:'',minimumOrderAmount:'',averagePreparationTimeMinutes:''});
 const [hours,setHours]=useState<any>({});
 useEffect(()=>{api('/api/vendor/me').then(x=>{setV(x);setForm({storeName:x.storeName||'',description:x.description||'',logoUrl:x.logoUrl||'',coverImageUrl:x.coverImageUrl||'',phone:x.phone||'',email:x.email||'',address:x.locations?.[0]?.address||'',deliveryRadiusKm:x.deliveryRadiusKm??'',minimumOrderAmount:x.minimumOrderAmount??'',averagePreparationTimeMinutes:x.averagePreparationTimeMinutes??''}); const h=x.operatingHoursJson||{}; const base:any={}; DAYS.forEach(d=>base[d]=h[d]||{open:x.operatingHoursStart||'08:00',close:x.operatingHoursEnd||'23:00',closed:false});setHours(base)}).catch(e=>setError(e.message))},[]);
 const set=(k:string,val:any)=>setForm((f:any)=>({...f,[k]:val}));
 async function saveProfile(){const {logoUrl,coverImageUrl,...profile}=form;setSaving(true);setError('');try{const x=await patch('/api/vendor/me',{...profile,deliveryRadiusKm:form.deliveryRadiusKm===''?undefined:Number(form.deliveryRadiusKm),minimumOrderAmount:form.minimumOrderAmount===''?undefined:Number(form.minimumOrderAmount),averagePreparationTimeMinutes:form.averagePreparationTimeMinutes===''?undefined:Number(form.averagePreparationTimeMinutes),operatingHoursJson:hours});setV(x);setSaved('Store details saved');setTimeout(()=>setSaved(''),2500)}catch(e:any){setError(e.message)}finally{setSaving(false)}}
 async function uploadStoreImage(field:'logoUrl'|'coverImageUrl', files:FileList|null){
  const file=files?.[0]; if(!file)return;
  const allowed=['image/jpeg','image/png','image/webp'];
  if(!allowed.includes(file.type))return setError('Please choose a JPEG, PNG, or WebP image.');
  if(file.size>20*1024*1024)return setError('Image must be 20 MB or smaller.');
  setUploading(field);setError('');
  try{
   const presign:any=await post('/api/storage/presign',{contentType:file.type,sizeBytes:file.size});
   if(!presign.publicUrl)throw new Error('Storage is not configured to provide public image URLs.');
   const response=await fetch(presign.uploadUrl,{method:'PUT',headers:{'Content-Type':file.type},body:file});
   if(!response.ok)throw new Error('Image upload failed. Please try again.');
   await post('/api/storage/complete',{key:presign.key});
   const updated=await patch('/api/vendor/me',{[field]:presign.publicUrl});
   setV(updated);set(field,presign.publicUrl);setSaved(field==='logoUrl'?'Store logo updated':'Cover image updated');setTimeout(()=>setSaved(''),2500);
  }catch(e:any){setError(e?.message||'Unable to upload image. Please try again.')}finally{setUploading(null)}
 }
 async function removeStoreImage(field:'logoUrl'|'coverImageUrl'){
  setUploading(field);setError('');
  try{const updated=await patch('/api/vendor/me',{[field]:null});setV(updated);set(field,'');setSaved(field==='logoUrl'?'Store logo removed':'Cover image removed');setTimeout(()=>setSaved(''),2500)}catch(e:any){setError(e?.message||'Unable to remove image. Please try again.')}finally{setUploading(null)}
 }
 async function mode(mode:'holiday'|'busy',enabled:boolean){try{const x=await patch('/api/vendor/me/operational-mode',{mode,enabled,busyPreparationTimeMinutes:Number(form.averagePreparationTimeMinutes||0)});setV(x)}catch(e:any){setError(e.message)}}
 async function status(open:boolean){try{const x=await patch('/api/vendor/me/open-status',{isOpen:open});setV(x)}catch(e:any){setError(e.message)}}
 async function closure(){const val=prompt('Temporary closure end time (ISO, e.g. 2026-09-02T18:00:00) or leave blank to clear:');if(val===null)return;try{const x=await patch('/api/vendor/me/temporary-closure',{until:val.trim()||null});setV(x)}catch(e:any){setError(e.message)}}
 if(!v)return <VendorShell><div className="store-page"><h1>Store Management</h1>{error&&<div className="error">{error}</div>}<div className="card">Loading store...</div></div></VendorShell>;
 return <VendorShell><div className="store-page">
  <div className="store-hero"><div><span className="eyebrow">Business control center</span><h1>{v.storeName||'Your Store'}</h1><p>Manage how your store appears, operates and fulfills orders.</p></div><div className={`store-live-pill ${v.isOpen?'open':'closed'}`}><i/> {v.isOpen?'Open for orders':'Closed'}</div></div>
  {error&&<div className="error">{error}</div>}{saved&&<div className="success">{saved}</div>}
  <section className="store-grid">
   <div className="card store-card"><div className="section-title"><div><span className="eyebrow">Store profile</span><h2>Public information</h2></div></div><div className="form-grid">
    {['storeName','phone','email','address'].map(k=><label key={k}>{k==='storeName'?'Store name':k[0].toUpperCase()+k.slice(1)}<input className="input" value={form[k]} onChange={e=>set(k,e.target.value)} /></label>)}
    <label className="full">Description<textarea className="input" rows={4} value={form.description} onChange={e=>set('description',e.target.value)}/></label>
    </div><div className="store-media-grid">
     <div className="store-media-field logo-media"><div className="store-media-preview">{form.logoUrl?<img src={form.logoUrl} alt="Store logo preview"/>:<span>{(form.storeName||'S').trim().charAt(0).toUpperCase()}</span>}</div><div className="store-media-copy"><b>Store Logo</b><small>Square JPEG, PNG, or WebP. Up to 20 MB.</small><div className="store-media-actions"><label className="btn secondary upload-button">{uploading==='logoUrl'?'Uploading…':form.logoUrl?'Change logo':'Upload logo'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e=>{void uploadStoreImage('logoUrl',e.target.files);e.currentTarget.value='';}}/></label>{form.logoUrl&&<button className="text-button" disabled={!!uploading} onClick={()=>void removeStoreImage('logoUrl')}>Remove</button>}</div></div></div>
     <div className="store-media-field cover-media"><div className="store-media-preview">{form.coverImageUrl?<img src={form.coverImageUrl} alt="Store cover preview"/>:<span>Store cover image</span>}</div><div className="store-media-copy"><b>Cover Image</b><small>Wide JPEG, PNG, or WebP. Up to 20 MB.</small><div className="store-media-actions"><label className="btn secondary upload-button">{uploading==='coverImageUrl'?'Uploading…':form.coverImageUrl?'Change cover':'Upload cover'}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={!!uploading} onChange={e=>{void uploadStoreImage('coverImageUrl',e.target.files);e.currentTarget.value='';}}/></label>{form.coverImageUrl&&<button className="text-button" disabled={!!uploading} onClick={()=>void removeStoreImage('coverImageUrl')}>Remove</button>}</div></div></div>
    </div></div>
   <div className="card store-card"><div className="section-title"><div><span className="eyebrow">Store operations</span><h2>Live controls</h2></div></div><div className="mode-list">
    <div className="mode-row"><div><b>Accept orders</b><small>{v.isOpen?'Customers can place orders':'Store is not accepting new orders'}</small></div><button className={`toggle ${v.isOpen?'on':''}`} onClick={()=>status(!v.isOpen)}><span/></button></div>
    <div className="mode-row"><div><b>Busy mode</b><small>Signal that preparation is taking longer than usual.</small></div><button className={`toggle ${v.busyMode?'on':''}`} onClick={()=>mode('busy',!v.busyMode)}><span/></button></div>
    <div className="mode-row"><div><b>Holiday mode</b><small>Keep the store closed during a holiday period.</small></div><button className={`toggle ${v.holidayMode?'on':''}`} onClick={()=>mode('holiday',!v.holidayMode)}><span/></button></div>
   </div><button className="btn secondary" onClick={closure}>Manage temporary closure</button>{v.temporaryClosureUntil&&<p className="muted">Temporary closure ends {new Date(v.temporaryClosureUntil).toLocaleString('en-NG')}</p>}</div>
   <div className="card store-card"><div className="section-title"><div><span className="eyebrow">Fulfillment</span><h2>Delivery & order rules</h2></div></div><div className="form-grid two">
    <label>Delivery radius (km)<input className="input" type="number" min="0" step="0.1" value={form.deliveryRadiusKm} onChange={e=>set('deliveryRadiusKm',e.target.value)}/></label>
    <label>Minimum order amount (₦)<input className="input" type="number" min="0" value={form.minimumOrderAmount===''?'':Number(form.minimumOrderAmount)/100} onChange={e=>set('minimumOrderAmount',Math.round(Number(e.target.value||0)*100))}/></label>
    <label>Average preparation time (minutes)<input className="input" type="number" min="0" value={form.averagePreparationTimeMinutes} onChange={e=>set('averagePreparationTimeMinutes',e.target.value)}/></label>
   </div></div>
   <div className="card store-card hours-card"><div className="section-title"><div><span className="eyebrow">Operating hours</span><h2>Weekly schedule</h2></div></div>{DAYS.map(d=><div className="hours-row" key={d}><b>{LABELS[d]}</b><label className="check"><input type="checkbox" checked={!hours[d]?.closed} onChange={e=>setHours((h:any)=>({...h,[d]:{...(h[d]||{}),closed:!e.target.checked}}))}/> Open</label>{hours[d]?.closed?<span className="closed-text">Closed</span>:<><input type="time" value={hours[d]?.open||'08:00'} onChange={e=>setHours((h:any)=>({...h,[d]:{...h[d],open:e.target.value}}))}/><span>to</span><input type="time" value={hours[d]?.close||'23:00'} onChange={e=>setHours((h:any)=>({...h,[d]:{...h[d],close:e.target.value}}))}/></>}</div>)}</div>
  </section>
  <div className="store-savebar"><span>Changes to profile, fulfillment and hours are saved together.</span><button className="btn" disabled={saving} onClick={saveProfile}>{saving?'Saving…':'Save store changes'}</button></div>
 </div></VendorShell>
}
