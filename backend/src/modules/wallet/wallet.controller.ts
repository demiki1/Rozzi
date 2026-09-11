import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { WalletService } from './wallet.service';
import { ApplyPromotionDto, TopUpDto, WithdrawDto } from './dto/wallet.dto';

@Controller('api/wallet')
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}
  @Get() get(@CurrentUser() user: { userId: string }){ return this.wallet.getWallet(user.userId); }
  @Get('transactions') transactions(@CurrentUser() user: { userId: string },@Query('page') page='1',@Query('pageSize') pageSize='30'){return this.wallet.transactions(user.userId,Number(page),Number(pageSize));}
  @Post('top-up') topUp(@CurrentUser() user: { userId: string },@Body() dto:TopUpDto,@Query('provider') provider:'PAYSTACK'|'FLUTTERWAVE'='PAYSTACK'){return this.wallet.initializeTopUp(user.userId,dto,provider);}
  @Post('top-up/verify') verify(@CurrentUser() user: { userId: string },@Body() body:{reference:string}){return this.wallet.verifyTopUp(user.userId,body.reference);}
  @Post('withdraw') withdraw(@CurrentUser() user: { userId: string },@Body() dto:WithdrawDto){return this.wallet.withdraw(user.userId,dto);}
  @Get('promotions') promotions(@CurrentUser() user: { userId: string }){return this.wallet.listPromotions(user.userId);}
  @Post('promotions/apply') applyPromotion(@CurrentUser() user: { userId: string },@Body() dto:ApplyPromotionDto){return this.wallet.applyPromotion(user.userId,dto);}
}
