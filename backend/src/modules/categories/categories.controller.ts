import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole } from '@prisma/client';

@Controller('api')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Public()
  @Get('categories')
  listActive() {
    return this.categoriesService.listActive();
  }

  // §38: scoped to CONTENT_ADMIN (SUPER_ADMIN always passes). Mutations
  // are audit-logged (§39) via CategoriesService.

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Get('admin/categories')
  listAll() {
    return this.categoriesService.listAll();
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Post('admin/categories')
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Patch('admin/categories/:id')
  update(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto, user.userId);
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.CONTENT_ADMIN)
  @Post('admin/categories/:id/deactivate')
  deactivate(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.categoriesService.deactivate(id, user.userId);
  }
}
