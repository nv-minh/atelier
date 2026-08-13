// Rival names. Vietnamese given names only — the audience is Vietnamese and a
// mixed pool read as generated. Hand-written rather than syllable-generated:
// assembled syllables produce names that are subtly wrong to a native reader.
export const PERSONA_NAMES: readonly string[] = [
  "Thu Hà", "Minh Quân", "Duy Anh", "Như Ý", "Khánh Ly",
  "Bảo Châu", "Gia Hân", "Tuấn Kiệt", "Ngọc Diệp", "Hoàng Long",
  "Phương Uyên", "Đức Huy", "Thanh Trúc", "Quốc Bảo", "Mai Chi",
  "Hữu Nghĩa", "Lan Anh", "Trung Hiếu", "Thuỳ Dương", "Đăng Khoa",
  "Hải Yến", "Nhật Minh", "Kim Ngân", "Anh Tuấn", "Bích Ngọc",
  "Xuân Bách", "Diệu Linh", "Thành Đạt", "Yến Nhi", "Văn Hậu",
  "Hồng Nhung", "Tiến Dũng", "Thảo Vy", "Quang Vinh", "Ngọc Ánh",
  "Bá Lộc", "Tường Vi", "Chí Thành", "Hà My", "Sơn Tùng",
  "Phương Thảo", "Nam Khánh", "Trà My", "Đình Trọng", "Khánh Huyền",
  "Việt Anh", "Thu Thảo", "Hoài Nam", "Mỹ Duyên", "Trọng Nhân",
  "Kiều Trinh", "Hữu Phước", "Quỳnh Chi", "Đại Nghĩa", "Vân Khánh",
  "Bảo Long", "Tố Uyên", "Công Minh", "Hạ Vy", "Phú Quý",
];

// Avatar tint classes. The cefr.* and moss.* keys are plain hex values in
// tailwind.config.ts, so the /12 opacity form compiles fine. Do NOT swap these
// for a bare `bg-<token>` on a DEFAULT-keyed color without checking the
// DEFAULT-key note in tailwind.config.ts.
export const AVATAR_COLORS: readonly string[] = [
  "bg-cefr-a1/12 text-cefr-a1",
  "bg-cefr-a2/12 text-cefr-a2",
  "bg-cefr-b1/12 text-cefr-b1",
  "bg-cefr-b2/12 text-cefr-b2",
  "bg-cefr-c1/12 text-cefr-c1",
  "bg-moss-500/12 text-moss-500",
];
