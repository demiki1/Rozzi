from pathlib import Path


def replace(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# Onboarding document uploads must use the same storage ownership boundary as
# vendor logos/covers and the legacy vendor document endpoint.
replace(
    'backend/src/modules/vendors/vendor-onboarding.service.ts',
    "import { NotificationsService } from '../notifications/notifications.service';",
    "import { NotificationsService } from '../notifications/notifications.service';\nimport { StorageService } from '../storage/storage.service';",
)
replace(
    'backend/src/modules/vendors/vendor-onboarding.service.ts',
    "  constructor(\n    private prisma: PrismaService,\n    private audit: AuditLogService,\n    private notifications: NotificationsService,\n  ) {}",
    "  constructor(\n    private prisma: PrismaService,\n    private audit: AuditLogService,\n    private notifications: NotificationsService,\n    private storage: StorageService,\n  ) {}",
)
replace(
    'backend/src/modules/vendors/vendor-onboarding.service.ts',
    "    const row = await this.prisma.vendorDocument.create({\n      data: {\n        vendorId: v.id,\n        docType: docType.trim(),\n        fileUrl: fileUrl.trim(),\n      },\n    });",
    "    const ownedFileUrl = await this.storage.getOwnedPublicImageUrl(userId, fileUrl.trim());\n    const row = await this.prisma.vendorDocument.create({\n      data: {\n        vendorId: v.id,\n        docType: docType.trim(),\n        fileUrl: ownedFileUrl,\n      },\n    });",
)

# The onboarding service previously allowed an already-approved vendor to
# submit again and silently move the live store back to PENDING. Approved and
# suspended stores must remain locked just like save/addDocument.
replace(
    'backend/src/modules/vendors/vendor-onboarding.service.ts',
    "  async submit(userId: string) {\n    const v = await this.vendor(userId);\n    const snap = await this.snapshot(v.id);",
    "  async submit(userId: string) {\n    const v = await this.vendor(userId);\n    if ([VendorStatus.APPROVED, VendorStatus.SUSPENDED].includes(v.status)) {\n      throw new ForbiddenException('Onboarding cannot be submitted while the store is active or suspended.');\n    }\n    const snap = await this.snapshot(v.id);",
)

# Registration must not attach a vendor to an inactive vendor type or service
# area. Both are administrative availability controls.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "    const serviceArea = await this.prisma.serviceArea.findUnique({\n      where: { id: dto.serviceAreaId },\n    });\n    if (!serviceArea) throw new NotFoundException('Service area not found.');\n\n    return this.prisma.vendor.create({",
    "    const serviceArea = await this.prisma.serviceArea.findUnique({\n      where: { id: dto.serviceAreaId },\n    });\n    if (!serviceArea) throw new NotFoundException('Service area not found.');\n    if (serviceArea.status !== 'ACTIVE') throw new BadRequestException('This service area is not currently active.');\n\n    const vendorType = await this.prisma.vendorType.findUnique({ where: { id: dto.vendorTypeId } });\n    if (!vendorType) throw new NotFoundException('Vendor type not found.');\n    if (!vendorType.isActive) throw new BadRequestException('This vendor type is not currently available.');\n\n    return this.prisma.vendor.create({",
)

# The service-area management endpoint has the same administrative boundary.
replace(
    'backend/src/modules/vendors/vendors.service.ts',
    "    const serviceArea = await this.prisma.serviceArea.findUnique({ where: { id: serviceAreaId } });\n    if (!serviceArea) throw new NotFoundException('Service area not found.');\n\n    return this.prisma.vendorLocation.upsert({",
    "    const serviceArea = await this.prisma.serviceArea.findUnique({ where: { id: serviceAreaId } });\n    if (!serviceArea) throw new NotFoundException('Service area not found.');\n    if (serviceArea.status !== 'ACTIVE') throw new BadRequestException('This service area is not currently active.');\n\n    return this.prisma.vendorLocation.upsert({",
)

print('batch23 remaining vendor onboarding hardening patch applied')
