from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


path = 'backend/src/modules/orders/orders.service.ts'
text = read(path)
old = """    const promotion = dto.promotionCode
      ? await this.promotionsService.validate(
          dto.promotionCode,
          customerId,
          discountedMerchandiseSubtotal,
        )
      : null;"""
new = """    const promotion = dto.promotionCode
      ? await this.promotionsService.validate(
          dto.promotionCode,
          customerId,
          discountedMerchandiseSubtotal,
          cart.vendorId!,
        )
      : null;"""
if old not in text:
    raise SystemExit('promotion validation anchor not found')
text = text.replace(old, new, 1)
old = """        async (tx) => {
          if (
            vendor.maxOrdersPerHour !=
            null
          ) {"""
new = """        async (tx) => {
          if (promotion) {
            await tx.$queryRaw`
              SELECT id FROM \"Promotion\" WHERE id = ${promotion.id} FOR UPDATE
            `;

            if (promotion.perCustomerLimit) {
              const used = await tx.order.count({
                where: {
                  customerId,
                  promotionId: promotion.id,
                },
              });

              if (used >= promotion.perCustomerLimit) {
                throw new BadRequestException(
                  'You have reached this promotion limit.',
                );
              }
            }
          }

          if (
            vendor.maxOrdersPerHour !=
            null
          ) {"""
if old not in text:
    raise SystemExit('transaction anchor not found')
text = text.replace(old, new, 1)
write(path, text)
