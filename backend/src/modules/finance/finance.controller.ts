import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { AnalyticsService, DateRange } from './analytics.service';
import { DateRangeQueryDto } from './dto/date-range.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole, AdminRole } from '@prisma/client';

// §38: everything here is scoped to FINANCE_ADMIN (SUPER_ADMIN always
// passes) — this is the most sensitive admin surface in the app (money and
// the audit trail), so it gets the narrowest default access of any module.
@UseGuards(RolesGuard, AdminRolesGuard)
@Roles(UserRole.ADMIN)
@AdminRoles(AdminRole.FINANCE_ADMIN)
@Controller('api/admin')
export class FinanceController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  // ---------------- Reports (§36, §60, §61) ----------------

  @Get('reports/summary')
  getSummary(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getSummary(this.resolveRange(query));
  }

  @Get('reports/top-vendors')
  getTopVendors(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getTopVendors(this.resolveRange(query));
  }

  @Get('reports/top-products')
  getTopProducts(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getTopProducts(this.resolveRange(query));
  }

  @Get('reports/top-locations')
  getTopLocations(@Query() query: DateRangeQueryDto) {
    return this.analyticsService.getTopLocations(this.resolveRange(query));
  }

  // ---------------- Vendor settlements (§77) ----------------

  @Get('settlements/vendors')
  listPendingVendorBalances() {
    return this.ledgerService.listPendingVendorBalances();
  }

  @Get('settlements/vendors/:id/balance')
  getVendorBalance(@Param('id') id: string) {
    return this.ledgerService.getVendorBalance(id).then((balance) => ({ balance }));
  }

  @Post('settlements/vendors/:id/settle')
  settleVendor(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.ledgerService.settleVendor(id, user.userId);
  }

  // ---------------- Rider payouts (§78) ----------------

  @Get('settlements/riders')
  listPendingRiderBalances() {
    return this.ledgerService.listPendingRiderBalances();
  }

  @Get('settlements/riders/:id/balance')
  getRiderBalance(@Param('id') id: string) {
    return this.ledgerService.getRiderBalance(id).then((balance) => ({ balance }));
  }

  @Post('settlements/riders/:id/pay')
  payRider(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.ledgerService.payRider(id, user.userId);
  }

  // ---------------- helpers ----------------

  private resolveRange(query: DateRangeQueryDto): DateRange {
    const to = query.to ? new Date(query.to) : new Date();
    const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { from, to };
  }
}
