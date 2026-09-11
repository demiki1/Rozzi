import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CreateAddressDto } from './dto/order.dto';

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(customerId: string) {
    return this.prisma.address.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' } });
  }

  async create(customerId: string, dto: CreateAddressDto) {
    return this.prisma.address.create({ data: { customerId, ...dto } });
  }

  async remove(customerId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.customerId !== customerId) {
      throw new NotFoundException('Address not found.');
    }
    await this.prisma.address.delete({ where: { id: addressId } });
    return { success: true };
  }

  // Used internally by OrdersService to validate checkout ownership.
  async getOwnedOrThrow(customerId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!address || address.customerId !== customerId) {
      throw new NotFoundException('Delivery address not found.');
    }
    return address;
  }
}
