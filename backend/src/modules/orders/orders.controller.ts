import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AddressesService } from './addresses.service';
import { CheckoutDto, CancelOrderDto, CreateAddressDto } from './dto/order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminRole, UserRole, OrderStatus } from '@prisma/client';

@Controller('api')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly addressesService: AddressesService,
  ) {}

  // ---------------- Customer addresses (§84) ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('customer/addresses')
  listAddresses(@CurrentUser() user: { userId: string }) {
    return this.addressesService.list(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('customer/addresses')
  createAddress(@CurrentUser() user: { userId: string }, @Body() dto: CreateAddressDto) {
    return this.addressesService.create(user.userId, dto);
  }

  // ---------------- Customer checkout / order history (§5, §76) ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('orders/checkout')
  checkout(@CurrentUser() user: { userId: string }, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user.userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('orders/mine')
  listMine(@CurrentUser() user: { userId: string }) {
    return this.ordersService.listMyOrders(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('orders/:id/reorder')
  reorder(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.ordersService.reorder(user.userId, id); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('orders/:id/cancel')
  cancel(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancel(user.userId, id, dto.reason);
  }

  // Any authenticated party involved in the order (customer/vendor
  // owner/admin) can view it — access control enforced in the service.
  @Get('orders/:id')
  getOrder(
    @CurrentUser() user: { userId: string; role: string },
    @Param('id') id: string,
  ) {
    return this.ordersService.getOrderDetail(user.userId, user.role, id);
  }

  // ---------------- Dev-only payment stub (see OrdersService for why) ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @Post('orders/:id/dev-mark-paid')
  devMarkPaid(@Param('id') id: string) {
    return this.ordersService.devMarkPaidStub(id);
  }

  // ---------------- Vendor order queue (§9) ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/orders')
  vendorQueue(
    @CurrentUser() user: { userId: string },
    @Query('status') status?: OrderStatus,
  ) {
    return this.ordersService.listVendorQueue(user.userId, status ? [status] : undefined);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/orders/:id/accept')
  vendorAccept(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.ordersService.vendorAccept(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/orders/:id/reject')
  vendorReject(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.ordersService.vendorReject(user.userId, id, body?.reason);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/orders/:id/preparing')
  vendorPreparing(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.ordersService.vendorStartPreparing(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/orders/:id/ready')
  vendorReady(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.ordersService.vendorMarkReady(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/orders/:id/delivered')
  vendorDelivered(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.ordersService.vendorMarkDelivered(user.userId, id);
  }

  // ---------------- Admin (§74) ----------------

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Get('admin/orders')
  adminList(@Query('status') status?: OrderStatus) {
    return this.ordersService.adminListOrders(status);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.OPERATIONS_ADMIN)
  @Post('admin/orders/:id/cancel')
  adminCancel(@CurrentUser() user:{userId:string}, @Param('id') id:string, @Body('reason') reason?:string){ return this.ordersService.adminCancel(id,user.userId,reason); }
}
