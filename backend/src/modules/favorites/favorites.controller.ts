import { Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { FavoritesService } from './favorites.service';
@Controller('api/favorites')
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER)
export class FavoritesController {
  constructor(private readonly favorites:FavoritesService){}
  @Get() list(@CurrentUser() user: { userId: string }){return this.favorites.list(user.userId)}
  @Get('status') status(@CurrentUser() user: { userId: string },@Query('productId') productId?:string,@Query('vendorId') vendorId?:string){return this.favorites.status(user.userId,productId,vendorId)}
  @Post('vendors/:id') addVendor(@CurrentUser() user: { userId: string },@Param('id') id:string){return this.favorites.addVendor(user.userId,id)}
  @Delete('vendors/:id') removeVendor(@CurrentUser() user: { userId: string },@Param('id') id:string){return this.favorites.removeVendor(user.userId,id)}
  @Post('products/:id') addProduct(@CurrentUser() user: { userId: string },@Param('id') id:string){return this.favorites.addProduct(user.userId,id)}
  @Delete('products/:id') removeProduct(@CurrentUser() user: { userId: string },@Param('id') id:string){return this.favorites.removeProduct(user.userId,id)}
}
