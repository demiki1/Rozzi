import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { Public } from '../../common/decorators/public.decorator';

@Controller('api/referrals')
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  @Public()
  @Get('resolve')
  resolve(@Query('code') code?: string) {
    return this.referrals.resolveReferralCode(code || '');
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('mine')
  mine(@CurrentUser() user: { userId: string }) {
    return this.referrals.getMyReferralDashboard(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('code')
  code(@CurrentUser() user: { userId: string }) {
    return this.referrals.getOrCreateReferralCode(user.userId);
  }
}
