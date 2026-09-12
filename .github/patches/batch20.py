from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly 1 match, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')

# Prisma maps the Payment model to the lowercase `payments` table. The raw
# lock must use the physical table name, not Prisma's model name.
replace_once(
    'backend/src/modules/payments/payments.service.ts',
    'SELECT id FROM "Payment" WHERE id = ${payment.id} FOR UPDATE',
    'SELECT id FROM "payments" WHERE id = ${payment.id} FOR UPDATE',
)

# Make every ledger idempotency key independently retryable. Event listeners
# can be interrupted after one entry is written; a later delivery must still
# be able to complete the remaining entries instead of being short-circuited
# by a single existing VENDOR_EARNING/REFUND entry.
ledger = Path('backend/src/modules/finance/ledger.service.ts')
text = ledger.read_text(encoding='utf-8')
text = text.replace(
    "import { LedgerAccountType, LedgerEntryType, OrderStatus } from '@prisma/client';",
    "import { LedgerAccountType, LedgerEntryType, OrderStatus, Prisma } from '@prisma/client';",
    1,
)
old_record = '''  async record(params: {\n    type: LedgerEntryType;\n    accountType: LedgerAccountType;\n    accountId?: string | null;\n    orderId?: string | null;\n    amount: number;\n    description?: string;\n    idempotencyKey?: string | null;\n  }) {\n    return this.prisma.ledgerEntry.create({\n      data: {\n        type: params.type,\n        accountType: params.accountType,\n        accountId: params.accountId ?? null,\n        orderId: params.orderId ?? null,\n        amount: params.amount,\n        description: params.description,\n        idempotencyKey: params.idempotencyKey ?? null,\n      },\n    });\n  }'''
new_record = '''  async record(params: {\n    type: LedgerEntryType;\n    accountType: LedgerAccountType;\n    accountId?: string | null;\n    orderId?: string | null;\n    amount: number;\n    description?: string;\n    idempotencyKey?: string | null;\n  }) {\n    if (params.idempotencyKey) {\n      const existing = await this.prisma.ledgerEntry.findUnique({\n        where: { idempotencyKey: params.idempotencyKey },\n      });\n      if (existing) return existing;\n    }\n\n    try {\n      return await this.prisma.ledgerEntry.create({\n        data: {\n          type: params.type,\n          accountType: params.accountType,\n          accountId: params.accountId ?? null,\n          orderId: params.orderId ?? null,\n          amount: params.amount,\n          description: params.description,\n          idempotencyKey: params.idempotencyKey ?? null,\n        },\n      });\n    } catch (error) {\n      if (\n        params.idempotencyKey &&\n        error instanceof Prisma.PrismaClientKnownRequestError &&\n        error.code === 'P2002'\n      ) {\n        const existing = await this.prisma.ledgerEntry.findUnique({\n          where: { idempotencyKey: params.idempotencyKey },\n        });\n        if (existing) return existing;\n      }\n      throw error;\n    }\n  }'''
if text.count(old_record) != 1:
    raise SystemExit(f'ledger record block: expected 1 match, found {text.count(old_record)}')
text = text.replace(old_record, new_record, 1)
old_vendor_guard = '''    // Idempotency: if this order has already been booked (e.g. a\n    // transition somehow fires twice), don't double-book. Checked by\n    // looking for an existing VENDOR_EARNING entry for this order rather\n    // than trusting the caller to only call this once.\n    const alreadyBooked = await this.prisma.ledgerEntry.findFirst({\n      where: { orderId: payload.orderId, type: LedgerEntryType.VENDOR_EARNING },\n    });\n    if (alreadyBooked) {\n      this.logger.warn(`Order ${payload.orderId} already has a VENDOR_EARNING entry — skipping re-booking.`);\n      return;\n    }\n\n'''
if text.count(old_vendor_guard) != 1:
    raise SystemExit(f'ledger vendor guard: expected 1 match, found {text.count(old_vendor_guard)}')
text = text.replace(old_vendor_guard, '', 1)
old_refund_guard = '''  async onRefundProcessed(payload: RefundProcessedPayload) {\n    const existing = await this.prisma.ledgerEntry.findFirst({\n      where: { orderId: payload.orderId, type: LedgerEntryType.REFUND, description: { contains: payload.refundId } },\n    });\n    if (existing) return;\n    const refundAmount = Math.abs(payload.amountKobo);'''
new_refund_guard = '''  async onRefundProcessed(payload: RefundProcessedPayload) {\n    const refundAmount = Math.abs(payload.amountKobo);'''
if text.count(old_refund_guard) != 1:
    raise SystemExit(f'ledger refund guard: expected 1 match, found {text.count(old_refund_guard)}')
text = text.replace(old_refund_guard, new_refund_guard, 1)
ledger.write_text(text, encoding='utf-8')
