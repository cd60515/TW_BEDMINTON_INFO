// 台灣羽球通 — App shell：hash router、全域事件、主題、Service Worker
// 使用 hash 路由：GitHub Pages 與 iOS（Capacitor WKWebView）都不需伺服器端設定
import { $, $$, store, favs, platform, toast, html, raw } from './core.js';
import * as V from './views.js';
import { chubi, FACTS } from './mascot.js';
import { icon } from './icons.js';

const routes = [
  [/^\/?$/, (el) => V.home(el), 'home', '台灣羽球通'],
  [/^\/search$/, (el, p) => V.search(el, p), 'search', '搜尋'],
  [/^\/learn$/, (el, p) => V.learn(el, p), 'learn', '羽球教學'],
  [/^\/learn\/([\w-]+)$/, (el, p, m) => V.lesson(el, m[1]), 'learn', '課程'],
  [/^\/videos$/, (el, p) => V.videos(el, p), 'videos', '教學影片'],
  [/^\/venues$/, (el, p) => V.venues(el, p), 'venues', '羽球場館'],
  [/^\/venue\/([^/]+)$/, (el, p, m) => V.venue(el, decodeURIComponent(m[1])), 'venues', '場館資訊'],
  [/^\/groups$/, (el, p) => V.groups(el, p), 'groups', '零打團'],
  [/^\/gear$/, (el) => V.gear(el), 'gear', '球具指南'],
  [/^\/market$/, (el) => V.market(el), 'market', '二手買賣'],
  [/^\/favorites$/, (el) => V.favorites(el), 'more', '我的球筒'],
  [/^\/more$/, (el) => V.more(el), 'more', '更多'],
  [/^\/about$/, (el) => V.about(el), 'more', '資料狀態'],
  [/^\/install$/, (el) => V.install(el), 'more', '安裝 App'],
  [/^\/privacy$/, (el) => V.privacy(el), 'more', '隱私權'],
  [/^\/chubi$/, (el) => V.mascot(el), 'more', '認識啾比'],
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
  box.innerHTML = `<div class="loader">${chubi({ mood: 'wink', size: 54 })}<div class="net"></div>啾比發球中…</div>`;
  main.replaceChildren(box);
  try {
    if (!hit) V.notFound(box); else await hit.fn(box, params, hit.m);
  } catch (e) {
    console.error(e);
    if (id === renderId) box.innerHTML = html`<div class="empty">${raw(chubi({ mood: 'sad', size: 110 }))}<div class="big404" style="font-size:2rem">OUT!</div><p>啾比被打出界了，資料載入失敗。請檢查網路後再發一次球。</p><button class="btn primary" onclick="location.reload()">重新發球</button><p class="small muted">${e.message}</p></div>`.s;
  }
  if (id !== renderId) return;
  if (!params.has('n')) window.scrollTo(0, 0);
  $('#fact').innerHTML = html`<b>🪶 啾比冷知識：</b>${FACTS[Math.floor(Math.random() * FACTS.length)]}`.s;
  if (hit?.nav === 'search' && /殺球|smash|扣殺/i.test(params.get('q') || '')) {
    main.classList.remove('shake'); void main.offsetWidth; main.classList.add('shake');
    toast('啾！！輕一點啦，我的羽毛快掉光了～', 'wow');
  }
}

/* ---------- 全域事件委派 ---------- */
document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) {
    e.preventDefault();
    const on = favs.toggle(fav.dataset.fav, fav.dataset.id, JSON.parse(fav.dataset.snap || '{}'));
    $$(`[data-fav="${fav.dataset.fav}"][data-id="${CSS.escape(fav.dataset.id)}"]`).forEach((b) => { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; });
    const n = favs.count();
    toast(on ? (n % 12 === 0 ? '啾！一整筒 12 顆裝滿了，幫你開新的一筒 🧺' : `啾～收進球筒了（${n % 12}/12）`) : '從球筒拿出來了', on ? 'love' : 'wink');
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

/* ---------- 主題（夜場模式：啾比戴墨鏡） ---------- */
const isDark = () => (store.get('theme', '') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
function paintLogo() { $('#logoChubi').innerHTML = chubi({ mood: isDark() ? 'cool' : 'happy', size: 34, title: '啾比' }); }
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; paintLogo(); }
$$('[data-ico]').forEach((n) => { n.innerHTML = icon(n.dataset.ico, 22); });
$('#footChubi').innerHTML = chubi({ mood: 'happy', size: 40 });
applyTheme(store.get('theme', ''));
$('#themeBtn').addEventListener('click', () => {
  const next = isDark() ? 'light' : 'dark';
  store.set('theme', next); applyTheme(next);
  toast(next === 'dark' ? '夜場開打！記得帶毛巾 🌙' : '早場來囉，陽光正好 ☀️', next === 'dark' ? 'cool' : 'happy');
});

/* ---------- 彩蛋：戳啾比＝殺他一球（每 21 下贏一局） ---------- */
let pokes = store.get('pokes', 0);
function smash(from) {
  pokes += 1; store.set('pokes', pokes);
  const r = (from || $('#logoChubi')).getBoundingClientRect();
  const fly = document.createElement('div');
  fly.className = 'smash-fly'; fly.style.left = r.left + 'px'; fly.style.top = r.top + 'px';
  fly.innerHTML = chubi({ mood: 'wow', size: 70 });
  const speed = Math.min(565, 180 + pokes * 17 + Math.floor(Math.random() * 25));
  const sp = document.createElement('div'); sp.className = 'speed'; sp.textContent = `殺！${speed} km/h`;
  document.body.append(fly, sp);
  setTimeout(() => { fly.remove(); sp.remove(); }, 1100);
  if (pokes % 21 === 0) {
    for (let i = 0; i < 24; i++) {
      const c = document.createElement('div'); c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw'; c.style.animationDelay = Math.random() * 0.8 + 's';
      c.innerHTML = '<svg viewBox="0 0 16 26" width="14" height="22"><path d="M8 26C3 18 1 9 4 2q4-3 8 0c3 7 1 16-4 24z" fill="' + ['#f2b705', '#2f9be0', '#ef5b6b', '#0b7a5c'][i % 4] + '"/></svg>';
      document.body.append(c); setTimeout(() => c.remove(), 3600);
    }
    toast(`21 分！這局你贏了 🏆 啾比已經被殺了 ${pokes} 次，但他很開心`, 'love');
  } else if (speed >= 565) toast('565 km/h！追平人類最快殺球紀錄，啾比夢想成真 ✨', 'cool');
  else toast(['啾！好球！', '再大力一點～', '啾比飛出去了！', '這球漂亮！', '對手接不到啦！'][pokes % 5] + `（第 ${pokes % 21} 分）`, 'wow');
}
$('#logoChubi').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); smash(e.currentTarget); });
window.addEventListener('chubi:smash', () => smash($('.hero-mascot') || $('.profile .chubi')));

/* ---------- 回到頂端：一記高遠球 ---------- */
const toTop = $('#toTop');
addEventListener('scroll', () => toTop.classList.toggle('show', scrollY > 600), { passive: true });
toTop.addEventListener('click', () => {
  toTop.classList.add('fly'); scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => toTop.classList.remove('fly', 'show'), 800);
});

window.addEventListener('hashchange', render);
render();

/* ---------- PWA：Service Worker（Capacitor 原生環境不需要） ---------- */
if ('serviceWorker' in navigator && location.protocol === 'https:' && !platform.isNative()) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
