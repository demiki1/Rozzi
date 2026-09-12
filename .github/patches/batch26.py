from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); text=p.read_text()
    if new in text: return
    if old not in text: raise SystemExit(f'Expected text not found in {path}: {old[:120]!r}')
    p.write_text(text.replace(old,new,1))

replace_once('backend/src/modules/vendors/vendors.service.ts', "  async setOpenStatus(ownerUserId: string, isOpen: boolean) {\n    const vendor = await this.getByOwner(ownerUserId);\n    if (vendor.status !== VendorStatus.APPROVED) {\n      throw new ForbiddenException('Only approved vendors can open for orders.');\n    }", "  async setOpenStatus(ownerUserId: string, isOpen: boolean) {\n    const vendor = await this.getByOwner(ownerUserId);\n    if (vendor.status !== VendorStatus.APPROVED) {\n      throw new ForbiddenException('Only approved vendors can open for orders.');\n    }\n    if (isOpen && vendor.holidayMode) throw new ForbiddenException('The store is in holiday mode. Disable holiday mode before opening.');\n    if (isOpen && vendor.temporaryClosureUntil && vendor.temporaryClosureUntil > new Date()) throw new ForbiddenException('The store is temporarily closed until the scheduled reopening time.');")

replace_once('backend/src/modules/vendors/team.service.ts', "    const result = await this.prisma.$transaction(async tx => {\n      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash: passwordHash!, role: UserRole.VENDOR } });", "    const result = await this.prisma.$transaction(async tx => {\n      const claimed = await tx.vendorStaffInvitation.updateMany({ where: { id: invite.id, acceptedAt: null, expiresAt: { gt: new Date() } }, data: { acceptedAt: new Date() } });\n      if (claimed.count !== 1) throw new BadRequestException('This invitation is invalid or has already been accepted.');\n      const user = existing || await tx.user.create({ data: { fullName: invite.fullName, email: invite.email, phone: invite.phone, passwordHash: passwordHash!, role: UserRole.VENDOR } });")
replace_once('backend/src/modules/vendors/team.service.ts', "      await tx.vendorStaffInvitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });\n      return { user, member };", "      return { user, member };")
print('batch26 vendor operational and invitation hardening patch applied')
