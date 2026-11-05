"""自動同步民營／私人羽球館（政府 iPlay 資料幾乎沒有收錄這類球館）。

來源 A（自動、每週）：OpenStreetMap Overpass API — 全台標記為羽球（sport=badminton）或名稱含「羽球」的場所
來源 B（人工整理）：scripts/private_seeds.json — 網路搜尋整理的球館，由 Nominatim 自動定位
來源 C（社群投稿）：community_venues.json（由 issue_intake.py 寫入，build_manifest.py 合併）

處理：過濾學校/公有場館與泛稱（如「羽球場」）→ 以最近的 iPlay 場館推定縣市與行政區 → 與 iPlay 去重
輸出：web/data/v1/private_venues.json；任一來源失敗時保留上一版該來源的資料。
"""
import hashlib, json, math, os, re, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, CITY_SLUG, get, load, save, now_iso, today

OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
NOMINATIM = "https://nominatim.openstreetmap.org/search"
QUERY = """[out:json][timeout:150];
(nwr["sport"~"badminton"](21.8,118.1,26.4,122.1);
 nwr["name"~"羽球|羽毛球"](21.8,118.1,26.4,122.1););
out center tags;"""
GENERIC = re.compile(r"^(室內|戶外|室外|\dF|2F室內|休憩空間-.{0,4})?羽(毛)?球(場|館)(\s*x\d)?$|^羽(毛)?球(場|館)?\s*[/／]")
EXCLUDE = re.compile(r"郵箱|側$|用品|國小|國中|高中|大學|學院|科大|成大|運動中心|公園|社區|活動中心|里民|國民|市立|縣立|鎮立|體育館|停車|禮堂|協會|球隊|工務段|馆")
CITY_RE = re.compile(r"(臺北市|台北市|新北市|基隆市|桃園市|新竹市|新竹縣|苗栗縣|臺中市|台中市|彰化縣|南投縣|雲林縣|嘉義市|嘉義縣|臺南市|台南市|高雄市|屏東縣|宜蘭縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)")
DIST_RE = re.compile(r"[市縣](.{1,3}?[區鄉鎮市])")


def km(a, b):
    r = math.radians
    d = math.sin(r(b[0] - a[0]) / 2) ** 2 + math.cos(r(a[0])) * math.cos(r(b[0])) * math.sin(r(b[1] - a[1]) / 2) ** 2
    return 12742 * math.asin(math.sqrt(d))


def norm(s):
    return re.sub(r"[\s（）()·．.-]|羽球|羽毛球|球館|會館|館", "", s or "")


def gov_venues():
    out = []
    for slug in CITY_SLUG.values():
        out += [v for v in load(f"venues/{slug}.json", {"items": []})["items"] if v.get("lat")]
    return out


def locate(lat, lng, gov):
    """以最近的 iPlay 場館推定縣市、行政區；離台灣場館都很遠（例如對岸）則回傳 None。"""
    best = min(gov, key=lambda v: km((lat, lng), (v["lat"], v["lng"])))
    d = km((lat, lng), (best["lat"], best["lng"]))
    return (best["city"], best["district"], d) if d < 15 else None


def is_dup(item, gov):
    """與 iPlay 重複：同縣市同名，或 80 公尺內且名稱有 2 個以上相同字。"""
    n = norm(item["name"])
    for v in gov:
        vn = norm(v["name"])
        if n and len(n) >= 2 and n == vn and v["city"] == item["city"]:
            return True
        if item.get("lat") and km((item["lat"], item["lng"]), (v["lat"], v["lng"])) < 0.08 and len(set(n) & set(vn)) >= 2:
            return True
    return False


