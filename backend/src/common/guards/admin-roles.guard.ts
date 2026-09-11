import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../config/prisma.service';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';
import { AdminRole } from '@prisma/client';

// DESIGN NOTE, flagged rather than silently decided: the JWT access token
// (see JwtStrategy) only encodes { sub, role }, not adminRole — reissuing
// every token's shape felt like a bigger, riskier change than this guard
// doing one extra DB lookup per admin request. Admin traffic volume is low
// relative to customer traffic, so the cost is negligible; if that stops
// being true, adminRole can be folded into the JWT payload and this guard
// simplified to read from req.user instead.
//
// Must run AFTER RolesGuard (so we already know req.user.role === 'ADMIN')
// — this guard only narrows further, it doesn't replace the base check.
@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true; // no @AdminRoles() = no narrowing

    const { user } = context.switchToHttp().getRequest();
    const admin = await this.prisma.user.findUnique({ where: { id: user.userId } });

    if (!admin?.adminRole) {
      throw new ForbiddenException('This account has no admin sub-role assigned.');
    }
    if (admin.adminRole === AdminRole.SUPER_ADMIN) return true; // always passes

    if (!required.includes(admin.adminRole)) {
      throw new ForbiddenException(
        `This action requires one of: ${required.join(', ')}. Your role is ${admin.adminRole}.`,
      );
    }
    return true;
  }
}
