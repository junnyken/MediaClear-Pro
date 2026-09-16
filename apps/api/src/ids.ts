/** Sinh id co tien to de doc log de hieu. Khong dung tang dan de khong lo so luong. */
import { randomUUID } from 'node:crypto';

export type IdPrefix = 'usr' | 'wsp' | 'mem' | 'prj' | 'ast' | 'src' | 'job' | 'att' | 'usg' | 'aud' | 'val' | 'ses' | 'out';

export function newId(prefix: IdPrefix): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
