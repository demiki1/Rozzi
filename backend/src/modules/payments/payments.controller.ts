import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { InitializePaymentDto } from './dto/payment.dto';
import { RefundOrderDto } from './dto/refund.dto';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole } from '@prisma/client';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';

@Controller('api/payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Get('mine')
  listMyPayments(
    @CurrentUser() user: { userId: string },
  ) {
    return this.paymentsService.listMyPayments(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('initialize')
  initialize(
    @CurrentUser() user: { userId: string },
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentsService.initialize(
      user.userId,
      dto.orderId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.CUSTOMER)
  @Post('wallet')
  payWithWallet(
    @CurrentUser() user: { userId: string },
    @Body() dto: InitializePaymentDto,
  ) {
    return this.paymentsService.payWithWallet(
      user.userId,
      dto.orderId,
    );
  }

  // Client calls this after the provider redirects back — a convenience
  // path, not a trusted one. It re-verifies with the provider exactly like
  // the webhook does; it does not accept the redirect's own status claim.
  @Get('verify/:reference')
  verify(
    @Param('reference') reference: string,
    @Query('transaction_id') transactionId?: string,
  ) {
    return this.paymentsService.verifyByReference(
      reference,
      transactionId,
    );
  }

  @UseGuards(RolesGuard, AdminRolesGuard)
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.FINANCE_ADMIN)
  @Post('/admin/refunds/:orderId')
  refundOrder(
    @CurrentUser() user: { userId: string },
    @Param('orderId') orderId: string,
    @Body() body: RefundOrderDto,
  ) {
    return this.paymentsService.refundOrder(
      orderId,
      user.userId,
      body?.reason,
      body?.amountKobo,
    );
  }

  @Public()
  @Post('webhook/flutterwave')
  async flutterwaveWebhook(
    @Req() req: Request,
    @Headers('flutterwave-signature')
    signature?: string,
  ) {
    if (!req.rawBody) {
      throw new BadRequestException(
        'Raw request body unavailable for signature verification.',
      );
    }

    return this.paymentsService.handleFlutterwaveWebhook(
      req.rawBody,
      signature,
    );
  }

  // Provider webhook. Public because the provider (not an authenticated
  // platform user) calls this — trust comes entirely from the signature
  // check inside PaymentsService, not from auth middleware.
  @Public()
  @Post('webhook')
  async webhook(
    @Req() req: Request,
    @Headers('x-paystack-signature')
    signature?: string,
  ) {
    if (!req.rawBody) {
      // Should not happen with rawBody:true in main.ts, but fail loudly
      // rather than silently trusting a re-serialized body.
      throw new BadRequestException(
        'Raw request body unavailable for signature verification.',
      );
    }

    return this.paymentsService.handleWebhook(
      req.rawBody,
      signature,
    );
  }
}