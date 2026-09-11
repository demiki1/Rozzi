import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateOptionGroupDto, CreateOptionItemDto, ReorderOptionGroupsDto, ReorderOptionItemsDto, UpdateOptionGroupDto, UpdateOptionItemDto } from './dto/product-option.dto';
import { ProductOptionsService } from './product-options.service';

@Controller('api/vendor/options')
@UseGuards(RolesGuard)
@Roles(UserRole.VENDOR)
export class ProductOptionsController {
  constructor(private readonly service: ProductOptionsService) {}
  @Get() list(@CurrentUser() user: { userId: string }) { return this.service.listMine(user.userId); }
  @Post('products/:productId/groups') createGroup(@CurrentUser() user: { userId: string }, @Param('productId') productId: string, @Body() dto: CreateOptionGroupDto) { return this.service.createGroup(user.userId, productId, dto); }
  @Patch('groups/:groupId') updateGroup(@CurrentUser() user: { userId: string }, @Param('groupId') id: string, @Body() dto: UpdateOptionGroupDto) { return this.service.updateGroup(user.userId, id, dto); }
  @Post('groups/:groupId/activate') activateGroup(@CurrentUser() user: { userId: string }, @Param('groupId') id: string) { return this.service.setGroupActive(user.userId, id, true); }
  @Post('groups/:groupId/deactivate') deactivateGroup(@CurrentUser() user: { userId: string }, @Param('groupId') id: string) { return this.service.setGroupActive(user.userId, id, false); }
  @Post('products/:productId/groups/reorder') reorderGroups(@CurrentUser() user: { userId: string }, @Param('productId') productId: string, @Body() dto: ReorderOptionGroupsDto) { return this.service.reorderGroups(user.userId, productId, dto); }
  @Post('groups/:groupId/items') createItem(@CurrentUser() user: { userId: string }, @Param('groupId') id: string, @Body() dto: CreateOptionItemDto) { return this.service.createItem(user.userId, id, dto); }
  @Patch('items/:itemId') updateItem(@CurrentUser() user: { userId: string }, @Param('itemId') id: string, @Body() dto: UpdateOptionItemDto) { return this.service.updateItem(user.userId, id, dto); }
  @Post('items/:itemId/activate') activateItem(@CurrentUser() user: { userId: string }, @Param('itemId') id: string) { return this.service.setItemActive(user.userId, id, true); }
  @Post('items/:itemId/deactivate') deactivateItem(@CurrentUser() user: { userId: string }, @Param('itemId') id: string) { return this.service.setItemActive(user.userId, id, false); }
  @Post('items/:itemId/delete') deleteItem(@CurrentUser() user: { userId: string }, @Param('itemId') id: string) { return this.service.deleteItem(user.userId, id); }
  @Post('groups/:groupId/items/reorder') reorderItems(@CurrentUser() user: { userId: string }, @Param('groupId') id: string, @Body() dto: ReorderOptionItemsDto) { return this.service.reorderItems(user.userId, id, dto); }
}
