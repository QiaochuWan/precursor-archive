/* 前文明档案馆 · app：路由与页面 */
(function () {
  'use strict';
  const PA = window.PA; const D = PA.data; const esc = PA.esc; const $ = PA.$; const $$ = PA.$$;
  const view = () => $('#view');
  const ui = (PA.ui = { worlds: { q: '', cats: null, status: '', sector: '', sort: 'no', mode: 'grid' }, people: { f: '' } });
  const ICON = {
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M14 6l4 4"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></svg>',
    dl: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
  };
  PA.ICON = ICON;

  /* ---------- 主题 ---------- */
  const THEMES = ['auto', 'light', 'dark'];
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    const b = $('#theme-btn'); if (b) { b.title = { auto: '主题：跟随系统', light: '主题：浅色', dark: '主题：深色' }[t]; b.innerHTML = t === 'dark' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>' : t === 'light' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>'; }
  }
  let theme = PA.ls.get('pa.theme', 'auto'); applyTheme(theme);

  /* ---------- 共用片段 ---------- */
  const chip = (text, color) => `<span class="chip" style="--c:${color || 'var(--muted)'}"><i></i>${esc(text)}</span>`;
  const fmtLy = (n) => n >= 10000 ? PA.fmt(n / 1000, 1) + 'k' : PA.fmt(n, n < 100 ? 1 : 0);
  PA.chip = chip;
  function setTitle(t) { document.title = t ? t + ' · 前文明档案馆' : '前文明档案馆'; }
  function linkWorld(id) { const w = D.byId[id]; return w ? `<a class="wl" href="#world-${w.id}">${esc(w.name)}</a>` : ''; }
  function charById(id) { return D.chars.find((c) => c.id === id); }
  function sigil(c, big) { const ch = c.mono || (c.name.match(/[一-龥A-Za-z0-9]/) || ['?'])[0]; return `<span class="sigil${big ? ' big' : ''}" style="--c:${c.color}" aria-hidden="true">${esc(ch)}</span>`; }

  function coverAquarium(book) {
    // 《窒息的水》封面：蝠鲼隧道、头顶游过的蝠鲼、玻璃上的红漆、两个小小的人
    const id = book.id;
    const manta = (x, y, s, r, op) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s})" opacity="${op}"><path d="M0 -8 C6 -8 14 -4 26 4 C16 3 8 5 3 10 L0 30 L-3 10 C-8 5 -16 3 -26 4 C-14 -4 -6 -8 0 -8 Z M-4 -8 L-6 -13 L-2 -9 Z M4 -8 L6 -13 L2 -9 Z" fill="#06202B"/></g>`;
    const rays = [[40, 14], [74, 10], [108, 18], [140, 8]].map(([x, w], i) => `<path d="M${x} 0 L${x + w} 0 L${x + w * 2 - 10} 200 L${x - 20} 200z" fill="#BFF2F8" opacity="${(0.06 + (i % 2) * 0.03).toFixed(2)}"/>`).join('');
    const motes = Array.from({ length: 30 }, (_, i) => `<circle cx="${(i * 53 + 7) % 180 + 10}" cy="${(i * 71 + 21) % 200 + 30}" r="${i % 6 === 0 ? 0.8 : 0.4}" fill="#E8FBFF" opacity="${(0.15 + (i % 4) * 0.07).toFixed(2)}"/>`).join('');
    const spores = Array.from({ length: 50 }, (_, i) => `<circle cx="${(i * 37 + 5) % 170 + 15}" cy="${232 + ((i * 29) % 26)}" r="${(0.6 + (i % 5) * 0.4).toFixed(2)}" fill="#C9D2B8" opacity="${(0.07 + (i % 4) * 0.05).toFixed(2)}"/>`).join('');
    const person = (x, cat, arm) => `<g transform="translate(${x} 230)" fill="#030B10"><circle cx="0" cy="-17" r="3"/>${cat ? '<path d="M-2.8 -18.5 L-2.6 -22.5 L-0.8 -19.6 Z M2.8 -18.5 L2.6 -22.5 L0.8 -19.6 Z"/>' : ''}<path d="M-3.2 -13.5 Q0 -15 3.2 -13.5 L3.6 -3 L2 -3 L1.6 6 L-1.6 6 L-2 -3 L-3.6 -3 Z"/>${arm ? '<path d="M3 -12 L8 -19" stroke="#030B10" stroke-width="1.3" stroke-linecap="round"/>' : ''}</g>`;
    const title = Array.from(book.title || '').map((ch, i) => `<text x="180" y="${52 + i * 28}" text-anchor="middle" fill="#F3EEDF" font-family="Noto Serif SC, Songti SC, serif" font-size="23" font-weight="700">${esc(ch)}</text>`).join('');
    return `<svg viewBox="0 0 200 300" role="img" aria-label="《${esc(book.title)}》封面">
      <defs><linearGradient id="cg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A8C99"/><stop offset=".45" stop-color="#145566"/><stop offset="1" stop-color="#062430"/></linearGradient>
      <linearGradient id="ct-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#02121A" stop-opacity=".2"/><stop offset="1" stop-color="#010507" stop-opacity=".95"/></linearGradient>
      <linearGradient id="cd-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D23440" stop-opacity=".9"/><stop offset="1" stop-color="#D23440" stop-opacity="0"/></linearGradient></defs>
      <rect width="200" height="300" fill="url(#cg-${id})"/>${rays}
      ${manta(70, 92, 1.5, -14, 0.95)}${manta(132, 132, 1.0, 8, 0.8)}${manta(50, 160, 0.65, -4, 0.6)}${manta(146, 74, 0.55, 20, 0.5)}
      ${motes}
      <path d="M0 300 L0 190 C0 110 200 110 200 190 L200 300 Z" fill="none" stroke="#BFEAF0" stroke-width=".8" opacity=".5"/>
      <path d="M8 300 L8 192 C8 122 192 122 192 192 L192 300" fill="none" stroke="#BFEAF0" stroke-width=".5" opacity=".3"/>
      <rect x="0" y="200" width="200" height="100" fill="url(#ct-${id})"/>
      <path d="M0 246 L200 246 L200 300 L0 300 Z" fill="#010508"/><line x1="0" y1="246" x2="200" y2="246" stroke="#3A6E7A" stroke-width=".5" opacity=".6"/>
      <g transform="rotate(-7 60 180)"><text x="22" y="186" fill="#D23440" font-family="Jost, Futura, sans-serif" font-weight="600" font-size="15" letter-spacing="1.5" opacity=".85">FREE SEA</text>
      <rect x="30" y="188" width="1.8" height="20" fill="url(#cd-${id})"/><rect x="52" y="188" width="1.4" height="13" fill="url(#cd-${id})"/><rect x="74" y="188" width="2" height="26" fill="url(#cd-${id})"/><rect x="95" y="188" width="1.4" height="16" fill="url(#cd-${id})"/></g>
      ${spores}${person(92, false, true)}${person(104, true, false)}
      ${title}
      <text x="14" y="22" fill="#E8FBFF" font-family="Jost, Futura, sans-serif" font-size="6.8" letter-spacing="2.4">THE PRECURSOR ARCHIVE</text>
      <text x="72" y="270" fill="#C9E6EC" font-family="Jost, Futura, sans-serif" font-size="7.6" letter-spacing="1.8">${esc((book.en || '').toUpperCase())}</text>
      <text x="72" y="284" fill="#7FA8B4" font-family="Noto Sans SC, sans-serif" font-size="6.5" letter-spacing="1">${esc(book.volume || '')}</text>
    </svg>`;
  }
  function coverKeys(book) {
    // 《圣彼得之钥》封面：玫瑰窗、方块环带、祭坛前的三个人
    const id = book.id;
    const ring = (n, off, fn) => Array.from({ length: n }, (_, i) => fn(off + i * 360 / n)).join('');
    const spokes = ring(12, 0, (a) => `<line x1="86" y1="100" x2="86" y2="60" transform="rotate(${a} 86 100)"/>`);
    const petals = ring(12, 15, (a) => `<circle cx="86" cy="72" r="6.5" transform="rotate(${a} 86 100)"/>`);
    const gems = ring(12, 0, (a) => `<rect x="83" y="57.5" width="6" height="5" rx="1" transform="rotate(${a} 86 100)"/>`);
    const blocks = ring(12, 0, (a) => `<rect x="84.6" y="85.6" width="2.8" height="2.8" transform="rotate(${a} 86 100)"/>`);
    const motes = [[40, 170, .8, .3], [52, 196, .4, .25], [64, 158, .4, .35], [70, 214, .8, .2], [82, 178, .4, .3], [90, 230, .4, .25], [98, 160, .8, .2], [108, 200, .4, .35], [118, 182, .4, .25], [126, 222, .8, .2], [46, 232, .4, .3], [76, 146, .4, .3], [58, 224, .4, .2], [102, 238, .4, .3]].map(([x, y, r, o]) => `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`).join('');
    const candles = [[20, 7], [32, 9], [44, 7], [148, 7], [158, 9]].map(([x, h]) => `<line x1="${x}" y1="250" x2="${x}" y2="${250 - h}" stroke="#8A4A3A" stroke-width=".5"/><circle cx="${x}" cy="${249 - h}" r=".9" fill="#FFE7B0"/>`).join('');
    const person = (x, cat) => `<g transform="translate(${x} 244)" fill="#030102"><circle cx="0" cy="-17" r="3"/>${cat ? '<path d="M-2.8 -18.5 L-2.6 -22.5 L-0.8 -19.6 Z M2.8 -18.5 L2.6 -22.5 L0.8 -19.6 Z"/>' : ''}<path d="M-3.2 -13.5 Q0 -15 3.2 -13.5 L3.6 -3 L2 -3 L1.6 6 L-1.6 6 L-2 -3 L-3.6 -3 Z"/></g>`;
    const title = Array.from(book.title || '').map((ch, i) => `<text x="180" y="${52 + i * 28}" text-anchor="middle" fill="#F3EEDF" font-family="Noto Serif SC, Songti SC, serif" font-size="23" font-weight="700">${esc(ch)}</text>`).join('');
    return `<svg viewBox="0 0 200 300" role="img" aria-label="《${esc(book.title)}》封面">
      <defs><linearGradient id="cg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A1F2B"/><stop offset=".45" stop-color="#3A111A"/><stop offset="1" stop-color="#0E0507"/></linearGradient></defs>
      <rect width="200" height="300" fill="url(#cg-${id})"/>
      <path d="M10 300 L10 130 C10 70 50 30 86 14 C122 30 162 70 162 130 L162 300" fill="none" stroke="#E2B254" stroke-width=".8" opacity=".5"/>
      <path d="M22 300 L22 134 C22 82 56 46 86 32 C116 46 150 82 150 134 L150 300" fill="none" stroke="#E2B254" stroke-width=".5" opacity=".3"/>
      <path d="M60 124 L84 124 L72 250 L22 250 Z" fill="#FFE7B0" opacity=".07"/><path d="M90 128 L110 128 L138 250 L98 250 Z" fill="#FFE7B0" opacity=".05"/><path d="M74 132 L96 132 L102 250 L66 250 Z" fill="#FFE7B0" opacity=".06"/>
      <circle cx="86" cy="100" r="40" fill="#FFE7B0" opacity=".08"/>
      <g stroke="#E2B254" fill="none" opacity=".9"><circle cx="86" cy="100" r="40" stroke-width="1.1"/><circle cx="86" cy="100" r="34" stroke-width=".4" opacity=".55"/><circle cx="86" cy="100" r="19" stroke-width=".5"/><g stroke-width=".35">${spokes}</g><g stroke-width=".5">${petals}</g></g>
      <g fill="#E2B254" opacity=".7">${gems}</g>
      <g fill="#FFE7B0">${blocks}<circle cx="86" cy="100" r="3.2"/></g>
      <g fill="#FFE7B0">${motes}</g>
      <path d="M0 250 L200 250 L200 300 L0 300 Z" fill="#070304"/><line x1="0" y1="250" x2="200" y2="250" stroke="#8A4A3A" stroke-width=".5" opacity=".6"/>
      <g fill="#070304"><rect x="64" y="244" width="44" height="6"/><rect x="76" y="232" width="20" height="12"/><rect x="85.4" y="216" width="1.2" height="16"/><rect x="82" y="221" width="8" height="1.2"/></g>
      ${candles}
      ${person(118, false)}${person(129, false)}${person(139, true)}
      ${title}
      <text x="14" y="22" fill="#E2B254" font-family="Jost, Futura, sans-serif" font-size="6.8" letter-spacing="2.4">THE PRECURSOR ARCHIVE</text>
      <text x="72" y="270" fill="#EBD3C0" font-family="Jost, Futura, sans-serif" font-size="7" textLength="118" lengthAdjust="spacing">${esc((book.en || '').toUpperCase())}</text>
      <text x="72" y="284" fill="#B8958A" font-family="Noto Sans SC, sans-serif" font-size="6.5" letter-spacing="1">${esc(book.volume || '')}</text>
    </svg>`;
  }
  function coverSVG(book) {
    if (book.cover && book.cover.art === 'aquarium') return coverAquarium(book);
    if (book.cover && book.cover.art === 'keys') return coverKeys(book);
    // 《千金绑架案》封面：摩天轮、未完工的塔与塔吊、坠落的黑色流星
    const id = book.id;
    const spokes = Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; const x = 48 * Math.cos(a), y = 48 * Math.sin(a); return `<line x1="0" y1="0" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke-width=".35"/><rect x="${(x - 3).toFixed(1)}" y="${y.toFixed(1)}" width="6" height="5" rx="1" fill="#E2B254" stroke="none" opacity=".7"/>`; }).join('');
    const stars = Array.from({ length: 46 }, (_, i) => `<circle cx="${(i * 47 + 13) % 200}" cy="${(i * 83 + 7) % 200}" r="${i % 7 === 0 ? 0.9 : 0.45}" fill="#C9D6EA" opacity="${(0.25 + (i % 5) * 0.12).toFixed(2)}"/>`).join('');
    const floors = Array.from({ length: 13 }, (_, i) => `<line x1="20" x2="58" y1="${176 + i * 10}" y2="${176 + i * 10}" stroke="#2C416B" stroke-width=".5"/>`).join('');
    return `<svg viewBox="0 0 200 300" role="img" aria-label="《${esc(book.title)}》封面">
      <defs><linearGradient id="cg-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#18294D"/><stop offset=".6" stop-color="#0B1426"/><stop offset="1" stop-color="#060A14"/></linearGradient>
      <linearGradient id="cs-${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E2B254" stop-opacity="0"/><stop offset="1" stop-color="#FFE7B0"/></linearGradient></defs>
      <rect width="200" height="300" fill="url(#cg-${id})"/>${stars}
      <g transform="translate(86 112)" stroke="#E2B254" fill="none" opacity=".88"><circle r="48" stroke-width="1.1"/><circle r="41" stroke-width=".4" opacity=".55"/>${spokes}<path d="M-14 74 L0 0 L14 74" stroke-width=".8"/></g>
      <g fill="#16243F" stroke="#2C416B" stroke-width=".6"><path d="M20 168 h38 v132 h-38z"/><path d="M58 172 h86 M58 172 l-8 -12 M84 172 v-8 M30 168 v-14 h10 v14" fill="none"/></g>${floors}
      <line x1="134" y1="172" x2="134" y2="212" stroke="#8E9BB4" stroke-width=".6" stroke-dasharray="1.6 1.4"/>
      <circle cx="134" cy="217" r="3.4" fill="#C9D6EA"/><path d="M131.3 214.2 l-1.3 -3.4 l2.8 1.6z M136.7 214.2 l1.3 -3.4 l-2.8 1.6z" fill="#C9D6EA"/>
      <line x1="150" y1="0" x2="135" y2="208" stroke="url(#cs-${id})" stroke-width="2.4" stroke-linecap="round"/>
      <text x="178" y="46" fill="#F3EEDF" font-family="Noto Serif SC, Songti SC, serif" font-size="23" font-weight="700" letter-spacing="7" style="writing-mode:vertical-rl;text-orientation:upright">${esc(book.title)}</text>
      <text x="14" y="22" fill="#E2B254" font-family="Jost, Futura, sans-serif" font-size="6.8" letter-spacing="2.4">THE PRECURSOR ARCHIVE</text>
      <text x="72" y="270" fill="#C9D6EA" font-family="Jost, Futura, sans-serif" font-size="7.6" letter-spacing="1.8">${esc((book.en || '').toUpperCase())}</text>
      <text x="72" y="284" fill="#8E9BB4" font-family="Noto Sans SC, sans-serif" font-size="6.5" letter-spacing="1">${esc(book.volume || '')}</text>
    </svg>`;
  }
  PA.coverSVG = coverSVG;

  /* ---------- 首页 ---------- */
  let heroStop = null;
  function heroChart(canvas) {
    const ctx = canvas.getContext('2d'); let raf, t0 = performance.now();
    const pts = D.worlds.filter((w) => !w.group && w.dist < 2600);
    function frame(now) {
      const dpr = Math.min(2, window.devicePixelRatio || 1); const W = canvas.clientWidth, H = canvas.clientHeight;
      if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const t = (now - t0) / 1000; const yaw = -0.9 + Math.sin(t * 0.12) * 0.35, pitch = 0.42;
      const s = Math.min(W, H) / 2350, cx = W * 0.5, cy = H * 0.55;
      const P = (x, y, z) => { z -= 500; const X = x * Math.cos(yaw) + z * Math.sin(yaw), Z = z * Math.cos(yaw) - x * Math.sin(yaw); return [cx + X * s, cy - (y * Math.cos(pitch) - Z * Math.sin(pitch)) * s, y * Math.sin(pitch) + Z * Math.cos(pitch)]; };
      // 包络环
      for (const [R, col] of [[500, 'rgba(226,178,84,.16)'], [250, 'rgba(79,214,232,.22)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        for (let z = -500; z <= 1500; z += 125) {
          const rr = R * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(Math.abs(z - 500) - 800, 0) / 200, 2)));
          if (rr <= 0) continue; ctx.beginPath();
          for (let k = 0; k <= 48; k++) { const a = k / 48 * Math.PI * 2; const p = P(rr * Math.cos(a), rr * Math.sin(a), z); k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
          ctx.stroke();
        }
      }
      const a = P(0, 0, -500), b = P(0, 0, 1500); const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, 'rgba(226,178,84,.2)'); g.addColorStop(0.3, '#E2B254'); g.addColorStop(1, 'rgba(226,178,84,.5)');
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      const pulse = (t * 0.18) % 1; const pp = P(0, 0, -500 + pulse * 2000); ctx.fillStyle = 'rgba(255,231,176,.9)'; ctx.beginPath(); ctx.arc(pp[0], pp[1], 2.4, 0, 7); ctx.fill();
      pts.map((w) => [P(w.x, w.y, w.z), w]).sort((u, v) => u[0][2] - v[0][2]).forEach(([p, w]) => {
        const r = w.novel ? 3.4 : 2.2; ctx.fillStyle = w.color; ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.arc(p[0], p[1], r * 3, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
        if (['swan-3', 'w39', 'w50', 'w68'].includes(w.id)) { ctx.fillStyle = '#DCE4F2'; ctx.font = '11px "Noto Sans SC", sans-serif'; ctx.fillText(w.name, p[0] + 6, p[1] - 6); }
      });
      const e = P(0, 0, 0); ctx.fillStyle = '#FFE7B0'; ctx.font = '600 12px "Noto Serif SC", serif'; ctx.fillText('太阳系', e[0] + 7, e[1] + 14);
      raf = requestAnimationFrame(frame);
    }
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { frame(t0); cancelAnimationFrame(raf); } else raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }
  function renderHome() {
    setTitle('');
    const w = D.worlds; const book = D.novels.books[0];
    const settled = w.filter((x) => !['科考站', '失联世界', '待开发世界', '灾毁世界', '黑洞枢纽', '周期航路', '域外前哨'].includes(x.kind)).length;
    const sectors = new Set(w.map((x) => x.sector).filter((s) => /星区$/.test(s))).size;
    const last = PA.ls.get('pa.read.' + book.id, null);
    const lore = D.pages.filter((p) => p.category === 'lore');
    view().innerHTML = `<div class="page">
      <section class="hero">
        <div>
          <div class="eyebrow">Federation Year F300 · Galactic Federation Records</div>
          <h1>黄金年代，<br>人类仍在<em>星海之上</em>航行。</h1>
          <p class="lede">这里是银河系联邦的档案馆：一条沿宇宙弦延伸两千光年的文明，它的世界、制度、人物，以及发生在新伦敦一座未完工高塔上的故事。</p>
          <blockquote>博士，如果你读到这里，说明我觉得你已经可以知晓这些往事了。</blockquote>
          <div class="row"><a class="btn btn-primary" href="#map">${ICON.map}打开三维疆域图</a><a class="btn" href="#book-${book.id}">${ICON.book}阅读《${esc(book.title)}》</a></div>
        </div>
        <a class="hero-chart" href="#map" aria-label="打开三维疆域图"><canvas id="hero-canvas"></canvas>
          <div class="cap"><span>天蝎主干 · z −500 → 1500 ly</span><span>俯视示意</span></div></a>
      </section>
      <section class="stats" aria-label="档案统计">
        <div><b>2,000<small>ly</small></b><span>定居主干长度</span></div>
        <div><b>${settled}</b><span>处殖民世界（共 ${w.length} 个节点）</span></div>
        <div><b>${sectors}</b><span>个星区 · 4 个象限</span></div>
        <div><b>20,000<small>ly</small></b><span>沿主干的最远探索纪录</span></div>
      </section>
      <div class="home-grid">
        <section>
          <div class="section-title"><h2>小说书架</h2><a href="#novels">全部 →</a></div>
          <div class="feature-book">
            <a class="cover" href="#book-${book.id}">${coverSVG(book)}</a>
            <div>
              <div class="eyebrow">${esc(book.volume)} · ${esc(book.status)}</div>
              <h3>${esc(book.title)}</h3>
              <p>${esc(book.synopsis)}</p>
              <div class="row">${last ? `<a class="btn btn-primary" href="#read-${book.id}-${last.ch}">继续阅读 · ${esc((book.chapters.find((c) => c.id === last.ch) || {}).title || '')}</a>` : `<a class="btn btn-primary" href="#read-${book.id}-${book.chapters[0].id}">从序章开始</a>`}<a class="btn" href="#book-${book.id}">目录</a></div>
            </div>
          </div>
        </section>
        <section>
          <div class="section-title"><h2>设定词条</h2><a href="#library">文库 →</a></div>
          <nav class="entry-list">${lore.slice(0, 7).map((p) => `<a href="#page-${p.id}"><b>${esc(p.title)}</b><em>${esc(p.id.toUpperCase().replace(/-/g, ' '))}</em><span>${esc(p.summary)}</span></a>`).join('')}</nav>
        </section>
      </div>
      <div class="tiles">
        <a class="tile" href="#worlds"><b>世界档案</b><span>${w.length} 个节点：殖民地、失联世界、科考站与域外前哨，可按类型、星区、航路状态筛选。</span></a>
        <a class="tile" href="#people"><b>人物志</b><span>${D.chars.length} 位人物：从 ama-7 到章鱼爱德华，附关系与出场章节。</span></a>
        <a class="tile" href="#tools"><b>航道坐标计算器</b><span>把赤经、赤纬和距离换算成以天蝎主干为轴的联邦坐标，一键加入星图。</span></a>
        <a class="tile" href="#about"><b>维护与源码</b><span>编辑星图、导出 worlds.json、本地运行与下载完整源码。</span></a>
      </div>
    </div>`;
    heroStop = heroChart($('#hero-canvas'));
  }

  /* ---------- 世界档案 ---------- */
  function worldFilterList() {
    const f = ui.worlds; const q = f.q.trim().toLowerCase();
    let arr = D.worlds.filter((w) => (!f.cats || f.cats.has(w.kind)) && (!f.status || w.status === f.status) && (!f.sector || w.sector === f.sector));
    if (q) arr = arr.filter((w) => [w.name, w.en, w.host, w.planet, w.sector, w.domain, w.summary, ...(w.aliases || []), ...(w.tags || [])].join(' ').toLowerCase().includes(q));
    const by = { no: (a, b) => (a.no ? +a.no : 999) - (b.no ? +b.no : 999) || a.dist - b.dist, dist: (a, b) => a.dist - b.dist, name: (a, b) => a.name.localeCompare(b.name, 'zh'), z: (a, b) => a.z - b.z };
    return arr.sort(by[f.sort] || by.no);
  }
  function renderWorlds() {
    setTitle('世界档案');
    const cats = Object.entries(D.base.categories).filter(([k]) => D.worlds.some((w) => w.kind === k));
    const sectors = Array.from(new Set(D.worlds.map((w) => w.sector).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'zh'));
    const f = ui.worlds;
    view().innerHTML = `<div class="page">
      <header class="page-head"><div class="eyebrow">World Registry</div><h1>世界档案</h1><p>人类在银河系里落过脚的地方：殖民地、周期性边疆、失联世界、待开发目标与科考站。想改哪一条，在星图里打开编辑模式就行。</p></header>
      <div class="toolbar">
        <input id="wq" type="search" placeholder="搜索名称、恒星、星区、标签…" value="${esc(f.q)}" aria-label="搜索世界">
        <select id="ws" aria-label="航路状态"><option value="">全部状态</option>${Object.keys(D.base.statuses).map((s) => `<option${f.status === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <select id="wsec" aria-label="星区"><option value="">全部星区</option>${sectors.map((s) => `<option${f.sector === s ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
        <select id="wsort" aria-label="排序"><option value="no"${f.sort === 'no' ? ' selected' : ''}>按编号</option><option value="dist"${f.sort === 'dist' ? ' selected' : ''}>按距地球</option><option value="z"${f.sort === 'z' ? ' selected' : ''}>按主干位置 z</option><option value="name"${f.sort === 'name' ? ' selected' : ''}>按名称</option></select>
        <div class="seg" role="group" aria-label="显示方式"><button data-m="grid" aria-pressed="${f.mode === 'grid'}">卡片</button><button data-m="table" aria-pressed="${f.mode === 'table'}">表格</button></div>
      </div>
      <div class="chips" id="wcats">${cats.map(([k, c]) => `<button class="chip toggle" style="--c:${c.color}" data-k="${esc(k)}" aria-pressed="${!f.cats || f.cats.has(k) ? 'true' : 'false'}"><i></i>${esc(k)}</button>`).join('')}<button class="chip" id="wcat-all">全选</button></div>
      <div class="count" id="wcount"></div>
      <div id="wlist" style="margin-top:12px"></div>
    </div>`;
    const draw = () => {
      const arr = worldFilterList();
      $('#wcount').textContent = `显示 ${arr.length} / ${D.worlds.length} 个节点`;
      if (f.mode === 'table') {
        $('#wlist').innerHTML = `<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th>名称</th><th>English</th><th>类型</th><th>状态</th><th>星区 / 星域</th><th>宿主</th><th class="num">x</th><th class="num">y</th><th class="num">z</th><th class="num">距地球 ly</th><th>象限</th></tr></thead><tbody>${arr.map((w) => `<tr><td class="mono">${esc(w.no)}</td><td><a href="#world-${w.id}">${esc(w.name)}</a></td><td class="muted">${esc(w.en)}</td><td>${chip(w.kind, w.color)}</td><td>${esc(w.status)}</td><td>${esc(w.sector)}${w.domain ? ' / ' + esc(w.domain) : ''}</td><td class="muted">${esc(w.host)}</td><td class="num">${PA.fmt(w.x, 1)}</td><td class="num">${PA.fmt(w.y, 1)}</td><td class="num">${PA.fmt(w.z, 1)}</td><td class="num">${PA.fmt(w.dist, 1)}</td><td class="mono">${w.quad}</td></tr>`).join('')}</tbody></table></div>`;
      } else {
        $('#wlist').innerHTML = `<div class="world-grid">${arr.map((w) => `<a class="world-card" href="#world-${w.id}" style="--c:${w.color}"><div class="top"><span>${w.no ? 'No.' + esc(w.no) : esc(w.status)}</span><span>${fmtLy(w.dist)} ly · ${w.quad}</span></div><h3>${esc(w.name)}<small>${esc(w.en !== w.name ? w.en : '')}</small></h3><p>${esc(w.summary || '资料待补充')}</p><div class="meta">${chip(w.kind, w.color)}<span>${esc(w.sector || '')}</span></div></a>`).join('') || '<p class="muted">没有符合条件的世界。</p>'}</div>`;
      }
    };
    $('#wq').oninput = (e) => { f.q = e.target.value; draw(); };
    $('#ws').onchange = (e) => { f.status = e.target.value; draw(); };
    $('#wsec').onchange = (e) => { f.sector = e.target.value; draw(); };
    $('#wsort').onchange = (e) => { f.sort = e.target.value; draw(); };
    $$('.seg button', view()).forEach((b) => b.onclick = () => { f.mode = b.dataset.m; $$('.seg button', view()).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); });
    $$('#wcats button[data-k]').forEach((b) => b.onclick = () => {
      if (!f.cats) f.cats = new Set(cats.map(([k]) => k));
      const k = b.dataset.k; f.cats.has(k) ? f.cats.delete(k) : f.cats.add(k);
      b.setAttribute('aria-pressed', String(f.cats.has(k))); draw();
    });
    $('#wcat-all').onclick = () => { f.cats = null; $$('#wcats button[data-k]').forEach((b) => b.setAttribute('aria-pressed', 'true')); draw(); };
    draw();
  }

  function locatorSVG(w) {
    // 俯视（z 横轴，x 纵轴）定位图
    const far = w.dist > 2400;
    const zmin = far ? Math.min(-2500, w.z - 3000) : -650, zmax = far ? Math.max(21000, w.z + 3000) : 1650;
    const xr = far ? Math.max(2600, Math.abs(w.x) + 1500) : 620;
    const W = 320, H = 200, sx = W / (zmax - zmin), sy = H / (2 * xr);
    const X = (z) => (z - zmin) * sx, Y = (x) => H / 2 - x * sy;
    const env = (R) => { const pts = []; for (let z = -500; z <= 1500; z += 25) { const r = R * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(Math.abs(z - 500) - 800, 0) / 200, 2))); pts.push([X(z), Y(r)]); } for (let z = 1500; z >= -500; z -= 25) { const r = R * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(Math.abs(z - 500) - 800, 0) / 200, 2))); pts.push([X(z), Y(-r)]); } return 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z'; };
    const others = D.worlds.filter((o) => o !== w && !o.solar && o.group !== 'remote').map((o) => `<circle cx="${X(o.z).toFixed(1)}" cy="${Y(o.x).toFixed(1)}" r="1.3" fill="#5D6B86"/>`).join('');
    const px = X(w.z), py = Y(w.x);
    return `<svg class="locator" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(w.name)} 在联邦俯视图中的位置">
      ${far ? `<rect x="${X(0)}" y="${Y(2000)}" width="${X(20000) - X(0)}" height="${Y(-2000) - Y(2000)}" fill="rgba(127,224,168,.07)" stroke="rgba(127,224,168,.35)" stroke-dasharray="3 3"/>` : ''}
      <path d="${env(500)}" fill="rgba(226,178,84,.07)" stroke="rgba(226,178,84,.35)"/>
      <path d="${env(250)}" fill="rgba(79,214,232,.08)" stroke="rgba(79,214,232,.45)"/>
      <line x1="${X(-500)}" y1="${H / 2}" x2="${X(far ? 20000 : 1500)}" y2="${H / 2}" stroke="#E2B254" stroke-width="1.2"/>
      ${others}
      <circle cx="${X(0)}" cy="${H / 2}" r="2.4" fill="#FFE7B0"/><text x="${X(0) + 4}" y="${H / 2 + 12}" fill="#8E9BB4" font-size="9">太阳系</text>
      ${w.group === 'remote' ? `<text x="${W - 8}" y="16" text-anchor="end" fill="#FFD9A0" font-size="10">→ 大麦哲伦星系（约16万光年，不在图幅内）</text>` : `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="9" fill="none" stroke="${w.color}" stroke-width="1" opacity=".6"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.6" fill="${w.color}"/><text x="${Math.min(px + 8, W - 60).toFixed(1)}" y="${(py - 8).toFixed(1)}" fill="#E6EBF5" font-size="11" font-weight="600">${esc(w.name)}</text>`}
      <text x="6" y="${H - 6}" fill="#6F7C96" font-size="8.5">俯视：横轴 z（主干） · 纵轴 x</text>
    </svg>`;
  }
  function renderWorld(id) {
    const w = D.byId[id];
    if (!w) { view().innerHTML = `<div class="page"><h1>找不到这个世界</h1><p class="muted">编号 ${esc(id)} 不存在，可能已被删除或改名。</p><a class="btn" href="#worlds">返回世界档案</a></div>`; return; }
    setTitle(w.name);
    const eq = PA.coords.fromFederation(w.x, w.y, w.z);
    const facts = Object.entries(w.facts || {});
    const same = D.worlds.filter((o) => o !== w && o.sector && o.sector === w.sector && !/特殊|疆域之外/.test(o.sector)).slice(0, 12);
    const people = D.chars.filter((c) => c.origin === w.id);
    const pages = D.pages.filter((p) => p._text && (p._text.includes(w.name) || (w.aliases || []).some((a) => a.length > 1 && p._text.includes(a))) && p.category !== 'draft').slice(0, 10);
    const edit = PA.editState(w.id);
    view().innerHTML = `<div class="page">
      <div class="crumbs"><a href="#worlds">世界档案</a><span>/</span><span>${esc(w.sector || '—')}</span>${w.domain ? `<span>/</span><span>${esc(w.domain)}</span>` : ''}</div>
      <header class="world-head" style="margin-top:14px">
        <div><div class="eyebrow">${w.no ? 'No.' + esc(w.no) + ' · ' : ''}${esc(w.cat.en || '')} World</div><h1>${esc(w.name)}<small>${esc(w.en || '')}</small></h1>
          <div class="row" style="margin-top:12px">${chip(w.kind, w.color)}${chip(w.status)}<span class="chip">象限 ${w.quad}</span>${w.novel ? '<span class="chip" style="--c:var(--accent)"><i></i>小说地名</span>' : ''}${edit ? `<span class="chip" style="--c:var(--ok)"><i></i>${edit === 'cloud' ? '已在线修改' : '本地修改'}</span>` : ''}</div></div>
        <div class="row"><a class="btn btn-primary" href="#map" data-focus="${w.id}">${ICON.map}在星图中定位</a><a class="btn" href="#map" data-edit="${w.id}">${ICON.edit}编辑</a></div>
      </header>
      <div class="two-col">
        <div class="article" style="max-width:none">
          <p class="lead-text">${esc(w.summary || '资料待补充。')}</p>
          ${w.hook ? `<div class="hook"><b>故事钩子 · </b>${esc(w.hook)}</div>` : ''}
          ${facts.length ? `<h2 style="margin-top:10px">档案字段</h2><dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
          ${w.notes ? '<div style="margin-top:20px">' + PA.md(w.notes).html + '</div>' : ''}
          ${(() => { const sd = D.base.solar; const body = w.solar && sd ? sd.bodies.find((b) => b.world === w.id) : null; const sites = body ? (sd.sites || []).filter((x) => x.body === body.id && (w.id !== 'earth' || x.lat != null || x.orbit_km)) : []; return sites.length ? `<h2>${w.id === 'earth' ? '地表与轨道上的地点' : '地点'}</h2><div class="site-list">${sites.map((x) => `<div class="site-card"><div class="row" style="justify-content:space-between;gap:8px"><b>${esc(x.name)}</b><span class="chip">${esc(x.type)}</span></div><p>${esc(x.summary || '')}</p><a href="#map" data-site="${x.id}">在星图中查看 →</a></div>`).join('')}</div>` : ''; })()}
          ${people.length ? `<h2>出身于此的人物</h2><div class="row">${people.map((c) => `<a class="chip" style="--c:${c.color}" href="#person-${c.id}"><i></i>${esc(c.name)}</a>`).join('')}</div>` : ''}
          ${pages.length ? `<h2>提到它的词条</h2><div class="row">${pages.map((p) => `<a class="chip" href="#page-${p.id}">${esc(p.title)}</a>`).join('')}</div>` : ''}
          ${same.length ? `<h2>同星区</h2><div class="row">${same.map((o) => `<a class="chip" style="--c:${o.color}" href="#world-${o.id}"><i></i>${esc(o.name)}</a>`).join('')}</div>` : ''}
        </div>
        <aside class="side-card">
          <h4>联邦坐标 · 光年</h4>
          <div class="coord-grid"><div><span>X</span><b>${PA.fmt(w.x, 1)}</b></div><div><span>Y</span><b>${PA.fmt(w.y, 1)}</b></div><div><span>Z</span><b>${PA.fmt(w.z, 1)}</b></div>
          <div><span>距地球</span><b>${fmtLy(w.dist)}</b></div><div><span>离轴 r</span><b>${fmtLy(w.r)}</b></div><div><span>象限</span><b>${w.quad}</b></div></div>
          ${locatorSVG(w)}
          <dl class="facts"><dt>宿主</dt><dd>${esc(w.host || '—')}</dd>${w.planet ? `<dt>行星</dt><dd>${esc(w.planet)}</dd>` : ''}<dt>银经 / 银纬</dt><dd class="mono">${PA.fmt(eq.l, 2)}° / ${PA.fmt(eq.b, 2)}°</dd><dt>赤经 / 赤纬</dt><dd class="mono">${PA.fmt(eq.ra, 2)}° / ${PA.fmt(eq.dec, 2)}°</dd></dl>
          ${w.solar ? '<p class="note">太阳系内的世界在星图中按真实比例显示：点“在星图中定位”，镜头会一路飞进太阳系。</p>' : ''}
          ${w.source ? `<a class="note" href="${esc(w.source)}" target="_blank" rel="noopener">观测资料来源 ↗</a>` : ''}
        </aside>
      </div>
    </div>`;
    PA.autolink($('.lead-text', view()), '#world-' + w.id);
    wireMapLinks();
  }
  function wireMapLinks() {
    $$('[data-focus],[data-edit]', view()).forEach((a) => a.addEventListener('click', () => { PA.pendingFocus = { id: a.dataset.focus || a.dataset.edit, edit: !!a.dataset.edit }; }));
    $$('[data-site]', view()).forEach((a) => a.addEventListener('click', () => { PA.pendingFocus = { site: a.dataset.site }; }));
  }

  /* ---------- 文库 ---------- */
  function libNav(active) {
    const groups = D.pageCats.map((c) => `<h5>${esc(c.name)}</h5>${D.pages.filter((p) => p.category === c.id).map((p) => `<a href="#page-${p.id}"${p.id === active ? ' class="active" aria-current="page"' : ''}>${esc(p.title)}</a>`).join('')}`).join('');
    return `<nav class="lib-nav" aria-label="文库目录"><details open><summary class="sr-only">文库目录</summary>${groups}</details></nav>`;
  }
  function renderLibrary() {
    setTitle('设定文库');
    view().innerHTML = `<div class="page"><header class="page-head"><div class="eyebrow">Codex</div><h1>设定文库</h1><p>这个世界的制度、地理、历史与事件。词条之间互相链接，读到陌生的名字可以直接点进去。</p></header>
      <div class="lib">${libNav('')}<div class="article" style="max-width:none">${D.pageCats.map((c) => `<section style="margin-bottom:30px"><h2 style="margin-top:0">${esc(c.name)}</h2><p class="muted">${esc(c.desc)}</p><nav class="entry-list">${D.pages.filter((p) => p.category === c.id).map((p) => `<a href="#page-${p.id}"><b>${esc(p.title)}</b><em>${p._text ? PA.fmt(p._text.replace(/\s/g, '').length) + ' 字' : ''}</em><span>${esc(p.summary || '')}</span></a>`).join('')}</nav></section>`).join('')}</div></div></div>`;
  }
  async function renderPage(id) {
    const p = D.pages.find((x) => x.id === id);
    if (!p) { view().innerHTML = `<div class="page"><h1>找不到词条</h1><a class="btn" href="#library">返回文库</a></div>`; return; }
    setTitle(p.title);
    view().innerHTML = `<div class="page"><div class="lib">${libNav(id)}<article class="article" id="art"><p class="muted">正在读取…</p></article><aside class="lib-toc" id="toc"></aside></div></div>`;
    let text; try { text = p._text || (p._text = await PA.fetchText(p.file)); } catch (e) { $('#art').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (route.current !== 'page-' + id) return;
    const r = PA.md(text);
    const cat = D.pageCats.find((c) => c.id === p.category);
    $('#art').innerHTML = `<div class="crumbs" style="margin-bottom:10px"><a href="#library">设定文库</a><span>/</span><span>${esc(cat ? cat.name : '')}</span></div>${p.category === 'draft' ? '<div class="hook">这是早期整理稿的存档，含建议性补充。内容若与“设定词条”冲突，以设定词条和用户原文为准。</div>' : ''}${r.html}<div class="backlinks" id="bl"></div>`;
    PA.autolink($('#art'), '#page-' + id);
    const links = Array.from(new Set($$('#art a.wl:not(.missing)').map((a) => a.getAttribute('href'))));
    const items = links.map((h) => { const [, kind, key] = h.match(/^#(world|person|page)-(.+)$/) || []; if (kind === 'world' && D.byId[key]) return `<a class="chip" style="--c:${D.byId[key].color}" href="${h}"><i></i>${esc(D.byId[key].name)}</a>`; if (kind === 'person') { const c = charById(key); return c ? `<a class="chip" style="--c:${c.color}" href="${h}"><i></i>${esc(c.name)}</a>` : ''; } if (kind === 'page') { const q = D.pages.find((x) => x.id === key); return q ? `<a class="chip" href="${h}">${esc(q.title)}</a>` : ''; } return ''; }).filter(Boolean);
    $('#bl').innerHTML = items.length ? `<h4>本页涉及</h4><div class="row">${items.join('')}</div>` : '';
    $('#toc').innerHTML = r.heads.filter((h) => h.lv > 1 && h.lv < 4).length ? '<div class="eyebrow" style="margin-bottom:8px">本页目录</div>' + r.heads.filter((h) => h.lv > 1 && h.lv < 4).map((h) => `<a class="h${h.lv}" href="javascript:void 0" data-id="${h.id}">${esc(h.text)}</a>`).join('') : '';
    $$('#toc a').forEach((a) => a.onclick = (e) => { e.preventDefault(); const el = document.getElementById(a.dataset.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  }

  /* ---------- 小说 ---------- */
  function readSet(bookId) { return new Set(PA.ls.get('pa.readset.' + bookId, [])); }
  function renderShelf() {
    setTitle('小说书架');
    const N = D.novels;
    view().innerHTML = `<div class="page"><header class="page-head"><div class="eyebrow">Bookshelf</div><h1>小说书架</h1><p>发生在前文明时代的故事。每一卷都可以在线阅读，阅读进度会保存在这台设备上。</p></header>
      <div class="shelf">${N.books.map((b) => `<a class="book" href="#book-${b.id}"><div class="cover">${coverSVG(b)}</div><b>${esc(b.title)}</b><span>${esc(b.volume)} · ${b.chapters.length} 章 · ${esc(b.status)}</span></a>`).join('')}
      ${(N.slots || []).map((s) => `<div class="book"><div class="slot"><div><strong>${esc(s.title)}</strong>${esc(s.hint)}</div></div><b class="muted">新卷预留</b></div>`).join('')}</div></div>`;
  }
  function renderBook(id) {
    const b = D.novels.books.find((x) => x.id === id); if (!b) { view().innerHTML = '<div class="page"><h1>找不到这本书</h1></div>'; return; }
    setTitle(b.title);
    const rs = readSet(b.id); const last = PA.ls.get('pa.read.' + b.id, null);
    const total = b.chapters.reduce((s, c) => s + (c._text ? c._text.replace(/\s/g, '').length : 0), 0);
    const cast = b.cast ? b.cast.map(charById).filter(Boolean) : D.chars.filter((c) => (c.chapters || []).length);
    const places = b.places ? b.places.map((id) => D.byId[id]).filter(Boolean) : D.worlds.filter((w) => w.novel);
    view().innerHTML = `<div class="page">
      <div class="crumbs"><a href="#novels">小说书架</a><span>/</span><span>${esc(b.title)}</span></div>
      <section class="book-head" style="margin-top:18px"><div class="cover">${coverSVG(b)}</div>
        <div><div class="eyebrow">${esc(b.volume)} · ${esc(b.status)}</div><h1>${esc(b.title)}</h1><p class="synopsis">${esc(b.synopsis)}</p>
          <div class="row"><a class="btn btn-primary" href="#read-${b.id}-${last ? last.ch : b.chapters[0].id}">${ICON.book}${last ? '继续阅读' : '开始阅读'}</a><span class="muted" style="font-size:13px">${b.chapters.length} 章${total ? ' · 约 ' + PA.fmt(total) + ' 字 · 约 ' + Math.round(total / 450) + ' 分钟' : ''}</span></div>
          <p class="note" style="margin-top:14px">${esc(b.credits || '')}</p></div></section>
      <div class="two-col"><div><div class="section-title"><h2>目录</h2></div><nav class="toc-list">${b.chapters.map((c, i) => `<a href="#read-${b.id}-${c.id}" class="${rs.has(c.id) ? 'read' : ''}"><span class="n">${String(i).padStart(2, '0')}</span><span class="t">${esc(c.title)}</span><span class="w">${c._text ? PA.fmt(c._text.replace(/\s/g, '').length) + ' 字' : ''}</span></a>`).join('')}</nav></div>
        <aside class="side-card"><h4>登场人物</h4><div class="cast">${cast.map((c) => `<a class="chip" style="--c:${c.color}" href="#person-${c.id}"><i></i>${esc(c.name)}</a>`).join('')}</div>
          <h4>相关地点</h4><div class="cast">${places.map((w) => `<a class="chip" style="--c:${w.color}" href="#world-${w.id}"><i></i>${esc(w.name)}</a>`).join('')}</div>
          <a class="btn" href="#map" data-novel="1">${ICON.map}在星图中只看小说地名</a>
          ${b.archive ? `<a class="btn" href="#page-${esc(b.archive)}">${esc(b.archiveLabel || '事件档案与时间线')}</a>` : ''}</aside></div></div>`;
    const nb = $('[data-novel]', view()); if (nb) nb.addEventListener('click', () => { PA.pendingFocus = { novel: true }; });
  }
  async function renderReader(bookId, chId) {
    const b = D.novels.books.find((x) => x.id === bookId); if (!b) return renderShelf();
    const idx = b.chapters.findIndex((c) => c.id === chId); const c = b.chapters[idx]; if (!c) return renderBook(bookId);
    setTitle(c.title + ' · ' + b.title);
    const size = PA.ls.get('pa.readsize', 18); document.documentElement.style.setProperty('--read-size', size + 'px');
    const links = PA.ls.get('pa.readlinks', false);
    view().innerHTML = `<div class="reader-progress" id="rp"></div><article class="reader">
      <div class="reader-bar"><a href="#book-${b.id}">← 《${esc(b.title)}》目录</a>
        <div class="row"><select id="rch" class="rsel" aria-label="跳转章节">${b.chapters.map((x) => `<option value="${x.id}"${x.id === chId ? ' selected' : ''}>${esc(x.title)}</option>`).join('')}</select>
        <div class="seg" role="group" aria-label="字号"><button id="fs-dec" title="缩小字号">A−</button><button id="fs-inc" title="放大字号">A+</button></div>
        <div class="seg"><button id="rlinks" aria-pressed="${links}" title="在正文中标出世界与人物链接">设定链接</button></div></div></div>
      <div id="rbody"><p class="muted">正在读取…</p></div>
      <nav class="reader-nav">${idx > 0 ? `<a class="prev" href="#read-${b.id}-${b.chapters[idx - 1].id}"><span>← 上一章</span><b>${esc(b.chapters[idx - 1].title)}</b></a>` : '<span></span>'}${idx < b.chapters.length - 1 ? `<a class="next" href="#read-${b.id}-${b.chapters[idx + 1].id}"><span>下一章 →</span><b>${esc(b.chapters[idx + 1].title)}</b></a>` : `<a class="next" href="#book-${b.id}"><span>全书完</span><b>回到目录</b></a>`}</nav>
    </article>`;
    let text; try { text = c._text || (c._text = await PA.fetchText(c.file)); } catch (e) { $('#rbody').innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
    if (route.current !== `read-${bookId}-${chId}`) return;
    const r = PA.prose(text);
    const m = r.title.match(/^(第.+?[节章]|序|尾声)\s*·\s*(.*)$/);
    $('#rbody').innerHTML = `<h1>${m ? `<span class="num">${esc(m[1])}</span>${esc(m[2])}` : esc(r.title)}</h1><div class="prose" id="prose">${r.html}</div>`;
    if (links) PA.autolink($('#prose'));
    const rs = readSet(b.id); rs.add(c.id); PA.ls.set('pa.readset.' + b.id, Array.from(rs));
    const saved = PA.ls.get('pa.read.' + b.id, null);
    window.scrollTo(0, saved && saved.ch === chId && saved.y ? saved.y : 0);
    PA.ls.set('pa.read.' + b.id, { ch: chId, y: saved && saved.ch === chId ? saved.y : 0 });
    $('#rch').onchange = (e) => { location.hash = `read-${b.id}-${e.target.value}`; };
    const setSize = (d) => { const s = Math.max(15, Math.min(24, PA.ls.get('pa.readsize', 18) + d)); PA.ls.set('pa.readsize', s); document.documentElement.style.setProperty('--read-size', s + 'px'); };
    $("#fs-dec").onclick = () => setSize(-1); $("#fs-inc").onclick = () => setSize(1);
    $('#rlinks').onclick = () => { PA.ls.set('pa.readlinks', !links); renderReader(bookId, chId); };
  }
  let scrollSaveT = null;
  window.addEventListener('scroll', () => {
    const rp = $('#rp'); if (!rp) return;
    const h = document.documentElement.scrollHeight - innerHeight; rp.style.width = (h > 0 ? Math.min(100, scrollY / h * 100) : 0) + '%';
    clearTimeout(scrollSaveT); scrollSaveT = setTimeout(() => { const m = route.current.match(/^read-(.+)-(\d+)$/); if (m) PA.ls.set('pa.read.' + m[1], { ch: m[2], y: Math.round(scrollY) }); }, 300);
  }, { passive: true });

  /* ---------- 人物 ---------- */
  function renderPeople() {
    setTitle('人物志');
    const facs = Array.from(new Set(D.chars.map((c) => c.faction)));
    const f = ui.people;
    view().innerHTML = `<div class="page"><header class="page-head"><div class="eyebrow">Dramatis Personae</div><h1>人物志</h1><p>《千金绑架案》与前文明设定中的人物。点击查看人物档案、关系与出场章节。</p></header>
      <div class="chips"><button class="chip" data-f="" aria-pressed="${!f.f}">全部</button>${facs.map((x) => `<button class="chip" data-f="${esc(x)}" aria-pressed="${f.f === x}">${esc(x)}</button>`).join('')}</div>
      <div class="people" id="plist"></div></div>`;
    const draw = () => { $('#plist').innerHTML = D.chars.filter((c) => !f.f || c.faction === f.f).map((c) => `<a class="person" href="#person-${c.id}">${sigil(c)}<div><b>${esc(c.name)}</b><small>${esc(c.role)} · ${esc(c.faction)}</small><p>${esc(c.tagline)}</p></div></a>`).join(''); };
    $$('.chips button', view()).forEach((b) => b.onclick = () => { f.f = b.dataset.f; $$('.chips button', view()).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); });
    draw();
  }
  function renderPerson(id) {
    const c = charById(id); if (!c) { view().innerHTML = '<div class="page"><h1>找不到人物</h1><a class="btn" href="#people">返回人物志</a></div>'; return; }
    setTitle(c.name);
    const book = D.novels.books[0];
    const chs = (c.chapters || []).map((cid) => book.chapters.find((x) => x.id === cid)).filter(Boolean);
    view().innerHTML = `<div class="page"><div class="crumbs"><a href="#people">人物志</a><span>/</span><span>${esc(c.faction)}</span></div>
      <header class="person-head" style="margin-top:16px">${sigil(c, true)}<div><div class="eyebrow">${esc(c.en || '')}</div><h1>${esc(c.name)}</h1><div class="tag">${esc(c.tagline)}</div></div></header>
      <div class="two-col"><div class="article" id="pbody" style="max-width:none"><p class="lead-text">${esc(c.summary)}</p>${c.profile ? PA.md(c.profile).html : ''}
        ${(c.relations || []).length ? `<h2>关系</h2><div class="row">${c.relations.map((r) => { const o = charById(r.id); return o ? `<a class="chip" style="--c:${o.color}" href="#person-${o.id}"><i></i>${esc(o.name)} · <span class="muted">${esc(r.label)}</span></a>` : ''; }).join('')}</div>` : ''}</div>
        <aside class="side-card"><h4>人物档案</h4><dl class="facts"><dt>身份</dt><dd>${esc(c.role)}</dd><dt>阵营</dt><dd>${esc(c.faction)}</dd>${c.origin && D.byId[c.origin] ? `<dt>相关世界</dt><dd>${linkWorld(c.origin)}</dd>` : ''}${Object.entries(c.facts || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}${(c.aliases || []).length ? `<dt>别名</dt><dd>${esc(c.aliases.join('、'))}</dd>` : ''}</dl>
          ${chs.length ? `<h4>出场章节</h4><div class="cast">${chs.map((x) => `<a class="chip" href="#read-${book.id}-${x.id}">${esc(x.title.replace(/ · .*/, ''))}</a>`).join('')}</div>` : ''}</aside></div></div>`;
    PA.autolink($('#pbody'), '#person-' + c.id);
  }

  /* ---------- 工具 ---------- */
  function renderTools() {
    setTitle('航道坐标计算器');
    view().innerHTML = `<div class="page"><header class="page-head"><div class="eyebrow">Navigation Tools</div><h1>航道坐标计算器</h1><p>输入恒星的赤经 α、赤纬 δ（ICRS / J2000）与距离，换算为联邦坐标。z 轴为天蝎主干（银经 ${PA.coords.axis}°），x 在银盘内，y 指向银北。不传播恒星自行。</p></header>
      <div class="tool-grid">
        <section class="panel"><h3>赤道坐标 → 联邦坐标</h3>
          <div class="fields"><label class="field">赤经 α<input id="c-ra" value="17h18m57s" placeholder="17h18m57s 或 259.74"></label><label class="field">赤纬 δ<input id="c-dec" value="-34 59 23" placeholder="-34 59 23 或 -34.99"></label></div>
          <div class="fields"><label class="field">距离<input id="c-d" type="number" step="any" value="23.6"></label><label class="field">单位<select id="c-u"><option value="ly">光年 ly</option><option value="pc">秒差距 pc</option></select></label><label class="field">赤经单位<select id="c-rau"><option value="auto">自动（含 h 视为时）</option><option value="deg">度</option><option value="hour">小时</option></select></label></div>
          <div class="row"><button class="btn" data-preset="gj667">示例：格利泽667 C</button><button class="btn" data-preset="k186">Kepler-186</button><button class="btn" data-preset="tau">鲸鱼座τ</button></div>
          <div class="result" id="c-out"></div>
          <div class="row"><button class="btn btn-primary" id="c-add">${ICON.map}以此坐标在星图中新建世界</button></div></section>
        <section class="panel"><h3>联邦坐标 → 赤道 / 银道坐标</h3>
          <div class="fields"><label class="field">x<input id="r-x" type="number" step="any" value="488.969"></label><label class="field">y<input id="r-y" type="number" step="any" value="82.321"></label><label class="field">z<input id="r-z" type="number" step="any" value="299.407"></label></div>
          <div class="result" id="r-out"></div>
          <h3 style="margin-top:6px">象限</h3>
          <div class="tbl article" style="max-width:none"><table><thead><tr><th>象限</th><th>x</th><th>y</th><th>含义</th></tr></thead><tbody><tr><td>I</td><td>+</td><td>+</td><td>银盘内一侧、银北</td></tr><tr><td>II</td><td>−</td><td>+</td><td>银盘内另一侧、银北</td></tr><tr><td>III</td><td>−</td><td>−</td><td>银盘内另一侧、银南</td></tr><tr><td>IV</td><td>+</td><td>−</td><td>银盘内一侧、银南</td></tr></tbody></table></div>
          <p class="note">换算公式：先用 IAU 标准矩阵把 ICRS 单位向量转为银道直角坐标 (U, V, W)，再绕银北轴旋转 ${PA.coords.axis}°：z = U·cos${PA.coords.axis}° + V·sin${PA.coords.axis}°，x = V·cos${PA.coords.axis}° − U·sin${PA.coords.axis}°，y = W。</p></section>
      </div></div>`;
    const presets = { gj667: ['17h18m57s', '-34 59 23', 23.6], k186: ['19h54m36.65s', '+43 57 18.0', 579], tau: ['01h44m04s', '-15 56 15', 11.9] };
    let last = null;
    const calc = () => {
      const rau = $('#c-rau').value; let ra = PA.coords.parseRA($('#c-ra').value); if (rau === 'hour') ra = parseFloat($('#c-ra').value) * 15; if (rau === 'deg') ra = parseFloat($('#c-ra').value);
      const dec = PA.coords.parseDec($('#c-dec').value); let d = parseFloat($('#c-d').value); if ($('#c-u').value === 'pc') d *= 3.26156;
      if (!(ra >= 0 && ra < 360) || !(dec >= -90 && dec <= 90) || !(d >= 0)) { $('#c-out').innerHTML = '<span class="err">请检查输入：α 应在 0–360°（或 0–24h），δ 在 −90° 到 +90°，距离不能为负。</span>'; last = null; return; }
      const r = PA.coords.toFederation(ra, dec, d); last = r;
      $('#c-out').innerHTML = `<div class="coord-grid"><div><span>X</span><b>${PA.fmt(r.x, 2)}</b></div><div><span>Y</span><b>${PA.fmt(r.y, 2)}</b></div><div><span>Z</span><b>${PA.fmt(r.z, 2)}</b></div><div><span>距离 ly</span><b>${PA.fmt(d, 2)}</b></div><div><span>离轴 r</span><b>${PA.fmt(Math.hypot(r.x, r.y), 1)}</b></div><div><span>象限</span><b>${PA.coords.quadrant(r.x, r.y)}</b></div></div><div class="muted mono" style="font-size:12px">α = ${PA.fmt(ra, 4)}° · δ = ${PA.fmt(dec, 4)}° · 银经 l = ${PA.fmt(r.l, 2)}° · 银纬 b = ${PA.fmt(r.b, 2)}°</div><div class="muted" style="font-size:12.5px">${Math.hypot(r.x, r.y) <= 250 && r.z >= -500 && r.z <= 1500 ? '位于稳定航路主体包络内。' : Math.hypot(r.x, r.y) <= 500 && r.z >= -500 && r.z <= 1500 ? '位于周期性边疆包络内。' : Math.hypot(r.x, r.y) <= 2000 && r.z >= 0 && r.z <= 20000 ? '位于两万光年探索走廊内，但在定居包络之外。' : '位于已知包络之外。'}</div>`;
    };
    const rcalc = () => { const x = +$('#r-x').value, y = +$('#r-y').value, z = +$('#r-z').value; if (![x, y, z].every(isFinite)) return; const r = PA.coords.fromFederation(x, y, z); const h = r.ra / 15; $('#r-out').innerHTML = `<div class="coord-grid"><div><span>α</span><b>${PA.fmt(r.ra, 3)}°</b></div><div><span>δ</span><b>${PA.fmt(r.dec, 3)}°</b></div><div><span>距离</span><b>${PA.fmt(r.d, 1)}</b></div><div><span>l</span><b>${PA.fmt(r.l, 2)}°</b></div><div><span>b</span><b>${PA.fmt(r.b, 2)}°</b></div><div><span>象限</span><b>${PA.coords.quadrant(x, y)}</b></div></div><div class="muted mono" style="font-size:12px">α = ${Math.floor(h)}h ${Math.floor((h % 1) * 60)}m ${PA.fmt((((h % 1) * 60) % 1) * 60, 1)}s</div>`; };
    ['#c-ra', '#c-dec', '#c-d', '#c-u', '#c-rau'].forEach((s) => $(s).addEventListener('input', calc));
    ['#r-x', '#r-y', '#r-z'].forEach((s) => $(s).addEventListener('input', rcalc));
    $$('[data-preset]').forEach((b) => b.onclick = () => { const p = presets[b.dataset.preset]; $('#c-ra').value = p[0]; $('#c-dec').value = p[1]; $('#c-d').value = p[2]; $('#c-u').value = 'ly'; $('#c-rau').value = 'auto'; calc(); });
    $('#c-add').onclick = () => { if (!last) return; PA.pendingFocus = { create: { x: +last.x.toFixed(3), y: +last.y.toFixed(3), z: +last.z.toFixed(3) } }; location.hash = 'map'; };
    calc(); rcalc();
  }

  /* ---------- 维护 ---------- */
  function renderAbout() {
    setTitle('维护与源码');
    const st = PA.store; const nLocal = Object.keys(st.localEdits).length, nCloud = Object.keys(st.cloudEdits).length;
    view().innerHTML = `<div class="page"><header class="page-head"><div class="eyebrow">Maintenance</div><h1>维护与源码</h1><p>档案馆是一个纯静态网站：数据是 JSON，正文是 Markdown，没有数据库也不需要构建工具。</p></header>
      <div class="tool-grid">
        <section class="panel"><h3>星图编辑状态</h3>
          <div class="result"><div>本地修改：<b>${nLocal}</b> 项（只保存在这台设备的浏览器里）</div><div>在线修改：<b>${nCloud}</b> 项${st.cloud ? (st.canCloud ? '（你有编辑权限，新的修改会直接保存到在线档案）' : '（只读）') : '（当前环境不支持在线保存）'}</div></div>
          <p class="note">在星图右上角打开“编辑”，即可拖动、修改、新增或删除世界。改完后导出 worlds.json，替换源码里的 data/worlds.json，就成为正式数据。</p>
          <div class="row"><button class="btn btn-primary" id="m-export">${ICON.dl}导出 worlds.json</button><label class="btn" for="m-import">导入 JSON</label><input id="m-import" type="file" accept=".json,application/json" hidden><button class="btn btn-danger" id="m-clear"${nLocal ? '' : ' disabled'}>清除本地修改</button></div>
          <div id="m-confirm"></div></section>
        <section class="panel"><h3>下载源码</h3><p class="muted" style="margin:0">包含网站全部文件、数据、正文与构建脚本。</p><div class="row"><button class="btn btn-primary" id="m-src">${ICON.dl}下载 precursor-archive.zip</button></div>
          <h3>本地 / 服务器运行</h3>
          <div class="code-block">cd precursor-archive
python3 -m http.server 8000
# 浏览器打开 http://localhost:8000

# 想直接双击 index.html 离线打开：
python3 tools/build.py   # 生成 data/bundle.js</div>
          <p class="note">部署到 Nginx、GitHub Pages 等任何静态主机：把整个目录作为站点根目录即可。路由使用 #hash，不需要服务器重写规则。</p></section>
      </div>
      <div class="article" style="max-width:none;margin-top:30px">${PA.md(MAINT).html}</div></div>`;
    $('#m-export').onclick = async () => { const s = await PA.saveFile('worlds.json', PA.exportWorldsJSON()); PA.toast(s === 'copied' ? '已复制 worlds.json 到剪贴板' : s === 'declined' ? '已取消' : s === 'failed' ? '导出失败，请在本地版中操作' : '已导出 worlds.json'); };
    $('#m-import').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const n = PA.importWorldsJSON(await f.text()); PA.toast(`已导入 ${n} 个世界（保存为本地修改）`); renderAbout(); } catch (err) { PA.toast('导入失败：' + err.message, 4000); } };
    $('#m-clear').onclick = () => { $('#m-confirm').innerHTML = `<div class="confirm">确定清除这台设备上的 ${nLocal} 项本地修改吗？此操作不能撤销。<div class="row"><button class="btn btn-danger" id="m-yes">清除</button><button class="btn" id="m-no">取消</button></div></div>`; $('#m-yes').onclick = () => { PA.clearLocalEdits(); PA.toast('已清除本地修改'); renderAbout(); }; $('#m-no').onclick = () => { $('#m-confirm').innerHTML = ''; }; };
    $('#m-src').onclick = async () => {
      try { const r = await fetch('precursor-archive.zip'); if (!r.ok) throw new Error(); const blob = await r.blob();
        let ok = false;
        if (window.claude && window.claude.use) { const dl = await Promise.race([window.claude.use('downloads'), new Promise((res) => setTimeout(() => res(null), 1500))]); if (dl) { await dl.save({ filename: 'precursor-archive.zip', data: blob }); ok = true; } }
        if (!ok) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'precursor-archive.zip'; a.click(); }
      } catch (e) { PA.toast('这里无法直接下载源码包；请使用对话中附带的 zip 文件。', 4200); }
    };
  }
  const MAINT = `## 文件结构

| 路径 | 作用 |
|---|---|
| \`index.html\` | 网站入口 |
| \`assets/css/app.css\` | 全部样式（主题色在文件开头的 :root 中） |
| \`assets/js/core.js\` | 数据加载、编辑覆盖层、Markdown、交叉链接、搜索、坐标换算 |
| \`assets/js/app.js\` | 路由与各页面 |
| \`assets/js/atlas.js\` | 三维星图（Three.js）与可视化编辑器 |
| \`data/worlds.json\` | **唯一的世界数据源**：坐标、大小、分类、简介 |
| \`data/pages.json\` | 文库目录 |
| \`data/characters.json\` | 人物志 |
| \`data/novels.json\` | 小说书架与章节目录 |
| \`content/lore/*.md\` | 设定词条 |
| \`content/novel/<书>/*.md\` | 小说正文 |
| \`tools/build.py\` | 校验数据、生成离线包 data/bundle.js、打包源码 |

## worlds.json 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| \`id\` | 是 | 稳定的英文/数字编号，用于链接 \`#world-<id>\`；改名时不要改它 |
| \`name\` / \`en\` | 是 | 中文名 / 英文名 |
| \`kind\` | 是 | 分类，必须是 \`categories\` 里的键（花园世界、工业世界…），决定颜色 |
| \`status\` | 是 | 航路状态：稳定航路、周期可达、待复联、失联、待开发、科考站、灾毁、特殊航路 |
| \`x\` \`y\` \`z\` | 是 | 联邦坐标（光年）。可用[坐标计算器](#tools)由赤经赤纬换算 |
| \`size\` | 否 | 星图上的圆点大小倍数，默认 1（建议 0.6–2） |
| \`sector\` \`domain\` | 否 | 星区 / 星域 |
| \`host\` \`planet\` | 否 | 宿主恒星 / 行星 |
| \`summary\` | 否 | 简介，同时显示在档案页和星图详情 |
| \`facts\` | 否 | 任意键值对，显示为“档案字段” |
| \`aliases\` \`tags\` | 否 | 别名（用于搜索和自动链接）/ 标签 |
| \`novel\` | 否 | true 表示在“小说地名”模式中常显 |
| \`solar\` | 否 | 太阳系内的世界（地球、月球、火星…），星图里由 \`solar\` 段落里的同名天体按真实比例绘制 |
| \`group\` | 否 | \`remote\`（域外，如赫菲斯托斯）或 \`explore\`（科考站） |

## 太阳系（worlds.json 的 \`solar\` 段落）

星图里的太阳系、地月空间和地球是按真实比例画的（1 天文单位 ≈ 1.58×10⁻⁵ 光年）。

- **\`bodies\`**：天体。行星写 \`a_au\`（轨道半径，天文单位）、\`L0\`（历元黄经）和 \`n\`（每日平运动，度）；卫星写 \`parent\`、\`a_km\` 与 \`period_days\`。\`radius_km\` 决定球体大小，\`texture\` 指向 \`assets/img/\` 里的等距圆柱贴图，\`pole\` 是北极的赤经、赤纬，\`atmo\` 是大气辉光的颜色。写了 \`world\` 的天体会和同名世界档案联动（点它会打开那份档案）。
- **\`sites\`**：地点。地表地点写 \`body\`、\`lat\`、\`lon\`（东经为正）；同步轨道上的设施写 \`orbit_km\` 和 \`lon\`；L2 附近的事件写 \`anchor\` 与 \`off_km\`（[径向, 黄北, 切向]，公里）。\`type\` 决定圆点颜色：超级都市、淹没区、气候、禁区、基地、大学、轨道设施、事件……；\`major: true\` 表示常显，\`novel: true\` 表示小说地名。
- 地球贴图由 \`tools/gen_textures.py\` 生成：在 Natural Earth 海岸线上叠加“海平面 +8 米”的淹没区多边形（脚本里的 \`FLOOD\`），改完多边形重新运行脚本即可。

## 加一章小说

1. 把正文保存为 \`content/novel/qianjin/24.md\`，第一行写 \`# 第二十四章 · 标题\`。
2. 在 \`data/novels.json\` 对应书的 \`chapters\` 数组里加一项 \`{"id":"24","title":"第二十四章 · 标题","file":"content/novel/qianjin/24.md"}\`。

正文里以“………”开头的段落会显示为系统日志，以“▍”开头的是直播弹幕，单独加粗的段落会排成信件。

## 加一卷新书

在 \`books\` 数组追加一本书（\`id\` 用英文），章节放进 \`content/novel/<id>/\`。书架上的“新卷预留”位置会自动被替换。

## 交叉链接

Markdown 里写 \`[[天鹅三号]]\` 会链接到同名的世界、人物或词条；正文中第一次出现的已知名称也会自动加上链接。`;

  /* ---------- 命令面板 ---------- */
  function openPalette(q0) {
    if ($('.palette-back')) return;
    const back = document.createElement('div'); back.className = 'palette-back';
    back.innerHTML = `<div class="palette" role="dialog" aria-label="搜索档案"><input id="pq" placeholder="搜索世界、人物、词条、小说正文…" autocomplete="off" aria-label="搜索"><div class="results" id="pr" role="listbox"></div><div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> 选择</span><span><kbd>Enter</kbd> 打开</span><span><kbd>Shift</kbd>+<kbd>Enter</kbd> 在星图中定位世界</span><span><kbd>Esc</kbd> 关闭</span></div></div>`;
    document.body.appendChild(back);
    const input = $('#pq'); let sel = 0, res = [];
    const hl = (s, q) => { if (!q) return esc(s); const i = s.toLowerCase().indexOf(q.toLowerCase()); return i < 0 ? esc(s) : esc(s.slice(0, i)) + '<mark>' + esc(s.slice(i, i + q.length)) + '</mark>' + esc(s.slice(i + q.length)); };
    const draw = () => {
      const q = input.value.trim(); res = q ? PA.search(q, 30) : [];
      if (!q) { $('#pr').innerHTML = `<div class="grp">快速入口</div>${[['#map', '三维疆域星图'], ['#book-qianjin', '《千金绑架案》'], ['#worlds', '世界档案'], ['#page-overview', '世界观总览'], ['#tools', '航道坐标计算器']].map((x, i) => `<a class="res${i === sel ? ' on' : ''}" href="${x[0]}" data-i="${i}"><i></i><span><b>${x[1]}</b></span><span class="k"></span></a>`).join('')}`; res = [['#map'], ['#book-qianjin'], ['#worlds'], ['#page-overview'], ['#tools']].map((x) => ({ href: x[0] })); return; }
      let html = '', lastType = '';
      res.forEach((r, i) => { if (r.label !== lastType) { html += `<div class="grp">${esc(r.label)}</div>`; lastType = r.label; } html += `<a class="res${i === sel ? ' on' : ''}" href="${r.href}" data-i="${i}" role="option"><i style="--c:${r.color || 'var(--rule)'}"></i><span><b>${hl(r.title, q)}</b><small>${r.snip ? hl(r.snip, q) : esc(r.sub || '')}</small></span><span class="k">${esc(r.type === 'world' ? (r.w.quad + ' · ' + fmtLy(r.w.dist) + ' ly') : '')}</span></a>`; });
      $('#pr').innerHTML = html || '<div class="grp">没有结果</div>';
    };
    const close = () => back.remove();
    const go = (i, mapIt) => { const r = res[i]; if (!r) return; close(); if (r.type === 'site') { PA.pendingFocus = { site: r.site }; if (location.hash === '#map' && PA.Atlas) { PA.Atlas.show(PA.pendingFocus); PA.pendingFocus = null; } else location.hash = 'map'; return; } if (mapIt && r.type === 'world') { PA.pendingFocus = { id: r.w.id }; location.hash = 'map'; } else location.hash = r.href.slice(1); };
    input.oninput = () => { sel = 0; draw(); };
    input.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { sel = Math.min(res.length - 1, sel + 1); draw(); e.preventDefault(); const on = $('#pr .on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { sel = Math.max(0, sel - 1); draw(); e.preventDefault(); const on = $('#pr .on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel, e.shiftKey); }
      else if (e.key === 'Escape') close();
    };
    back.onclick = (e) => { if (e.target === back) close(); const a = e.target.closest('a.res'); if (a) { e.preventDefault(); go(+a.dataset.i, false); } };
    input.value = q0 || ''; draw(); input.focus();
  }
  PA.openPalette = openPalette;

  /* ---------- 路由 ---------- */
  const route = (PA.route = { current: '' });
  const NAV = [['home', '首页'], ['map', '星图'], ['worlds', '世界'], ['library', '文库'], ['novels', '小说'], ['people', '人物'], ['tools', '工具'], ['about', '维护']];
  function navKey(h) { if (/^world-/.test(h)) return 'worlds'; if (/^page-/.test(h)) return 'library'; if (/^(book|read)-/.test(h)) return 'novels'; if (/^person-/.test(h)) return 'people'; return h; }
  async function onRoute() {
    let h = decodeURIComponent(location.hash.replace(/^#/, '')) || 'home';
    if (!/^[A-Za-z0-9-]+$/.test(h)) { h = 'home'; }
    const prev = route.current; route.current = h;
    if (heroStop) { heroStop(); heroStop = null; }
    $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.k === navKey(h)));
    const isMap = h === 'map';
    document.body.classList.toggle('is-map', isMap);
    if (isMap) { setTitle('三维疆域星图'); if (PA.Atlas) PA.Atlas.show(PA.pendingFocus); PA.pendingFocus = null; return; }
    if (PA.Atlas) PA.Atlas.hide();
    let m;
    if (h === 'home') renderHome();
    else if (h === 'worlds') renderWorlds();
    else if ((m = h.match(/^world-(.+)$/))) renderWorld(m[1]);
    else if (h === 'library') renderLibrary();
    else if ((m = h.match(/^page-(.+)$/))) await renderPage(m[1]);
    else if (h === 'novels') renderShelf();
    else if ((m = h.match(/^book-(.+)$/))) renderBook(m[1]);
    else if ((m = h.match(/^read-(.+)-(\d+)$/))) await renderReader(m[1], m[2]);
    else if (h === 'people') renderPeople();
    else if ((m = h.match(/^person-(.+)$/))) renderPerson(m[1]);
    else if (h === 'tools') renderTools();
    else if (h === 'about') renderAbout();
    else renderHome();
    if (!/^read-/.test(h) && prev !== h) window.scrollTo(0, 0);
  }

  function shell() {
    document.body.insertAdjacentHTML('afterbegin', `<header class="topbar">
      <a class="brand" href="#home" aria-label="前文明档案馆 首页"><svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".55"/><ellipse cx="16" cy="16" rx="13" ry="5.2" fill="none" stroke="currentColor" stroke-width="1" opacity=".4" transform="rotate(-24 16 16)"/><line x1="3.5" y1="22" x2="28.5" y2="10" stroke="#E2B254" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="16" r="2.6" fill="#E2B254"/><circle cx="24.6" cy="11.9" r="1.4" fill="currentColor"/></svg><span><b>前文明档案馆</b><small>PRECURSOR ARCHIVE</small></span></a>
      <nav class="nav" aria-label="主导航">${NAV.map(([k, t]) => `<a href="#${k}" data-k="${k}">${t}</a>`).join('')}</nav>
      <div class="bar-tools"><button class="search-trigger" id="search-btn" aria-label="搜索档案"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>搜索档案</span><kbd>Ctrl K</kbd></button><button class="icon-btn" id="theme-btn" aria-label="切换主题"></button></div>
    </header>`);
    applyTheme(theme);
    $('#search-btn').onclick = () => openPalette();
    $('#theme-btn').onclick = () => { theme = THEMES[(THEMES.indexOf(theme) + 1) % 3]; PA.ls.set('pa.theme', theme); applyTheme(theme); PA.toast($('#theme-btn').title); };
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
      else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
      else if (/^read-/.test(route.current) && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
        if (e.key === 'ArrowRight') { const a = $('.reader-nav .next'); if (a) location.hash = a.getAttribute('href').slice(1); }
        if (e.key === 'ArrowLeft') { const a = $('.reader-nav .prev'); if (a) location.hash = a.getAttribute('href').slice(1); }
      }
    });
  }

  async function start() {
    shell();
    view().innerHTML = '<div class="page"><p class="muted">正在打开档案…</p></div>';
    try { await PA.boot(); } catch (e) { view().innerHTML = `<div class="page"><h1>档案读取失败</h1><p class="err">${esc(e.message)}</p></div>`; return; }
    if (PA.Atlas) PA.Atlas.init($('#map-host'));
    window.addEventListener('hashchange', onRoute);
    PA.on('worlds', () => { if (route.current === 'worlds') renderWorlds(); else if (/^world-/.test(route.current)) renderWorld(route.current.slice(6)); });
    PA.on('indexed', () => { if (route.current === 'library') renderLibrary(); if (/^book-/.test(route.current)) renderBook(route.current.slice(5)); });
    onRoute();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

