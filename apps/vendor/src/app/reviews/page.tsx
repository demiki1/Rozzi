'use client';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

type Review = { id:string; vendorRating?:number|null; productRating?:number|null; riderRating?:number|null; comment?:string|null; vendorResponse?:string|null; vendorRespondedAt?:string|null; createdAt:string; customer?:{fullName:string}; product?:{id:string;name:string}|null };
const naira=(n:number)=>`₦${Math.round(n/100).toLocaleString('en-NG')}`;
const stars=(n:number)=>'★'.repeat(Math.max(0,Math.min(5,Math.round(n))))+'☆'.repeat(Math.max(0,5-Math.round(n)));
function date(v:string){return new Date(v).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'});}

export default function ReviewsPage(){
 const [tab,setTab]=useState<'all'|'unanswered'|'product'>('all'); const [rating,setRating]=useState(''); const [search,setSearch]=useState(''); const [productId,setProductId]=useState('');
 const [data,setData]=useState<any>(null); const [rows,setRows]=useState<Review[]>([]); const [loading,setLoading]=useState(true); const [error,setError]=useState(''); const [replying,setReplying]=useState<Review|null>(null); const [reply,setReply]=useState(''); const [saving,setSaving]=useState(false);
 async function load(){setLoading(true);setError('');try{const overview=await api('/api/vendor/reviews/overview');setData(overview);const qs=new URLSearchParams();if(rating)qs.set('rating',rating);if(search)qs.set('search',search);if(productId)qs.set('productId',productId);if(tab==='unanswered')qs.set('responded','false');const r=await api(`/api/vendor/reviews?${qs.toString()}`);setRows(r.items||[]);}catch(e:any){setError(e.message||'Unable to load reviews.')}finally{setLoading(false)}}
 useEffect(()=>{load()},[tab,rating,productId]);
 const filtered=useMemo(()=>rows,[rows]);
 async function sendReply(){if(!reply.trim()||!replying)return;setSaving(true);try{await api(`/api/vendor/reviews/${replying.id}/response`,{method:'PATCH',body:JSON.stringify({response:reply.trim()})});setReplying(null);setReply('');await load()}catch(e:any){setError(e.message||'Unable to respond.')}finally{setSaving(false)}}
 if(loading&&!data)return <div className="reviews-state"><div className="finance-spinner"/><span>Loading your review centre…</span></div>;
 const s=data?.summary||{average:0,count:0,productAverage:0,productRatingCount:0,responseRate:0,unansweredCount:0,distribution:[]};
 return <div className="reviews-page">
  <div className="reviews-heading"><div><div className="reviews-eyebrow">CUSTOMER FEEDBACK</div><h1>Reviews & Ratings</h1><p>Understand what customers love, find service gaps, and respond professionally.</p></div></div>
  {error&&<div className="reviews-alert">{error}</div>}
  <div className="reviews-metrics">
   <div className="reviews-metric reviews-score"><span>Overall store rating</span><strong>{Number(s.average||0).toFixed(1)} <em>★</em></strong><small>{s.count} rated orders</small></div>
   <div className="reviews-metric"><span>Product rating</span><strong>{Number(s.productAverage||0).toFixed(1)} ★</strong><small>{s.productRatingCount} product ratings</small></div>
   <div className="reviews-metric"><span>Response rate</span><strong>{s.responseRate}%</strong><small>{s.unansweredCount} awaiting a response</small></div>
   <div className="reviews-metric"><span>Recent feedback</span><strong>{data?.recent?.length||0}</strong><small>Latest reviews in your store</small></div>
  </div>
  <div className="reviews-grid">
   <section className="reviews-card distribution-card"><div className="reviews-card-head"><div><span>RATING HEALTH</span><h2>Rating distribution</h2></div><b>{Number(s.average||0).toFixed(1)} / 5</b></div><div className="rating-bars">{(s.distribution||[]).map((d:any)=><div className="rating-bar" key={d.star}><span>{d.star} ★</span><div><i style={{width:`${d.percentage}%`}}/></div><small>{d.count}</small></div>)}</div></section>
   <section className="reviews-card product-rating-card"><div className="reviews-card-head"><div><span>PRODUCT RATINGS</span><h2>Product performance</h2></div></div><div className="product-rating-list">{(data?.products||[]).slice(0,8).map((p:any)=><ProductRating key={p.id} product={p}/>)}</div>{!(data?.products||[]).length&&<div className="reviews-empty">No products found.</div>}</section>
  </div>
  <section className="reviews-card reviews-list-card">
   <div className="reviews-card-head list-head"><div><span>VOICE OF THE CUSTOMER</span><h2>Customer reviews</h2></div><div className="review-controls"><div className="review-search">⌕<input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="Search reviews…"/></div><select value={rating} onChange={e=>setRating(e.target.value)}><option value="">All ratings</option>{[5,4,3,2,1].map(x=><option key={x} value={x}>{x} stars</option>)}</select><select value={productId} onChange={e=>setProductId(e.target.value)}><option value="">All products</option>{(data?.products||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
   <div className="review-tabs"><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>All reviews</button><button className={tab==='unanswered'?'active':''} onClick={()=>setTab('unanswered')}>Needs response <b>{s.unansweredCount}</b></button></div>
   <div className="review-list">{filtered.length?filtered.map(r=><ReviewRow key={r.id} review={r} onReply={()=>{setReplying(r);setReply('')}}/>):<div className="reviews-empty"><strong>No reviews match these filters.</strong><span>Try another rating, product, or search term.</span></div>}</div>
  </section>
  {replying&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setReplying(null)}}><section className="review-reply-modal"><button className="modal-x" onClick={()=>setReplying(null)}>×</button><div className="reviews-eyebrow">RESPOND TO CUSTOMER</div><h2>Write a professional reply</h2><p className="reply-context"><b>{replying.customer?.fullName||'Customer'}</b> · {replying.vendorRating||replying.productRating||0}★ · {date(replying.createdAt)}</p><div className="reply-original">{replying.comment||'The customer left a rating without a written comment.'}</div><label>Response<textarea maxLength={1000} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Thank the customer, acknowledge their feedback, and explain what you’ll do next…"/><small>{reply.length}/1000</small></label><div className="reply-actions"><button className="btn secondary" onClick={()=>setReplying(null)}>Cancel</button><button className="btn primary" disabled={saving||!reply.trim()} onClick={sendReply}>{saving?'Sending…':'Post response'}</button></div></section></div>}
 </div>
}
function ProductRating({product}:{product:any}){return <div className="product-rating-row"><div><strong>{product.name}</strong><span>{product.rating?.count||0} ratings</span></div><b>{product.rating?.count?`${Number(product.rating.average).toFixed(1)} ★`:'—'}</b></div>}

function ReviewRow({review,onReply}:{review:Review;onReply:()=>void}){return <article className="review-row"><div className="review-avatar">{(review.customer?.fullName||'C').charAt(0).toUpperCase()}</div><div className="review-main"><div className="review-top"><div><strong>{review.customer?.fullName||'Customer'}</strong><span>{date(review.createdAt)}{review.product?.name?` · ${review.product.name}`:''}</span></div><div className="review-stars">{stars(review.vendorRating||review.productRating||0)}</div></div>{review.comment?<p>{review.comment}</p>:<p className="no-comment">No written comment.</p>}<div className="review-subratings">{review.vendorRating&&<span>Store {review.vendorRating}★</span>}{review.productRating&&<span>Product {review.productRating}★</span>}{review.riderRating&&<span>Rider {review.riderRating}★</span>}</div>{review.vendorResponse?<div className="vendor-response"><b>Your response</b><span>{review.vendorResponse}</span></div>:<button className="review-reply" onClick={onReply}>↩ Respond to review</button>}</div></article>}
