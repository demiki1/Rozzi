import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, AdminRole } from '@prisma/client';

@Controller('api/admin')
@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.FINANCE_ADMIN, AdminRole.SUPPORT_ADMIN)
export class AuditLogController {
  constructor(private readonly audit: AuditLogService) {}

  @Get('audit-logs')
  list(@Query('entityType') entityType?: string) {
    return this.audit.listRecent(entityType);
  }
}