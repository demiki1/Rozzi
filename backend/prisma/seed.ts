import * as dotenv from 'dotenv';
dotenv.config({ path: __dirname + '/../.env' });

import { PrismaClient, LocationType, ServiceAreaStatus, UserRole, AdminRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function findOrCreateLocation(type: LocationType, name: string, parentId?: string) {
  const existing = await prisma.location.findFirst({ where: { type, name, parentId: parentId ?? null } });
  return existing ?? prisma.location.create({ data: { type, name, parentId } });
}

async function findOrCreateServiceArea(locationId: string, name: string, data: any) {
  const existing = await prisma.serviceArea.findFirst({ where: { locationId, name } });
  return existing ?? prisma.serviceArea.create({ data: { locationId, name, ...data } });
}

async function findOrCreateZone(serviceAreaId: string, name: string, radiusKm: number) {
  const existing = await prisma.deliveryZone.findFirst({ where: { serviceAreaId, name } });
  return existing ?? prisma.deliveryZone.create({ data: { serviceAreaId, name, radiusKm } });
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the seed script with NODE_ENV=production. This script creates demo data and a demo admin account.');
  }
  console.log('Seeding: DEMO data — safe to run repeatedly.');

  const nigeria = await findOrCreateLocation(LocationType.COUNTRY, 'Nigeria');
  const imo = await findOrCreateLocation(LocationType.STATE, 'Imo', nigeria.id);
  const owerri = await findOrCreateLocation(LocationType.CITY, 'Owerri', imo.id);
  const futo = await findOrCreateLocation(LocationType.UNIVERSITY, 'FUTO', owerri.id);
  const futoServiceArea = await findOrCreateServiceArea(futo.id, 'FUTO Campus', {
    status: ServiceAreaStatus.ACTIVE, minimumOrderAmount: 200000, baseDeliveryFee: 50000,
    perKmDeliveryFee: 10000, operatingHoursStart: '08:00', operatingHoursEnd: '23:00',
  });
  await findOrCreateZone(futoServiceArea.id, 'Campus Zone A', 5);

  const rivers = await findOrCreateLocation(LocationType.STATE, 'Rivers', nigeria.id);
  const portHarcourt = await findOrCreateLocation(LocationType.CITY, 'Port Harcourt', rivers.id);
  const gra = await findOrCreateLocation(LocationType.NEIGHBORHOOD, 'GRA', portHarcourt.id);
  const phServiceArea = await findOrCreateServiceArea(gra.id, 'Port Harcourt GRA', {
    status: ServiceAreaStatus.DRAFT, minimumOrderAmount: 200000, baseDeliveryFee: 60000,
    perKmDeliveryFee: 10000,
  });
  await findOrCreateZone(phServiceArea.id, 'Zone A', 6);

  const categoryNames = ['Food', 'Groceries', 'Health', 'Personal Items', 'Mini Gadgets', 'Drinks'];
  for (const [index, name] of categoryNames.entries()) {
    const existing = await prisma.category.findFirst({ where: { name } });
    if (existing) await prisma.category.update({ where: { id: existing.id }, data: { displayOrder: index } });
    else await prisma.category.create({ data: { name, displayOrder: index } });
  }

  const vendorTypeNames = ['Kitchen', 'Grocery Store', 'Supermarket', 'Pharmacy', 'Convenience Store', 'Personal Care Shop', 'Gadget Shop', 'Drinks Vendor', 'General Retailer'];
  for (const name of vendorTypeNames) await prisma.vendorType.upsert({ where: { name }, update: { isActive: true }, create: { name } });

  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) throw new Error('SEED_ADMIN_PASSWORD must be set before seeding. Refusing to create a predictable admin password.');
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash, role: UserRole.ADMIN, adminRole: AdminRole.SUPER_ADMIN, isActive: true, isEmailVerified: true },
    create: { fullName: 'Super Admin (seed)', email: 'admin@example.com', passwordHash, role: UserRole.ADMIN, adminRole: AdminRole.SUPER_ADMIN, isEmailVerified: true },
  });

  console.log('Seed complete. It is safe to run again; existing demo records are reused/updated.');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
