'use client';
import { useEffect, useMemo, useState } from 'react';
import { VendorShell } from '../../components/VendorShell';
import { api, post } from '../../lib/api';

const docs=[['BUSINESS_REGISTRATION','Business registration / CAC','Upload a clear registration document.'],['IDENTITY_DOCUMENT','Owner identity','Use a valid government-issued ID.'],['STORE_PROOF','Store / location proof','Show evidence of the business location.']];
const labels:any={NOT_STARTED:'Not started',IN_PROGRESS:'In progress',SUBMITTED:'Submitted',UNDER_REVIEW:'Under review',NEEDS_INFORMATION:'More information needed',APPROVED:'Approved',REJECTED:'Rejected'};
export default function OnboardingPage(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[urls,setUrls]=useState<any>({});
 const load=()=>api('/api/vendor/onboarding').then(setData).catch(e=>setError(e.message)); useEffect(()=>{load()},[]);
 const requiredDone=useMemo(()=>data?.checklist?.filter((x:any)=>x.required&&x.complete).length||0,[data]);
 async function add(type:string){setError('');const url=(urls[type]||'').trim();if(!url)return setError('Enter the document URL first.');setBusy(true);try{await post('/api/vendor/onboarding/documents',{docType:type,fileUrl:url});setUrls({...urls,[type]:''});await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 async function submit(){setBusy(true);setError('');try{await post('/api/vendor/onboarding/submit',{});await load()}catch(e:any){setError(e.message)}finally{setBusy(false)}}
 if(!data)return <VendorShell><div className="page-state"><h1>Onboarding & verification</h1><p>{error||'Loading…'}</p></div></VendorShell>;
 const status=data.verification?.status||'NOT_STARTED';
 return <VendorShell><div className="onboarding-page">
  <section className="onboarding-hero"><div><p className="eyebrow">Launch readiness</p><h1>Onboarding & verification</h1><p>Complete your store setup and submit the required information for ROZZI review.</p></div><div className="verification-status"><span>Status</span><strong>{labels[status]||status}</strong></div></section>
  {error&&<div className="error-banner">{error}</div>}
  {(data.verification?.rejectionReason||data.verification?.adminNote)&&<div className="review-note"><strong>Review feedback</strong><p>{data.verification.rejectionReason||data.verification.adminNote}</p></div>}
  <section className="onboarding-progress panel"><div className="section-title"><div><p className="eyebrow">Setup progress</p><h2>{data.percentage}% complete</h2></div><span>{requiredDone}/{data.checklist.filter((x:any)=>x.required).length} required items</span></div><div className="progress-track"><span style={{width:`${data.percentage}%`}}/></div></section>
  <section className="onboarding-grid">
   <article className="panel"><div className="section-title"><div><p className="eyebrow">Checklist</p><h2>Before you go live</h2></div></div><div className="checklist">{data.checklist.map((x:any)=><div className="check-row" key={x.key}><span className={`check-icon ${x.complete?'done':''}`}>{x.complete?'✓':'○'}</span><div><strong>{x.label}</strong><span>{x.required?'Required':'Recommended'}</span></div></div>)}</div></article>
   <article className="panel"><div className="section-title"><div><p className="eyebrow">Verification documents</p><h2>Required documents</h2></div></div><div className="doc-list">{docs.map(([type,title,help])=>{const row=data.documents.find((d:any)=>d.docType===type);return <div className="doc-card" key={type}><div className="doc-top"><div><strong>{title}</strong><span>{help}</span></div><b className={`doc-status ${String(row?.status||'MISSING').toLowerCase()}`}>{row?.status||'Missing'}</b></div>{row?.rejectionReason&&<p className="doc-reason">{row.rejectionReason}</p>}<div className="doc-action"><input className="input" placeholder="Secure document URL" value={urls[type]||''} onChange={e=>setUrls({...urls,[type]:e.target.value})}/><button className="btn outline" disabled={busy} onClick={()=>add(type)}>{row?'Replace':'Add document'}</button></div></div>})}</div><p className="muted small">For this development build, documents are referenced by secure URLs. A production file-storage provider should validate type, size and malware before accepting uploads.</p></article>
  </section>
  <section className="panel launch-panel"><div><p className="eyebrow">Final step</p><h2>Submit for admin approval</h2><p>Your store stays closed until verification is approved. ROZZI will notify you when the review changes.</p></div><button className="btn" disabled={busy||status==='SUBMITTED'||status==='UNDER_REVIEW'||status==='APPROVED'} onClick={submit}>{status==='APPROVED'?'Approved':status==='UNDER_REVIEW'?'Under review':status==='SUBMITTED'?'Submitted':'Submit for approval'}</button></section>
 </div></VendorShell>
}
