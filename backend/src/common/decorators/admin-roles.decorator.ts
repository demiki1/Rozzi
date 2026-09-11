import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '@prisma/client';

export const ADMIN_ROLES_KEY = 'adminRoles';

// §38: "Do not make every administrator a super-admin... Use granular
// permissions." Applied ON TOP OF @Roles(UserRole.ADMIN) + RolesGuard, not
// instead of it — this only narrows within the ADMIN role, matching which
// AdminRole sub-roles may call a given endpoint. SUPER_ADMIN always passes
// (enforced in AdminRolesGuard), so it never needs listing explicitly.
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
