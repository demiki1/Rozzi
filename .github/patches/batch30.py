from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if new in text:
        return
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:160]!r}")
    p.write_text(text.replace(old, new, 1))


# Customer cart: make the single-vendor invariant atomic so two concurrent
# first additions cannot race and leave one cart pointing at the wrong vendor.
replace_once(
    "backend/src/modules/cart/cart.service.ts",
    "    await this.prisma.cart.update({ where: { id: cart.id }, data: { vendorId: product.vendorId } });",
    "    const claimed = await this.prisma.cart.updateMany({\n      where: {\n        id: cart.id,\n        OR: [{ vendorId: null }, { vendorId: product.vendorId }],\n      },\n      data: { vendorId: product.vendorId },\n    });\n\n    if (claimed.count !== 1) {\n      throw new ConflictException({\n        code: 'CART_VENDOR_MISMATCH',\n        message: 'Your cart contains items from another store. Start a new cart to add items from this one.',\n      });\n    }",
)

replace_once(
    "backend/test/unit/cart-single-vendor.spec.ts",
    "    cart: {\n      findUnique: jest.fn(async () => cart),\n      create: jest.fn(async () => cart),\n      update: jest.fn(async ({ data }: any) => ({ ...cart, ...data })),\n    },",
    "    cart: {\n      findUnique: jest.fn(async () => cart),\n      create: jest.fn(async () => cart),\n      update: jest.fn(async ({ data }: any) => ({ ...cart, ...data })),\n      updateMany: jest.fn(async ({ data }: any) => ({ count: 1 })),\n    },",
)
replace_once(
    "backend/test/unit/cart-single-vendor.spec.ts",
    "    expect(prisma.cart.update).toHaveBeenCalledWith(\n      expect.objectContaining({ data: { vendorId: 'vendor-A' } }),\n    );",
    "    expect(prisma.cart.updateMany).toHaveBeenCalledWith(\n      expect.objectContaining({\n        where: expect.objectContaining({\n          id: 'cart-1',\n          OR: [{ vendorId: null }, { vendorId: 'vendor-A' }],\n        }),\n        data: { vendorId: 'vendor-A' },\n      }),\n    );",
)
replace_once(
    "backend/test/unit/cart-single-vendor.spec.ts",
    "    expect(prisma.cart.update).not.toHaveBeenCalled();\n    expect(prisma.cartItem.create).not.toHaveBeenCalled();",
    "    expect(prisma.cart.updateMany).not.toHaveBeenCalled();\n    expect(prisma.cartItem.create).not.toHaveBeenCalled();",
)
replace_once(
    "backend/test/unit/cart-single-vendor.spec.ts",
    "  it('the vendor-mismatch error carries a machine-readable code for the frontend to branch on', async () => {",
    "  it('rejects a concurrent vendor claim when the cart was claimed by another vendor first', async () => {\n    const prisma = buildPrismaMock({ existingCartVendorId: null, productVendorId: 'vendor-A' });\n    prisma.cart.updateMany.mockResolvedValue({ count: 0 });\n    const service = new CartService(prisma as any);\n\n    await expect(\n      service.addItem('customer-1', { productId: 'product-1', quantity: 1 }),\n    ).rejects.toMatchObject({ response: { code: 'CART_VENDOR_MISMATCH' } });\n\n    expect(prisma.cartItem.create).not.toHaveBeenCalled();\n  });\n\n  it('the vendor-mismatch error carries a machine-readable code for the frontend to branch on', async () => {",
)

# Checkout: reject inactive delivery zones and handle overnight product
# availability windows consistently with cart option availability.
replace_once(
    "backend/src/modules/orders/orders.service.ts",
    "      if (\n        !deliveryZone ||\n        deliveryZone.serviceAreaId !== dto.serviceAreaId\n      ) {",
    "      if (\n        !deliveryZone ||\n        !deliveryZone.isActive ||\n        deliveryZone.serviceAreaId !== dto.serviceAreaId\n      ) {",
)
replace_once(
    "backend/src/modules/orders/orders.service.ts",
    "      if (\n        start &&\n        end &&\n        !(hhmm >= start && hhmm <= end)\n      ) {",
    "      const withinAvailability =\n        !start || !end\n          ? true\n          : start <= end\n            ? hhmm >= start && hhmm <= end\n            : hhmm >= start || hhmm <= end;\n\n      if (!withinAvailability) {",
)

# Customer addresses: coordinates must be actual bounded numbers rather than
# arbitrary values that can later poison distance calculations.
replace_once(
    "backend/src/modules/account/dto/account.dto.ts",
    "import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';",
    "import { IsBoolean, IsNumber, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';",
)
replace_once(
    "backend/src/modules/account/dto/account.dto.ts",
    "  @IsOptional()\n  latitude?: number;\n\n  @IsOptional()\n  longitude?: number;",
    "  @IsOptional()\n  @IsNumber()\n  @Min(-90)\n  @Max(90)\n  latitude?: number;\n\n  @IsOptional()\n  @IsNumber()\n  @Min(-180)\n  @Max(180)\n  longitude?: number;",
)

# Customer cancellation UX: a successful payment on a cancelled order is
# explicitly a pending refund until the payment/order reaches refunded state.
replace_once(
    "apps/customer/src/app/orders/[id]/page.tsx",
    "const latestPayment=o.payments?.[0];const refundPending=o.status==='CANCELLED'&&latestPayment?.status==='SUCCESS';const refundProcessed=o.status==='CANCELLED'&&latestPayment?.status==='REFUNDED';",
    "const latestPayment=o.payments?.[0];const refundProcessed=o.status==='REFUNDED'||latestPayment?.status==='REFUNDED';const refundPending=o.status==='CANCELLED'&&latestPayment?.status==='SUCCESS'&&!refundProcessed;",
)

# Refund history: expose REQUESTED/PROCESSING as the customer-facing
# "Refund pending" state rather than an ambiguous internal status.
replace_once(
    "apps/customer/src/app/refunds/page.tsx",
    "function statusLabel(status: string) {\n  return status.replace(/_/g, \" \");\n}",
    "function statusLabel(status: string) {\n  const normalized = status.toUpperCase();\n\n  if (normalized === 'REQUESTED' || normalized === 'PROCESSING' || normalized === 'PENDING') {\n    return 'Refund pending';\n  }\n\n  if (normalized === 'PROCESSED' || normalized === 'COMPLETED') {\n    return 'Refund processed';\n  }\n\n  return status.replace(/_/g, \" \");\n}",
)
replace_once(
    "apps/customer/src/app/refunds/page.tsx",
    "      setSubmitSuccess(\n        \"Your refund request has been submitted. An admin will review it.\"\n      );",
    "      setSubmitSuccess(\n        \"Your refund request has been submitted. Your refund is pending ROZZI admin review and processing.\"\n      );",
)

print('batch30 customer audit patch applied')
