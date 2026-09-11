import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, SmsProvider } from '../interfaces/notification-provider.interface';

// §100: "If a provider cannot be tested because credentials are missing,
// clearly state that." These adapters log instead of silently no-opping
// AND instead of pretending to have sent something — every log line makes
// clear this is a stand-in, not a real delivery, so nobody mistakes a
// console log for a customer actually receiving an SMS.
@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  private readonly logger = new Logger('EmailProvider(console-stub)');

  constructor(private readonly config: ConfigService) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    const configured = !!this.config.get<string>('EMAIL_API_KEY');
    this.logger.log(
      `[STUB — ${configured ? 'EMAIL_API_KEY set but no real provider wired up yet' : 'EMAIL_API_KEY not set'}] ` +
        `Would email ${to}: "${subject}" — ${body}`,
    );
  }
}

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  private readonly logger = new Logger('SmsProvider(console-stub)');

  constructor(private readonly config: ConfigService) {}

  async send(to: string, message: string): Promise<void> {
    const configured = !!this.config.get<string>('SMS_API_KEY');
    this.logger.log(
      `[STUB — ${configured ? 'SMS_API_KEY set but no real provider wired up yet' : 'SMS_API_KEY not set'}] ` +
        `Would text ${to}: ${message}`,
    );
  }
}
