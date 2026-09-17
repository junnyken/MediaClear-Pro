'use client';

import { useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { PRIMITIVE_COLORS } from '@mediaclear/design-tokens';
import { translate } from '../_lib/api';

/**
 * O chon tep.
 *
 * Vi sao khong dung thang `<input type="file">`: trinh duyet tu ve nut cua no va tu viet chu
 * TIENG ANH ("Choose File" / "No file chosen") — khong CSS nao doi duoc chu do. Tren mot giao
 * dien tieng Viet nen toi, no hien ra mot nut xam lac long, va nguoi dung noi dung: "khong giong
 * nhu co the tai anh hay video len".
 *
 * Cach lam o day: van la `<input type="file">` THAT — chi trong suot va phu kin vung ben duoi.
 * Nho vay khong mat gi ve kha nang truy cap: van tab toi duoc, van la file input that voi trinh
 * doc man hinh, van mo duoc hop thoai bang ban phim. Vien focus duoc ve tay vi input trong suot.
 */
export function FilePicker({
  inputRef,
  accept,
  name = 'file',
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  accept?: string;
  name?: string;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.files?.[0]?.name ?? null);
  };

  return (
    <div
      ref={boxRef}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--mcp-space-3)',
        padding: 'var(--mcp-space-4)',
        border: `1px dashed ${PRIMITIVE_COLORS.textSecondary}`,
        borderRadius: 'var(--mcp-radius-md)',
        background: 'transparent',
        // Vien focus tu ve: input that thi trong suot nen vien mac dinh khong nhin thay.
        outline: focused ? `2px solid ${PRIMITIVE_COLORS.primary}` : 'none',
        outlineOffset: 2,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept={accept}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      />
      <span
        aria-hidden
        style={{
          padding: 'var(--mcp-space-2) var(--mcp-space-3)',
          border: `1px solid ${PRIMITIVE_COLORS.textSecondary}`,
          borderRadius: 'var(--mcp-radius-sm)',
          color: PRIMITIVE_COLORS.textPrimary,
          whiteSpace: 'nowrap',
        }}
      >
        {translate('screen.asset_upload.pick_button')}
      </span>
      <span
        aria-hidden
        style={{
          color: fileName ? PRIMITIVE_COLORS.textPrimary : PRIMITIVE_COLORS.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {fileName ?? translate('screen.asset_upload.no_file_chosen')}
      </span>
    </div>
  );
}
