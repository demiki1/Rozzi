import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
}
