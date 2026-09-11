import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

// §39: "Record important administrative actions... Audit logs should be
// immutable to ordinary administrators." The AuditLog table has existed
// since Phase 1; this is the first phase anything actually calls
// AuditLogService.record(). Immutability is enforced by omission — there is
// deliberately no update/delete method here, and no controller exposes one.
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actorId: string;
    action: string;
    entityType: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        before: params.before as any,
        after: params.after as any,
        ipAddress: params.ipAddress,
      },
    });
  }

  async listRecent(entityType?: string) {
    return this.prisma.auditLog.findMany({
      where: entityType ? { entityType } : undefined,
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }
}
