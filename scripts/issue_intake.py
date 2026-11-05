"""把審核通過（label: approved）的 GitHub Issue 表單寫入資料檔。

環境變數：ISSUE_NUMBER、ISSUE_BODY、ISSUE_LABELS（逗號分隔）
- type:group   → groups.json 新增零打團
- type:confirm → groups.json 更新 confirmedAt（延長 60 天有效期）
- type:venue   → community_venues.json 新增民營球館
- type:shop    → shops.json 新增球具店
輸出 GITHUB_OUTPUT: summary=<給 Issue 的回覆文字>
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import load, save, now_iso, today, CITIES

WD = {"星期日": 0, "星期一": 1, "星期二": 2, "星期三": 3, "星期四": 4, "星期五": 5, "星期六": 6}
LV = {"新手": "new", "初階": "low", "中階": "mid", "中高階": "high", "高階": "pro"}
LABELS = {
    "團名": "name", "縣市": "city", "行政區": "district", "場館名稱": "venue", "每週打球日": "weekdays", "開始時間": "start",
    "結束時間": "end", "適合程度": "levels", "費用": "fee", "用球": "shuttle", "聯絡方式（網址）": "contact", "備註": "note",
    "團編號": "group_id", "需要更新的資訊（沒有可留空）": "changes", "球館名稱": "name", "地址": "address", "電話": "tel",
    "官網或預約網址": "website", "場地數量": "courts", "租金與營業時間等備註": "note", "店名": "name", "網站或粉專": "website", "服務": "services",
    "Threads 貼文網址": "url", "時間": "when", "場館": "venue", "摘要": "summary",
}
THREADS_URL = re.compile(r"^https://(www\.)?threads\.(com|net)/@[\w.]+/post/[\w-]+/?(\?.*)?$")
THREADS_KEEP_DAYS = 21
TIME = re.compile(r"^([01]?\d|2[0-3])[:：]?([0-5]\d)$")


def parse(body):
    out = {}
    for block in re.split(r"^### ", body or "", flags=re.M)[1:]:
        label, _, value = block.partition("\n")
        key = LABELS.get(label.strip())
        if not key:
            continue
        value = value.strip()
        if value in ("_No response_", "None"):
            value = ""
        if "- [" in value:
            value = [m.group(1).strip() for m in re.finditer(r"- \[[xX]\] (.+)", value)]
        out[key] = value
    return out


def clean(s, n=120):
    return re.sub(r"[<>\r\n]+", " ", str(s or "")).strip()[:n]


def url_ok(u):
    return bool(re.match(r"^https://[^\s<>\"']+$", u or ""))


def hhmm(s):
    m = TIME.match((s or "").strip())
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else ""


def main():
    num = os.environ["ISSUE_NUMBER"]
    labels = os.environ.get("ISSUE_LABELS", "")
    f = parse(os.environ.get("ISSUE_BODY", ""))
    errors, msg = [], ""

    if "type:group" in labels:
        g = {"id": f"g{num}", "name": clean(f.get("name"), 40), "city": f.get("city"), "district": clean(f.get("district"), 6),
             "venue": clean(f.get("venue"), 40), "weekdays": sorted(WD[d] for d in f.get("weekdays") or [] if d in WD),
             "start": hhmm(f.get("start")), "end": hhmm(f.get("end")), "levels": [LV[x] for x in f.get("levels") or [] if x in LV],
             "fee": clean(f.get("fee"), 40), "shuttle": clean(f.get("shuttle"), 40), "contact": f.get("contact", "").strip(),
             "note": clean(f.get("note"), 200), "issue": int(num), "submittedAt": today(), "confirmedAt": today()}
        if not g["name"] or g["city"] not in CITIES or not g["venue"]:
            errors.append("團名、縣市、場館為必填")
        if not g["start"] or not g["end"]:
            errors.append("時間格式請用 19:00")
        if not url_ok(g["contact"]):
            errors.append("聯絡方式需為 https:// 開頭的網址")
        if not errors:
            data = load("groups.json")
            data["items"] = [x for x in data["items"] if x["id"] != g["id"]] + [g]
            data["updatedAt"] = now_iso()
            save("groups.json", data)
            msg = f"已上架零打團「{g['name']}」（編號 {g['id']}），有效期限 {data.get('ttlDays', 60)} 天。"

    elif "type:confirm" in labels:
        gid = clean(f.get("group_id"), 20)
        data = load("groups.json")
        hit = next((x for x in data["items"] if x["id"] == gid), None)
        if not hit:
            errors.append(f"找不到團編號 {gid}")
        else:
            hit["confirmedAt"] = today()
            data["updatedAt"] = now_iso()
            save("groups.json", data)
            msg = f"已確認「{hit['name']}」仍在運作，有效期限重新計算。" + ("（更新內容請維護者手動修改）" if f.get("changes") else "")

    elif "type:threads" in labels:
        url = (f.get("url") or "").strip().split("?")[0]
        if not THREADS_URL.match(url):
            errors.append("請提供 Threads 單篇貼文網址（https://www.threads.com/@帳號/post/…）")
        if f.get("city") not in CITIES:
            errors.append("請選擇縣市")
        summary = clean(f.get("summary"), 140)
        if not summary:
            errors.append("請填寫摘要")
        if not errors:
            import datetime
            from fetch_ptt import parse_group
            data = load("threads.json", {"items": []})
            cutoff = (datetime.date.today() - datetime.timedelta(days=THREADS_KEEP_DAYS)).isoformat()
            items = [x for x in data["items"] if x["url"] != url and x.get("postedAt", "")[:10] >= cutoff]
            when, venue = clean(f.get("when"), 40), clean(f.get("venue"), 30)
            items.insert(0, {"url": url, "text": summary, "when": when, "venue": venue, "city": f["city"],
                             "postedAt": now_iso(), "issue": int(num),
                             "group": parse_group(f"[揪人] {when} {venue}")})
            data.update({"updatedAt": now_iso(), "source": "球友分享", "keepDays": THREADS_KEEP_DAYS, "items": items})
            save("threads.json", data)
            msg = f"已上架 Threads 揪團（{f['city']} {venue}），{THREADS_KEEP_DAYS} 天後自動下架。"

    elif "type:venue" in labels or "type:shop" in labels:
        is_venue = "type:venue" in labels
        item = {"id": f"{'c' if is_venue else 's'}{num}", "name": clean(f.get("name"), 40), "city": f.get("city"),
                "district": clean(f.get("district"), 6), "address": clean(f.get("address"), 80), "tel": clean(f.get("tel"), 30),
                "website": f.get("website", "").strip() if url_ok(f.get("website", "").strip()) else "",
                "note": clean(f.get("note"), 200), "issue": int(num), "submittedAt": today()}
        if is_venue:
            item.update({"kind": "private", "rent": "付費", "courts": clean(f.get("courts"), 10)})
        else:
            item["services"] = f.get("services") or []
        if not item["name"] or item["city"] not in CITIES or not item["address"]:
            errors.append("名稱、縣市、地址為必填")
        if not errors:
            name = "community_venues.json" if is_venue else "shops.json"
            data = load(name, {"items": []})
            data["items"] = [x for x in data["items"] if x["id"] != item["id"]] + [item]
            data["updatedAt"] = now_iso()
            save(name, data)
            msg = f"已新增「{item['name']}」。"
    else:
        errors.append("此 Issue 類型不需自動處理")

    summary = ("❌ 無法自動上架：" + "；".join(errors)) if errors else ("✅ " + msg + " 網站將在數分鐘內更新。")
    print(summary)
    gh = os.environ.get("GITHUB_OUTPUT")
    if gh:
        with open(gh, "a", encoding="utf-8") as fh:
            fh.write(f"summary={summary}\nok={'false' if errors else 'true'}\n")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
