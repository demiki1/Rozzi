from pathlib import Path
import subprocess
p=Path('backend/src/modules/payments/payments.service.ts')
s=p.read_text(encoding='utf-8-sig')
old='''      const updated = await this.prisma.$transaction(async (tx) => {\n        const current = await tx.refund.findUnique({\n          where: { id: refund.id },\n        });\n'''
new='''      const updated = await this.prisma.$transaction(async (tx) => {\n        await tx.$queryRaw`SELECT id FROM "Refund" WHERE id = ${refund.id} FOR UPDATE`;\n\n        const current = await tx.refund.findUnique({\n          where: { id: refund.id },\n        });\n'''
if old in s and 'SELECT id FROM "Refund" WHERE id = ${refund.id} FOR UPDATE' not in s:
    s=s.replace(old,new,1)
old2='''      await this.prisma.payment.update({\n        where: {\n          id: payment.id,\n        },\n        data: {\n          status: PaymentStatus.SUCCESS,\n          paidAt:\n            verification.paidAt ?? new Date(),\n          ...(providerTransactionId\n            ? { providerTransactionId }\n            : {}),\n        },\n      });\n'''
new2='''      const markedSuccessful = await this.prisma.payment.updateMany({\n        where: { id: payment.id, status: PaymentStatus.PENDING },\n        data: {\n          status: PaymentStatus.SUCCESS,\n          paidAt: verification.paidAt ?? new Date(),\n          ...(providerTransactionId ? { providerTransactionId } : {}),\n        },\n      });\n\n      if (markedSuccessful.count !== 1) {\n        return { status: PaymentStatus.SUCCESS };\n      }\n'''
if old2 not in s: raise SystemExit('success block not found')
s=s.replace(old2,new2,1)
old3='''      await this.prisma.payment.update({\n        where: {\n          id: payment.id,\n        },\n        data: {\n          status: PaymentStatus.FAILED,\n        },\n      });\n'''
new3='''      const markedFailed = await this.prisma.payment.updateMany({\n        where: { id: payment.id, status: PaymentStatus.PENDING },\n        data: { status: PaymentStatus.FAILED },\n      });\n\n      if (markedFailed.count !== 1) {\n        return { status: PaymentStatus.FAILED };\n      }\n'''
if old3 not in s: raise SystemExit('failed block not found')
s=s.replace(old3,new3,1)
p.write_text(s,encoding='utf-8')

rp=Path('backend/test/unit/refund-concurrency.spec.ts')
r=rp.read_text(encoding='utf-8-sig')
r=r.replace("expect(tx.$queryRaw).toHaveBeenCalledTimes(2);", "expect(tx.$queryRaw).toHaveBeenCalledTimes(3);", 1)
rp.write_text(r,encoding='utf-8')

wp=Path('backend/test/unit/webhook-payload.spec.ts')
w=wp.read_text(encoding='utf-8-sig')
w=w.replace("payment: { findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn().mockResolvedValue({ ...payment, status: 'SUCCESS' }) },", "payment: { findUnique: jest.fn().mockResolvedValue(payment), update: jest.fn().mockResolvedValue({ ...payment, status: 'SUCCESS' }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },")
w=w.replace("expect(prisma.payment.update).toHaveBeenCalledTimes(1);", "expect(prisma.payment.updateMany).toHaveBeenCalledTimes(1);")
wp.write_text(w,encoding='utf-8')

flow=Path('.github/workflows/rozzifix-batch3.yml')
f=flow.read_text(encoding='utf-8-sig')
f=f.replace("git commit -m 'fix: harden refund and settlement concurrency [skip ci]' && git pull --rebase origin codex/rozzifix-batch1 && git push", "git commit -m 'fix: harden refund and settlement concurrency [skip ci]' && git push origin HEAD:codex/rozzifix-batch1")
f=f.replace("backend/test/unit/refund-concurrency.spec.ts backend/src/modules/finance/ledger.service.ts", "backend/test/unit/refund-concurrency.spec.ts backend/test/unit/webhook-payload.spec.ts backend/src/modules/finance/ledger.service.ts")
flow.write_text(f,encoding='utf-8')

# Stage the regression here because the workflow commit step has a fixed staging list.
subprocess.run(['git','add','backend/test/unit/webhook-payload.spec.ts'], check=True)
