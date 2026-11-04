"""資料檔格式檢查（PR 與排程更新前執行）。失敗時 exit 1，阻止錯誤資料上線。"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CITIES, CITY_SLUG, load

errors = []


def need(cond, msg):
    if not cond:
        errors.append(msg)


def url(u):
    return not u or re.match(r"^https?://", u)


lessons = load("lessons.json")
cats = {c["id"] for c in lessons["categories"]}
ids = set()
for l in lessons["items"]:
    need(l["id"] not in ids, f"lesson 重複 id {l['id']}"); ids.add(l["id"])
    need(l["category"] in cats, f"lesson {l['id']} 分類錯誤")
    need(l["level"] in lessons["levels"], f"lesson {l['id']} 程度錯誤")
    need(l.get("steps"), f"lesson {l['id']} 缺少步驟")

videos = load("videos.json")
vids = set()
for v in videos["items"]:
    need(re.match(r"^[\w-]{11}$", v["id"]), f"影片 id 格式錯誤 {v['id']}")
    need(v["id"] not in vids, f"影片重複 {v['id']}"); vids.add(v["id"])
    need(v["topic"] in videos["topics"], f"影片 {v['id']} 主題錯誤")

gear = load("gear.json")
for b in gear["brands"] + gear["buy"]:
    need(url(b["url"]), f"球具連結錯誤 {b['name']}")

for g in load("groups.json")["items"]:
    need(g.get("city") in CITIES, f"零打團 {g.get('id')} 縣市錯誤")
    need(str(g.get("contact", "")).startswith("https://"), f"零打團 {g.get('id')} 聯絡網址需 https")
    need(re.match(r"^\d{4}-\d{2}-\d{2}$", g.get("confirmedAt", "")), f"零打團 {g.get('id')} confirmedAt 格式錯誤")

total = 0
for city, slug in CITY_SLUG.items():
    d = load(f"venues/{slug}.json")
    need(d is not None, f"缺少 venues/{slug}.json")
    for v in (d or {}).get("items", []):
        total += 1
        need(v["city"] == city, f"場館 {v['id']} 縣市不符")
        need(v.get("name"), f"場館 {v['id']} 缺名稱")
        need(url(v.get("website", "")), f"場館 {v['id']} 官網格式錯誤")
        if v.get("lat") is not None:
            need(21.5 < v["lat"] < 26.5 and 118 < v["lng"] < 122.5, f"場館 {v['id']} 座標超出台灣範圍")
need(total > 500, f"場館總數異常偏少（{total}），疑似來源 API 故障")

if errors:
    print("\n".join(errors[:100]))
    print(f"FAILED: {len(errors)} errors")
    sys.exit(1)
print(f"OK: {len(ids)} lessons, {len(vids)} videos, {total} venues")
