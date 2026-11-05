# Threads 揪團貼文

## 目前做法：球友分享（已啟用）

零打團頁 →「揪人貼文」→「🧵 分享 Threads 貼文」會開啟 GitHub 表單（`.github/ISSUE_TEMPLATE/share-threads.yml`）：

1. 球友貼上 Threads **單篇貼文網址**，選縣市，寫一句摘要（時間、場館選填）。
2. 維護者確認內容後在 Issue 加上 `approved` 標籤。
3. `scripts/issue_intake.py` 驗證網址格式並寫入 `web/data/v1/threads.json`，網站顯示摘要並連回原文。
4. 分享的貼文 21 天後自動下架（寫入時清掉過期資料，網頁也會過濾）。

網站只顯示球友自己寫的摘要，不複製貼文內容、不爬取 Threads。

## 為什麼不自動抓

- threads.com 的 robots.txt 明文禁止未經書面許可的自動化資料收集。
- 官方 Threads API 的 `threads_keyword_search` 在通過審核前只能搜尋「自己帳號」的貼文；
  送審需先成為技術供應商並完成商家驗證（不可撤銷），且此權限的允許用途僅限「協助用戶管理自己的社群曝光」。

## 已停用的官方 API 串接（保留備查）

- Meta App：TW Badminton Info（1084986667904223），已加入 `threads_keyword_search`（可供測試）。
- `scripts/fetch_threads.py` 仍在 repo 中，但已從排程移除。
- GitHub Secret `THREADS_ACCESS_TOKEN`（60 天長效）可保留或刪除；若未來取得審核，把排程步驟加回 `update-data.yml` 即可。
- 隱私權政策頁：https://cd60515.github.io/twb-privacy/ （獨立公開 repo `cd60515/twb-privacy`）。
