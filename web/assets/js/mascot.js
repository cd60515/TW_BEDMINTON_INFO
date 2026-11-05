// 🏸 吉祥物「啾比 Chubi」
// 一顆圓滾滾的羽毛球：身體是軟木球頭（所以肚子很圓），頭頂是 16 根羽毛（真正的羽毛球就是 16 根）。
// 名字：「啾」是小鳥叫聲（羽毛球英文叫 birdie），「比」是比賽；唸起來像 chubby，因為他真的很圓。
// 個性：越被殺球越開心、最怕掛網、夢想是飛到人類最快殺球紀錄 565 km/h。

const FEATHERS = 9; // 正面看得到的羽毛數

/** 產生啾比 SVG。mood: happy | wink | sleep | wow | sad | cool | love；prop: racket | cap | glass | pin | band | tube | trophy | none */
export function chubi({ mood = 'happy', prop = 'none', size = 120, cls = '', title = '啾比', feathers = FEATHERS } = {}) {
  const id = 'c' + Math.random().toString(36).slice(2, 7);
  const fs = [];
  const n = Math.max(0, Math.min(FEATHERS, feathers));
  for (let i = 0; i < FEATHERS; i++) {
    const a = -52 + (104 / (FEATHERS - 1)) * i;
    const show = i >= Math.floor((FEATHERS - n) / 2) && i < Math.floor((FEATHERS - n) / 2) + n;
    fs.push(`<g transform="rotate(${a} 60 80)" ${show ? '' : 'opacity=".12"'}>
      <path d="M60 80 C49 62 45 38 49 20 Q54 13 60 17 Q66 13 71 20 C75 38 71 62 60 80Z" fill="url(#${id}f)" stroke="var(--c-line,#0b7a5c)" stroke-width="1.5"/>
      <path d="M60 78 L60 20" stroke="var(--c-line,#0b7a5c)" stroke-width="1.1" opacity=".5"/></g>`);
  }
  const eyes = {
    happy: `<ellipse cx="48" cy="104" rx="4.2" ry="5.2" fill="#1d2b26"/><ellipse cx="72" cy="104" rx="4.2" ry="5.2" fill="#1d2b26"/><circle cx="49.5" cy="102" r="1.6" fill="#fff"/><circle cx="73.5" cy="102" r="1.6" fill="#fff"/>`,
    wink: `<ellipse cx="48" cy="104" rx="4.2" ry="5.2" fill="#1d2b26"/><circle cx="49.5" cy="102" r="1.6" fill="#fff"/><path d="M67 104 q5 -5 10 0" stroke="#1d2b26" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    sleep: `<path d="M43 105 q5 4 10 0 M67 105 q5 4 10 0" stroke="#1d2b26" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
    wow: `<circle cx="48" cy="103" r="5.5" fill="#fff" stroke="#1d2b26" stroke-width="2"/><circle cx="72" cy="103" r="5.5" fill="#fff" stroke="#1d2b26" stroke-width="2"/><circle cx="48" cy="103" r="2.4" fill="#1d2b26"/><circle cx="72" cy="103" r="2.4" fill="#1d2b26"/>`,
    sad: `<path d="M43 102 l9 3 M77 102 l-9 3" stroke="#1d2b26" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="48" cy="107" rx="3.4" ry="4" fill="#1d2b26"/><ellipse cx="72" cy="107" rx="3.4" ry="4" fill="#1d2b26"/><path d="M79 110 q2 6 0 8 q-2 -2 0 -8z" fill="#6ec3f5"/>`,
    cool: `<path d="M38 99 h44 v4 q-1 8 -10 8 q-8 0 -10 -7 h-4 q-2 7 -10 7 q-9 0 -10 -8z" fill="#1d2b26"/><path d="M44 101 l5 0" stroke="#fff" stroke-width="1.5" opacity=".6"/>`,
    love: `<path d="M48 108 c-6 -4 -7 -9 -3 -10 c2 0 3 2 3 2 c0 0 1 -2 3 -2 c4 1 3 6 -3 10z M72 108 c-6 -4 -7 -9 -3 -10 c2 0 3 2 3 2 c0 0 1 -2 3 -2 c4 1 3 6 -3 10z" fill="#ef5b6b"/>`,
  }[mood] || '';
  const mouth = {
    wow: `<ellipse cx="60" cy="116" rx="3.6" ry="4.4" fill="#c2424f"/>`,
    sad: `<path d="M55 118 q5 -4 10 0" stroke="#1d2b26" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
    sleep: `<ellipse cx="60" cy="116" rx="2.6" ry="2" fill="#c2424f"/>`,
  }[mood] || `<path d="M54 114 q6 6 12 0" stroke="#1d2b26" stroke-width="2.4" fill="#ef8f8f" stroke-linecap="round"/>`;
  const zz = mood === 'sleep' ? `<text x="88" y="70" font-size="14" font-weight="800" fill="var(--c-line,#0b7a5c)" font-family="sans-serif">z<tspan font-size="10" dy="-6">z</tspan></text>` : '';
  const props = {
    racket: `<g transform="rotate(28 96 104)"><ellipse cx="96" cy="78" rx="11" ry="14" fill="none" stroke="#f2b705" stroke-width="3"/>
      <path d="M90 70 l12 16 M102 70 l-12 16 M85 78 h22 M96 64 v28" stroke="#f2b705" stroke-width=".8" opacity=".7"/><rect x="94" y="92" width="4" height="22" rx="2" fill="#0e5f73"/></g>`,
    cap: `<path d="M34 72 L60 60 L86 72 L60 83Z" fill="#1d2b26"/><path d="M48 77 v8 q12 6 24 0 v-8" fill="#1d2b26"/><path d="M84 73 v12" stroke="#f2b705" stroke-width="2"/><circle cx="84" cy="87" r="2.6" fill="#f2b705"/>`,
    glass: `<circle cx="96" cy="94" r="10" fill="rgba(255,255,255,.55)" stroke="#0e5f73" stroke-width="3.4"/><path d="M103 101 l9 9" stroke="#0e5f73" stroke-width="5" stroke-linecap="round"/>`,
    pin: `<path d="M98 66 c-9 0 -14 7 -14 13 c0 9 14 22 14 22 s14 -13 14 -22 c0 -6 -5 -13 -14 -13z" fill="#ef5b6b"/><circle cx="98" cy="79" r="5" fill="#fff"/>`,
    band: `<path d="M36 90 q24 -10 48 0" stroke="#ef5b6b" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M82 90 l8 6 M82 90 l9 -1" stroke="#ef5b6b" stroke-width="3.4" stroke-linecap="round"/>`,
    tube: `<rect x="88" y="78" width="16" height="44" rx="5" fill="#0e5f73"/><rect x="88" y="78" width="16" height="8" rx="3" fill="#f2b705"/><text x="96" y="106" font-size="7" fill="#fff" text-anchor="middle" font-family="sans-serif" font-weight="700">12</text>`,
    trophy: `<path d="M88 76 h18 v6 q0 10 -9 12 q-9 -2 -9 -12z" fill="#f2b705"/><path d="M88 80 q-6 0 -5 5 q1 4 6 4 M106 80 q6 0 5 5 q-1 4 -6 4" stroke="#f2b705" stroke-width="2" fill="none"/><rect x="94" y="94" width="6" height="7" fill="#f2b705"/><rect x="89" y="101" width="16" height="4" rx="1.5" fill="#b8860b"/>`,
  }[prop] || '';
  return `<svg class="chubi ${cls}" width="${size}" height="${Math.round(size * 1.17)}" viewBox="0 0 120 140" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9f6f0"/></linearGradient>
    <radialGradient id="${id}b" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f6dfb8"/></radialGradient>
  </defs>
  <g class="chubi-feathers">${fs.join('')}
    <path d="M37 52 Q60 40 83 52" stroke="#f2b705" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M42 64 Q60 56 78 64" stroke="#f2b705" stroke-width="2.4" fill="none" stroke-linecap="round"/></g>
  <rect x="34" y="78" width="52" height="12" rx="6" fill="#f2b705"/><rect x="34" y="82" width="52" height="3.4" fill="#0b7a5c" opacity=".85"/>
  <g class="chubi-body">
    <path d="M30 98 q-7 4 -5 11" stroke="#f0d3a3" stroke-width="6" fill="none" stroke-linecap="round" class="chubi-arm-l"/>
    <path d="M90 98 q7 4 5 11" stroke="#f0d3a3" stroke-width="6" fill="none" stroke-linecap="round" class="chubi-arm-r"/>
    <ellipse cx="60" cy="108" rx="31" ry="27" fill="url(#${id}b)" stroke="#e2bf86" stroke-width="1.5"/>
    <ellipse cx="50" cy="134" rx="8" ry="4" fill="#f0d3a3"/><ellipse cx="70" cy="134" rx="8" ry="4" fill="#f0d3a3"/>
    <ellipse cx="40" cy="114" rx="5.5" ry="3.4" fill="#ff9aa2" opacity=".6"/><ellipse cx="80" cy="114" rx="5.5" ry="3.4" fill="#ff9aa2" opacity=".6"/>
    ${eyes}${mouth}
  </g>${zz}${props}</svg>`;
}

