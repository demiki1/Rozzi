import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { RidersService } from './riders.service';
import { RiderFinanceService } from './rider-finance.service';
import { RiderPerformanceService } from './rider-performance.service';
import { RiderOperationsService } from './rider-operations.service';
import { RiderServicesService } from './rider-services.service';
import { RiderAdvancedService } from './rider-advanced.service';

import {
  RegisterRiderDto,
  UpdateRiderProfileDto,
  UploadRiderDocumentDto,
  UpdateRiderLocationDto,
  RejectRiderDto,
  RiderIssueDto,
} from './dto/rider.dto';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminRoles } from '../../common/decorators/admin-roles.decorator';
import { AdminRolesGuard } from '../../common/guards/admin-roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

import {
  UserRole,
  AdminRole,
  RiderStatus,
  RiderCashTransactionType,
} from '@prisma/client';

@Controller('api')
export class RidersController {
  constructor(
    private readonly ridersService: RidersService,
    private readonly riderFinance: RiderFinanceService,
    private readonly riderPerformance: RiderPerformanceService,
    private readonly riderOperations: RiderOperationsService,
    private readonly riderServices: RiderServicesService,
    private readonly riderAdvanced: RiderAdvancedService,
  ) {}

  // ---------------- Rider's own dashboard ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/register')
  register(
    @CurrentUser() user: { userId: string },
    @Body() dto: RegisterRiderDto,
  ) {
    return this.ridersService.register(
      user.userId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/me')
  getMine(
    @CurrentUser() user: { userId: string },
  ) {
    return this.ridersService.getByOwner(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Patch('rider/me')
  updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateRiderProfileDto,
  ) {
    return this.ridersService.updateProfile(
      user.userId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/me/service-areas')
  addServiceArea(
    @CurrentUser() user: { userId: string },
    @Body() body: { serviceAreaId: string },
  ) {
    return this.ridersService.addServiceArea(
      user.userId,
      body.serviceAreaId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/me/documents')
  uploadDocument(
    @CurrentUser() user: { userId: string },
    @Body() dto: UploadRiderDocumentDto,
  ) {
    return this.ridersService.uploadDocument(
      user.userId,
      dto.docType,
      dto.fileUrl,
      dto.expiryDate,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/me/location')
  updateLocation(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateRiderLocationDto,
  ) {
    return this.ridersService.updateLocation(
      user.userId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/me/go-online')
  goOnline(
    @CurrentUser() user: { userId: string },
  ) {
    return this.ridersService.goOnline(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/me/go-offline')
  goOffline(
    @CurrentUser() user: { userId: string },
  ) {
    return this.ridersService.goOffline(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/issues')
  createIssue(
    @CurrentUser() user: { userId: string },
    @Body() dto: RiderIssueDto,
  ) {
    return this.ridersService.createIssue(
      user.userId,
      dto,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/issues')
  listIssues(
    @CurrentUser() user: { userId: string },
  ) {
    return this.ridersService.listIssues(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/deliveries/:id/reassignment')
  requestReassignment(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.ridersService.requestReassignment(
      user.userId,
      id,
      body?.reason || '',
    );
  }

  // ---------------- Rider Advanced ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/advanced/dashboard')
  advancedDashboard(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderAdvanced.personalized(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/advanced/recommendations')
  advancedRecommendations(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderAdvanced.recommendations(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/advanced/predictions')
  advancedPredictions(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderAdvanced.predictions(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/advanced/demand')
  advancedDemand(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderAdvanced.demand(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/advanced/financing')
  advancedFinancing(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderAdvanced.financing(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/advanced/financing/apply')
  applyFinancing(
    @CurrentUser() user: { userId: string },
    @Body() body: any,
  ) {
    return this.riderAdvanced.applyFinance(
      user.userId,
      body,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/advanced/analytics')
  advancedAnalytics(
    @CurrentUser() user: { userId: string },
    @Query('days') days?: string,
  ) {
    return this.riderAdvanced.analytics(
      user.userId,
      days ? Number(days) : 30,
    );
  }

  // ---------------- Rider money ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/finance/overview')
  financeOverview(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderFinance.overview(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/finance/earnings')
  financeEarnings(
    @CurrentUser() user: { userId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.riderFinance.earnings(
      user.userId,
      from,
      to,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/finance/transactions')
  financeTransactions(
    @CurrentUser() user: { userId: string },
    @Query('limit') limit?: string,
  ) {
    return this.riderFinance.transactions(
      user.userId,
      limit ? Number(limit) : 100,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/finance/payouts')
  financePayouts(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderFinance.payouts(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/finance/payouts')
  requestPayout(
    @CurrentUser() user: { userId: string },
    @Body() body: { amount: number },
  ) {
    return this.riderFinance.requestPayout(
      user.userId,
      Number(body?.amount),
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/finance/cash')
  cashHistory(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderFinance.cashHistory(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/finance/cash')
  cashTransaction(
    @CurrentUser() user: { userId: string },
    @Body()
    body: {
      type: RiderCashTransactionType;
      amount: number;
      orderId?: string;
      description?: string;
      evidenceUrl?: string;
    },
  ) {
    return this.riderFinance.cash(
      user.userId,
      body.type,
      Number(body.amount),
      body.orderId,
      body.description,
      body.evidenceUrl,
    );
  }

  // ---------------- Rider performance ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/performance/overview')
  performanceOverview(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderPerformance.overview(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/performance')
  performance(
    @CurrentUser() user: { userId: string },
    @Query('days') days?: string,
  ) {
    return this.riderPerformance.performance(
      user.userId,
      days ? Number(days) : 30,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/performance/achievements')
  achievements(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderPerformance.achievementsList(
      user.userId,
    );
  }

  /*
   * Challenges are retained strictly as
   * non-monetary progress features.
   *
   * There is intentionally NO challenge claim
   * endpoint.
   */
  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/performance/challenges')
  challenges(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderPerformance.challenges(
      user.userId,
    );
  }

  // ---------------- Rider operations ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/operations/overview')
  operationsOverview(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderOperations.overview(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/operations/heatmap')
  operationsHeatmap(
    @CurrentUser() user: { userId: string },
    @Query('hours') hours?: string,
  ) {
    return this.riderOperations.heatmap(
      user.userId,
      hours ? Number(hours) : 6,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/operations/zones')
  operationsZones(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderOperations.zones(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/operations/schedule')
  operationsSchedule(
    @CurrentUser() user: { userId: string },
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.riderOperations.schedule(
      user.userId,
      from,
      to,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/operations/schedule')
  bookShift(
    @CurrentUser() user: { userId: string },
    @Body()
    body: {
      startsAt: string;
      endsAt: string;
      serviceAreaId?: string;
    },
  ) {
    return this.riderOperations.bookShift(
      user.userId,
      body,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/operations/schedule/:id/cancel')
  cancelShift(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.riderOperations.cancelShift(
      user.userId,
      id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/operations/schedule/:id/check-in')
  checkInShift(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.riderOperations.checkIn(
      user.userId,
      id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/operations/batches')
  operationsBatches(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderOperations.batches(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/operations/batches/:id/accept')
  acceptBatch(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.riderOperations.acceptBatch(
      user.userId,
      id,
    );
  }

  // ---------------- Rider services ----------------

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/services/overview')
  servicesOverview(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderServices.serviceOverview(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/services/insurance')
  insurance(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderServices.insurances(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/insurance')
  addInsurance(
    @CurrentUser() user: { userId: string },
    @Body() body: any,
  ) {
    return this.riderServices.addInsurance(
      user.userId,
      body,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/services/vehicle/maintenance')
  maintenance(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderServices.maintenance(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/vehicle/maintenance')
  addMaintenance(
    @CurrentUser() user: { userId: string },
    @Body() body: any,
  ) {
    return this.riderServices.addMaintenance(
      user.userId,
      body,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/services/equipment')
  equipment(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderServices.equipment(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/equipment')
  requestEquipment(
    @CurrentUser() user: { userId: string },
    @Body() body: any,
  ) {
    return this.riderServices.requestEquipment(
      user.userId,
      body,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/equipment/:id/replacement')
  requestEquipmentReplacement(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.riderServices.requestReplacement(
      user.userId,
      id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/services/academy')
  academy(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderServices.academy(
      user.userId,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/academy/:id/start')
  academyStart(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.riderServices.academyStart(
      user.userId,
      id,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/academy/:id/complete')
  academyComplete(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() body: { scorePercent?: number },
  ) {
    return this.riderServices.academyComplete(
      user.userId,
      id,
      body?.scorePercent,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Post('rider/services/sos')
  sos(
    @CurrentUser() user: { userId: string },
    @Body() body: any,
  ) {
    return this.riderServices.sos(
      user.userId,
      body,
    );
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.RIDER)
  @Get('rider/services/sos')
  sosHistory(
    @CurrentUser() user: { userId: string },
  ) {
    return this.riderServices.sosHistory(
      user.userId,
    );
  }

  // ---------------- Admin: verification workflow ----------------

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Get('admin/riders')
  listAdmin(
    @Query('status') status?: RiderStatus,
  ) {
    return this.ridersService.listAdmin(status);
  }

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Get('admin/riders/pending')
  listPending() {
    return this.ridersService.listPending();
  }

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Post('admin/riders/:id/start-review')
  startReview(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.ridersService.startReview(
      id,
      user.userId,
    );
  }

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Post('admin/riders/:id/approve')
  approve(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.ridersService.approve(
      id,
      user.userId,
    );
  }

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Post('admin/riders/:id/reject')
  reject(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: RejectRiderDto,
  ) {
    return this.ridersService.reject(
      id,
      user.userId,
      dto.reason,
    );
  }

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Post('admin/riders/:id/suspend')
  suspend(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.ridersService.suspend(
      id,
      user.userId,
    );
  }

  @UseGuards(
    RolesGuard,
    AdminRolesGuard,
  )
  @Roles(UserRole.ADMIN)
  @AdminRoles(AdminRole.RIDER_ADMIN)
  @Get('admin/service-areas/:id/riders')
  listByZone(
    @Param('id') id: string,
  ) {
    return this.ridersService.listByZone(id);
  }
}