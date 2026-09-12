import { ConflictException } from '@nestjs/common';
import { CartService } from '../../src/modules/cart/cart.service';

function buildPrismaMock(opts: { existingCartVendorId: string | null; productVendorId: string }) {
  const cart = {
    id: 'cart-1',
    customerId: 'customer-1',
    vendorId: opts.existingCartVendorId,
    items: [],
    // Keep the fixture shape aligned with CartService.cartInclude for an occupied cart.
    vendor: opts.existingCartVendorId ? { id: opts.existingCartVendorId } : null,
  };
  const product = {
    id: 'product-1',
    isAvailable: true,
    vendorId: opts.productVendorId,
    vendor: { id: opts.productVendorId },
    inventory: { quantity: 10 },
    variants: [],
    optionGroups: [],
  };

  return {
    product: {
      findUnique: jest.fn(async () => product),
    },
    cart: {
      findUnique: jest.fn(async () => cart),
      create: jest.fn(async () => cart),
      update: jest.fn(async ({ data }: any) => ({ ...cart, ...data })),
    },
    inventory: {
      findUnique: jest.fn(async () => product.inventory),
    },
    cartItem: {
      findFirst: jest.fn(async () => null),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async (args: any) => ({ id: 'item-1', ...args.data })),
      create: jest.fn(async (args: any) => ({ id: 'item-1', ...args.data })),
    },
  };
}

describe('CartService — single-vendor-per-cart (§42)', () => {
  it('adds an item normally when the cart is empty (no vendor set yet)', async () => {
    const prisma = buildPrismaMock({ existingCartVendorId: null, productVendorId: 'vendor-A' });
    const service = new CartService(prisma as any);

    await expect(
      service.addItem('customer-1', { productId: 'product-1', quantity: 1 }),
    ).resolves.toBeDefined();

    expect(prisma.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { vendorId: 'vendor-A' } }),
    );
  });

  it('adds an item normally when it matches the cart’s existing vendor', async () => {
    const prisma = buildPrismaMock({ existingCartVendorId: 'vendor-A', productVendorId: 'vendor-A' });
    const service = new CartService(prisma as any);

    await expect(
      service.addItem('customer-1', { productId: 'product-1', quantity: 1 }),
    ).resolves.toBeDefined();
  });

  it('rejects adding a product from a different vendor than what is already in the cart', async () => {
    const prisma = buildPrismaMock({ existingCartVendorId: 'vendor-A', productVendorId: 'vendor-B' });
    const service = new CartService(prisma as any);

    await expect(
      service.addItem('customer-1', { productId: 'product-1', quantity: 1 }),
    ).rejects.toThrow(ConflictException);

    expect(prisma.cart.update).not.toHaveBeenCalled();
    expect(prisma.cartItem.create).not.toHaveBeenCalled();
  });

  it('the vendor-mismatch error carries a machine-readable code for the frontend to branch on', async () => {
    const prisma = buildPrismaMock({ existingCartVendorId: 'vendor-A', productVendorId: 'vendor-B' });
    const service = new CartService(prisma as any);

    try {
      await service.addItem('customer-1', { productId: 'product-1', quantity: 1 });
      fail('expected addItem to throw');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code: 'CART_VENDOR_MISMATCH' });
    }
  });
});
