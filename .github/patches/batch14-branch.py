from pathlib import Path
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
