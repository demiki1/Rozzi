import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto/promotion.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { UserRole, AdminRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api')
export class PromotionsController {
  constructor(private readonly s: PromotionsService) {}

  @Public()
  @Get('promotions')
  public(@Query('vendorId') vendorId?: string) { return this.s.listPublic(vendorId); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/promotions')
  mine(@CurrentUser() u: { userId: string }) { return this.s.listMine(u.userId); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/promotions')
  createVendor(@CurrentUser() u: { userId: string }, @Body() d: CreatePromotionDto) { return this.s.createForVendor(u.userId, d); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/promotions/:id')
  updateVendor(@CurrentUser() u: { userId: string }, @Param('id') id: string, @Body() d: UpdatePromotionDto) { return this.s.updateForVendor(u.userId, id, d); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/promotions/:id/deactivate')
  deactivateVendor(@CurrentUser() u: { userId: string }, @Param('id') id: string) { return this.s.deactivateForVendor(u.userId, id); }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Get('admin/promotions')
  admin() { return this.s.listAdmin(); }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Post('admin/promotions')
  create(@CurrentUser() u: { userId: string }, @Body() d: CreatePromotionDto) { return this.s.create(d, u.userId); }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Patch('admin/promotions/:id')
  update(@CurrentUser() u: { userId: string }, @Param('id') id: string, @Body() d: UpdatePromotionDto) { return this.s.update(id, d, u.userId); }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Post('admin/promotions/:id/deactivate')
  deactivate(@CurrentUser() u: { userId: string }, @Param('id') id: string) { return this.s.deactivate(id, u.userId); }
}
