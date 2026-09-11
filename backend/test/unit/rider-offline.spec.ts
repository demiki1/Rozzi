import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RiderStatus } from '@prisma/client';
import { RidersService } from '../../src/modules/riders/riders.service';

describe('RidersService offline safety', () => {
  const prisma: any = {
    rider: { findUnique: jest.fn(), update: jest.fn() },
    delivery: { findFirst: jest.fn() },
  };
  const service = new RidersService(prisma, {} as any, {} as any);

  beforeEach(() => jest.clearAllMocks());

  it('rejects going offline during an active delivery', async () => {
    prisma.rider.findUnique.mockResolvedValue({ id: 'r1', ownerUserId: 'u1', status: RiderStatus.ACTIVE });
    prisma.delivery.findFirst.mockResolvedValue({ id: 'd1' });
    await expect(service.goOffline('u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.rider.update).not.toHaveBeenCalled();
  });
});
