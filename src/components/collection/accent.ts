/** Identity colour for the dot before a card's title: the same item keeps the same colour. */
export function accentFor(id: string) {
  const colours = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)']
  const n = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)
  return colours[n % colours.length]!
}
