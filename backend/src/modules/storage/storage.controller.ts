import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { StorageService } from './storage.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PresignDto } from './dto/presign.dto';

@Controller('api/storage')
@UseGuards(RolesGuard)
@Roles(UserRole.CUSTOMER, UserRole.VENDOR, UserRole.RIDER, UserRole.ADMIN)
export class StorageController {
  constructor(private readonly s: StorageService) {}

  @Post('presign')
  presign(@CurrentUser() u: { userId: string; role: any }, @Body() d: PresignDto) {
    return this.s.createUploadUrl(u.userId, d.contentType, d.sizeBytes);
  }

  @Post('complete')
  complete(@CurrentUser() u: { userId: string }, @Body('key') key: string) {
    return this.s.completeUpload(u.userId, key);
  }

  @Get('download/:key(*)')
  download(@CurrentUser() u: { userId: string; role: any }, @Param('key') key: string) {
    return this.s.createDownloadUrl(key, u);
  }
}
