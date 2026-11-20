/* 前文明档案馆 · core
   数据加载、编辑覆盖层（本地 / 云端）、Markdown、交叉链接、搜索与坐标换算。
   全局命名空间：window.PA */
(function () {
  'use strict';
  const PA = (window.PA = window.PA || {});
  const listeners = {};
  PA.on = (ev, fn) => ((listeners[ev] = listeners[ev] || []).push(fn), fn);
  PA.emit = (ev, data) => (listeners[ev] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } });

  PA.imgURL = (p) => (window.__PA_IMG__ && window.__PA_IMG__[p]) || p;
  PA.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  PA.$ = (sel, root) => (root || document).querySelector(sel);
  PA.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  PA.fmt = (n, d = 0) => (n == null || !isFinite(n) ? '—' : Number(n).toLocaleString('zh-CN', { maximumFractionDigits: d, minimumFractionDigits: d }));
  PA.ls = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  PA.toast = (msg, ms = 2600) => {
    let t = PA.$('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(PA._toastT); PA._toastT = setTimeout(() => { t.hidden = true; }, ms);
  };

  /* ---------- 文件读取：HTTP 优先，file:// 时使用 data/bundle.js ---------- */
  PA.fetchText = async function (path) {
    const B = window.__PA_BUNDLE__;
    if (B && B[path] != null) return B[path]; // 离线包或托管版：直接使用打包好的内容
    try {
      const r = await fetch(path, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status + ' ' + path);
      return await r.text();
    } catch (e) {
      if (B && B[path] != null) return B[path];
      throw new Error('无法读取 ' + path + '。本地直接打开时请先运行 python3 tools/build.py 生成离线包，或用 python3 -m http.server 启动。');
    }
  };
  PA.fetchJSON = async (path) => JSON.parse(await PA.fetchText(path));

  /* ---------- 坐标换算 ---------- */
  const M = [[-0.0548755604, -0.8734370902, -0.4838350155], [0.4941094279, -0.4448296300, 0.7469822445], [-0.8676661490, -0.1980763734, 0.4559837762]];
  const RAD = Math.PI / 180;
  PA.coords = {
    axis: 20,
    toFederation(raDeg, decDeg, dist, axisDeg) {
      const ax = (axisDeg == null ? PA.coords.axis : axisDeg) * RAD, a = raDeg * RAD, d = decDeg * RAD;
      const v = [Math.cos(d) * Math.cos(a) * dist, Math.cos(d) * Math.sin(a) * dist, Math.sin(d) * dist];
      const [U, V, W] = M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
      return { x: V * Math.cos(ax) - U * Math.sin(ax), y: W, z: U * Math.cos(ax) + V * Math.sin(ax), l: ((Math.atan2(V, U) / RAD) + 360) % 360, b: dist ? Math.asin(W / dist) / RAD : 0 };
    },
    fromFederation(x, y, z, axisDeg) {
      const ax = (axisDeg == null ? PA.coords.axis : axisDeg) * RAD;
      const U = z * Math.cos(ax) - x * Math.sin(ax), V = z * Math.sin(ax) + x * Math.cos(ax), W = y;
      const v = [0, 1, 2].map((i) => M[0][i] * U + M[1][i] * V + M[2][i] * W);
      const d = Math.hypot(x, y, z);
      return { ra: ((Math.atan2(v[1], v[0]) / RAD) + 360) % 360, dec: d ? Math.asin(v[2] / d) / RAD : 0, d, l: ((Math.atan2(V, U) / RAD) + 360) % 360, b: d ? Math.asin(W / d) / RAD : 0 };
    },
    quadrant(x, y) { if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return '轴上'; return x >= 0 ? (y >= 0 ? 'I' : 'IV') : (y >= 0 ? 'II' : 'III'); },
    parseRA(s) { // "17h19m03s" / "17 19 03" / "259.76"(度) / "17.3h"
      s = String(s).trim().toLowerCase(); if (!s) return NaN;
      const hms = s.match(/^(-?\d+(?:\.\d+)?)\s*[h:\s]\s*(\d+(?:\.\d+)?)?\s*[m:'\s]?\s*(\d+(?:\.\d+)?)?\s*s?$/);
      if (/h|:|\s/.test(s) && hms) { const h = +hms[1], m = +(hms[2] || 0), sec = +(hms[3] || 0); return (h + m / 60 + sec / 3600) * 15; }
      const f = parseFloat(s); return isFinite(f) ? f : NaN;
    },
    parseDec(s) { // "-34 59 23" / "-34°59'23\"" / "-34.99"
      s = String(s).trim(); if (!s) return NaN;
      const m = s.match(/^([+-]?)(\d+(?:\.\d+)?)\s*[°d:\s]\s*(\d+(?:\.\d+)?)?\s*['′m:\s]?\s*(\d+(?:\.\d+)?)?\s*["″s]?$/);
      if (/[°d:'′"″\s]/.test(s.replace(/^[+-]/, '')) && m) { const sg = m[1] === '-' ? -1 : 1; return sg * (+m[2] + (+(m[3] || 0)) / 60 + (+(m[4] || 0)) / 3600); }
      const f = parseFloat(s); return isFinite(f) ? f : NaN;
    }
  };

  /* ---------- 数据 ---------- */
  const D = (PA.data = { worlds: [], byId: {}, base: null, pages: [], pageCats: [], chars: [], novels: null, ready: false });
  PA.derive = function (w) {
    w.dist = Math.hypot(w.x, w.y, w.z);
    w.r = Math.hypot(w.x, w.y);
    w.quad = PA.coords.quadrant(w.x, w.y);
    w.cat = (D.base && D.base.categories[w.kind]) || { color: '#A6B0C3', en: '' };
    w.color = w.cat.color;
    return w;
  };

  /* 编辑覆盖层：base ← cloud ← local */
  const LS_KEY = 'pa.atlas.edits.v1';
  const store = (PA.store = { cloud: null, canCloud: false, cloudEdits: {}, localEdits: PA.ls.get(LS_KEY, {}) });
  function rebuildWorlds() {
    const base = D.base.worlds.map((w) => Object.assign({}, w));
    const map = new Map(base.map((w) => [w.id, w]));
    for (const layer of [store.cloudEdits, store.localEdits]) {
      for (const [id, rec] of Object.entries(layer || {})) {
        if (rec && rec.__deleted) { map.delete(id); continue; }
        if (rec) map.set(id, Object.assign({}, map.get(id) || {}, rec, { id }));
      }
    }
    D.worlds = Array.from(map.values()).map(PA.derive);
    D.byId = Object.fromEntries(D.worlds.map((w) => [w.id, w]));
    buildIndex();
  }
  PA.rebuildWorlds = rebuildWorlds;
  PA.editState = (id) => (store.localEdits[id] ? 'local' : store.cloudEdits[id] ? 'cloud' : null);
  PA.editCount = () => Object.keys(store.localEdits).length + Object.keys(store.cloudEdits).length;
  PA.isNewWorld = (id) => !D.base.worlds.some((w) => w.id === id);
  function clean(rec) {
    const out = {};
    for (const [k, v] of Object.entries(rec)) {
      if (['dist', 'r', 'quad', 'cat', 'color'].includes(k)) continue;
      if (v === '' || v == null || (Array.isArray(v) && !v.length)) continue;
      out[k] = v;
    }
    return out;
  }
  PA.saveWorld = async function (rec) {
    const r = clean(rec);
    if (store.canCloud) {
      try {
        await store.cloud.collection('atlas_edits').doc(r.id).set({ rec: r, at: new Date().toISOString() });
        store.cloudEdits[r.id] = r; delete store.localEdits[r.id]; PA.ls.set(LS_KEY, store.localEdits);
        rebuildWorlds(); PA.emit('worlds'); return 'cloud';
      } catch (e) { console.warn('cloud save failed', e); store.canCloud = false; PA.emit('store'); }
    }
    store.localEdits[r.id] = r; PA.ls.set(LS_KEY, store.localEdits);
    rebuildWorlds(); PA.emit('worlds'); return 'local';
  };
  PA.deleteWorld = async function (id) {
    const marker = { __deleted: true };
    if (store.canCloud) {
      try { await store.cloud.collection('atlas_edits').doc(id).set({ rec: marker, at: new Date().toISOString() }); store.cloudEdits[id] = marker; rebuildWorlds(); PA.emit('worlds'); return 'cloud'; }
      catch (e) { store.canCloud = false; }
    }
    store.localEdits[id] = marker; PA.ls.set(LS_KEY, store.localEdits); rebuildWorlds(); PA.emit('worlds'); return 'local';
  };
  PA.revertWorld = async function (id) {
    if (store.localEdits[id]) { delete store.localEdits[id]; PA.ls.set(LS_KEY, store.localEdits); }
    else if (store.cloudEdits[id] && store.canCloud) {
      try { await store.cloud.collection('atlas_edits').doc(id).delete(); delete store.cloudEdits[id]; } catch (e) { console.warn(e); }
    }
    rebuildWorlds(); PA.emit('worlds');
  };
  PA.clearLocalEdits = function () { store.localEdits = {}; PA.ls.del(LS_KEY); rebuildWorlds(); PA.emit('worlds'); };
  PA.exportWorldsJSON = function () {
    const out = Object.assign({}, D.base, { updated: new Date().toISOString().slice(0, 10) });
    out.worlds = D.worlds.map((w) => clean(Object.assign({}, w)));
    return JSON.stringify(out, null, 1);
  };
  PA.importWorldsJSON = function (text) {
    const j = JSON.parse(text);
    const arr = Array.isArray(j) ? j : j.worlds;
    if (!Array.isArray(arr)) throw new Error('文件里没有 worlds 数组');
    let n = 0;
    for (const w of arr) {
      if (!w || !w.id || !w.name || ![w.x, w.y, w.z].every((v) => isFinite(+v))) continue;
      store.localEdits[w.id] = clean(Object.assign({}, w, { x: +w.x, y: +w.y, z: +w.z })); n++;
    }
    PA.ls.set(LS_KEY, store.localEdits); rebuildWorlds(); PA.emit('worlds'); return n;
  };
  PA.saveFile = async function (filename, text, mime) {
    // 托管页面：downloads 能力；本地：<a download>；都失败则复制到剪贴板
    try {
      if (window.claude && window.claude.use) {
        const dl = await Promise.race([window.claude.use('downloads'), new Promise((r) => setTimeout(() => r(null), 1500))]);
        if (dl) { const res = await dl.save({ filename, data: new Blob([text], { type: mime || 'application/json' }) }); return res && res.status ? res.status : 'saved'; }
      }
    } catch (e) { if (e && e.code === 'declined') return 'declined'; }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' })); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      if (location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return 'saved';
    } catch (e) { /* fall through */ }
    try { await navigator.clipboard.writeText(text); return 'copied'; } catch (e) { return 'failed'; }
  };
  async function initCloud() {
    if (!(window.claude && window.claude.use)) return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db) return;
      store.cloud = db;
      const snap = await db.collection('atlas_edits').get();
      const edits = {};
      snap.docs.forEach((d) => { const v = d.data(); if (v && v.rec) edits[d.id] = v.rec; });
      store.cloudEdits = edits;
      store.canCloud = user ? !!(await user.canEdit()) : false;
      rebuildWorlds(); PA.emit('worlds'); PA.emit('store');
    } catch (e) { console.warn('cloud init', e); }
  }

  /* ---------- 名称索引（交叉链接） ---------- */
  const STOP = new Set(['中心', '空间站', '管家', '行长', '千金', '大小姐', '妹妹', 'A', 'W', '安', '阿斯', '支点', '船长', '卡文', '乔治', 'ama', '陆', '中国', '新伦敦', '地球', '火星', '弗莱明', '黑色猞猁', '第七船坞', '灯塔岛', '爱德华', '伯纳德', '普瑞赛斯', '菲恩娜', '普瑞塞斯']);
  let NAMES = new Map(); let AUTO = null;
  function addName(name, target, auto) { if (!name) return; const k = String(name).trim(); if (!k) return; if (!NAMES.has(k)) NAMES.set(k, target); if (auto === false) return; }
  function buildIndex() {
    NAMES = new Map();
    const autoTerms = [];
    const push = (n, t, auto = true) => { if (!n) return; addName(n, t); if (auto && n.length >= 2 && !STOP.has(n)) autoTerms.push(n); };
    D.pages.forEach((p) => { const t = { href: '#page-' + p.id, kind: 'page', title: p.title }; push(p.title, t, p.category === 'lore'); (p.aliases || []).forEach((a) => push(a, t, p.category === 'lore' && a.length >= 2)); });
    D.chars.forEach((c) => {
      const t = { href: '#person-' + c.id, kind: 'person', title: c.name, color: c.color };
      push(c.name, t); (c.aliases || []).forEach((a) => push(a, t, a.length >= 2));
    });
    D.worlds.forEach((w) => {
      const t = { href: '#world-' + w.id, kind: 'world', title: w.name, color: w.color };
      push(w.name, t, !/^[A-Z0-9 \-\/.]+$/i.test(w.name));
      if (w.en) addName(w.en, t);
      (w.aliases || []).forEach((a) => push(a, t, a.length >= 2 && !/^[A-Za-z0-9 \-.]+$/.test(a)));
    });
    const uniq = Array.from(new Set(autoTerms)).filter((n) => NAMES.has(n)).sort((a, b) => b.length - a.length);
    AUTO = uniq.length ? new RegExp(uniq.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g') : null;
    buildSearch();
  }
  PA.resolve = (name) => NAMES.get(String(name).trim()) || null;

  /* 自动链接：每个目标只链接第一次出现 */
  PA.autolink = function (root, selfHref) {
    if (!AUTO) return;
    const used = new Set(selfHref ? [selfHref] : []);
    root.querySelectorAll('a.wl').forEach((a) => used.add(a.getAttribute('href')));
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentElement; if (!p) return NodeFilter.FILTER_REJECT;
        if (p.closest('a,code,pre,h1,h2,h3,h4,button,.no-link,th,.katex,figcaption')) return NodeFilter.FILTER_REJECT;
        return n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const text = node.nodeValue; AUTO.lastIndex = 0; let m, last = 0, frag = null;
      while ((m = AUTO.exec(text))) {
        const t = NAMES.get(m[0]); if (!t || used.has(t.href)) continue;
        used.add(t.href); frag = frag || document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const a = document.createElement('a'); a.className = 'wl'; a.href = t.href; a.textContent = m[0]; a.title = t.title; frag.appendChild(a);
        last = m.index + m[0].length;
      }
      if (frag) { frag.appendChild(document.createTextNode(text.slice(last))); node.parentNode.replaceChild(frag, node); }
    }
  };

  /* ---------- Markdown ---------- */
  function inline(s) {
    s = PA.esc(s);
    const codes = [];
    s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, name, label) => {
      const t = PA.resolve(PA.unesc(name));
      const txt = label || name;
      return t ? `<a class="wl" href="${t.href}" title="${PA.esc(t.title)}">${txt}</a>` : `<a class="wl missing" title="尚未建立的词条">${txt}</a>`;
    });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, t, u) => `<figure class="fig"><img src="${PA.esc(PA.imgURL ? PA.imgURL(PA.unesc(u)) : PA.unesc(u))}" alt="${t}" loading="lazy"><figcaption>${t}</figcaption></figure>`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => {
      const href = PA.unesc(u);
      const ext = /^https?:/i.test(href);
      return `<a href="${PA.esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/(^|[\s(（])(https?:\/\/[^\s<)）]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code>' + codes[+i] + '</code>');
    return s;
  }
  PA.unesc = (s) => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  PA.inline = inline;
  PA.slug = (s, i) => 'h-' + i;
  // 数学公式：$$…$$ 为独立公式，$…$ 为行内公式；先抽出来，排版完再用 KaTeX 渲染
  function mathOut(tex, display) {
    if (window.katex) { try { return window.katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: 'ignore' }); } catch (e) { /* 落到下面 */ } }
    return display ? '<pre class="tex">' + PA.esc(tex) + '</pre>' : '<code class="tex">' + PA.esc(tex) + '</code>';
  }
  PA.md = function (src, opts = {}) {
    const maths = [];
    src = String(src).replace(/\$\$([\s\S]+?)\$\$/g, (_, t) => { maths.push([t.trim(), true]); return '\n\n\u0001' + (maths.length - 1) + '\u0001\n\n'; })
      .replace(/(^|[^\\$])\$([^$\n]+?)\$/g, (_, a, t) => { maths.push([t, false]); return a + '\u0001' + (maths.length - 1) + '\u0001'; });
    const res = mdCore(src, opts);
    if (maths.length) res.html = res.html.replace(/<p>\u0001(\d+)\u0001<\/p>/g, (_, i) => '<div class="math">' + mathOut(maths[+i][0], true) + '</div>').replace(/\u0001(\d+)\u0001/g, (_, i) => mathOut(maths[+i][0], maths[+i][1]));
    return res;
  };
  function mdCore(src, opts) {
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const out = []; let i = 0; let hcount = 0; const heads = [];
    const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    while (i < lines.length) {
      const l = lines[i];
      if (/^\s*$/.test(l)) { i++; continue; }
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; out.push('<pre><code>' + PA.esc(buf.join('\n')) + '</code></pre>'); continue; }
      let m = l.match(/^(#{1,4})\s+(.*)$/);
      if (m) {
        const lv = m[1].length; const id = 'h-' + (++hcount); const txt = m[2].trim();
        if (lv === 1 && opts.skipH1) { i++; continue; }
        heads.push({ lv, id, text: txt.replace(/\*\*/g, '') });
        out.push(`<h${lv} id="${id}">${inline(txt)}</h${lv}>`); i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
      if (/^\s*>/.test(l)) { const buf = []; while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, '')); out.push('<blockquote>' + PA.md(buf.join('\n')).html + '</blockquote>'); continue; }
      if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = cells(l); i += 2; const rows = [];
        while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) rows.push(cells(lines[i++]));
        out.push('<div class="tbl"><table><thead><tr>' + head.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>');
        continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(l)) {
        const ordered = /^\s*\d+[.)]/.test(l); const items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          let item = lines[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) item += lines[i++].trim();
          items.push('<li>' + inline(item) + '</li>');
        }
        out.push((ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>')); continue;
      }
      const buf = [];
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^(#{1,4})\s|^```|^\s*>|^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) buf.push(lines[i++].trim());
      out.push('<p>' + inline(buf.join('')) + '</p>');
    }
    return { html: out.join('\n'), heads };
  }

  /* 小说正文：系统日志、弹幕、信件、分隔 */
  PA.prose = function (src) {
    const paras = String(src).replace(/\r\n?/g, '\n').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let title = ''; const out = []; let letter = [];
    const flush = () => { if (letter.length) { out.push('<div class="letter">' + letter.join('') + '</div>'); letter = []; } };
    for (const p of paras) {
      if (/^#\s+/.test(p)) { title = p.replace(/^#\s+/, ''); continue; }
      const isLetter = /^\*\*[^*]+\*\*$/.test(p);
      if (isLetter) { letter.push('<p>' + PA.esc(p.slice(2, -2)) + '</p>'); continue; }
      flush();
      if (/^……$/.test(p)) { out.push('<p class="sep" aria-hidden="true">· · ·</p>'); continue; }
      if (/^(…{2,}|\.{4,})\S/.test(p) && !/[“”]/.test(p) && p.length < 90) { out.push('<p class="log">' + PA.esc(p) + '</p>'); continue; }
      if (/^▍/.test(p)) { out.push('<p class="chat">' + PA.esc(p.replace(/^▍\s*/, '')) + '</p>'); continue; }
      if (/^>\s?/.test(p)) { out.push('<blockquote>' + inline(p.replace(/^>\s?/gm, '')) + '</blockquote>'); continue; }
      out.push('<p>' + inline(p) + '</p>');
    }
    flush();
    return { title, html: out.join('\n'), chars: paras.join('').replace(/\s/g, '').length };
  };

  /* ---------- 搜索 ---------- */
  let SEARCH = [];
  function buildSearch() {
    const S = [];
    D.worlds.forEach((w) => S.push({ type: 'world', label: '世界', title: w.name, sub: [w.en, w.kind, w.sector].filter(Boolean).join(' · '), keys: [w.name, w.en, w.host, w.planet, w.sector, w.domain, ...(w.aliases || []), ...(w.tags || [])].join(' '), text: w.summary || '', href: '#world-' + w.id, color: w.color, w }));
    D.chars.forEach((c) => S.push({ type: 'person', label: '人物', title: c.name, sub: c.role, keys: [c.name, c.en, ...(c.aliases || [])].join(' '), text: (c.summary || '') + (c.profile || ''), href: '#person-' + c.id, color: c.color }));
    D.pages.forEach((p) => S.push({ type: 'page', label: '文库', title: p.title, sub: p.summary || '', keys: p.title, text: p._text || '', href: '#page-' + p.id }));
    if (D.novels) D.novels.books.forEach((b) => b.chapters.forEach((c) => S.push({ type: 'chapter', label: '小说', title: c.title, sub: '《' + b.title + '》', keys: c.title, text: c._text || '', href: '#read-' + b.id + '-' + c.id })));
    const sol = D.base && D.base.solar; if (sol) (sol.sites || []).forEach((x) => { const b = sol.bodies.find((o) => o.id === x.body); S.push({ type: 'site', label: '太阳系地点', title: x.name, sub: [b ? b.name : '', x.type].filter(Boolean).join(' · '), keys: [x.name, x.en, x.type].join(' '), text: x.summary || '', href: '#map', site: x.id, color: '#FFD98E' }); });
    S.push({ type: 'view', label: '页面', title: '三维疆域星图', sub: '旋转、缩放、筛选、编辑殖民地', keys: '地图 星图 疆域 map atlas', text: '', href: '#map' });
    S.push({ type: 'view', label: '页面', title: '航道坐标计算器', sub: '赤经赤纬 → 联邦坐标', keys: '计算器 坐标 赤经 赤纬 tools', text: '', href: '#tools' });
    SEARCH = S;
  }
  PA.search = function (q, limit = 40) {
    q = String(q || '').trim().toLowerCase(); if (!q) return [];
    const res = [];
    for (const it of SEARCH) {
      const t = it.title.toLowerCase(), k = (it.keys || '').toLowerCase();
      let s = 0, snip = '';
      if (t === q) s = 100; else if (t.startsWith(q)) s = 80; else if (t.includes(q)) s = 60; else if (k.includes(q)) s = 45;
      else { const tx = (it.text || '').replace(/[#>*|`\[\]]+/g, ' ').replace(/\s+/g, ' '); const j = tx.toLowerCase().indexOf(q); if (j >= 0) { s = 20; snip = '…' + tx.slice(Math.max(0, j - 18), j + q.length + 28).replace(/\s+/g, ' ') + '…'; } }
      if (s) res.push(Object.assign({ score: s + ({ world: 4, person: 3, page: 2, view: 5, chapter: 0 }[it.type] || 0), snip }, it));
    }
    return res.sort((a, b) => b.score - a.score).slice(0, limit);
  };

  /* ---------- 启动 ---------- */
  PA.boot = async function () {
    const [worlds, pages, chars, novels] = await Promise.all([
      PA.fetchJSON('data/worlds.json'), PA.fetchJSON('data/pages.json'), PA.fetchJSON('data/characters.json'), PA.fetchJSON('data/novels.json')
    ]);
    D.base = worlds; D.pages = pages.pages; D.pageCats = pages.categories; D.chars = chars.characters; D.novels = novels;
    PA.coords.axis = (worlds.frame && worlds.frame.axis_galactic_longitude_deg) || 20;
    rebuildWorlds();
    D.ready = true;
    initCloud();
    // 后台读取正文，用于全文搜索
    setTimeout(async () => {
      await Promise.all(D.pages.map(async (p) => { try { p._text = await PA.fetchText(p.file); } catch (e) { p._text = ''; } }));
      await Promise.all(novels.books.flatMap((b) => b.chapters.map(async (c) => { try { c._text = await PA.fetchText(c.file); } catch (e) { c._text = ''; } })));
      buildSearch(); PA.emit('indexed');
    }, 400);
  };
})();
