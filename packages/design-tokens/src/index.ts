/**
 * MediaClear Pro - Design tokens (MCP-06).
 * Nguon mau: prompt Phase 0 muc H. Khong doi gia tri neu chua co decision moi.
 * Token ngu nghia (semantic) tro ve token nguyen thuy, UI chi dung semantic.
 */
export const PRIMITIVE_COLORS = {
  background: '#0B1020',
  surface: '#121A2E',
  primary: '#5B8CFF',
  success: '#35D0A1',
  warning: '#F6B84B',
  danger: '#F26B6B',
  textPrimary: '#F5F7FB',
  textSecondary: '#9CA8BF',
} as const;

/** Mau hien thi cho tung JobState. 'blocked' KHONG dung mau success. */
export const JOB_STATE_COLORS = {
  uploaded: PRIMITIVE_COLORS.textSecondary,
  validating: PRIMITIVE_COLORS.textSecondary,
  queued: PRIMITIVE_COLORS.textSecondary,
  processing: PRIMITIVE_COLORS.primary,
  review_required: PRIMITIVE_COLORS.warning,
  completed: PRIMITIVE_COLORS.success,
  failed: PRIMITIVE_COLORS.danger,
  blocked: PRIMITIVE_COLORS.danger,
  cancelled: PRIMITIVE_COLORS.textSecondary,
} as const;

/** Mau cho evidence status. 'unknown'/'unconfirmed' khong duoc mau xanh thanh cong. */
export const EVIDENCE_STATUS_COLORS = {
  verified: PRIMITIVE_COLORS.success,
  partially_verified: PRIMITIVE_COLORS.warning,
  unknown: PRIMITIVE_COLORS.textSecondary,
  unconfirmed: PRIMITIVE_COLORS.textSecondary,
  blocked: PRIMITIVE_COLORS.danger,
} as const;

export const SPACING_PX = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;
export const RADIUS_PX = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const FONT_SIZE_PX = { xs: 12, sm: 14, md: 16, lg: 20, xl: 28, xxl: 36 } as const;
export const BREAKPOINT_PX = { sm: 480, md: 768, lg: 1024, xl: 1280 } as const;

/** Accessibility: focus ring bat buoc thay duoc bang ban phim. */
export const A11Y = {
  focusRingWidthPx: 2,
  focusRingColor: PRIMITIVE_COLORS.primary,
  minTapTargetPx: 44,
  /** Ty le tuong phan toi thieu ap dung cho text tren nen surface. */
  minContrastRatio: 4.5,
  respectReducedMotion: true,
} as const;
