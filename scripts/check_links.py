"""外部連結與影片健康檢查。

- 收集所有資料檔中的外部網址（品牌、通路、場館官網、零打團聯絡連結、資料來源）
- YouTube 影片改用 oEmbed 驗證（影片被刪除/設為私人/禁止嵌入都會失敗）
- 判定：2xx/3xx = ok；401/403/429 等反爬蟲 = restricted（視為正常）；其他 = 失敗
- 連續失敗 >= 2 次才標記 broken，避免網站短暫異常造成誤判
- 產出 web/data/v1/link_status.json 與 reports/broken_links.md（供 GitHub Actions 開 Issue）
"""
import concurrent.futures as cf, os, sys, urllib.error, urllib.parse, urllib.request, socket, ssl
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import ROOT, CITY_SLUG, load, save, now_iso

BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 TW-Badminton-LinkCheck"
RESTRICTED = {401, 403, 405, 406, 429, 451, 999}
SKIP_HOSTS = ("facebook.com", "instagram.com", "line.me")  # 需登入，無法自動檢查
FAIL_THRESHOLD = 2


def collect():
    urls = {}
    g = load("gear.json", {})
    for b in g.get("brands", []) + g.get("buy", []):
        urls[b["url"]] = f"球具：{b['name']}"
    for s in load("sources.json", {}).get("items", []):
        urls[s["url"]] = f"來源：{s['name']}"
    for grp in load("groups.json", {}).get("items", []):
        if str(grp.get("contact", "")).startswith("http"):
            urls[grp["contact"]] = f"零打團：{grp['name']}"
    for slug in CITY_SLUG.values():
        for v in load(f"venues/{slug}.json", {"items": []})["items"]:
            if v.get("website"):
                urls[v["website"]] = f"場館：{v['name']}"
    for v in load("videos.json", {"items": []})["items"]:
        urls[f"https://www.youtube.com/watch?v={v['id']}"] = f"影片：{v['title'][:40]}"
    return urls


def probe(url):
    host = urllib.parse.urlparse(url).hostname or ""
    if any(host.endswith(h) for h in SKIP_HOSTS):
        return "restricted", 0
    target = url
    if "youtube.com/watch" in url:
        target = "https://www.youtube.com/oembed?format=json&url=" + urllib.parse.quote(url, safe="")
    ctx = ssl.create_default_context()
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(target, method=method, headers={"User-Agent": BROWSER_UA, "Accept-Language": "zh-TW"})
            with urllib.request.urlopen(req, timeout=20, context=ctx) as r:
                return "ok", r.status
        except urllib.error.HTTPError as e:
            if 300 <= e.code < 400:
                return "ok", e.code
            if method == "HEAD" and e.code in (400, 403, 404, 405, 501):
                continue  # 部分網站不支援 HEAD，改用 GET 再試
            return ("restricted" if e.code in RESTRICTED else "fail"), e.code
        except ssl.SSLError:
            # 政府網站常見憑證鏈不完整：瀏覽器可開但 Python 驗證失敗，視為 restricted
            return "restricted", -2
        except (urllib.error.URLError, socket.timeout, ConnectionError, OSError) as e:
            if isinstance(getattr(e, "reason", None), ssl.SSLError):
                return "restricted", -2
            if method == "HEAD":
                continue
            return "fail", -1
    return "fail", -1


def main():
    urls = collect()
    prev = load("link_status.json", {"urls": {}}).get("urls", {})
    out = {}
    with cf.ThreadPoolExecutor(16) as ex:
        for url, (state, code) in zip(urls, ex.map(probe, urls)):
            p = prev.get(url, {})
            fails = p.get("fails", 0) + 1 if state == "fail" else 0
            s = "broken" if fails >= FAIL_THRESHOLD else ("suspect" if state == "fail" else state)
            out[url] = {"s": s, "code": code, "at": now_iso(), "fails": fails, "label": urls[url]}
    save("link_status.json", {"checkedAt": now_iso(), "threshold": FAIL_THRESHOLD, "urls": out})
    broken = [(u, v) for u, v in out.items() if v["s"] == "broken"]
    suspect = [(u, v) for u, v in out.items() if v["s"] == "suspect"]
    os.makedirs(os.path.join(ROOT, "reports"), exist_ok=True)
    with open(os.path.join(ROOT, "reports", "broken_links.md"), "w", encoding="utf-8") as f:
        f.write(f"排程連結檢查結果（{now_iso()}）：共 {len(out)} 個連結，失效 {len(broken)}、待觀察 {len(suspect)}。\n\n")
        if broken:
            f.write("| 項目 | 網址 | 狀態碼 |\n|---|---|---|\n")
            for u, v in broken:
                f.write(f"| {v['label']} | {u} | {v['code']} |\n")
            f.write("\n失效項目在網站上會顯示「⚠ 連結可能失效」，影片會自動隱藏。請修正資料或移除後關閉此 Issue。\n")
    counts = {k: sum(1 for v in out.values() if v["s"] == k) for k in ("ok", "restricted", "suspect", "broken")}
    print(counts)
    for u, v in suspect + broken:
        print(v["s"], v["code"], v["label"], u)
    # 讓 workflow 知道是否要開 Issue
    gh = os.environ.get("GITHUB_OUTPUT")
    if gh:
        with open(gh, "a") as f:
            f.write(f"broken={len(broken)}\n")


if __name__ == "__main__":
    main()
