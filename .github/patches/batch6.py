from pathlib import Path


def read(path):
    return Path(path).read_text(encoding='utf-8-sig')


def write(path, text):
    Path(path).write_text(text, encoding='utf-8')

path = 'backend/src/modules/orders/orders.service.ts'
text = read(path)

# Snapshot the payout rate at checkout, alongside the other immutable order
# pricing snapshots. The ledger must never fall back to a later admin setting.
old = """                commissionRateSnapshot:\n                  orderCommissionRateSnapshot,\n\n                customerNote:"""
new = """                commissionRateSnapshot:\n                  orderCommissionRateSnapshot,\n\n                riderPayoutRateSnapshot:\n                  pricingConfig.riderPayoutRatePercent,\n\n                customerNote:"""
if old not in text:
    raise SystemExit('rider payout snapshot anchor not found')
text = text.replace(old, new, 1)

# consumePromotion() already increments usageCount under the promotion row
# lock. Remove the legacy second increment, which made limited promotions
# fail at checkout and could otherwise double-count unlimited promotions.
start = """          if (promotion) {\n            const updated =\n              await tx.promotion.updateMany("""
end = """          await tx.cartItem.deleteMany({"""
start_index = text.find(start)
if start_index == -1:
    raise SystemExit('legacy promotion usage block start not found')
end_index = text.find(end, start_index)
if end_index == -1:
    raise SystemExit('legacy promotion usage block end not found')
text = text[:start_index] + text[end_index:]

write(path, text)
