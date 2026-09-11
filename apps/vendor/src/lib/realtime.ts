'use client';
import { io, Socket } from 'socket.io-client';
import { token } from './api';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
let socket: Socket | null = null;

export function connectRealtime() {
  if (typeof window === 'undefined') return null;
  const t = token();
  if (!t) return null;
  if (socket?.connected) return socket;
  socket = io(BASE, { transports: ['websocket'], auth: (cb) => cb({ token: token() }), reconnection: true, reconnectionAttempts: 8 });
  return socket;
}
export function disconnectRealtime() { socket?.disconnect(); socket = null; }
export function subscribeOrder(orderId: string, onStatus?: (data:any)=>void, onLocation?: (data:any)=>void) {
  const s=connectRealtime(); if(!s) return ()=>{};
  const status=(d:any)=>onStatus?.(d), location=(d:any)=>onLocation?.(d);
  s.emit('subscribe_order',{orderId}); s.on('order:status',status); s.on('rider:location',location);
  return ()=>{s.off('order:status',status);s.off('rider:location',location);s.emit('unsubscribe_order',{orderId});};
}
export function onOrderStatus(cb:(data:any)=>void){const s=connectRealtime();if(!s)return()=>{};s.on('order:status',cb);return()=>s.off('order:status',cb);}
export function onNotification(cb:(data:any)=>void){const s=connectRealtime();if(!s)return()=>{};s.on('notification:new',cb);return()=>s.off('notification:new',cb);}
