/**
 * CONG CHAN MOI TRUONG — chan kieu hong "78 phep kiem bi bo qua IM LANG ma ca bo van xanh".
 *
 * BOI CANH THAT (2026-09-18): sau mot lan phien khoi dong lai, workspace mat `ffmpeg` VA toan bo
 * font. Ket qua chay la `761 passed | 78 skipped` — nhin luot qua gan nhu khong khac `840 passed`.
 * Bo test van bao XANH trong khi mot phan ba so phep kiem ve media khong he chay.
 *
 * Do khong phai loi cua `skipIf`: bo qua khi thieu cong cu la dung, vi nguoi phat trien tren may
 * khong co ffmpeg van can chay duoc phan con lai. Loi la o cho su bo qua do KHONG PHAT RA TIN HIEU NAO.
 *
 * Tep nay lam dung mot viec: bien su im lang thanh mot dong chu, va — khi duoc yeu cau — thanh mot
 * phep kiem DO.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { ffmpegAvailable } from '../src/media/ffmpeg.js';

const run = promisify(execFile);

/**
 * `1` = moi truong PHAI day du, thieu mot thu la DO.
 *
 * Mac dinh TAT: mot nguoi vua clone ve, chua cai ffmpeg, van phai chay duoc phan con lai cua bo
 * test. Bat len o CI va o bat ky luot chay nao duoc dung de KET LUAN ("da xong", "da kiem chung").
 */
const BAT_BUOC = process.env.MEDIACLEAR_REQUIRE_FULL_ENV === '1';

/** Co ve duoc chu khong. KHONG hoi "co font khong" — do la mot cau hoi khac. */
async function veDuocChu(): Promise<boolean> {
  const band = (noiDung: string): Buffer => Buffer.from(
    `<svg width="160" height="40" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="160" height="40" fill="#000"/>` +
    `<text x="4" y="26" font-family="sans-serif" font-size="18" fill="#fff">${noiDung}</text></svg>`,
  );
  try {
    const [coChu, khongChu] = await Promise.all([
      sharp(band('Kiem tra')).png().toBuffer(),
      sharp(band('')).png().toBuffer(),
    ]);
    /*
     * So BYTE, khong dem font. Font co the co mat ma van khong ve duoc chu Viet co dau; dieu duy
     * nhat dang tin la doi chieu pixel — dung phep do ma `D-077` dung trong ma san pham.
     */
    return !coChu.equals(khongChu);
  } catch {
    return false;
  }
}

async function coFfprobe(): Promise<boolean> {
  try {
    await run('ffprobe', ['-version'], { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

interface MoiTruong {
  ffmpeg: boolean;
  ffprobe: boolean;
  veDuocChu: boolean;
  coSoDuLieuTest: boolean;
}

async function doMoiTruong(): Promise<MoiTruong> {
  const [ffmpeg, ffprobe, chu] = await Promise.all([ffmpegAvailable(), coFfprobe(), veDuocChu()]);
  return {
    ffmpeg,
    ffprobe,
    veDuocChu: chu,
    coSoDuLieuTest: Boolean(process.env.MEDIACLEAR_TEST_DATABASE_URL),
  };
}

const THIEU_GI = (m: MoiTruong): string[] => [
  ...(m.ffmpeg ? [] : ['ffmpeg']),
  ...(m.ffprobe ? [] : ['ffprobe']),
  ...(m.veDuocChu ? [] : ['font (khong ve duoc chu)']),
  ...(m.coSoDuLieuTest ? [] : ['MEDIACLEAR_TEST_DATABASE_URL']),
];

describe('Cong chan moi truong', () => {
  /*
   * LUON chay, LUON xanh. Viec cua no la IN RA — de mot lan chay thieu cong cu khong con trong
   * giong het mot lan chay day du.
   */
  it('bao cao nhung gi moi truong nay CO va KHONG co', async () => {
    const m = await doMoiTruong();
    const thieu = THIEU_GI(m);
    if (thieu.length === 0) {
      console.log('[moi truong] DAY DU — moi phep kiem deu chay duoc.');
    } else {
      console.log(
        `[moi truong] THIEU: ${thieu.join(', ')}\n` +
        '[moi truong] => mot so phep kiem se BI BO QUA. "passed" it di KHONG phai la "khong co loi".\n' +
        '[moi truong] Sua: bash scripts/dev-setup.sh   ·   Bat cong chan: MEDIACLEAR_REQUIRE_FULL_ENV=1',
      );
    }
    expect(Array.isArray(thieu)).toBe(true);
  });

  /*
   * Chi chay khi duoc yeu cau. Day la cong chan that: mot luot chay duoc dung de KET LUAN ma thieu
   * cong cu thi phai DO, khong duoc xanh voi it phep kiem hon.
   */
  describe.runIf(BAT_BUOC)('MEDIACLEAR_REQUIRE_FULL_ENV=1 — moi truong phai DAY DU', () => {
    it('khong thieu cong cu nao', async () => {
      const m = await doMoiTruong();
      expect(
        THIEU_GI(m),
        'moi truong thieu cong cu => mot so phep kiem se bi bo qua va bo test se XANH GIA',
      ).toEqual([]);
    });
  });
});
