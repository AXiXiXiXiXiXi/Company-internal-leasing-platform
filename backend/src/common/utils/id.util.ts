import { randomBytes } from 'node:crypto';

export function asId(value: string | number | null | undefined): string {
  return String(value ?? '');
}

export function randomApplicationNo(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = randomBytes(5).toString('hex').toUpperCase();
  return `APP-${date}-${suffix}`;
}
