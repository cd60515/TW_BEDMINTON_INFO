"""每月重新搜尋各主題的 YouTube 教學影片。

- 人工精選（source=curated）的影片永遠保留
- 每個主題自動補上新影片，最多維持 MAX_PER_TOPIC 部
- 以 oEmbed 驗證可嵌入；已失效（link_status 標記 broken）的影片移除
只存影片 ID、標題、頻道與長度，播放一律使用 YouTube 官方嵌入。
"""
import json, os, re, sys, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import get, load, save, now_iso, today

MAX_PER_TOPIC = 6
QUERIES = {
    "grip": "羽球教學 握拍", "serve": "羽球教學 發球", "footwork": "羽球教學 步法", "clear": "羽球教學 高遠球",
    "smash": "羽球教學 殺球", "drop": "羽球教學 切球", "net": "羽球教學 網前 放小球", "lift": "羽球教學 挑球",
    "drive": "羽球教學 平抽", "backhand": "羽球教學 反手", "doubles": "羽球 雙打 輪轉 站位", "singles": "羽球 單打 戰術",
    "warmup": "羽球 熱身 伸展", "fitness": "羽球 體能訓練", "rules": "羽球規則 教學", "racket": "羽球拍 選購 新手",
    "string": "羽球 穿線 磅數", "shoes": "羽球鞋 挑選", "injury": "羽球 運動傷害 預防", "highlights": "BWF badminton highlights",
}
BLOCK_WORDS = ("直播", "LIVE", "開箱抽獎", "#shorts")


def search(q):
    s = get("https://www.youtube.com/results?search_query=" + urllib.parse.quote(q), timeout=30,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh) Chrome/130"})
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", s)
    if not m:
        return []
    out = []

    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                v = o["videoRenderer"]
                if "lengthText" in v:
                    out.append({"id": v["videoId"], "title": "".join(r["text"] for r in v["title"]["runs"]),
                                "channel": v.get("ownerText", {}).get("runs", [{}])[0].get("text", ""),
                                "duration": v["lengthText"]["simpleText"]})
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)
    walk(json.loads(m.group(1)))
    return out


def embeddable(vid):
    try:
        get("https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(f"https://www.youtube.com/watch?v={vid}"), timeout=15)
        return True
    except Exception:
        return False


def main():
    data = load("videos.json")
    broken = {u.split("v=")[-1] for u, v in load("link_status.json", {"urls": {}})["urls"].items() if v.get("s") == "broken" and "youtube" in u}
    items = [v for v in data["items"] if v["id"] not in broken]
    removed = len(data["items"]) - len(items)
    have = {v["id"] for v in items}
    added = 0
    for topic, q in QUERIES.items():
        n = sum(1 for v in items if v["topic"] == topic)
        if n >= MAX_PER_TOPIC:
            continue
        try:
            for c in search(q):
                if n >= MAX_PER_TOPIC:
                    break
                if c["id"] in have or any(w in c["title"] for w in BLOCK_WORDS) or not embeddable(c["id"]):
                    continue
                items.append({**c, "topic": topic, "addedAt": today(), "source": "auto"})
                have.add(c["id"]); n += 1; added += 1
        except Exception as e:
            print("search failed", topic, e, file=sys.stderr)
    data["items"] = items
    data["updatedAt"] = now_iso()
    save("videos.json", data)
    print(f"removed {removed} broken, added {added}, total {len(items)}")


if __name__ == "__main__":
    main()
