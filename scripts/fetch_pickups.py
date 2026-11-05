"""零打／臨打資訊匯集（每 6 小時）。

來源（皆為公開頁面，robots.txt 允許索引；只存摘要並連回原始頁面）：
  A. 羽球臨打情報站 farreaching.com.tw/badminton — 整理羽球拼圖、FB 社團等的開團（日期、時段、場館、程度、費用、用球）
  B. GRASS grass.camp/find/{city}/badminton — 找伴揪團 App 的公開揪團（schema.org Event）
  C. LINE 社群 openchat.line.me/tw/search — 羽球相關 LINE 社群的公開介紹（名稱、成員數、介紹），不讀取群組內訊息

輸出：
  web/data/v1/pickups.json      近期開團場次（過期自動移除）
  web/data/v1/line_groups.json  LINE 羽球社群
任一來源失敗時保留上一版該來源的資料。
"""
import datetime, hashlib, json, os, re, sys, time, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import get, load, save, now_iso, TZ
from fetch_ptt import guess_city

UA = {"User-Agent": "Mozilla/5.0 (compatible; TW-Badminton-Info/1.0; +https://github.com/cd60515/TW_BEDMINTON_INFO)"}
FAR = "https://www.farreaching.com.tw/badminton/"
GRASS_CITIES = {"taipei": "臺北市", "new-taipei": "新北市", "taoyuan": "桃園市", "taichung": "臺中市", "kaohsiung": "高雄市", "taiwan": ""}
OC_SEARCH = "https://openchat.line.me/tw/search?keyword="
OC_KEYWORDS = ["羽球", "羽毛球", "羽球臨打", "羽球零打", "羽球揪團", "羽球團", "羽球館", "台北羽球", "新北羽球", "桃園羽球",
               "新竹羽球", "台中羽球", "彰化羽球", "嘉義羽球", "台南羽球", "高雄羽球", "宜蘭羽球", "花蓮羽球", "屏東羽球"]
WD = "一二三四五六日"


def nuxt_payload(html):
    m = re.search(r'<script type="application/json"[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', html, re.S)
    return json.loads(m.group(1)) if m else None


def devalue(arr):
    """解開 Nuxt 的 devalue 序列化格式（陣列＋索引參照）。"""
    memo = {}
    wrappers = ("ShallowReactive", "Reactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef", "NuxtError")

    def v(i):
        if not isinstance(i, int) or i < 0:
            return None
        if i in memo:
            return memo[i]
        x = arr[i]
        if isinstance(x, list):
            if x and isinstance(x[0], str) and x[0] in wrappers:
                memo[i] = v(x[1]) if len(x) > 1 else None
            elif x and x[0] == "Date":
                memo[i] = x[1]
            elif x and x[0] == "Set":
                memo[i] = [v(k) for k in x[1:]]
            else:
                memo[i] = []
                memo[i].extend(v(k) for k in x)
            return memo[i]
        if isinstance(x, dict):
            memo[i] = {}
            for k, j in x.items():
                memo[i][k] = v(j)
            return memo[i]
        memo[i] = x
        return x
    return v(0)


def walk(o, pred, out, depth=0):
    if depth > 16:
        return out
    if isinstance(o, dict):
        if pred(o):
            out.append(o)
        for x in o.values():
            walk(x, pred, out, depth + 1)
    elif isinstance(o, list):
        for x in o:
            walk(x, pred, out, depth + 1)
    return out


def city_norm(c):
    return (c or "").replace("台", "臺")


def clip(s, n):
    s = re.sub(r"\s+", " ", str(s or "")).strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def iso_date(s):
    try:
        return datetime.date(*[int(x) for x in re.split(r"[/-]", s)[:3]]).isoformat()
    except Exception:
        return ""


def from_far(today):
    data = devalue(nuxt_payload(get(FAR, timeout=60, headers=UA)))
    rows = walk(data, lambda o: "activityDate" in o and "venueName" in o, [])
    out = []
    for r in rows:
        d = iso_date(r.get("activityDate") or r.get("date") or "")
        if not d or d < today:
            continue
        link = r.get("link") or FAR
        out.append({
            "id": "far-" + str(r.get("id")), "title": clip(r.get("title") or r.get("organizer"), 40), "date": d,
            "time": r.get("time") or "", "city": city_norm(r.get("city")), "district": r.get("district") or "",
            "venue": r.get("venueName") or "", "address": r.get("address") or "", "level": r.get("level") or "",
            "price": r.get("price") or "", "ball": clip(r.get("ballType"), 40), "facilities": r.get("facilities") or "",
            "note": clip(r.get("remarks"), 140), "recurring": bool(r.get("isRecurring")),
            "link": link if link.startswith("http") else FAR, "via": "羽球臨打情報站", "viaUrl": FAR,
        })
    return out


