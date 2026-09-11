import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { VendorReviewQueryDto, VendorReviewResponseDto } from './dto/vendor-review.dto';

@Controller('api')
export class ReviewsController {
  constructor(private readonly service: ReviewsService) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('reviews')
  createAlias(@CurrentUser() u:{userId:string}, @Body() dto:CreateReviewDto){ return this.service.create(u.userId, dto.orderId!, dto); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('reviews/mine')
  mine(@CurrentUser() u:{userId:string}){ return this.service.mine(u.userId); }

  @Public()
  @Get('reviews/products/:id')
  productSummary(@Param('id') id:string){ return this.service.customerProductSummary(id); }

  @Public()
  @Get('reviews/vendors/:id')
  vendorSummaryAlias(@Param('id') id:string){ return this.service.customerVendorSummary(id); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('orders/:orderId/review') create(@CurrentUser() u:{userId:string}, @Param('orderId') orderId:string, @Body() dto:CreateReviewDto){ return this.service.create(u.userId, orderId, dto); }
  @Public()
  @Get('vendors/:vendorId/reviews') vendor(@Param('vendorId') id:string){ return this.service.listForVendor(id); }
  @Public()
  @Get('vendors/:vendorId/reviews/summary') vendorSummary(@Param('vendorId') id:string){ return this.service.summaryForVendor(id); }
  @Public()
  @Get('products/:productId/reviews') product(@Param('productId') id:string){ return this.service.listForProduct(id); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/reviews/overview') vendorOverview(@CurrentUser() u:{userId:string}, @Query() q:VendorReviewQueryDto){ return this.service.vendorOverview(u.userId, q); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Get('vendor/reviews') vendorReviews(@CurrentUser() u:{userId:string}, @Query() q:VendorReviewQueryDto){ return this.service.listVendorReviews(u.userId, q); }

  @UseGuards(RolesGuard)
  @Roles(UserRole.VENDOR)
  @Patch('vendor/reviews/:reviewId/response') respond(@CurrentUser() u:{userId:string}, @Param('reviewId') id:string, @Body() dto:VendorReviewResponseDto){ return this.service.respondToReview(u.userId, id, dto); }
}
