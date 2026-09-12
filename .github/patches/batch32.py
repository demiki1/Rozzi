from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8-sig')
    if new in text:
        return
    if old not in text:
        raise SystemExit(f'Expected text not found in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, 1), encoding='utf-8')


replace_once(
    'backend/src/modules/riders/rider-finance.service.ts',
    'accountNumberLast4: rider.bankAccountNumber.slice(-4),',
    'accountNumberLast4: rider.bankAccountNumber!.slice(-4),',
)
replace_once(
    'backend/src/modules/riders/rider-finance.service.ts',
    '        reference,\n      },\n    });\n\n    return payout;',
    '        reference: payout.reference,\n      },\n    });\n\n    return payout;',
)

# Production rider fixes are already persisted on the branch; this patch remains
# a validation guard so the audit workflow can still verify the intended shape.
print('batch32 rider finance audit patch applied')
