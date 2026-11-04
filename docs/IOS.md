# 📱 iOS App 上架規劃

台灣羽球通從第一天就以「之後要上架 App Store」為前提設計：**網站本身就是 App 的程式碼**，用 [Capacitor](https://capacitorjs.com/) 包成原生 iOS App，Web 與 iOS 共用同一份介面與資料 API，不需要重寫。

## 已經為 iOS 做好的設計

| 項目 | 做法 | 位置 |
|---|---|---|
| 單一程式碼 | `web/` 同時是 GitHub Pages 網站與 Capacitor 的 `webDir` | `capacitor.config.json` |
| 不需伺服器路由 | 使用 hash 路由（`#/venues`），WKWebView 直接可用 | `web/assets/js/app.js` |
| Platform 抽象層 | 外部連結、分享、定位、導航都經過 `platform.*`：Web 用瀏覽器 API，App 自動改用 Capacitor 原生外掛（Browser / Share / Geolocation） | `web/assets/js/core.js` |
| 遠端資料＋內建備援 | App 優先抓 `https://cd60515.github.io/TW_BEDMINTON_INFO/data/v1/`（資料每週更新不用重新送審），失敗時用 App 內建的資料 | `core.js` → `api()` |
| 版本化 API | `data/v1/` + `manifest.json`（SHA、筆數），未來改版用 `v2` 不會讓舊版 App 壞掉 | `scripts/build_manifest.py` |
| iOS 介面 | `viewport-fit=cover`、safe-area 內距、底部分頁列、44pt 以上觸控區、深色模式、無 hover 依賴 | `app.css` |
| 地圖導航 | iOS 自動開 Apple 地圖、其他平台開 Google 地圖 | `platform.navUrl()` |
| 隱私 | 無帳號、無追蹤、定位只在裝置計算，方便填寫 App Store 隱私標籤（Data Not Collected） | `#/privacy` |
| App 圖示 | `web/assets/img/icon-1024.png`（App Store 用 1024×1024） | |

## 建置步驟（需要 macOS + Xcode）

```bash
npm install
```

```bash
npx cap add ios
```

```bash
npx cap sync ios && npx cap open ios
```

在 Xcode 中：
1. 設定 Team（Apple Developer Program，年費 USD 99）與 Bundle ID `tw.badminton.info`。
2. `Info.plist` 加入 `NSLocationWhenInUseUsageDescription`：「用於尋找你附近的羽球場館，位置不會上傳。」
3. App Icon 使用 `web/assets/img/icon-1024.png`。
4. 加入 `PrivacyInfo.xcprivacy`（宣告使用 UserDefaults/localStorage，不收集資料）。
5. Archive → 上傳 App Store Connect → TestFlight 測試 → 送審。

## 通過審核的重點（App Store Review Guideline 4.2「最低功能」）

單純把網站包成 App 容易被退件，因此 App 版會加入原生價值：

| 階段 | 功能 | 狀態 |
|---|---|---|
| v1.0 | 原生定位找附近球場、Apple 地圖導航、原生分享、In-App Browser、離線內建資料、收藏與學習進度 | 程式碼已支援（`platform.*`） |
| v1.1 | 推播通知：收藏的縣市有新零打團、收藏場館資訊變更（`@capacitor/push-notifications` + APNs） | 規劃中 |
| v1.2 | iOS 小工具（Widget）：今天附近的零打團；Siri 捷徑「找附近羽球場」 | 規劃中 |
| v1.3 | iCloud 同步收藏（CloudKit），或選擇性 Sign in with Apple | 規劃中 |
| v2.0 | 球友媒合、場地即時空位（需各運動中心開放 API） | 研究中 |

## 送審需要準備

- 隱私權政策網址：`https://cd60515.github.io/TW_BEDMINTON_INFO/#/privacy`
- 支援網址：`https://github.com/cd60515/TW_BEDMINTON_INFO/issues`
- 年齡分級：4+（零打團與二手為外部連結，建議在審核備註說明內容來源與檢舉機制）
- 使用者產生內容（零打團投稿）：已有人工審核（`approved` 標籤）與「回報」按鈕，符合 Guideline 1.2。
- 截圖：6.9 吋與 6.5 吋 iPhone 各 3–10 張（首頁、場館地圖、教學、零打團）。

## 未來改為原生 SwiftUI 的路徑

如果日後想改寫成純原生 App，`web/data/v1/*.json` 就是現成的後端 API，SwiftUI 只要用 `Codable` 對應同樣的 JSON 結構即可，資料管線（GitHub Actions）完全不用改。
