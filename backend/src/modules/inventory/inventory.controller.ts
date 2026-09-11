import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { AdjustInventoryDto, BulkAdjustInventoryDto, SetInventoryDto, UpdateThresholdDto } from './dto/inventory.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('api/vendor/inventory')
@UseGuards(RolesGuard)
@Roles(UserRole.VENDOR)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }, @Query('search') search?: string, @Query('status') status?: string) { return this.inventory.listMine(user.userId, search, status); }

  @Get('summary')
  summary(@CurrentUser() user: { userId: string }) { return this.inventory.summary(user.userId); }

  @Get(':id/history')
  history(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.inventory.history(user.userId, id); }

  @Patch(':id/adjust')
  adjust(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: AdjustInventoryDto) { return this.inventory.adjust(user.userId, id, dto); }

  @Patch(':id/set')
  set(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: SetInventoryDto) { return this.inventory.setQuantity(user.userId, id, dto); }

  @Patch(':id/threshold')
  threshold(@CurrentUser() user: { userId: string }, @Param('id') id: string, @Body() dto: UpdateThresholdDto) { return this.inventory.threshold(user.userId, id, dto.lowStockThreshold); }

  @Post('bulk-adjust')
  bulk(@CurrentUser() user: { userId: string }, @Body() dto: BulkAdjustInventoryDto) { return this.inventory.bulkAdjust(user.userId, dto.items); }
}
