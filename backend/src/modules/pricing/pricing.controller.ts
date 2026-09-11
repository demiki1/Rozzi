import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { AdminRole, UserRole } from '@prisma/client';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';

import { PricingService } from './pricing.service';
import { UpdatePricingConfigDto } from './dto/update-pricing-config.dto';

@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.SUPER_ADMIN)
@Controller('api/admin/pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('service-areas/:serviceAreaId')
  getConfig(@Param('serviceAreaId') serviceAreaId: string) {
    return this.pricingService.getConfig(serviceAreaId);
  }

  @Patch('service-areas/:serviceAreaId')
  updateConfig(
    @Param('serviceAreaId') serviceAreaId: string,
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdatePricingConfigDto,
  ) {
    return this.pricingService.updateConfig(
      serviceAreaId,
      dto,
      user.userId,
    );
  }
}