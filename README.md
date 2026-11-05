# 🏸 台灣羽球通 TW Badminton Info

> 全台灣羽球人共用的一站式平台：**教學影片、場館查詢、零打揪團、球具選購、二手買賣**，資料定期自動更新、自動檢查失效。

**網站：** https://cd60515.github.io/TW_BEDMINTON_INFO/

| 模組 | 內容 | 資料來源 | 更新方式 |
|---|---|---|---|
| 🎓 教學 | 6 大類 18 堂課（握拍 → 戰術 → 體能），附步驟、常見錯誤、練習法、學習進度 | 編輯撰寫 | 人工 |
| ▶️ 影片 | 20 個主題、近百部中文教學影片 | YouTube（oEmbed 驗證可嵌入） | 每月自動搜尋＋每週驗證 |
| 📍 場館 | 全台 22 縣市、近 1,500 處：1,435 處公立／學校場館＋61 處民營球館與戶外球場；地址、電話、座標、租借狀態、官網、地圖、導航 | 教育部體育署 iPlay 開放 API、OpenStreetMap、網路整理 | 每週自動同步 |
| 🤝 零打團 | 社群登錄的零打團＋PTT 揪人文索引，可依縣市／星期篩選 | GitHub Issue 表單、PTT 羽球板 | 投稿即時、PTT 每 6 小時 |
| 🏸 球具 | 球拍／線／鞋／球選購指南、30 秒球拍規格推薦、品牌官網、購物通路、球具店 | 編輯撰寫＋社群推薦 | 人工＋投稿 |
| ♻️ 二手 | 各大二手平台入口、PTT 買賣文、交易防詐提醒 | 各平台搜尋連結、PTT | 每 6 小時 |

## 🏸 吉祥物：啾比 Chubi

一顆圓滾滾的羽毛球。「啾」是小鳥叫聲（羽毛球英文叫 birdie），「比」是比賽，唸起來像 chubby。軟木球頭是他的肚子，頭頂是 16 根羽毛（真正的羽毛球就是 16 根），越被殺球越開心，最怕掛網。

網站裡藏著啾比的小巧思：依時段打招呼、學會課程會幫他長羽毛（16 根長齊有驚喜）、收藏叫「球筒」（一筒 12 顆）、404 頁面是掛網、回到頂端是一記高遠球、戳 logo 會被殺球並顯示球速（每 21 下贏一局）、搜尋「殺球」會震動、夜場模式他會戴墨鏡、頁尾每頁一則羽球冷知識。介紹頁：`#/chubi`。程式：`web/assets/js/mascot.js`、icon：`web/assets/js/icons.js`。

## 特色

- **免註冊、免費、無廣告**：收藏、學習進度只存在使用者裝置。
- **手機優先**：底部分頁列、大按鈕、一鍵導航（iOS 自動用 Apple 地圖）、一鍵撥號、深色模式。
- **可安裝（PWA）**：加入主畫面後像 App 一樣使用，看過的內容可離線瀏覽。
- **資料會自己保持新鮮**：GitHub Actions 定期抓取、驗證、清除過期資料，失效連結自動開 Issue。
- **iOS App 就緒**：同一份程式碼可用 Capacitor 包成 iOS App 上架（見 [docs/IOS.md](docs/IOS.md)）。

## 資料自動維護機制

```
          ┌──────────── GitHub Actions（排程） ────────────┐
 iPlay API ─▶ fetch_venues.py ─┐
 OSM＋整理 ─▶ fetch_private_venues.py ┤                          │
 PTT 羽球板 ─▶ fetch_ptt.py ────┼─▶ validate.py ─▶ build_manifest.py ─▶ commit ─▶ GitHub Pages
 YouTube   ─▶ refresh_videos.py┘        ▲                 │
 所有外部連結 ─▶ check_links.py ──────────┘  失效 → 自動開 Issue
 Issue 表單（approved）─▶ issue_intake.py ─▶ groups / venues / shops
```

| 機制 | 規則 |
|---|---|
| 來源故障保護 | API 失敗的縣市保留上一版資料；場館總數異常偏少時 `validate.py` 阻擋上線 |
| 連結失效 | 連續 2 次檢查失敗才標記 `broken`；反爬蟲（403/429）視為正常；網站顯示「⚠ 連結可能失效」，失效影片自動隱藏 |
| 零打團過期 | 社群登錄的團 60 天未確認自動下架，團主在網站按「確認仍在運作」即可延長 |
| PTT 索引過期 | 揪人文 45 天、買賣文 21 天、新聞 14 天後自動移除 |
| 資料版本 | `web/data/v1/manifest.json` 提供每個檔案的 SHA、筆數、更新時間（App 端判斷是否需重新下載） |

## 專案結構

```
web/                     ← 網站本體（GitHub Pages 與 iOS App 共用）
  index.html
  assets/js/core.js      ← 安全樣板、儲存、Platform 抽象層（Web/iOS）、資料層
  assets/js/views.js     ← 各頁面
  assets/js/app.js       ← 路由與全域事件
  data/v1/               ← 版本化 JSON 資料 API（也是未來 App / 第三方使用的公開 API）
scripts/                 ← 資料抓取、驗證、連結檢查、投稿處理（Python 標準函式庫，免安裝套件）
.github/workflows/       ← 排程更新、部署、投稿處理、驗證
.github/ISSUE_TEMPLATE/  ← 登錄零打團、球館、球具店、回報錯誤表單
docs/                    ← 架構與 iOS 上架規劃
capacitor.config.json    ← iOS App 設定
```

## 本機開發

```bash
python3 -m http.server 8765 --directory web
```

```bash
python3 scripts/fetch_ptt.py && python3 scripts/fetch_venues.py && python3 scripts/check_links.py && python3 scripts/build_manifest.py
```

## 公開資料 API

任何人都可以直接使用（CORS 由 GitHub Pages 提供）：

| 端點 | 說明 |
|---|---|
| `data/v1/manifest.json` | 版本、筆數、更新時間、連結健康度 |
| `data/v1/venues/all.json` | 全台場館精簡版 |
| `data/v1/venues/{city}.json` | 各縣市完整場館資料（`taipei`、`new-taipei`…） |
| `data/v1/lessons.json`、`videos.json`、`gear.json` | 教學、影片、球具 |
| `data/v1/groups.json`、`ptt.json` | 零打團、PTT 索引 |
| `data/v1/link_status.json` | 外部連結健康狀態 |

## 參與貢獻

- 登錄零打團／私人球館／球具店、回報錯誤：到 [Issues](https://github.com/cd60515/TW_BEDMINTON_INFO/issues/new/choose) 選擇表單。
- 維護者審核後加上 `approved` 標籤，系統會自動寫入資料並上線。
- 詳見 [CONTRIBUTING.md](CONTRIBUTING.md) 與 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。

## 授權

程式碼 MIT；資料授權見 [LICENSE](LICENSE)。
