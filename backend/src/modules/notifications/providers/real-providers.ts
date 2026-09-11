import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, SmsProvider } from '../interfaces/notification-provider.interface';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
 constructor(private readonly config:ConfigService){}
 async send(to:string,subject:string,body:string){
  const key=this.config.get<string>('RESEND_API_KEY'); const from=this.config.get<string>('EMAIL_FROM');
  if(!key||!from) throw new ServiceUnavailableException('Email integration implemented but awaiting RESEND_API_KEY and EMAIL_FROM.');
  const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({from,to,subject,text:body})});
  if(!r.ok) throw new Error(`Resend email failed: ${r.status}`);
 }
}

@Injectable()
export class TermiiSmsProvider implements SmsProvider {
 constructor(private readonly config:ConfigService){}
 async send(to:string,message:string){
  const key=this.config.get<string>('TERMII_API_KEY'); const sender=this.config.get<string>('TERMII_SENDER_ID','Rozzi');
  if(!key) throw new ServiceUnavailableException('SMS integration implemented but awaiting TERMII_API_KEY.');
  const r=await fetch('https://api.ng.termii.com/api/sms/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,from:sender,sms:message,type:'plain',channel:'generic',api_key:key})});
  if(!r.ok) throw new Error(`Termii SMS failed: ${r.status}`);
 }
}
