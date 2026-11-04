"""產生資料 API 的索引與衍生檔案。

- venues/all.json：全台場館精簡版（給列表、搜尋、附近場館使用）
- manifest.json：每個資料檔的更新時間、筆數、SHA-256（App 端可據此判斷是否需要重新下載）
每次更新資料後都要執行（GitHub Actions 會自動執行）。
"""
import hashlib, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import DATA, CITY_SLUG, load, save, now_iso

KEEP = ("id", "name", "city", "district", "address", "tel", "lat", "lng", "kind", "rent", "open", "website")


def sha(p):
    with open(p, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:16]


def main():
    items = []
    for city, slug in CITY_SLUG.items():
        d = load(f"venues/{slug}.json", {"items": []})
        items += [{k: v[k] for k in KEEP if v.get(k) not in (None, "")} for v in d["items"]]
    # 社群提交的民營球館（政府資料未收錄）
    for v in load("community_venues.json", {"items": []})["items"]:
        items.append({**{k: v[k] for k in KEEP if v.get(k) not in (None, "")}, "community": True})
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
    alias = {"iplay": vi.get("updatedAt"), "ptt": files.get("ptt.json", {}).get("updatedAt"),
             "youtube": files.get("videos.json", {}).get("updatedAt"), "community": files.get("groups.json", {}).get("updatedAt"),
             "editorial": files.get("lessons.json", {}).get("updatedAt")}
    for k, v in alias.items():
        files[k] = {"updatedAt": v}
    save("manifest.json", {
        "apiVersion": "v1", "generatedAt": now_iso(),
        "counts": {"venues": len(items), "videos": len(load("videos.json", {"items": []})["items"]),
                   "lessons": len(load("lessons.json", {"items": []})["items"]),
                   "groups": len(load("groups.json", {"items": []})["items"]), "ptt": len(load("ptt.json", {"items": []})["items"])},
        "links": {"total": len(states), "ok": states.count("ok"), "restricted": states.count("restricted"), "broken": states.count("broken"), "checkedAt": ls.get("checkedAt")},
        "files": files,
    })
    print("venues", len(items), "files", len(files))


if __name__ == "__main__":
    main()
