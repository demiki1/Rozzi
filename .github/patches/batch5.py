from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')


# Backend: make the already-modelled rider payout setting actually persist.
path = 'backend/src/modules/pricing/pricing.service.ts'
text = read(path)

old = """  baseDeliveryFee: 45000, // ₦450\n  perKmDeliveryFee: 10000, // ₦100/km\n  deliveryRadiusKm: 8,\n  surgeEnabled: true,"""
new = """  baseDeliveryFee: 45000, // ₦450\n  perKmDeliveryFee: 10000, // ₦100/km\n  deliveryRadiusKm: 8,\n  riderPayoutRatePercent: 92,\n  surgeEnabled: true,"""
if old not in text:
    raise SystemExit('pricing default anchor not found')
text = text.replace(old, new, 1)

old = """      deliveryRadiusKm:\n        dto.deliveryRadiusKm ??\n        Number(\n          current?.deliveryRadiusKm ??\n            DEFAULT_PRICING.deliveryRadiusKm,\n        ),\n\n      surgeEnabled:"""
new = """      deliveryRadiusKm:\n        dto.deliveryRadiusKm ??\n        Number(\n          current?.deliveryRadiusKm ??\n            DEFAULT_PRICING.deliveryRadiusKm,\n        ),\n\n      riderPayoutRatePercent:\n        dto.riderPayoutRatePercent ??\n        Number(\n          current?.riderPayoutRatePercent ??\n            DEFAULT_PRICING.riderPayoutRatePercent,\n        ),\n\n      surgeEnabled:"""
if old not in text:
    raise SystemExit('pricing next-value anchor not found')
text = text.replace(old, new, 1)

old = """          deliveryRadiusKm:\n            new Prisma.Decimal(next.deliveryRadiusKm),\n          surgeEnabled:"""
new = """          deliveryRadiusKm:\n            new Prisma.Decimal(next.deliveryRadiusKm),\n          riderPayoutRatePercent:\n            next.riderPayoutRatePercent,\n          surgeEnabled:"""
if old not in text:
    raise SystemExit('pricing create anchor not found')
text = text.replace(old, new, 1)
write(path, text)


# Admin UI: expose the existing backend setting without changing the pricing model.
path = 'apps/admin/src/app/settings/pricing/page.tsx'
text = read(path)

replacements = [
    (
        """  perKmDeliveryFee: number;\n  deliveryRadiusKm: number | string;\n\n  surgeEnabled:""",
        """  perKmDeliveryFee: number;\n  deliveryRadiusKm: number | string;\n  riderPayoutRatePercent: number | string;\n\n  surgeEnabled:""",
        'PricingConfig type anchor',
    ),
    (
        """  perKmDeliveryFeeNaira: string;\n  deliveryRadiusKm: string;\n\n  surgeEnabled:""",
        """  perKmDeliveryFeeNaira: string;\n  deliveryRadiusKm: string;\n  riderPayoutRatePercent: string;\n\n  surgeEnabled:""",
        'PricingForm type anchor',
    ),
    (
        """  perKmDeliveryFeeNaira: '100',\n  deliveryRadiusKm: '8',\n\n  surgeEnabled:""",
        """  perKmDeliveryFeeNaira: '100',\n  deliveryRadiusKm: '8',\n  riderPayoutRatePercent: '92',\n\n  surgeEnabled:""",
        'PricingForm default anchor',
    ),
    (
        """    perKmDeliveryFeeNaira: toNaira(config.perKmDeliveryFee),\n    deliveryRadiusKm: String(config.deliveryRadiusKm),\n\n    surgeEnabled:""",
        """    perKmDeliveryFeeNaira: toNaira(config.perKmDeliveryFee),\n    deliveryRadiusKm: String(config.deliveryRadiusKm),\n    riderPayoutRatePercent: String(config.riderPayoutRatePercent),\n\n    surgeEnabled:""",
        'configToForm anchor',
    ),
    (
        """    if (!isPositive(form.deliveryRadiusKm)) {\n      return 'Delivery radius must be greater than 0 km.';\n    }\n\n    if (!isPositiveOrZero(form.surgeSlightlyHighNaira)) {""",
        """    if (!isPositive(form.deliveryRadiusKm)) {\n      return 'Delivery radius must be greater than 0 km.';\n    }\n\n    const riderPayoutRate = Number(form.riderPayoutRatePercent);\n\n    if (!Number.isFinite(riderPayoutRate) || riderPayoutRate < 0 || riderPayoutRate > 100) {\n      return 'Rider payout rate must be between 0% and 100%.';\n    }\n\n    if (!isPositiveOrZero(form.surgeSlightlyHighNaira)) {""",
        'validate anchor',
    ),
    (
        """        perKmDeliveryFee: toKobo(form.perKmDeliveryFeeNaira),\n        deliveryRadiusKm: Number(form.deliveryRadiusKm),\n\n        surgeEnabled:""",
        """        perKmDeliveryFee: toKobo(form.perKmDeliveryFeeNaira),\n        deliveryRadiusKm: Number(form.deliveryRadiusKm),\n        riderPayoutRatePercent: Number(form.riderPayoutRatePercent),\n\n        surgeEnabled:""",
        'payload anchor',
    ),
]

for old, new, label in replacements:
    if old not in text:
        raise SystemExit(f'{label} not found')
    text = text.replace(old, new, 1)

# Add a dedicated control inside the existing pricing grid. This keeps the
# setting in the same admin pricing workflow and does not introduce a new page.
anchor = """      <div className=\"grid\">"""
card = """      <div className=\"grid\">\n        <section className=\"card\">\n          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>\n            <div>\n              <h2 style={{ margin: 0, fontSize: 18 }}>Rider payout</h2>\n              <p style={{ margin: '7px 0 0', color: '#756b64', lineHeight: 1.5, fontSize: 13 }}>\n                Percentage of the delivery fee paid to the rider. ROZZI receives the remaining percentage.\n              </p>\n            </div>\n            <strong style={{ fontSize: 22, whiteSpace: 'nowrap' }}>{form.riderPayoutRatePercent}%</strong>\n          </div>\n          <div style={{ marginTop: 18 }}>\n            <label htmlFor=\"rider-payout-rate\" style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 7 }}>\n              Rider payout rate (%)\n            </label>\n            <input\n              id=\"rider-payout-rate\"\n              type=\"number\"\n              min=\"0\"\n              max=\"100\"\n              step=\"0.01\"\n              value={form.riderPayoutRatePercent}\n              onChange={(event) => updateField('riderPayoutRatePercent', event.target.value)}\n              style={{ width: '100%', minHeight: 42, border: '1px solid #d9cec5', borderRadius: 10, padding: '0 12px', font: 'inherit' }}\n            />\n          </div>\n        </section>"""
if text.count(anchor) != 1:
    raise SystemExit('pricing grid anchor not unique')
text = text.replace(anchor, card, 1)
write(path, text)
