"""抓取 PTT 羽球板（Badminton）最新文章，分類為零打揪團 / 二手買賣 / 新聞。

資料來源：https://www.ptt.cc/bbs/Badminton/
只保存「標題、連結、時間、分類、推測縣市」，不轉載文章內文（尊重原作者），使用者點擊後連回 PTT 原文。
超過保留天數的文章自動移除 = 自動失效機制。
"""
import os, re, sys, html, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import get, load, save, now_iso, TZ, CITIES

BOARD = "https://www.ptt.cc/bbs/Badminton/"
PAGES = int(os.environ.get("PTT_PAGES", "20"))
KEEP_DAYS = {"group": 45, "market": 21, "news": 14}
CATS = {
    "group": ("揪人", "揪團", "臨打", "零打", "徵人", "場租", "缺人", "轉租", "徵球友", "團練"),
    "market": ("賣", "售", "徵求", "徵", "交易", "買", "換", "出清", "贈送"),
    "news": ("新聞", "情報", "賽事", "Live", "分享"),
}
ROW = re.compile(r'<div class="r-ent">.*?<div class="title">\s*(?:<a href="(?P<href>/bbs/Badminton/M\.(?P<ts>\d+)\.[^"]+)">(?P<title>[^<]+)</a>)?.*?<div class="author">(?P<author>[^<]*)</div>', re.S)
PREV = re.compile(r'href="/bbs/Badminton/index(\d+)\.html">&lsaquo; 上頁')

# 縣市判斷：縣市名、常見區名與運動中心名
HINTS = {c: [c, c.replace("臺", "台"), c[:2], c[:2].replace("臺", "台")] for c in CITIES}
HINTS["臺北市"] += ["北北基", "雙北", "大台北"]
HINTS["新竹市"] += ["竹科", "大新竹"]
HINTS["臺北市"] += ["北市", "大安", "中正", "信義", "內湖", "南港", "士林", "北投", "松山", "萬華", "大同", "文山", "中山運動"]
HINTS["新北市"] += ["板橋", "三重", "新莊", "中和", "永和", "土城", "蘆洲", "汐止", "樹林", "淡水", "新店", "林口", "三鶯", "泰山", "五股"]
HINTS["桃園市"] += ["中壢", "蘆竹", "八德", "平鎮", "龜山", "楊梅", "大園"]
HINTS["臺中市"] += ["中市", "朝馬", "南屯", "大里", "太平", "豐原", "北屯", "西屯", "烏日", "沙鹿"]
HINTS["臺南市"] += ["南市", "永康", "安平", "東區運動"]
HINTS["高雄市"] += ["高市", "鳳山", "左營", "楠梓", "小港", "三民", "苓雅", "前鎮", "鼓山"]
HINTS["新竹市"] += ["竹市", "竹光"]
HINTS["新竹縣"] += ["竹北", "竹東"]
HINTS["基隆市"] += ["基隆"]


def guess_city(title):
    for c, keys in HINTS.items():
        if any(k in title for k in keys):
            return c
    return ""


def categorize(title):
    m = re.match(r"\s*(?:Re:\s*|Fw:\s*)?\[([^\]]+)\]", title)
    tag = m.group(1).strip() if m else ""
    if title.startswith(("Re:", "Fw:")):
        return tag, None
    for cat, keys in CATS.items():
        if any(k in tag for k in keys):
            return tag, cat
    return tag, None


WD = {"日": 0, "天": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6}
TIME = re.compile(r"(\d{1,2}):?(\d{2})\s*[-~－～到]\s*(\d{1,2}):?(\d{2})")


def parse_group(title):
    """從「[揪人] 長期（六）三重運動中心 1200-1400」解析出星期、時間、場地。"""
    body = re.sub(r"^\s*\[[^\]]+\]\s*", "", title)
    days = []
    for m in re.finditer(r"[（(]([日天一二三四五六、,/]+)[）)]|(?:週|星期|禮拜)([日天一二三四五六])", body):
        for ch in (m.group(1) or m.group(2) or ""):
            if ch in WD and WD[ch] not in days:
                days.append(WD[ch])
    t = TIME.search(body)
    start = end = ""
    if t:
        start, end = f"{int(t.group(1)):02d}:{t.group(2)}", f"{int(t.group(3)):02d}:{t.group(4)}"
    venue = TIME.sub("", body)
    venue = re.sub(r"[（(][^）)]*[）)]|長期|固定|臨打|零打|徵|缺\d*人?|\d{1,2}/\d{1,2}(?:[、,]\d{1,2})*", " ", venue)
    venue = re.sub(r"\s+", " ", venue).strip(" ,、-")
    return {"weekdays": sorted(days), "start": start, "end": end, "venue": venue, "longTerm": "長期" in body or "固定" in body}


def main():
    store = load("ptt.json", {"items": []})
    items = {i["url"]: i for i in store.get("items", [])}
    page_html = get(BOARD + "index.html", headers={"Cookie": "over18=1"})
    pages = [page_html]
    m = PREV.search(page_html)
    if m:
        last = int(m.group(1))
        for n in range(last, max(last - PAGES + 1, 0), -1):
            try:
                pages.append(get(f"{BOARD}index{n}.html", headers={"Cookie": "over18=1"}))
            except Exception as e:
                print("page", n, e, file=sys.stderr)
    for p in pages:
        for r in ROW.finditer(p):
            if not r.group("href"):
                continue  # 已刪除文章
            title = html.unescape(r.group("title")).strip()
            tag, cat = categorize(title)
            if not cat or "[公告]" in title:
                continue
            url = "https://www.ptt.cc" + r.group("href")
            ts = datetime.datetime.fromtimestamp(int(r.group("ts")), TZ).replace(microsecond=0)
            items[url] = {"url": url, "title": title, "tag": tag, "cat": cat, "city": guess_city(title),
                          "author": r.group("author").strip(), "postedAt": ts.isoformat()}
            if cat == "group":
                items[url]["group"] = parse_group(title)
    now = datetime.datetime.now(TZ)
    kept = [i for i in items.values()
            if (now - datetime.datetime.fromisoformat(i["postedAt"])).days <= KEEP_DAYS[i["cat"]]]
    kept.sort(key=lambda i: i["postedAt"], reverse=True)
    # 同一團重複發文只保留最新一篇
    seen, uniq = set(), []
    for i in kept:
        key = (i["cat"], re.sub(r"\s+", "", i["title"]))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(i)
    kept = uniq
    save("ptt.json", {"source": "PTT 羽球板", "sourceUrl": BOARD + "index.html", "updatedAt": now_iso(),
                      "keepDays": KEEP_DAYS, "items": kept})
    by = {}
    for i in kept:
        by[i["cat"]] = by.get(i["cat"], 0) + 1
    print("kept", len(kept), by, "expired", len(items) - len(kept))


if __name__ == "__main__":
    main()
