"""Overture Maps Places（開放地圖商家資料）— 台灣羽球相關地點。

Overture Maps Foundation（Meta、Microsoft、Amazon、TomTom 等共同維護）每月釋出全球商家／地點資料，
台灣的羽球館多半來自 Facebook 粉絲專頁的商家資訊（電話、粉專、預約連結），涵蓋度接近 Google 地圖。
授權：CDLA Permissive 2.0（可自由使用，需標示「© Overture Maps Foundation」）。
https://docs.overturemaps.org/guides/places/

需要 duckdb（pip install duckdb）。直接以 HTTP 讀取 S3 上的 GeoParquet，只下載台灣範圍的資料列。
"""
import json, re, sys, time
from common import get

BBOX = (118.1, 21.8, 122.1, 26.4)
BUCKET = "s3://overturemaps-us-west-2/release"
NOMINATIM_REV = "https://nominatim.openstreetmap.org/reverse"

PUBLIC = re.compile(r"國小|國中|高中|大學|科大|運動中心|公園|國民|體育館$|區公所|活動中心")
COACH = re.compile(r"教學|學堂|訓練班|教室|兒童|學苑|培訓|教練|學院")
TEAM = re.compile(r"隊|協會|委員會|聯誼|俱樂部|聯盟")
SHOP = re.compile(r"專賣|用品|穿線|展售|工作室|概念店|體育社|運動器材|球拍|販賣")
HALL = re.compile(r"館|舘|會館|球場|球埸|運動場|羽球中心|24h|24H|24小時")
NOISE = re.compile(r"運彩|按摩|農產|批發|咖啡")
CJK_ROAD = re.compile(r"[一-鿿]+(路|街|大道|段|巷)")


def classify(name, cat, conf):
    """回傳 hall（球館）/ shop（球具店）/ club（俱樂部、球隊、教學）/ None（略過）"""
    if (conf or 0) < 0.45 or NOISE.search(name) or PUBLIC.search(name):
        return None
    if HALL.search(name) and not (cat == "sporting_goods_store" and not re.search("館|球場", name)):
        return "hall"
    if cat == "sporting_goods_store" or SHOP.search(name):
        return "shop"
    if COACH.search(name) or TEAM.search(name) or cat in ("fitness_trainer", "sport_league", "amateur_sport_team", "school_sport_team"):
        return "club"
    if cat in ("badminton_court", "stadium_arena", "gym", "sport_or_fitness_facility", "sports_and_recreation"):
        return "hall"
    return None


def latest_release(con):
    rows = con.sql(f"SELECT DISTINCT regexp_extract(file, 'release/([^/]+)/', 1) r FROM glob('{BUCKET}/*/theme=places/type=place/*') ORDER BY r DESC LIMIT 1").fetchall()
    return rows[0][0]


def query():
    import duckdb  # 只有這個來源需要，其他腳本不受影響
    con = duckdb.connect()
    con.sql("INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';")
    rel = latest_release(con)
    x0, y0, x1, y1 = BBOX
    r = con.sql(f"""
      SELECT id, names.primary AS name, taxonomy.primary AS cat, confidence,
             addresses[1].freeform AS addr, addresses[1].locality AS loc, websites[1] AS web, socials[1] AS social, phones[1] AS phone,
             (bbox.ymin + bbox.ymax) / 2 AS lat, (bbox.xmin + bbox.xmax) / 2 AS lng
      FROM read_parquet('{BUCKET}/{rel}/theme=places/type=place/*', hive_partitioning=1)
      WHERE bbox.xmin BETWEEN {x0} AND {x1} AND bbox.ymin BETWEEN {y0} AND {y1}
        AND (names.primary ILIKE '%羽球%' OR names.primary ILIKE '%羽毛球%' OR names.primary ILIKE '%badminton%'
             OR taxonomy.primary ILIKE '%badminton%' OR list_contains(taxonomy.alternates, 'badminton_court'))""")
    cols = r.columns
    return rel, [dict(zip(cols, row)) for row in r.fetchall()]


def reverse(lat, lng):
    """Nominatim 反查中文縣市、行政區、路名（每秒最多 1 次）。"""
    try:
        d = json.loads(get(NOMINATIM_REV, {"lat": lat, "lon": lng, "format": "json", "accept-language": "zh-TW", "zoom": 17}, timeout=30))
        time.sleep(1.1)
        a = d.get("address", {})
        city = (a.get("city") or a.get("county") or a.get("state") or "").replace("台", "臺")
        dist = a.get("suburb") or a.get("city_district") or a.get("town") or a.get("village") or ""
        return {"city": city, "district": dist if re.search(r"[區鄉鎮市]$", dist) else "", "road": a.get("road", "")}
    except Exception as e:
        print("reverse", lat, lng, e, file=sys.stderr)
        return None


def pretty_address(freeform, rev):
    """Overture 地址常是中英混合（No. 24-52號, Gaofeng Rd），盡量轉成中文地址。"""
    f = (freeform or "").strip()
    city, dist = (rev or {}).get("city", ""), (rev or {}).get("district", "")
    base = city + dist
    if CJK_ROAD.search(f):
        rest = re.sub(r"^\d{3,6}", "", f).replace("台", "臺")
        for part in (city, dist):  # 去掉重複的縣市、行政區，再統一補上
            if part and rest.startswith(part):
                rest = rest[len(part):]
        return base + rest
    num = re.search(r"(?:No\.\s*)?([\d\-之]+號(?:\d+樓)?)", f)
    lane = re.search(r"Lane\s*(\d+)", f)
    road = (rev or {}).get("road", "")
    if road:
        return base + road + (f"{lane.group(1)}巷" if lane else "") + (num.group(1) if num else "")
    return base


def phone(p):
    if not p:
        return ""
    p = re.sub(r"[\s-]", "", p)
    return "0" + p[4:] if p.startswith("+886") else p
