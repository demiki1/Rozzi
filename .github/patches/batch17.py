from pathlib import Path

p = Path('backend/src/modules/payments/payments.service.ts')
s = p.read_text(encoding='utf-8-sig')
old = '''    const result = await this.prisma.$transaction(async (tx) => {\n      const order = await tx.order.findUnique({\n        where: { id: orderId },\n      });\n'''
new = '''    const result = await this.prisma.$transaction(async (tx) => {\n      // Serialize wallet payments for the same order so two concurrent\n      // requests cannot both observe an unpaid order and debit the wallet twice.\n      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;\n\n      const order = await tx.order.findUnique({\n        where: { id: orderId },\n      });\n'''
if old not in s:
    raise SystemExit('wallet order transaction anchor not found')
s = s.replace(old, new, 1)
p.write_text(s, encoding='utf-8')

t = Path('backend/test/unit/wallet-money-concurrency.spec.ts')
s = t.read_text(encoding='utf-8-sig')
needle = "const tx = {\n      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1', customerId: 'customer-1', status: 'PENDING_PAYMENT', totalAmount: 5000, orderNumber: 'RZW-1' }) },"
s = s.replace(needle, "const tx = {\n      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1', customerId: 'customer-1', status: 'PENDING_PAYMENT', totalAmount: 5000, orderNumber: 'RZW-1' }) },\n      $queryRaw: jest.fn().mockResolvedValue([]),", 1)
needle2 = "    expect(tx.wallet.updateMany).toHaveBeenCalledWith({"
s = s.replace(needle2, "    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);\n    expect(tx.wallet.updateMany).toHaveBeenCalledWith({", 1)
needle3 = "const tx = {\n      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1', customerId: 'customer-1', status: 'PENDING_PAYMENT', totalAmount: 5000, orderNumber: 'RZW-1' }) },\n      payment: { findFirst: jest.fn().mockResolvedValue(null) },"
s = s.replace(needle3, "const tx = {\n      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1', customerId: 'customer-1', status: 'PENDING_PAYMENT', totalAmount: 5000, orderNumber: 'RZW-1' }) },\n      $queryRaw: jest.fn().mockResolvedValue([]),\n      payment: { findFirst: jest.fn().mockResolvedValue(null) },", 1)
t.write_text(s, encoding='utf-8')
