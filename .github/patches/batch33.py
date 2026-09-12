from pathlib import Path

path = Path('backend/src/modules/orders/orders.service.ts')
text = path.read_text(encoding='utf-8-sig')

marker = "const minimumOrderAmount = Math.max(\n      serviceArea.minimumOrderAmount,\n      Number((await this.settings.get('minimumOrderAmount')).value ?? 0),\n    );"

if marker in text:
    print('Admin minimum-order propagation already present.')
    raise SystemExit(0)

old = """    if (\n      subtotalAmount <\n      serviceArea.minimumOrderAmount\n    ) {\n      throw new BadRequestException(\n        `This location requires a minimum order of ${serviceArea.minimumOrderAmount / 100} NGN.`,\n      );\n    }"""

new = """    const minimumOrderAmount = Math.max(\n      serviceArea.minimumOrderAmount,\n      Number((await this.settings.get('minimumOrderAmount')).value ?? 0),\n    );\n\n    if (subtotalAmount < minimumOrderAmount) {\n      throw new BadRequestException(\n        `This location requires a minimum order of ${minimumOrderAmount / 100} NGN.`,\n      );\n    }"""

if old not in text:
    raise SystemExit('Expected checkout minimum-order block not found; refusing to patch.')

path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Applied admin minimum-order propagation patch.')
# Validation is intentionally performed against the exact branch tree on push; production changes are persisted only after all checks pass.
