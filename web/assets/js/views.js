import {
  html, raw, safeUrl, $, $$, store, favs, progress, platform, api, linkMap,
  WEEK, ago, daysAgo, fmtDate, distKm, match, toast, issueUrl, CONFIG,
} from './core.js';
import { chubi, greeting } from './mascot.js';
import { icon } from './icons.js';

const CITIES = ['臺北市', '新北市', '基隆市', '桃園市', '新竹市', '新竹縣', '苗栗縣', '臺中市', '彰化縣', '南投縣', '雲林縣',
  '嘉義市', '嘉義縣', '臺南市', '高雄市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'];
const KIND = { 'sports-center': '運動中心', public: '公有場館', school: '學校', park: '運動公園', private: '民營球館' };
// 空狀態的啾比姿勢（emoji 參數對應到啾比表情與道具）
const POSE = { '🔍': ['wow', 'glass'], '🤔': ['sad', 'none'], '📭': ['sleep', 'none'], '🎬': ['wow', 'none'], '🏟️': ['wow', 'pin'],
  '🌱': ['love', 'racket'], '🤝': ['sleep', 'none'], '☆': ['happy', 'tube'], '🏸': ['sad', 'none'] };
const LEVELS = { new: '新手', low: '初階', mid: '中階', high: '中高階', pro: '高階' };

/* ================= shared UI pieces ================= */
const favBtn = (type, id, snap) => html`<button class="fav ${favs.has(type, id) ? 'on' : ''}" data-fav="${type}" data-id="${id}" data-snap="${JSON.stringify(snap)}" aria-label="收藏" title="收藏">${favs.has(type, id) ? '★' : '☆'}</button>`;
const ext = (url, label, cls = 'btn sm') => (safeUrl(url) ? html`<a class="${cls}" href="${safeUrl(url)}" target="_blank" rel="noopener" data-ext>${label}</a>` : '');
const linkBadge = (state) => (state === 'broken' ? html`<span class="badge bad" title="排程檢查發現此連結無法開啟">⚠ 連結可能失效</span>` : '');
const empty = (pose, msg, extra = '') => {
  const [mood, prop] = POSE[pose] || ['happy', 'none'];
  return html`<div class="empty">${raw(chubi({ mood, prop, size: 110 }))}<p>${msg}</p>${extra}</div>`;
};
/** 啾比羽毛成長：學會的課程越多，頭上的羽毛越多（16 根長齊＝完整羽毛球） */
function growCard(done, total) {
  const f16 = Math.round((done / total) * 16);
  const visible = Math.max(1, Math.round((f16 / 16) * 9));
  const line = f16 >= 16 ? '🎉 16 根羽毛全長齊了！你是一顆完整的羽毛球！'
    : f16 === 0 ? '啾比頭上只有 1 根羽毛… 學會一堂課就幫他長毛！'
      : `啾比已經長出 ${f16} / 16 根羽毛，再學 ${total - done} 堂就長齊了！`;
  return html`<div class="card grow">${raw(chubi({ mood: f16 >= 16 ? 'love' : done ? 'happy' : 'sad', prop: f16 >= 16 ? 'trophy' : 'cap', feathers: visible, size: 74 }))}
    <div class="info"><div class="row"><b>我的學習進度</b><span class="spacer"></span><span class="small muted">${done} / ${total} 堂</span></div>
    <div class="progress" style="margin:8px 0 6px"><i style="width:${Math.round((done / total) * 100)}%"></i></div><div class="small muted">${line}</div></div></div>`;
}
const head = (title, sub) => html`<div class="page-head"><h1>${title}</h1>${sub ? html`<p>${sub}</p>` : ''}</div>`;
const selectOpts = (list, cur, allLabel) => html`${allLabel ? html`<option value="">${allLabel}</option>` : ''}${list.map((o) => {
  const [v, l] = Array.isArray(o) ? o : [o, o];
  return html`<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${l}</option>`;
})}`;
function freshBadge(iso, okDays = 14, staleDays = 60) {
  const d = daysAgo(iso);
  if (d <= okDays) return html`<span class="badge ok">● ${ago(iso)}更新</span>`;
  if (d <= staleDays) return html`<span class="badge warn">● ${ago(iso)}更新，待確認</span>`;
  return html`<span class="badge bad">● 已過期</span>`;
}

