import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { vendorForUser } from '../../common/utils/vendor-context';
import { AuditLogService } from '../audit/audit-log.service';
import { UserRole, VendorStaffRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { EMAIL_PROVIDER, EmailProvider } from '../notifications/interfaces/notification-provider.interface';
import { Inject } from '@nestjs/common';

@Injectable()
export class TeamService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService, private readonly config: ConfigService, @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider) {}

  private async vendorFor(userId: string) {
    return vendorForUser(this.prisma, userId);
  }

  async list(ownerUserId: string) {
    const vendor = await this.vendorFor(ownerUserId);
    const members = await this.prisma.vendorStaffMember.findMany({ where: { vendorId: vendor.id }, include: { user: { select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true } } }, orderBy: { createdAt: 'asc' } });
    return { vendor: { id: vendor.id, storeName: vendor.storeName }, owner: await this.prisma.user.findUnique({ where: { id: vendor.ownerUserId }, select: { id: true, fullName: true, email: true, phone: true } }), members, roles: Object.values(VendorStaffRole) };
  }

  async invite(ownerUserId: string, dto: { fullName: string; email?: string; phone?: string; role: VendorStaffRole }) {
    const vendor = await this.prisma.vendor.findUnique({ where: { ownerUserId } });
    if (!vendor) throw new ConflictException('Only the store owner can invite team members.');
    if (!dto.email && !dto.phone) throw new BadRequestException('Provide an email or phone number.');
    if (dto.role === VendorStaffRole.OWNER) throw new BadRequestException('Owner access is managed by the store account.');
    const existingUser = await this.prisma.user.findFirst({ where: { OR: [dto.email ? { email: dto.email } : undefined, dto.phone ? { phone: dto.phone } : undefined].filter(Boolean) as any } });
    if (existingUser) {
      if (existingUser.role !== UserRole.VENDOR) throw new ConflictException('This account is not a vendor team account. Ask the person to use a dedicated ROZZI vendor account.');
      const existingMembership = await this.prisma.vendorStaffMember.findUnique({ where: { vendorId_userId: { vendorId: vendor.id, userId: existingUser.id } } });
      if (existingMembership) throw new ConflictException('This user is already on your team.');
      const member = await this.prisma.vendorStaffMember.create({ data: { vendorId: vendor.id, userId: existingUser.id, role: dto.role } });
      await this.audit.record({ actorId: ownerUserId, action: 'vendor.team.add', entityType: 'VendorStaffMember', entityId: member.id, after: { userId: existingUser.id, role: dto.role } });
      return { mode: 'added_existing_account', member };
    }
    const token = randomBytes(32).toString('hex');
    const invitation = await this.prisma.vendorStaffInvitation.create({ data: { vendorId: vendor.id, fullName: dto.fullName.trim(), email: dto.email, phone: dto.phone, role: dto.role, tokenHash: this.hash(token), expiresAt: new Date(Date.now() + 7 * 86400000) } });
    if (dto.email) {
      const url = `${this.config.get<string>('VENDOR_APP_URL', 'http://localhost:3003')}/team/accept?token=${encodeURIComponent(token)}`;
      await this.email.send(dto.email, `You're invited to ${vendor.storeName} on ROZZI`, `You have been invited to join ${vendor.storeName} on ROZZI as ${dto.role.replace(/_/g, ' ')}. Accept your invitation: ${url}`);
    }
    await this.audit.record({ actorId: ownerUserId, action: 'vendor.team.invite', entityType: 'VendorStaffInvitation', entityId: invitation.id, after: { email: dto.email, phone: dto.phone, role: dto.role } });
    return { mode: 'invited', invitationId: invitation.id, message: 'Invitation created. Email delivery is best-effort when an email provider is configured.' };
  }

  async update(ownerUserId: string, memberId: string, dto: { role?: VendorStaffRole; isActive?: boolean }) {
    const vendor = await this.prisma.vendor.findUnique({ where: { ownerUserId } });
    if (!vendor) throw new ConflictException('Only the store owner can manage team members.');
    const member = await this.prisma.vendorStaffMember.findFirst({ where: { id: memberId, vendorId: vendor.id } });
    if (!member) throw new NotFoundException('Team member not found.');
    if (dto.role === VendorStaffRole.OWNER) throw new BadRequestException('Owner access is managed by the store account.');
    const updated = await this.prisma.vendorStaffMember.update({ where: { id: member.id }, data: { role: dto.role ?? member.role, isActive: dto.isActive ?? member.isActive } });
    await this.audit.record({ actorId: ownerUserId, action: 'vendor.team.update', entityType: 'VendorStaffMember', entityId: member.id, before: { role: member.role, isActive: member.isActive }, after: { role: updated.role, isActive: updated.isActive } });
    return updated;
  }

  async remove(ownerUserId: string, memberId: string) {
    const vendor = await this.prisma.vendor.findUnique({ where: { ownerUserId } });
    if (!vendor) throw new ConflictException('Only the store owner can remove team members.');
    const member = await this.prisma.vendorStaffMember.findFirst({ where: { id: memberId, vendorId: vendor.id } });
    if (!member) throw new NotFoundException('Team member not found.');
    await this.prisma.vendorStaffMember.delete({ where: { id: member.id } });
    await this.audit.record({ actorId: ownerUserId, action: 'vendor.team.remove', entityType: 'VendorStaffMember', entityId: member.id, before: { userId: member.userId, role: member.role } });
    return { success: true };
  }

  async accept(token: string, dto: { password: string }) {
    const invite = await this.prisma.vendorStaffInvitation.findFirst({ where: { tokenHash: this.hash(token), acceptedAt: null, expiresAt: { gt: new Date() } } });
    if (!invite) throw new BadRequestException('This invitation is invalid or expired.');
    const existing = await this.prisma.user.findFirst({ where: { OR: [invite.email ? { email: invite.email } : undefined, invite.phone ? { phone: invite.phone } : undefined].filter(Boolean) as any } });
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const result = await this.prisma.$transaction(async tx => {
      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash, role: UserRole.VENDOR } });
      if (existing) {
        if (existing.role !== UserRole.VENDOR) throw new BadRequestException('This account cannot accept a vendor team invitation.');
        await tx.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });
      }
      const member = await tx.vendorStaffMember.create({ data: { vendorId: invite.vendorId, userId: user.id, role: invite.role } });
      await tx.vendorStaffInvitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return { user, member };
    });
    return { success: true, message: 'Invitation accepted. You can now sign in to ROZZI.', userId: result.user.id };
  }

  private hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
}
