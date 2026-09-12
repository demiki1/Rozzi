import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminRole, UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { AccountService } from './account.service';
import { CreateAddressDto, UpdateAddressDto, UpdateProfileDto, UpdateSettingsDto } from './dto/account.dto';

@Controller('api/account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('profile')
  profile(@CurrentUser() user: { userId: string }){ return this.account.profile(user.userId); }
  @Patch('profile')
  updateProfile(@CurrentUser() user: { userId: string },@Body() dto:UpdateProfileDto){ return this.account.updateProfile(user.userId,dto); }
  @Get('settings')
  settings(@CurrentUser() user: { userId: string }){ return this.account.settings(user.userId); }
  @Patch('settings')
  updateSettings(@CurrentUser() user: { userId: string },@Body() dto:UpdateSettingsDto){ return this.account.updateSettings(user.userId,dto); }
  @Get('addresses')
  addresses(@CurrentUser() user: { userId: string }){ return this.account.addresses(user.userId); }
  @Post('addresses')
  createAddress(@CurrentUser() user: { userId: string },@Body() dto:CreateAddressDto){ return this.account.createAddress(user.userId,dto); }
  @Patch('addresses/:id')
  updateAddress(@CurrentUser() user: { userId: string },@Param('id') id:string,@Body() dto:UpdateAddressDto){ return this.account.updateAddress(user.userId,id,dto); }
  @Post('addresses/:id/default')
  setDefault(@CurrentUser() user: { userId: string },@Param('id') id:string){ return this.account.setDefaultAddress(user.userId,id); }
  @Delete('addresses/:id')
  deleteAddress(@CurrentUser() user: { userId: string },@Param('id') id:string){ return this.account.deleteAddress(user.userId,id); }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.SUPPORT_ADMIN)
  @Get('admin/customers')
  adminCustomers() { return this.account.adminCustomers(); }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.SUPPORT_ADMIN)
  @Patch('admin/customers/:id/status')
  adminSetCustomerActive(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() body: { isActive?: boolean }) {
    return this.account.adminSetCustomerActive(id, body.isActive === true, user.userId);
  }
}
