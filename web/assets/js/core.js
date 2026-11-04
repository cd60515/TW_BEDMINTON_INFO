// 台灣羽球通 — 核心模組
// 1) 安全的 HTML 樣板（所有資料預設跳脫，防 XSS）
// 2) 本機儲存（收藏、學習進度、偏好）
// 3) Platform 抽象層：Web 與 iOS（Capacitor）共用同一份程式碼
// 4) 資料層：版本化 JSON API（web/data/v1），App 端優先抓遠端、失敗用內建資料

export const CONFIG = {
  repo: 'https://github.com/cd60515/TW_BEDMINTON_INFO',
  site: 'https://cd60515.github.io/TW_BEDMINTON_INFO/',
  apiVersion: 'v1',
};

/* ---------------- HTML templating ---------------- */
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);
function fmt(v) {
  if (v == null || v === false) return '';
  if (v instanceof Raw) return v.s;
  if (Array.isArray(v)) return v.map(fmt).join('');
  return esc(String(v));
}
export function html(strings, ...vals) {
  let out = '';
  strings.forEach((s, i) => { out += s; if (i < vals.length) out += fmt(vals[i]); });
  return new Raw(out);
}
/** 只允許 http(s)/tel/mailto，其餘一律擋掉 */
export function safeUrl(u) {
  if (!u) return '';
  const s = String(u).trim();
  return /^(https?:|tel:|mailto:)/i.test(s) ? s : '';
}
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

/* ---------------- Storage ---------------- */
const NS = 'twb.';
export const store = {
  get(k, d) { try { const v = localStorage.getItem(NS + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch { /* 隱私模式 */ } },
};
export const favs = {
  all() { return store.get('fav', {}); },
  has(type, id) { return !!(this.all()[type] || {})[id]; },
  toggle(type, id, snapshot) {
    const f = this.all(); f[type] = f[type] || {};
    if (f[type][id]) delete f[type][id]; else f[type][id] = { ...snapshot, savedAt: Date.now() };
    store.set('fav', f); return !!f[type][id];
  },
  count() { return Object.values(this.all()).reduce((n, o) => n + Object.keys(o).length, 0); },
};
export const progress = {
  all() { return store.get('learned', {}); },
  has(id) { return !!this.all()[id]; },
  toggle(id) { const p = this.all(); if (p[id]) delete p[id]; else p[id] = Date.now(); store.set('learned', p); return !!p[id]; },
};

/* ---------------- Platform bridge ---------------- */
const Cap = () => window.Capacitor;
export const platform = {
  isNative() { return !!(Cap() && Cap().isNativePlatform && Cap().isNativePlatform()); },
  isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); },
  async openExternal(url) {
    url = safeUrl(url); if (!url) return;
    const B = Cap()?.Plugins?.Browser;
    if (this.isNative() && B && /^https?:/.test(url)) return B.open({ url });
    window.open(url, '_blank', 'noopener');
  },
  async share({ title, text, url }) {
    const S = Cap()?.Plugins?.Share;
    if (this.isNative() && S) return S.share({ title, text, url });
    if (navigator.share) return navigator.share({ title, text, url }).catch(() => {});
    await navigator.clipboard?.writeText(url); toast('已複製連結');
  },
  async locate() {
    const G = Cap()?.Plugins?.Geolocation;
    if (this.isNative() && G) { const p = await G.getCurrentPosition({ timeout: 10000 }); return { lat: p.coords.latitude, lng: p.coords.longitude }; }
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error('此裝置不支援定位'));
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => rej(new Error(e.code === 1 ? '定位權限被拒絕' : '無法取得位置')), { timeout: 10000, maximumAge: 300000 });
    });
  },
  /** 導航連結：iOS 用 Apple 地圖，其餘用 Google 地圖 */
  navUrl(v) {
    const q = v.lat && v.lng ? `${v.lat},${v.lng}` : encodeURIComponent(v.address || v.name);
    if (this.isIOS()) return `https://maps.apple.com/?daddr=${q}&q=${encodeURIComponent(v.name)}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${q}`;
  },
  gmapsUrl(v) { return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((v.name || '') + ' ' + (v.address || ''))}`; },
};

/* ---------------- Data layer ---------------- */
const cache = new Map();
const base = () => (platform.isNative() ? CONFIG.site : '') + `data/${CONFIG.apiVersion}/`;
async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}
export async function api(name) {
  if (cache.has(name)) return cache.get(name);
  const p = (async () => {
    try { return await fetchJson(base() + name); }
    catch (e) {
      // App 端遠端失敗 → 退回 App 內建資料
      if (platform.isNative()) return fetchJson(`data/${CONFIG.apiVersion}/${name}`);
      throw e;
    }
  })();
  cache.set(name, p);
  p.catch(() => cache.delete(name));
  return p;
}
/** 連結健康狀態（由排程的 link checker 產生） */
export async function linkState(url) {
  try { const s = await api('link_status.json'); return s.urls?.[url]?.s || ''; } catch { return ''; }
}
export async function linkMap() { try { return (await api('link_status.json')).urls || {}; } catch { return {}; } }

/* ---------------- Helpers ---------------- */
export const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
export function daysAgo(iso) { if (!iso) return Infinity; return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); }
export function ago(iso) {
  const d = daysAgo(iso);
  if (!isFinite(d)) return '未知';
  if (d <= 0) { const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000); return h <= 0 ? '剛剛' : `${h} 小時前`; }
  if (d < 30) return `${d} 天前`;
  if (d < 365) return `${Math.floor(d / 30)} 個月前`;
  return `${Math.floor(d / 365)} 年前`;
}
export function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`; }
export function distKm(a, b) {
  const R = 6371, toR = (x) => (x * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export function norm(s) { return String(s || '').toLowerCase().replace(/台/g, '臺').replace(/\s+/g, ''); }
export function match(q, ...fields) { const n = norm(q); return !n || fields.some((f) => norm(f).includes(n)); }
let toastT;
export function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}
/** GitHub Issue 表單連結；fields 會預填到同名 id 的表單欄位 */
export function issueUrl(template, fields = {}) {
  const p = new URLSearchParams({ template });
  for (const [k, v] of Object.entries(fields)) if (v) p.set(k, v);
  return `${CONFIG.repo}/issues/new?${p}`;
}
