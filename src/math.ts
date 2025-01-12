export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function repeatUntil<T>(base: T[], length: number) {
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(base[i % base.length]);
  }
  return result;
}

export function safeParseInt(value: string, defaultValue = 0): number {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}
