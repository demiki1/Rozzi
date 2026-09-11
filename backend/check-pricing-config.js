const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const areas = await prisma.serviceArea.findMany({
    select: {
      id: true,
      name: true,
      status: true,
      minimumOrderAmount: true,
      pricingConfigs: {
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          isActive: true,
          serviceFeeRatePercent: true,
          serviceFeeCapAmount: true,
          baseDeliveryFee: true,
          perKmDeliveryFee: true,
          deliveryRadiusKm: true,
          surgeEnabled: true,
          surgeLevel: true,
          surgeSlightlyHighAmount: true,
          surgeHighAmount: true,
          surgeVeryHighAmount: true,
          surgeMaxAmount: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(JSON.stringify(areas, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
