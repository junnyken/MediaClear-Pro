/**
 * Ten dinh dang cho NGUOI DOC.
 *
 * Man hinh truoc day hien thang chuoi may (`image/jpeg, video/quicktime`) va mot nhan `MIME`.
 * Ca hai deu la thu chi co nghia voi lap trinh vien: nguoi dung khong biet `video/quicktime` la
 * tep `.mov` cua iPhone, va cang khong biet `MIME` nghia la gi.
 *
 * Khong xuat hien chuoi nao lot ra ngoai bang nay: gia tri la se hien phan duoi dau `/` viet hoa,
 * van con doc duoc, thay vi de nguyen ca chuoi may.
 */
const TEN_DINH_DANG: Readonly<Record<string, string>> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'video/mp4': 'MP4',
  'video/quicktime': 'MOV',
  'video/webm': 'WebM',
};

export function friendlyType(mimeType: string): string {
  const ten = TEN_DINH_DANG[mimeType];
  if (ten) return ten;
  const sau = mimeType.split('/')[1] ?? mimeType;
  return sau.toUpperCase();
}

/** Bo trung: `image/jpeg` va `image/jpg` cung ra `JPG`, khong liet ke hai lan. */
export function friendlyTypeList(mimeTypes: readonly string[]): string {
  return [...new Set(mimeTypes.map(friendlyType))].join(', ');
}
