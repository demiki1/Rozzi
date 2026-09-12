from pathlib import Path

p = Path('backend/src/modules/products/products.service.ts')
s = p.read_text(encoding='utf-8-sig')
old = '''    return this.prisma.$transaction(async (tx) => {
      const inventory = variantId
        ? await tx.inventory.findUnique({ where: { variantId } })
        : await tx.inventory.findUnique({ where: { productId } });

      if (!inventory) throw new NotFoundException('Inventory record not found for this product/variant.');
'''
new = '''    return this.prisma.$transaction(async (tx) => {
      if (variantId) {
        const variant = await tx.productVariant.findFirst({
          where: { id: variantId, productId },
          select: { id: true },
        });
        if (!variant) throw new NotFoundException('Variant not found for this product.');
      }

      const inventory = variantId
        ? await tx.inventory.findUnique({ where: { variantId } })
        : await tx.inventory.findUnique({ where: { productId } });

      if (!inventory) throw new NotFoundException('Inventory record not found for this product/variant.');
'''
if old not in s:
    raise SystemExit('adjustStock inventory block not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

p = Path('backend/src/modules/orders/orders.service.ts')
s = p.read_text(encoding='utf-8-sig')
old = '''    if (
      process.env.NODE_ENV === 'production'
    ) {
      throw new ForbiddenException(
        'This endpoint is disabled outside development.',
      );
    }
'''
new = '''    if (
      process.env.NODE_ENV !== 'development' &&
      process.env.NODE_ENV !== 'test'
    ) {
      throw new ForbiddenException(
        'This endpoint is disabled outside development and test environments.',
      );
    }
'''
if old not in s:
    raise SystemExit('dev payment environment guard not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')
