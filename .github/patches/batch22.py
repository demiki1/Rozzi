from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Promotion checkout currently uses Prisma's logical table name in raw SQL.
# PostgreSQL table names in this schema are lowercase, so the lock must target
# the real table or promotion checkout fails at runtime.
replace(
    'backend/src/modules/promotions/promotions.service.ts',
    'SELECT id FROM \\"Promotion\\" WHERE id = ${promotionId} FOR UPDATE',
    'SELECT id FROM \\"promotions\\" WHERE id = ${promotionId} FOR UPDATE',
)

# Development payment stub must be explicitly limited to development/test;
# NODE_ENV=staging (or another non-production value) must never enable it.
replace(
    'backend/src/modules/orders/orders.service.ts',
    "if (process.env.NODE_ENV === 'production') {",
    "if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {",
)

# Vendor-uploaded verification documents must reference an object the vendor
# actually owns, matching the existing logo/cover-image ownership boundary.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType, fileUrl } });",
    "const ownedFileUrl = await this.storage.getOwnedPublicImageUrl(ownerUserId, fileUrl);\n    return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType: docType.trim(), fileUrl: ownedFileUrl } });",
)

# Operational mode is currently a plain request body, so TypeScript types are
# not runtime validation. Reject invalid modes/booleans and invalid busy times
# rather than silently treating an unknown mode as holiday mode.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {\n    const vendor = await this.getByOwner(ownerUserId);\n    if (mode === 'busy') {",
    "async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {\n    if (mode !== 'holiday' && mode !== 'busy') throw new BadRequestException('Invalid operational mode.');\n    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean.');\n    if (busyPreparationTimeMinutes !== undefined && (!Number.isInteger(busyPreparationTimeMinutes) || busyPreparationTimeMinutes < 0)) {\n      throw new BadRequestException('Busy preparation time must be a non-negative integer.');\n    }\n    const vendor = await this.getByOwner(ownerUserId);\n    if (mode === 'busy') {",
)

# Required option groups must require at least one selection even when a
# caller explicitly supplies minSelections=0.
replace(
    'backend/src/modules/products/product-options.service.ts',
    "const min = dto.minSelections ?? (dto.isRequired ? 1 : 0);\n    const max = dto.maxSelections ?? 1;\n    this.validateBounds(min, max);",
    "const min = dto.minSelections ?? (dto.isRequired ? 1 : 0);\n    const max = dto.maxSelections ?? 1;\n    if ((dto.isRequired ?? false) && min < 1) throw new BadRequestException('Required option groups must require at least one selection.');\n    this.validateBounds(min, max);",
)
replace(
    'backend/src/modules/products/product-options.service.ts',
    "const min = dto.minSelections ?? group.minSelections;\n    const max = dto.maxSelections ?? group.maxSelections;\n    this.validateBounds(min, max);",
    "const min = dto.minSelections ?? group.minSelections;\n    const max = dto.maxSelections ?? group.maxSelections;\n    const nextRequired = dto.isRequired ?? group.isRequired;\n    if (nextRequired && min < 1) throw new BadRequestException('Required option groups must require at least one selection.');\n    this.validateBounds(min, max);",
)

# Team invitation acceptance must atomically claim the invitation. Otherwise
# two concurrent accepts can both observe acceptedAt=null and create members.
replace(
    'backend/src/modules/vendors/team.service.ts',
    "    const invite = await this.prisma.vendorStaffInvitation.findFirst({ where: { tokenHash: this.hash(token), acceptedAt: null, expiresAt: { gt: new Date() } } });\n    if (!invite) throw new BadRequestException('This invitation is invalid or expired.');\n    const existing = await this.prisma.user.findFirst({ where: { OR: [invite.email ? { email: invite.email } : undefined, invite.phone ? { phone: invite.phone } : undefined].filter(Boolean) as any } });\n    const passwordHash = await bcrypt.hash(dto.password, 12);\n    const result = await this.prisma.$transaction(async tx => {\n      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash, role: UserRole.VENDOR } });\n      if (existing) {\n        if (existing.role !== UserRole.VENDOR) throw new BadRequestException('This account cannot accept a vendor team invitation.');\n        await tx.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });\n      }\n      const member = await tx.vendorStaffMember.create({ data: { vendorId: invite.vendorId, userId: user.id, role: invite.role } });\n      await tx.vendorStaffInvitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });\n      return { user, member };\n    });",
    "    const result = await this.prisma.$transaction(async tx => {\n      const invite = await tx.vendorStaffInvitation.findFirst({ where: { tokenHash: this.hash(token), acceptedAt: null, expiresAt: { gt: new Date() } } });\n      if (!invite) throw new BadRequestException('This invitation is invalid or expired.');\n      const claimed = await tx.vendorStaffInvitation.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });\n      if (claimed.count !== 1) throw new BadRequestException('This invitation has already been accepted or expired.');\n      const existing = await tx.user.findFirst({ where: { OR: [invite.email ? { email: invite.email } : undefined, invite.phone ? { phone: invite.phone } : undefined].filter(Boolean) as any } });\n      const passwordHash = await bcrypt.hash(dto.password, 12);\n      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash, role: UserRole.VENDOR } });\n      if (existing && existing.role !== UserRole.VENDOR) throw new BadRequestException('This account cannot accept a vendor team invitation.');\n      // Existing vendor accounts keep their existing credential; accepting a\n      // team invitation must not silently reset another account's password.\n      const member = await tx.vendorStaffMember.create({ data: { vendorId: invite.vendorId, userId: user.id, role: invite.role } });\n      return { user, member };\n    });",
)

# Vendor finance's overview card is range-filtered, so its paid-out metric must
# use the same selected range rather than silently showing all-time payouts.
replace(
    'backend/src/modules/finance/vendor-finance.service.ts',
    "      this.prisma.vendorPayout.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: 'desc' }, take: 5 }),",
    "      this.prisma.vendorPayout.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: 'desc' }, take: 5 }),",
)
replace(
    'backend/src/modules/finance/vendor-finance.service.ts',
    "    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID).reduce((s, p) => s + p.amount, 0);",
    "    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID && p.createdAt >= date.gte && p.createdAt <= date.lte).reduce((s, p) => s + p.amount, 0);",
)

print('batch22 vendor hardening patch applied')
