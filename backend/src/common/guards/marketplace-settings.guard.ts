import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SettingsAdminService } from '../../modules/settings/settings.service';

/**
 * Enforces the operational switches exposed by the admin console at the
 * server boundary. These settings must never be UI-only: direct API callers
 * receive the same restriction as the frontend.
 *
 * This guard intentionally targets only the existing registration and
 * checkout routes; it does not alter the application's module architecture
 * or order state machine.
 */
@Injectable()
export class MarketplaceSettingsGuard implements CanActivate {
  constructor(private readonly settings: SettingsAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      path?: string;
      originalUrl?: string;
      body?: { role?: UserRole };
    }>();

    const method = request.method?.toUpperCase();
    const path = (request.path ?? request.originalUrl ?? '').split('?')[0];

    if (method === 'POST' && path === '/api/orders/checkout') {
      const enabled = Boolean((await this.settings.get('ordersEnabled')).value);
      if (!enabled) {
        throw new Error('Orders are currently disabled.');
      }
    }

    if (method === 'POST' && path === '/api/auth/register') {
      const role = request.body?.role;
      const keyByRole: Partial<Record<UserRole, string>> = {
        [UserRole.CUSTOMER]: 'customerRegistrationEnabled',
        [UserRole.VENDOR]: 'vendorRegistrationEnabled',
        [UserRole.RIDER]: 'riderRegistrationEnabled',
      };
      const key = role ? keyByRole[role] : undefined;
      if (key) {
        const enabled = Boolean((await this.settings.get(key)).value);
        if (!enabled) {
          throw new Error(`${role.toLowerCase()} registration is currently disabled.`);
        }
      }
    }

    return true;
  }
}
