const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const serviceAreas = await prisma.serviceArea.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  for (const area of serviceAreas) {
    const existing = await prisma.pricingConfig.findFirst({
      where: {
        serviceAreaId: area.id,
        isActive: true,
      },
    });

    if (existing) {
      console.log(`SKIPPED: ${area.name} already has an active PricingConfig.`);
      continue;
    }

    const config = await prisma.pricingConfig.create({
      data: {
        serviceAreaId: area.id,
        isActive: true,

        serviceFeeRatePercent: 5,
        serviceFeeCapAmount: 100000,

        baseDeliveryFee: 45000,
        perKmDeliveryFee: 10000,
        deliveryRadiusKm: 8,

        surgeEnabled: true,
        surgeLevel: 'NORMAL',
        surgeSlightlyHighAmount: 10000,
        surgeHighAmount: 20000,
        surgeVeryHighAmount: 30000,
        surgeMaxAmount: 30000,
      },
    });

    console.log(`CREATED: ${area.name} ? ${config.id}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
