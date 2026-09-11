import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRolesGuard } from '../../src/common/guards/admin-roles.guard';
import { AdminRole } from '@prisma/client';

function buildContext(userId: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: { userId, role: 'ADMIN' } }),
    }),
    getHandler: () => ({}) as any,
    getClass: () => ({}) as any,
  } as unknown as ExecutionContext;
}

describe('AdminRolesGuard (§38)', () => {
  function buildGuard(requiredRoles: AdminRole[] | undefined, adminRoleInDb: AdminRole | null) {
    const reflector = { getAllAndOverride: jest.fn(() => requiredRoles) } as unknown as Reflector;
    const prisma = {
      user: { findUnique: jest.fn(async () => (adminRoleInDb ? { adminRole: adminRoleInDb } : { adminRole: null })) },
    } as any;
    return new AdminRolesGuard(reflector, prisma);
  }

  it('allows the request through when no @AdminRoles() decorator is present', async () => {
    const guard = buildGuard(undefined, AdminRole.SUPPORT_ADMIN);
    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
  });

  it('allows a matching sub-role through', async () => {
    const guard = buildGuard([AdminRole.VENDOR_ADMIN], AdminRole.VENDOR_ADMIN);
    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
  });

  it('rejects a non-matching sub-role', async () => {
    const guard = buildGuard([AdminRole.VENDOR_ADMIN], AdminRole.SUPPORT_ADMIN);
    await expect(guard.canActivate(buildContext('user-1'))).rejects.toThrow(ForbiddenException);
  });

  it('SUPER_ADMIN always passes, regardless of which sub-role is required', async () => {
    const guard = buildGuard([AdminRole.FINANCE_ADMIN], AdminRole.SUPER_ADMIN);
    await expect(guard.canActivate(buildContext('user-1'))).resolves.toBe(true);
  });

  it('rejects an admin account with no adminRole assigned at all', async () => {
    const guard = buildGuard([AdminRole.CONTENT_ADMIN], null);
    await expect(guard.canActivate(buildContext('user-1'))).rejects.toThrow(ForbiddenException);
  });
});
