export function formatDecimalHours(time: number): string {
  const minutes = Math.round((time % 1) * 60)
  return `${Math.floor(time)}:${minutes < 10 ? '0' : ''}${minutes}`
}

export function formatSeconds(duration: number): string {
  return formatDecimalHours(duration / 3600);
}
