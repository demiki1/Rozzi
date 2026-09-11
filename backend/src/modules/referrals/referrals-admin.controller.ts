import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { UserRole, AdminRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';

import { ReferralsAdminService } from './referrals-admin.service';
import { UpdateReferralProgramConfigDto } from './dto/referral-program-config.dto';

@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.SUPER_ADMIN)
@Controller('api/admin/referrals')
export class ReferralsAdminController {
  constructor(
    private readonly referralsAdmin: ReferralsAdminService,
  ) {}

  @Get('config')
  getConfig() {
    return this.referralsAdmin.getConfig();
  }

  @Patch('config')
  updateConfig(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateReferralProgramConfigDto,
  ) {
    return this.referralsAdmin.updateConfig(
      dto,
      user.userId,
    );
  }
}
