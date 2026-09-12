import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateAddressDto, UpdateAddressDto, UpdateProfileDto, UpdateSettingsDto } from './dto/account.dto';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}

  async profile(customerId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: customerId }, select: { id:true, fullName:true, email:true, phone:true, role:true, marketingNotificationsEnabled:true, orderNotificationsEnabled:true, promotionalNotificationsEnabled:true, createdAt:true } });
    if (!user) throw new NotFoundException('Customer account not found.');
    return user;
  }

  async updateProfile(customerId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({ where: { id: customerId }, data: { fullName: dto.fullName.trim(), ...(dto.phone !== undefined ? { phone: dto.phone.trim() || null } : {}) }, select: { id:true, fullName:true, email:true, phone:true, role:true, marketingNotificationsEnabled:true, orderNotificationsEnabled:true, promotionalNotificationsEnabled:true, createdAt:true } });
  }

  async settings(customerId: string) { return this.profile(customerId); }

  async updateSettings(customerId: string, dto: UpdateSettingsDto) {
    return this.prisma.user.update({ where: { id: customerId }, data: { ...(dto.marketingNotificationsEnabled !== undefined ? { marketingNotificationsEnabled: dto.marketingNotificationsEnabled } : {}), ...(dto.orderNotificationsEnabled !== undefined ? { orderNotificationsEnabled: dto.orderNotificationsEnabled } : {}), ...(dto.promotionalNotificationsEnabled !== undefined ? { promotionalNotificationsEnabled: dto.promotionalNotificationsEnabled } : {}) }, select: { id:true, fullName:true, email:true, phone:true, marketingNotificationsEnabled:true, orderNotificationsEnabled:true, promotionalNotificationsEnabled:true } });
  }

  async adminCustomers() {
    return this.prisma.user.findMany({ where: { role: UserRole.CUSTOMER }, select: { id: true, fullName: true, email: true, phone: true, isActive: true, isEmailVerified: true, isPhoneVerified: true, createdAt: true }, orderBy: { createdAt: 'desc' } });
  }

  async adminSetCustomerActive(customerId: string, active: boolean, actorId: string) {
    const customer = await this.prisma.user.findUnique({ where: { id: customerId }, select: { id: true, role: true, isActive: true } });
    if (!customer || customer.role !== UserRole.CUSTOMER) throw new NotFoundException('Customer account not found.');
    if (customer.isActive === active) return customer;
    const updated = await this.prisma.user.update({ where: { id: customerId }, data: { isActive: active }, select: { id: true, fullName: true, email: true, phone: true, isActive: true, role: true } });
    await this.audit.record({ actorId, action: active ? 'admin.customer.activate' : 'admin.customer.deactivate', entityType: 'User', entityId: customerId, before: { isActive: customer.isActive }, after: { isActive: active } });
    return updated;
  }

  async addresses(customerId: string) { return this.prisma.address.findMany({ where: { customerId }, orderBy: [{ isDefault:'desc' }, { createdAt:'desc' }] }); }

  async createAddress(customerId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) await tx.address.updateMany({ where:{ customerId }, data:{ isDefault:false } });
      const existing = await tx.address.count({ where:{ customerId } });
      return tx.address.create({ data: { customerId, label:dto.label.trim(), addressText:dto.addressText.trim(), landmark:dto.landmark?.trim() || null, instructions:dto.instructions?.trim() || null, latitude:dto.latitude ?? null, longitude:dto.longitude ?? null, isDefault:dto.isDefault ?? existing===0 } });
    });
  }

  async updateAddress(customerId: string, addressId: string, dto: UpdateAddressDto) {
    const address = await this.prisma.address.findFirst({ where:{id:addressId,customerId} });
    if (!address) throw new NotFoundException('Address not found.');
    return this.prisma.$transaction(async tx => {
      if (dto.isDefault) await tx.address.updateMany({where:{customerId},data:{isDefault:false}});
      return tx.address.update({ where:{id:addressId}, data:{ label:dto.label.trim(), addressText:dto.addressText.trim(), landmark:dto.landmark?.trim() || null, instructions:dto.instructions?.trim() || null, latitude:dto.latitude ?? null, longitude:dto.longitude ?? null, isDefault:dto.isDefault ?? address.isDefault } });
    });
  }

  async deleteAddress(customerId: string, addressId: string) {
    const address=await this.prisma.address.findFirst({where:{id:addressId,customerId}});
    if(!address) throw new NotFoundException('Address not found.');
    if(address.isDefault){
      const replacement=await this.prisma.address.findFirst({where:{customerId,id:{not:addressId}},orderBy:{createdAt:'desc'}});
      await this.prisma.$transaction(async tx=>{ await tx.address.delete({where:{id:addressId}}); if(replacement) await tx.address.update({where:{id:replacement.id},data:{isDefault:true}}); });
    } else await this.prisma.address.delete({where:{id:addressId}});
    return {success:true};
  }

  async setDefaultAddress(customerId:string,addressId:string){
    const address=await this.prisma.address.findFirst({where:{id:addressId,customerId}});
    if(!address) throw new NotFoundException('Address not found.');
    await this.prisma.$transaction([this.prisma.address.updateMany({where:{customerId},data:{isDefault:false}}), this.prisma.address.update({where:{id:addressId},data:{isDefault:true}})]);
    return {success:true,addressId};
  }
}