def from_osm(gov):
    raw = None
    for ep in OVERPASS:
        try:
            raw = get(ep + "?data=" + urllib.parse.quote(QUERY), timeout=200)
            break
        except Exception as e:
            print("overpass", ep, e, file=sys.stderr)
    if raw is None:
        raise RuntimeError("Overpass 全部失敗")
    out = []
    for e in json.loads(raw)["elements"]:
        t = e.get("tags", {})
        name = (t.get("name:zh-Hant") or t.get("name") or "").strip()
        if not name or GENERIC.match(name) or EXCLUDE.search(name) or t.get("shop"):
            continue
        if "羽" not in name and "球館" not in name:
            continue  # 「中山堂」「室內籃球場」這類多用途場地不列入
        lat = e.get("lat") or e.get("center", {}).get("lat")
        lng = e.get("lon") or e.get("center", {}).get("lon")
        if not lat:
            continue
        loc = locate(lat, lng, gov)
        if not loc:
            continue
        addr_city = CITY_RE.search(t.get("addr:city", "") + t.get("addr:full", ""))
        city = addr_city.group(1).replace("台", "臺") if addr_city else loc[0]
        street = "".join(t.get(k, "") for k in ("addr:district", "addr:street", "addr:housenumber"))
        web = t.get("website") or t.get("contact:website") or t.get("contact:facebook") or ""
        out.append({
            "id": f"osm-{e['type'][0]}{e['id']}", "name": name, "city": city, "district": t.get("addr:district") or loc[1],
            "address": t.get("addr:full") or (city + street if street else ""), "tel": t.get("phone") or t.get("contact:phone") or "",
            # 橋下、戶外、文中預定地等多為免費公共球場
            "lat": round(lat, 6), "lng": round(lng, 6),
            "kind": "public" if re.search(r"橋下|室外|戶外|文中|糖廠|園羽", name) else "private",
            "rent": "免費" if re.search(r"橋下|室外|戶外|文中", name) else "付費", "open": t.get("opening_hours", ""),
            "website": web if web.startswith("http") else "", "facilities": "羽球場",
            "source": f"https://www.openstreetmap.org/{e['type']}/{e['id']}", "sourceName": "OpenStreetMap",
        })
    return out


def geocode(q):
    try:
        res = json.loads(get(NOMINATIM, {"q": q, "format": "json", "countrycodes": "tw", "limit": 1, "accept-language": "zh-TW"}, timeout=30))
        time.sleep(1.1)  # Nominatim 使用規範：每秒最多 1 次
        if res:
            return round(float(res[0]["lat"]), 6), round(float(res[0]["lon"]), 6)
    except Exception as e:
        print("geocode", q, e, file=sys.stderr)
    return None


def from_seeds(prev):
    seeds = json.load(open(os.path.join(ROOT, "scripts", "private_seeds.json"), encoding="utf-8"))["items"]
    cache = {v["name"]: v for v in prev if v.get("sourceName") == "網路整理" and v.get("lat") is not None}
    out = []
    for i, s in enumerate(seeds):
        old = cache.get(s["name"], {})
        lat, lng = old.get("lat"), old.get("lng")
        approx = old.get("approx", False)
        if lat is None:
            # Nominatim 對台灣門牌支援有限：完整地址 → 路段（概略位置） → 名稱
            hit = geocode(s["address"]) if s.get("address") else None
            if not hit and s.get("address"):
                street = re.sub(r"(\d+巷)?(\d+弄)?\d+(之\d+|-\d+)?號.*$", "", s["address"])
                if street != s["address"]:
                    hit = geocode(street)
                    approx = bool(hit)
            hit = hit or geocode(f"{s['name']} {s['city']}")
            lat, lng = hit if hit else (None, None)
        m = DIST_RE.search(s.get("address", "")) or re.search(r"(.{1,3}區)", s.get("note", ""))
        item = {"id": "web-" + hashlib.md5(s["name"].encode()).hexdigest()[:8], "name": s["name"], "city": s["city"],
                "district": m.group(1) if m else "", "address": s.get("address", ""), "tel": s.get("tel", ""),
                "lat": lat, "lng": lng, "kind": s.get("kind", "private"), "rent": "付費", "open": "",
                "website": s.get("website", ""), "facilities": "羽球場", "note": s.get("note", ""),
                "source": s.get("ref", ""), "sourceName": "網路整理", "verified": False, "approx": approx}
        out.append(item)
    return out


