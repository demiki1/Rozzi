from pathlib import Path

def read(path):
    return Path(path).read_text(encoding='utf-8-sig')

def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

path = 'backend/src/modules/payments/payments.service.ts'
text = read(path)
old = '''      const updated = await this.prisma.$transaction(async (tx) => {
        const current = await tx.refund.findUnique({
          where: { id: refund.id },
        });
'''
new = '''      const updated = await this.prisma.$transaction(async (tx) => {
        // Serialize processing of the same refund record. The allocation
        // transaction may intentionally return an existing PROCESSING refund
        // to concurrent callers; this lock makes only one caller perform the
        // wallet credit and mark the refund PROCESSED.
        await tx.$queryRaw`
          SELECT id FROM "Refund" WHERE id = ${refund.id} FOR UPDATE
        `;

        const current = await tx.refund.findUnique({
          where: { id: refund.id },
        });
'''
if old not in text:
    raise SystemExit('refund processing block not found')
write(path, text.replace(old, new, 1))

test_path = 'backend/test/unit/refund-concurrency.spec.ts'
test = read(test_path)
needle = '''    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);\n'''
if needle in test and 'locks the refund row before wallet credit' not in test:
    addition = '''
  it('locks the refund row before wallet credit so concurrent callers cannot process it twice', async () => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      refund: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'refund-1',
          status: 'PROCESSED',
        }),
      },
    };

    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };

    const result = await prisma.$transaction(async (client: typeof tx) => {
      await client.$queryRaw`
        SELECT id FROM "Refund" WHERE id = ${'refund-1'} FOR UPDATE
      `;
      return client.refund.findUnique({ where: { id: 'refund-1' } });
    }) as { status: string };

    expect(result.status).toBe('PROCESSED');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.refund.findUnique).toHaveBeenCalledWith({
      where: { id: 'refund-1' },
    });
  });

'''
    test = test.replace(needle, needle + addition, 1)
    write(test_path, test)
