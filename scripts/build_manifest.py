"""產生資料 API 的索引與衍生檔案。

- venues/all.json：全台場館精簡版（給列表、搜尋、附近場館使用）
- manifest.json：每個資料檔的更新時間、筆數、SHA-256（App 端可據此判斷是否需要重新下載）
每次更新資料後都要執行（GitHub Actions 會自動執行）。
"""
import hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, CITY_SLUG, load, save, now_iso

KEEP = ("id", "name", "city", "district", "address", "tel", "lat", "lng", "kind", "rent", "open", "website")
EXTRA = ("note", "source", "sourceName", "verified", "approx", "facilities")  # 非 iPlay 來源沒有縣市檔，詳細欄位一併放進 all.json


def sha(p):
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def main():
    items = []
    for city, slug in CITY_SLUG.items():
        d = load(f"venues/{slug}.json", {"items": []})
        items += [{k: v[k] for k in KEEP if v.get(k) not in (None, "")} for v in d["items"]]
    # 民營球館（OpenStreetMap＋網路整理）與社群投稿（政府資料未收錄）
    for name, extra in (("private_venues.json", {}), ("community_venues.json", {"sourceName": "社群投稿"})):
        for v in load(name, {"items": []})["items"]:
            items.append({**{k: v[k] for k in KEEP + EXTRA if v.get(k) not in (None, "")}, **extra})
    save("venues/all.json", {"generatedAt": now_iso(), "slugs": CITY_SLUG, "items": items}, compact=True)

    ls = load("link_status.json", {"urls": {}})
    states = [v.get("s") for v in ls.get("urls", {}).values()]
    files = {}
    for name in sorted(os.listdir(DATA)) + ["venues/index.json", "venues/all.json"]:
        p = os.path.join(DATA, name)
        if not name.endswith(".json") or name == "manifest.json" or not os.path.isfile(p):
            continue
        d = load(name, {})
        files[name] = {"sha": sha(p), "bytes": os.path.getsize(p), "updatedAt": d.get("updatedAt") or d.get("generatedAt") or d.get("checkedAt"),
                       "count": len(d.get("items", [])) if isinstance(d.get("items"), list) else None}
    vi = load("venues/index.json", {})
    alias = {"iplay": vi.get("updatedAt"), "osm": files.get("private_venues.json", {}).get("updatedAt"), "overture": files.get("private_venues.json", {}).get("updatedAt"), "far": files.get("pickups.json", {}).get("updatedAt"), "grass": files.get("pickups.json", {}).get("updatedAt"), "line": files.get("line_groups.json", {}).get("updatedAt"), "threads": files.get("threads.json", {}).get("updatedAt"), "ptt": files.get("ptt.json", {}).get("updatedAt"),
             "youtube": files.get("videos.json", {}).get("updatedAt"), "community": files.get("groups.json", {}).get("updatedAt"),
             "editorial": files.get("lessons.json", {}).get("updatedAt")}
    for k, v in alias.items():
        files[k] = {"updatedAt": v}
    save("manifest.json", {
        "apiVersion": "v1", "generatedAt": now_iso(),
        "counts": {"venues": len(items), "videos": len(load("videos.json", {"items": []})["items"]),
                   "lessons": len(load("lessons.json", {"items": []})["items"]),
                   "private": len(load("private_venues.json", {"items": []})["items"]),
                   "shops": len(load("shops_auto.json", {"items": []})["items"]) + len(load("shops.json", {"items": []})["items"]),
                   "clubs": len(load("clubs.json", {"items": []})["items"]),
                   "pickups": len(load("pickups.json", {"items": []})["items"]),
                   "lineGroups": len(load("line_groups.json", {"items": []})["items"]),
                   "threads": len(load("threads.json", {"items": []})["items"]),
                   "groups": len(load("groups.json", {"items": []})["items"]), "ptt": len(load("ptt.json", {"items": []})["items"])},
        "links": {"total": len(states), "ok": states.count("ok"), "restricted": states.count("restricted"), "broken": states.count("broken"), "checkedAt": ls.get("checkedAt")},
        "files": files,
    })
    print("venues", len(items), "files", len(files))


if __name__ == "__main__":
    main()