def from_overture(gov, prev_all):
    """來源 D：Overture Maps Places（主要來自 Facebook 商家粉專）。回傳 (球館, 球具店, 俱樂部/教學)。"""
    import overture_places as ov
    rel, rows = ov.query()
    cache = {v["id"]: v for v in prev_all if v.get("id", "").startswith("ovt-")}
    halls, shops, clubs = [], [], []
    for r in rows:
        name = re.sub(r"\s+", " ", (r["name"] or "")).strip()
        kind = ov.classify(name, r["cat"] or "", r["confidence"])
        if not kind or not r["lat"]:
            continue
        loc = locate(r["lat"], r["lng"], gov)
        if not loc:
            continue  # 離台灣場館都很遠（例如對岸）
        vid = "ovt-" + hashlib.md5(r["id"].encode()).hexdigest()[:10]
        old = cache.get(vid)
        if old and old.get("address") is not None and old.get("_rev"):
            rev = old["_rev"]
        else:
            rev = ov.reverse(r["lat"], r["lng"]) or {"city": loc[0], "district": loc[1], "road": ""}
        city = rev["city"] if rev.get("city") in CITY_SLUG else loc[0]
        web = r["web"] or r["social"] or ""
        item = {
            "id": vid, "name": name[:60], "city": city, "district": rev.get("district") or loc[1],
            "address": ov.pretty_address(r["addr"], {**rev, "city": city, "district": rev.get("district") or loc[1]}), "tel": ov.phone(r["phone"]),
            "lat": round(r["lat"], 6), "lng": round(r["lng"], 6), "website": web if web.startswith("http") else "",
            "source": "https://overturemaps.org/", "sourceName": "Overture Maps", "confidence": round(r["confidence"] or 0, 2),
            "_rev": rev,
        }
        if kind == "hall":
            item.update({"kind": "private", "rent": "付費", "open": "24 小時" if re.search(r"24\s*[hH小]", name) else "", "facilities": "羽球場"})
            halls.append(item)
        elif kind == "shop":
            item["services"] = [s for s, k in (("穿線", "穿線"), ("球拍", "拍"), ("球鞋", "鞋")) if k in name]
            shops.append(item)
        else:
            item["type"] = "教學" if ov.COACH.search(name) else "球隊／俱樂部"
            clubs.append(item)
    print(f"Overture {rel}: {len(rows)} rows → halls {len(halls)}, shops {len(shops)}, clubs {len(clubs)}")
    return halls, shops, clubs


def merge(lists, gov):
    """多來源合併：先出現的優先；同名或 100 公尺內同名字詞視為同一間，缺的欄位由後面的來源補上。"""
    out = []
    for v in (x for l in lists for x in l):
        if is_dup(v, gov):
            continue
        n = norm(v["name"])
        hit = None
        for o in out:
            on = norm(o["name"])
            if (n and n == on and o["city"] == v["city"]) or (
                    v.get("lat") and o.get("lat") and km((v["lat"], v["lng"]), (o["lat"], o["lng"])) < 0.1 and len(set(n) & set(on)) >= 2):
                hit = o
                break
        if hit:
            for k in ("tel", "website", "address", "lat", "lng", "note", "open"):
                if not hit.get(k) and v.get(k):
                    hit[k] = v[k]
            hit.setdefault("alsoIn", []).append(v["sourceName"])
        else:
            out.append(dict(v))
    order = list(CITY_SLUG)
    # 資料完整（有地址、電話）的排前面，待查證的排後面
    out.sort(key=lambda v: (order.index(v["city"]) if v["city"] in order else 99, not v.get("address"), not v.get("tel"), v.get("district", ""), v["name"]))
    return out


def main():
    prev = load("private_venues.json", {"items": []})["items"]
    prev_all = prev + load("shops_auto.json", {"items": []})["items"] + load("clubs.json", {"items": []})["items"]
    gov = gov_venues()
    failed = []
    try:
        osm = from_osm(gov)
    except Exception as e:
        failed.append("osm"); print("OSM failed:", e, file=sys.stderr)
        osm = [v for v in prev if v.get("sourceName") == "OpenStreetMap"]
    try:
        ovt_halls, ovt_shops, ovt_clubs = from_overture(gov, prev_all)
    except Exception as e:
        failed.append("overture"); print("Overture failed:", e, file=sys.stderr)
        ovt_halls = [v for v in prev if v.get("sourceName") == "Overture Maps"]
        ovt_shops = load("shops_auto.json", {"items": []})["items"]
        ovt_clubs = load("clubs.json", {"items": []})["items"]
    seeds = from_seeds(prev)
    # 優先順序：Overture（電話、粉專最完整）→ 人工整理（有備註）→ OSM
    items = merge([ovt_halls, seeds, osm], gov)
    save("private_venues.json", {"updatedAt": now_iso(), "sources": ["Overture Maps", "OpenStreetMap", "網路整理"],
                                 "attribution": "© Overture Maps Foundation（CDLA Permissive 2.0）、© OpenStreetMap contributors（ODbL）",
                                 "failed": failed, "items": items})
    save("shops_auto.json", {"updatedAt": now_iso(), "source": "Overture Maps", "items": merge([ovt_shops], [])})
    save("clubs.json", {"updatedAt": now_iso(), "source": "Overture Maps", "items": merge([ovt_clubs], [])})
    by = {}
    for v in items:
        by[v["city"]] = by.get(v["city"], 0) + 1
    print(len(items), "private venues", by, "| shops", len(ovt_shops), "| clubs", len(ovt_clubs))


if __name__ == "__main__":
    main()
