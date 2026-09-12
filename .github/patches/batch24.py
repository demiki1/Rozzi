from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))

# Promotion row locking must use Prisma's mapped lowercase table name.
replace(
    'backend/src/modules/promotions/promotions.service.ts',
    'SELECT id FROM \\"Promotion\\" WHERE id = ${promotionId} FOR UPDATE',
    'SELECT id FROM \\"promotions\\" WHERE id = ${promotionId} FOR UPDATE',
)

# Vendor document uploads must reference storage owned by the vendor user.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "    return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType, fileUrl } });",
    "    const ownedFileUrl = await this.storage.getOwnedPublicImageUrl(ownerUserId, fileUrl);\n    return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType: docType.trim(), fileUrl: ownedFileUrl } });",
)

# Vendor operational mode endpoints must reject malformed runtime JSON even though
# TypeScript types are erased at runtime.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "  async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {\n    const vendor = await this.getByOwner(ownerUserId);\n    if (mode === 'busy') {",
    "  async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {\n    if (mode !== 'holiday' && mode !== 'busy') throw new BadRequestException('Invalid operational mode.');\n    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean.');\n    if (busyPreparationTimeMinutes !== undefined && (!Number.isInteger(busyPreparationTimeMinutes) || busyPreparationTimeMinutes < 0)) {\n      throw new BadRequestException('Busy preparation time must be a non-negative integer.');\n    }\n    const vendor = await this.getByOwner(ownerUserId);\n    if (mode === 'busy') {",
)

# Only active service areas and vendor types may be used for vendor registration.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "    if (!serviceArea) throw new NotFoundException('Service area not found.');\n\n    return this.prisma.vendor.create({",
    "    if (!serviceArea) throw new NotFoundException('Service area not found.');\n    if (serviceArea.status !== 'ACTIVE') throw new BadRequestException('This service area is not currently active.');\n\n    const vendorType = await this.prisma.vendorType.findUnique({ where: { id: dto.vendorTypeId } });\n    if (!vendorType) throw new NotFoundException('Vendor type not found.');\n    if (!vendorType.isActive) throw new BadRequestException('This vendor type is not currently available.');\n\n    return this.prisma.vendor.create({",
)
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "    if (!serviceArea) throw new NotFoundException('Service area not found.');\n\n    return this.prisma.vendorLocation.upsert({",
    "    if (!serviceArea) throw new NotFoundException('Service area not found.');\n    if (serviceArea.status !== 'ACTIVE') throw new BadRequestException('This service area is not currently active.');\n\n    return this.prisma.vendorLocation.upsert({",
)

# A submitted/approved/suspended vendor cannot reopen the onboarding submission path.
replace(
    'backend/src/modules/vendors/vendor-onboarding.service.ts',
    "  async submit(userId: string) {\n    const v = await this.vendor(userId);\n    const snap = await this.snapshot(v.id);",
    "  async submit(userId: string) {\n    const v = await this.vendor(userId);\n    if ([VendorStatus.APPROVED, VendorStatus.SUSPENDED].includes(v.status)) {\n      throw new ForbiddenException('Onboarding cannot be submitted while the store is active or suspended.');\n    }\n    const snap = await this.snapshot(v.id);",
)

# Vendor finance's paid-out metric must honor the requested date range.
replace(
    'backend/src/modules/finance/vendor-finance.service.ts',
    '    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID).reduce((s, p) => s + p.amount, 0);',
    '    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID && p.createdAt >= date.gte && p.createdAt <= date.lte).reduce((s, p) => s + p.amount, 0);',
)

# Required option groups must actually require a selection.
replace(
    'backend/src/modules/products/product-options.service.ts',
    "    const max = dto.maxSelections ?? 1;\n    this.validateBounds(min, max);",
    "    const max = dto.maxSelections ?? 1;\n    if ((dto.isRequired ?? false) && min < 1) throw new BadRequestException('Required option groups must require at least one selection.');\n    this.validateBounds(min, max);",
)
replace(
    'backend/src/modules/products/product-options.service.ts',
    "    const max = dto.maxSelections ?? group.maxSelections;\n    this.validateBounds(min, max);",
    "    const max = dto.maxSelections ?? group.maxSelections;\n    const nextRequired = dto.isRequired ?? group.isRequired;\n    if (nextRequired && min < 1) throw new BadRequestException('Required option groups must require at least one selection.');\n    this.validateBounds(min, max);",
)

# Existing vendor team invitation acceptance must not reset an existing account's password.
replace(
    'backend/src/modules/vendors/team.service.ts',
    "    const passwordHash = await bcrypt.hash(dto.password, 12);\n    const result = await this.prisma.$transaction(async tx => {\n      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash, role: UserRole.VENDOR } });\n      if (existing) {\n        if (existing.role !== UserRole.VENDOR) throw new BadRequestException('This account cannot accept a vendor team invitation.');\n        await tx.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });\n      }",
    "    const passwordHash = existing ? null : await bcrypt.hash(dto.password, 12);\n    const result = await this.prisma.$transaction(async tx => {\n      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash: passwordHash!, role: UserRole.VENDOR } });\n      if (existing) {\n        if (existing.role !== UserRole.VENDOR) throw new BadRequestException('This account cannot accept a vendor team invitation.');\n        if (!existing.isActive) await tx.user.update({ where: { id: existing.id }, data: { isActive: true } });\n      }",
)

print('batch24 vendor audit hardening patch applied')
