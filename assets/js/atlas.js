/* 前文明档案馆 · 三维疆域图（Three.js r128）
   - 多尺度：地球 → 地月空间 → 太阳系（真实比例）→ 近邻恒星 → 联邦疆域 → 两万光年走廊 → 银河系 → 麦哲伦远征
   - 连续缩放：滚轮可以从地球表面一直退到银河系，镜头在对数空间里飞行
   - 截面：沿主干任取 z 截面，查看四象限
   - 编辑：拖动、改字段、新增 / 删除、导入导出 worlds.json */
(function () {
  'use strict';
  const PA = window.PA; const D = PA.data; const esc = PA.esc; const $ = PA.$; const $$ = PA.$$;
  const A = (PA.Atlas = {});
  if (!window.THREE) { A.init = (host) => { host.innerHTML = '<div class="atlas" style="display:grid;place-items:center;color:#8E9BB4">无法加载 Three.js，星图不可用。</div>'; }; A.show = A.hide = () => {}; return; }
  const T = THREE;
  const S = {
    view: 'federation', cats: null, labels: true, env: true, routes: true, ribs: true, galaxy: true, novel: false,
    sel: null, hover: null, edit: false, draft: null, dirty: false, measure: null, measuring: false,
    section: { z: 0, thick: 150 }, leftOpen: window.innerWidth > 900
  };
  let host, root, canvas, renderer, scene, camera, controls, labelsEl, leadersEl, tipEl;
  let raf = 0, visible = false, inited = false, clock = new T.Clock();
  let worldPts, ringPts, ribs, trunk, trunkPts, extPts, galaxy, starfield, envStable, envFringe, envExplore, sectionGroup, measureLine, routeObjs = [];
  let screen = []; // 每帧投影后的世界屏幕坐标
  const tween = { t: 1, dur: 1.2, from: null, to: null };
  const isEditable = () => S.edit;

  const VIEWS = {
    earth: { name: '地球', short: '地球', min: 1e-12, max: 9e5 },
    earthmoon: { name: '地月空间', short: '地月', min: 1e-12, max: 9e5 },
    solar: { name: '太阳系', short: '太阳系', min: 1e-12, max: 9e5 },
    core: { name: '近邻恒星', short: '近邻', target: [0, 0, 0], off: [-58, 34, -46], min: 0.5, max: 2000 },
    federation: { name: '联邦疆域', short: '联邦', target: [0, 0, 520], off: [-2350, 1180, -520], min: 5, max: 40000 },
    explore: { name: '两万光年走廊', short: '两万光年', target: [0, 0, 9500], off: [-23000, 11500, -4000], min: 50, max: 200000 },
    galaxy: { name: '银河系定位', short: '银河系', target: null, off: null, min: 500, max: 600000 },
    magellan: { name: '麦哲伦远征', short: '麦哲伦', target: null, off: null, min: 500, max: 900000 },
    section: { name: '四象限截面', short: '截面', target: null, off: null, min: 50, max: 20000 }
  };

  /* ---------- 着色器 ---------- */
  const POINT_VS = `attribute float aSize; attribute float aAlpha; attribute vec3 color; uniform float uPR; uniform float uK; varying vec3 vC; varying float vA;
    void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uPR*uK; }`;
  const POINT_FS = `varying vec3 vC; varying float vA;
    void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard;
      float core=smoothstep(0.30,0.19,d); float hot=smoothstep(0.12,0.0,d); float glow=exp(-d*d*5.0)*0.75;
      vec3 col=vC*(core*1.05+glow)+vec3(1.0)*hot*0.35; float a=clamp(core+glow,0.0,1.0)*vA; gl_FragColor=vec4(col*vA,a); }`;
  const RING_FS = `uniform float uTime; varying vec3 vC; varying float vA;
    void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard;
      float r=0.78+0.08*sin(uTime*3.0); float ring=smoothstep(0.07,0.0,abs(d-r)); float a=ring*vA; gl_FragColor=vec4(vC*a,a); }`;
  const GAL_VS = `attribute float aSize; attribute vec3 color; uniform float uScale; uniform float uOpacity; varying vec3 vC; varying float vA;
    void main(){ vC=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv;
      float s=aSize*uScale/max(1.0,-mv.z); vA=uOpacity*clamp(s*1.4,0.15,1.0)*(s>40.0?0.35:1.0); gl_PointSize=clamp(s,1.0,48.0); }`;
  const GAL_FS = `varying vec3 vC; varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard; float a=exp(-d*d*4.0)*vA; gl_FragColor=vec4(vC*a,a); }`;
  const STRING_VS = `attribute float aT; uniform float uPR; uniform float uTime; uniform float uSize; varying float vA;
    void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=uSize*uPR;
      vA=0.28+0.72*pow(0.5+0.5*sin(uTime*1.6-aT*40.0),10.0); }`;
  const STRING_FS = `uniform vec3 uColor; uniform float uOpacity; varying float vA; void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c)*2.0; if(d>1.0) discard; float a=exp(-d*d*3.0)*vA*uOpacity; gl_FragColor=vec4(uColor*a,a); }`;
  const ENV_VS = `varying vec3 vN; varying vec3 vV; varying float vZ; void main(){ vec4 wp=modelMatrix*vec4(position,1.0); vZ=wp.z; vec4 mv=viewMatrix*wp; vV=-mv.xyz; vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*mv; }`;
  const ENV_FS = `uniform vec3 uColor; uniform float uOpacity; uniform float uStripe; varying vec3 vN; varying vec3 vV; varying float vZ;
    void main(){ float f=1.0-abs(dot(normalize(vN),normalize(vV))); float rim=pow(f,3.0); float st=fract(vZ/uStripe); float stripe=smoothstep(0.035,0.0,min(st,1.0-st));
      float a=(rim*0.5+0.025+stripe*0.22)*uOpacity; gl_FragColor=vec4(uColor*a,a); }`;
  const addBlend = { transparent: true, depthWrite: false, depthTest: false, blending: T.AdditiveBlending };

  /* ---------- 工具 ---------- */
  const col = (hex) => new T.Color(hex);
  const rand = (() => { let s = 20260430; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  const gauss = () => { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const envR = (R, z, taper) => R * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(Math.abs(z - 500) - (1000 - taper), 0) / taper, 2)));
  function nice(n) { const p = Math.pow(10, Math.floor(Math.log10(n))); const m = n / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; }
  const AU = 1.58125e-5, KM = 1.05700e-13, RAD = Math.PI / 180;
  const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function kmText(km) { return km >= 1e8 ? PA.fmt(km / 1e8, km < 1e9 ? 2 : 1) + ' 亿公里' : km >= 1e4 ? PA.fmt(km / 1e4, km < 1e5 ? 1 : 0) + ' 万公里' : PA.fmt(km, 0) + ' 公里'; }
  const lyText = (n) => {
    if (n < 0.02) { const au = n / AU; return au >= 0.1 ? PA.fmt(au, au < 1 ? 2 : au < 10 ? 1 : 0) + ' 天文单位' : kmText(n / KM); }
    return n >= 1000 ? PA.fmt(n / 1000, n >= 10000 ? 0 : 1) + ' 千光年' : PA.fmt(n, n < 0.1 ? 2 : n < 10 ? 1 : 0) + ' 光年';
  };
  function niceLen(ly) { // 比例尺取整：光年 / 天文单位 / 公里
    if (ly < 0.02) { const au = ly / AU; if (au >= 0.1) return nice(au) * AU; return nice(ly / KM) * KM; }
    return nice(ly);
  }
  function worldsAll() { const arr = D.worlds.slice(); if (S.draft) { const i = arr.findIndex((w) => w.id === S.draft.id); const d = PA.derive(Object.assign({}, S.draft)); if (i >= 0) arr[i] = d; else arr.push(d); } return arr; }
  function displayPos(w, all) {
    if (w.solar) { const b = SOL.byWorld[w.id]; return b && b.pos ? b.pos.clone() : new T.Vector3(0, 0, 0); }
    // 同一宿主的多个世界轻微错开，便于点击
    const key = w.x.toFixed(2) + ',' + w.y.toFixed(2) + ',' + w.z.toFixed(2);
    const twins = all.filter((o) => !o.solar && (o.x.toFixed(2) + ',' + o.y.toFixed(2) + ',' + o.z.toFixed(2)) === key);
    if (twins.length < 2) return new T.Vector3(w.x, w.y, w.z);
    const i = twins.indexOf(w); const a = i / twins.length * Math.PI * 2; const r = Math.max(0.6, w.dist * 0.012);
    return new T.Vector3(w.x + Math.cos(a) * r, w.y + Math.sin(a) * r, w.z);
  }
  const visibleCat = (w) => !S.cats || S.cats.has(w.kind);

  /* ---------- 场景 ---------- */
  function buildStarfield() {
    const N = 7000, pos = new Float32Array(N * 3), c = new Float32Array(N * 3), sz = new Float32Array(N), al = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const u = rand() * 2 - 1, t = rand() * Math.PI * 2, r = 2e7, s = Math.sqrt(1 - u * u);
      pos.set([r * s * Math.cos(t), r * u, r * s * Math.sin(t)], i * 3);
      const k = rand(); const cc = k < 0.15 ? col('#FFD9B0') : k < 0.4 ? col('#BFD3FF') : col('#E8EEFF');
      c.set([cc.r, cc.g, cc.b], i * 3); sz[i] = 2 + Math.pow(rand(), 6) * 6; al[i] = 0.25 + rand() * 0.55;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(c, 3)); g.setAttribute('aSize', new T.BufferAttribute(sz, 1)); g.setAttribute('aAlpha', new T.BufferAttribute(al, 1));
    const m = new T.ShaderMaterial(Object.assign({ vertexShader: POINT_VS, fragmentShader: GAL_FS.replace('float a=exp(-d*d*4.0)*vA;', 'float a=exp(-d*d*5.0)*vA;'), uniforms: { uPR: { value: 1 }, uK: { value: 1 } } }, addBlend));
    // 复用 POINT_VS：vA 来自 aAlpha
    starfield = new T.Points(g, m); starfield.renderOrder = 0; starfield.frustumCulled = false; scene.add(starfield);
  }
  function buildGalaxy() {
    const G = D.base.galaxy; const C = new T.Vector3(G.center.x, 0, G.center.z);
    const P = [], CC = [], SZ = [];
    const sunAng = Math.atan2(-C.z, -C.x); const k = 0.21; const r0 = 4000;
    const armPhase = sunAng - Math.log(26000 / r0) / k + Math.PI / 4;
    const push = (x, y, z, c, s) => { if (Math.hypot(x, y, z) < 2600) return; P.push(x, y, z); CC.push(c.r, c.g, c.b); SZ.push(s); };
    const dim = (h, k) => col(h).multiplyScalar(k); const cBulge = dim('#FFD9A8', 0.55), cArm = dim('#9FB8F0', 0.5), cDisk = dim('#7F93C2', 0.3), cHII = dim('#FF8FB6', 0.95), cYoung = dim('#DDE8FF', 0.75), cDust = dim('#6A5F7E', 0.35);
    for (let i = 0; i < 9000; i++) { const r = Math.abs(gauss()) * 3800; const t = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1); push(C.x + r * Math.sin(ph) * Math.cos(t), r * Math.cos(ph) * 0.55, C.z + r * Math.sin(ph) * Math.sin(t), cBulge, 150 + rand() * 160); }
    const barA = sunAng + 0.47; for (let i = 0; i < 4000; i++) { const u = gauss() * 4200, v = gauss() * 1100; push(C.x + u * Math.cos(barA) - v * Math.sin(barA), gauss() * 350, C.z + u * Math.sin(barA) + v * Math.cos(barA), cBulge, 240); }
    for (let arm = 0; arm < 4; arm++) {
      const major = arm % 2 === 0; const n = major ? 22000 : 11000;
      for (let i = 0; i < n; i++) {
        const r = r0 + Math.pow(rand(), 0.85) * 46000; const th = armPhase + arm * Math.PI / 2 + Math.log(r / r0) / k;
        const w = (520 + r * 0.03) * (major ? 1 : 0.75); const dr = gauss() * w, dt = gauss() * w;
        const x = C.x + (r + dr) * Math.cos(th) - dt * Math.sin(th), z = C.z + (r + dr) * Math.sin(th) + dt * Math.cos(th);
        const q = rand(); const c = q < 0.03 ? cHII : q < 0.2 ? cYoung : cArm;
        push(x, gauss() * 240, z, c, q < 0.03 ? 260 : 90 + rand() * 90);
      }
    }
    for (let i = 0; i < 2600; i++) { const r = 20000 + rand() * 12000; const th = sunAng + (r - 26000) / 26000 * 0.4 + gauss() * 0.02; push(C.x + r * Math.cos(th) + gauss() * 700, gauss() * 200, C.z + r * Math.sin(th) + gauss() * 700, rand() < 0.3 ? cYoung : cArm, 140); }
    for (let i = 0; i < 14000; i++) { const r = -Math.log(1 - rand() * 0.98) * 14000; const t = rand() * Math.PI * 2; push(C.x + r * Math.cos(t), gauss() * 420, C.z + r * Math.sin(t), rand() < 0.15 ? cDust : cDisk, 110); }
    const haze = dim('#7F96D8', 0.07), hazeCore = dim('#FFD9A8', 0.10);
    for (let i = 0; i < 2600; i++) { const r = r0 + Math.pow(rand(), 0.9) * 42000; const arm = i % 4; const th = armPhase + arm * Math.PI / 2 + Math.log(r / r0) / k; const w = 900 + r * 0.03; push(C.x + (r + gauss() * w) * Math.cos(th), gauss() * 200, C.z + (r + gauss() * w) * Math.sin(th), haze, 2600 + rand() * 1800); }
    for (let i = 0; i < 500; i++) { const r = Math.abs(gauss()) * 3000; const t = rand() * Math.PI * 2; push(C.x + r * Math.cos(t), gauss() * 600, C.z + r * Math.sin(t), hazeCore, 3200); }
    const cloud = (L, n, R, flat, tilt) => {
      for (let i = 0; i < n; i++) { const r = Math.abs(gauss()) * R * 0.5; const t = rand() * Math.PI * 2; let x = r * Math.cos(t), y = gauss() * R * flat, z = r * Math.sin(t) * 0.75;
        const cy = Math.cos(tilt), sy = Math.sin(tilt); const yy = y * cy - z * sy, zz = y * sy + z * cy; P.push(L.x + x, L.y + yy, L.z + zz); const q = rand(); const c = q < 0.06 ? cHII : q < 0.4 ? cYoung : cArm; CC.push(c.r, c.g, c.b); SZ.push(300 + rand() * 300); }
    };
    G.landmarks.forEach((L) => cloud(L, L.id === 'lmc' ? 9000 : 4000, L.radius, L.id === 'lmc' ? 0.12 : 0.3, L.id === 'lmc' ? 0.6 : 1.1));
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(CC, 3)); g.setAttribute('aSize', new T.Float32BufferAttribute(SZ, 1));
    const m = new T.ShaderMaterial(Object.assign({ vertexShader: GAL_VS, fragmentShader: GAL_FS, uniforms: { uScale: { value: 500 }, uOpacity: { value: 0 } } }, addBlend));
    galaxy = new T.Points(g, m); galaxy.renderOrder = 1; galaxy.frustumCulled = false; scene.add(galaxy);
  }
  function envMesh(R, taper, color, opacity) {
    const pts = []; for (let z = -500; z <= 1500; z += 10) pts.push(new T.Vector2(Math.max(0.5, envR(R, z, taper)), z));
    const g = new T.LatheGeometry(pts, 96); g.rotateX(Math.PI / 2);
    const m = new T.ShaderMaterial(Object.assign({ vertexShader: ENV_VS, fragmentShader: ENV_FS, side: T.DoubleSide, uniforms: { uColor: { value: col(color) }, uOpacity: { value: opacity }, uStripe: { value: 100 } } }, addBlend));
    const mesh = new T.Mesh(g, m); mesh.renderOrder = 2; mesh.frustumCulled = false; scene.add(mesh); return mesh;
  }
  function buildEnvelopes() {
    const R = D.base.regions;
    envFringe = envMesh(R.fringe.radius, R.fringe.taper, R.fringe.color, 0.75);
    envStable = envMesh(R.stable.radius, R.stable.taper, R.stable.color, 1.0);
    const g = new T.CylinderGeometry(R.explored.radius, R.explored.radius, R.explored.z_max - R.explored.z_min, 96, 1, true); g.rotateX(Math.PI / 2); g.translate(0, 0, (R.explored.z_max + R.explored.z_min) / 2);
    const m = new T.ShaderMaterial(Object.assign({ vertexShader: ENV_VS, fragmentShader: ENV_FS, side: T.DoubleSide, uniforms: { uColor: { value: col(R.explored.color) }, uOpacity: { value: 0.8 }, uStripe: { value: 2000 } } }, addBlend));
    envExplore = new T.Mesh(g, m); envExplore.renderOrder = 2; envExplore.frustumCulled = false; scene.add(envExplore);
  }
  function stringPoints(z0, z1, step, color, size, opacity) {
    const n = Math.floor((z1 - z0) / step) + 1; const pos = new Float32Array(n * 3), t = new Float32Array(n);
    for (let i = 0; i < n; i++) { pos[i * 3 + 2] = z0 + i * step; t[i] = i / n; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('aT', new T.BufferAttribute(t, 1));
    const m = new T.ShaderMaterial(Object.assign({ vertexShader: STRING_VS, fragmentShader: STRING_FS, uniforms: { uPR: { value: 1 }, uTime: { value: 0 }, uSize: { value: size }, uColor: { value: col(color) }, uOpacity: { value: opacity } } }, addBlend));
    const p = new T.Points(g, m); p.renderOrder = 3; p.frustumCulled = false; scene.add(p); return p;
  }
  function buildTrunk() {
    const g = new T.BufferGeometry().setFromPoints([new T.Vector3(0, 0, -500), new T.Vector3(0, 0, 1500)]);
    trunk = new T.Line(g, new T.LineBasicMaterial(Object.assign({ color: col('#E2B254'), opacity: 0.85 }, addBlend))); trunk.renderOrder = 3; scene.add(trunk);
    trunkPts = stringPoints(-500, 1500, 2, '#FFD98E', 3.2, 1.0);
    extPts = stringPoints(1500, 20000, 20, '#E2B254', 3.0, 0.75);
    const ag = new T.BufferGeometry().setFromPoints([new T.Vector3(-650, 0, 0), new T.Vector3(650, 0, 0), new T.Vector3(0, -650, 0), new T.Vector3(0, 650, 0)]);
    const axes = new T.LineSegments(ag, new T.LineBasicMaterial(Object.assign({ color: col('#6F7C96'), opacity: 0.45 }, addBlend))); axes.renderOrder = 3; scene.add(axes); A._axes = axes;
  }
  function buildRibs() {
    if (ribs) { scene.remove(ribs); ribs.geometry.dispose(); }
    const P = [], C = []; const cs = col('#4FD6E8'), cp = col('#E2B254');
    worldsAll().forEach((w) => {
      if (w.solar || w.group || ['kepler-62f', 'paradise-lost', 'kepler-452b'].includes(w.id) || !visibleCat(w)) return;
      if (!['稳定航路', '周期可达', '待复联'].includes(w.status)) return;
      if (w.z < -520 || w.z > 1520) return;
      const c = w.status === '稳定航路' ? cs : cp; const a = w.status === '稳定航路' ? 0.16 : 0.22;
      P.push(w.x, w.y, w.z, 0, 0, w.z); C.push(c.r * a, c.g * a, c.b * a, c.r * a * 0.3, c.g * a * 0.3, c.b * a * 0.3);
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('color', new T.Float32BufferAttribute(C, 3));
    ribs = new T.LineSegments(g, new T.LineBasicMaterial(Object.assign({ vertexColors: true }, addBlend))); ribs.renderOrder = 3; ribs.visible = S.ribs; scene.add(ribs);
  }
  function buildRoutes() {
    routeObjs.forEach((o) => { scene.remove(o.obj); o.obj.geometry.dispose(); }); routeObjs = [];
    (D.base.routes || []).forEach((r) => {
      const pts = r.through.map((id) => D.byId[id]).filter(Boolean).map((w) => new T.Vector3(w.x, w.y, w.z));
      if (pts.length < 2) return;
      let line;
      if (r.curve) {
        const a = pts[0], b = pts[pts.length - 1];
        const mid = a.clone().lerp(b, 0.35).add(new T.Vector3(0, -Math.abs(b.y - a.y) * 0.25 - 15000, 9000));
        const curve = new T.CatmullRomCurve3([a, a.clone().lerp(mid, 0.3).add(new T.Vector3(0, 1200, 0)), mid, b]);
        line = curve.getPoints(220);
      } else line = pts;
      const g = new T.BufferGeometry().setFromPoints(line);
      const m = new T.LineDashedMaterial(Object.assign({ color: col(r.color || '#B98CFF'), dashSize: r.curve ? 1600 : 18, gapSize: r.curve ? 900 : 10, opacity: 0.9 }, addBlend));
      const obj = new T.Line(g, m); obj.computeLineDistances(); obj.renderOrder = 3; scene.add(obj);
      routeObjs.push({ r, obj, mid: line[Math.floor(line.length / 2)] });
    });
  }
  function buildSection() {
    sectionGroup = new T.Group(); scene.add(sectionGroup);
    const ring = (R, c, o) => { const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new T.Vector3(R * Math.cos(a), R * Math.sin(a), 0)); } const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial(Object.assign({ color: col(c), opacity: o }, addBlend))); l.renderOrder = 3; sectionGroup.add(l); return l; };
    A._secStable = ring(250, '#4FD6E8', 0.9); A._secFringe = ring(500, '#E2B254', 0.7);
    const ax = new T.LineSegments(new T.BufferGeometry().setFromPoints([new T.Vector3(-700, 0, 0), new T.Vector3(700, 0, 0), new T.Vector3(0, -700, 0), new T.Vector3(0, 700, 0)]), new T.LineBasicMaterial(Object.assign({ color: col('#9AA7C2'), opacity: 0.6 }, addBlend)));
    ax.renderOrder = 3; sectionGroup.add(ax); sectionGroup.visible = false;
  }
  function buildMeasure() {
    measureLine = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineDashedMaterial(Object.assign({ color: col('#FFE7B0'), dashSize: 4, gapSize: 3, opacity: 1 }, addBlend)));
    measureLine.renderOrder = 4; measureLine.visible = false; scene.add(measureLine);
  }
  function syncWorlds() {
    const all = worldsAll(); const n = all.length;
    const pos = new Float32Array(n * 3), c = new Float32Array(n * 3), sz = new Float32Array(n), al = new Float32Array(n);
    all.forEach((w, i) => {
      const p = displayPos(w, all); w._p = p; pos.set([p.x, p.y, p.z], i * 3);
      const cc = col(w.color); c.set([cc.r, cc.g, cc.b], i * 3);
      let a = visibleCat(w) ? 1 : 0; if (w.solar) a = 0;
      if (S.view === 'section' && a) { a = Math.abs(w.z - S.section.z) <= S.section.thick ? 1 : 0.08; }
      sz[i] = (w.id === (S.sel && S.sel.id) ? 30 : 23) * (w.size || 1) * (w.status === '失联' || w.status === '灾毁' ? 0.85 : 1);
      al[i] = a * (w.status === '灾毁' ? 0.55 : 1);
    });
    // 太阳
    const g = new T.BufferGeometry();
    const sp = new Float32Array(pos.length + 3); sp.set(pos); sp.set([0, 0, 0], pos.length);
    const scl = new Float32Array(c.length + 3); scl.set(c); scl.set([1, 0.9, 0.7], c.length);
    const ssz = new Float32Array(n + 1); ssz.set(sz); ssz[n] = 24;
    const sal = new Float32Array(n + 1); sal.set(al); sal[n] = 1;
    g.setAttribute('position', new T.BufferAttribute(sp, 3)); g.setAttribute('color', new T.BufferAttribute(scl, 3)); g.setAttribute('aSize', new T.BufferAttribute(ssz, 1)); g.setAttribute('aAlpha', new T.BufferAttribute(sal, 1));
    if (!worldPts) { worldPts = new T.Points(g, new T.ShaderMaterial(Object.assign({ vertexShader: POINT_VS, fragmentShader: POINT_FS, uniforms: { uPR: { value: 1 }, uK: { value: 1 } } }, addBlend))); worldPts.renderOrder = 5; worldPts.frustumCulled = false; scene.add(worldPts); }
    else { worldPts.geometry.dispose(); worldPts.geometry = g; }
    A._sunIdx = n; A._sunHidden = false;
    A._all = all;
    buildRibs();
    syncLabels();
  }
  function ringTarget() {
    if (S.ssel) return { p: S.ssel.pos, c: S.ssel.color, sol: S.ssel };
    const w = S.sel && (A._all || []).find((x) => x.id === S.sel.id); if (!w) return null;
    if (w.solar) { const b = SOL.byWorld[w.id]; return b ? { p: b.pos, c: w.color, sol: b } : null; }
    return { p: w._p, c: w.color };
  }
  function syncRing() {
    const R = ringTarget(); A._ring = R;
    const g = new T.BufferGeometry();
    const p = R ? R.p : new T.Vector3(); const cc = col(R ? R.c : '#FFFFFF');
    g.setAttribute('position', new T.BufferAttribute(new Float32Array([0, 0, 0]), 3)); g.setAttribute('color', new T.BufferAttribute(new Float32Array([cc.r, cc.g, cc.b]), 3));
    g.setAttribute('aSize', new T.BufferAttribute(new Float32Array([44]), 1)); g.setAttribute('aAlpha', new T.BufferAttribute(new Float32Array([R ? 1 : 0]), 1));
    if (!ringPts) { ringPts = new T.Points(g, new T.ShaderMaterial(Object.assign({ vertexShader: POINT_VS, fragmentShader: RING_FS, uniforms: { uPR: { value: 1 }, uK: { value: 1 }, uTime: { value: 0 } } }, addBlend))); ringPts.renderOrder = 10; ringPts.frustumCulled = false; scene.add(ringPts); }
    else { ringPts.geometry.dispose(); ringPts.geometry = g; }
    ringPts.position.copy(p); // 用物体位置承载坐标，避免太阳系尺度下的浮点误差
  }

  /* ---------- 太阳系（真实比例） ----------
     单位仍是光年：1 天文单位 = 1.58125e-5 光年，1 公里 = 1.057e-13 光年。
     精度：每个球体 / 轨道都以“物体位置 + 局部顶点”绘制，矩阵在 JS 的双精度里相减，GPU 只看到小数字。 */
  const SOL = { list: [], byId: {}, byWorld: {}, sites: [], siteById: {}, globes: [], lines: [], group: null, on: false, pxK: 1 };
  const GLOBE_COL = { mercury: '#9C9690', europa: '#D9CFC0', phobos: '#8A7B6E', saturn: '#E3CF9F', uranus: '#A8DCE3', neptune: '#5B7FE0' };
  const SITE_COL = { '超级都市': '#FFD98E', '地点': '#7FE3F0', '基地': '#7FE3F0', '大学': '#9EE6B8', '研究院': '#9EE6B8', '度假区': '#F5A3C7', '淹没区': '#5FD3E0', '气候': '#9FB8F0', '禁区': '#FF8A8A', '海洋': '#7DB4FF', '轨道设施': '#CDB4FF', '轨道': '#CDB4FF', '事件': '#FF9C7A' };
  const MINOR_SITE = new Set(['淹没区', '气候']);
  const imgURL = (p) => (window.__PA_IMG__ && window.__PA_IMG__[p]) || p;
  const GLOBE_VS = `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }`;
  const GLOBE_FS = `uniform sampler2D uMap; uniform float uHasMap; uniform vec3 uColor; uniform vec3 uSun; uniform vec3 uAtmo; uniform float uAtmoK; uniform float uBands; uniform float uEmit;
    varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vec3 n=normalize(vN); vec3 v=normalize(vV); float mu=max(dot(n,v),0.0);
      if(uEmit>0.5){ vec3 c=mix(vec3(1.0,0.50,0.16),vec3(1.0,0.96,0.84),pow(mu,0.42)); gl_FragColor=vec4(c,1.0); return; }
      vec3 base=uHasMap>0.5?texture2D(uMap,vUv).rgb:uColor;
      if(uBands>0.5){ float y=vUv.y; base*=0.88+0.10*sin(y*58.0)+0.05*sin(y*131.0); }
      float ndl=dot(n,uSun); float day=smoothstep(-0.10,0.22,ndl); float dif=max(ndl,0.0);
      vec3 night=base*vec3(0.10,0.13,0.20); vec3 lit=base*(0.12+0.98*pow(dif,0.7));
      vec3 col=mix(night,lit,day);
      float rim=pow(1.0-mu,2.4); col+=uAtmo*rim*uAtmoK*smoothstep(-0.30,0.40,ndl);
      col+=vec3(1.0,0.42,0.12)*exp(-ndl*ndl*120.0)*0.08*uAtmoK;
      gl_FragColor=vec4(col,1.0); }`;
  const ATMO_FS = `uniform vec3 uColor; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vec3 n=normalize(vN); float k=-dot(n,normalize(vV)); float i=pow(smoothstep(0.0,0.36,k),1.7);
      float lit=smoothstep(-0.45,0.35,dot(n,uSun)); float a=i*(0.12+0.88*lit)*0.95; gl_FragColor=vec4(uColor*a,a); }`;
  const SRING_VS = `varying float vR; void main(){ vR=length(position.xy); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
  const SRING_FS = `uniform vec3 uColor; varying float vR; void main(){ float a=0.62+0.12*sin(vR*70.0)+0.16*sin(vR*23.0)+0.08*sin(vR*151.0);
      a*=smoothstep(1.24,1.32,vR)*smoothstep(2.27,2.18,vR); a*=1.0-0.85*smoothstep(0.045,0.0,abs(vR-1.99)); gl_FragColor=vec4(uColor,a*0.75); }`;
  const GLOW_VS = `uniform float uSize; uniform float uMinPx; uniform float uPxK; varying vec2 vP;
    void main(){ vP=position.xy; vec4 mv=modelViewMatrix*vec4(0.0,0.0,0.0,1.0); float d=max(-mv.z,1e-30); float s=max(uSize,uMinPx*d/uPxK); mv.xy+=position.xy*s; gl_Position=projectionMatrix*mv; }`;
  const GLOW_FS = `uniform vec3 uColor; uniform float uOpacity; varying vec2 vP;
    void main(){ float d=length(vP); if(d>1.0) discard; float a=(exp(-d*d*10.0)*0.95+exp(-d*3.4)*0.32)*(1.0-d)*uOpacity; gl_FragColor=vec4(uColor*a,a); }`;

  function normalAt(b, lat, lon) {
    const p = lat * RAD, d = (lon - b.lon0) * RAD;
    return b.e1.clone().multiplyScalar(Math.cos(p) * Math.cos(d)).addScaledVector(b.e2, Math.cos(p) * Math.sin(d)).addScaledVector(b.e3, Math.sin(p));
  }
  function buildSolar() {
    const sd = D.base.solar; if (!sd) return;
    const f = (ra, dec) => { const r = PA.coords.toFederation(ra, dec, 1); return new T.Vector3(r.x, r.y, r.z).normalize(); };
    const ex = f(0, 0), ey = f(90, 23.4393), ez = ex.clone().cross(ey).normalize(); SOL.ex = ex; SOL.ey = ey; SOL.ez = ez;
    const inPlane = (r, L) => ex.clone().multiplyScalar(r * Math.cos(L * RAD)).addScaledVector(ey, r * Math.sin(L * RAD));
    const t0 = sd.t0_days || 0;
    SOL.group = new T.Group(); scene.add(SOL.group);
    sd.bodies.forEach((src) => { const b = Object.assign({}, src, { kind: 'body', key: 'b:' + src.id }); b.R = (src.radius_km || 0) * KM; b.color = src.color || '#CCCCCC'; SOL.list.push(b); SOL.byId[b.id] = b; if (b.world) SOL.byWorld[b.world] = b; });
    SOL.list.forEach((b) => { if (b.a_au) { b.a = b.a_au * AU; b.pos = inPlane(b.a, b.L0 + (b.n || 0) * t0); } else if (!b.parent) b.pos = new T.Vector3(); });
    SOL.list.forEach((b) => { if (b.a_km && b.parent) { const P = SOL.byId[b.parent]; b.a = b.a_km * KM; b.pos = P.pos.clone().add(inPlane(b.a, (b.L0 || 0) + 360 * t0 / b.period_days)); } });
    const earth = SOL.byId.earth || { pos: ex.clone().multiplyScalar(AU) };
    const ur = earth.pos.clone().normalize(), un = ez.clone(), ut = un.clone().cross(ur).normalize();
    SOL.frameAt = (off) => ur.clone().multiplyScalar(off[0] * KM).addScaledVector(un, off[1] * KM).addScaledVector(ut, off[2] * KM);
    const L2 = earth.pos.clone().addScaledVector(ur, 1.5e6 * KM); SOL.L2 = L2;
    const HN = 250000 * KM, HT = 650000 * KM, HA = 60 * RAD;
    SOL.list.forEach((b) => { if (b.l2) { b.pos = L2.clone().addScaledVector(un, HN * Math.cos(HA)).addScaledVector(ut, HT * Math.sin(HA)); b.a = 1.5e6 * KM; } if (!b.pos) b.pos = new T.Vector3(); });
    // 自转姿态：e3 = 北极，e1 = 正午（或潮汐锁定时朝向母星）的经线
    SOL.list.forEach((b) => {
      if (!b.R) return;
      const e3 = b.pole ? f(b.pole[0], b.pole[1]) : ez.clone();
      const moon = b.parent && b.type === '卫星';
      const ref = moon ? SOL.byId[b.parent].pos.clone().sub(b.pos) : b.pos.clone().negate(); if (ref.lengthSq() === 0) ref.copy(ex);
      ref.normalize(); b.e1 = ref.clone().addScaledVector(e3, -ref.dot(e3)).normalize(); b.e2 = e3.clone().cross(b.e1); b.e3 = e3;
      b.lon0 = moon ? 0 : (b.subsolar_lon != null ? b.subsolar_lon : 0);
      const sd = b.pos.clone().negate(); b.sunLon = sd.lengthSq() ? b.lon0 + Math.atan2(sd.dot(b.e2), sd.dot(b.e1)) / RAD : 0;
    });
    // 球体
    const sphereHi = new T.SphereGeometry(1, 128, 80), sphereLo = new T.SphereGeometry(1, 48, 32);
    const loader = new T.TextureLoader(); const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    SOL.list.forEach((b) => {
      if (!b.R) return;
      const u = { uMap: { value: null }, uHasMap: { value: 0 }, uColor: { value: col(GLOBE_COL[b.id] || b.color) }, uSun: { value: new T.Vector3(1, 0, 0) }, uAtmo: { value: col(b.atmo || '#000000') }, uAtmoK: { value: b.atmo ? 0.85 : 0 }, uBands: { value: ['saturn', 'uranus', 'neptune'].includes(b.id) ? 1 : 0 }, uEmit: { value: b.star ? 1 : 0 } };
      if (b.texture) { const t = loader.load(imgURL(b.texture)); t.anisotropy = aniso; u.uMap.value = t; u.uHasMap.value = 1; }
      const mesh = new T.Mesh(['earth', 'moon', 'mars'].includes(b.id) ? sphereHi : sphereLo, new T.ShaderMaterial({ vertexShader: GLOBE_VS, fragmentShader: GLOBE_FS, uniforms: u, transparent: true, depthWrite: true, depthTest: true }));
      mesh.position.copy(b.pos); mesh.scale.setScalar(b.R); mesh.renderOrder = 7; mesh.frustumCulled = false;
      const X = normalAt(b, 0, 0), Y = b.e3.clone(), Z = X.clone().cross(Y); mesh.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(X, Y, Z));
      if (b.atmo) { const at = new T.Mesh(sphereLo, new T.ShaderMaterial(Object.assign({ vertexShader: GLOBE_VS, fragmentShader: ATMO_FS, side: T.BackSide, uniforms: { uColor: { value: col(b.atmo) }, uSun: u.uSun } }, addBlend, { depthTest: true }))); at.scale.setScalar(1.06); at.renderOrder = 8; at.frustumCulled = false; mesh.add(at); }
      if (b.id === 'saturn') { const r = new T.Mesh(new T.RingGeometry(1.24, 2.27, 160, 1), new T.ShaderMaterial({ vertexShader: SRING_VS, fragmentShader: SRING_FS, uniforms: { uColor: { value: col('#E8D9B0') } }, transparent: true, depthWrite: false, side: T.DoubleSide })); r.rotation.x = -Math.PI / 2; r.renderOrder = 8; r.frustumCulled = false; mesh.add(r); }
      SOL.group.add(mesh); b.mesh = mesh; SOL.globes.push(b);
    });
    // 太阳辉光
    const sun = SOL.byId.sun;
    if (sun) { const gm = new T.ShaderMaterial(Object.assign({ vertexShader: GLOW_VS, fragmentShader: GLOW_FS, uniforms: { uSize: { value: sun.R * 9 }, uMinPx: { value: 30 }, uPxK: { value: 500 }, uColor: { value: col('#FFD9A0') }, uOpacity: { value: 1 } } }, addBlend)); SOL.glow = new T.Mesh(new T.PlaneGeometry(2, 2), gm); SOL.glow.renderOrder = 6; SOL.glow.frustumCulled = false; SOL.group.add(SOL.glow); }
    // 轨道
    const loop = (center, fn, color, opacity, kind, a, dashed) => {
      const pts = []; const N = kind === 'planet' ? 360 : 200; for (let i = 0; i <= N; i++) pts.push(fn(i / N * Math.PI * 2));
      const mat = dashed ? new T.LineDashedMaterial(Object.assign({ color: col(color), opacity, dashSize: a * 0.05, gapSize: a * 0.035 }, addBlend, { depthTest: true })) : new T.LineBasicMaterial(Object.assign({ color: col(color), opacity }, addBlend, { depthTest: true }));
      const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), mat); if (dashed) l.computeLineDistances();
      l.position.copy(center); l.renderOrder = 9; l.frustumCulled = false; SOL.group.add(l); SOL.lines.push({ obj: l, kind, a, base: opacity, center }); return l;
    };
    const circle = (r, u, v) => (t) => u.clone().multiplyScalar(r * Math.cos(t)).addScaledVector(v, r * Math.sin(t));
    SOL.list.forEach((b) => {
      if (b.a_au) loop(new T.Vector3(), circle(b.a, ex, ey), b.color, 0.42, 'planet', b.a);
      else if (b.a_km && b.parent) loop(SOL.byId[b.parent].pos, circle(b.a, ex, ey), b.color, 0.5, 'moon', b.a);
    });
    if (SOL.byId.earth) {
      const E = SOL.byId.earth;
      loop(E.pos, circle(42164 * KM, E.e1, E.e2), '#CDB4FF', 0.55, 'geo', 42164 * KM, true);
      loop(L2, (t) => un.clone().multiplyScalar(HN * Math.cos(t)).addScaledVector(ut, HT * Math.sin(t)), '#F5D38A', 0.6, 'halo', HT, true);
    }
    // 小行星带
    const belt = SOL.list.find((b) => b.belt);
    if (belt) {
      const N = 7000, P = new Float32Array(N * 3), C = new Float32Array(N * 3), SZ = new Float32Array(N), AL = new Float32Array(N); const bc = col(belt.color);
      for (let i = 0; i < N; i++) { let r; do { r = belt.inner_au + Math.pow(rand(), 0.9) * (belt.outer_au - belt.inner_au) + gauss() * 0.04; } while (Math.abs(r - 2.5) < 0.012 || Math.abs(r - 2.82) < 0.012 || Math.abs(r - 2.95) < 0.01);
        const p = inPlane(r * AU, rand() * 360).addScaledVector(ez, gauss() * 0.07 * AU); P.set([p.x, p.y, p.z], i * 3); const k = 0.75 + rand() * 0.5; C.set([bc.r * k, bc.g * k, bc.b * k], i * 3); SZ[i] = 2.0 + rand() * 1.8; AL[i] = 0.55 + rand() * 0.45; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3)); g.setAttribute('color', new T.BufferAttribute(C, 3)); g.setAttribute('aSize', new T.BufferAttribute(SZ, 1)); g.setAttribute('aAlpha', new T.BufferAttribute(AL, 1));
      SOL.belt = new T.Points(g, new T.ShaderMaterial(Object.assign({ vertexShader: POINT_VS, fragmentShader: GAL_FS.replace('*vA;', '*vA*uO;').replace('void main', 'uniform float uO; void main'), uniforms: { uPR: { value: 1 }, uK: { value: 1 }, uO: { value: 1 } } }, addBlend)));
      SOL.belt.renderOrder = 6; SOL.belt.frustumCulled = false; SOL.group.add(SOL.belt);
      belt.pos = new T.Vector3(); belt.labelPos = inPlane(2.75 * AU, 300);
    }
    // 地点
    (sd.sites || []).forEach((src) => {
      const s = Object.assign({}, src, { kind: 'site', key: 's:' + src.id }); const b = SOL.byId[s.body]; if (!b) return;
      s.color = SITE_COL[s.type] || '#CFD8EA';
      if (s.lat != null && b.R) { s.surface = true; s.n = normalAt(b, s.lat, s.lon); s.pos = b.pos.clone().addScaledVector(s.n, b.R); }
      else if (s.orbit_km) { s.orbital = true; s.n = normalAt(b, 0, s.lon || 0); s.pos = b.pos.clone().addScaledVector(s.n, s.orbit_km * KM); }
      else if (s.anchor) { const base = s.anchor === 'l2pt' ? L2 : (SOL.byId[s.anchor] || b).pos; s.pos = base.clone().add(SOL.frameAt(s.off_km || [0, 0, 0])); s.anchored = true; }
      else s.pos = b.pos.clone();
      SOL.sites.push(s); SOL.siteById[s.id] = s;
    });
    // 105 号事件：航迹与拦截弹道（示意）
    const yard = SOL.siteById['geo-yard'], hit = SOL.siteById['intercept-105'], lamb = SOL.siteById['lamb-pos'];
    if (yard && hit && SOL.byId.earth) {
      const E = SOL.byId.earth.pos; const a = yard.pos.clone().sub(E), b2 = hit.pos.clone().sub(E); const mid = a.clone().lerp(b2, 0.5).addScaledVector(un, 160000 * KM);
      const curve = new T.QuadraticBezierCurve3(a, mid, b2); const l = new T.Line(new T.BufferGeometry().setFromPoints(curve.getPoints(120)), new T.LineDashedMaterial(Object.assign({ color: col('#FF9C7A'), opacity: 0.8, dashSize: 26000 * KM, gapSize: 18000 * KM }, addBlend)));
      l.computeLineDistances(); l.position.copy(E); l.renderOrder = 9; l.frustumCulled = false; SOL.group.add(l); SOL.lines.push({ obj: l, kind: 'event', a: 1.5e6 * KM, base: 0.8 });
    }
    if (lamb && hit) {
      const l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), hit.pos.clone().sub(lamb.pos)]), new T.LineDashedMaterial(Object.assign({ color: col('#FF5F6D'), opacity: 0.9, dashSize: 12000 * KM, gapSize: 9000 * KM }, addBlend)));
      l.computeLineDistances(); l.position.copy(lamb.pos); l.renderOrder = 9; l.frustumCulled = false; SOL.group.add(l); SOL.lines.push({ obj: l, kind: 'event', a: 6e5 * KM, base: 0.9 });
    }
    // 天体标记点（位置相对于每帧的镜头目标重写，保证精度）
    SOL.marked = SOL.list.filter((b) => !b.star && !b.belt);
    const n = SOL.marked.length; const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(new Float32Array(n * 3), 3)); const cc = new Float32Array(n * 3); SOL.marked.forEach((b, i) => { const c = col(b.color); cc.set([c.r, c.g, c.b], i * 3); });
    g.setAttribute('color', new T.BufferAttribute(cc, 3)); g.setAttribute('aSize', new T.BufferAttribute(new Float32Array(SOL.marked.map((b) => (b.type === '行星' ? 19 : b.type === '空间站' ? 15 : 13))), 1)); g.setAttribute('aAlpha', new T.BufferAttribute(new Float32Array(n), 1));
    SOL.markers = new T.Points(g, new T.ShaderMaterial(Object.assign({ vertexShader: POINT_VS, fragmentShader: POINT_FS, uniforms: { uPR: { value: 1 }, uK: { value: 1 } } }, addBlend)));
    SOL.markers.renderOrder = 10; SOL.markers.frustumCulled = false; SOL.group.add(SOL.markers);
    SOL.group.visible = false;
  }
  function occluded(p, skip) {
    const cam = camera.position; const dir = p.clone().sub(cam); const L = dir.length(); if (!L) return false; dir.divideScalar(L);
    for (const b of SOL.globes) { if (b === skip || !b._px || b._px < 1.2) continue; const oc = b.pos.clone().sub(cam); const t = oc.dot(dir); if (t < 0 || t > L) continue; if (oc.lengthSq() - t * t < b.R * b.R * 0.995) return true; }
    return false;
  }
  function solarFrame(camDist, H, dt) {
    if (!SOL.group) return;
    const on = camDist < 0.2; SOL.group.visible = on; SOL.on = on;
    if (A._sunHidden !== on && worldPts) { const al = worldPts.geometry.getAttribute('aAlpha'); al.array[A._sunIdx] = on ? 0 : 1; al.needsUpdate = true; A._sunHidden = on; }
    if (!on) return;
    const pxK = (H / 2) / Math.tan(camera.fov * Math.PI / 360); SOL.pxK = pxK;
    const cam = camera.position; camera.updateMatrixWorld(); const view = camera.matrixWorldInverse;
    SOL.list.forEach((b) => {
      const d = Math.max(1e-30, cam.distanceTo(b.pos)); b._d = d; b._px = b.R ? b.R * pxK / d : 0;
      const P = b.parent ? SOL.byId[b.parent] : SOL.byId.sun; b._sep = b.star || b.belt ? Infinity : (b.a || 0) * pxK / Math.max(1e-30, cam.distanceTo(P ? P.pos : new T.Vector3()));
      if (b.mesh) { b.mesh.visible = b._px > 0.3; if (b.mesh.visible && !b.star) b.mesh.material.uniforms.uSun.value.copy(b.pos).negate().normalize().transformDirection(view); }
    });
    if (SOL.glow) SOL.glow.material.uniforms.uPxK.value = pxK;
    // 标记点
    const O = controls.target; const pa = SOL.markers.geometry.getAttribute('position'), aa = SOL.markers.geometry.getAttribute('aAlpha');
    SOL.marked.forEach((b, i) => {
      pa.array[i * 3] = b.pos.x - O.x; pa.array[i * 3 + 1] = b.pos.y - O.y; pa.array[i * 3 + 2] = b.pos.z - O.z;
      let a = (1 - sstep(4, 10, b._px)) * sstep(3, 9, b._sep);
      if (S.cats && b.world && D.byId[b.world] && !visibleCat(D.byId[b.world])) a *= 0.25;
      if (a > 0.01 && occluded(b.pos, b)) a = 0; b._mk = a; aa.array[i] = a;
    });
    SOL.markers.position.copy(O); pa.needsUpdate = true; aa.needsUpdate = true;
    // 轨道 / 航迹淡入淡出
    SOL.lines.forEach((L) => {
      const dc = L.center ? cam.distanceTo(L.center) : camDist; const rpx = L.a * pxK / Math.max(1e-30, dc); let a;
      if (L.kind === 'planet') a = sstep(6, 30, rpx) * sstep(0.004, 0.03, camDist / L.a);
      else if (L.kind === 'moon') a = sstep(10, 40, rpx) * sstep(0.08, 0.3, camDist / L.a);
      else if (L.kind === 'geo') a = sstep(14, 50, rpx) * sstep(0.62, 1.2, camDist / L.a);
      else if (L.kind === 'halo') a = sstep(12, 40, rpx) * sstep(0.05, 0.2, camDist / L.a);
      else a = sstep(2e5 * KM, 6e5 * KM, camDist) * (1 - sstep(3e7 * KM, 1.2e8 * KM, camDist));
      L.obj.material.opacity = L.base * a; L.obj.visible = a > 0.01;
    });
    if (SOL.belt) { const o = sstep(0.12 * AU, 0.7 * AU, camDist) * (1 - sstep(400 * AU, 3000 * AU, camDist)); SOL.belt.material.uniforms.uO.value = o; SOL.belt.visible = o > 0.01; }
  }
  function solarItem(key) { return key.startsWith('b:') ? SOL.byId[key.slice(2)] : key.startsWith('s:') ? SOL.siteById[key.slice(2)] : null; }
  function solarWrap(it) { return { id: it.key, name: it.name, kind: it.type, color: it.color, _sol: it }; }
  function distText(ly) { return lyText(ly); }

  /* ---------- 标签 ---------- */
  let labelPool = new Map(), staticLabels = [];
  function syncLabels() {
    const all = A._all || []; const keep = new Set();
    all.forEach((w) => {
      if (w.solar) return; keep.add(w.id);
      let el = labelPool.get(w.id);
      if (!el) { el = document.createElement('div'); el.className = 'lbl'; el.dataset.id = w.id; el.addEventListener('click', (e) => { e.stopPropagation(); onPick(w.id, e); }); labelsEl.appendChild(el); labelPool.set(w.id, el); }
      el.textContent = w.name; el.style.color = '';
      el.classList.toggle('major', (w.size || 1) >= 1.3 || !!w.novel);
    });
    for (const [id, el] of labelPool) if (!keep.has(id)) { el.remove(); labelPool.delete(id); }
  }
  function buildStaticLabels() {
    const L = (text, pos, cls, views, go) => { const el = document.createElement('div'); el.className = 'lbl ' + cls; el.textContent = text; labelsEl.appendChild(el); staticLabels.push({ el, pos, views, go: !!go }); if (go) el.addEventListener('click', (e) => { e.stopPropagation(); go(); }); };
    const R = D.base.regions; const G = D.base.galaxy;
    L('+z 天蝎主干 · 向银心侧 →', new T.Vector3(0, -40, 1560), 'axis', ['federation', 'core']);
    L('+y 银北', new T.Vector3(0, 680, 0), 'axis', ['federation']);
    L('+x 银盘内', new T.Vector3(680, 0, 0), 'axis', ['federation']);
    L(R.stable.name + ' · 离轴 250 光年', new T.Vector3(0, 262, 700), 'axis', ['federation']);
    L(R.fringe.name + ' · 离轴 500 光年', new T.Vector3(0, 512, 260), 'axis', ['federation']);
    L(R.explored.name + ' · 半径 2,000 光年', new T.Vector3(0, 2150, 9000), 'axis', ['explore', 'galaxy']);
    L('2,000 光年以外：只有科考站，没有定居世界', new T.Vector3(0, -2300, 12000), 'axis', ['explore']);
    L('定居疆域 · 约 2,000 光年', new T.Vector3(0, 700, 500), 'axis', ['explore']);
    L('银心 · 人马座 A*', new T.Vector3(G.center.x, 2600, G.center.z), 'land', ['galaxy', 'magellan']);
    L('太阳系 · 点击放大', new T.Vector3(0, 0, 0), 'go', ['core', 'federation', 'galaxy', 'magellan', 'explore'], () => { select(null); setView('solar'); });
    G.landmarks.forEach((m) => L(m.name + (m.note ? ' · ' + m.note : ''), new T.Vector3(m.x, m.y + m.radius * 0.8, m.z), 'land', ['galaxy', 'magellan']));
    ['I', 'II', 'III', 'IV'].forEach((q, i) => { const sx = [1, -1, -1, 1][i], sy = [1, 1, -1, -1][i]; L('象限 ' + q, new T.Vector3(sx * 380, sy * 380, 0), 'land', ['section']); staticLabels[staticLabels.length - 1].sec = true; });
    L('+x', new T.Vector3(720, 0, 0), 'axis', ['section']); staticLabels[staticLabels.length - 1].sec = true;
    L('+y 银北', new T.Vector3(0, 720, 0), 'axis', ['section']); staticLabels[staticLabels.length - 1].sec = true;
    L('r = 250', new T.Vector3(180, -180, 0), 'axis', ['section']); staticLabels[staticLabels.length - 1].sec = true;
    L('r = 500', new T.Vector3(355, -355, 0), 'axis', ['section']); staticLabels[staticLabels.length - 1].sec = true;
    A._measureLbl = document.createElement('div'); A._measureLbl.className = 'lbl measure'; labelsEl.appendChild(A._measureLbl);
  }
  const solarLbl = new Map();
  function solarLabel(it) {
    let el = solarLbl.get(it.key); if (el) return el;
    el = document.createElement('div'); el.className = 'lbl ' + (it.kind === 'site' ? 'site' + (it.major ? ' major' : '') : 'body' + (it.star || it.type === '行星' ? ' major' : ''));
    el.style.setProperty('--c', it.color); el.textContent = it.name; el.addEventListener('click', (e) => { e.stopPropagation(); onPick(it.key, e); });
    labelsEl.appendChild(el); solarLbl.set(it.key, el); return el;
  }

  const v3 = new T.Vector3();
  function project(p, W, H) { v3.copy(p).project(camera); return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, front: v3.z < 1 && v3.z > -1 }; }
  function updateOverlay() {
    const W = root.clientWidth, H = root.clientHeight; const all = A._all || [];
    const camDist = camera.position.distanceTo(controls.target);
    screen = [];
    const placed = []; const overlaps = (r) => placed.some((q) => r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y);
    const cand = [];
    all.forEach((w) => {
      if (w.solar) return; const el = labelPool.get(w.id); const sp = project(w._p, W, H);
      if (camDist < 0.05 && !(S.sel && S.sel.id === w.id)) { if (el) el.style.transform = 'translate(-9999px,0)'; return; }
      const vis = visibleCat(w) && sp.front && sp.x > -50 && sp.x < W + 50 && sp.y > -50 && sp.y < H + 50;
      const inSlab = S.view !== 'section' || Math.abs(w.z - S.section.z) <= S.section.thick;
      if (vis && inSlab) screen.push({ w, x: sp.x, y: sp.y });
      if (!el) return;
      let pri = (w.size || 1) * 10 + (w.novel ? 6 : 0) - Math.log10(1 + w.dist);
      if (S.sel && S.sel.id === w.id) pri = 1e6; else if (S.hover && S.hover.id === w.id) pri = 1e5;
      let show = vis && inSlab && S.labels && camDist > 0.05;
      if (S.novel && !(w.novel || pri >= 1e5)) show = false;
      if (w.solar && camDist > 0.05) show = false;
      if (!S.labels && pri >= 1e5) show = vis;
      cand.push({ w, el, sp, pri, show });
    });
    cand.sort((a, b) => b.pri - a.pri);
    for (const c of cand) {
      if (!c.show) { c.el.style.transform = 'translate(-9999px,0)'; continue; }
      const wpx = c.el.textContent.length * (c.el.classList.contains('major') ? 14 : 12.5) + 10; const r = { x: c.sp.x + 8, y: c.sp.y - 18, w: wpx, h: 18 };
      if (c.pri < 1e5 && overlaps(r)) { c.el.style.transform = 'translate(-9999px,0)'; continue; }
      placed.push(r); c.el.style.transform = `translate(${(c.sp.x + 8).toFixed(1)}px, ${(c.sp.y - 20).toFixed(1)}px)`;
      c.el.classList.toggle('sel', !!(S.sel && S.sel.id === c.w.id));
    }
    // 太阳系天体与地点
    solarOverlay(W, H, placed, overlaps, camDist);
    // 静态标签
    staticLabels.forEach((s) => {
      let p = s.pos; if (s.sec) p = v3.set(s.pos.x, s.pos.y, S.section.z).clone();
      const sp = project(p, W, H); let on = s.views.includes(S.view) && (S.env || s.go) && sp.front && sp.x > 0 && sp.x < W && sp.y > 0 && sp.y < H;
      if (s.go && (SOL.on || S.view === 'section')) on = false;
      s.el.style.transform = on ? (s.go ? `translate(${(sp.x + 12).toFixed(1)}px, ${(sp.y + 6).toFixed(1)}px)` : `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)`) : 'translate(-9999px,0)';
    });
    routeObjs.forEach((o) => {
      if (!o.el) { o.el = document.createElement('div'); o.el.className = 'lbl route'; o.el.textContent = o.r.name + ' · ' + (o.r.note || '').split('；')[0]; labelsEl.appendChild(o.el); }
      const sp = project(o.mid, W, H); const on = S.routes && sp.front && ['federation', 'galaxy', 'magellan', 'explore'].includes(S.view) && sp.x > 0 && sp.x < W && sp.y > 0 && sp.y < H;
      o.el.style.transform = on ? `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)` : 'translate(-9999px,0)';
    });
    // 测距
    if (S.measure && S.measure.length === 2) {
      const [a, b] = S.measure.map((id) => all.find((w) => w.id === id)).filter(Boolean);
      if (a && b) { const pa = a._p, pb = b._p; const mid = pa.clone().lerp(pb, 0.5); const sp = project(mid, W, H); const dd = pa.distanceTo(pb); A._measureLbl.textContent = `${a.name} ↔ ${b.name}：${lyText(dd)}${dd > 0.05 ? ' · Δz ' + PA.fmt(b.z - a.z, 0) : ''}`; A._measureLbl.style.transform = sp.front ? `translate(${sp.x.toFixed(1)}px, ${sp.y.toFixed(1)}px)` : 'translate(-9999px,0)'; }
    } else A._measureLbl.style.transform = 'translate(-9999px,0)';
    // 比例尺
    const ppl = (H / 2) / (Math.tan(camera.fov * Math.PI / 360) * camDist); const ly = niceLen(110 / ppl);
    const sb = $('.scale', root); if (sb) { sb.querySelector('.bar').style.width = Math.round(ly * ppl) + 'px'; sb.querySelector('span').textContent = lyText(ly); }
  }

  function solarOverlay(W, H, placed, overlaps, camDist) {
    const hideAll = () => { for (const el of solarLbl.values()) el.style.transform = 'translate(-9999px,0)'; };
    if (!SOL.group) return; if (!SOL.on) { hideAll(); return; }
    const cam = camera.position; const cand = [];
    const selKey = S.ssel ? S.ssel.key : null; const selWorld = S.sel && S.sel.solar && SOL.byWorld[S.sel.id];
    SOL.list.forEach((b) => {
      const sp = project(b.belt ? b.labelPos : b.pos, W, H); if (!sp.front) return;
      const isSel = selKey === b.key || selWorld === b; const big = b._px > 12;
      let vis = b.star || b.belt ? true : b._sep >= 9 || isSel;
      if (b.belt) vis = SOL.belt && SOL.belt.visible && camDist > 0.4 * AU;
      if (vis && !b.star && !b.belt && occluded(b.pos, b)) vis = false;
      if (b.world && S.cats && D.byId[b.world] && !visibleCat(D.byId[b.world])) vis = vis && isSel;
      if (!vis) return;
      if (!b.belt && sp.x > -40 && sp.x < W + 40 && sp.y > -40 && sp.y < H + 40) screen.push({ w: solarWrap(b), x: sp.x, y: sp.y, r: Math.max(0, b._px) });
      let pri = isSel ? 1e6 : b.star ? 60 : b.type === '行星' ? 50 + Math.log10(b.radius_km) : b.type === '空间站' ? 46 : b.belt ? 20 : 36;
      if (S.novel && !(b.world && D.byId[b.world] && D.byId[b.world].novel) && !b.star && !isSel) pri -= 30;
      const text = b.name.length; const wpx = text * (b.star || b.type === '行星' ? 14 : 12.5) + 12;
      const x = big ? sp.x - wpx / 2 : sp.x + 9, y = big ? sp.y - b._px - 24 : sp.y - 20;
      cand.push({ it: b, el: solarLabel(b), x, y, w: wpx, pri, sel: isSel, show: S.labels || isSel });
    });
    SOL.sites.forEach((s) => {
      const b = SOL.byId[s.body]; if (!b || !b.mesh) return; const isSel = selKey === s.key;
      let vis = false;
      if (s.surface) { const toCam = cam.clone().sub(s.pos).normalize(); const face = toCam.dot(s.n); vis = b._px > 42 && face > 0.06 && (!MINOR_SITE.has(s.type) || b._px > 150 || isSel); }
      else if (s.orbital) { const rpx = (s.orbit_km * KM) * SOL.pxK / Math.max(1e-30, cam.distanceTo(b.pos)); vis = rpx > 26 && camDist < 3e7 * KM && !occluded(s.pos); }
      else if (s.anchored) { const st = SOL.byId.l2; vis = st && st._sep >= 30 && camDist < 6e7 * KM && camDist > 1.2e5 * KM; }
      if (S.novel && !s.novel && !isSel) vis = false;
      const sp = project(s.pos, W, H); if (!vis || !sp.front || sp.x < -20 || sp.x > W + 20 || sp.y < -20 || sp.y > H + 20) return;
      screen.push({ w: solarWrap(s), x: sp.x, y: sp.y });
      const wpx = s.name.length * (s.major ? 13.5 : 12) + 22;
      const pri = isSel ? 1e6 : (s.major ? 45 : MINOR_SITE.has(s.type) ? 22 : 33) + (s.novel ? 4 : 0);
      cand.push({ it: s, el: solarLabel(s), x: sp.x - 5, y: sp.y - 10, w: wpx, pri, sel: isSel, show: S.labels || isSel || !!s.major, site: true });
    });
    cand.sort((a, b) => b.pri - a.pri); const used = new Set();
    for (const c of cand) {
      used.add(c.it.key);
      const r = { x: c.x, y: c.y, w: c.w, h: 19 };
      if (!c.show || (c.pri < 1e5 && overlaps(r))) { c.el.style.transform = 'translate(-9999px,0)'; continue; }
      placed.push(r); c.el.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px)`; c.el.classList.toggle('sel', c.sel);
    }
    for (const [k, el] of solarLbl) if (!used.has(k)) el.style.transform = 'translate(-9999px,0)';
  }

  /* ---------- 相机 ---------- */
  function fit(points, dir, pad = 1.25) {
    const box = new T.Box3().setFromPoints(points); const c = box.getCenter(new T.Vector3()); const r = box.getSize(new T.Vector3()).length() / 2;
    const d = r / Math.tan(camera.fov * Math.PI / 360) * pad; return { target: c, pos: c.clone().add(dir.clone().normalize().multiplyScalar(d)) };
  }
  const fitK = () => { const W = root.clientWidth || 1, H = root.clientHeight || 1; return 1 / Math.min(1, (W / H) / 0.95); }; // 竖屏时把镜头拉远一些
  function bodyPose(b, dist, lat, lon) {
    dist *= fitK();
    const n = b.R ? normalAt(b, lat != null ? lat : (b.view_lat != null ? b.view_lat : 28), lon != null ? lon : (b.view_lon != null ? b.view_lon : b.sunLon - 28)) : camera.position.clone().sub(controls.target).normalize();
    return { target: b.pos.clone(), pos: b.pos.clone().addScaledVector(n, dist), focus: b.id };
  }
  function viewPose(name) {
    const V = VIEWS[name]; const G = D.base.galaxy;
    if (name === 'earth' && SOL.byId.earth) { const E = SOL.byId.earth; return bodyPose(E, E.R * 3.25, 38, 20); }
    if (name === 'earthmoon' && SOL.byId.earth) {
      const E = SOL.byId.earth; const t = E.pos.clone().lerp(SOL.L2, 0.42);
      const dir = SOL.ez.clone().multiplyScalar(0.78).addScaledVector(E.pos.clone().normalize(), -0.22).addScaledVector(SOL.ez.clone().cross(E.pos).normalize(), 0.58).normalize();
      return { target: t, pos: t.clone().addScaledVector(dir, 3.2e6 * KM * fitK()) };
    }
    if (name === 'solar' && SOL.ez) { const dir = SOL.ez.clone().multiplyScalar(0.8).addScaledVector(SOL.ex, -0.42).addScaledVector(SOL.ey, -0.43).normalize(); return { target: new T.Vector3(), pos: dir.multiplyScalar(5.6 * AU * fitK()) }; }
    if (name === 'galaxy') { const C = new T.Vector3(G.center.x, 0, G.center.z); return { target: C.clone().multiplyScalar(0.55), pos: C.clone().multiplyScalar(0.55).add(new T.Vector3(-30000, 88000, -38000)) }; }
    if (name === 'magellan') { const L = G.landmarks[0]; const pts = [new T.Vector3(0, 0, 0), new T.Vector3(L.x, L.y, L.z), new T.Vector3(G.center.x, 0, G.center.z)]; return fit(pts, new T.Vector3(0.2, 0.55, 1), 1.15); }
    if (name === 'section') return { target: new T.Vector3(0, 0, S.section.z), pos: new T.Vector3(0, 0, S.section.z + 1900), up: true };
    return { target: new T.Vector3(...V.target), pos: new T.Vector3(...V.target).add(new T.Vector3(...V.off)) };
  }
  // 对数空间飞行：距离按指数插值，目标点按“剩余距离比例”收敛，跨越十几个数量级也不会丢失目标
  function flyTo(target, pos, dur) {
    const t0 = controls.target.clone(), p0 = camera.position.clone();
    const d0 = Math.max(1e-30, p0.distanceTo(t0)), d1 = Math.max(1e-30, pos.distanceTo(target));
    const u0 = p0.clone().sub(t0).divideScalar(d0), u1 = pos.clone().sub(target).divideScalar(d1);
    const lr = Math.log(d1 / d0);
    tween.from = { t: t0, d: d0, u: u0 }; tween.to = { t: target.clone(), d: d1, u: u1 }; tween.log = Math.abs(lr) > 0.7;
    tween.q = new T.Quaternion().setFromUnitVectors(u0, u1); tween.t = 0;
    tween.dur = dur || Math.min(3.6, Math.max(1.1, 0.9 + 0.1 * Math.abs(lr)));
  }
  const _tq = new T.Quaternion(), _iq = new T.Quaternion(), _tv = new T.Vector3();
  function stepTween(dt) {
    tween.t = Math.min(1, tween.t + dt / tween.dur); const k = ease(tween.t); const F = tween.from, G = tween.to;
    let d, sK;
    if (tween.log) { d = Math.exp(Math.log(F.d) + (Math.log(G.d) - Math.log(F.d)) * k); sK = (d - G.d) / (F.d - G.d); } else { d = F.d + (G.d - F.d) * k; sK = 1 - k; }
    _tv.copy(F.t).sub(G.t).multiplyScalar(sK).add(G.t); controls.target.copy(_tv);
    _tq.copy(_iq).slerp(tween.q, k); camera.position.copy(F.u).applyQuaternion(_tq).multiplyScalar(d).add(_tv);
  }
  function setView(name, instant) {
    if (!VIEWS[name]) name = 'federation';
    S.view = name;
    const pose = viewPose(name); S.focus = pose.focus || null;
    if (name === 'section') camera.up.set(0, 1, 0);
    if (instant) { tween.t = 1; controls.target.copy(pose.target); camera.position.copy(pose.pos); if (name !== 'section') camera.up.copy(upGoal(pose.pos.distanceTo(pose.target))); controls.minDistance = 0; controls.maxDistance = Infinity; controls.update(); } else flyTo(pose.target, pose.pos, name === 'section' ? 1.2 : null);
    sectionGroup.visible = name === 'section'; sectionGroup.position.z = S.section.z;
    controls.enableRotate = name !== 'section';
    onLevel(); syncWorlds(); syncRing();
  }
  function onLevel() {
    const name = S.view;
    $$('.a-seg button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === name)));
    const sc = $('#a-section', root); if (sc) sc.hidden = name !== 'section';
    const inset = $('#a-inset', root); if (inset) inset.hidden = name !== 'magellan';
    renderHint(); renderLegend();
  }
  // 根据镜头距离自动判断当前所处的尺度层级（只更新按钮高亮与提示，不移动镜头）
  function levelFor(camDist) {
    const E = SOL.byId.earth; const te = E ? controls.target.distanceTo(E.pos) : Infinity;
    if (camDist < 7.2e-6 && te < 2.5e6 * KM) return camDist < 3.1e-8 && te < 1e5 * KM ? 'earth' : 'earthmoon';
    if (camDist < 7.2e-6) return 'solar';
    if (camDist < 0.1) return 'solar';
    if (camDist < 200) return 'core';
    if (camDist < 8400) return 'federation';
    if (camDist < 51000) return 'explore';
    return 'galaxy';
  }
  const Y_UP = new T.Vector3(0, 1, 0);
  function upGoal(camDist) {
    if (S.view === 'section' || !SOL.ez) return Y_UP.clone();
    const k = sstep(Math.log(0.01), Math.log(1.5), Math.log(Math.max(1e-30, camDist)));
    let u = SOL.ez.clone().lerp(Y_UP, k).normalize();
    const fb = S.focus && SOL.byId[S.focus];
    if (fb && fb.e3 && fb.R) u = fb.e3.clone().lerp(u, sstep(25 * fb.R, 140 * fb.R, camDist)).normalize();
    return u;
  }
  function minDist() {
    const fb = S.focus && SOL.byId[S.focus];
    if (fb && controls.target.distanceTo(fb.pos) < Math.max(fb.R, 1e3 * KM) * 0.5) return fb.R ? fb.R * 1.12 : 300 * KM;
    if (SOL.byId.sun && controls.target.length() < 0.001) return SOL.byId.sun.R * 1.6;
    return VIEWS[S.view] ? Math.min(VIEWS[S.view].min, 0.5) : 0.5;
  }
  function focusSolar(it, closer) {
    if (!it) return;
    if (S.view === 'section') { S.view = 'solar'; sectionGroup.visible = false; controls.enableRotate = true; }
    if (it.kind === 'site') {
      const b = SOL.byId[it.body];
      if (it.surface) { const n = it.n; S.focus = b.id; flyTo(b.pos, b.pos.clone().addScaledVector(n, b.R * (closer ? 1.9 : 2.6) * fitK())); return; }
      S.focus = null; const d = it.orbital ? 9e4 * KM : 4e5 * KM; const dir = camera.position.clone().sub(controls.target).normalize();
      flyTo(it.pos, it.pos.clone().addScaledVector(dir, closer ? d * 0.4 : d)); return;
    }
    if (it.star) { flyTo(new T.Vector3(), viewPose('solar').pos.clone().multiplyScalar(closer ? 0.05 : 1)); S.focus = null; return; }
    if (it.belt) { S.focus = null; const p = viewPose('solar'); flyTo(p.target, p.pos.clone().multiplyScalar(1.3)); return; }
    if (it.R) { const pose = bodyPose(it, it.R * (closer ? 2.2 : it.id === 'earth' ? 3.25 : it.id === 'saturn' ? 6.5 : 3.4), it.id === 'earth' ? 38 : null, it.id === 'earth' ? 20 : null); S.focus = it.id; flyTo(pose.target, pose.pos); return; }
    S.focus = null; const dir = camera.position.clone().sub(controls.target).normalize(); flyTo(it.pos, it.pos.clone().addScaledVector(dir, (closer ? 1.5e5 : 6e5) * KM));
  }
  function focusWorld(w, dist) {
    if (w._sol) { focusSolar(w._sol, !!dist); return; }
    if (w.solar) { const b = SOL.byWorld[w.id]; if (b) { focusSolar(b, !!dist); return; } }
    S.focus = null;
    const p = w._p || new T.Vector3(w.x, w.y, w.z);
    let d = dist || (w.group === 'remote' ? 45000 : w.group === 'explore' ? 9000 : w.dist < 60 ? 55 : 420);
    if (w.group === 'remote' && S.view !== 'magellan' && S.view !== 'galaxy') { S.view = 'magellan'; setView('magellan', true); }
    if (w.group === 'explore' && S.view === 'federation') { S.view = 'explore'; $$('.a-seg button', root).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === 'explore'))); }
    if (S.view === 'section') { S.section.z = Math.round(w.z); updateSectionUI(); setView('section'); return; }
    const dir = camera.position.clone().sub(controls.target).normalize();
    flyTo(p, p.clone().add(dir.multiplyScalar(d)));
  }

  /* ---------- 交互 ---------- */
  function pickAt(x, y) {
    let best = null, bd = 14, br = Infinity;
    for (const s of screen) { const r = s.r || 0; const d = Math.max(0, Math.hypot(s.x - x, s.y - y) - r); if (d < bd || (d === 0 && bd === 0 && r < br)) { bd = d; br = r; best = s.w; } }
    return best;
  }
  function onPick(id, ev) {
    if (/^[bs]:/.test(id)) { const it = solarItem(id); if (!it) return; if (S.measuring) { PA.toast('测距目前只支持星图上的世界'); return; } selectSolar(it, true); return; }
    const w = (A._all || []).find((x) => x.id === id) || D.byId[id]; if (!w) return;
    if (S.measuring) {
      S.measure = S.measure && S.measure.length === 1 ? [S.measure[0], w.id] : [w.id];
      if (S.measure.length === 2) { const [a, b] = S.measure.map((i) => (A._all || []).find((x) => x.id === i)); measureLine.geometry.setFromPoints([a.solar ? new T.Vector3() : a._p, b.solar ? new T.Vector3() : b._p]); measureLine.computeLineDistances(); measureLine.visible = true; }
      else measureLine.visible = false;
      renderHint(); select(w, false); return;
    }
    select(w, true);
  }
  function select(w, fly) {
    if (S.edit && S.dirty && S.draft && (!w || S.draft.id !== w.id)) { PA.toast('有未保存的修改，已暂存为草稿；点“保存”写入档案'); }
    if (S.edit && (!S.draft || !w || S.draft.id !== w.id)) { S.draft = w ? Object.assign({}, D.byId[w.id] || w) : null; S.dirty = false; }
    S.sel = w; S.ssel = (w && w.solar && SOL.byWorld[w.id]) || null; syncWorlds(); syncRing(); renderDrawer(); renderList();
    if (w && fly) focusWorld(w);
  }
  function selectSolar(it, fly) {
    const w = it.world && D.byId[it.world];
    if (S.edit) { if (w) select(w, false); else PA.toast('太阳系天体与地点保存在 data/worlds.json 的 solar 段落里'); if (fly) focusSolar(it); return; }
    S.ssel = it; S.sel = w || null; syncWorlds(); syncRing(); renderDrawer(); renderList();
    if (fly) focusSolar(it);
  }
  function onPointer() {
    let down = null, drag = null;
    const rect = () => canvas.getBoundingClientRect();
    canvas.addEventListener('pointerdown', (e) => {
      const r = rect(); down = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() };
      if (S.edit && S.draft && !S.draft.solar && S.draft.group !== 'remote') {
        const hit = pickAt(down.x, down.y);
        if (hit && hit.id === S.draft.id) {
          controls.enabled = false; canvas.setPointerCapture(e.pointerId);
          const n = camera.getWorldDirection(new T.Vector3()); const plane = new T.Plane().setFromNormalAndCoplanarPoint(n, new T.Vector3(S.draft.x, S.draft.y, S.draft.z));
          drag = { plane, id: e.pointerId }; root.style.cursor = 'grabbing';
        }
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const r = rect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      if (drag) {
        const ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(x / r.width * 2 - 1, -(y / r.height) * 2 + 1), camera);
        const p = new T.Vector3(); if (ray.ray.intersectPlane(drag.plane, p)) { S.draft.x = +p.x.toFixed(2); S.draft.y = +p.y.toFixed(2); S.draft.z = +p.z.toFixed(2); S.dirty = true; syncWorlds(); syncRing(); fillXYZ(); }
        return;
      }
      if (e.buttons) { tipEl.hidden = true; return; }
      const w = pickAt(x, y);
      if ((w && w.id) !== (S.hover && S.hover.id)) { S.hover = w; }
      canvas.style.cursor = w ? (S.edit && S.draft && w.id === S.draft.id ? 'grab' : 'pointer') : '';
      if (w && w._sol) { const it = w._sol; const E = SOL.byId.earth; const de = E ? it.pos.distanceTo(E.pos) : 0; tipEl.hidden = false; tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.innerHTML = `<b>${esc(it.name)}</b> <span style="color:${it.color}">${esc(it.type)}</span><br><small>${it.kind === 'site' && it.surface ? esc(SOL.byId[it.body].name) + ' · ' + latLonText(it) : it.star ? '联邦坐标原点' : '距地球 ' + lyText(de)}</small>`; }
      else if (w) { tipEl.hidden = false; tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px'; tipEl.innerHTML = `<b>${esc(w.name)}</b> <span style="color:${w.color}">${esc(w.kind)}</span><br><small>${PA.fmt(w.dist, w.dist < 100 ? 1 : 0)} 光年 · 象限 ${w.quad}${w.status !== '稳定航路' ? ' · ' + esc(w.status) : ''}</small>`; }
      else tipEl.hidden = true;
    });
    // 滚轮：按 deltaY 的大小连续缩放（OrbitControls 自带的滚轮每格固定倍率，跨越 20 个数量级太慢）
    root.addEventListener('wheel', (e) => {
      if (e.target.closest && e.target.closest('.a-panel')) return;
      e.preventDefault(); e.stopPropagation(); tween.t = 1;
      let dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1); dy = Math.max(-240, Math.min(240, dy));
      const off = camera.position.clone().sub(controls.target); const len = Math.min(9e5, Math.max(minDist(), off.length() * Math.exp(dy * 0.0026)));
      camera.position.copy(controls.target).add(off.setLength(len)); tipEl.hidden = true;
    }, { capture: true, passive: false });
    canvas.addEventListener('pointerup', (e) => {
      if (drag) { drag = null; controls.enabled = true; root.style.cursor = ''; renderDrawer(); return; }
      if (!down) return; const r = rect(); const x = e.clientX - r.left, y = e.clientY - r.top;
      if (Math.hypot(x - down.x, y - down.y) < 6 && performance.now() - down.t < 600) {
        const w = pickAt(x, y);
        if (w) onPick(w.id, e); else if (!S.measuring && !S.edit) { S.sel = null; S.ssel = null; syncWorlds(); syncRing(); renderDrawer(); }
      }
      down = null;
    });
    canvas.addEventListener('pointerleave', () => { tipEl.hidden = true; S.hover = null; });
    canvas.addEventListener('dblclick', (e) => { const r = rect(); const w = pickAt(e.clientX - r.left, e.clientY - r.top); if (!w) return; if (w._sol) { selectSolar(w._sol, false); focusSolar(w._sol, false); } else focusWorld(w, w.dist < 60 ? 20 : 160); });
    window.addEventListener('keydown', (e) => {
      if (!visible || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      if (e.key === 'Escape') { if (S.measuring) toggleMeasure(false); else select(null); }
      if (e.key === 'f' && S.ssel) focusSolar(S.ssel); else if (e.key === 'f' && S.sel) focusWorld(S.sel);
    });
  }

  /* ---------- 面板 ---------- */
  const ICO = {
    ruler: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
    edit: PA.ICON ? PA.ICON.edit : '', book: PA.ICON ? PA.ICON.book : '',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
    top: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>',
    full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  function shell() {
    root.innerHTML = `<canvas class="gl" tabindex="0" aria-label="三维疆域星图：拖动旋转，滚轮缩放，右键或双指平移，点击殖民地查看档案"></canvas>
      <svg class="leaders"></svg><div class="labels"></div><div class="a-tip" hidden></div>
      <div class="a-panel a-top" style="background:none;border:0;backdrop-filter:none">
        <div class="a-title"><b>银河系联邦 · 疆域图</b><span>Federation Atlas · F300</span></div>
        <div class="a-seg" role="group" aria-label="尺度与视图">${Object.entries(VIEWS).map(([k, v]) => `<button data-v="${k}" aria-pressed="false" title="${v.name}"${k === 'magellan' ? ' class="sep"' : ''}>${v.short}</button>`).join('')}</div>
        <div class="row" style="margin-left:auto">
          <button class="a-btn a-collapse" id="a-layers" aria-pressed="false">${ICO.layers}图层</button>
          <button class="a-btn" id="a-novel" aria-pressed="false" title="只显示小说相关世界的名称">${ICO.book}小说地名</button>
          <button class="a-btn" id="a-measure" aria-pressed="false" title="依次点击两个世界，测量直线距离">${ICO.ruler}测距</button>
          <button class="a-btn" id="a-edit" aria-pressed="false" title="拖动、修改、新增或删除世界">${ICO.edit}编辑</button>
        </div>
      </div>
      <aside class="a-panel a-left${S.leftOpen ? '' : ' closed'}" aria-label="图层与名录">
        <div class="hd"><button class="fold" id="a-fold" type="button" aria-expanded="${S.leftOpen}" aria-controls="a-left-body" title="折叠 / 展开左侧名录"><span>图层与名录</span><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="row hd-row" style="justify-content:space-between"><input id="a-q" type="search" placeholder="搜索世界、恒星、星区…" aria-label="搜索世界"></div></div>
        <div class="bd" id="a-left-body">
          <div class="a-sec" id="a-section" hidden><div class="a-section-ctl">
            <div class="row" style="justify-content:space-between"><b style="font-size:12.5px">截面位置 z = <span class="mono" id="a-secz"></span> 光年</b></div>
            <input type="range" id="a-secz-r" min="-500" max="1500" step="10" aria-label="截面 z">
            <div class="row" style="gap:6px"><button class="a-btn" data-sec="0">地球</button><button class="a-btn" data-sec="w55">普罗米修斯</button><button class="a-btn" data-sec="w50">基洛伯</button></div>
            <label class="a-hint">厚度 ±<span class="mono" id="a-thick-v"></span> 光年<input type="range" id="a-thick" min="25" max="400" step="25" aria-label="截面厚度"></label>
            <div class="a-hint">从银心一侧（+z）回望太阳系：x 向右，y（银北）向上。截面外的世界会变暗。</div></div></div>
          <div class="a-sec"><h6>分类 <button id="a-cat-all">全选</button></h6><div class="a-cats" id="a-cats"></div></div>
          <div class="a-sec"><h6>图层</h6><div class="a-toggles">
            <label class="a-toggle"><input type="checkbox" id="t-labels" checked>名称标签</label>
            <label class="a-toggle"><input type="checkbox" id="t-env" checked>包络与坐标轴</label>
            <label class="a-toggle"><input type="checkbox" id="t-ribs" checked>支线示意（殖民地 → 主干）</label>
            <label class="a-toggle"><input type="checkbox" id="t-routes" checked>雅各布之梯 · 麦哲伦弦</label>
            <label class="a-toggle"><input type="checkbox" id="t-galaxy" checked>银河系背景</label></div></div>
          <div class="a-sec"><h6>名录 <span id="a-count" class="mono"></span></h6><div class="a-list" id="a-list"></div></div>
        </div>
      </aside>
      <aside class="a-panel a-right" id="a-drawer" hidden></aside>
      <div class="a-panel a-inset" id="a-inset" hidden>${insetSVG()}</div>
      <div class="a-panel a-bottom"><div class="scale"><div class="bar"></div><span></span></div>
        <div class="a-legend" id="a-legend"></div>
        <span class="a-hint" id="a-hint"></span></div>
      <div class="a-panel a-zoom"><button id="z-in" title="放大" aria-label="放大">${ICO.plus}</button><button id="z-out" title="缩小" aria-label="缩小">${ICO.minus}</button><button id="z-home" title="回到当前视图" aria-label="复位">${ICO.home}</button><button id="z-top" title="俯视（银盘 / 黄道面 / 北极）" aria-label="俯视">${ICO.top}</button><button id="z-full" title="全屏" aria-label="全屏">${ICO.full}</button></div>`;
  }
  function insetSVG() {
    return `<div class="a-hint" style="color:#E6EBF5;font-weight:600">麦哲伦远征航线 · 拓扑示意</div><svg viewBox="0 0 320 150" role="img" aria-label="尼腓经雅各布之梯、玛门、麦哲伦弦到赫菲斯托斯的航线">
      <g font-size="10" fill="#E6EBF5" font-family="Noto Sans SC, sans-serif">
      <path d="M22 118 L70 40 L120 30" stroke="#B98CFF" stroke-width="1.6" fill="none" stroke-dasharray="5 3"/>
      <path d="M120 30 C 180 20, 230 70, 296 98" stroke="#B98CFF" stroke-width="1.6" fill="none" stroke-dasharray="7 4"/>
      <circle cx="22" cy="118" r="5" fill="#E8D46A"/><text x="8" y="138">46 尼腓</text>
      <text x="30" y="80" fill="#CDB4FF" font-size="9" transform="rotate(-58 46 78)">雅各布之梯 · 10年</text>
      <circle cx="120" cy="30" r="7" fill="#0B0F18" stroke="#B98CFF" stroke-width="2"/><text x="132" y="22">玛门 · 黑洞弹弓</text>
      <text x="168" y="62" fill="#CDB4FF" font-size="9">麦哲伦弦 · 单程约70年</text>
      <circle cx="296" cy="98" r="6" fill="#FFD9A0"/><text x="232" y="122">赫菲斯托斯（LMC）</text><text x="236" y="136" fill="#8E9BB4" font-size="9">塔罗斯轨道 · 求知者</text></g></svg>
      <div class="a-hint">求知者是人类最遥远的人造物体，约16万光年。实验星门尚未通航。</div>`;
  }
  function renderHint() {
    const h = $('#a-hint', root); if (!h) return;
    h.textContent = S.measuring ? (S.measure && S.measure.length === 1 ? '再点击一个世界完成测距 · Esc 退出' : '测距：依次点击两个世界') : S.edit ? '编辑模式：选中世界后可直接拖动它，或在右侧修改字段' : {
      earth: '点击城市，地球会转过去',
      earthmoon: '同步轨道船坞 · 月球 · L2 存续空间站',
      solar: '真实比例 · 点击天体飞近 · 滚轮可一路缩放到银河',
      core: '继续放大即进入真实比例的太阳系',
      federation: '拖动旋转 · 滚轮缩放 · 右键平移 · 双击飞近', explore: '圆柱：人类探索过的世界；2000 光年外只有科考站', galaxy: '银河旋臂为示意，太阳距银心约 26,000 光年', magellan: '大麦哲伦星系约 16 万光年；航线为示意曲线', section: '拖动滑块改变截面位置' }[S.view] || '';
  }
  function renderLegend() {
    const L = $('#a-legend', root); if (!L) return; const sol = ['earth', 'earthmoon', 'solar'].includes(S.view);
    const key = sol ? (S.view === 'earth' ? 'earth' : 'sol') : 'fed'; if (L.dataset.k === key) return; L.dataset.k = key;
    const it = (c, t, cls) => `<span><i${cls ? ` class="${cls}"` : ''} style="--c:${c}"></i>${t}</span>`;
    L.innerHTML = key === 'fed' ? it('#E2B254', '天蝎主干') + it('#4FD6E8', '稳定包络') + it('#E2B254;opacity:.6', '周期边疆') + it('#B98CFF', '特殊航路', 'dash')
      : key === 'earth' ? it('#FFD98E', '超级都市') + it('#5FD3E0', '淹没区 · 海平面 +8 m') + it('#9FB8F0', '气候') + it('#FF8A8A', '禁区')
      : it('#FFD98E', '行星轨道') + it('#CDB4FF', '同步轨道', 'dash') + it('#F5D38A', 'L2 晕轮轨道', 'dash') + it('#FF9C7A', '105 号事件（示意）', 'dash');
  }
  function renderCats() {
    const counts = {}; (A._all || D.worlds).forEach((w) => { counts[w.kind] = (counts[w.kind] || 0) + 1; });
    $('#a-cats', root).innerHTML = Object.entries(D.base.categories).filter(([k]) => counts[k]).map(([k, c]) => `<button class="a-cat" data-k="${esc(k)}" aria-pressed="${!S.cats || S.cats.has(k)}" style="--c:${c.color}"><i></i>${esc(k)}<em>${counts[k]}</em></button>`).join('');
    $$('.a-cat', root).forEach((b) => b.onclick = () => { if (!S.cats) S.cats = new Set(Object.keys(D.base.categories)); const k = b.dataset.k; S.cats.has(k) ? S.cats.delete(k) : S.cats.add(k); b.setAttribute('aria-pressed', String(S.cats.has(k))); syncWorlds(); renderList(); });
  }
  function renderList() {
    const q = ($('#a-q', root) || {}).value || ''; const ql = q.trim().toLowerCase();
    let arr = (A._all || D.worlds).filter(visibleCat);
    if (ql) arr = arr.filter((w) => [w.name, w.en, w.host, w.sector, w.domain, ...(w.aliases || [])].join(' ').toLowerCase().includes(ql));
    if (S.novel && !ql) arr = arr.filter((w) => w.novel);
    arr = arr.slice().sort((a, b) => a.dist - b.dist);
    // 太阳系里的天体与地点：搜索时、或“小说地名”模式下列出
    let sol = [];
    if (ql) sol = SOL.list.filter((b) => !b.world).concat(SOL.sites).filter((it) => [it.name, it.en, it.type].join(' ').toLowerCase().includes(ql));
    else if (S.novel) sol = SOL.sites.filter((it) => it.novel);
    $('#a-count', root).textContent = arr.length + sol.length;
    const solHTML = sol.map((it) => `<button data-sk="${it.key}" class="${S.ssel && S.ssel.key === it.key ? 'on' : ''}"><i style="--c:${it.color}"></i><span>${esc(it.name)} <span style="color:var(--space-muted)">${esc(it.kind === 'site' ? (SOL.byId[it.body] || {}).name || '' : it.type)}</span></span><em>☉</em></button>`).join('');
    $('#a-list', root).innerHTML = (solHTML ? solHTML : '') + arr.map((w) => `<button data-id="${w.id}" class="${S.sel && S.sel.id === w.id ? 'on' : ''}"><i style="--c:${w.color}"></i><span>${esc(w.name)} <span style="color:var(--space-muted)">${esc(w.en && w.en !== w.name ? w.en : '')}</span></span><em>${w.solar ? '☉' : w.dist >= 1000 ? PA.fmt(w.dist / 1000, 1) + 'k' : PA.fmt(w.dist, w.dist < 10 ? 1 : 0)}</em></button>`).join('') || '<div class="a-hint">没有匹配的世界</div>';
    const closeLeft = () => { if (window.innerWidth <= 900) { S.leftOpen = false; $('.a-left', root).classList.add('closed'); } };
    $$('#a-list button[data-id]', root).forEach((b) => b.onclick = () => { const w = (A._all || []).find((x) => x.id === b.dataset.id); if (w) { select(w, true); closeLeft(); } });
    $$('#a-list button[data-sk]', root).forEach((b) => b.onclick = () => { const it = solarItem(b.dataset.sk); if (it) { selectSolar(it, true); closeLeft(); } });
  }
  function factsHTML(w, max) { const f = Object.entries(w.facts || {}).slice(0, max || 8); return f.length ? `<dl class="facts">${f.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''; }
  function latLonText(s) { return `${PA.fmt(Math.abs(s.lat), 1)}°${s.lat >= 0 ? 'N' : 'S'} ${PA.fmt(Math.abs(s.lon), 1)}°${s.lon >= 0 ? 'E' : 'W'}`; }
  function renderSolarDrawer(d, it) {
    d.hidden = false;
    const isBody = it.kind === 'body'; const w = it.world && D.byId[it.world]; const host = isBody ? null : SOL.byId[it.body]; const E = SOL.byId.earth;
    const cells = [];
    if (isBody) {
      if (it.radius_km) cells.push(['半径', PA.fmt(it.radius_km, 0) + ' km']);
      if (it.a_au) cells.push(['轨道半径', PA.fmt(it.a_au, 3) + ' AU']); else if (it.a_km) cells.push(['绕' + SOL.byId[it.parent].name, kmText(it.a_km)]); else if (it.belt) cells.push(['范围', it.inner_au + '–' + it.outer_au + ' AU']);
      if (it.l2) cells.push(['距地球', '约 150 万公里']); else if (!it.star && !it.belt && it.id !== 'earth' && E) cells.push(['距地球', lyText(it.pos.distanceTo(E.pos))]);
      if (it.star) cells.push(['坐标', '(0, 0, 0)']);
    } else {
      if (it.surface) cells.push(['位置', latLonText(it)]);
      if (it.orbit_km) cells.push(['轨道半径', kmText(it.orbit_km)]);
      cells.push(['所在', host.name]);
      if (!it.surface && E) cells.push(['距地球', lyText(it.pos.distanceTo(E.pos))]);
    }
    const sites = isBody ? SOL.sites.filter((s) => s.body === it.id && (it.id !== 'earth' || s.surface || s.orbital)) : [];
    const extra = it.id === 'earth' ? SOL.sites.filter((s) => s.body === 'earth' && s.anchored) : [];
    const ppl = w ? D.chars.filter((c) => c.origin === w.id) : [];
    const siteBtns = (arr) => arr.map((s) => `<button data-sk="${s.key}" style="--c:${s.color}" class="${S.ssel === s ? 'on' : ''}"><i></i><span>${esc(s.name)}</span><em>${esc(s.type)}</em></button>`).join('');
    d.innerHTML = `<button class="a-btn close" id="a-close" aria-label="关闭">${ICO.x}</button>
      <div class="eyebrow" style="color:${it.color}">${w && w.no ? 'No.' + esc(w.no) + ' · ' : ''}${esc(it.type)}${host ? ' · ' + esc(host.name) : ''}</div>
      <h2>${esc(it.name)}<small>${esc(it.en || '')}</small></h2>
      <div class="chips">${PA.chip(it.type, it.color)}${w ? PA.chip(w.status) : ''}${host ? `<button class="chip" data-sk="${host.key}"><i style="background:${host.color}"></i>${esc(host.name)}</button>` : ''}${it.novel || (w && w.novel) ? PA.chip('小说地名', '#FFE7B0') : ''}</div>
      <p>${esc(it.summary || (w && w.summary) || '资料待补充。')}</p>
      ${w && w.hook ? `<p style="color:#FFE7B0">${esc(w.hook)}</p>` : ''}
      ${cells.length ? `<div class="coord-grid">${cells.map(([k, v]) => `<div><span>${esc(k)}</span><b style="font-size:12.5px">${esc(v)}</b></div>`).join('')}</div>` : ''}
      ${w ? factsHTML(w, 6) : factsHTML(it, 6)}
      ${it.id === 'earth' ? '<div class="a-note"><b>海平面 +8 米。</b>耻辱战争把温室效应推到接近极限：格陵兰冰盖大部分消融，北大西洋环流停摆。图中浅青色的近岸区域是被海水吞没的旧陆地；三百年后，地球仍在漫长的生态恢复中。</div>' : ''}
      ${sites.length ? `<h6 class="a-sub">${it.id === 'earth' ? '地表与轨道' : '地点'} · ${sites.length}</h6><div class="a-sites">${siteBtns(sites)}</div>` : ''}
      ${extra.length ? `<h6 class="a-sub">地月空间 · 105 号事件</h6><div class="a-sites">${siteBtns(extra)}</div>` : ''}
      ${ppl.length ? `<div class="chips">${ppl.map((c) => `<a class="chip" style="--c:${c.color}" href="#person-${c.id}"><i></i>${esc(c.name)}</a>`).join('')}</div>` : ''}
      <div class="actions">${w ? `<a class="a-btn" href="#world-${w.id}">打开档案 →</a>` : ''}<button class="a-btn" id="a-fly">${it.star ? '进入太阳系' : '飞近'}</button>${w ? `<button class="a-btn" id="a-to-edit">${ICO.edit}编辑</button>` : ''}</div>
      ${w ? '' : '<div class="a-hint" style="margin-top:8px">太阳系天体与地点保存在 data/worlds.json 的 solar 段落，可以直接修改文字和经纬度。</div>'}`;
    $('#a-close', d).onclick = () => { S.ssel = null; select(null); };
    $('#a-fly', d).onclick = () => (it.star ? setView('solar') : focusSolar(it, true));
    const ed = $('#a-to-edit', d); if (ed) ed.onclick = () => { S.ssel = null; S.sel = w; toggleEdit(true); };
    $$('[data-sk]', d).forEach((b) => b.onclick = () => { const x = solarItem(b.dataset.sk); if (x) selectSolar(x, true); });
  }
  function renderDrawer() {
    const d = $('#a-drawer', root);
    if (S.edit) { renderEditor(d); return; }
    if (S.ssel) { renderSolarDrawer(d, S.ssel); return; }
    const w = S.sel; if (!w) { d.hidden = true; return; }
    d.hidden = false;
    d.innerHTML = `<button class="a-btn close" id="a-close" aria-label="关闭">${ICO.x}</button>
      <div class="eyebrow" style="color:${w.color}">${w.no ? 'No.' + esc(w.no) + ' · ' : ''}${esc(w.cat.en || '')}</div>
      <h2>${esc(w.name)}<small>${esc(w.en || '')}</small></h2>
      <div class="chips">${PA.chip(w.kind, w.color)}${PA.chip(w.status)}<span class="chip">象限 ${w.quad}</span></div>
      <p>${esc(w.summary || '资料待补充。')}</p>
      ${w.hook ? `<p style="color:#FFE7B0">${esc(w.hook)}</p>` : ''}
      <div class="coord-grid"><div><span>X</span><b>${PA.fmt(w.x, 1)}</b></div><div><span>Y</span><b>${PA.fmt(w.y, 1)}</b></div><div><span>Z</span><b>${PA.fmt(w.z, 1)}</b></div><div><span>距地球</span><b>${w.dist >= 10000 ? PA.fmt(w.dist / 1000, 1) + 'k' : PA.fmt(w.dist, 1)}</b></div><div><span>离轴 r</span><b>${PA.fmt(w.r, 0)}</b></div><div><span>星区</span><b style="font-size:11.5px;font-family:var(--body)">${esc((w.sector || '—').replace('星区', ''))}</b></div></div>
      ${factsHTML(w, 6)}
      ${(() => { const ppl = D.chars.filter((c) => c.origin === w.id); return ppl.length ? `<div class="chips">${ppl.map((c) => `<a class="chip" style="--c:${c.color}" href="#person-${c.id}"><i></i>${esc(c.name)}</a>`).join('')}</div>` : ''; })()}
      <div class="actions"><a class="a-btn" href="#world-${w.id}">打开档案 →</a><button class="a-btn" id="a-fly">飞近</button><button class="a-btn" id="a-to-edit">${ICO.edit}编辑</button></div>`;
    $('#a-close', d).onclick = () => select(null);
    $('#a-fly', d).onclick = () => focusWorld(w, w.dist < 60 ? 18 : 140);
    $('#a-to-edit', d).onclick = () => toggleEdit(true);
  }
  function fillXYZ() { ['x', 'y', 'z'].forEach((k) => { const el = $('#e-' + k, root); if (el && document.activeElement !== el) el.value = S.draft[k]; }); const r = $('#e-dist', root); if (r) r.textContent = PA.fmt(Math.hypot(S.draft.x, S.draft.y, S.draft.z), 1) + ' 光年 · 象限 ' + PA.coords.quadrant(S.draft.x, S.draft.y); }
  function renderEditor(d) {
    d.hidden = false;
    const st = PA.store; const where = st.canCloud ? '在线档案（所有访问者可见）' : '这台设备的浏览器（本地草稿）';
    const n = PA.editCount();
    const top = `<div class="a-edit-banner"><span>编辑模式 · 保存到${where}</span><button class="a-btn" id="e-exit" style="height:28px">完成</button></div>`;
    const tools = `<div class="actions"><button class="a-btn" id="e-new">${ICO.plus}新建世界</button><button class="a-btn" id="e-export">导出 worlds.json</button><label class="a-btn" for="e-import">导入</label><input id="e-import" type="file" accept=".json,application/json" hidden></div><div class="a-hint">已修改 ${n} 项。导出的 worlds.json 可直接替换源码中的 data/worlds.json。</div>`;
    const w = S.draft;
    if (!w) { d.innerHTML = top + '<h2>选择一个世界</h2><p>在图上或左侧名录中点选一个世界进行编辑，或新建一个。选中后可以直接用鼠标拖动它。</p>' + tools; wireEditorTools(d); return; }
    const kinds = Object.keys(D.base.categories), stats = Object.keys(D.base.statuses);
    const state = PA.editState(w.id); const isNew = PA.isNewWorld(w.id) && !D.byId[w.id];
    d.innerHTML = top + `<div class="a-form">
      <div class="row" style="justify-content:space-between"><h2 style="font-size:19px">${esc(w.name || '新世界')}<small>${isNew ? '新建 · 尚未保存' : state ? (state === 'cloud' ? '已有在线修改' : '已有本地修改') : '原始数据'}${S.dirty ? ' · 有未保存的更改' : ''}</small></h2></div>
      <div class="fields two"><label class="field">中文名<input id="e-name" value="${esc(w.name || '')}"></label><label class="field">英文名<input id="e-en" value="${esc(w.en || '')}"></label></div>
      <div class="fields two"><label class="field">分类<select id="e-kind">${kinds.map((k) => `<option${k === w.kind ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></label><label class="field">航路状态<select id="e-status">${stats.map((k) => `<option${k === w.status ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select></label></div>
      <div class="fields"><label class="field">x<input id="e-x" type="number" step="0.1" value="${w.x}"></label><label class="field">y<input id="e-y" type="number" step="0.1" value="${w.y}"></label><label class="field">z<input id="e-z" type="number" step="0.1" value="${w.z}"></label></div>
      <div class="a-hint" id="e-dist"></div>
      <details><summary class="a-hint" style="cursor:pointer">用赤经 / 赤纬 / 距离设置位置</summary><div class="fields" style="margin-top:8px"><label class="field">赤经 α<input id="e-ra" placeholder="19h54m36s"></label><label class="field">赤纬 δ<input id="e-dec" placeholder="+43 57 18"></label><label class="field">距离 ly<input id="e-d" type="number" step="any"></label></div><button class="a-btn" id="e-radec" style="margin-top:6px">换算并移动</button></details>
      <label class="field">星图圆点大小 · <span class="mono" id="e-size-v">${(w.size || 1).toFixed(2)}</span><input id="e-size" type="range" min="0.4" max="3" step="0.05" value="${w.size || 1}"></label>
      <div class="fields two"><label class="field">星区<input id="e-sector" value="${esc(w.sector || '')}" list="e-sectors"></label><label class="field">星域<input id="e-domain" value="${esc(w.domain || '')}"></label></div>
      <datalist id="e-sectors">${Array.from(new Set(D.worlds.map((x) => x.sector).filter(Boolean))).map((s) => `<option value="${esc(s)}">`).join('')}</datalist>
      <div class="fields two"><label class="field">宿主恒星<input id="e-host" value="${esc(w.host || '')}"></label><label class="field">行星<input id="e-planet" value="${esc(w.planet || '')}"></label></div>
      <label class="field">简介<textarea id="e-summary" rows="4">${esc(w.summary || '')}</textarea></label>
      <label class="field">档案字段（每行“名称：内容”）<textarea id="e-facts" rows="4">${esc(Object.entries(w.facts || {}).map(([k, v]) => k + '：' + v).join('\n'))}</textarea></label>
      <div class="fields two"><label class="field">别名（逗号分隔）<input id="e-aliases" value="${esc((w.aliases || []).join('，'))}"></label><label class="field">标签（逗号分隔）<input id="e-tags" value="${esc((w.tags || []).join('，'))}"></label></div>
      <label class="a-toggle"><input type="checkbox" id="e-novel"${w.novel ? ' checked' : ''}>小说地名（在“小说地名”模式中常显）</label>
      <div class="actions"><button class="btn btn-primary" id="e-save">保存</button>${S.dirty ? '<button class="btn" id="e-undo">放弃更改</button>' : ''}${state ? '<button class="btn" id="e-revert">恢复原始数据</button>' : ''}<button class="btn btn-danger" id="e-del">删除</button></div>
      <div id="e-confirm"></div></div>` + tools;
    fillXYZ();
    const bind = (id, key, conv) => { const el = $('#e-' + id, d); if (!el) return; el.addEventListener('input', () => { S.draft[key] = conv ? conv(el.value) : el.value; S.dirty = true; if (['x', 'y', 'z', 'size', 'kind', 'status'].includes(key)) { syncWorlds(); syncRing(); } if (key === 'x' || key === 'y' || key === 'z') fillXYZ(); if (key === 'size') $('#e-size-v', d).textContent = (+el.value).toFixed(2); }); };
    bind('name', 'name'); bind('en', 'en'); bind('kind', 'kind'); bind('status', 'status'); bind('sector', 'sector'); bind('domain', 'domain'); bind('host', 'host'); bind('planet', 'planet'); bind('summary', 'summary');
    ['x', 'y', 'z'].forEach((k) => bind(k, k, (v) => (isFinite(parseFloat(v)) ? parseFloat(v) : 0)));
    bind('size', 'size', (v) => +v);
    $('#e-facts', d).addEventListener('input', (e) => { const o = {}; e.target.value.split('\n').forEach((l) => { const m = l.match(/^\s*([^：:]+)[：:]\s*(.+)$/); if (m) o[m[1].trim()] = m[2].trim(); }); S.draft.facts = o; S.dirty = true; });
    $('#e-aliases', d).addEventListener('input', (e) => { S.draft.aliases = e.target.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean); S.dirty = true; });
    $('#e-tags', d).addEventListener('input', (e) => { S.draft.tags = e.target.value.split(/[,，、]/).map((s) => s.trim()).filter(Boolean); S.dirty = true; });
    $('#e-novel', d).addEventListener('change', (e) => { S.draft.novel = e.target.checked; S.dirty = true; });
    $('#e-radec', d).onclick = () => { const ra = PA.coords.parseRA($('#e-ra', d).value), dec = PA.coords.parseDec($('#e-dec', d).value), dist = parseFloat($('#e-d', d).value); if (!(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 && dist >= 0)) { PA.toast('请检查赤经、赤纬和距离'); return; } const r = PA.coords.toFederation(ra, dec, dist); Object.assign(S.draft, { x: +r.x.toFixed(3), y: +r.y.toFixed(3), z: +r.z.toFixed(3) }); S.dirty = true; syncWorlds(); syncRing(); fillXYZ(); focusWorld(PA.derive(Object.assign({}, S.draft))); };
    $('#e-save', d).onclick = async () => {
      const rec = Object.assign({}, S.draft); if (!rec.name || !rec.name.trim()) { PA.toast('请填写中文名'); return; }
      const where2 = await PA.saveWorld(rec); S.dirty = false; S.draft = Object.assign({}, D.byId[rec.id]); S.sel = D.byId[rec.id];
      syncWorlds(); syncRing(); renderCats(); renderList(); renderDrawer(); buildRoutes(); PA.toast(where2 === 'cloud' ? '已保存到在线档案' : '已保存到本地（导出 JSON 可写入源码）');
    };
    const undo = $('#e-undo', d); if (undo) undo.onclick = () => { const base = D.byId[w.id]; S.draft = base ? Object.assign({}, base) : null; S.dirty = false; S.sel = base || null; syncWorlds(); syncRing(); renderDrawer(); };
    const rev = $('#e-revert', d); if (rev) rev.onclick = async () => { await PA.revertWorld(w.id); S.draft = D.byId[w.id] ? Object.assign({}, D.byId[w.id]) : null; S.sel = D.byId[w.id] || null; S.dirty = false; syncWorlds(); syncRing(); renderCats(); renderList(); renderDrawer(); buildRoutes(); PA.toast('已恢复原始数据'); };
    $('#e-del', d).onclick = () => {
      $('#e-confirm', d).innerHTML = `<div class="confirm">删除“${esc(w.name)}”？${PA.isNewWorld(w.id) ? '' : '原始数据仍保留在源码中，可随时“恢复原始数据”。'}<div class="actions"><button class="btn btn-danger" id="e-del-yes">删除</button><button class="btn" id="e-del-no">取消</button></div></div>`;
      $('#e-del-yes', d).onclick = async () => { if (PA.isNewWorld(w.id) && !D.byId[w.id]) { S.draft = null; } else { await PA.deleteWorld(w.id); S.draft = null; } S.sel = null; S.dirty = false; syncWorlds(); syncRing(); renderCats(); renderList(); renderDrawer(); PA.toast('已删除'); };
      $('#e-del-no', d).onclick = () => { $('#e-confirm', d).innerHTML = ''; };
    };
    wireEditorTools(d);
  }
  function newWorld(at) {
    const p = at || { x: +controls.target.x.toFixed(2), y: +controls.target.y.toFixed(2), z: +controls.target.z.toFixed(2) };
    const id = 'u' + Date.now().toString(36);
    S.draft = { id, no: '', name: '新世界', en: '', kind: '农业世界', status: '稳定航路', sector: '', domain: '', host: '', planet: '', x: p.x, y: p.y, z: p.z, size: 1, tags: [], summary: '' };
    S.dirty = true; S.sel = PA.derive(Object.assign({}, S.draft)); syncWorlds(); syncRing(); renderDrawer();
    setTimeout(() => { const n = $('#e-name', root); if (n) { n.focus(); n.select(); } }, 30);
  }
  function wireEditorTools(d) {
    const ex = $('#e-exit', d); if (ex) ex.onclick = () => toggleEdit(false);
    $('#e-new', d).onclick = () => newWorld();
    $('#e-export', d).onclick = async () => { const s = await PA.saveFile('worlds.json', PA.exportWorldsJSON()); PA.toast(s === 'copied' ? '已复制 worlds.json 到剪贴板' : s === 'declined' ? '已取消' : s === 'failed' ? '导出失败' : '已导出 worlds.json'); };
    $('#e-import', d).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const n = PA.importWorldsJSON(await f.text()); PA.toast(`已导入 ${n} 个世界`); syncWorlds(); renderCats(); renderList(); renderDrawer(); } catch (err) { PA.toast('导入失败：' + err.message, 4000); } };
  }
  function toggleEdit(on) {
    S.edit = on; $('#a-edit', root).setAttribute('aria-pressed', String(on));
    if (on) { S.draft = S.sel ? Object.assign({}, D.byId[S.sel.id] || S.sel) : null; S.dirty = false; if (S.measuring) toggleMeasure(false); }
    else { if (S.dirty) PA.toast('未保存的修改已丢弃'); S.draft = null; S.dirty = false; S.sel = S.sel && D.byId[S.sel.id] ? D.byId[S.sel.id] : null; }
    syncWorlds(); syncRing(); renderDrawer(); renderHint();
  }
  function toggleMeasure(on) {
    S.measuring = on; S.measure = null; measureLine.visible = false; $('#a-measure', root).setAttribute('aria-pressed', String(on));
    if (on && S.edit) toggleEdit(false);
    renderHint();
  }
  function updateSectionUI() {
    $('#a-secz', root).textContent = S.section.z; $('#a-secz-r', root).value = S.section.z;
    $('#a-thick-v', root).textContent = S.section.thick; $('#a-thick', root).value = S.section.thick;
  }
  function wire() {
    $$('.a-seg button', root).forEach((b) => b.onclick = () => setView(b.dataset.v));
    $('#a-novel', root).onclick = () => { S.novel = !S.novel; $('#a-novel', root).setAttribute('aria-pressed', String(S.novel)); if (S.novel) { S.labels = true; $('#t-labels', root).checked = true; } renderList(); };
    $('#a-measure', root).onclick = () => toggleMeasure(!S.measuring);
    $('#a-edit', root).onclick = () => toggleEdit(!S.edit);
    const setLeft = (open) => {
      S.leftOpen = !!open;
      $('.a-left', root).classList.toggle('closed', !S.leftOpen);
      $('#a-layers', root).setAttribute('aria-pressed', String(S.leftOpen));
      $('#a-fold', root).setAttribute('aria-expanded', String(S.leftOpen));
    };
    setLeft(S.leftOpen);
    $('#a-layers', root).onclick = () => setLeft(!S.leftOpen);
    $('#a-fold', root).onclick = () => setLeft(!S.leftOpen);
    $('#a-q', root).oninput = () => { renderList(); if (window.innerWidth <= 900 && !S.leftOpen) setLeft(true); };
    $('#a-q', root).onkeydown = (e) => { if (e.key === 'Enter') { const b = $('#a-list button', root); if (b) b.click(); } };
    $('#a-cat-all', root).onclick = () => { S.cats = null; renderCats(); syncWorlds(); renderList(); };
    const tog = (id, key, fn) => { $('#' + id, root).onchange = (e) => { S[key] = e.target.checked; if (fn) fn(); }; };
    tog('t-labels', 'labels'); tog('t-env', 'env'); tog('t-ribs', 'ribs', () => { ribs.visible = S.ribs; }); tog('t-routes', 'routes'); tog('t-galaxy', 'galaxy');
    $('#a-secz-r', root).oninput = (e) => { S.section.z = +e.target.value; updateSectionUI(); sectionGroup.position.z = S.section.z; const t = new T.Vector3(0, 0, S.section.z); controls.target.copy(t); camera.position.set(camera.position.x, camera.position.y, S.section.z + 1900); syncWorlds(); };
    $('#a-thick', root).oninput = (e) => { S.section.thick = +e.target.value; updateSectionUI(); syncWorlds(); };
    $$('[data-sec]', root).forEach((b) => b.onclick = () => { const w = D.byId[b.dataset.sec]; S.section.z = w ? Math.round(w.z) : 0; updateSectionUI(); setView('section'); });
    const zoom = (k) => { const off = camera.position.clone().sub(controls.target); const len = Math.min(controls.maxDistance, Math.max(controls.minDistance, off.length() * k)); flyTo(controls.target, controls.target.clone().add(off.setLength(len)), 0.45); };
    $('#z-in', root).onclick = () => zoom(0.6); $('#z-out', root).onclick = () => zoom(1.6);
    $('#z-home', root).onclick = () => setView(S.view);
    $('#z-top', root).onclick = () => { const t = controls.target.clone(); const d = camera.position.distanceTo(t); const u = upGoal(d); const side = new T.Vector3(1, 0, 0).cross(u).lengthSq() > 0.01 ? new T.Vector3(1, 0, 0) : new T.Vector3(0, 0, 1); flyTo(t, t.clone().addScaledVector(u, d).addScaledVector(side, d * 0.002), 0.9); };
    $('#z-full', root).onclick = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else host.requestFullscreen().catch(() => PA.toast('当前环境不支持全屏')); } catch (e) { PA.toast('当前环境不支持全屏'); } };
    PA.on('worlds', () => { if (!inited) return; syncWorlds(); syncRing(); renderCats(); renderList(); buildRoutes(); if (!S.edit) { if (S.sel) S.sel = D.byId[S.sel.id] || null; renderDrawer(); } });
    PA.on('store', () => { if (S.edit) renderDrawer(); });
  }

  /* ---------- 循环 ---------- */
  function resize() {
    const W = root.clientWidth, H = root.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    const pr = renderer.getPixelRatio();
    [worldPts, ringPts, starfield, trunkPts, extPts, SOL.markers, SOL.belt].forEach((o) => { if (o && o.material.uniforms.uPR) o.material.uniforms.uPR.value = pr; });
    galaxy.material.uniforms.uScale.value = (H * pr / 2) / Math.tan(camera.fov * Math.PI / 360);
  }
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function loop() {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, clock.getDelta()); const time = clock.elapsedTime;
    const flying = tween.t < 1 && tween.to;
    if (flying) stepTween(dt);
    let camDist = camera.position.distanceTo(controls.target);
    // 动态近裁面 / 远裁面：从地表几千公里到银河系十几万光年，比例保持在 1e9 以内
    controls.minDistance = flying ? 0 : minDist(); controls.maxDistance = flying ? Infinity : 9e5;
    camera.up.lerp(upGoal(camDist), flying ? 0.12 : 1 - Math.exp(-dt * 3)).normalize();
    controls.update();
    camDist = camera.position.distanceTo(controls.target);
    const nf = camDist * 1e-3; if (Math.abs(camera.near / nf - 1) > 0.05) { camera.near = nf; camera.far = camDist * 1e6; camera.updateProjectionMatrix(); }
    starfield.position.copy(camera.position); starfield.scale.setScalar(camDist * 1e4 / 2e7);
    if (!flying && S.view !== 'section' && (S.view !== 'magellan' || camDist < 30000)) { const lv = levelFor(camDist); if (lv !== S.view) { S.view = lv; onLevel(); } }
    const solarScale = camDist < 0.5;
    worldPts.material.uniforms.uK.value = 0.32 + 0.68 * sstep(0.01, 0.6, camDist);
    const gOp = S.galaxy ? Math.min(1, Math.max(0, (camDist - 3500) / 14000)) : 0;
    galaxy.material.uniforms.uOpacity.value = gOp * (S.view === 'explore' ? 0.6 : 0.95); galaxy.visible = gOp > 0.001;
    const envOn = S.env && S.view !== 'section';
    envStable.visible = envFringe.visible = envOn && camDist < 200000 && camDist > 2; envExplore.visible = envOn && camDist > 2500;
    envStable.material.uniforms.uOpacity.value = 1.0; envFringe.material.uniforms.uOpacity.value = 0.75;
    envExplore.material.uniforms.uOpacity.value = Math.min(1.5, (camDist - 2500) / 8000);
    A._axes.visible = S.env && S.view !== 'section' && camDist < 30000 && !solarScale;
    routeObjs.forEach((o) => { o.obj.visible = S.routes && S.view !== 'section' && !solarScale; });
    [trunkPts, extPts].forEach((p) => { p.material.uniforms.uTime.value = time; }); ribs.visible = S.ribs && S.view !== 'section' && !solarScale;
    extPts.visible = S.view !== 'section' && !solarScale; trunk.visible = trunkPts.visible = !solarScale;
    solarFrame(camDist, root.clientHeight || 1, dt);
    if (ringPts) {
      ringPts.material.uniforms.uTime.value = time;
      const R = A._ring; let rv = !!R;
      if (R && R.sol) { const it = R.sol; rv = SOL.on ? (it.kind === 'body' ? (it._px || 0) < 10 && (it.star || (it._sep || 0) >= 9) : !it.surface) : (it.star || camDist > 0.2); }
      ringPts.visible = rv;
    }
    renderer.render(scene, camera);
    updateOverlay();
  }

  /* ---------- 公开接口 ---------- */
  A.init = function (h) { host = h; };
  function realInit() {
    host.innerHTML = '<div class="atlas"></div>'; root = host.firstChild; shell();
    canvas = $('canvas.gl', root); labelsEl = $('.labels', root); leadersEl = $('svg.leaders', root); tipEl = $('.a-tip', root);
    renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0x060B16, 1);
    scene = new T.Scene(); camera = new T.PerspectiveCamera(50, 1, 0.05, 1e8);
    controls = new T.OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = true; controls.zoomSpeed = 1.6; controls.rotateSpeed = 0.7;
    controls.addEventListener('start', () => { tween.t = 1; });
    buildStarfield(); buildGalaxy(); buildEnvelopes(); buildTrunk(); buildSection(); buildMeasure(); buildSolar();
    syncWorlds(); buildRoutes(); syncRing(); buildStaticLabels();
    renderCats(); renderList(); wire(); updateSectionUI();
    S.section.z = 0; setView('federation', true);
    new ResizeObserver(resize).observe(root); resize();
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (visible && !raf) loop(); });
    onPointer(); inited = true;
  }
  A.show = function (pending) {
    visible = true;
    if (!inited) { try { realInit(); } catch (e) { console.error(e); host.innerHTML = `<div class="atlas" style="display:grid;place-items:center;color:#8E9BB4;padding:20px;text-align:center">星图初始化失败：${esc(e.message)}<br>请确认浏览器支持 WebGL。</div>`; return; } }
    resize(); if (!raf) { clock.getDelta(); loop(); }
    if (pending) {
      if (pending.novel) { S.novel = true; $('#a-novel', root).setAttribute('aria-pressed', 'true'); renderList(); }
      if (pending.create) { if (!S.edit) toggleEdit(true); newWorld(pending.create); focusWorld(PA.derive(Object.assign({}, S.draft))); }
      if (pending.id && D.byId[pending.id]) { const w = D.byId[pending.id]; if (pending.edit && !S.edit) toggleEdit(true); select(w, true); if (pending.edit) { S.draft = Object.assign({}, w); renderDrawer(); } }
      if (pending.site || pending.body) { const it = pending.site ? SOL.siteById[pending.site] : SOL.byId[pending.body]; if (it) selectSolar(it, true); }
      if (pending.view && VIEWS[pending.view]) setView(pending.view);
    }
    setTimeout(() => canvas && canvas.focus({ preventScroll: true }), 50);
  };
  A.hide = function () { visible = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  A.state = S;
  A.view = (name, instant) => { if (inited) setView(name, instant); };
  A.focus = (key) => { const it = inited && solarItem(key); if (it) selectSolar(it, true); };
  A._dist = () => camera.position.distanceTo(controls.target);
  A._finish = () => { if (tween.to && tween.t < 1) { tween.t = 0.999999; stepTween(1); } };
  A._zoom = (k) => { const off = camera.position.clone().sub(controls.target); camera.position.copy(controls.target).add(off.multiplyScalar(k)); };
})();
