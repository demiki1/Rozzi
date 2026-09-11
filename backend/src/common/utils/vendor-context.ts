import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

/** Resolves the store a vendor owner or active vendor staff member belongs to. */
export async function vendorForUser(prisma: PrismaService, userId: string) {
  const owned = await prisma.vendor.findUnique({ where: { ownerUserId: userId } });
  if (owned) return owned;

  const membership = await prisma.vendorStaffMember.findFirst({
    where: { userId, isActive: true },
    include: { vendor: true },
  });
  if (!membership) throw new NotFoundException('No vendor profile or active vendor team membership found for this account.');
  return membership.vendor;
}

export async function isVendorOwner(prisma: PrismaService, userId: string, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, ownerUserId: userId }, select: { id: true } });
  return Boolean(vendor);
}
