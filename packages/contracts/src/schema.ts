/**
 * Bo kiem LUC CHAY nho, dung chung cho CA giao dien lan may chu (P3-MCP-30…34, dong D-047).
 *
 * Vi sao viet tay thay vi them mot thu vien: cung ly do da chon `scrypt` thay `argon2` (D-039) —
 * them mot phu thuoc la them mot thu co the hong khi dung anh Docker. Bo nay chi can lam mot
 * viec: kiem mot gia tri `unknown` co dung hinh dang khong, va SUY RA kieu TypeScript tu chinh
 * lich kiem do.
 *
 * Diem mau chot cua D-047: kieu va phep kiem den tu MOT khai bao. Khong the sua mot ben ma quen
 * ben kia, vi chung khong phai hai ben.
 *
 * KHONG dung `as` de che lech kieu, KHONG noi kieu thanh `any`.
 */

export type SchemaResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export interface Schema<T> {
  readonly kind: string;
  /** `path` de thong bao loi noi RO cho nao sai, khong chi noi "sai". */
  check(value: unknown, path: string): SchemaResult<T>;
}

/** Suy ra kieu TypeScript tu mot lich kiem. */
export type Infer<S> = S extends Schema<infer T> ? T : never;

function fail(path: string, message: string): SchemaResult<never> {
  return { ok: false, errors: [`${path}: ${message}`] };
}

export function string(): Schema<string> {
  return {
    kind: 'string',
    check: (v, p) => (typeof v === 'string' ? { ok: true, value: v } : fail(p, `phai la chuoi, nhan duoc ${typeName(v)}`)),
  };
}

export function number(): Schema<number> {
  return {
    kind: 'number',
    check: (v, p) =>
      typeof v === 'number' && Number.isFinite(v)
        ? { ok: true, value: v }
        : fail(p, `phai la so huu han, nhan duoc ${typeName(v)}`),
  };
}

export function boolean(): Schema<boolean> {
  return {
    kind: 'boolean',
    check: (v, p) => (typeof v === 'boolean' ? { ok: true, value: v } : fail(p, `phai la boolean, nhan duoc ${typeName(v)}`)),
  };
}

/**
 * Enum doc tu MOT mang hang. Truyen thang `JOB_STATES` vao day nghia la giao dien va may chu
 * khong the co hai danh sach trang thai khac nhau — chi co mot.
 */
export function enumOf<const T extends readonly string[]>(values: T): Schema<T[number]> {
  return {
    kind: `enum(${values.join('|')})`,
    check: (v, p) =>
      typeof v === 'string' && (values as readonly string[]).includes(v)
        ? { ok: true, value: v as T[number] }
        : fail(p, `phai la mot trong [${values.join(', ')}], nhan duoc ${JSON.stringify(v)}`),
  };
}

export function arrayOf<T>(item: Schema<T>): Schema<T[]> {
  return {
    kind: `array<${item.kind}>`,
    check: (v, p) => {
      if (!Array.isArray(v)) return fail(p, `phai la mang, nhan duoc ${typeName(v)}`);
      const out: T[] = [];
      const errors: string[] = [];
      v.forEach((element, i) => {
        const r = item.check(element, `${p}[${i}]`);
        if (r.ok) out.push(r.value);
        else errors.push(...r.errors);
      });
      return errors.length > 0 ? { ok: false, errors } : { ok: true, value: out };
    },
  };
}

/** `null` duoc phep. KHAC voi `optional`: truong van phai CO MAT. */
export function nullable<T>(inner: Schema<T>): Schema<T | null> {
  return {
    kind: `${inner.kind}|null`,
    check: (v, p) => (v === null ? { ok: true, value: null } : inner.check(v, p)),
  };
}

const OPTIONAL = Symbol('optional');
interface OptionalSchema<T> extends Schema<T | undefined> {
  readonly [OPTIONAL]: true;
}

/** Truong duoc phep VANG MAT. KHAC voi `nullable`. */
export function optional<T>(inner: Schema<T>): OptionalSchema<T> {
  return {
    kind: `${inner.kind}?`,
    [OPTIONAL]: true,
    check: (v, p) => (v === undefined ? { ok: true, value: undefined } : inner.check(v, p)),
  };
}

type ShapeOf<S extends Record<string, Schema<unknown>>> = {
  [K in keyof S]: Infer<S[K]>;
};

/**
 * Object kiem TUNG truong. Truong thua bi BO QUA co chu dich: may chu them mot truong moi khong
 * duoc lam hong giao dien cu. Truong THIEU thi bao loi — do moi la thu pha giao dien.
 */
export function object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<ShapeOf<S>> {
  return {
    kind: `object{${Object.keys(shape).join(',')}}`,
    check: (v, p) => {
      if (typeof v !== 'object' || v === null || Array.isArray(v)) {
        return fail(p, `phai la object, nhan duoc ${typeName(v)}`);
      }
      const source = v as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      const errors: string[] = [];
      for (const [key, schema] of Object.entries(shape)) {
        const isOptional = OPTIONAL in schema;
        if (!isOptional && !(key in source)) {
          errors.push(`${p}.${key}: thieu truong bat buoc`);
          continue;
        }
        const r = schema.check(source[key], `${p}.${key}`);
        if (r.ok) {
          if (r.value !== undefined || key in source) out[key] = r.value;
        } else {
          errors.push(...r.errors);
        }
      }
      return errors.length > 0 ? { ok: false, errors } : { ok: true, value: out as ShapeOf<S> };
    },
  };
}

function typeName(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

/**
 * Kiem vo boc `{ ok: true, data }` roi kiem tiep phan `data`.
 *
 * Day la CHO DUY NHAT giao dien duoc phep tin du lieu tu may chu. Truoc P3-MCP-30, `apiFetch<T>`
 * chi la mot loi khang dinh kieu — khong ai kiem — nen doi hinh dang phan hoi lam trang hong LUC
 * CHAY trong khi `tsc` hai ben deu xanh (D-047).
 */
export function checkEnvelope<T>(data: Schema<T>, payload: unknown): SchemaResult<T> {
  if (typeof payload !== 'object' || payload === null) {
    return fail('response', `phai la object, nhan duoc ${typeName(payload)}`);
  }
  const body = payload as Record<string, unknown>;
  if (body.ok !== true) return fail('response.ok', 'phan hoi khong phai vo boc thanh cong');
  if (!('data' in body)) return fail('response.data', 'thieu truong bat buoc');
  return data.check(body.data, 'response.data');
}
