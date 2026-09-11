import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { SettingsAdminService } from './settings.service';
import { UpdateSettingsDto, UpsertSettingDto } from './dto/settings.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole } from '@prisma/client';

@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.SUPER_ADMIN)
@Controller('api/admin/settings')
export class SettingsController {
  constructor(private readonly service: SettingsAdminService) {}

  @Get()
  list() { return this.service.list(); }

  @Get(':key')
  get(@Param('key') key: string) { return this.service.get(key); }

  @Patch()
  update(@CurrentUser() user: { userId: string }, @Body() dto: UpdateSettingsDto) {
    return this.service.updateMany(dto, user.userId);
  }

  @Post('custom')
  upsert(@CurrentUser() user: { userId: string }, @Body() dto: UpsertSettingDto) {
    return this.service.upsert(dto, user.userId);
  }
}
