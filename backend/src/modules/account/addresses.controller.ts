import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { AccountService } from './account.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/account.dto';

@Controller('api/addresses')
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER)
export class AddressesController {
  constructor(private readonly account:AccountService){}
  @Get() list(@CurrentUser() user: { userId: string }){return this.account.addresses(user.userId)}
  @Post() create(@CurrentUser() user: { userId: string },@Body() dto:CreateAddressDto){return this.account.createAddress(user.userId,dto)}
  @Patch(':id') update(@CurrentUser() user: { userId: string },@Param('id') id:string,@Body() dto:UpdateAddressDto){return this.account.updateAddress(user.userId,id,dto)}
  @Post(':id/default') default(@CurrentUser() user: { userId: string },@Param('id') id:string){return this.account.setDefaultAddress(user.userId,id)}
  @Delete(':id') remove(@CurrentUser() user: { userId: string },@Param('id') id:string){return this.account.deleteAddress(user.userId,id)}
}
