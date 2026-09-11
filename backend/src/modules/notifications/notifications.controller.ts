import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationPreferenceChannel, NotificationType } from '@prisma/client';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: { userId: string }, @Query('unread') unread?: string) {
    return this.notificationsService.listForUser(user.userId, unread === 'true');
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: { userId: string }) { return this.notificationsService.unreadCount(user.userId); }

  @Patch(':id/read')
  markRead(@CurrentUser() user: { userId: string }, @Param('id') id: string) { return this.notificationsService.markRead(user.userId, id); }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: { userId: string }) { return this.notificationsService.markAllRead(user.userId); }

  @Get('preferences')
  preferences(@CurrentUser() user: { userId: string }) { return this.notificationsService.preferences(user.userId); }

  @Patch('preferences')
  setPreference(@CurrentUser() user: { userId: string }, @Body() body: { type: NotificationType; channel: NotificationPreferenceChannel; enabled: boolean }) {
    return this.notificationsService.setPreference(user.userId, body.type, body.channel, Boolean(body.enabled));
  }
}
