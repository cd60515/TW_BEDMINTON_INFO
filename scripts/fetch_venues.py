"""從教育部體育署「全國運動場館資訊網 iPlay」開放 API 匯入全台羽球場館。

資料來源：https://iplay.sports.gov.tw/WebAPI （政府開放資料）
輸出：web/data/v1/venues/<city-slug>.json 與 venues/index.json
執行失敗的縣市會保留舊資料，不會清空（避免 API 暫時異常把資料洗掉）。
"""
import json, os, re, sys, time, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import CITIES, CITY_SLUG, get, load, save, now_iso, today

API = "https://iplay.sports.gov.tw/api/GymSearchAllList"
DETAIL = "https://iplay.sports.gov.tw/odata/Gym({})"
DISTRICT_RE = re.compile(r"^(?:臺|台)?.{1,3}?[市縣](.{1,4}?[區鄉鎮市])")
OPEN = {"E": "全天開放", "W": "平日開放", "H": "假日開放", "N": "不開放", "S": "特定時段開放"}


def kind_of(attr, name):
    if "運動中心" in name or "國民運動中心" in (attr or ""):
        return "sports-center"
    if any(k in name for k in ("國小", "國中", "高中", "高級中學", "大學", "學院", "科大", "學校", "高工", "高商", "高職", "完全中學")):
        return "school"
    if "公園" in (attr or "") or "公園" in name:
        return "park"
    if "民營" in (attr or ""):
        return "private"
    return "public"


def fetch_city(city):
    raw = get(API, {"$format": "application/json;odata.metadata=none", "City": city}, timeout=90)
    data = json.loads(raw)
    rows = data["value"] if isinstance(data, dict) else data
    out = []
    for r in rows:
        funcs = r.get("GymFuncList") or ""
        # 設施清單去重並去掉樓層前綴，例如「4F綜合球場-籃球場」→「籃球場」
        seen = []
        for t in re.split(r"[,，、]", funcs):
            t = re.sub(r"^.*-", "", re.sub(r"^\w?\d+F", "", t.strip()))
            if t and t not in seen:
                seen.append(t)
        funcs = "、".join(seen)
        if "羽球" not in funcs:
            continue
        lat = lng = None
        if r.get("LatLng") and "," in r["LatLng"]:
            try:
                lat, lng = [round(float(x), 6) for x in r["LatLng"].split(",")[:2]]
            except ValueError:
                pass
            # 來源資料偶有經緯度顛倒或錯誤，超出台澎金馬範圍就清掉（改用地址導航）
            if lat is not None and not (21.5 < lat < 26.5 and 118 < lng < 122.5):
                if 21.5 < lng < 26.5 and 118 < lat < 122.5:
                    lat, lng = lng, lat
                else:
                    lat = lng = None
        addr = re.sub(r"\s+", "", r.get("Address") or "")
        m = DISTRICT_RE.match(addr)
        out.append({
            "id": f"iplay-{r['GymID']}",
            "name": (r.get("Name") or "").strip(),
            "city": city,
            "district": m.group(1) if m else "",
            "address": addr,
            "tel": (r.get("OperationTel") or "").strip(),
            "lat": lat, "lng": lng,
            "kind": kind_of(r.get("LandAttrName"), r.get("Name") or ""),
            "rent": (r.get("RentState") or "").replace("對外場地租借", "").replace("不開放", "不開放租借") or "未提供",
            "open": OPEN.get(r.get("OpenState"), r.get("OpenState") or ""),
            "rate": r.get("Rate") or 0, "rateCount": r.get("RateCount") or 0,
            "facilities": funcs,
            "photo": r.get("Photo1") or "",
            "source": f"https://iplay.sports.gov.tw/GymInfo/Index/{r['GymID']}",
        })
    return out


def enrich(v):
    """運動中心類補抓官網網址（逐筆呼叫明細 API）。"""
    try:
        d = json.loads(get(DETAIL.format(v["id"].split("-")[1]), {"$format": "application/json;odata.metadata=none"}, timeout=30))
        url = (d.get("WebUrl") or "").strip()
        if url.startswith("http"):
            v["website"] = url
    except Exception:
        pass
    return v


def main():
    old_index = load("venues/index.json", {"cities": {}})
    index = {"source": "教育部體育署 全國運動場館資訊網 iPlay", "sourceUrl": "https://iplay.sports.gov.tw/", "cities": {}}
    failed = []
    for city in CITIES:
        slug = CITY_SLUG[city]
        try:
            rows = fetch_city(city)
            prev = {v["id"]: v for v in (load(f"venues/{slug}.json", {}) or {}).get("items", [])}
            todo = []
            for v in rows:
                if v["id"] in prev and prev[v["id"]].get("website"):
                    v["website"] = prev[v["id"]]["website"]
                elif v["kind"] in ("sports-center", "private") or (v["kind"] == "public" and v["rent"] == "付費"):
                    todo.append(v)
            with cf.ThreadPoolExecutor(6) as ex:
                list(ex.map(enrich, todo))
            # 運動中心排前面，其次付費可租借，再依名稱
            order = {"sports-center": 0, "private": 1, "public": 2, "park": 3, "school": 4}
            rows.sort(key=lambda v: (order[v["kind"]], v["rent"] != "付費", v["district"], v["name"]))
            save(f"venues/{slug}.json", {"city": city, "updatedAt": now_iso(), "items": rows}, compact=True)
            index["cities"][city] = {"slug": slug, "count": len(rows), "updatedAt": today()}
            print(f"{city}: {len(rows)}")
        except Exception as e:
            failed.append(city)
            if city in old_index.get("cities", {}):
                index["cities"][city] = old_index["cities"][city]
            print(f"{city}: FAILED {e}", file=sys.stderr)
        time.sleep(0.5)
    index["updatedAt"] = now_iso()
    index["total"] = sum(c["count"] for c in index["cities"].values())
    save("venues/index.json", index)
    if failed:
        print("failed:", failed, file=sys.stderr)
    if len(failed) == len(CITIES):
        sys.exit(1)


if __name__ == "__main__":
    main()
