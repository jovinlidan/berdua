// Readable text on a filled swatch. Chips, badges and calendar tiles are filled with category
// tints that run from deep sage to pale gold, so a fixed white label is unreadable on the light
// ones. Pick whichever of paper-white or ink contrasts better with the fill.
const PAPER = '#fffaf6'
const INK = '#43322c'

/** WCAG relative luminance of a #rgb / #rrggbb colour. */
export function relativeLuminance(hex: string): number {
  const raw = hex.replace('#', '')
  const full = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = channels.map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** The label colour to use on top of `hex`. */
export function textOn(hex: string): string {
  const bg = relativeLuminance(hex)
  return ratio(bg, relativeLuminance(PAPER)) >= ratio(bg, relativeLuminance(INK)) ? PAPER : INK
}
