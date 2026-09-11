import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CreateVendorCategoryDto, ReorderVendorCategoriesDto, UpdateVendorCategoryDto } from './dto/vendor-category.dto';
import { VendorCategoriesService } from './vendor-categories.service';

@Controller('api/vendor/categories')
@UseGuards(RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorCategoriesController {
  constructor(private readonly service: VendorCategoriesService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) { return this.service.listMine(user.userId); }

  @Post()
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateVendorCategoryDto) { return this.service.create(user.userId, dto); }

  @Patch(':id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateVendorCategoryDto) { return this.service.update(user.userId, id, dto); }

  @Post('reorder')
  reorder(@CurrentUser() user: { userId: string }, @Body() dto: ReorderVendorCategoriesDto) { return this.service.reorder(user.userId, dto); }

  @Post(':id/activate')
  activate(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.service.setActive(user.userId, id, true); }

  @Post(':id/deactivate')
  deactivate(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.service.setActive(user.userId, id, false); }
}
