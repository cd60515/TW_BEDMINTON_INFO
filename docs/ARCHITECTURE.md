# 系統架構

## 設計原則

1. **零營運成本、零伺服器**：靜態網站（GitHub Pages）＋排程資料管線（GitHub Actions），任何人都能 fork 接手維護。
2. **資料都有來源、都會過期**：每筆資料帶來源與時間；沒人確認的資料會自動下架，而不是永遠躺在網站上誤導人。
3. **連回原始來源**：揪團、買賣、影片只做索引與導流，不搬運內容，尊重原作者，也避免資料過時。
4. **一份程式碼、多個平台**：Web / PWA / iOS（Capacitor）共用，平台差異集中在 `platform.*`。
5. **安全預設**：所有資料渲染前跳脫（`html` tagged template），外部網址只允許 http(s)/tel/mailto，Issue 內容以環境變數傳入 workflow 避免指令注入。

## 元件

```
┌──────────────────────────── 前端（web/）────────────────────────────┐
│ app.js  hash router、全域事件委派（收藏、播放、外部連結）、主題、SW     │
│ views.js 首頁 / 搜尋 / 教學 / 影片 / 場館(列表+地圖) / 零打團 / 球具 /   │
│          二手 / 收藏 / 資料狀態 / 安裝 / 隱私                           │
│ core.js  html 樣板、store、favs、progress、platform、api()             │
│ sw.js    App shell cache-first、資料 network-first（離線可用）          │
└───────────────────────────────▲──────────────────────────────────────┘
                                │ fetch data/v1/*.json
┌──────────────────────── 資料 API（web/data/v1/）────────────────────┐
│ manifest.json  venues/{city}.json  venues/all.json  lessons.json      │
│ videos.json  gear.json  groups.json  community_venues.json  shops.json │
│ ptt.json  sources.json  link_status.json                              │
└───────────────────────────────▲──────────────────────────────────────┘
                                │ commit
┌──────────────────────── 資料管線（scripts/ + Actions）────────────────┐
│ update-data.yml  每 6h PTT｜每週一 iPlay+連結檢查｜每月影片            │
│ intake.yml       Issue 加上 approved → issue_intake.py → 上線         │
│ validate.yml     PR / push 時檢查資料格式與 JS 語法                     │
│ deploy.yml       發佈 web/ 到 GitHub Pages                             │
└──────────────────────────────────────────────────────────────────────┘
```

## 資料模型（重點欄位）

**場館** `venues/{city}.json → items[]`
`id`（`iplay-<GymID>`）、`name`、`city`、`district`、`address`、`tel`、`lat`、`lng`、`kind`（sports-center/public/school/park/private）、`rent`（付費/免費/不開放租借）、`open`、`facilities`、`website`、`photo`、`source`

**零打團** `groups.json → items[]`
`id`（`g<issue#>`）、`name`、`city`、`district`、`venue`、`weekdays[0-6]`、`start`、`end`、`levels[]`、`fee`、`shuttle`、`contact`（https）、`note`、`submittedAt`、`confirmedAt`；`ttlDays` 預設 60

**PTT 索引** `ptt.json → items[]`
`url`、`title`、`tag`、`cat`（group/market/news）、`city`（由標題推測）、`author`、`postedAt`、`group{weekdays,start,end,venue,longTerm}`

**連結健康** `link_status.json → urls{url: {s, code, at, fails, label}}`
`s`：ok / restricted / suspect（失敗 1 次）/ broken（連續 ≥2 次）

## 擴充新資料來源

1. 在 `scripts/` 新增 `fetch_xxx.py`，輸出到 `web/data/v1/xxx.json`（含 `updatedAt`、`items`）。
2. 在 `sources.json` 登記來源與頻率。
3. 在 `update-data.yml` 加一個步驟（建議 `continue-on-error: true`，失敗保留舊資料）。
4. 在 `validate.py` 加檢查規則；在 `check_links.py` 的 `collect()` 加入需要檢查的網址。