def from_grass(today):
    out, seen = [], set()
    for slug, city in GRASS_CITIES.items():
        page = f"https://grass.camp/find/{slug}/badminton"
        try:
            html = get(page, timeout=40, headers=UA)
        except Exception as e:
            print("grass", slug, e, file=sys.stderr)
            continue
        for m in re.finditer(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', html, re.S):
            try:
                ld = json.loads(m.group(1))
            except ValueError:
                continue
            for ev in walk(ld, lambda o: o.get("@type") == "Event", []):
                start, end = ev.get("startDate", "")[:10], ev.get("endDate", "")[:10] or ev.get("startDate", "")[:10]
                if not start or end < today:
                    continue
                loc = (ev.get("location") or {}).get("name", "")
                key = (ev.get("name"), start, loc)
                if key in seen:
                    continue
                seen.add(key)
                desc = ev.get("description") or ""
                price = re.search(r"\$?\s?(\d{2,4})\s*元|\$\s?(\d{2,4})", desc)
                level = re.search(r"程度\s*[:：]\s*([^\n，。]{1,20})", desc)
                tm = re.search(r"(\d{1,2}[:：]?\d{2})\s*[-~～]\s*(\d{1,2}[:：]?\d{2})", desc)
                c = city or city_norm(guess_city(loc))
                out.append({
                    "id": "grass-" + hashlib.md5("|".join(key).encode()).hexdigest()[:10], "title": clip(ev.get("name"), 40),
                    "date": max(start, today), "dateEnd": end if end != start else "", "time": f"{tm.group(1)}-{tm.group(2)}" if tm else "",
                    "city": c, "district": "", "venue": re.sub(r"^(台北|新北|桃園|台中|高雄|臺北|臺中)\s*", "", loc), "address": "",
                    "level": clip(level.group(1), 20) if level else "", "price": f"${price.group(1) or price.group(2)}" if price else "",
                    "ball": "", "facilities": "", "note": clip(desc, 140), "recurring": False,
                    "link": page, "via": "GRASS", "viaUrl": page,
                })
        time.sleep(1)
    return out


def from_openchat():
    found = {}
    for kw in OC_KEYWORDS:
        try:
            raw = nuxt_payload(get(OC_SEARCH + urllib.parse.quote(kw), timeout=40, headers=UA))
        except Exception as e:
            print("openchat", kw, e, file=sys.stderr)
            continue
        if not raw:
            continue
        for r in walk(devalue(raw), lambda o: isinstance(o.get("square"), dict) and "memberCount" in o, []):
            sq = r["square"]
            name, desc, emid = sq.get("name") or "", sq.get("desc") or "", sq.get("emid") or ""
            # 社群名稱本身要和羽球有關（避免介紹裡順帶提到羽球的家教群、交友群）
            if not emid or not re.search(r"羽|badminton|球館|臨打|零打|暢打", name, re.I) or re.search(r"桌球|匹克球(?!.*羽)|網球(?!.*羽)", name):
                continue
            last = r.get("latestMessageCreatedAt") or r.get("lastestMessageCreatedAt")
            found[emid] = {
                "id": "oc-" + hashlib.md5(emid.encode()).hexdigest()[:10], "name": clip(name, 50), "desc": clip(desc, 160),
                "members": r.get("memberCount") or 0, "city": city_norm(guess_city(name + " " + desc[:60])),
                "lastActive": datetime.datetime.fromtimestamp(last / 1000, TZ).date().isoformat() if isinstance(last, (int, float)) and last > 1e12 else "",
                "url": f"https://openchat.line.me/tw/cover/{emid}",
            }
        time.sleep(1.5)
    items = sorted(found.values(), key=lambda x: -x["members"])
    return items


def main():
    today = datetime.datetime.now(TZ).date().isoformat()
    prev = load("pickups.json", {"items": []})["items"]
    failed, items = [], []
    for name, fn in (("羽球臨打情報站", from_far), ("GRASS", from_grass)):
        try:
            got = fn(today)
            if not got:
                raise RuntimeError("0 筆，疑似版面改變")
            items += got
        except Exception as e:
            failed.append(name)
            print(name, "failed:", e, file=sys.stderr)
            items += [p for p in prev if p.get("via") == name and p["date"] >= today]
    # 同一天內：有明確時段、場館的排前面，再依時間排序
    items.sort(key=lambda p: (p["date"], not p["time"], not p["venue"], p["time"], p["city"]))
    for p in items:
        p["weekday"] = WD[datetime.date.fromisoformat(p["date"]).weekday()]
    save("pickups.json", {"updatedAt": now_iso(), "failed": failed, "sources": [
        {"name": "羽球臨打情報站", "url": FAR}, {"name": "GRASS", "url": "https://grass.camp/find/taiwan/badminton"}], "items": items})

    try:
        oc = from_openchat()
        if not oc:
            raise RuntimeError("0 筆")
    except Exception as e:
        print("openchat failed:", e, file=sys.stderr)
        oc = load("line_groups.json", {"items": []})["items"]
    save("line_groups.json", {"updatedAt": now_iso(), "source": "LINE 社群公開介紹頁", "items": oc})
    by = {}
    for p in items:
        by[p["via"]] = by.get(p["via"], 0) + 1
    print("pickups", len(items), by, "| line groups", len(oc), "| failed", failed)


if __name__ == "__main__":
    main()
