import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { CreateServiceAreaDto, UpdateServiceAreaDto, UpdateServiceAreaStatusDto } from './dto/service-area.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, ServiceAreaStatus, AdminRole } from '@prisma/client';

@Controller('api')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  // ---------------- Public / customer-facing ----------------

  @Public()
  @Get('locations/tree')
  getTree(@Query('rootId') rootId?: string) {
    return this.locationsService.getLocationTree(rootId);
  }

  @Public()
  @Get('service-areas')
  listActiveServiceAreas() {
    return this.locationsService.listServiceAreas(ServiceAreaStatus.ACTIVE);
  }

  @Public()
  @Get('service-areas/:id/availability')
  checkAvailability(@Param('id') id: string) {
    return this.locationsService.checkAvailability(id);
  }

  @Public()
  @Post('waitlist')
  joinWaitlist(
    @Body() body: { phone?: string; email?: string; serviceAreaId?: string; requestedPlace?: string },
  ) {
    return this.locationsService.joinWaitlist(body);
  }

  // ---------------- Admin-only management ----------------
  // §38: scoped to OPERATIONS_ADMIN (SUPER_ADMIN always passes). Mutations
  // are audit-logged (§39) via LocationsService. Real launch-checklist
  // enforcement beyond "has a delivery zone" (§95) is still a gap, not
  // something this phase added.

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/locations')
  createLocation(@CurrentUser() user: { userId: string }, @Body() dto: CreateLocationDto) {
    return this.locationsService.createLocation(dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Patch('admin/locations/:id')
  updateLocation(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.updateLocation(id, dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/locations/:id/deactivate')
  deactivateLocation(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.locationsService.deactivateLocation(id, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/service-areas')
  createServiceArea(@CurrentUser() user: { userId: string }, @Body() dto: CreateServiceAreaDto) {
    return this.locationsService.createServiceArea(dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Get('admin/service-areas')
  listAllServiceAreas(@Query('status') status?: ServiceAreaStatus) {
    return this.locationsService.listServiceAreas(status);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Get('admin/service-areas/:id')
  getServiceArea(@Param('id') id: string) {
    return this.locationsService.getServiceArea(id);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Patch('admin/service-areas/:id')
  updateServiceArea(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateServiceAreaDto) {
    return this.locationsService.updateServiceArea(id, dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Patch('admin/service-areas/:id/status')
  updateStatus(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateServiceAreaStatusDto) {
    return this.locationsService.updateServiceAreaStatus(id, dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/service-areas/:id/delivery-zones')
  createDeliveryZone(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { name: string; radiusKm?: number },
  ) {
    return this.locationsService.createDeliveryZone(id, body.name, user.userId, body.radiusKm);
  }
}
