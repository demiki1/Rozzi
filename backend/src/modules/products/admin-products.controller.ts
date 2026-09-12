import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole, AdminRole } from '@prisma/client';
import { AdminProductsService } from './admin-products.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/admin/products')
@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.CONTENT_ADMIN)
export class AdminProductsController {
  constructor(private readonly products: AdminProductsService) {}

  @Get()
  list() { return this.products.list(); }

  @Patch(':id/availability')
  setAvailability(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { isAvailable?: boolean }) {
    return this.products.setAvailability(id, body.isAvailable === true, user.userId);
  }
}
