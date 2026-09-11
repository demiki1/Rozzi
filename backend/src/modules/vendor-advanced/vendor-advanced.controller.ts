import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { VendorAdvancedService } from './vendor-advanced.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { BulkAvailabilityDto, BulkCategoryDto, BulkProductUpdateDto, BulkStockUpdateDto, CreateMenuScheduleDto, ImportProductsDto, UpdateCapacityDto, UpdateMenuScheduleDto, UpdateProductScheduleDto } from './dto/advanced.dto';

@Controller('api/vendor/advanced')
@UseGuards(RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorAdvancedController {
 constructor(private readonly service:VendorAdvancedService){}
 @Get('settings') settings(@CurrentUser() u:{userId:string}){return this.service.settings(u.userId)}
 @Patch('capacity') capacity(@CurrentUser() u:{userId:string},@Body() d:UpdateCapacityDto){return this.service.setCapacity(u.userId,d.maxOrdersPerHour)}
 @Patch('products/:id/schedule') productSchedule(@CurrentUser() u:{userId:string},@Param('id') id:string,@Body() d:UpdateProductScheduleDto){return this.service.productSchedule(u.userId,id,d)}
 @Get('menus') menus(@CurrentUser() u:{userId:string}){return this.service.listSchedules(u.userId)}
 @Post('menus') createMenu(@CurrentUser() u:{userId:string},@Body() d:CreateMenuScheduleDto){return this.service.createSchedule(u.userId,d)}
 @Patch('menus/:id') updateMenu(@CurrentUser() u:{userId:string},@Param('id') id:string,@Body() d:UpdateMenuScheduleDto){return this.service.updateSchedule(u.userId,id,d)}
 @Delete('menus/:id') deleteMenu(@CurrentUser() u:{userId:string},@Param('id') id:string){return this.service.deleteSchedule(u.userId,id)}
 @Post('bulk/update') bulkUpdate(@CurrentUser() u:{userId:string},@Body() d:BulkProductUpdateDto){return this.service.bulkUpdate(u.userId,d)}
 @Post('bulk/availability') bulkAvailability(@CurrentUser() u:{userId:string},@Body() d:BulkAvailabilityDto){return this.service.bulkAvailability(u.userId,d)}
 @Post('bulk/category') bulkCategory(@CurrentUser() u:{userId:string},@Body() d:BulkCategoryDto){return this.service.bulkCategory(u.userId,d)}
 @Post('bulk/stock') bulkStock(@CurrentUser() u:{userId:string},@Body() d:BulkStockUpdateDto){return this.service.bulkStock(u.userId,d)}
 @Get('export') export(@CurrentUser() u:{userId:string}){return this.service.exportCsv(u.userId)}
 @Post('import') import(@CurrentUser() u:{userId:string},@Body() d:ImportProductsDto){return this.service.importCsv(u.userId,d.csv)}
}
