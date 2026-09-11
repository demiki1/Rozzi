import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole, VendorStaffRole } from '@prisma/client';
import { TeamService } from './team.service';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

class InviteDto { @IsString() fullName!: string; @IsOptional() @IsEmail() email?: string; @IsOptional() @IsString() phone?: string; @IsEnum(VendorStaffRole) role!: VendorStaffRole; }
class UpdateDto { @IsOptional() @IsEnum(VendorStaffRole) role?: VendorStaffRole; @IsOptional() @IsBoolean() isActive?: boolean; }
class AcceptDto { @IsString() @MinLength(8) password!: string; }

@Controller('api')
export class TeamController {
  constructor(private readonly service: TeamService) {}
  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR) @Get('vendor/team') list(@CurrentUser() u:{userId:string}) { return this.service.list(u.userId); }
  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR) @Post('vendor/team/invite') invite(@CurrentUser() u:{userId:string}, @Body() dto:InviteDto) { return this.service.invite(u.userId, dto); }
  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR) @Patch('vendor/team/:memberId') update(@CurrentUser() u:{userId:string}, @Param('memberId') id:string, @Body() dto:UpdateDto) { return this.service.update(u.userId, id, dto); }
  @UseGuards(RolesGuard) @Roles(UserRole.VENDOR) @Delete('vendor/team/:memberId') remove(@CurrentUser() u:{userId:string}, @Param('memberId') id:string) { return this.service.remove(u.userId, id); }
  @Post('vendor/team/invitations/accept') accept(@Query('token') token:string, @Body() dto:AcceptDto) { return this.service.accept(token, dto); }
}
