import type { ApiError } from '@mediaclear/contracts';

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export const ok = <T>(data: T): ServiceResult<T> => ({ ok: true, data });
export const fail = <T = never>(error: ApiError): ServiceResult<T> => ({ ok: false, error });
