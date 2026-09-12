import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { MarketplaceSettingsGuard } from './marketplace-settings.guard';

describe('MarketplaceSettingsGuard', () => {
  function context(request: Record<string, unknown>) {
    return { switchToHttp: () => ({ getRequest: () => request }) } as any;
  }

  it('blocks checkout when the admin orders switch is disabled', async () => {
    const settings = { get: jest.fn().mockResolvedValue({ key: 'ordersEnabled', value: false }) } as any;
    const guard = new MarketplaceSettingsGuard(settings);
    await expect(guard.canActivate(context({ method: 'POST', path: '/api/orders/checkout' }))).rejects.toThrow(BadRequestException);
    expect(settings.get).toHaveBeenCalledWith('ordersEnabled');
  });

  it('allows checkout when the admin orders switch is enabled', async () => {
    const settings = { get: jest.fn().mockResolvedValue({ key: 'ordersEnabled', value: true }) } as any;
    const guard = new MarketplaceSettingsGuard(settings);
    await expect(guard.canActivate(context({ method: 'POST', path: '/api/orders/checkout' }))).resolves.toBe(true);
  });

  it('blocks the configured registration role when its admin switch is disabled', async () => {
    const settings = { get: jest.fn().mockResolvedValue({ key: 'vendorRegistrationEnabled', value: false }) } as any;
    const guard = new MarketplaceSettingsGuard(settings);
    await expect(guard.canActivate(context({ method: 'POST', path: '/api/auth/register', body: { role: UserRole.VENDOR } }))).rejects.toThrow(BadRequestException);
    expect(settings.get).toHaveBeenCalledWith('vendorRegistrationEnabled');
  });
});
