#!/usr/bin/env python3
"""
map-vocab-to-3d.py — khớp danh sách từ vựng với bộ asset 3D Fluent Emoji.

Cách dùng:
    python3 map-vocab-to-3d.py words.json > vocab-3d-map.json

words.json: mảng string, hoặc mảng object có khoá "word" (và tuỳ chọn "pos", "topic").
    ["spider", "apple", "abstraction", ...]
    [{"word":"spider","pos":"noun","topic":"animals"}, ...]

Đầu ra: { "spider": {"asset":"spider","score":100,"policy":"art3d"}, ... }

policy:
  art3d       — có asset 3D khớp tốt, dùng ảnh 3D
  typographic — không có asset phù hợp, dùng thẻ chữ (xem plan mục 8)
"""
import json, sys, re, os

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, '3d-manifest.json')

# Từ loại/ngữ nghĩa KHÔNG bao giờ gán ảnh, kể cả khi khớp chuỗi.
# Ảnh cho từ trừu tượng luôn gây nhiễu hơn là giúp.
POS_BLOCK = {'preposition', 'conjunction', 'pronoun', 'determiner', 'article',
             'auxiliary', 'particle', 'giới từ', 'liên từ', 'đại từ', 'mạo từ'}

# Chủ đề nhạy cảm — không gán ảnh dù khớp
SENSITIVE = {'abortion', 'abuse', 'addiction', 'suicide', 'rape', 'murder',
             'weapon', 'gun', 'bomb', 'knife', 'drug', 'cigarette', 'alcohol'}

# Hậu tố báo hiệu từ trừu tượng — hạ điểm mạnh
ABSTRACT_SUFFIX = ('tion', 'sion', 'ness', 'ment', 'ity', 'ance', 'ence',
                   'ism', 'ship', 'hood', 'ology', 'ability')


def norm(w):
    return re.sub(r'[^a-z ]', '', str(w).lower().strip())


def singular(w):
    for a, b in (('ies', 'y'), ('ses', 's'), ('es', ''), ('s', '')):
        if w.endswith(a) and len(w) > len(a) + 2:
            return w[:-len(a)] + b
    return w


def build_lookup(manifest):
    """keyword -> [slug], ưu tiên slug có tên ngắn nhất (ít bổ ngữ nhất)."""
    inv = {}
    for slug, v in manifest.items():
        for k in v['keys']:
            inv.setdefault(k, []).append(slug)
    for k in inv:
        inv[k].sort(key=lambda s: (len(manifest[s]['name']), s))
    return inv


def match(word, pos, manifest, inv):
    w = norm(word)
    if not w:
        return None, 0
    if pos and str(pos).lower() in POS_BLOCK:
        return None, 0
    if w in SENSITIVE:
        return None, 0
    if w.endswith(ABSTRACT_SUFFIX):
        return None, 0

    # 1. khớp slug chính xác
    if w.replace(' ', '-') in manifest:
        return w.replace(' ', '-'), 100
    # 2. khớp keyword chính xác
    if w in inv:
        return inv[w][0], 95
    # 3. khớp dạng số ít
    s = singular(w)
    if s != w:
        if s.replace(' ', '-') in manifest:
            return s.replace(' ', '-'), 90
        if s in inv:
            return inv[s][0], 85
    # 4. khớp tên đầy đủ chứa từ, chỉ nhận khi tên ≤ 2 chữ (tránh "face with ...")
    for slug, v in manifest.items():
        parts = v['name'].split()
        if len(parts) <= 2 and w in parts:
            return slug, 70
    return None, 0


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    manifest = json.load(open(MANIFEST, encoding='utf-8'))
    inv = build_lookup(manifest)
    data = json.load(open(sys.argv[1], encoding='utf-8'))

    out, hit = {}, 0
    for item in data:
        if isinstance(item, str):
            word, pos = item, None
        else:
            word, pos = item.get('word'), item.get('pos')
        slug, score = match(word, pos, manifest, inv)
        if slug:
            hit += 1
            out[word] = {'asset': slug, 'score': score, 'policy': 'art3d'}
        else:
            out[word] = {'asset': None, 'score': 0, 'policy': 'typographic'}

    n = len(data)
    print(json.dumps(out, ensure_ascii=False, indent=1))
    sys.stderr.write(f'\nKhớp {hit}/{n} = {100*hit//max(n,1)}% dùng ảnh 3D, '
                     f'{n-hit} từ dùng thẻ chữ\n')


if __name__ == '__main__':
    main()
