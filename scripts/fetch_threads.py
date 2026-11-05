"""Threads 羽球揪團貼文（Meta 官方 Threads API 關鍵字搜尋）。

需要環境變數 THREADS_ACCESS_TOKEN（存在 GitHub Secrets）。沒有設定時直接略過，不影響其他資料。
權限：threads_basic + threads_keyword_search。注意：App 通過 Meta 審核前，搜尋只會回傳「自己帳號」的貼文；
通過審核後才會搜尋全站公開貼文。申請步驟見 docs/THREADS.md。

只保存貼文摘要（前 140 字）、時間與官方 permalink，點擊後連回 Threads 原文；不保存使用者名稱。
貼文 21 天後自動移除。不使用爬蟲、不繞過登入，完全走官方 API。
"""
import datetime, json, os, re, sys, time, urllib.error, urllib.parse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import get, load, save, now_iso, TZ
from fetch_ptt import guess_city, parse_group

API = "https://graph.threads.net/v1.0/keyword_search"
QUERIES = ["羽球 臨打", "羽球 零打", "羽球 缺人", "羽球 揪團", "羽球 季打", "羽毛球 臨打"]
KEEP_DAYS = 21
GROUP_WORDS = re.compile(r"臨打|零打|缺\d*人|揪|季打|徵|名額|報名")


def main():
    token = os.environ.get("THREADS_ACCESS_TOKEN", "").strip()
    store = load("threads.json", {"items": []})
    if not token:
        print("THREADS_ACCESS_TOKEN 未設定，略過 Threads（保留現有資料）")
        return
    items = {i["url"]: i for i in store["items"]}

    def explain(e):
        """把 Meta 回傳的錯誤訊息印出來（不含 token）。"""
        body = e.read().decode("utf-8", "replace") if isinstance(e, urllib.error.HTTPError) else str(e)
        return body.replace(token, "***")[:400]

    # 先確認 token 有效、屬於哪個帳號
    try:
        me = json.loads(get("https://graph.threads.net/v1.0/me", {"fields": "id,username", "access_token": token}, timeout=30))
        print("token OK，帳號：", me.get("username"))
    except Exception as e:
        print("token 檢查失敗：", explain(e), file=sys.stderr)
        return
    for q in QUERIES:
        try:
            res = json.loads(get(API, {"q": q, "search_type": "RECENT", "fields": "id,text,permalink,timestamp,media_type",
                                       "limit": 50, "access_token": token}, timeout=30))
        except Exception as e:
            print("threads", q, explain(e), file=sys.stderr)
            continue
        for p in res.get("data", []):
            text = p.get("text") or ""
            if not p.get("permalink") or "羽" not in text or not GROUP_WORDS.search(text):
                continue
            title = re.sub(r"\s+", " ", text).strip()
            items[p["permalink"]] = {
                "url": p["permalink"], "text": title[:140] + ("…" if len(title) > 140 else ""),
                "postedAt": datetime.datetime.fromisoformat(p["timestamp"].replace("+0000", "+00:00")).astimezone(TZ).replace(microsecond=0).isoformat(),
                "city": guess_city(title), "group": parse_group("[揪人] " + title[:80]),
            }
        time.sleep(1)
    now = datetime.datetime.now(TZ)
    kept = sorted((i for i in items.values() if (now - datetime.datetime.fromisoformat(i["postedAt"])).days <= KEEP_DAYS),
                  key=lambda i: i["postedAt"], reverse=True)
    save("threads.json", {"updatedAt": now_iso(), "source": "Threads（官方 API）", "keepDays": KEEP_DAYS, "items": kept})
    print("threads posts", len(kept))


if __name__ == "__main__":
    main()
