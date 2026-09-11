import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { VendorFinanceService } from './vendor-finance.service';
import { UpsertVendorPaymentAccountDto, VendorFinanceTransactionDto } from './dto/vendor-finance.dto';
import { DateRangeQueryDto } from './dto/date-range.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';

@UseGuards(RolesGuard)
@Roles(UserRole.VENDOR)
@Controller('api/vendor/finance')
export class VendorFinanceController {
  constructor(private readonly service: VendorFinanceService) {}

  @Get('overview')
  overview(@CurrentUser() user: { userId: string }, @Query() query: DateRangeQueryDto) {
    return this.service.overview(user.userId, query.from, query.to);
  }

  @Get('earnings')
  earnings(@CurrentUser() user: { userId: string }, @Query() query: DateRangeQueryDto) {
    return this.service.earnings(user.userId, query.from, query.to);
  }

  @Get('transactions')
  transactions(@CurrentUser() user: { userId: string }, @Query() query: VendorFinanceTransactionDto) {
    return this.service.transactions(user.userId, query.from, query.to, query.type);
  }

  @Get('payouts')
  payouts(@CurrentUser() user: { userId: string }) {
    return this.service.payouts(user.userId);
  }

  @Get('payment-account')
  paymentAccount(@CurrentUser() user: { userId: string }) {
    return this.service.getPaymentAccount(user.userId);
  }

  @Post('payment-account')
  savePaymentAccount(@CurrentUser() user: { userId: string }, @Body() dto: UpsertVendorPaymentAccountDto) {
    return this.service.upsertPaymentAccount(user.userId, dto);
  }
}
