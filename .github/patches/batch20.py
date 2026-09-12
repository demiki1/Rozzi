from pathlib import Path
import re


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

ledger = Path('backend/src/modules/finance/ledger.service.ts')
text = ledger.read_text(encoding='utf-8')

# Make every ledger idempotency key independently retryable. Concurrent event
# delivery is handled by the unique idempotency key plus P2002 recovery.
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

# Remove the whole-order VENDOR_EARNING early return. It can hide partial
# bookings when a previous event delivery wrote only the first ledger entry.
text, n = re.subn(
    r'\n    // Idempotency: if this order has already been booked.*?\n    const order = await this\.prisma\.order\.findUnique\(',
    '\n    const order = await this.prisma.order.findUnique(',
    text,
    count=1,
    flags=re.DOTALL,
)
if n != 1:
    raise SystemExit(f'ledger vendor guard: expected 1 regex match, found {n}')

# Remove the refund-wide early return for the same reason. Each compensating
# ledger entry already has its own idempotency key.
text, n = re.subn(
    r'\n  @OnEvent\(REFUND_PROCESSED_EVENT\)\n  async onRefundProcessed\(payload: RefundProcessedPayload\) \{\n    const existing = await this\.prisma\.ledgerEntry\.findFirst\(\{.*?\n    const refundAmount = Math\.abs\(payload\.amountKobo\);',
    '\n  @OnEvent(REFUND_PROCESSED_EVENT)\n  async onRefundProcessed(payload: RefundProcessedPayload) {\n    const refundAmount = Math.abs(payload.amountKobo);',
    text,
    count=1,
    flags=re.DOTALL,
)
if n != 1:
    raise SystemExit(f'ledger refund guard: expected 1 regex match, found {n}')

ledger.write_text(text, encoding='utf-8')
