// §55: amounts are stored as integers in kobo, never floats, never
// formatted strings. This is the single place that converts for display.
export function formatNaira(kobo: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(kobo / 100);
}
