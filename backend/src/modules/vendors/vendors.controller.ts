import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { RegisterVendorDto, UpdateVendorProfileDto, SetVendorOpenStatusDto, RejectVendorDto } from './dto/vendor.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole, DeliveryModel, VendorStatus } from '@prisma/client';

@Controller('api')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // ---------------- Public ----------------

  @Public()
  @Get('vendor-types')
  listVendorTypes() {
    return this.vendorsService.listVendorTypes();
  }

  @Public()
  @Get('service-areas/:serviceAreaId/vendors')
  listForServiceArea(@Param('serviceAreaId') serviceAreaId: string) {
    return this.vendorsService.listForServiceArea(serviceAreaId);
  }

  @Public()
  @Get('vendors/:id')
  getPublicVendor(@Param('id') id: string) {
    return this.vendorsService.getPublicVendor(id);
  }

  // ---------------- Vendor's own dashboard ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/register')
  register(@CurrentUser() user: { userId: string }, @Body() dto: RegisterVendorDto) {
    return this.vendorsService.register(user.userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/dashboard')
  getDashboard(@CurrentUser() user: { userId: string }) {
    return this.vendorsService.getDashboard(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/me')
  getMine(@CurrentUser() user: { userId: string }) {
    return this.vendorsService.getByOwner(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/me')
  updateProfile(@CurrentUser() user: { userId: string }, @Body() dto: UpdateVendorProfileDto) {
    return this.vendorsService.updateProfile(user.userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/me/open-status')
  setOpenStatus(@CurrentUser() user: { userId: string }, @Body() dto: SetVendorOpenStatusDto) {
    return this.vendorsService.setOpenStatus(user.userId, dto.isOpen);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/me/temporary-closure')
  setTemporaryClosure(@CurrentUser() user: { userId: string }, @Body() body: { until: string | null }) {
    return this.vendorsService.setTemporaryClosure(user.userId, body.until);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/me/operational-mode')
  setOperationalMode(@CurrentUser() user: { userId: string }, @Body() body: { mode: 'holiday' | 'busy'; enabled: boolean; busyPreparationTimeMinutes?: number }) {
    return this.vendorsService.setOperationalMode(user.userId, body.mode, body.enabled, body.busyPreparationTimeMinutes);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/me/documents')
  uploadDocument(@CurrentUser() user: { userId: string }, @Body() body: { docType: string; fileUrl: string }) {
    return this.vendorsService.uploadDocument(user.userId, body.docType, body.fileUrl);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/me/delivery-models')
  setDeliveryModels(@CurrentUser() user: { userId: string }, @Body() body: { models: DeliveryModel[] }) {
    return this.vendorsService.setDeliveryModels(user.userId, body.models);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/me/service-areas')
  addServiceArea(
    @CurrentUser() user: { userId: string },
    @Body() body: { serviceAreaId: string; address?: string },
  ) {
    return this.vendorsService.addServiceArea(user.userId, body.serviceAreaId, body.address);
  }

  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR)
  @Get('vendor/analytics')
  getVendorAnalytics(@CurrentUser() user:{userId:string}, @Query('from') from?:string, @Query('to') to?:string){return this.vendorsService.getVendorAnalytics(user.userId,from,to);}

  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR)
  @Get('vendor/customers')
  getVendorCustomers(@CurrentUser() user:{userId:string}, @Query('search') search?:string, @Query('status') status?:string){return this.vendorsService.getVendorCustomers(user.userId,search,status);}

  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR)
  @Patch('vendor/settings')
  updateVendorSettings(@CurrentUser() user:{userId:string}, @Body() dto:UpdateVendorProfileDto){return this.vendorsService.updateVendorSettings(user.userId,dto);}

  // ---------------- Admin ----------------
  // §38: these are scoped to VENDOR_ADMIN (SUPER_ADMIN always passes too —
  // see AdminRolesGuard). Every mutating action here is also audit-logged
  // (§39) via VendorsService.

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.VENDOR_ADMIN)
  @Get('admin/vendors')
  listAdmin(@Query('status') status?: VendorStatus) {
    return this.vendorsService.listAdmin(status);
  }

@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.VENDOR_ADMIN)
@Get('admin/vendors/pending')
listPending() {
  return this.vendorsService.listPending();
}

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.VENDOR_ADMIN)
  @Post('admin/vendors/:id/approve')
  approve(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.vendorsService.approve(id, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.VENDOR_ADMIN)
  @Post('admin/vendors/:id/reject')
  reject(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: RejectVendorDto) {
    return this.vendorsService.reject(id, user.userId, dto.reason);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.VENDOR_ADMIN)
  @Post('admin/vendors/:id/suspend')
  suspend(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.vendorsService.suspend(id, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.VENDOR_ADMIN)
  @Post('admin/vendor-types')
  createVendorType(@Body() body: { name: string }) {
    return this.vendorsService.createVendorType(body.name);
  }
}
