import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { ConfirmDeliveryDto } from './dto/delivery.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole } from '@prisma/client';

@Controller('api')
export class DeliveryController {
  constructor(private readonly dispatchService: DispatchService) {}

  // ---------------- Starting dispatch ----------------
  // Dispatch normally starts automatically (see DispatchService's
  // onOrderTransitioned listener, added in Phase 9). This endpoint is kept
  // as an explicit admin/vendor fallback for retrying after the automatic
  // attempt logged a failure — not because auto-dispatch doesn't exist.

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('delivery/:orderId/dispatch')
  startDispatch(@Param('orderId') orderId: string, @CurrentUser() user: { userId: string }) {
    return this.dispatchService.startDispatch(orderId, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/deliveries/:orderId/dispatch')
  adminStartDispatch(@Param('orderId') orderId: string, @CurrentUser() user: { userId: string }) {
    return this.dispatchService.startDispatch(orderId, user.userId);
  }

  // ---------------- Vendor delivery operations ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/deliveries')
  vendorList(@CurrentUser() user: { userId: string }) {
    return this.dispatchService.vendorList(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/deliveries/stats')
  vendorStats(@CurrentUser() user: { userId: string }) {
    return this.dispatchService.vendorStats(user.userId);
  }

  // ---------------- Rider: offers ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/delivery-offers')
  myOffers(@CurrentUser() user: { userId: string }) {
    return this.dispatchService.getMyOffers(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/delivery-offers/:attemptId/accept')
  acceptOffer(@CurrentUser() user: { userId: string }, @Param('attemptId') attemptId: string) {
    return this.dispatchService.acceptOffer(user.userId, attemptId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/delivery-offers/:attemptId/decline')
  declineOffer(@CurrentUser() user: { userId: string }, @Param('attemptId') attemptId: string) {
    return this.dispatchService.declineOffer(user.userId, attemptId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/deliveries/history')
  riderHistory(@CurrentUser() user: { userId: string }) {
    return this.dispatchService.riderHistory(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/deliveries/stats')
  riderStats(@CurrentUser() user: { userId: string }) {
    return this.dispatchService.riderStats(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/current-delivery')
  currentDelivery(@CurrentUser() user: { userId: string }) {
    return this.dispatchService.getCurrentDelivery(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('customer/orders/:orderId/tracking')
  customerTracking(@CurrentUser() user: { userId: string }, @Param('orderId') orderId: string) {
    return this.dispatchService.getCustomerTracking(user.userId, orderId);
  }

  // ---------------- Rider: progress on an accepted delivery ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/deliveries/:id/arrived-pickup')
  arrivedAtPickup(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.dispatchService.riderArrivedAtPickup(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/deliveries/:id/picked-up')
  pickedUp(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    // Deliberately no delivery code in this response — it goes to the
    // customer, never to the rider (§15).
    return this.dispatchService.riderPickedUp(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/deliveries/:id/depart')
  depart(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.dispatchService.riderDeparted(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/deliveries/:id/arrived')
  arrivedAtCustomer(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.dispatchService.riderArrivedAtCustomer(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/deliveries/:id/confirm-delivery')
  confirmDelivery(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: ConfirmDeliveryDto,
  ) {
    return this.dispatchService.confirmDelivery(user.userId, id, dto.code);
  }

  // ---------------- Admin oversight (§74) ----------------
  // §38: scoped to OPERATIONS_ADMIN (SUPER_ADMIN always passes) — dispatch
  // is an operational concern, same bucket as locations/service areas.

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Get('admin/deliveries')
  adminList() {
    return this.dispatchService.adminListAll();
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/deliveries/:id/reassign')
  reassign(@Param('id') id: string, @CurrentUser() user: { userId: string }) {
    return this.dispatchService.adminReassign(id, user.userId);
  }

  // Stand-in for a real scheduler — see DispatchService.adminSweepTimeouts.
  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/deliveries/sweep-timeouts')
  sweepTimeouts() {
    return this.dispatchService.adminSweepTimeouts();
  }
}
