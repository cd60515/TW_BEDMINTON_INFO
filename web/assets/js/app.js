// 台灣羽球通 — App shell：hash router、全域事件、主題、Service Worker
// 使用 hash 路由：GitHub Pages 與 iOS（Capacitor WKWebView）都不需伺服器端設定
import { $, $$, store, favs, platform, toast, html } from './core.js';
import * as V from './views.js';

const routes = [
  [/^\/?$/, (el) => V.home(el), 'home', '台灣羽球通'],
  [/^\/search$/, (el, p) => V.search(el, p), 'search', '搜尋'],
  [/^\/learn$/, (el, p) => V.learn(el, p), 'learn', '羽球教學'],
  [/^\/learn\/([\w-]+)$/, (el, p, m) => V.lesson(el, m[1]), 'learn', '課程'],
  [/^\/videos$/, (el, p) => V.videos(el, p), 'videos', '教學影片'],
  [/^\/venues$/, (el, p) => V.venues(el, p), 'venues', '羽球場館'],
  [/^\/venue\/([\w-]+)$/, (el, p, m) => V.venue(el, m[1]), 'venues', '場館資訊'],
  [/^\/groups$/, (el, p) => V.groups(el, p), 'groups', '零打團'],
  [/^\/gear$/, (el) => V.gear(el), 'gear', '球具指南'],
  [/^\/market$/, (el) => V.market(el), 'market', '二手買賣'],
  [/^\/favorites$/, (el) => V.favorites(el), 'more', '我的收藏'],
  [/^\/more$/, (el) => V.more(el), 'more', '更多'],
  [/^\/about$/, (el) => V.about(el), 'more', '資料狀態'],
  [/^\/install$/, (el) => V.install(el), 'more', '安裝 App'],
  [/^\/privacy$/, (el) => V.privacy(el), 'more', '隱私權'],
];
const TAB_OF = { videos: 'learn', gear: 'more', market: 'more', search: 'home' };

let renderId = 0;
async function render() {
  const id = ++renderId;
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const main = $('#main');
  let hit = null;
  for (const [re, fn, nav, title] of routes) { const m = path.match(re); if (m) { hit = { fn, nav, title, m }; break; } }
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === hit?.nav));
  $$('[data-tab]').forEach((a) => a.classList.toggle('on', a.dataset.tab === (TAB_OF[hit?.nav] || hit?.nav)));
  document.title = hit && hit.nav !== 'home' ? `${hit.title}｜台灣羽球通` : '台灣羽球通｜全台羽球一站通';
  const box = document.createElement('div');
  box.innerHTML = '<div class="skeleton"></div>';
  main.replaceChildren(box);
  try {
    if (!hit) V.notFound(box); else await hit.fn(box, params, hit.m);
  } catch (e) {
    console.error(e);
    if (id === renderId) box.innerHTML = html`<div class="empty"><div class="big">📡</div><p>資料載入失敗，請檢查網路後重試。</p><button class="btn primary" onclick="location.reload()">重新整理</button><p class="small muted">${e.message}</p></div>`.s;
  }
  if (id !== renderId) return;
  if (!params.has('n')) window.scrollTo(0, 0);
}

/* ---------- 全域事件委派 ---------- */
document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.preventDefault();
    const on = favs.toggle(fav.dataset.fav, fav.dataset.id, JSON.parse(fav.dataset.snap || '{}'));
    $$(`[data-fav="${fav.dataset.fav}"][data-id="${CSS.escape(fav.dataset.id)}"]`).forEach((b) => { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; });
    toast(on ? '已加入收藏' : '已移除收藏');
    return;
  }
  const play = e.target.closest('[data-play]');
  if (play) { e.preventDefault(); V.openPlayer(play.dataset.play, play.dataset.title); return; }
  // iOS App 內：外部連結用 in-app browser 開啟
  const a = e.target.closest('a[target="_blank"]');
  if (a && platform.isNative()) { e.preventDefault(); platform.openExternal(a.href); }
});
document.addEventListener('submit', (e) => {
  const f = e.target.closest('[data-search]');
  if (!f) return;
  e.preventDefault();
  const q = new FormData(f).get('q')?.toString().trim();
  location.hash = '#/search' + (q ? '?q=' + encodeURIComponent(q) : '');
});

/* ---------- 主題 ---------- */
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
applyTheme(store.get('theme', ''));
$('#themeBtn').addEventListener('click', () => {
  const sysDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const cur = store.get('theme', '') || (sysDark ? 'dark' : 'light');
  const next = cur === 'dark' ? 'light' : 'dark';
  store.set('theme', next); applyTheme(next);
});

window.addEventListener('hashchange', render);
render();

/* ---------- PWA：Service Worker（Capacitor 原生環境不需要） ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:' && !platform.isNative()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
