/**
 * UI Phase 5 — cac luat ma bam tay khong lap lai duoc moi lan.
 *
 * Bo test nay ra doi tu mot loi THAT tim duoc khi bam tay: man hinh lich su hien nguyen
 * `disclosure.limitation.provider_blocked` va `metadataVerdict` ra cho nguoi dung doc. Phep chan
 * i18n hien co chi quet `translate('chuoi tinh')`, nen nhan DONG nam ngoai tam nhin cua no.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@mediaclear/i18n';
import {
  DISCLOSURE_STATES, METADATA_CATEGORIES, METADATA_FIELD_STATUSES, METADATA_VERDICTS,
  BRAND_KIT_STATES, OVERLAY_POSITIONS, PROVENANCE_NODE_KINDS,
} from '@mediaclear/contracts';

const APP = join(import.meta.dirname, '../app');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) out.push(full);
  }
  return out;
}

describe('Phase 5 — khoa dich cho gia tri enum', () => {
  /*
   * Cac gia tri nay duoc dich bang KHOA DONG. Them mot gia tri vao enum ma quen ban dich se lam
   * man hinh hien nguyen khoa tho — va khong phep do nao hien co cham toi.
   */
  it('moi gia tri enum Phase 5 deu co nhan o CA HAI ngon ngu', () => {
    const bang: Array<[string, readonly string[]]> = [
      ['disclosure.state', DISCLOSURE_STATES],
      ['metadata.category', METADATA_CATEGORIES],
      ['metadata.status', METADATA_FIELD_STATUSES],
      ['metadata.verdict', METADATA_VERDICTS],
      ['brand_kit.state', BRAND_KIT_STATES],
      ['overlay.position', OVERLAY_POSITIONS],
      ['provenance.node', PROVENANCE_NODE_KINDS],
    ];
    const thieu: string[] = [];
    for (const [tienTo, values] of bang) {
      for (const v of values) {
        const key = `${tienTo}.${v}`;
        if (MESSAGES.vi[key] === undefined) thieu.push(`vi: ${key}`);
        if (MESSAGES.en[key] === undefined) thieu.push(`en: ${key}`);
      }
    }
    expect(thieu, 'man hinh se hien khoa tho thay vi cau chu').toEqual([]);
  });

  /**
   * Moi khoa gioi han do MAY CHU sinh ra deu phai co ban dich.
   *
   * Chung khong xuat hien duoi dang chuoi tinh trong `apps/web`, nen phep chan i18n ben do khong
   * thay. Day la duong chan con lai — va no doc CHINH ma may chu.
   */
  it('moi khoa `disclosure.limitation.*` trong ma may chu deu co ban dich', () => {
    const src = readFileSync(join(APP, '../../api/../../packages/contracts/src/phase5.ts'), 'utf8');
    const keys = new Set<string>();
    for (const m of src.matchAll(/'(disclosure\.limitation\.[a-z0-9_.]+)'/g)) keys.add(m[1] as string);
    expect(keys.size, 'khong tim thay khoa nao de kiem').toBeGreaterThan(0);
    const thieu = [...keys].filter((k) => MESSAGES.vi[k] === undefined || MESSAGES.en[k] === undefined);
    expect(thieu).toEqual([]);
  });

  /**
   * `D-075` — man hinh lich su phai DICH nhan va gia tri, khong in khoa tho.
   *
   * Loi that tim duoc khi bam tay: `disclosure.limitation.provider_blocked` va `provider_blocked`
   * hien nguyen van ra cho nguoi dung doc. Nguyen nhan: giao dien in thang `d.key` va `d.value`.
   */
  it('man hinh lich su khong in thang `d.key` hay `d.value` ma khong qua ban dich', () => {
    const page = readFileSync(join(APP, 'assets/[assetId]/provenance/page.tsx'), 'utf8');
    expect(page, 'nhan o so lieu phai di qua ban dich').toContain('detailLabel(d.key)');
    expect(page, 'gia tri la khoa dich phai duoc dich, khong in tho').toContain('translate(d.valueKey)');
    expect(page, 'in thang ten truong lam nhan').not.toContain('label={d.key}');
  });

  /** Mot man hinh khong co loi vao thi voi nguoi dung no khong ton tai (`D-073`). */
  it('man hinh lich su co it nhat mot lien ket tro toi, tu man hinh KHAC', () => {
    const linkers = sourceFiles(APP)
      .filter((f) => !f.includes(join('assets', '[assetId]', 'provenance')))
      .filter((f) => /\/provenance`/.test(readFileSync(f, 'utf8')))
      .map((f) => f.replace(APP, 'app'));
    expect(linkers, 'lich su cua tep khong co loi vao — nguoi dung phai go tay URL').not.toEqual([]);
  });

  it('man hinh bo nhan dien co loi vao tu thanh dieu huong', () => {
    const shell = readFileSync(join(APP, '_components/Shell.tsx'), 'utf8');
    expect(shell).toContain("'/brand-kits'");
  });
});