/* 影片卡片：點擊才載入 iframe（省流量、保護隱私） */
const thumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/mqdefault.jpg`;
function videoCard(v, topics) {
  return html`<article class="card vcard">
    <button class="vthumb" data-play="${v.id}" data-title="${v.title}" aria-label="播放：${v.title}">
      <img loading="lazy" src="${thumb(v.id)}" alt="">${v.duration ? html`<span class="dur">${v.duration}</span>` : ''}
    </button>
    <div class="vb"><div class="vt">${v.title}</div>
      <div class="row small muted" style="margin-top:6px"><span>${v.channel}</span><span class="spacer"></span>
      ${topics ? html`<span class="badge">${topics[v.topic] || ''}</span>` : ''}${favBtn('video', v.id, { title: v.title, channel: v.channel })}</div>
    </div></article>`;
}
export function openPlayer(id, title) {
  const m = document.createElement('div');
  m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  m.innerHTML = html`<div class="modal-box"><div class="modal-head"><h3>${title}</h3><button class="icon-btn" data-close aria-label="關閉">✕</button></div>
    <iframe class="player" src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1" title="${title}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>
    <div class="row" style="margin-top:10px">${ext(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`, '在 YouTube 開啟')}
    <a class="btn sm" href="${issueUrl('report-broken.yml', { url: `https://www.youtube.com/watch?v=${id}`, item: title })}" target="_blank" rel="noopener">回報影片失效</a></div></div>`.s;
  const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(m); $('[data-close]', m).focus();
}

/* ================= HOME ================= */
export async function home(el) {
  const [venues, ptt, lessons, manifest, pick] = await Promise.all([
    api('venues/all.json'), api('ptt.json').catch(() => ({ items: [] })), api('lessons.json'), api('manifest.json').catch(() => ({})), api('pickups.json').catch(() => ({ items: [] })),
  ]);
  const myCity = store.get('city', '');
  const upcoming = pick.items.filter((p) => p.date >= todayISO());
  const groups = [...upcoming.filter((p) => !myCity || p.city === myCity), ...upcoming.filter((p) => myCity && p.city !== myCity)].slice(0, 4);
  const news = ptt.items.filter((i) => i.cat === 'news').slice(0, 5);
  const health = manifest.links || {};
  const done = Object.keys(progress.all()).length;
  const [mood, hello] = greeting();
  const feathers = [8, 30, 55, 78].map((l, i) => `<svg class="feather" style="left:${l}%;top:${i * 7}%;animation-delay:${i * 2.1}s" viewBox="0 0 16 26"><path d="M8 26C3 18 1 9 4 2q4-3 8 0c3 7 1 16-4 24z"/></svg>`).join('');
  el.innerHTML = html`
  <section class="hero">
    <svg class="court" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#fff" stroke-width="2">
      <rect x="10" y="10" width="380" height="180"/><path d="M200 10v180M10 30h380M10 170h380M150 10v180M250 10v180M10 100h140M250 100h140"/></g></svg>
    ${raw(feathers)}
    <button class="hero-mascot" data-poke aria-label="戳戳啾比" style="background:none;border:0;padding:0">${raw(chubi({ mood, prop: 'racket', size: 170 }))}</button>
    <div class="hero-in">
      <div><span class="bubble">啾比：${hello}</span></div>
      <h1>全台羽球，一站搞定</h1>
      <p>教學影片、找球場、找零打團、挑球具，資料每週自動更新與檢查。</p>
      <form class="search" action="#/search" data-search><label class="sr-only" for="q">搜尋</label>
        <input id="q" name="q" type="search" placeholder="搜尋場館、教學、影片、品牌…（例：大安運動中心、殺球）" autocomplete="off" enterkeyhint="search"></form>
      <div class="score" aria-label="網站數據">
        <div><b>${venues.items.length.toLocaleString()}</b><span>羽球場館</span></div>
        <div><b>${String(lessons.items.length).padStart(2, '0')}</b><span>堂課程</span></div>
        <div><b>${manifest.counts?.videos || '—'}</b><span>教學影片</span></div>
        <div><b>21</b><span>分一局</span></div>
      </div>
    </div>
  </section>

  <section class="section"><div class="grid g4">
    ${[['#/learn', 'learn', 't-green', '教學課程', '從握拍到戰術'], ['#/videos', 'video', 't-coral', '教學影片', '20 個主題精選'], ['#/venues', 'venue', 't-sky', '找場館', '公立＋民營・地圖導航'], ['#/groups', 'group', 't-sun', '零打團', '臨打揪團即時看'],
      ['#/gear', 'gear', 't-grape', '球具指南', '選拍・磅數・球鞋'], ['#/market', 'market', 't-teal', '二手買賣', '平台與防詐提醒'], ['#/favorites', 'star', 't-pink', '我的球筒', '收藏常去的球場'], ['#/chubi', 'bolt', 't-ink', '認識啾比', '本站吉祥物']]
      .map(([href, ic, c, t, sub]) => html`<a class="card link tile ${c}" href="${href}"><span class="ti">${raw(icon(ic, 26))}</span><b>${t}</b><span>${sub}</span></a>`)}
  </div></section>

  <section class="section">
    <div class="section-h"><h2>📍 我附近的羽球場</h2><a href="#/venues?sort=near">看全部</a></div>
    <div id="near"><button class="btn primary" data-near>${raw(icon('venue', 16))} 使用我的位置找球場</button> <span class="small muted">位置只在你的裝置上計算，不會上傳。</span></div>
  </section>

  ${done ? html`<section class="section">${growCard(done, lessons.items.length)}</section>` : ''}

  <section class="section">
    <div class="section-h"><h2>🤝 ${myCity ? myCity + '・' : ''}近期零打開團</h2><a href="#/groups">看全部 ${upcoming.length} 場</a></div>
    ${groups.length ? html`<div class="grid g2">${groups.map(pickupCard)}</div>` : empty('🤝', '目前沒有新的開團')}
  </section>

  <section class="section">
    <div class="section-h"><h2>📰 羽球新聞與賽事討論</h2>${ext(ptt.sourceUrl, 'PTT 羽球板', '')}</div>
    <div class="card"><div class="list">${news.length ? news.map((n) => html`<div class="li"><div class="body"><a href="${safeUrl(n.url)}" target="_blank" rel="noopener" class="title">${n.title}</a>
      <div class="small muted">${ago(n.postedAt)} · ${n.author}</div></div></div>`) : html`<p class="muted">暫無</p>`}</div></div>
  </section>

  <section class="section"><div class="card"><div class="row">
    <span class="health"><span class="dot ${health.broken > 20 ? 'warn' : ''}"></span><b>資料健康度</b></span>
    <span class="small muted">最後更新 ${ago(manifest.generatedAt)} · 連結檢查 ${health.ok ?? '—'} 正常 / ${health.broken ?? '—'} 失效</span>
    <span class="spacer"></span><a class="btn sm" href="#/about">查看詳情</a></div></div></section>`.s;

  $('[data-near]', el).addEventListener('click', async (e) => {
    const box = $('#near', el); e.target.disabled = true; e.target.textContent = '定位中…';
    try {
      const me = await platform.locate();
      store.set('lastLoc', me);
      const near = venues.items.filter((v) => v.lat && v.rent !== '不開放租借').map((v) => ({ ...v, km: distKm(me, v) })).sort((a, b) => a.km - b.km).slice(0, 6);
      box.innerHTML = html`<div class="grid g3">${near.map((v) => venueCard(v, {}))}</div>`.s;
    } catch (err) { box.innerHTML = html`<div class="callout warn">${err.message}，你也可以 <a href="#/venues">依縣市查詢</a>。</div>`.s; }
  });
  $('[data-poke]', el).addEventListener('click', () => window.dispatchEvent(new CustomEvent('chubi:smash')));
}

/* ================= SEARCH ================= */
export async function search(el, params) {
  const q = (params.get('q') || '').trim();
  const [venues, lessons, videos, gear] = await Promise.all([api('venues/all.json'), api('lessons.json'), api('videos.json'), api('gear.json')]);
  const rV = q ? venues.items.filter((v) => match(q, v.name, v.address, v.district)).slice(0, 30) : [];
  const rL = q ? lessons.items.filter((l) => match(q, l.title, l.summary, ...(l.steps || []))) : [];
  const rVid = q ? videos.items.filter((v) => match(q, v.title, v.channel, videos.topics[v.topic])).slice(0, 12) : [];
  const rB = q ? [...gear.brands, ...gear.buy].filter((b) => match(q, b.name, b.note)) : [];
  const total = rV.length + rL.length + rVid.length + rB.length;
  el.innerHTML = html`${head('搜尋')}
    <form class="search" data-search style="margin-bottom:16px"><input name="q" type="search" value="${q}" placeholder="輸入關鍵字" autofocus enterkeyhint="search"></form>
    ${!q ? empty('🔍', '輸入場館名稱、地區、技術名稱或品牌') : total === 0 ? empty('🤔', `找不到「${q}」相關結果`) : ''}
    ${rL.length ? html`<section class="section"><h2>🎓 課程（${rL.length}）</h2><div class="grid g3">${rL.map(lessonCard)}</div></section>` : ''}
    ${rV.length ? html`<section class="section"><h2>📍 場館（${rV.length}${rV.length === 30 ? '+' : ''}）</h2><div class="grid g3">${rV.map((v) => venueCard(v, {}))}</div></section>` : ''}
    ${rVid.length ? html`<section class="section"><h2>▶️ 影片（${rVid.length}）</h2><div class="grid g3">${rVid.map((v) => videoCard(v, videos.topics))}</div></section>` : ''}
    ${rB.length ? html`<section class="section"><h2>🏸 品牌與通路（${rB.length}）</h2><div class="grid g3">${rB.map((b) => html`<div class="card"><h3>${b.name}</h3><p class="small muted">${b.note}</p>${ext(b.url, '前往')}</div>`)}</div></section>` : ''}`.s;
}

/* ================= LEARN ================= */
function lessonCard(l) {
  const done = progress.has(l.id);
  return html`<a class="card link" href="#/learn/${l.id}">
    <div class="row"><span class="badge brand">${l.level}</span><span class="small muted">約 ${l.minutes} 分鐘</span><span class="spacer"></span>${done ? html`<span class="badge ok">✓ 已學會</span>` : ''}</div>
    <h3 style="margin-top:8px">${l.title}</h3><p class="small muted" style="margin:0">${l.summary}</p></a>`;
}
export async function learn(el, params) {
  const data = await api('lessons.json');
  const cat = params.get('cat') || '';
  const lv = params.get('level') || '';
  const items = data.items.filter((l) => (!cat || l.category === cat) && (!lv || l.level === lv));
  const done = Object.keys(progress.all()).filter((id) => data.items.some((l) => l.id === id)).length;
  el.innerHTML = html`${head('羽球教學', '依程度循序漸進，每堂課搭配圖文重點、常見錯誤、練習方法與精選影片。')}
    <div style="margin-bottom:14px">${growCard(done, data.items.length)}</div>
    <div class="chips" role="tablist">${[['', '全部'], ...data.categories.map((c) => [c.id, `${c.icon} ${c.name}`])].map(([id, n]) => html`<a class="chip ${cat === id ? 'on' : ''}" href="#/learn?cat=${id}${lv ? '&level=' + lv : ''}">${n}</a>`)}</div>
    <div class="chips">${['', ...data.levels].map((l) => html`<a class="chip ${lv === l ? 'on' : ''}" href="#/learn?level=${l}${cat ? '&cat=' + cat : ''}">${l || '所有程度'}</a>`)}</div>
    ${cat ? '' : html`<div class="grid g3" style="margin:6px 0 18px">${data.categories.map((c) => html`<a class="card link" href="#/learn?cat=${c.id}"><div style="font-size:26px">${c.icon}</div><b>${c.name}</b><div class="small muted">${c.desc}</div></a>`)}</div>`}
    <div class="grid g3">${items.map(lessonCard)}</div>
    ${items.length ? '' : empty('📭', '這個條件下沒有課程')}`.s;
}
export async function lesson(el, id) {
  const [data, videos] = await Promise.all([api('lessons.json'), api('videos.json')]);
  const l = data.items.find((x) => x.id === id);
  if (!l) { el.innerHTML = empty('🤔', '找不到這堂課').s; return; }
  const cat = data.categories.find((c) => c.id === l.category);
  const vids = videos.items.filter((v) => v.topic === l.videoTopic).slice(0, 4);
  const idx = data.items.indexOf(l); const next = data.items[idx + 1];
  const done = progress.has(l.id);
  el.innerHTML = html`<p class="small"><a href="#/learn">教學</a> › <a href="#/learn?cat=${cat.id}">${cat.name}</a></p>
    <div class="page-head"><div class="row"><span class="badge brand">${l.level}</span><span class="small muted">約 ${l.minutes} 分鐘</span></div>
      <h1 style="margin-top:6px">${l.title}</h1><p>${l.summary}</p></div>
    <div class="grid g2">
      <div>
        <div class="card"><h2>動作步驟</h2><ol class="steps">${l.steps.map((s) => html`<li>${s}</li>`)}</ol></div>
        ${l.mistakes?.length ? html`<div class="card callout warn" style="margin-top:12px"><h3>⚠ 常見錯誤</h3><ul class="bullets">${l.mistakes.map((s) => html`<li>${s}</li>`)}</ul></div>` : ''}
        ${l.drills?.length ? html`<div class="card" style="margin-top:12px"><h3>🏋️ 練習方法</h3><ul class="bullets">${l.drills.map((s) => html`<li>${s}</li>`)}</ul></div>` : ''}
        <div class="row" style="margin-top:14px">
          <button class="btn ${done ? '' : 'primary'}" data-learned="${l.id}">${done ? '✓ 已學會（點擊取消）' : '標記為已學會'}</button>
          ${next ? html`<a class="btn" href="#/learn/${next.id}">下一堂：${next.title} →</a>` : ''}
        </div>
      </div>
      <div><h2>精選教學影片</h2><div class="grid">${vids.map((v) => videoCard(v))}</div>
        <p class="small muted">影片由 YouTube 創作者提供，版權屬原作者。<a href="#/videos?topic=${l.videoTopic}">看更多「${videos.topics[l.videoTopic]}」影片 →</a></p></div>
    </div>`.s;
  $('[data-learned]', el).addEventListener('click', () => {
    const on = progress.toggle(l.id);
    toast(on ? '啾！學會了，啾比長出新羽毛 🪶' : '啾比的羽毛掉了一根…', on ? 'love' : 'sad');
    lesson(el, id);
  });
}

/* ================= VIDEOS ================= */
export async function videos(el, params) {
  const data = await api('videos.json');
  const lm = await linkMap();
  const topic = params.get('topic') || '';
  const q = params.get('q') || '';
  const list = data.items.filter((v) => (!topic || v.topic === topic) && match(q, v.title, v.channel) && lm[`https://www.youtube.com/watch?v=${v.id}`]?.s !== 'broken');
  el.innerHTML = html`${head('教學影片', `精選 ${data.items.length} 部中文羽球教學影片，每週自動檢查是否仍可播放。`)}
    <form class="search" data-filter style="margin-bottom:10px"><input name="q" type="search" value="${q}" placeholder="搜尋影片標題或頻道" enterkeyhint="search"></form>
    <div class="chips">${[['', '全部'], ...Object.entries(data.topics)].map(([k, n]) => html`<a class="chip ${topic === k ? 'on' : ''}" href="#/videos?topic=${k}">${n}</a>`)}</div>
    <div class="count">${list.length} 部影片</div>
    <div class="grid g3">${list.map((v) => videoCard(v, data.topics))}</div>${list.length ? '' : empty('🎬', '沒有符合的影片')}`.s;
  $('[data-filter]', el).addEventListener('submit', (e) => { e.preventDefault(); const p = new URLSearchParams(params); p.set('q', e.target.q.value); location.hash = '#/videos?' + p; });
}

/* ================= VENUES ================= */
function venueCard(v, lm) {
  const web = v.website && lm[v.website]?.s !== 'broken' ? v.website : '';
  return html`<article class="card">
    <div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><a href="#/venue/${v.id}"><h3>${v.name}</h3></a>
      <div class="meta"><span>${v.city}${v.district}</span>${v.km != null ? html`<span>📏 ${v.km.toFixed(1)} km</span>` : ''}</div></div>
      ${favBtn('venue', v.id, { name: v.name, city: v.city, district: v.district })}</div>
    <div class="row" style="margin-top:6px"><span class="badge brand">${KIND[v.kind] || ''}</span>
      ${v.rent === '付費' ? html`<span class="badge info">可付費租借</span>` : v.rent === '免費' ? html`<span class="badge ok">免費租借</span>` : html`<span class="badge">不對外租借</span>`}
      ${v.open && v.open !== '不開放' ? html`<span class="badge">${v.open}</span>` : ''}
      ${v.sourceName === '網路整理' ? html`<span class="badge warn" title="由網路資料整理，尚未經場館確認">待查證</span>` : ''}${v.sourceName === '社群投稿' ? html`<span class="badge ok">球友推薦</span>` : ''}</div>
    <p class="small muted" style="margin:8px 0 0">${v.address || '地址待補，可用名稱導航'}${v.note ? html`<br>${v.note}` : ''}</p>
    <div class="actions">${ext(platform.navUrl(v), '🧭 導航')}${v.tel ? html`<a class="btn sm" href="tel:${v.tel.replace(/[^\d#+]/g, '').replace('#', ',')}">📞 電話</a>` : ''}${ext(web, webLabel(web || ''))}<a class="btn sm ghost" href="#/venue/${v.id}">詳細</a></div>
  </article>`;
}
let map, layer;
export async function venues(el, params) {
  const [data, lm] = await Promise.all([api('venues/all.json'), linkMap()]);
  const st = {
    city: params.has('city') ? params.get('city') : store.get('city', '臺北市'),
    district: params.get('district') || '', kind: params.get('kind') || '', rent: params.get('rent') || 'open',
    q: params.get('q') || '', sort: params.get('sort') || '', view: params.get('view') || store.get('venueView', 'list'),
  };
  if (params.has('city')) store.set('city', st.city);
  const districts = [...new Set(data.items.filter((v) => v.city === st.city).map((v) => v.district).filter(Boolean))].sort();
  const me = st.sort === 'near' ? store.get('lastLoc', null) : null;
  let list = data.items.filter((v) => (st.sort === 'near' || !st.city || v.city === st.city) && (!st.district || v.district === st.district)
    && (!st.kind || v.kind === st.kind) && (st.rent === 'all' || (st.rent === 'open' ? v.rent !== '不開放租借' : v.rent === st.rent)) && match(st.q, v.name, v.address));
  if (me) list = list.filter((v) => v.lat).map((v) => ({ ...v, km: distKm(me, v) })).sort((a, b) => a.km - b.km);
  const shown = Math.min(list.length, Number(params.get('n')) || 30);
  const set = (k, v) => { const p = new URLSearchParams(params); if (v === '' || v == null) p.delete(k); else p.set(k, v); if (k === 'city') p.delete('district'); p.delete('n'); location.hash = '#/venues?' + p; };

  el.innerHTML = html`${head('羽球場館', raw(`全台 <b>${data.items.length.toLocaleString()}</b> 處含羽球場的場館，公立場館來自教育部體育署 iPlay，民營球館來自 Overture Maps（Facebook 商家粉專）、OpenStreetMap 與網路整理，每週自動同步。`))}
    <div class="filters">
      <select class="field" data-k="city" aria-label="縣市" ${st.sort === 'near' ? 'disabled' : ''}>${selectOpts(CITIES, st.city, '全部縣市')}</select>
      <select class="field" data-k="district" aria-label="行政區" ${st.sort === 'near' ? 'disabled' : ''}>${selectOpts(districts, st.district, '全部行政區')}</select>
      <select class="field" data-k="kind" aria-label="類型">${selectOpts(Object.entries(KIND), st.kind, '全部類型')}</select>
      <select class="field" data-k="rent" aria-label="租借">${selectOpts([['open', '可使用（排除不開放）'], ['付費', '可付費租借'], ['免費', '免費租借'], ['all', '全部（含不開放）']], st.rent)}</select>
      <form data-q class="full" style="grid-column:1/-1"><input class="field" name="q" type="search" value="${st.q}" placeholder="搜尋場館名稱或地址（例：運動中心、國小）" enterkeyhint="search"></form>
    </div>
    <div class="row" style="margin-bottom:10px">
      <div class="seg"><button data-view="list" class="${st.view === 'list' ? 'on' : ''}">列表</button><button data-view="map" class="${st.view === 'map' ? 'on' : ''}">地圖</button></div>
      <button class="btn sm ${st.sort === 'near' ? 'primary' : ''}" data-near>📍 ${st.sort === 'near' ? '依距離排序中' : '離我最近'}</button>
      <span class="spacer"></span>
      <a class="btn sm" href="${issueUrl('new-venue.yml', { city: st.city })}" target="_blank" rel="noopener">＋ 新增私人球館</a>
    </div>
    <div class="count">共 ${list.length} 處${st.sort === 'near' ? '（全台依距離）' : ''}</div>
    <div id="vbody"></div>`.s;

  const body = $('#vbody', el);
  if (st.view === 'map') {
    body.innerHTML = '<div class="map" id="map"></div><p class="small muted">地圖 © OpenStreetMap 貢獻者</p>';
    drawMap($('#map', el), list.slice(0, 1500), me);
  } else {
    body.innerHTML = html`${list.length ? html`<div class="grid g3">${list.slice(0, shown).map((v) => venueCard(v, lm))}</div>` : empty('🏟️', '沒有符合條件的場館，試試放寬篩選')}
      ${shown < list.length ? html`<div class="more-btn"><button class="btn" data-more>顯示更多（還有 ${list.length - shown} 處）</button></div>` : ''}`.s;
    $('[data-more]', el)?.addEventListener('click', () => set('n', shown + 30));
  }
  $$('select[data-k]', el).forEach((s) => s.addEventListener('change', () => set(s.dataset.k, s.value)));
  $('[data-q]', el).addEventListener('submit', (e) => { e.preventDefault(); set('q', e.target.q.value.trim()); });
  $$('[data-view]', el).forEach((b) => b.addEventListener('click', () => { store.set('venueView', b.dataset.view); set('view', b.dataset.view); }));
  $('[data-near]', el).addEventListener('click', async (e) => {
    if (st.sort === 'near') return set('sort', '');
    e.target.textContent = '定位中…';
    try { store.set('lastLoc', await platform.locate()); set('sort', 'near'); } catch (err) { toast(err.message); e.target.textContent = '📍 離我最近'; }
  });
}
function drawMap(node, list, me) {
  if (!window.L) { node.innerHTML = '<p class="empty">地圖載入失敗，請改用列表</p>'; return; }
  map?.remove();
  map = L.map(node, { zoomControl: true, attributionControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  layer = L.featureGroup().addTo(map);
  const color = { 'sports-center': '#0b7a5c', public: '#2563a8', school: '#8a5cf6', park: '#b26a00', private: '#c0392b' };
  list.filter((v) => v.lat).forEach((v) => {
    L.circleMarker([v.lat, v.lng], { radius: v.kind === 'sports-center' ? 9 : 6, color: '#fff', weight: 1.5, fillColor: color[v.kind] || '#555', fillOpacity: .9 })
      .bindPopup(html`<b>${v.name}</b><br><span>${v.address}</span><br><a href="#/venue/${v.id}">詳細資訊</a> · <a href="${platform.navUrl(v)}" target="_blank" rel="noopener">導航</a>`.s)
      .addTo(layer);
  });
  if (me) L.circleMarker([me.lat, me.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#e11', fillOpacity: 1 }).bindPopup('你的位置').addTo(layer);
  if (layer.getLayers().length) map.fitBounds(layer.getBounds().pad(0.1), { maxZoom: 15 }); else map.setView([23.7, 121], 7);
}
export async function venue(el, id) {
  const all = await api('venues/all.json');
  const v0 = all.items.find((x) => x.id === id);
  if (!v0) { el.innerHTML = empty('🤔', '找不到此場館，可能已下架或改名', html`<a class="btn" href="#/venues">回場館列表</a>`).s; return; }
  const isGov = id.startsWith('iplay-');
  const [city, lm] = await Promise.all([isGov ? api(`venues/${all.slugs[v0.city]}.json`).catch(() => ({ items: [] })) : Promise.resolve({ items: [] }), linkMap()]);
  const v = { ...v0, ...(city.items.find((x) => x.id === id) || {}) };
  el.innerHTML = html`<p class="small"><a href="#/venues">場館</a> › <a href="#/venues?city=${v.city}">${v.city}</a> › ${v.district}</p>
    <div class="row" style="align-items:flex-start"><div style="flex:1"><h1>${v.name}</h1>
      <div class="row"><span class="badge brand">${KIND[v.kind]}</span><span class="badge">${v.rent === '不開放租借' ? '不對外租借' : v.rent + '租借'}</span>${v.open ? html`<span class="badge">${v.open}</span>` : ''}
      ${v.rateCount ? html`<span class="badge">★ ${v.rate}（${v.rateCount} 則 iPlay 評分）</span>` : ''}${linkBadge(lm[v.website]?.s)}</div></div>
      ${favBtn('venue', v.id, { name: v.name, city: v.city, district: v.district })}</div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card">
        ${v.photo ? html`<img src="${safeUrl(v.photo)}" alt="${v.name}" loading="lazy" style="border-radius:10px;margin-bottom:12px;aspect-ratio:16/9;object-fit:cover;width:100%" onerror="this.remove()">` : ''}
        <dl class="kv"><dt>地址</dt><dd>${v.address}</dd>${v.tel ? html`<dt>電話</dt><dd><a href="tel:${v.tel.replace(/[^\d#+]/g, '').replace('#', ',')}">${v.tel}</a></dd>` : ''}
        ${v.website ? html`<dt>官網</dt><dd>${ext(v.website, v.website, '')}</dd>` : ''}<dt>設施</dt><dd>${v.facilities || '—'}</dd>
        ${v.note ? html`<dt>備註</dt><dd>${v.note}</dd>` : ''}
        <dt>資料來源</dt><dd>${v.source ? ext(v.source, isGov ? '教育部體育署 iPlay' : v.sourceName || '來源', '') : v.sourceName || '社群投稿'}<br><span class="small muted">同步於 ${fmtDate(city.updatedAt || all.generatedAt)}</span>
          ${v.verified === false ? html`<br><span class="badge warn">待查證：資料由網路整理，出發前請先電話確認</span>` : ''}${v.approx ? html`<br><span class="small muted">📍 地圖位置為路段概略位置</span>` : ''}</dd></dl>
        <div class="actions" style="margin-top:14px">${ext(platform.navUrl(v), '🧭 導航', 'btn primary')}${ext(platform.gmapsUrl(v), '⭐ Google 地圖評論')}
          ${v.tel ? html`<a class="btn" href="tel:${v.tel.replace(/[^\d#+]/g, '').replace('#', ',')}">📞 撥打</a>` : ''}${ext(v.website, '🌐 官網／預約', 'btn')}
          <button class="btn" data-share>分享</button></div>
      </div>
      <div><div class="map small" id="vmap"></div>
        <div class="card" style="margin-top:12px"><h3>這個場館有零打團嗎？</h3>
          <p class="small muted">查看此場館的揪團資訊，或幫忙登錄你知道的團。</p>
          <div class="actions"><a class="btn sm" href="#/groups?q=${encodeURIComponent(v.name.replace(/^(臺|台).{1,2}[市縣]/, '').slice(0, 6))}">查揪團</a>
          <a class="btn sm" href="${issueUrl('new-group.yml', { venue: v.name, city: v.city })}" target="_blank" rel="noopener">＋ 登錄零打團</a></div></div>
        <div class="callout warn small" style="margin-top:12px">開放時間、租金可能變動，出發前請先電話確認。資料有誤？
          <a href="${issueUrl('report-broken.yml', { item: `${v.name}（${v.id}）`, url: v.source })}" target="_blank" rel="noopener">回報錯誤</a></div>
      </div>
    </div>`.s;
  $('[data-share]', el).addEventListener('click', () => platform.share({ title: v.name, text: `${v.name}｜${v.address}`, url: CONFIG.site + '#/venue/' + v.id }));
  if (window.L && v.lat) {
    map?.remove();
    map = L.map($('#vmap', el), { attributionControl: false, scrollWheelZoom: false }).setView([v.lat, v.lng], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    L.marker([v.lat, v.lng]).addTo(map);
  } else $('#vmap', el).remove();
}

/* 球具店、俱樂部共用卡片（Overture／社群投稿） */
const telHref = (t) => 'tel:' + String(t).replace(/[^\d#+]/g, '').replace('#', ',');
const webLabel = (u) => (/facebook\.com/.test(u) ? '👍 粉專' : /instagram/.test(u) ? '📷 IG' : /line\.me|lin\.ee/.test(u) ? '💬 LINE' : /shopee/.test(u) ? '🛒 蝦皮' : '🌐 網站');
function placeCard(x, badgeText) {
  return html`<article class="card"><div class="row" style="align-items:flex-start"><div style="flex:1;min-width:0"><h3>${x.name}</h3>
      <div class="meta"><span>${x.city}${x.district || ''}</span>${badgeText ? html`<span class="badge brand">${badgeText}</span>` : ''}${(x.services || []).map((sv) => html`<span class="badge">${sv}</span>`)}</div></div></div>
    ${x.address ? html`<p class="small muted" style="margin:6px 0 0">${x.address}</p>` : ''}
    <div class="actions">${ext(platform.gmapsUrl(x), '🗺 Google 地圖')}${x.tel ? html`<a class="btn sm" href="${telHref(x.tel)}">📞 電話</a>` : ''}${ext(x.website, webLabel(x.website || ''))}</div></article>`;
}

/* ================= GROUPS 零打團 ================= */
function pttGroupCard(i) {
  const g = i.group || {};
  return html`<article class="card">
    <div class="row"><span class="badge info">PTT</span>${g.longTerm ? html`<span class="badge brand">長期團</span>` : html`<span class="badge">單次</span>`}${i.city ? html`<span class="badge">${i.city}</span>` : ''}<span class="spacer"></span><span class="small muted">${ago(i.postedAt)}</span></div>
    <h3 style="margin-top:8px">${g.venue || i.title}</h3>
    <div class="meta">${g.weekdays?.length ? html`<span>📅 每週${g.weekdays.map((d) => WEEK[d]).join('、')}</span>` : ''}${g.start ? html`<span>⏰ ${g.start}–${g.end}</span>` : ''}</div>
    <p class="small muted" style="margin:6px 0 0">${i.title}</p>
    <div class="actions">${ext(i.url, '查看原文並聯絡團主', 'btn sm primary')}</div></article>`;
}
function groupCard(g, ttl) {
  const age = daysAgo(g.confirmedAt);
  return html`<article class="card">
    <div class="row"><span class="badge ok">社群登錄</span><span class="badge">${g.city}${g.district || ''}</span>${freshBadge(g.confirmedAt, 14, ttl)}<span class="spacer"></span>${favBtn('group', g.id, { name: g.name, city: g.city })}</div>
    <h3 style="margin-top:8px">${g.name}</h3>
    <div class="meta"><span>📍 ${g.venue}</span><span>📅 每週${(g.weekdays || []).map((d) => WEEK[d]).join('、')}</span><span>⏰ ${g.start}–${g.end}</span></div>
    <div class="meta">${g.levels?.length ? html`<span>程度：${g.levels.map((l) => LEVELS[l] || l).join('、')}</span>` : ''}${g.fee ? html`<span>費用：${g.fee}</span>` : ''}${g.shuttle ? html`<span>用球：${g.shuttle}</span>` : ''}</div>
    ${g.note ? html`<p class="small" style="margin:6px 0 0">${g.note}</p>` : ''}
    <div class="actions">${ext(g.contact, '聯絡團主', 'btn sm primary')}
      <a class="btn sm" href="${issueUrl('confirm-group.yml', { group_id: g.id, group_name: g.name })}" target="_blank" rel="noopener">${age > 14 ? '我是團主：確認仍在運作' : '更新資訊'}</a>
      <a class="btn sm ghost" href="${issueUrl('report-broken.yml', { item: `零打團 ${g.name}（${g.id}）` })}" target="_blank" rel="noopener">回報</a></div></article>`;
}
/* 近期開團卡片（臨打情報站／GRASS） */
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function dayLabel(iso, wd) {
  const t = todayISO();
  const rel = iso === t ? '今天' : iso === addDays(t, 1) ? '明天' : iso === addDays(t, 2) ? '後天' : '';
  const [, m, d] = iso.split('-');
  return `${rel ? rel + ' ' : ''}${+m}/${+d}（${wd}）`;
}
export function pickupCard(p) {
  const navTarget = { name: p.venue, address: p.address || `${p.city}${p.district} ${p.venue}` };
  return html`<article class="card pickup">
    <div class="row"><span class="badge ${p.date === todayISO() ? 'warn' : 'brand'}">📅 ${dayLabel(p.date, p.weekday)}${p.dateEnd ? ' 起' : ''}</span>${p.time ? html`<span class="badge info">⏰ ${p.time}</span>` : ''}
      <span class="spacer"></span><span class="small muted">${p.city}${p.district}</span></div>
    <h3 style="margin-top:8px">${p.venue || p.title}</h3>
    ${p.venue && p.title ? html`<div class="small muted">${p.title}</div>` : ''}
    <div class="row" style="margin-top:6px">${p.level ? html`<span class="badge">程度 ${p.level}</span>` : ''}${p.price ? html`<span class="badge ok">💰 ${p.price}</span>` : ''}${p.ball ? html`<span class="badge">🏸 ${p.ball}</span>` : ''}</div>
    ${p.facilities ? html`<div class="small muted" style="margin-top:6px">${p.facilities}</div>` : ''}
    ${p.note ? html`<p class="small" style="margin:6px 0 0">${p.note}</p>` : ''}
    <div class="actions">${ext(p.link, '報名／看詳情', 'btn sm primary')}${ext(platform.navUrl(navTarget), '🧭 導航')}<span class="small muted" style="align-self:center">來源：${p.via}</span></div>
  </article>`;
}
function lineCard(c) {
  const d = daysAgo(c.lastActive);
  return html`<article class="card">
    <div class="row"><span class="badge ok">💬 LINE 社群</span><span class="badge">👥 ${Number(c.members).toLocaleString()} 人</span>${c.city ? html`<span class="badge">${c.city}</span>` : html`<span class="badge">跨區</span>`}</div>
    <h3 style="margin-top:8px">${c.name}</h3>
    ${c.desc ? html`<p class="small muted" style="margin:4px 0 0">${c.desc}</p>` : ''}
    <div class="actions">${ext(c.url, '加入社群', 'btn sm primary')}${isFinite(d) ? html`<span class="small muted" style="align-self:center">最近活躍：${d <= 0 ? '今天' : d + ' 天前'}</span>` : ''}</div></article>`;
}
function threadsCard(t) {
  return html`<article class="card"><div class="row"><span class="badge info">Threads</span>${t.city ? html`<span class="badge">${t.city}</span>` : ''}<span class="spacer"></span><span class="small muted">${ago(t.postedAt)}</span></div>
    <p style="margin:8px 0 0">${t.text}</p><div class="actions">${ext(t.url, '看原文並聯絡', 'btn sm primary')}</div></article>`;
}

export async function groups(el, params) {
  const none = { items: [] };
  const [ptt, comm, clubs, pick, line, threads] = await Promise.all([api('ptt.json').catch(() => none), api('groups.json').catch(() => ({ items: [], ttlDays: 60 })),
    api('clubs.json').catch(() => none), api('pickups.json').catch(() => none), api('line_groups.json').catch(() => none), api('threads.json').catch(() => none)]);
  const tab = params.get('tab') || 'pickups';
  const city = params.has('city') ? params.get('city') : store.get('city', '');
  const wd = params.get('wd') ?? '';
  const when = params.get('when') || '';
  const q = params.get('q') || '';
  const showExpired = params.get('expired') === '1';
  const ttl = comm.ttlDays || 60;
  const okCity = (c) => !city || c === city;
  const okWd = (days) => wd === '' || (days || []).includes(Number(wd));
  const t0 = todayISO();
  const okWhen = (p) => !when || (when === 'today' ? p.date === t0 : when === 'tomorrow' ? p.date === addDays(t0, 1)
    : when === 'weekend' ? ['六', '日'].includes(p.weekday) && p.date <= addDays(t0, 7) : true);
  const pk = pick.items.filter((p) => p.date >= t0 && okCity(p.city) && okWhen(p) && (wd === '' || WEEK[Number(wd)] === p.weekday) && match(q, p.title, p.venue, p.address, p.note));
  const lg = line.items.filter((c) => (!city || c.city === city || !c.city) && match(q, c.name, c.desc));
  const cg = comm.items.filter((g) => (showExpired || daysAgo(g.confirmedAt) <= ttl) && okCity(g.city) && okWd(g.weekdays) && match(q, g.name, g.venue, g.note));
  const pg = ptt.items.filter((i) => i.cat === 'group' && okCity(i.city) && okWd(i.group?.weekdays) && match(q, i.title));
  const tg = threads.items.filter((t) => okCity(t.city) && match(q, t.text));
  const cl = clubs.items.filter((c) => okCity(c.city) && match(q, c.name, c.address));
  const expiredN = comm.items.filter((g) => daysAgo(g.confirmedAt) > ttl).length;
  const shown = Number(params.get('n')) || 24;
  const set = (k, v) => { const p = new URLSearchParams(params); if (v === '' || v == null) p.delete(k); else p.set(k, v); if (k !== 'n') p.delete('n'); location.hash = '#/groups?' + p; };
  const tabs = [['pickups', `📅 近期開團`, pk.length], ['line', '💬 LINE 社群', lg.length], ['posts', '📝 揪人貼文', cg.length + pg.length + tg.length], ['clubs', '🏸 球隊俱樂部', cl.length]];
  const more = (n) => (n > shown ? html`<div class="more-btn"><button class="btn" data-more>顯示更多（還有 ${n - shown} 筆）</button></div>` : '');
  let body;
  if (tab === 'pickups') {
    body = html`<div class="chips">${[['', '全部日期'], ['today', '今天'], ['tomorrow', '明天'], ['weekend', '這個週末']].map(([v, l]) => html`<button class="chip ${when === v ? 'on' : ''}" data-when="${v}">${l}</button>`)}</div>
      <p class="small muted">每 6 小時從 ${(pick.sources || []).map((s, i) => html`${i ? '、' : ''}${ext(s.url, s.name, '')}`)} 彙整，過了日期自動下架。最後更新：${ago(pick.updatedAt)}。報名請點進原始頁面，以團主公告為準。</p>
      ${pk.length ? html`<div class="grid g3">${pk.slice(0, shown).map(pickupCard)}</div>${more(pk.length)}` : empty('📭', '這個條件下目前沒有開團，換個日期或縣市試試，或到「LINE 社群」看看')}`;
  } else if (tab === 'line') {
    body = html`<p class="small muted">全台羽球臨打、球館、球隊的 LINE 社群，依成員數排序。只收錄社群的公開介紹，加入後依各社群規定報名。最後更新：${ago(line.updatedAt)}</p>
      ${lg.length ? html`<div class="grid g3">${lg.slice(0, shown).map(lineCard)}</div>${more(lg.length)}` : empty('📭', '這個縣市還沒有找到 LINE 社群')}`;
  } else if (tab === 'posts') {
    body = html`<div class="callout" style="margin-bottom:14px"><b>你是團主嗎？</b> 免費登錄你的零打團，讓更多球友找到你。
        <div class="actions"><a class="btn sm primary" href="${issueUrl('new-group.yml', { city })}" target="_blank" rel="noopener">＋ 登錄零打團</a><a class="btn sm" href="#/learn/etiquette">零打禮儀</a></div></div>
      <section class="section"><div class="section-h"><h2>社群登錄的零打團（${cg.length}）</h2>${expiredN ? html`<label class="toggle"><input type="checkbox" data-exp ${showExpired ? 'checked' : ''}> 顯示已過期（${expiredN}）</label>` : ''}</div>
        ${cg.length ? html`<div class="grid g2">${cg.map((g) => groupCard(g, ttl))}</div>` : html`<p class="muted small">還沒有團主登錄，成為第一個吧！</p>`}</section>
      <section class="section"><div class="section-h"><h2>PTT 羽球板揪人（${pg.length}）</h2>${ext(ptt.sourceUrl, '前往 PTT', '')}</div>
        ${pg.length ? html`<div class="grid g2">${pg.map(pttGroupCard)}</div>` : html`<p class="muted small">近期沒有符合條件的揪人文</p>`}</section>
      <section class="section"><div class="section-h"><h2>Threads 揪團貼文（${tg.length}）</h2></div>
        ${tg.length ? html`<div class="grid g2">${tg.map(threadsCard)}</div>` : html`<p class="muted small">Threads 串接已準備好，啟用 Meta 官方 API 後就會自動出現 Threads 上的揪團貼文。</p>`}</section>`;
  } else {
    body = html`<p class="small muted">固定球隊常開放新成員加入，可透過粉專或電話詢問。資料來自 Overture Maps 開放商家資料，每週更新。</p>
      ${cl.length ? html`<div class="grid g3">${cl.slice(0, shown).map((c) => placeCard(c, c.type))}</div>${more(cl.length)}` : empty('📭', '這個縣市還沒有收錄的俱樂部')}`;
  }
  el.innerHTML = html`${head('零打團／臨打揪團', `今天想打球？目前有 ${pick.items.filter((p) => p.date >= t0).length} 場近期開團、${line.items.length} 個 LINE 羽球社群，每 6 小時自動更新。`)}
    <div class="filters">
      <select class="field" data-k="city" aria-label="縣市">${selectOpts(CITIES, city, '全部縣市')}</select>
      <select class="field" data-k="wd" aria-label="星期">${selectOpts(WEEK.map((w, i) => [i, '星期' + w]), wd, '任何一天')}</select>
      <form data-q class="full" style="grid-column:span 2"><input class="field" name="q" type="search" value="${q}" placeholder="搜尋場館、團名、地區" enterkeyhint="search"></form>
    </div>
    <div class="chips tabs">${tabs.map(([k, l, n]) => html`<button class="chip ${tab === k ? 'on' : ''}" data-tab-k="${k}">${l} <b>${n}</b></button>`)}</div>
    ${body}
    <section class="section"><h2>到其他地方找更多團</h2><div class="grid g3">
      <div class="card"><h3>Facebook 社團</h3><p class="small muted">很多零打團在 FB 社團發臨打名額（需登入）</p>${ext(`https://www.facebook.com/search/groups/?q=${encodeURIComponent((city || '') + ' 羽球 零打')}`, '搜尋 FB 社團')}</div>
      <div class="card"><h3>羽球拼圖</h3><p class="small muted">收錄全台招收球友的球隊，可在 App 內報名</p>${ext('https://badminton.pintu.tw/', '前往羽球拼圖')}</div>
      <div class="card"><h3>運動中心散客時段</h3><p class="small muted">各地國民運動中心常開放個人租場</p><a class="btn sm" href="#/venues?kind=sports-center&city=${city}">查看運動中心</a></div>
    </div></section>`.s;
  $$('select[data-k]', el).forEach((s) => s.addEventListener('change', () => { if (s.dataset.k === 'city') store.set('city', s.value); set(s.dataset.k, s.value); }));
  $('[data-q]', el).addEventListener('submit', (e) => { e.preventDefault(); set('q', e.target.q.value.trim()); });
  $$('[data-tab-k]', el).forEach((b) => b.addEventListener('click', () => set('tab', b.dataset.tabK)));
  $$('[data-when]', el).forEach((b) => b.addEventListener('click', () => set('when', b.dataset.when)));
  $('[data-more]', el)?.addEventListener('click', () => set('n', shown + 24));
  $('[data-exp]', el)?.addEventListener('change', (e) => set('expired', e.target.checked ? '1' : ''));
}

/* ================= GEAR ================= */
function recommend(a) {
  const w = a.power === 'low' || a.style === 'speed' ? '5U（75–79g）' : a.power === 'high' && a.style === 'attack' ? '3U（85–89g）' : '4U（80–84g）';
  const bal = a.style === 'attack' ? '頭重（進攻型）' : a.style === 'speed' ? '頭輕（速度型）' : '平衡型';
  const shaft = a.level === 'new' || a.power === 'low' ? '彈性／偏軟中桿' : a.level === 'adv' && a.power === 'high' ? '硬中桿' : '中等硬度';
  const lbs = a.level === 'new' ? '20–22 磅' : a.level === 'mid' ? '22–25 磅' : '25–28 磅';
  const price = { 1: '1,000–2,500 元的入門到中階拍即可', 2: '2,500–4,500 元，可選各品牌中階系列', 3: '可考慮各品牌旗艦系列，但務必先試打' }[a.budget];
  return html`<div class="callout" style="margin-top:14px"><h3>為你推薦的規格</h3><dl class="kv"><dt>重量</dt><dd>${w}</dd><dt>平衡</dt><dd>${bal}</dd><dt>中桿</dt><dd>${shaft}</dd><dt>磅數</dt><dd>${lbs}</dd><dt>預算</dt><dd>${price}</dd></dl>
    <p class="small muted" style="margin:8px 0 0">建議帶著這組規格到球具店試打，或到 <a href="#/market">二手市集</a> 尋找。</p></div>`;
}
export async function gear(el, params = new URLSearchParams()) {
  const [g, videos, lm, shops, autoShops] = await Promise.all([api('gear.json'), api('videos.json'), linkMap(), api('shops.json').catch(() => ({ items: [] })), api('shops_auto.json').catch(() => ({ items: [] }))]);
  const shopCity = params.has('city') ? params.get('city') : store.get('city', '臺北市');
  const allShops = [...shops.items.map((x) => ({ ...x, _b: '球友推薦' })), ...autoShops.items];
  const cityShops = allShops.filter((x) => !shopCity || x.city === shopCity);
  el.innerHTML = html`${head('球具指南', '新手不踩雷：球拍、線、球鞋、羽毛球怎麼挑，一次看懂。')}
    <section class="section card"><h2>🎯 30 秒找到適合你的球拍規格</h2><form data-quiz>
      ${g.finder.questions.map((qq) => html`<div class="quiz-q">${qq.q}</div><div class="chips">${qq.opts.map(([v, l], i) => html`<label class="chip"><input type="radio" class="sr-only" name="${qq.id}" value="${v}" ${i === 1 || (qq.opts.length === 3 && i === 1) ? 'checked' : ''}>${l}</label>`)}</div>`)}
      <button class="btn primary" style="margin-top:8px">看推薦結果</button></form><div id="rec"></div></section>
    <section class="section"><h2>選購指南</h2>${g.guides.map((gd, i) => html`<details class="acc" ${i === 0 ? 'open' : ''}><summary><span>${gd.icon}</span>${gd.title}</summary><div class="acc-b">
      <dl class="kv" style="grid-template-columns:120px 1fr">${gd.points.map((p) => html`<dt>${p.k}</dt><dd>${p.v}</dd>`)}</dl>
      <div class="grid g3" style="margin-top:12px">${videos.items.filter((v) => v.topic === gd.videoTopic).slice(0, 3).map((v) => videoCard(v))}</div></div></details>`)}</section>
    <section class="section"><h2>品牌官網</h2><div class="grid g3">${g.brands.map((b) => html`<div class="card"><div class="row"><h3 style="margin:0">${b.name}</h3><span class="badge">${b.origin}</span>${linkBadge(lm[b.url]?.s)}</div><p class="small muted">${b.note}</p>${ext(b.url, '前往官網')}</div>`)}</div></section>
    <section class="section"><h2>購買新品</h2><div class="grid g3">${g.buy.filter((b) => b.type !== 'used').map((b) => html`<div class="card"><h3>${b.name}</h3><p class="small muted">${b.note}</p>${ext(b.url, '搜尋羽球拍')}</div>`)}</div>
      <div class="section-h" style="margin-top:22px" id="shops"><h2>實體球具店（${allShops.length}）</h2>
        <select class="field" data-shopcity aria-label="球具店縣市" style="max-width:180px">${selectOpts(CITIES, shopCity, '全部縣市')}</select></div>
      <p class="small muted">可試打、穿線的羽球專賣店。資料來自 Overture Maps 開放商家資料與球友推薦，每週更新。</p>
      ${cityShops.length ? html`<div class="grid g3">${cityShops.slice(0, 60).map((x) => placeCard(x, x._b))}</div>` : empty('🔍', '這個縣市還沒有收錄的球具店，用下方 Google 地圖找找看')}
      <div class="card" style="margin-top:12px"><h3>找附近的實體球具店（試打、穿線）</h3><div class="chips">${CITIES.slice(0, 16).map((c) => html`<a class="chip" href="${`https://www.google.com/maps/search/${encodeURIComponent(c + ' 羽球用品店 穿線')}`}" target="_blank" rel="noopener">${c}</a>`)}</div>
      <a class="btn sm" href="${issueUrl('new-shop.yml')}" target="_blank" rel="noopener">＋ 推薦一間球具店</a></div></section>`.s;
  $('[data-shopcity]', el).addEventListener('change', (e) => { location.hash = '#/gear?at=shops&city=' + encodeURIComponent(e.target.value); });
  const f = $('[data-quiz]', el);
  const paint = () => $$('.chip', f).forEach((c) => c.classList.toggle('on', $('input', c).checked));
  f.addEventListener('change', paint); paint();
  f.addEventListener('submit', (e) => { e.preventDefault(); $('#rec', el).innerHTML = recommend(Object.fromEntries(new FormData(f))).s; });
}

/* ================= MARKET 二手 ================= */
export async function market(el) {
  const [g, ptt, lm] = await Promise.all([api('gear.json'), api('ptt.json').catch(() => ({ items: [] })), linkMap()]);
  const posts = ptt.items.filter((i) => i.cat === 'market');
  el.innerHTML = html`${head('球具買賣／二手市集', '整理各大平台的羽球商品入口，直接連到搜尋結果。')}
    <div class="callout warn"><h3 style="margin-top:0">🛡 交易安全提醒</h3><ul class="bullets">${g.safety.map((s) => html`<li>${s}</li>`)}</ul></div>
    <section class="section"><h2>二手與拍賣平台</h2><div class="grid g3">${g.buy.filter((b) => b.type !== 'new').map((b) => html`<div class="card">
      <div class="row"><h3 style="margin:0">${b.name}</h3><span class="badge ${b.type === 'used' ? 'info' : ''}">${b.type === 'used' ? '二手' : '新品＋二手'}</span>${linkBadge(lm[b.url]?.s)}</div>
      <p class="small muted">${b.note}</p><div class="actions">${ext(b.url, '前往搜尋')}</div></div>`)}</div></section>
    <section class="section"><div class="section-h"><h2>PTT 羽球板買賣文</h2>${ext('https://www.ptt.cc/bbs/Badminton/index.html', '前往 PTT', '')}</div>
      ${posts.length ? html`<div class="card"><div class="list">${posts.map((p) => html`<div class="li"><div class="body"><a class="title" href="${safeUrl(p.url)}" target="_blank" rel="noopener">${p.title}</a><div class="small muted">${ago(p.postedAt)} · ${p.author}</div></div></div>`)}</div></div>`
      : html`<div class="card"><p class="muted" style="margin:0">PTT 羽球板目前將買賣集中於「買賣和徵求推文專區」置底文，請直接前往該板查看最新推文。</p><div class="actions">${ext('https://www.ptt.cc/bbs/Badminton/index.html', '開啟 PTT 羽球板')}</div></div>`}</section>`.s;
}

/* ================= FAVORITES ================= */
export async function favorites(el) {
  const f = favs.all();
  const v = Object.entries(f.venue || {}), vid = Object.entries(f.video || {}), gr = Object.entries(f.group || {});
  const total = v.length + vid.length + gr.length;
  const tubes = Math.max(1, Math.ceil(total / 12));
  el.innerHTML = html`${head('我的球筒', '一筒羽毛球有 12 顆，你收藏的東西也裝在球筒裡。只存在這台裝置，不需要註冊。')}
    ${total ? html`<div class="card grow" style="margin-bottom:14px">${raw(chubi({ mood: 'love', prop: 'tube', size: 70 }))}<div class="info">
      <b>${total ? `已收藏 ${total} 顆球` : '球筒空空的'}</b>${total > 12 ? html`<span class="small muted">（已經裝滿 ${tubes - 1} 筒，開了新的一筒！）</span>` : ''}
      <div class="tube">${Array.from({ length: 12 }, (_, i) => html`<i class="${i < (total % 12 || 12) ? 'on' : ''}"></i>`)}</div></div></div>` : ''}
    ${!v.length && !vid.length && !gr.length ? empty('☆', '球筒空空的～在場館、影片、零打團旁按 ☆，就能把它收進球筒', html`<a class="btn primary" href="#/venues">去找場館</a>`) : ''}
    ${v.length ? html`<section class="section"><h2>📍 場館</h2><div class="card"><div class="list">${v.map(([id, s]) => html`<div class="li"><div class="body"><a class="title" href="#/venue/${id}">${s.name}</a><div class="small muted">${s.city}${s.district || ''}</div></div>${favBtn('venue', id, s)}</div>`)}</div></div></section>` : ''}
    ${gr.length ? html`<section class="section"><h2>🤝 零打團</h2><div class="card"><div class="list">${gr.map(([id, s]) => html`<div class="li"><div class="body"><a class="title" href="#/groups?q=${encodeURIComponent(s.name)}">${s.name}</a><div class="small muted">${s.city}</div></div>${favBtn('group', id, s)}</div>`)}</div></div></section>` : ''}
    ${vid.length ? html`<section class="section"><h2>▶️ 影片</h2><div class="grid g3">${vid.map(([id, s]) => videoCard({ id, ...s }))}</div></section>` : ''}`.s;
}

/* ================= MORE ================= */
export async function more(el) {
  el.innerHTML = html`${head('更多')}
    <div class="card"><div class="list">
    ${[['#/chubi', '🏸', '認識吉祥物啾比'], ['#/videos', '▶️', '教學影片'], ['#/gear', '🏸', '球具指南與球拍推薦'], ['#/market', '♻️', '二手買賣'], ['#/favorites', '🧺', '我的球筒（收藏）'], ['#/search', '🔍', '全站搜尋'], ['#/about', '🛰️', '資料來源與更新狀態'], ['#/install', '📱', '安裝到手機主畫面'], ['#/privacy', '🔒', '隱私權說明']]
      .map(([h, i, t]) => html`<a class="li" href="${h}" style="padding:6px 0;color:var(--text)"><span style="font-size:22px;width:32px">${i}</span><span class="body title">${t}</span><span class="muted">›</span></a>`)}
    </div></div>
    <div class="card" style="margin-top:14px"><h3>一起讓資料更完整</h3><p class="small muted">任何人都可以登錄零打團、私人球館、球具店，或回報錯誤資料。</p>
      <div class="actions"><a class="btn sm primary" href="${CONFIG.repo}/issues/new/choose" target="_blank" rel="noopener">投稿 / 回報</a>${ext(CONFIG.repo, 'GitHub 原始碼')}</div></div>`.s;
}

/* ================= ABOUT / DATA STATUS ================= */
export async function about(el) {
  const [src, manifest, ls] = await Promise.all([api('sources.json'), api('manifest.json').catch(() => ({})), api('link_status.json').catch(() => ({ urls: {} }))]);
  const broken = Object.entries(ls.urls || {}).filter(([, v]) => v.s === 'broken');
  const h = manifest.links || {};
  const pct = h.total ? Math.round(((h.ok + (h.restricted || 0)) / h.total) * 100) : null;
  el.innerHTML = html`${head('資料來源與更新狀態', '所有資料都有明確來源，並透過 GitHub Actions 排程自動更新、自動檢查失效。')}
    <div class="grid g4">
      <div class="card"><div class="small muted">場館</div><b style="font-size:1.4rem">${(manifest.counts?.venues || 0).toLocaleString()}</b></div>
      <div class="card"><div class="small muted">教學影片</div><b style="font-size:1.4rem">${manifest.counts?.videos || 0}</b></div>
      <div class="card"><div class="small muted">揪團／買賣索引</div><b style="font-size:1.4rem">${manifest.counts?.ptt || 0}</b></div>
      <div class="card"><div class="small muted">連結健康度</div><b style="font-size:1.4rem">${pct == null ? '—' : pct + '%'}</b><div class="small muted">檢查於 ${ago(ls.checkedAt)}</div></div>
    </div>
    <section class="section"><h2>資料來源</h2><div class="card table-wrap"><table class="table"><thead><tr><th>來源</th><th>涵蓋內容</th><th>更新頻率</th><th>最後更新</th></tr></thead><tbody>
      ${src.items.map((s) => html`<tr><td>${ext(s.url, s.name, '')}<div class="small muted">${s.type}</div></td><td>${s.covers}</td><td>${s.schedule}</td><td>${manifest.files?.[s.id]?.updatedAt ? ago(manifest.files[s.id].updatedAt) : '—'}</td></tr>`)}
    </tbody></table></div></section>
    <section class="section"><h2>自動化機制</h2><div class="grid g2">
      <div class="card"><h3>🔄 定期更新</h3><ul class="bullets small"><li>場館：每週一從 iPlay 開放 API 重新同步全台資料</li><li>揪團／買賣：每 6 小時索引 PTT 羽球板</li><li>影片：每月重新搜尋各主題新影片</li><li>API 異常時保留上一版資料，不會清空</li></ul></div>
      <div class="card"><h3>🩺 失效檢查</h3><ul class="bullets small"><li>每週檢查所有外部連結與影片是否可開啟</li><li>連續 2 次失敗才標記失效，避免誤判</li><li>失效項目自動開 Issue 通知維護者</li><li>零打團 ${'60'} 天未確認自動下架、揪人文 45 天後移除</li></ul></div>
    </div></section>
    ${broken.length ? html`<section class="section"><h2>目前偵測到的失效連結（${broken.length}）</h2><div class="card table-wrap"><table class="table"><tbody>${broken.slice(0, 50).map(([u, v]) => html`<tr><td style="word-break:break-all">${u}</td><td>${v.code || ''}</td><td>${ago(v.at)}</td></tr>`)}</tbody></table></div></section>` : ''}
    <section class="section card"><h2>免責聲明</h2><p class="small muted">本站為公益開源專案，資料僅供參考；場館開放時間與租借規定請以場館公告為準。教學影片版權屬原創作者，本站僅以 YouTube 官方嵌入方式播放。揪團與買賣資訊僅索引標題並連回原始平台，交易與活動請自行判斷風險。</p></section>`.s;
}
export async function install(el) {
  el.innerHTML = html`${head('安裝到手機', '台灣羽球通是 PWA，可以像 App 一樣安裝到主畫面，離線也能看已瀏覽過的內容。')}
    <div class="grid g2"><div class="card"><h3> iPhone / iPad（Safari）</h3><ol class="steps"><li>用 Safari 開啟本網站</li><li>點下方「分享」按鈕 ⬆️</li><li>選「加入主畫面」</li></ol></div>
    <div class="card"><h3>🤖 Android（Chrome）</h3><ol class="steps"><li>用 Chrome 開啟本網站</li><li>點右上角「⋮」</li><li>選「安裝應用程式」或「加到主畫面」</li></ol></div></div>
    <p class="small muted" style="margin-top:14px">iOS App Store 原生版本規劃中，將沿用相同的資料 API 與介面。</p>`.s;
}
export async function privacy(el) {
  el.innerHTML = html`${head('隱私權說明')}<div class="card"><ul class="bullets">
    <li>本站不需要註冊、不收集個人資料、不使用追蹤型廣告。</li>
    <li>收藏、學習進度、偏好縣市只儲存在你的裝置（localStorage），清除瀏覽器資料即刪除。</li>
    <li>「離我最近」的定位只在你的裝置上計算距離，不會傳送到任何伺服器。</li>
    <li>影片使用 youtube-nocookie.com 隱私加強模式，點擊播放前不會載入 YouTube。</li>
    <li>地圖圖磚由 OpenStreetMap 提供；點擊外部連結後即適用該網站的隱私政策。</li></ul></div>`.s;
}
export function notFound(el) {
  el.innerHTML = html`<div class="empty net404"><div class="stage"><div class="netbox"></div>${raw(chubi({ mood: 'wow', size: 90 }))}</div>
    <div class="big404">4 0 4</div><h2>啊！掛網了！</h2><p>啾比卡在網子上，這個頁面不存在。換個方向再打一次吧！</p>
    <a class="btn primary" href="#/">發球回首頁</a></div>`.s;
}
export async function mascot(el) {
  const poses = [['happy', 'none', '開心'], ['wink', 'racket', '準備發球'], ['cool', 'band', '夜場模式'], ['wow', 'glass', '找球場'],
    ['love', 'tube', '收藏中'], ['happy', 'cap', '認真上課'], ['sleep', 'none', '打完睡覺'], ['sad', 'none', '掛網了']];
  el.innerHTML = html`${head('認識啾比 Chubi', '台灣羽球通的吉祥物，一顆有點圓的羽毛球。')}
    <div class="card profile">${raw(chubi({ mood: 'wink', prop: 'racket', size: 200 }))}
      <div><dl class="kv" style="grid-template-columns:96px 1fr">
        <dt>名字</dt><dd><b>啾比 Chubi</b>。「啾」是小鳥的叫聲，羽毛球的英文叫 birdie；「比」是比賽。唸快一點像 chubby，因為他真的很圓。</dd>
        <dt>身體</dt><dd>軟木做的球頭，所以肚子圓滾滾、軟綿綿的。腰上的黃綠色腰帶是羽毛球的球頭膠帶。</dd>
        <dt>頭髮</dt><dd>16 根鵝毛（真正的羽毛球就是 16 根），中間綁了兩圈黃色的線，是他最自豪的髮型。</dd>
        <dt>個性</dt><dd>越被殺球越開心，飛得越快笑得越大聲。最怕的事情是「掛網」。</dd>
        <dt>夢想</dt><dd>挑戰人類最快殺球紀錄：時速 565 公里。</dd>
        <dt>口頭禪</dt><dd>「啾！」（好球）、「啾～」（辛苦了）、「啾…」（掛網了）</dd>
        <dt>小祕密</dt><dd>戳他一下試試看。連戳 21 下會發生什麼事呢？</dd>
      </dl><div class="actions"><button class="btn primary" data-poke>${raw(icon('bolt', 16))} 殺他一球！</button></div></div></div>
    <section class="section"><h2>啾比的各種表情</h2><div class="poses">${poses.map(([m, p, t]) => html`<figure>${raw(chubi({ mood: m, prop: p, size: 60 }))}<figcaption>${t}</figcaption></figure>`)}</div></section>
    <section class="section card"><h2>在網站裡找找啾比</h2><ul class="bullets">
      <li>首頁的啾比會依時段跟你打招呼（凌晨還在滑手機，他會叫你去睡覺）。</li>
      <li>學會的課程越多，啾比頭上的羽毛就越多，16 根全長齊有驚喜。</li>
      <li>收藏放在「球筒」裡，一筒裝 12 顆，滿了就換新的一筒。</li>
      <li>走錯頁面的時候，啾比會掛在網子上。</li>
      <li>右下角的按鈕是一記高遠球，按了會飛回頂端。</li>
      <li>在搜尋框輸入「殺球」看看會發生什麼事。</li>
      <li>切換到深色的「夜場模式」，啾比會戴上墨鏡。</li></ul></section>`.s;
  $('[data-poke]', el).addEventListener('click', () => window.dispatchEvent(new CustomEvent('chubi:smash')));
}
