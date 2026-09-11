import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, AdjustStockDto, ProductQueryDto, CreateVariantDto, UpdateVariantDto, ReorderVariantsDto } from './dto/product.dto';
import { AddProductImagesDto } from './dto/product-image.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ---------------- Public search ----------------

  @Public()
  @Get('products')
  search(@Query() query: ProductQueryDto) {
    return this.productsService.search(query);
  }

  @Public()
  @Get('products/:id')
  getPublicProduct(@Param('id') id: string) {
    return this.productsService.getPublicProduct(id);
  }

  // ---------------- Vendor management ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/products')
  listMine(@CurrentUser() user: { userId: string }) {
    return this.productsService.listMine(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/products')
  create(@CurrentUser() user: { userId: string }, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.userId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/products/:id/images')
  addImages(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: AddProductImagesDto,
  ) {
    return this.productsService.addImages(user.userId, id, dto.images);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/products/:id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(user.userId, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/variants')
  listVariants(@CurrentUser() user: { userId: string }) {
    return this.productsService.listVariants(user.userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/products/:id/variants')
  createVariant(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: CreateVariantDto) {
    return this.productsService.createVariant(user.userId, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/variants/:variantId')
  updateVariant(@CurrentUser() user: { userId: string }, @Param('variantId') variantId: string, @Body() dto: UpdateVariantDto) {
    return this.productsService.updateVariant(user.userId, variantId, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/products/:id/variants/reorder')
  reorderVariants(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: ReorderVariantsDto) {
    return this.productsService.reorderVariants(user.userId, id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/variants/:variantId/delete')
  deleteVariant(@CurrentUser() user: { userId: string }, @Param('variantId') variantId: string) {
    return this.productsService.deleteVariant(user.userId, variantId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/products/:id/duplicate')
  duplicate(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.productsService.duplicate(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Post('vendor/products/:id/disable')
  remove(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.productsService.remove(user.userId, id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/products/:id/stock')
  adjustStock(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.productsService.adjustStock(user.userId, id, dto.quantityDelta, dto.variantId);
  }
}