/** 羽球冷知識：每次換頁頁尾隨機一則 */
export const FACTS = [
  '一顆羽毛球有 16 根羽毛，啾比頭上也是 16 根（正面只看得到 9 根）。',
  '比賽用羽毛球常選用鵝的同一側翅膀羽毛，這樣飛行時才會穩定旋轉。',
  '羽球是全世界最快的球拍運動，殺球初速紀錄超過時速 500 公里。',
  '羽球場長 13.4 公尺、寬 6.1 公尺，單打只用 5.18 公尺寬。',
  '球網中央高 1.524 公尺，兩側柱子高 1.55 公尺，所以中間比較好過網。',
  '一顆標準羽毛球重 4.74～5.50 公克，比一枚一元硬幣（3.8 公克）還重一點點（啾比說他沒有胖）。',
  '羽球的英文 shuttlecock 也叫 birdie，所以啾比是一隻「鳥」。',
  '冬天天氣冷，羽毛球飛得比較慢，所以要換「號數」比較快的球。',
  '職業比賽一場可能打掉幾十顆球，羽毛一斷就要換球。',
  '比賽 20 平要連贏 2 分，29 平則是先拿到 30 分的人獲勝。',
];

/** 依時段的招呼語 */
export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 5) return ['sleep', '這麼晚還不睡？明天的早場會爬不起來喔～'];
  if (h < 9) return ['happy', '早場球友早安！熱身做好再上場 ☀️'];
  if (h < 12) return ['wink', '上午好～今天想學殺球還是找球場？'];
  if (h < 14) return ['love', '午休打一場？記得先吃飽再殺球！'];
  if (h < 18) return ['happy', '下午好！晚上的零打團名額要搶要快～'];
  if (h < 22) return ['cool', '夜場開打！今天也要把對手殺到底線 🔥'];
  return ['sleep', '打完夜場記得拉筋，啾比要先睡了… zZ'];
}
