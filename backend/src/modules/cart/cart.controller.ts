import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER)
@Controller('api/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() user: { userId: string }) {
    return this.cartService.getOrCreateCart(user.userId);
  }

  @Post('items')
  addItem(@CurrentUser() user: { userId: string }, @Body() dto: AddCartItemDto) {
    return this.cartService.addItem(user.userId, dto);
  }

  @Patch('items/:id')
  updateItem(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItemQuantity(user.userId, id, dto.quantity);
  }

  @Delete('items/:id')
  removeItem(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.cartService.removeItem(user.userId, id);
  }

  @Post('clear')
  clear(@CurrentUser() user: { userId: string }) {
    return this.cartService.clear(user.userId);
  }
}
