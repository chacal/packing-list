/** Format grams as "123 g" below 1 kg and "1.2 kg" from 1 kg upwards. */
export function formatWeight(grams: number): string {
  if (Math.abs(grams) < 1000) return `${grams} g`
  return `${(grams / 1000).toFixed(1)} kg`
}
