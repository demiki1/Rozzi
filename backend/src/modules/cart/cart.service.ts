import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AddCartItemDto } from './dto/cart.dto';
import { PUBLIC_VENDOR_SELECT } from '../vendors/vendor-public-select';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly cartInclude = {
    items: {
      include: {
        product: { include: { images: true, variants: true, category: true } },
        variant: { include: { inventory: true } },
        optionSelections: { orderBy: { createdAt: 'asc' as const } },
      },
      orderBy: { createdAt: 'asc' as const },
    },
    vendor: { select: PUBLIC_VENDOR_SELECT },
  };

  async getOrCreateCart(customerId: string) {
    let cart = await this.prisma.cart.findUnique({ where: { customerId }, include: this.cartInclude });
    if (!cart) {
      cart = await this.prisma.cart.create({ data: { customerId }, include: this.cartInclude });
    }
    return this.withPricing(cart);
  }

  async addItem(customerId: string, dto: AddCartItemDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        inventory: true,
        variants: { include: { inventory: true }, orderBy: { displayOrder: 'asc' } },
        optionGroups: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: { items: { where: { isAvailable: true }, orderBy: { displayOrder: 'asc' } } },
        },
      },
    });
    if (!product || !product.isAvailable) throw new NotFoundException('Product not available.');

    const cart = await this.getOrCreateCart(customerId);
    if (cart.vendorId && cart.vendorId !== product.vendorId) {
      throw new ConflictException({
        code: 'CART_VENDOR_MISMATCH',
        message: 'Your cart contains items from another store. Start a new cart to add items from this one.',
      });
    }

    if (product.variants.length && !dto.variantId) {
      throw new BadRequestException('Please select a variant for this product.');
    }
    const selectedVariant = dto.variantId ? product.variants.find((variant) => variant.id === dto.variantId) : null;
    if (dto.variantId && !selectedVariant) throw new BadRequestException('The selected product variant is no longer available.');

    const availableGroups = product.optionGroups.filter((group) => this.isWithinAvailabilityWindow(group.availabilityStartTime, group.availabilityEndTime));
    const selections = await this.validateAndResolveSelections(availableGroups, dto.optionSelections ?? [], dto.quantity);
    const selectedOptionIds = selections.map((x) => x.optionItemId).sort();
    const configurationKey = `${selectedVariant?.id ?? 'base'}:${selectedOptionIds.join(',')}`;

    const inventory = selectedVariant?.inventory ?? product.inventory;
    if (inventory && inventory.quantity < dto.quantity) {
      throw new BadRequestException('Not enough stock available for the requested quantity.');
    }

    const claimed = await this.prisma.cart.updateMany({
      where: {
        id: cart.id,
        OR: [{ vendorId: null }, { vendorId: product.vendorId }],
      },
      data: { vendorId: product.vendorId },
    });

    if (claimed.count !== 1) {
      throw new ConflictException({
        code: 'CART_VENDOR_MISMATCH',
        message: 'Your cart contains items from another store. Start a new cart to add items from this one.',
      });
    }

    const existingItem = await this.prisma.cartItem.findUnique({
      where: { cartId_productId_configurationKey: { cartId: cart.id, productId: dto.productId, configurationKey } },
    });

    if (existingItem) {
      const nextQuantity = existingItem.quantity + dto.quantity;
      if (inventory && inventory.quantity < nextQuantity) {
        throw new BadRequestException(`Only ${inventory.quantity} unit${inventory.quantity === 1 ? '' : 's'} available.`);
      }
      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: nextQuantity, note: dto.note ?? existingItem.note },
        include: { optionSelections: true },
      });
    }

    return this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: dto.productId,
        variantId: dto.variantId ?? null,
        quantity: dto.quantity,
        note: dto.note,
        configurationKey,
        optionSelections: {
          create: selections.map((selection) => ({
            groupId: selection.groupId,
            optionItemId: selection.optionItemId,
            groupNameSnapshot: selection.groupName,
            optionNameSnapshot: selection.optionName,
            additionalPriceSnapshot: selection.additionalPrice,
          })),
        },
      },
      include: { optionSelections: true },
    });
  }

  private async validateAndResolveSelections(
    groups: Array<{
      id: string;
      name: string;
      isRequired: boolean;
      minSelections: number;
      maxSelections: number;
      items: Array<{ id: string; groupId: string; name: string; additionalPrice: number; isAvailable: boolean; stockQuantity: number | null }>;
    }>,
    selections: Array<{ groupId: string; optionItemIds: string[] }>,
    quantity: number,
  ) {
    const submittedGroups = new Map<string, string[]>();
    for (const selection of selections) {
      if (submittedGroups.has(selection.groupId)) throw new BadRequestException('Each option group can only be submitted once.');
      submittedGroups.set(selection.groupId, selection.optionItemIds ?? []);
    }

    const resolved: Array<{ groupId: string; optionItemId: string; groupName: string; optionName: string; additionalPrice: number }> = [];
    for (const group of groups) {
      const ids = submittedGroups.get(group.id) ?? [];
      const uniqueIds = [...new Set(ids)];
      if (uniqueIds.length !== ids.length) throw new BadRequestException(`Duplicate selections are not allowed in ${group.name}.`);
      if (group.isRequired && uniqueIds.length === 0) throw new BadRequestException(`Please select an option from ${group.name}.`);
      if (uniqueIds.length < group.minSelections) throw new BadRequestException(`Please select at least ${group.minSelections} option${group.minSelections === 1 ? '' : 's'} from ${group.name}.`);
      if (uniqueIds.length > group.maxSelections) throw new BadRequestException(`You can select at most ${group.maxSelections} option${group.maxSelections === 1 ? '' : 's'} from ${group.name}.`);

      for (const optionItemId of uniqueIds) {
        const item = group.items.find((candidate) => candidate.id === optionItemId);
        if (!item || !item.isAvailable) throw new BadRequestException(`The selected option in ${group.name} is no longer available.`);
        if (item.stockQuantity !== null && item.stockQuantity < quantity) {
          throw new BadRequestException(`${item.name} does not have enough stock for this quantity.`);
        }
        resolved.push({ groupId: group.id, optionItemId: item.id, groupName: group.name, optionName: item.name, additionalPrice: item.additionalPrice });
      }
    }

    for (const submittedGroupId of submittedGroups.keys()) {
      if (!groups.some((group) => group.id === submittedGroupId)) throw new BadRequestException('One or more selected options do not belong to this product.');
    }
    return resolved;
  }

  private isWithinAvailabilityWindow(start?: string | null, end?: string | null) {
    if (!start && !end) return true;
    const now = new Date();
    const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (start && end) return start <= end ? current >= start && current <= end : current >= start || current <= end;
    return start ? current >= start : current <= end!;
  }

  private withPricing(cart: any) {
    return {
      ...cart,
      items: cart.items.map((item: any) => {
        const basePrice = item.variant?.priceOverride ?? item.product.priceAmount;
        const discountAmount = Math.min(item.product.discountAmount ?? 0, basePrice);
        const optionAmount = item.optionSelections.reduce((sum: number, selection: any) => sum + selection.additionalPriceSnapshot, 0);
        const unitPriceAmount = Math.max(0, basePrice - discountAmount) + optionAmount;
        return { ...item, unitPriceAmount, subtotalAmount: unitPriceAmount * item.quantity };
      }),
    };
  }

  async updateItemQuantity(customerId: string, itemId: string, quantity: number) {
    const item = await this.prisma.cartItem.findFirst({
      where: { id: itemId, cart: { customerId } },
      include: { product: { include: { inventory: true } }, variant: { include: { inventory: true } }, optionSelections: true },
    });
    if (!item) throw new NotFoundException('Cart item not found.');
    const inventory = item.variant?.inventory ?? item.product.inventory;
    if (inventory && inventory.quantity < quantity) throw new BadRequestException(`Only ${inventory.quantity} unit${inventory.quantity === 1 ? '' : 's'} available.`);

    if (item.optionSelections.length) {
      const optionIds = item.optionSelections.map((selection) => selection.optionItemId);
      const options = await this.prisma.productOptionItem.findMany({ where: { id: { in: optionIds } }, select: { id: true, name: true, stockQuantity: true, isAvailable: true } });
      for (const option of options) {
        if (!option.isAvailable || (option.stockQuantity !== null && option.stockQuantity < quantity)) {
          throw new BadRequestException(`${option.name} is no longer available in the requested quantity.`);
        }
      }
    }

    return this.prisma.cartItem.update({ where: { id: item.id }, data: { quantity }, include: { product: { include: { images: true, variants: true, category: true } }, variant: true, optionSelections: true } });
  }

  async removeItem(customerId: string, itemId: string) {
    const item = await this.getOwnedItem(customerId, itemId);
    await this.prisma.cartItem.delete({ where: { id: item.id } });
    const remaining = await this.prisma.cartItem.count({ where: { cartId: item.cartId } });
    if (remaining === 0) await this.prisma.cart.update({ where: { id: item.cartId }, data: { vendorId: null } });
    return { success: true };
  }

  async clear(customerId: string) {
    const cart = await this.getOrCreateCart(customerId);
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await this.prisma.cart.update({ where: { id: cart.id }, data: { vendorId: null } });
    return { success: true };
  }

  private async getOwnedItem(customerId: string, itemId: string) {
    const item = await this.prisma.cartItem.findUnique({ where: { id: itemId }, include: { cart: true } });
    if (!item || item.cart.customerId !== customerId) throw new NotFoundException('Cart item not found.');
    return item;
  }
}
