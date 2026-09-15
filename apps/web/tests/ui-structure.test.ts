/**
 * Chan tai dien hai lop loi UI da tim thay khi BAM TAY tren trinh duyet
 * (test truoc do khong bat duoc vi khong co test cho web):
 *
 *  1. <Button> long trong <Link>: HTML khong hop le (long hai phan tu tuong tac),
 *     thuc te co nut bam vao khong dieu huong di dau ca.
 *  2. Chuoi hien thi go thang vao JSX thay vi di qua translation key
 *     => se khong bao gio dich duoc sang 'en' va lech voi ban tieng Viet do BA duyet.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = join(import.meta.dirname, '../app');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const FILES = tsxFiles(APP_DIR);

describe('cau truc UI', () => {
  it('co man hinh de kiem', () => {
    expect(FILES.length).toBeGreaterThan(10);
  });

  it('khong long <Button> ben trong <Link> (HTML khong hop le, bam khong di)', () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');
      if (/<Link[^>]*>\s*(\{[^}]*\}\s*)?<Button/s.test(source)) {
        offenders.push(file.replace(APP_DIR, 'app'));
      }
    }
    expect(offenders, 'dung <LinkButton> thay vi long <Button> trong <Link>').toEqual([]);
  });

  it('khong go thang chuoi tieng Viet vao JSX (phai di qua translate)', () => {
    // Chu co dau tieng Viet nam giua hai the JSX, vd: <p>Xin chào</p>
    const vietnameseInJsx = />[^<>{}\n]*[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỸỴĐ][^<>{}\n]*</u;
    const offenders: string[] = [];
    for (const file of FILES) {
      const source = readFileSync(file, 'utf8');
      // Bo qua comment: chi soi phan JSX.
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      if (vietnameseInJsx.test(withoutComments)) offenders.push(file.replace(APP_DIR, 'app'));
    }
    expect(offenders, 'chuoi hien thi phai qua translate(key)').toEqual([]);
  });

  it('moi man hinh deu xu ly trang thai dang tai va loi', () => {
    const pages = FILES.filter((f) => f.endsWith('page.tsx') && !f.includes('workspace/') && !f.includes('provenance') && !f.includes('rights/') && !f.includes('upload-validation'));
    const missing: string[] = [];
    for (const file of pages) {
      const source = readFileSync(file, 'utf8');
      const isStatic = !source.includes('useResource') && !source.includes('apiFetch');
      if (isStatic) continue;
      if (!source.includes('Loading') || !(source.includes('ErrorNotice') || source.includes('setError'))) {
        missing.push(file.replace(APP_DIR, 'app'));
      }
    }
    expect(missing, 'man hinh goi API phai co trang thai dang tai va bao loi').toEqual([]);
  });
});
