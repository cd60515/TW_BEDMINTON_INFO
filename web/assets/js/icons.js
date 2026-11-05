// 啾比風格 icon 組：圓頭圓角線條、羽毛球元素（羽毛、球頭、球網、球拍）
const P = {
  // 首頁：球場＋中間的網
  home: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M12 5v14M3 12h18" stroke-dasharray="1.5 2.2"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>',
  // 教學：戴學士帽的羽毛球
  learn: '<path d="M3 8.5 12 4.5l9 4-9 4z"/><path d="M7 10.5v4c3 2.4 7 2.4 10 0v-4"/><path d="M20.5 9v5"/>',
  // 影片：羽毛球形狀的播放鍵
  video: '<path d="M6 4.5h12l-3 10H9z"/><circle cx="12" cy="18" r="3"/><path d="M11 7.5v4l3-2z" fill="currentColor"/>',
  // 場館：地圖針裡有一顆羽毛球
  venue: '<path d="M12 21s-7-6.4-7-11.5A7 7 0 0 1 19 9.5C19 14.6 12 21 12 21z"/><path d="M9.6 6.5h4.8l-1.2 4h-2.4z"/><circle cx="12" cy="12" r="1.3"/>',
  // 零打團：兩支交叉的球拍
  group: '<ellipse cx="7.5" cy="7.5" rx="3.6" ry="4.4" transform="rotate(-40 7.5 7.5)"/><ellipse cx="16.5" cy="7.5" rx="3.6" ry="4.4" transform="rotate(40 16.5 7.5)"/><path d="M10 11 17.5 20M14 11 6.5 20"/>',
  // 球具：一支球拍
  gear: '<ellipse cx="13.5" cy="8.5" rx="5" ry="6" transform="rotate(35 13.5 8.5)"/><path d="M10.5 13.5 4 20.5M11 5l5 6M9 8l6.5 1.5"/>',
  // 二手：羽毛繞一圈
  market: '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.5"/><path d="M20 4.5v4h-4"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15.5"/><path d="M4 19.5v-4h4"/>',
  // 收藏：球筒
  star: '<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M7 7h10"/><path d="M12 11l1.2 2.4 2.6.3-1.9 1.8.5 2.6-2.4-1.3-2.4 1.3.5-2.6-1.9-1.8 2.6-.3z" fill="currentColor" stroke-width="1"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/><path d="M8.5 9h4l-.8 2.5h-2.4z"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  more: '<path d="M12 21C7 15 7 8 12 3c5 5 5 12 0 18z"/><path d="M12 21V8M12 12l-2.5-2M12 15l2.5-2"/>',
  nav: '<path d="M3 11 21 3l-8 18-2-8z"/>',
  phone: '<path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  up: '<path d="M7 3.5h10l-2.5 9h-5z"/><circle cx="12" cy="16.5" r="3"/><path d="M12 21v1"/>',
  data: '<path d="M4 18V9M10 18V5M16 18v-7M22 18H2"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
};

export function icon(name, size = 22, cls = '') {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;
}
