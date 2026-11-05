# 啟用 Threads 揪團貼文

程式（`scripts/fetch_threads.py`）已經寫好，排程每 6 小時執行；只要在 GitHub 設定一組 token 就會開始抓 Threads 上的羽球揪團貼文。
本站只走 **Meta 官方 Threads API**，不爬網頁、不繞過登入，只保存貼文前 140 字、時間與原文連結。

## 需要你做的事

1. **建立 Meta 開發者帳號**：用你的 Facebook 帳號登入 <https://developers.facebook.com/>，完成開發者註冊。
2. **建立 App**：My Apps → Create App → 用途選「Access the Threads API」。
3. **加入權限**：在 Use cases → Threads API 中加入 `threads_basic` 與 `threads_keyword_search`。
4. **把你的 Threads 帳號加為測試者**：App roles → Roles → Add Threads Tester，並在 Threads App 的「設定 → 帳號 → 網站權限」接受邀請。
5. **產生長效 token**：用 Graph API Explorer 或 Threads 授權流程取得 user access token，再換成 60 天的 long-lived token。
6. **存到 GitHub**：repo → Settings → Secrets and variables → Actions → New repository secret，名稱 `THREADS_ACCESS_TOKEN`，貼上 token。
7. **送審 `threads_keyword_search`**（關鍵）：App Review → 申請 Advanced Access。
   - 需要：隱私權政策網址（可用 `#/privacy` 頁面，但網站需公開上線）、使用說明與操作錄影、通常還要商業驗證。
   - **審核通過前**，關鍵字搜尋只會找到你自己帳號的貼文；通過後才會搜尋全站公開貼文。

## 注意

- Long-lived token 60 天會過期，需定期更新（之後可以加自動換發）。
- 官方 API 有每日搜尋次數上限，排程每 6 小時搜 6 個關鍵字，遠低於上限。
- 若審核沒通過，其他來源（臨打情報站、GRASS、LINE 社群、PTT）都不受影響。
