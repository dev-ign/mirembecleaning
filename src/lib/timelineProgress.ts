export function timelineProgress(railTop: number, railHeight: number, viewportHeight: number): number {
  if (railHeight <= 0) return 0
  return Math.max(0, Math.min(1, (viewportHeight * 0.6 - railTop) / railHeight))
}
