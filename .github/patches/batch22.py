from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

slash = chr(92)
replace('backend/src/modules/promotions/promotions.service.ts', 'SELECT id FROM ' + slash + '"Promotion' + slash + '" WHERE id = ${promotionId} FOR UPDATE', 'SELECT id FROM ' + slash + '"promotions' + slash + '" WHERE id = ${promotionId} FOR UPDATE')
replace('backend/src/modules/orders/orders.service.ts', "if (process.env.NODE_ENV === 'production') {", "if (!['development', 'test'].includes(process.env.NODE_ENV ?? '')) {")
replace('backend/src/modules/vendors/vendors.service.ts', "return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType, fileUrl } });", "const ownedFileUrl = await this.storage.getOwnedPublicImageUrl(ownerUserId, fileUrl);\n    return this.prisma.vendorDocument.create({ data: { vendorId: vendor.id, docType: docType.trim(), fileUrl: ownedFileUrl } });")
replace('backend/src/modules/vendors/vendors.service.ts', "async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {\n    const vendor = await this.getByOwner(ownerUserId);\n    if (mode === 'busy') {", "async setOperationalMode(ownerUserId: string, mode: 'holiday' | 'busy', enabled: boolean, busyPreparationTimeMinutes?: number) {\n    if (mode !== 'holiday' && mode !== 'busy') throw new BadRequestException('Invalid operational mode.');\n    if (typeof enabled !== 'boolean') throw new BadRequestException('enabled must be a boolean.');\n    if (busyPreparationTimeMinutes !== undefined && (!Number.isInteger(busyPreparationTimeMinutes) || busyPreparationTimeMinutes < 0)) {\n      throw new BadRequestException('Busy preparation time must be a non-negative integer.');\n    }\n    const vendor = await this.getByOwner(ownerUserId);\n    if (mode === 'busy') {")
replace('backend/src/modules/products/product-options.service.ts', "const min = dto.minSelections ?? (dto.isRequired ? 1 : 0);\n    const max = dto.maxSelections ?? 1;\n    this.validateBounds(min, max);", "const min = dto.minSelections ?? (dto.isRequired ? 1 : 0);\n    const max = dto.maxSelections ?? 1;\n    if ((dto.isRequired ?? false) && min < 1) throw new BadRequestException('Required option groups must require at least one selection.');\n    this.validateBounds(min, max);")
replace('backend/src/modules/products/product-options.service.ts', "const min = dto.minSelections ?? group.minSelections;\n    const max = dto.maxSelections ?? group.maxSelections;\n    this.validateBounds(min, max);", "const min = dto.minSelections ?? group.minSelections;\n    const max = dto.maxSelections ?? group.maxSelections;\n    const nextRequired = dto.isRequired ?? group.isRequired;\n    if (nextRequired && min < 1) throw new BadRequestException('Required option groups must require at least one selection.');\n    this.validateBounds(min, max);")
replace('backend/src/modules/finance/vendor-finance.service.ts', "    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID).reduce((s, p) => s + p.amount, 0);", "    const paidOut = payouts.filter(p => p.status === VendorPayoutStatus.PAID && p.createdAt >= date.gte && p.createdAt <= date.lte).reduce((s, p) => s + p.amount, 0);")
print('batch22 vendor hardening patch applied')
