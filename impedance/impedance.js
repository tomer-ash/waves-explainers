/* Impedance on a String: the interactive figures.
   Every widget has its own init in a try/catch, so one failure does not blank the page.
   Physics conventions follow the lecture notes (L07-L10); see the page text. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  // Language: the Hebrew page sets lang="he" on .page; figures stay left-to-right, only their words change.
  const HE = ((document.querySelector('.page') || document.documentElement).getAttribute('lang') || '').startsWith('he');
  const tr = (en, he) => (HE ? he : en);
  const iso = (s) => '⁦' + s + '⁩'; // keep a formula left-to-right inside Hebrew text
  const hasHe = (s) => /[֐-׿]/.test(s);

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function pal() {
    return {
      bg: cssVar('--surface'), ink: cssVar('--ink'), muted: cssVar('--muted'), line: cssVar('--line'),
      soft: cssVar('--soft'), inc: cssVar('--c-inc'), r: cssVar('--c-r'), t: cssVar('--c-t'),
      z: cssVar('--c-z'), ten: cssVar('--c-ten'), vy: cssVar('--c-vy'), ghost: cssVar('--ghost'),
      mono: cssVar('--font-mono') || 'monospace', sans: cssVar('--font-body') || 'sans-serif'
    };
  }

  function fmt(x, d = 2) {
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    if (Number.isNaN(x)) return '—';
    const a = Math.abs(x);
    let s;
    if (a >= 100) s = x.toFixed(0);
    else if (a >= 10) s = x.toFixed(1);
    else s = x.toFixed(d);
    return s.replace('-', '−');
  }
  function pct(x) { return (100 * x).toFixed(x > 0.995 || x < 0.005 ? 0 : 1) + '%'; }

  /* ---------- canvas + animation plumbing ---------- */
  function setupCanvas(cv, heightOf) {
    const ctx = cv.getContext('2d');
    const S = { cv, ctx, w: 0, h: 0 };
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(10, cv.clientWidth);
      const h = Math.round(heightOf(w));
      if (cv.style.height !== h + 'px') cv.style.height = h + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S.w = w; S.h = h;
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (Math.abs(cv.clientWidth - S.w) > 0.5) resize(); }).observe(cv);
    else window.addEventListener('resize', resize);
    return S;
  }
  const widgets = [];
  function addWidget(el, tick) {
    const w = { el, tick, visible: true, dead: false };
    widgets.push(w);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((es) => es.forEach((e) => { w.visible = e.isIntersecting; })).observe(el);
    }
    return w;
  }
  let lastT = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    for (const w of widgets) {
      if (!w.visible || w.dead) continue;
      try { w.tick(dt); } catch (e) { w.dead = true; console.error(e); }
    }
    requestAnimationFrame(loop);
  }
  function safeInit(name, fn) {
    try { fn(); } catch (e) {
      console.error('widget ' + name + ' failed', e);
      const box = document.getElementById(name);
      if (box) box.insertAdjacentHTML('beforeend', '<p class="widget-error">This figure could not start in your browser. The text around it still holds.</p>');
    }
  }
  function playButton(btn, get, set) {
    const show = () => { btn.textContent = get() ? tr('Pause', "השהה") : tr('Play', "הפעל"); btn.setAttribute('aria-pressed', String(get())); };
    btn.addEventListener('click', () => { set(!get()); show(); });
    show();
    return show;
  }

  /* drawing helpers */
  function line(ctx, pts, color, width, dash) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath();
    let pen = false;
    for (const p of pts) {
      if (p == null) { pen = false; continue; }
      if (!pen) { ctx.moveTo(p[0], p[1]); pen = true; } else ctx.lineTo(p[0], p[1]);
    }
    ctx.stroke(); ctx.restore();
  }
  function arrow(ctx, x1, y1, x2, y2, color, width = 2.5) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 3) return;
    const a = Math.atan2(y2 - y1, x2 - x1), hs = Math.min(9, len * 0.5);
    ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - hs * 0.6 * Math.cos(a), y2 - hs * 0.6 * Math.sin(a)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - hs * Math.cos(a - 0.45), y2 - hs * Math.sin(a - 0.45));
    ctx.lineTo(x2 - hs * Math.cos(a + 0.45), y2 - hs * Math.sin(a + 0.45));
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function label(ctx, text, x, y, color, opts = {}) {
    const P = pal();
    ctx.save();
    ctx.font = (opts.weight || '600') + ' ' + (opts.size || 12) + 'px ' + (opts.mono ? P.mono : P.sans);
    ctx.fillStyle = color; ctx.textAlign = opts.align || 'center'; ctx.textBaseline = opts.base || 'middle';
    ctx.direction = hasHe(text) ? 'rtl' : 'ltr';
    if (opts.halo) { ctx.lineWidth = 4; ctx.strokeStyle = P.bg; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y); }
    ctx.fillText(text, x, y); ctx.restore();
  }
  function hatchWall(ctx, x, y0, y1, side, color) { // side -1: hatch to the left
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
    ctx.lineWidth = 1.2;
    for (let y = y0 + 4; y < y1; y += 9) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 9, y + 9); ctx.stroke(); }
    ctx.restore();
  }
  function rodAndRing(ctx, x, y0, y1, yRing, color) {
    ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([2, 3]);
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(x, yRing, 4, 7, 0, 0, TAU); ctx.stroke(); ctx.restore();
  }
  function logSlider(el) { return Math.pow(10, parseFloat(el.value)); }

  /* ============ 1. The junction simulator (L07, L08, L09) ============ */
  const junctionAPI = {};
  function initJunction() {
    const box = $('#sim-junction');
    const S = setupCanvas($('canvas', box), (w) => Math.max(230, Math.min(330, w * 0.4)));
    const st = { rhoR: 4, tenR: 1, mode: 'string', shape: 'bump', t: 0, playing: !reduceMotion, parts: true, ghost: false };
    const v1 = 0.5, x0 = 0.72, t0 = x0 / v1;
    if (!st.playing) st.t = t0 + 0.85;
    const rho = $('#j-rho'), ten = $('#j-ten');

    function P() {
      if (st.mode === 'wall') return { Zr: Infinity, vr: 0, R: -1, T: 0, RE: 1, TE: 0 };
      if (st.mode === 'free') return { Zr: 0, vr: Infinity, R: 1, T: 2, RE: 1, TE: 0 };
      const Zr = Math.sqrt(st.rhoR * st.tenR), vr = Math.sqrt(st.tenR / st.rhoR);
      const R = (1 - Zr) / (1 + Zr), T = 2 / (1 + Zr);
      return { Zr, vr, R, T, RE: R * R, TE: Zr * T * T };
    }
    function f(s) {
      if (st.shape === 'bump') return Math.exp(-((s / 0.16) ** 2));
      return Math.exp(-((s / 0.34) ** 2)) * Math.cos(TAU * 3.0 * s);
    }
    function readouts() {
      const p = P();
      $('#j-zr').textContent = fmt(p.Zr);
      $('#j-vr').textContent = st.mode === 'string' ? fmt(p.vr) : (st.mode === 'wall' ? '0' : '∞');
      $('#j-R').textContent = fmt(p.R);
      $('#j-T').textContent = fmt(p.T);
      $('#j-RE').textContent = pct(p.RE);
      $('#j-TE').textContent = pct(p.TE);
      $('#j-bar-r').style.width = (100 * p.RE) + '%';
      $('#j-bar-t').style.width = (100 * p.TE) + '%';
      $('#j-rho-out').textContent = st.mode === 'string' ? '× ' + fmt(st.rhoR) : (st.mode === 'wall' ? tr('∞ (wall)', "∞ (קיר)") : tr('0 (no string)', "0 (אין מיתר)"));
      $('#j-ten-out').textContent = st.mode === 'string' ? '× ' + fmt(st.tenR) : '—';
      let say;
      if (st.mode === 'wall') say = tr('Wall: impedance Z₂ = ∞. Everything comes back, upside down (R = −1).', "קיר: עכבה Z₂ = ∞. הכול חוזר, הפוך (R = −1).");
      else if (st.mode === 'free') say = tr('Free end: impedance Z₂ = 0. Everything comes back, upright (R = +1). The end swings to twice the height.', "קצה חופשי: עכבה Z₂ = 0. הכול חוזר, לא הפוך (R = +1). הקצה מגיע לגובה כפול.");
      else if (Math.abs(p.Zr - 1) < 0.02) say = Math.abs(p.vr - 1) < 0.02 ? tr('Same string on both sides: no boundary at all.', "אותו מיתר משני הצדדים: אין גבול בכלל.") : tr('Matched: Z₂ = Z₁, so nothing reflects, even though the speed changes (watch the width).', "מתואם: Z₂ = Z₁, ולכן שום דבר לא מוחזר, למרות שהמהירות משתנה (שימו לב לרוחב).");
      else if (p.Zr > 1) say = tr('Z₂ > Z₁: the second string is harder to shake. The reflection is inverted (R < 0) and the transmitted pulse is smaller (T < 1).', "Z₂ > Z₁: קשה יותר לנער את המיתר השני. ההחזרה הפוכה (R < 0) והפולס המועבר נמוך יותר (T < 1).");
      else say = tr('Z₂ < Z₁: the second string is easier to shake. The reflection is upright (R > 0) and the transmitted pulse is taller (T > 1), yet it carries less than all the power.', "Z₂ < Z₁: קל יותר לנער את המיתר השני. ההחזרה לא הפוכה (R > 0) והפולס המועבר גבוה יותר (T > 1), ובכל זאת הוא לא נושא את כל ההספק.");
      $('#j-say').textContent = say;
      $$('[data-preset]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === st.preset)));
      $$('[data-shape]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shape === st.shape)));
    }
    const presets = {
      wall: { mode: 'wall' }, heavy: { rhoR: 4, tenR: 1 }, same: { rhoR: 1, tenR: 1 },
      matched: { rhoR: 1 / 3, tenR: 3 }, light: { rhoR: 0.25, tenR: 1 }, free: { mode: 'free' }
    };
    function applyPreset(name) {
      const p = presets[name];
      st.preset = name;
      if (p.mode) st.mode = p.mode;
      else { st.mode = 'string'; st.rhoR = p.rhoR; st.tenR = p.tenR; rho.value = Math.log10(p.rhoR); ten.value = Math.log10(p.tenR); }
      st.t = 0; readouts();
    }
    $$('[data-preset]', box).forEach((b) => b.addEventListener('click', () => applyPreset(b.dataset.preset)));
    $$('[data-shape]', box).forEach((b) => b.addEventListener('click', () => { st.shape = b.dataset.shape; st.t = 0; readouts(); }));
    rho.addEventListener('input', () => { st.mode = 'string'; st.preset = null; st.rhoR = logSlider(rho); readouts(); });
    ten.addEventListener('input', () => { st.mode = 'string'; st.preset = null; st.tenR = logSlider(ten); readouts(); });
    $('#j-parts').addEventListener('change', (e) => { st.parts = e.target.checked; });
    $('#j-ghost').addEventListener('change', (e) => { st.ghost = e.target.checked; });
    const showPlay = playButton($('#j-play'), () => st.playing, (v) => { st.playing = v; });
    $('#j-restart').addEventListener('click', () => { st.t = 0; if (!st.playing) { st.playing = true; showPlay(); } });
    junctionAPI.setShape = (s) => { st.shape = s; st.t = 0; st.playing = true; showPlay(); readouts(); };
    junctionAPI.preset = (n) => { applyPreset(n); st.playing = true; showPlay(); };
    st.preset = 'heavy';
    rho.value = Math.log10(st.rhoR); ten.value = Math.log10(st.tenR);
    readouts();

    function draw() {
      const { ctx, w, h } = S, C = pal(), p = P();
      ctx.clearRect(0, 0, w, h);
      const pad = 18, y0 = h * 0.56, A = h * 0.2;
      const X = (x) => pad + ((x + 1) / 2) * (w - 2 * pad);
      const Y = (psi) => y0 - A * psi;
      const v2 = p.vr * v1, tt = st.t - t0;
      // axis
      line(ctx, [[X(-1), y0], [X(1), y0]], C.line, 1, [3, 4]);
      const n = Math.max(160, Math.round(w / 1.5));
      const inc = [], ref = [], tot = [], tra = [], gh1 = [], gh2 = [];
      for (let i = 0; i <= n; i++) {
        const x = -1 + i / n;              // left half
        const a = f(tt - x / v1), b = p.R * f(tt + x / v1);
        inc.push([X(x), Y(a)]); ref.push([X(x), Y(b)]); tot.push([X(x), Y(a + b)]);
        if (st.ghost) gh2.push([X(x), Y(f(tt + x / v1))]);
      }
      const totR = [];
      if (st.mode === 'string') {
        for (let i = 0; i <= n; i++) {
          const x = i / n;
          const c = p.T * f(tt - x / v2);
          tra.push([X(x), Y(c)]); totR.push([X(x), Y(c)]);
        }
      }
      if (st.ghost) for (let i = 0; i <= n; i++) { const x = i / n; gh1.push([X(x), Y(f(tt - x / v1))]); }
      // strings (thicker line = denser string)
      const lw1 = 2.6, lw2 = Math.max(1.2, Math.min(8, 2.6 * Math.pow(st.rhoR, 0.33)));
      if (st.ghost) { line(ctx, gh1, C.ghost, 1.6, [6, 5]); line(ctx, gh2, C.ghost, 1.6, [1.5, 4]); }
      line(ctx, tot, C.ink, lw1);
      if (st.mode === 'string') line(ctx, totR, C.ink, lw2);
      if (st.parts) {
        line(ctx, inc, C.inc, 1.6, [5, 4]);
        line(ctx, ref, C.r, 1.6, [5, 4]);
        if (st.mode === 'string') line(ctx, tra, C.t, 1.6, [5, 4]);
      }
      // boundary
      const yJ = Y(f(tt) * (1 + p.R));
      if (st.mode === 'wall') hatchWall(ctx, X(0), h * 0.12, h * 0.95, 1, C.muted);
      else if (st.mode === 'free') rodAndRing(ctx, X(0), h * 0.08, h * 0.98, yJ, C.muted);
      else {
        ctx.save(); ctx.fillStyle = C.bg; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(0), yJ, 4.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      // region labels
      const zr = st.mode === 'wall' ? '∞' : st.mode === 'free' ? '0' : fmt(p.Zr);
      label(ctx, tr('string 1 · impedance Z₁', "מיתר 1 · עכבה Z₁"), X(-0.5), h - 12, C.muted, { size: 12, weight: '600' });
      label(ctx, st.mode === 'wall' ? tr('wall · Z₂ = ∞', 'קיר · ' + iso('Z₂ = ∞')) : st.mode === 'free' ? tr('nothing · Z₂ = 0', 'כלום · ' + iso('Z₂ = 0')) : tr('string 2 · Z₂ = ' + zr + ' Z₁', 'מיתר 2 · ' + iso('Z₂ = ' + zr + ' Z₁')), X(0.5), h - 12, C.muted, { size: 12, weight: '600' });
      // pulse labels follow the peaks
      const xi = v1 * tt, xr = -v1 * tt, xt = v2 * tt;
      const top = h * 0.1;
      const narrow = w < 560, gap = narrow ? 0.4 : 0.15;
      if (xi > -0.98 && xi < -0.06) label(ctx, tr('incident →', "→ הגל הפוגע"), X(xi), top, C.inc, { halo: true });
      if (tt > 0.15 && xr > -0.95 && xr < -gap && Math.abs(p.R) > 0.02) label(ctx, narrow ? '← R×' + fmt(p.R) : tr('← reflected ×' + fmt(p.R), 'הגל המוחזר ' + iso('×' + fmt(p.R)) + ' ←'), X(xr), top, C.r, { halo: true });
      if (st.mode === 'string' && tt > 0.15 && xt < 0.92 && p.T > 0.02) label(ctx, narrow ? 'T×' + fmt(p.T) + ' →' : tr('transmitted ×' + fmt(p.T) + ' →', '→ הגל המועבר ' + iso('×' + fmt(p.T))), X(Math.max(narrow ? 0.3 : 0.16, xt)), narrow ? top + 16 : top, C.t, { halo: true });
      if (st.mode === 'free' && tt > -0.25 && tt < 0.25) label(ctx, tr('end swings to 2×', "הקצה מגיע לגובה כפול"), X(0.17), top, C.muted, { halo: true, size: 11 });
    }
    addWidget(box, (dt) => {
      if (st.playing) {
        st.t += dt;
        if (st.t > t0 + 1 / v1 + 0.7) st.t = 0;
      }
      draw();
    });
  }

  /* ============ 2. Force balance on the massless junction (L07 p.2-3, L08 p.1) ============ */
  function initBalance() {
    const box = $('#sim-balance');
    const S = setupCanvas($('canvas', box), (w) => Math.max(200, Math.min(260, w * 0.36)));
    const s2 = $('#b-slope'), t2 = $('#b-ten');
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const slope1 = 0.35, slope2 = parseFloat(s2.value), T1 = 1, T2 = logSlider(t2);
      $('#b-slope-out').textContent = fmt(slope2);
      $('#b-ten-out').textContent = '× ' + fmt(T2);
      const cx = w / 2, cy = h * 0.55, L = Math.min(w * 0.42, 260);
      // strings
      const a1 = Math.atan(slope1), a2 = Math.atan(slope2);
      const lx = cx - L * Math.cos(a1), ly = cy + L * Math.sin(a1); // left string goes down-left for positive slope
      const L2 = Math.min(L, (Math.abs(Math.sin(a2)) > 1e-3 ? (a2 > 0 ? cy - 40 : h - 22 - cy) / Math.abs(Math.sin(a2)) : L));
      const rx = cx + L2 * Math.cos(a2), ry = cy - L2 * Math.sin(a2);
      line(ctx, [[lx, ly], [cx, cy]], C.ink, 2.6);
      line(ctx, [[cx, cy], [rx, ry]], C.ink, 2.6 + 1.2 * Math.log10(T2 + 1));
      // vertical pulls: left string pulls down-left: F_y,left = -T1 sin a1; right pulls up-right: +T2 sin a2
      // small slopes, as in the lecture: vertical pull = tension x slope
      const F1 = -T1 * slope1, F2 = T2 * slope2, net = F1 + F2;
      const k = h * 0.4, cl = (d) => Math.max(-h * 0.36, Math.min(h * 0.36, d));
      arrow(ctx, cx - 16, cy, cx - 16, cy - cl(k * F1), C.ten, 2.5);
      arrow(ctx, cx + 16, cy, cx + 16, cy - cl(k * F2), C.ten, 2.5);
      label(ctx, tr('pull of string 1', "משיכת מיתר 1"), cx - 22, cy - cl(k * F1) + (F1 < 0 ? 12 : -12), C.ten, { align: 'right', size: 11, halo: true });
      label(ctx, tr('pull of string 2', "משיכת מיתר 2"), cx + 22, cy - cl(k * F2) + (F2 < 0 ? 12 : -12), C.ten, { align: 'left', size: 11, halo: true });
      ctx.save(); ctx.fillStyle = C.bg; ctx.strokeStyle = C.ink; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(cx, cy, 6, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      const ok = Math.abs(net) < 0.02;
      if (!ok) arrow(ctx, cx, cy - 10 * Math.sign(net), cx, cy - 10 * Math.sign(net) - cl(k * 1.2 * net), C.r, 3.5);
      label(ctx, ok ? tr('net force 0: balanced', "כוח שקול 0: מאוזן") : tr('net force on a massless point: impossible', "כוח שקול על נקודה חסרת מסה: בלתי אפשרי"), cx, 16, ok ? C.t : C.r, { size: 13, weight: '700', halo: true });
      label(ctx, tr('string 1 (tension T₁, slope 0.35)', "מיתר 1 (מתיחות T₁, שיפוע 0.35)"), lx + 6, ly + 14, C.muted, { align: 'left', size: 11, halo: true });
      label(ctx, tr('string 2 (tension T₂)', "מיתר 2 (מתיחות T₂)"), rx + 4, ry + (a2 > 0 ? 18 : -14), C.muted, { align: 'right', size: 11, halo: true });
      $('#b-say').textContent = ok
        ? (Math.abs(T2 - 1) < 0.02
          ? tr('Equal tensions: balance means equal slopes. That is L07\'s rule, ∂ψ/∂x continuous.', 'מתיחויות שוות: איזון פירושו שיפועים שווים. זה הכלל של הרצאה 07: ‎∂ψ/∂x‎ רציף.')
          : tr('Different tensions: balance needs T₁·slope₁ = T₂·slope₂, so the slopes differ. That is L08\'s rule.', 'מתיחויות שונות: האיזון דורש T₁·שיפוע₁ = T₂·שיפוע₂, ולכן השיפועים שונים. זה הכלל של הרצאה 08.'))
        : tr('Change the slope until the red arrow vanishes. Needed: slope₂ = T₁·0.35 / T₂ = ' + fmt(0.35 / T2) + '.', 'שנו את השיפוע עד שהחץ האדום נעלם. נדרש: שיפוע₂ = T₁·0.35 / T₂ = ' + fmt(0.35 / T2) + '.');
    }
    s2.addEventListener('input', draw); t2.addEventListener('input', draw);
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe($('canvas', box));
    draw();
    const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
  }

  /* ============ 3. Shake the end: string vs damper (L08 p.2-3, Crawford 4.4) ============ */
  function initShake() {
    const box = $('#sim-shake');
    const cv = $('canvas', box);
    const S = setupCanvas(cv, (w) => Math.max(300, Math.min(380, w * 0.5)));
    const tSl = $('#s-ten'), rSl = $('#s-rho');
    const st = { t: 0, y: 0, yv: 0, drag: false, target: 0, hist: [], fHist: [], playing: !reduceMotion };
    const SLOW = 100;            // slow motion factor
    const SPAN = 1.0;            // metres of string on screen
    function params() {
      const T = parseFloat(tSl.value), rho = parseFloat(rSl.value) / 1000; // N, kg/m
      const v = Math.sqrt(T / rho), Z = Math.sqrt(T * rho);
      return { T, rho, v, Z, vs: v / SLOW };
    }
    function readouts() {
      const p = params();
      $('#s-ten-out').textContent = p.T.toFixed(0) + ' N';
      $('#s-rho-out').textContent = (p.rho * 1000).toFixed(0) + ' g/m';
      $('#s-v').textContent = p.v.toFixed(0) + ' m/s';
      $('#s-Z').textContent = p.Z.toFixed(3) + ' kg/s';
    }
    tSl.addEventListener('input', readouts); rSl.addEventListener('input', readouts); readouts();
    const showPlay = playButton($('#s-play'), () => st.playing, (v) => { st.playing = v; });
    const AMP = 0.02; // a full half-lane = 2 cm of real displacement
    function yAt(tq) { // driver height at an earlier time (interpolated history)
      const H = st.hist;
      if (!H.length || tq <= H[0][0]) return 0;
      for (let i = H.length - 1; i > 0; i--) {
        if (H[i - 1][0] <= tq) {
          const [ta, ya] = H[i - 1], [tb, yb] = H[i];
          return ya + ((yb - ya) * (tq - ta)) / Math.max(1e-6, tb - ta);
        }
      }
      return 0;
    }
    function geom() {
      const { w, h } = S;
      return { x0: 64, x1: w - 14, lane1: h * 0.2, lane2: h * 0.56, amp: h * 0.09 };
    }
    function pointerY(e) {
      const r = cv.getBoundingClientRect(), g = geom();
      const y = e.clientY - r.top;
      return Math.max(-1, Math.min(1, (st.lane - y) / g.amp));
    }
    cv.addEventListener('pointerdown', (e) => {
      const g = geom(), y = e.clientY - cv.getBoundingClientRect().top;
      st.lane = y < (g.lane1 + g.lane2) / 2 ? g.lane1 : g.lane2; // pick the lane once per drag
      st.drag = true; cv.setPointerCapture(e.pointerId); st.target = pointerY(e);
      if (!st.playing) { st.playing = true; showPlay(); }
    });
    cv.addEventListener('pointermove', (e) => { if (st.drag) st.target = pointerY(e); });
    const end = () => { st.drag = false; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    function step(dt) {
      st.t += dt;
      let y;
      if (st.drag) y = st.y + (st.target - st.y) * Math.min(1, dt * 14);
      else {
        // auto: a few pulses then a sine, so both shapes are seen
        const tc = st.t % 9;
        y = tc < 4 ? 0.85 * Math.exp(-((((tc % 2) - 0.6) / 0.18) ** 2)) * (tc < 2 ? 1 : -1) : 0.7 * Math.sin(TAU * 0.6 * (tc - 4)) * Math.min(1, (tc - 4) / 0.6) * Math.min(1, (9 - tc) / 0.6);
      }
      st.yv = dt > 0 ? (y - st.y) / dt : 0;
      st.y = y;
      st.hist.push([st.t, y]);
      const p = params();
      const keep = SPAN / p.vs + 1;
      while (st.hist.length > 2 && st.hist[1][0] < st.t - keep) st.hist.shift();
      // force from the string's own slope at the end vs the damper force
      const dx = 0.004; // metres
      const slope = (AMP * (yAt(st.t - dx / p.vs) - y)) / dx; // dpsi/dx at x = 0 (real units)
      const vyReal = AMP * st.yv * SLOW;                      // m/s
      const Fstring = p.T * slope;                            // F_y of the string on the hand
      const Fdamp = -p.Z * vyReal;
      st.fHist.push([st.t, Fstring, Fdamp]);
      while (st.fHist.length > 2 && st.fHist[0][0] < st.t - 4) st.fHist.shift();
      st.last = { Fstring, Fdamp, vyReal, p };
    }
    function draw() {
      const { ctx, w, h } = S, C = pal(), g = geom();
      ctx.clearRect(0, 0, w, h);
      const p = params();
      const L = st.last || { Fstring: 0, Fdamp: 0, vyReal: 0, p };
      // lane 1: the string
      line(ctx, [[g.x0, g.lane1], [g.x1, g.lane1]], C.line, 1, [3, 4]);
      const pts = [];
      const n = 220;
      for (let i = 0; i <= n; i++) {
        const xm = (i / n) * SPAN, px = g.x0 + (i / n) * (g.x1 - g.x0);
        pts.push([px, g.lane1 - g.amp * yAt(st.t - xm / p.vs)]);
      }
      pts[0] = [g.x0, g.lane1 - g.amp * st.y];
      line(ctx, pts, C.ink, 2.4);
      // lane 2: a damper under the hand
      const hy2 = g.lane2 - g.amp * st.y;
      // rigid rod: the piston moves exactly with the hand inside a fixed oil cylinder
      const cylTop = g.lane2 + g.amp + 9, cylBot = g.lane2 + 3 * g.amp + 22;
      ctx.save(); ctx.strokeStyle = C.muted; ctx.lineWidth = 2;
      ctx.fillStyle = C.soft; ctx.fillRect(g.x0 - 13, cylTop, 26, cylBot - cylTop);
      ctx.beginPath(); ctx.moveTo(g.x0 - 13, cylTop); ctx.lineTo(g.x0 - 13, cylBot); ctx.lineTo(g.x0 + 13, cylBot); ctx.lineTo(g.x0 + 13, cylTop); ctx.stroke();
      ctx.restore();
      const pistonY = hy2 + 2 * g.amp + 15;
      line(ctx, [[g.x0, hy2], [g.x0, pistonY]], C.ink, 2.4);
      line(ctx, [[g.x0 - 11, pistonY], [g.x0 + 11, pistonY]], C.ink, 3.4);
      label(ctx, tr('damper in oil: F = −Z·v_y', 'בולם בשמן: ' + iso('F = −Z·v_y')), g.x0 + 22, (cylTop + cylBot) / 2, C.muted, { align: 'left', size: 11 });
      // hands
      for (const [yy, lane] of [[g.lane1 - g.amp * st.y, g.lane1], [hy2, g.lane2]]) {
        ctx.save(); ctx.fillStyle = C.z; ctx.globalAlpha = 0.18; ctx.fillRect(g.x0 - 16, lane - g.amp - 6, 32, 2 * g.amp + 12); ctx.restore();
        ctx.save(); ctx.fillStyle = C.ink; ctx.fillRect(g.x0 - 9, yy - 6, 18, 12); ctx.restore();
      }
      // arrows: velocity of the hand and the force back on it (same in both lanes)
      const VREF = 9, FREF = 2.6; // m/s and N that draw as one lane-amplitude
      const vScale = g.amp, fScale = g.amp;
      const clamp = (x) => Math.max(-1.6, Math.min(1.6, x));
      for (const [yy] of [[g.lane1 - g.amp * st.y], [hy2]]) {
        arrow(ctx, g.x0 - 26, yy, g.x0 - 26, yy - vScale * clamp(L.vyReal / VREF), C.vy, 2.4);
      }
      const fs = clamp(L.Fstring / FREF) * fScale, fd = clamp(L.Fdamp / FREF) * fScale;
      arrow(ctx, g.x0 + 24, g.lane1 - g.amp * st.y, g.x0 + 24, g.lane1 - g.amp * st.y - fs, C.z, 2.6);
      arrow(ctx, g.x0 + 24, hy2, g.x0 + 24, hy2 - fd, C.z, 2.6);
      label(ctx, tr('drag here', "גררו כאן"), g.x0, 12, C.muted, { size: 11 });
      label(ctx, tr('string (slow motion ×100) →', "→ מיתר (הילוך איטי פי 100)"), g.x0 + 40, g.lane1 - g.amp - 2, C.muted, { align: 'left', size: 11, halo: true });
      // force traces, right side of lane 2
      const px0 = Math.max(g.x0 + 150, w * 0.42), px1 = w - 14, py = g.lane2 - 4, ph = g.amp * 1.1;
      if (px1 - px0 > 120) {
        line(ctx, [[px0, py], [px1, py]], C.line, 1);
        label(ctx, tr('force on the hand, last 4 s', "הכוח על היד, 4 השניות האחרונות"), px0, py - ph * 1.3 - 12, C.muted, { align: 'left', size: 11 });
        const H = st.fHist, a = [], b = [];
        for (const [tq, F1, F2] of H) {
          const x = px1 - ((st.t - tq) / 4) * (px1 - px0);
          a.push([x, py - ph * Math.max(-1.3, Math.min(1.3, F1 / FREF))]);
          b.push([x, py - ph * Math.max(-1.3, Math.min(1.3, F2 / FREF))]);
        }
        line(ctx, a, C.z, 3.2);
        line(ctx, b, C.ink, 1.4, [4, 3]);
        label(ctx, tr('— from the string\'s slope', "— משיפוע המיתר"), px1, py + ph * 1.3 + 12, C.z, { align: 'right', size: 11 });
        label(ctx, tr('- - from the damper', "- - מהבולם"), px1, py + ph * 1.3 + 26, C.muted, { align: 'right', size: 11 });
      }
      const nz = (x, d) => (Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x).toFixed(d).replace('-', '−');
      $('#s-vy').textContent = nz(L.vyReal, 2) + ' m/s';
      $('#s-F').textContent = nz(L.Fstring, 3) + ' N';
      $('#s-Fd').textContent = nz(L.Fdamp, 3) + ' N';
    }
    if (!st.playing) { for (let i = 0; i < 120; i++) step(1 / 60); }
    addWidget(box, (dt) => { if (st.playing) step(dt); draw(); });
  }

  /* ============ 4. R, T, R_E, T_E against Z2/Z1 (L08 p.2-4, L09 p.4-5) ============ */
  function initCurves() {
    const box = $('#sim-curves');
    const cv = $('canvas', box);
    const S = setupCanvas(cv, (w) => Math.max(240, Math.min(320, w * 0.45)));
    const sl = $('#c-zr');
    const st = { lr: parseFloat(sl.value) };
    const lmin = -2, lmax = 2, ymin = -1.1, ymax = 2.15;
    function geom() { const { w, h } = S; return { l: 44, r: w - 14, t: 14, b: h - 34 }; }
    const XL = (lr, g) => g.l + ((lr - lmin) / (lmax - lmin)) * (g.r - g.l);
    const YV = (v, g) => g.b - ((v - ymin) / (ymax - ymin)) * (g.b - g.t);
    function vals(r) { const R = (1 - r) / (1 + r), T = 2 / (1 + r); return { R, T, RE: R * R, TE: r * T * T }; }
    function draw() {
      const { ctx, w, h } = S, C = pal(), g = geom();
      ctx.clearRect(0, 0, w, h);
      // grid
      for (const v of [-1, 0, 1, 2]) {
        line(ctx, [[g.l, YV(v, g)], [g.r, YV(v, g)]], v === 0 ? C.muted : C.line, 1, v === 0 ? null : [2, 4]);
        label(ctx, String(v).replace('-', '−'), g.l - 8, YV(v, g), C.muted, { align: 'right', size: 11, mono: true });
      }
      for (const [lr, txt] of [[-2, '0.01'], [-1, '0.1'], [0, '1'], [1, '10'], [2, '100']]) {
        line(ctx, [[XL(lr, g), g.t], [XL(lr, g), g.b]], C.line, 1, [2, 4]);
        label(ctx, txt, XL(lr, g), g.b + 13, C.muted, { size: 11, mono: true });
      }
      label(ctx, tr('Z₂ / Z₁ (log scale)', iso('Z₂ / Z₁') + ' (סקלה לוגריתמית)'), (g.l + g.r) / 2, h - 7, C.muted, { size: 11 });
      // shade matched line
      line(ctx, [[XL(0, g), g.t], [XL(0, g), g.b]], C.t, 1.5, [6, 4]);
      label(ctx, tr('matched', "מתואם"), XL(0, g) + 5, g.t + 8, C.t, { align: 'left', size: 11 });
      const n = 240, cR = [], cT = [], cRE = [], cTE = [];
      for (let i = 0; i <= n; i++) {
        const lr = lmin + (i / n) * (lmax - lmin), v = vals(Math.pow(10, lr)), x = XL(lr, g);
        cR.push([x, YV(v.R, g)]); cT.push([x, YV(v.T, g)]); cRE.push([x, YV(v.RE, g)]); cTE.push([x, YV(v.TE, g)]);
      }
      line(ctx, cRE, C.r, 2.4, [6, 4]); line(ctx, cTE, C.t, 2.4, [6, 4]);
      line(ctx, cR, C.r, 2.6); line(ctx, cT, C.t, 2.6);
      // end labels
      label(ctx, 'T → 2', XL(-1.75, g), YV(1.86, g) - 10, C.t, { size: 11, halo: true });
      label(ctx, 'R → +1', XL(-1.75, g), YV(0.95, g) - 12, C.r, { size: 11, halo: true });
      label(ctx, 'R → −1', XL(1.7, g), YV(-0.95, g) + 12, C.r, { size: 11, halo: true });
      // marker
      const r = Math.pow(10, st.lr), v = vals(r), x = XL(st.lr, g);
      line(ctx, [[x, g.t], [x, g.b]], C.ink, 1.5);
      for (const [val, col] of [[v.R, C.r], [v.T, C.t], [v.RE, C.r], [v.TE, C.t]]) {
        ctx.save(); ctx.fillStyle = C.bg; ctx.strokeStyle = col; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.arc(x, YV(val, g), 4.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      $('#c-zr-out').textContent = fmt(r);
      $('#c-R').textContent = fmt(v.R); $('#c-T').textContent = fmt(v.T);
      $('#c-RE').textContent = pct(v.RE); $('#c-TE').textContent = pct(v.TE);
      let say;
      if (Math.abs(st.lr) < 0.02) say = tr('Matched. R = 0, T = 1, and all of the power goes through.', "מתואם. R = 0, T = 1, וכל ההספק עובר.");
      else if (st.lr < 0) say = tr('The transmitted wave is taller than the incident one (T = ' + fmt(v.T) + '), yet it carries only ' + pct(v.TE) + ' of the power. Low impedance means a weak push on the junction.',
        'הגל המועבר גבוה מהגל הפוגע (T = ' + fmt(v.T) + '), ובכל זאת הוא נושא רק ' + pct(v.TE) + ' מההספק. עכבה נמוכה פירושה דחיפה חלשה על נקודת החיבור.');
      else say = tr('The second string barely moves (T = ' + fmt(v.T) + ') and the reflection is inverted. ' + pct(v.RE) + ' of the power bounces back.',
        'המיתר השני כמעט לא זז (T = ' + fmt(v.T) + ') וההחזרה הפוכה. ' + pct(v.RE) + ' מההספק חוזרים.');
      $('#c-say').textContent = say;
    }
    sl.addEventListener('input', () => { st.lr = parseFloat(sl.value); draw(); });
    let dragging = false;
    function fromPointer(e) {
      const r = cv.getBoundingClientRect(), g = geom();
      const lr = lmin + ((e.clientX - r.left - g.l) / (g.r - g.l)) * (lmax - lmin);
      st.lr = Math.max(lmin, Math.min(lmax, Math.round(lr * 100) / 100));
      if (Math.abs(st.lr) < 0.04) st.lr = 0;
      sl.value = st.lr; draw();
    }
    cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); fromPointer(e); });
    cv.addEventListener('pointermove', (e) => { if (dragging) fromPointer(e); });
    cv.addEventListener('pointerup', () => { dragging = false; });
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(cv);
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
    draw();
  }

  /* ============ 5. Load matching in a circuit (L08 p.4-5) ============ */
  function initCircuit() {
    const box = $('#sim-circuit');
    const cv = $('canvas', box);
    const S = setupCanvas(cv, (w) => Math.max(190, Math.min(240, w * 0.38)));
    const sl = $('#k-rl');
    const lmin = -1.3, lmax = 1.3;
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const g = { l: 40, r: w - 14, t: 16, b: h - 32 };
      const X = (lr) => g.l + ((lr - lmin) / (lmax - lmin)) * (g.r - g.l), Y = (v) => g.b - v * (g.b - g.t);
      for (const v of [0, 0.5, 1]) { line(ctx, [[g.l, Y(v)], [g.r, Y(v)]], C.line, 1, [2, 4]); label(ctx, String(v), g.l - 8, Y(v), C.muted, { align: 'right', size: 11, mono: true }); }
      for (const [lr, t] of [[-1, '0.1'], [0, '1'], [1, '10']]) label(ctx, t, X(lr), g.b + 13, C.muted, { size: 11, mono: true });
      label(ctx, tr('R_L / R_S (log scale)', iso('R_L / R_S') + ' (סקלה לוגריתמית)'), (g.l + g.r) / 2, h - 6, C.muted, { size: 11 });
      const pts = [];
      for (let i = 0; i <= 200; i++) { const lr = lmin + (i / 200) * (lmax - lmin), x = Math.pow(10, lr); pts.push([X(lr), Y((4 * x) / ((1 + x) ** 2))]); }
      line(ctx, pts, C.z, 2.6);
      const lr = parseFloat(sl.value), x = Math.pow(10, lr), P = (4 * x) / ((1 + x) ** 2);
      line(ctx, [[X(lr), g.t], [X(lr), g.b]], C.ink, 1.4);
      ctx.save(); ctx.fillStyle = C.bg; ctx.strokeStyle = C.z; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(X(lr), Y(P), 5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      label(ctx, tr('power into the load ÷ its maximum', "ההספק בעומס ÷ ההספק המרבי"), g.l + 4, g.t - 4, C.muted, { align: 'left', size: 11 });
      $('#k-rl-out').textContent = fmt(x);
      $('#k-P').textContent = pct(P);
    }
    sl.addEventListener('input', draw);
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(cv);
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
    draw();
  }

  /* ============ 6. Horn / taper, numerical (L08 p.6) ============ */
  function initTaper() {
    const box = $('#sim-taper');
    if (!window.FDString) throw new Error('fd-core.js missing');
    const cv = $('canvas', box);
    const S = setupCanvas(cv, (w) => Math.max(250, Math.min(320, w * 0.46)));
    const sl = $('#h-len');
    // 1 extra unit of string on the left (off screen), so the echo's bounce off the far end
    // cannot come back into view before the loop restarts at t = 2.1
    const base = { N: 2601, L: 2.6, v1: 1, ratioZ: 3, xJ: 1.85, x0: 1.55, sigma: 0.05, lambda: 0.06 };
    const st = { playing: !reduceMotion, sims: null, meas: null };
    function build() {
      const lt = parseFloat(sl.value);
      $('#h-len-out').textContent = lt.toFixed(2) + ' λ';
      st.sims = [window.FDString.create({ ...base, taper: 0 }), window.FDString.create({ ...base, taper: lt * base.lambda })];
      st.E0 = st.sims.map((s) => s.energy(0, base.L));
      st.meas = [null, null];
    }
    function measure() {
      st.sims.forEach((s, i) => {
        if (st.meas[i] == null && s.t >= 1.5) st.meas[i] = s.energy(0, base.xJ) / st.E0[i];
      });
      $('#h-abrupt').textContent = st.meas[0] == null ? tr('measuring…', "מודד…") : pct(st.meas[0]);
      $('#h-taper').textContent = st.meas[1] == null ? tr('measuring…', "מודד…") : pct(st.meas[1]);
    }
    sl.addEventListener('input', () => { build(); if (!st.playing) runToRest(); });
    const showPlay = playButton($('#h-play'), () => st.playing, (v) => { st.playing = v; });
    $('#h-restart').addEventListener('click', () => { build(); st.playing = true; showPlay(); });
    function runToRest() { st.sims.forEach((s) => s.step(Math.round(1.5 / s.dt))); measure(); }
    build();
    if (!st.playing) runToRest();
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const xa = 1.3, xb = 2.55; // visible window
      const X = (x) => 12 + ((x - xa) / (xb - xa)) * (w - 24);
      const lanes = [h * 0.28, h * 0.74], A = h * 0.13;
      st.sims.forEach((s, li) => {
        const yc = lanes[li], psi = s.psi();
        // impedance profile as a shaded band
        const lnr = Math.log(base.ratioZ);
        ctx.save(); ctx.fillStyle = C.z; ctx.globalAlpha = 0.13; ctx.beginPath();
        ctx.moveTo(X(xa), yc + A * 1.25);
        for (let x = xa; x <= xb; x += 0.005) {
          const j = Math.round(x / s.dx), Zrel = Math.log(Math.sqrt(s.rho[j])) / lnr; // 0 -> 1
          ctx.lineTo(X(x), yc + A * 1.25 - Zrel * A * 0.55);
        }
        ctx.lineTo(X(xb), yc + A * 1.25); ctx.closePath(); ctx.fill(); ctx.restore();
        const pts = [];
        const j0 = Math.floor(xa / s.dx), j1 = Math.ceil(xb / s.dx), stepJ = Math.max(1, Math.floor((j1 - j0) / (w * 1.5)));
        for (let j = j0; j <= j1; j += stepJ) pts.push([X(j * s.dx), yc - A * psi[j]]);
        line(ctx, pts, C.ink, 1.8);
        label(ctx, li === 0 ? tr('abrupt step, Z jumps ×3', "מדרגה חדה: Z קופץ פי 3") : tr('gradual change (horn), same total ×3', "שינוי הדרגתי (מגהפון), סך הכול פי 3"), X(xa) + 2, yc - A * 1.55, C.muted, { align: 'left', size: 12 });
        label(ctx, tr('Z (shaded)', "Z (מוצלל)"), X(xb) - 2, yc + A * 1.05, C.z, { align: 'right', size: 11 });
      });
    }
    addWidget(box, (dt) => {
      if (st.playing) {
        const s0 = st.sims[0];
        const n = Math.max(1, Math.round((dt * 0.32) / s0.dt));
        st.sims.forEach((s) => s.step(n));
        measure();
        if (s0.t > 2.1) build();
      }
      draw();
    });
  }

  /* ============ 7. Energy: travelling vs standing (L09 p.1-4, L10 p.5) ============ */
  function initEnergy() {
    const box = $('#sim-energy');
    const S = setupCanvas($('canvas', box), (w) => Math.max(300, Math.min(360, w * 0.52)));
    const st = { kind: 'travel', t: 0, playing: !reduceMotion };
    if (!st.playing) st.t = 0.3;
    $$('[data-ekind]', box).forEach((b) => b.addEventListener('click', () => { st.kind = b.dataset.ekind; upd(); }));
    function upd() {
      $$('[data-ekind]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ekind === st.kind)));
      $('#e-avg').textContent = st.kind === 'travel' ? tr('½ Z ω² A² > 0 (to the right)', iso('½ Z ω² A² > 0') + ' (ימינה)') : '0';
      $('#e-say').textContent = st.kind === 'travel'
        ? tr('Travelling wave: the kinetic and potential curves lie on top of each other and ride along with the wave. Energy flows at speed v: P = v·ℰ.', "גל מתקדם: עקומת האנרגיה הקינטית ועקומת הפוטנציאלית מונחות זו על זו ונעות יחד עם הגל. האנרגיה זורמת במהירות v: ‏P = v·ℰ.")
        : tr('Standing wave: the two energies take turns. When the string is flat it is all kinetic (at the antinodes); at full stretch it is all potential (near the nodes). Energy sloshes back and forth but never crosses a node, so the average power is zero.', "גל עומד: שתי האנרגיות מתחלפות. כשהמיתר ישר הכול קינטי (בבטנים); במתיחה המרבית הכול פוטנציאלי (ליד הצמתים). האנרגיה נעה הלוך ושוב אבל אף פעם לא חוצה צומת, ולכן ההספק הממוצע הוא אפס.");
    }
    upd();
    playButton($('#e-play'), () => st.playing, (v) => { st.playing = v; });
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const l = 14, r = w - 14, k = TAU * 1.5, om = TAU * 0.4; // units with T = rho = v = 1 (so omega = k for drawing)
      const yS = h * 0.2, aS = h * 0.13, yE = h * 0.66, aE = h * 0.28, yP = h * 0.9, aP = h * 0.07;
      const X = (u) => l + u * (r - l);
      const n = 260, str = [], K = [], U = [], Pw = [];
      let maxE = 0;
      const kk = k, ww = kk; // omega = v k with v = 1 for the energy formulas
      for (let i = 0; i <= n; i++) {
        const u = i / n, x = u;
        let psi, pt, px;
        if (st.kind === 'travel') { const ph = om * st.t * 2.5 - kk * x; psi = Math.cos(ph); pt = -ww * Math.sin(ph); px = kk * Math.sin(ph); }
        else { psi = Math.sin(om * st.t * 2.5) * Math.sin(kk * x); pt = ww * Math.cos(om * st.t * 2.5) * Math.sin(kk * x); px = kk * Math.sin(om * st.t * 2.5) * Math.cos(kk * x); }
        const ek = 0.5 * pt * pt, ep = 0.5 * px * px; // rho = T = 1
        str.push([X(u), yS - aS * psi]); K.push([X(u), ek]); U.push([X(u), ep]); Pw.push([X(u), -px * pt]);
        maxE = Math.max(maxE, ek, ep);
      }
      const norm = 0.5 * ww * ww; // largest single energy density
      line(ctx, [[l, yS], [r, yS]], C.line, 1, [3, 4]);
      line(ctx, str, C.ink, 2.4);
      label(ctx, st.kind === 'travel' ? tr('string: travelling wave →', "→ מיתר: גל מתקדם") : tr('string: standing wave (nodes fixed)', "מיתר: גל עומד (הצמתים קבועים)"), l, yS - aS - 12, C.muted, { align: 'left', size: 12 });
      // energy densities
      const fillArea = (arr, col, alpha) => {
        ctx.save(); ctx.fillStyle = col; ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(arr[0][0], yE);
        for (const [x, e] of arr) ctx.lineTo(x, yE - aE * (e / norm));
        ctx.lineTo(arr[arr.length - 1][0], yE); ctx.closePath(); ctx.fill(); ctx.restore();
      };
      line(ctx, [[l, yE], [r, yE]], C.line, 1);
      fillArea(K, C.vy, 0.32); fillArea(U, C.ten, 0.32);
      line(ctx, K.map(([x, e]) => [x, yE - aE * (e / norm)]), C.vy, 2);
      line(ctx, U.map(([x, e]) => [x, yE - aE * (e / norm)]), C.ten, 2, [5, 3]);
      label(ctx, tr('kinetic ½ρ(∂ₜψ)²', 'קינטית ' + iso('½ρ(∂ₜψ)²')), l, yE - aE - 10, C.vy, { align: 'left', size: 12 });
      label(ctx, tr('potential ½T(∂ₓψ)²  (dashed)', 'פוטנציאלית ' + iso('½T(∂ₓψ)²') + ' (מקווקו)'), l + 150, yE - aE - 10, C.ten, { align: 'left', size: 12 });
      // power
      line(ctx, [[l, yP], [r, yP]], C.line, 1);
      line(ctx, Pw.map(([x, p]) => [x, yP - aP * (p / (ww * kk))]), C.z, 2);
      label(ctx, tr('power P = −T ∂ₓψ ∂ₜψ', 'הספק ' + iso('P = −T ∂ₓψ ∂ₜψ')), r, yP - aP - 8, C.z, { align: 'right', size: 12 });
    }
    addWidget(box, (dt) => { if (st.playing) st.t += dt; draw(); });
  }

  /* ============ 7b. Why a wall gives a standing wave (recitation 6, Example 1) ============
     String on x < 0, wall at x = 0. psi_i = sin k(x - vt) moves right; the echo is
     R psi_i(-x,t) with R = -1, i.e. sin k(x + vt), moving left. Sum = 2 sin kx cos kvt.
     Three lanes (incident + reflected = sum) so the addition is visible point by point.
     "Build-up" sends a wave train whose front starts at x0 and shows the pattern appear
     only where the echo has already come back. */
  function initWallSum() {
    const box = $('#sim-wallsum');
    const S = setupCanvas($('canvas', box), (w) => Math.max(330, Math.min(430, w * 0.55)));
    const lam = 0.4, k = TAU / lam, v = lam / 3; // one period takes 3 s
    const x0 = -1;                                 // left edge of the drawn string (2.5 wavelengths)
    const u0 = -lam;                               // build-up: the train's front starts one wavelength from the wall; sin(k*u0) = 0, so no jump
    const st = { mode: 'steady', t: 0, playing: !reduceMotion, env: true };
    if (!st.playing) st.t = 0.35;
    // incident profile f(u), u = x - vt. Steady: an endless sine. Build-up: zero ahead of the front u = x0.
    const f = (u) => (st.mode === 'build' && u > u0 ? 0 : Math.sin(k * u));
    const inc = (x, t) => f(x - v * t);
    const ref = (x, t) => -f(-x - v * t); // R * psi_i(-x, t), R = -1
    const showPlay = playButton($('#ws-play'), () => st.playing, (p) => { st.playing = p; });
    function setMode(m) {
      st.mode = m; st.t = 0;
      $$('[data-wsmode]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wsmode === m)));
      if (m === 'build') { st.playing = true; showPlay(); }
    }
    $$('[data-wsmode]', box).forEach((b) => b.addEventListener('click', () => setMode(b.dataset.wsmode)));
    $$('[data-wsfreeze]', box).forEach((b) => b.addEventListener('click', () => {
      if (st.mode !== 'steady') setMode('steady');
      st.t = (parseFloat(b.dataset.wsfreeze) * Math.PI) / (k * v); // kvt = the button's value
      st.playing = false; showPlay();
    }));
    $('#ws-env').addEventListener('change', (e) => { st.env = e.target.checked; });
    setMode('steady');
    function readouts() {
      const ph = (k * v * st.t) % TAU;
      $('#ws-ph').textContent = (ph / Math.PI).toFixed(2) + ' π';
      $('#ws-cos').textContent = fmt(2 * Math.cos(k * v * st.t));
      const w0 = inc(0, st.t) + ref(0, st.t);
      $('#ws-wall').textContent = fmt(Math.abs(w0) < 5e-13 ? 0 : w0, 3);
      let say;
      if (st.mode === 'build') {
        const echo = -(v * st.t + u0); // echo front: the reflected train is nonzero for x > echo
        if (v * st.t + u0 < 0) say = tr('The train has not reached the wall yet: there is no echo, and the string carries a plain travelling wave.', 'הרכבת עוד לא הגיעה לקיר: אין הד, והמיתר נושא גל מתקדם רגיל.');
        else if (echo > x0) say = tr('The echo is on its way back. Right of the orange line the two waves overlap and the string stands still at the nodes. Left of it the string still carries the plain travelling wave.', 'ההד בדרך חזרה. מימין לקו הכתום שני הגלים חופפים, והמיתר עומד במקום בצמתים. משמאל לו המיתר עדיין נושא גל מתקדם רגיל.');
        else say = tr('The echo has covered the whole string: everywhere is now the standing wave 2 sin kx cos kvt.', 'ההד כיסה את כל המיתר: עכשיו בכל מקום יש את הגל העומד ‎2 sin kx cos kvt‎.');
      } else {
        const c = Math.cos(k * v * st.t);
        if (Math.abs(c) > 0.985) say = tr('kvt ≈ 0 or π: the crests of the two waves line up, so the sum is twice as tall. Every point is at its largest swing at the same moment.', 'kvt ≈ 0 או π: הפסגות של שני הגלים מתיישרות, ולכן הסכום גבוה פי שניים. כל הנקודות בשיא התנודה שלהן באותו רגע.');
        else if (Math.abs(c) < 0.03) say = tr('kvt = π/2: the two waves are exactly opposite at every x, so the string is flat for an instant. It is still moving: all of its energy is kinetic now.', 'kvt = π/2: שני הגלים הפוכים בדיוק בכל x, ולכן המיתר ישר לרגע. הוא עדיין בתנועה: כל האנרגיה שלו עכשיו קינטית.');
        else say = tr('The blue and red waves slide in opposite directions, but their sum (black) never moves sideways. It only grows and shrinks, by the factor cos kvt.', 'הגל הכחול והגל האדום מחליקים לכיוונים הפוכים, אבל הסכום שלהם (שחור) אף פעם לא זז הצידה. הוא רק גדל וקטן, לפי הגורם cos kvt.');
      }
      $('#ws-say').textContent = say;
    }
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const l = 16, r = w - 30; // x = x0 .. 0 maps to l .. r; the wall sits at r
      const X = (x) => l + ((x - x0) / -x0) * (r - l);
      const A = h * 0.068;
      const lanes = [h * 0.15, h * 0.4, h * 0.73]; // incident, reflected, sum
      const N = 360, t = st.t;
      // node guides through all three lanes: x = -n lambda/2
      for (let x = 0; x >= x0 - 1e-9; x -= lam / 2) line(ctx, [[X(x), h * 0.05], [X(x), h * 0.95]], C.line, 1, [2, 4]);
      lanes.forEach((y) => line(ctx, [[X(x0), y], [X(0), y]], C.line, 1));
      // envelope of the sum, +-2|sin kx| (only where the echo has arrived in build mode)
      const echoX = st.mode === 'build' ? -(v * t + u0) : x0; // reflected wave exists for x > echoX
      if (st.env) {
        const up = [], dn = [];
        for (let i = 0; i <= N; i++) {
          const x = x0 + (i / N) * -x0;
          if (x < echoX) continue;
          const e = 2 * Math.abs(Math.sin(k * x));
          up.push([X(x), lanes[2] - A * e]); dn.push([X(x), lanes[2] + A * e]);
        }
        if (up.length > 1) {
          ctx.save(); ctx.fillStyle = C.soft; ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]);
          up.forEach(([px, py]) => ctx.lineTo(px, py)); for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
          ctx.closePath(); ctx.fill(); ctx.restore();
        }
      }
      const a = [], b = [], s = [], sa = [], sb = [];
      for (let i = 0; i <= N; i++) {
        const x = x0 + (i / N) * -x0, yi = inc(x, t), yr = ref(x, t);
        a.push([X(x), lanes[0] - A * yi]); b.push([X(x), lanes[1] - A * yr]);
        s.push([X(x), lanes[2] - A * (yi + yr)]);
        sa.push([X(x), lanes[2] - A * yi]); sb.push([X(x), lanes[2] - A * yr]);
      }
      line(ctx, sa, C.inc, 1.1, [4, 4]); line(ctx, sb, C.r, 1.1, [4, 4]); // the two parts, faint, inside the sum lane
      line(ctx, a, C.inc, 2.4); line(ctx, b, C.r, 2.4); line(ctx, s, C.ink, 2.8);
      // a marker riding one crest of each travelling wave shows that they move; the sum's nodes do not
      const crest = (dir) => { // crest positions: k(x -+ vt) = pi/2 + 2 pi n
        const out = [];
        for (let n = -6; n <= 6; n++) { const x = (Math.PI / 2 + TAU * n) / k + dir * v * t; if (x >= x0 && x <= 0) out.push(x); }
        return out;
      };
      crest(+1).forEach((x) => { if (inc(x, t) > 0.5) { ctx.save(); ctx.fillStyle = C.inc; ctx.beginPath(); ctx.arc(X(x), lanes[0] - A, 4.5, 0, TAU); ctx.fill(); ctx.restore(); } });
      crest(-1).forEach((x) => { if (ref(x, t) > 0.5) { ctx.save(); ctx.fillStyle = C.r; ctx.beginPath(); ctx.arc(X(x), lanes[1] - A, 4.5, 0, TAU); ctx.fill(); ctx.restore(); } });
      // nodes of the sum (where the echo has arrived)
      for (let x = 0; x >= x0 - 1e-9; x -= lam / 2) {
        if (x < echoX - 1e-9) continue;
        ctx.save(); ctx.fillStyle = C.r; ctx.strokeStyle = C.bg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), lanes[2], 4.5, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (st.mode === 'build' && echoX > x0 && echoX < 0) {
        line(ctx, [[X(echoX), h * 0.3], [X(echoX), h * 0.95]], C.ten, 2, [6, 4]);
        label(ctx, tr('echo front ←', iso('←') + ' חזית ההד'), X(echoX) + 6, h * 0.97 - 6, C.ten, { align: 'left', size: 11, halo: true });
      }
      // the wall spans all lanes
      hatchWall(ctx, X(0), h * 0.04, h * 0.96, 1, C.muted);
      // lane labels
      const L = (txt, y, col) => label(ctx, txt, l + 2, y, col, { align: 'left', size: 12, halo: true });
      L(tr('incident  ψᵢ = sin k(x − vt)  →', iso('ψᵢ = sin k(x − vt)  →') + '  נכנס'), lanes[0] - A * 1.75, C.inc);
      L(tr('reflected  ψᵣ = −ψᵢ(−x,t) = sin k(x + vt)  ←', iso('ψᵣ = −ψᵢ(−x,t) = sin k(x + vt)  ←') + '  מוחזר'), lanes[1] - A * 1.75, C.r);
      L(tr('sum  ψ = 2 sin kx · cos kvt', iso('ψ = 2 sin kx · cos kvt') + '  סכום'), lanes[2] - A * 2.55, C.ink);
      label(ctx, '+', X(0) + 14, (lanes[0] + lanes[1]) / 2, C.muted, { size: 16, weight: '700' });
      label(ctx, '=', X(0) + 14, (lanes[1] + lanes[2]) / 2 + 4, C.muted, { size: 16, weight: '700' });
      label(ctx, 'x = 0', X(0) - 4, h * 0.99, C.muted, { size: 11, base: 'bottom', mono: true, align: 'right', halo: true });
      label(ctx, tr('nodes: x = −nλ/2', 'צמתים: ' + iso('x = −nλ/2')), X(-lam * 1.25), lanes[2] + A * 2.45, C.r, { size: 11, halo: true });
    }
    addWidget(box, (dt) => {
      if (st.playing) {
        st.t += dt;
        if (st.mode === 'build' && -(v * st.t + u0) < x0 - lam) st.t = 0; // replay once the echo has covered the string
      }
      draw(); readouts();
    });
    draw(); readouts();
  }

  /* ============ 7c. Two walls: try any wavelength and see whether it fits (L10 p.3-4) ============
     The left wall alone allows psi = sin kx cos wt for every k. The right wall at x = L also needs
     psi(L,t) = 0, i.e. sin kL = 0. The slider sets kL/pi freely; the figure shows the gap at the right
     wall when it does not fit, and the bounce picture: after M round trips (path 2L, two flips = no flip)
     the echoes add to |sin(M kL) / (M sin kL)|, which is 1 only at kL = n pi. Hebrew page only. */
  function initFit() {
    const box = $('#sim-fit');
    if (!box) return;
    const S = setupCanvas($('canvas', box), (w) => Math.max(300, Math.min(400, w * 0.5)));
    const sl = $('#f-kl');
    const M = 12;
    const st = { q: parseFloat(sl.value), t: 0, playing: !reduceMotion };
    const bounce = (q) => { const s = Math.sin(Math.PI * q); return Math.abs(s) < 1e-9 ? 1 : Math.abs(Math.sin(M * Math.PI * q) / (M * s)); };
    function upd() {
      const q = st.q, s = Math.sin(Math.PI * q), fits = Math.abs(q - Math.round(q)) < 0.005 && Math.round(q) > 0;
      $('#f-kl-out').textContent = q.toFixed(2) + ' π';
      $('#f-half').textContent = q.toFixed(2);
      $('#f-lam').textContent = (2 / q).toFixed(2) + ' L';
      $('#f-sin').textContent = fmt(Math.abs(s) < 0.005 ? 0 : s);
      $('#f-b').textContent = Math.round(100 * bounce(q)) + '%';
      $('#f-say').textContent = fits
        ? tr('Fits: exactly ' + Math.round(q) + ' half-waves between the walls.', 'נכנס: בדיוק ' + Math.round(q) + ' חצאי גל בין הקירות. הקיר הימני יושב על צומת, וכל ההחזרות מתחברות באותו מופע. זה אופן ' + iso('n = ' + Math.round(q)) + '.')
        : tr('Does not fit.', 'לא נכנס: ' + iso(q.toFixed(2)) + ' חצאי גל זה לא מספר שלם. הצורה ‎sin kx‎ מגיעה לקיר הימני בגובה ' + iso('sin kL = ' + fmt(s)) + ' (החץ האדום), אבל הקיר מחזיק את המיתר ב-0. ובתמונת ההחזרות: ההדים חוזרים במופעים שונים ומבטלים זה את זה.');
    }
    sl.addEventListener('input', () => { st.q = parseFloat(sl.value); upd(); });
    $$('[data-fsnap]', box).forEach((b) => b.addEventListener('click', () => {
      const d = b.dataset.fsnap;
      st.q = d === 'up' ? Math.floor(st.q + 1e-6) + 1 : Math.max(1, Math.ceil(st.q - 1e-6) - 1);
      if (d !== 'up' && d !== 'down') st.q = parseFloat(d);
      st.q = Math.min(6.5, st.q); sl.value = st.q; upd();
    }));
    playButton($('#f-play'), () => st.playing, (p) => { st.playing = p; });
    upd();
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const q = st.q, kL = Math.PI * q;
      // top: the string between x = 0 and x = L (plus a dashed ghost beyond the right wall)
      const l = 22, r = w - 70, X = (u) => l + u * (r - l); // u = x / L
      const yc = h * 0.3, A = h * 0.17, ct = Math.cos(TAU * 0.5 * st.t);
      line(ctx, [[X(0), yc], [X(1), yc]], C.line, 1, [3, 4]);
      // envelope
      const up = [], dn = [];
      for (let i = 0; i <= 240; i++) { const u = i / 240, e = Math.abs(Math.sin(kL * u)); up.push([X(u), yc - A * e]); dn.push([X(u), yc + A * e]); }
      line(ctx, up, C.muted, 1, [2, 3]); line(ctx, dn, C.muted, 1, [2, 3]);
      const pts = [], ghost = [];
      for (let i = 0; i <= 300; i++) { const u = i / 300; pts.push([X(u), yc - A * Math.sin(kL * u) * ct]); }
      for (let i = 0; i <= 60; i++) { const u = 1 + (i / 60) * 0.22; ghost.push([X(u), yc - A * Math.sin(kL * u) * ct]); }
      line(ctx, ghost, C.ghost, 1.4, [4, 4]);
      line(ctx, pts, C.ink, 2.6);
      // nodes of sin kx inside [0, L]
      for (let n = 0; n <= Math.floor(q + 1e-9); n++) {
        const u = n / q; if (u > 1 + 1e-9) break;
        ctx.save(); ctx.fillStyle = C.t; ctx.beginPath(); ctx.arc(X(u), yc, 4, 0, TAU); ctx.fill(); ctx.restore();
      }
      hatchWall(ctx, X(0), yc - A * 1.35, yc + A * 1.35, -1, C.muted);
      hatchWall(ctx, X(1), yc - A * 1.35, yc + A * 1.35, 1, C.muted);
      label(ctx, 'x = 0', X(0), yc + A * 1.35 + 10, C.muted, { size: 11, mono: true });
      label(ctx, 'x = L', X(1), yc + A * 1.35 + 10, C.muted, { size: 11, mono: true });
      const sEnd = Math.sin(kL);
      if (Math.abs(sEnd) > 0.03) {
        const y1 = yc - A * sEnd * ct;
        arrow(ctx, X(1) + 30, yc, X(1) + 30, y1, C.r, 2);
        label(ctx, tr('needed 0', 'צריך 0'), X(1) + 34, yc - A * 1.2, C.r, { size: 11, align: 'left', halo: true });
        ctx.save(); ctx.fillStyle = C.r; ctx.beginPath(); ctx.arc(X(1), y1, 4.5, 0, TAU); ctx.fill(); ctx.restore();
      } else {
        label(ctx, tr('node ✓', '✓ צומת'), X(1) + 34, yc - A * 1.2, C.t, { size: 11, align: 'left', halo: true });
      }
      // bottom: what is left after M round trips, as a function of kL / pi
      const by = h * 0.93, bh = h * 0.3, bl = 22, br = w - 22, qmax = 6.5;
      const BX = (qq) => bl + (qq / qmax) * (br - bl);
      line(ctx, [[bl, by], [br, by]], C.line, 1);
      for (let n = 1; n <= 6; n++) { line(ctx, [[BX(n), by], [BX(n), by - bh]], C.line, 1, [2, 4]); label(ctx, n + 'π', BX(n), by + 9, C.muted, { size: 10, mono: true }); }
      const curve = [];
      for (let i = 0; i <= 900; i++) { const qq = 0.02 + (i / 900) * (qmax - 0.02); curve.push([BX(qq), by - bh * bounce(qq)]); }
      line(ctx, curve, C.z, 1.8);
      ctx.save(); ctx.fillStyle = C.z; ctx.beginPath(); ctx.arc(BX(q), by - bh * bounce(q), 5, 0, TAU); ctx.fill(); ctx.restore();
      label(ctx, tr('what survives after ' + M + ' round trips  (horizontal: kL)', 'כמה נשאר אחרי ' + M + ' סיבובים הלוך-חזור  (ציר אופקי: ' + iso('kL') + ')'), (bl + br) / 2, by - bh - 10, C.z, { size: 11.5, halo: true });
    }
    addWidget(box, (dt) => { if (st.playing) st.t += dt; draw(); });
    draw();
  }

  /* ============ 8. Standing-wave builder with any end impedance (L10 p.1-3) ============ */
  function initStanding() {
    const box = $('#sim-standing');
    const S = setupCanvas($('canvas', box), (w) => Math.max(240, Math.min(320, w * 0.42)));
    const sl = $('#w-zr'), ks = $('#w-kap');
    const st = { mode: 'wall', lr: 2, ls: 0, t: 0, playing: !reduceMotion, parts: true };
    if (!st.playing) st.t = 0.6;
    // reflection as magnitude and phase: psi_r = m cos(wt - kx + phi)
    function refl() {
      if (st.mode === 'wall') return { m: 1, phi: Math.PI, R: -1 };
      if (st.mode === 'free') return { m: 1, phi: 0, R: 1 };
      if (st.mode === 'spring') { const s = Math.pow(10, st.ls); return { m: 1, phi: 2 * Math.atan(s), s }; } // recitation 6: r = (kT + i kappa)/(kT - i kappa)
      const r = Math.pow(10, st.lr), R = (1 - r) / (1 + r);
      return { m: Math.abs(R), phi: R < 0 ? Math.PI : 0, R };
    }
    function zr() { return st.mode === 'wall' ? Infinity : st.mode === 'free' ? 0 : Math.pow(10, st.lr); }
    const deg = (p) => Math.round((p * 180) / Math.PI) + '°';
    function upd() {
      const q = refl();
      $('#w-zr-out').textContent = st.mode === 'wall' ? tr('∞ (wall)', '∞ (קיר)') : st.mode === 'free' ? tr('0 (free end)', '0 (קצה חופשי)') : st.mode === 'spring' ? '—' : fmt(zr());
      $('#w-kap-out').textContent = st.mode === 'spring' ? fmt(Math.pow(10, st.ls)) : '—';
      $('#w-R').textContent = st.mode === 'spring' ? 'e^(i·' + deg(q.phi) + ')' : fmt(q.R);
      $('#w-max').textContent = fmt(1 + q.m) + ' A';
      $('#w-min').textContent = fmt(1 - q.m) + ' A';
      $$('[data-wend]', box).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.wend === st.mode)));
      let say;
      if (st.mode === 'wall') say = tr('Wall (Z = ∞, R = −1): a node at the wall and every λ/2 from it. This is ψ = −2A sin(ωt + φ) sin kx.', 'קיר (Z = ∞, R = −1): צומת בקיר ובכל λ/2 ממנו. זה ‎ψ = −2A sin(ωt + φ) sin kx‎.');
      else if (st.mode === 'free') say = tr('Free end (Z = 0, R = +1): an antinode at the end, where the slope stays zero. This is ψ = 2A cos(ωt + φ) cos kx.', 'קצה חופשי (Z = 0, R = +1): בטן בקצה, שם השיפוע נשאר אפס. זה ‎ψ = 2A cos(ωt + φ) cos kx‎.');
      else if (st.mode === 'spring') say = tr('Spring (recitation 6): everything comes back, |r| = 1, but with a phase φ = 2·arctan(κ/kT) = ' + deg(q.phi) + '. The nodes are still λ/2 apart, but shifted away from the end. Soft spring → like a free end; stiff spring → like a wall.',
        'קפיץ (תרגול 6): הכול חוזר, ‎|r| = 1‎, אבל עם מופע ‎φ = 2·arctan(κ/kT) = ' + deg(q.phi) + '‎. הצמתים עדיין במרחק λ/2 זה מזה, אבל זזים מהקצה. קפיץ רך ← כמו קצה חופשי; קפיץ קשיח ← כמו קיר.');
      else if (q.m < 0.02) say = tr('Matched end: nothing comes back, so the wave just travels. No nodes at all.', 'קצה מתואם: שום דבר לא חוזר, אז הגל פשוט מתקדם. אין צמתים בכלל.');
      else say = tr('Partial reflection: a travelling part rides on top of a standing part, so the dips never reach zero. The closer |R| is to 1, the deeper the dips.', 'החזרה חלקית: חלק מתקדם רוכב על חלק עומד, ולכן המינימומים לא מגיעים לאפס. ככל ש־|R| קרוב יותר ל־1, המינימומים עמוקים יותר.');
      $('#w-say').textContent = say;
    }
    $$('[data-wend]', box).forEach((b) => b.addEventListener('click', () => { st.mode = b.dataset.wend; if (st.mode === 'wall') sl.value = 2; if (st.mode === 'free') sl.value = -2; upd(); }));
    sl.addEventListener('input', () => { st.mode = 'string'; st.lr = parseFloat(sl.value); upd(); });
    ks.addEventListener('input', () => { st.mode = 'spring'; st.ls = parseFloat(ks.value); upd(); });
    $('#w-parts').addEventListener('change', (e) => { st.parts = e.target.checked; });
    playButton($('#w-play'), () => st.playing, (v) => { st.playing = v; });
    upd();
    function spring(ctx, x, yTop, yBot, color) {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x, yTop);
      const n = 9, seg = (yBot - yTop) / (n + 1);
      for (let i = 1; i <= n; i++) ctx.lineTo(x + (i % 2 ? 7 : -7), yTop + i * seg);
      ctx.lineTo(x, yBot); ctx.stroke();
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 12, yBot); ctx.lineTo(x + 12, yBot); ctx.stroke(); ctx.restore();
    }
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const xl = -0.22, xr = 1, l = 14, r = w - 14;
      const X = (x) => l + ((x - xl) / (xr - xl)) * (r - l);
      const yc = h * 0.5, A = h * 0.17;
      const k = TAU / 0.4, om = TAU * 0.45, q = refl(), Zr = zr();
      const ph = om * st.t;
      line(ctx, [[X(0), yc], [X(xr), yc]], C.line, 1, [3, 4]);
      // envelope |e^{ikx} + m e^{i(phi - kx)}| for x > 0
      const up = [], dn = [];
      for (let i = 0; i <= 200; i++) {
        const x = (i / 200) * xr, env = Math.sqrt(Math.max(0, 1 + q.m * q.m + 2 * q.m * Math.cos(2 * k * x - q.phi)));
        up.push([X(x), yc - A * env]); dn.push([X(x), yc + A * env]);
      }
      ctx.save(); ctx.fillStyle = C.soft; ctx.beginPath(); ctx.moveTo(up[0][0], up[0][1]);
      up.forEach(([x, y]) => ctx.lineTo(x, y)); for (let i = dn.length - 1; i >= 0; i--) ctx.lineTo(dn[i][0], dn[i][1]);
      ctx.closePath(); ctx.fill(); ctx.restore();
      line(ctx, up, C.muted, 1, [2, 3]); line(ctx, dn, C.muted, 1, [2, 3]);
      const inc = [], ref = [], sum = [];
      for (let i = 0; i <= 300; i++) {
        const x = (i / 300) * xr;
        const a = Math.cos(ph + k * x), b = q.m * Math.cos(ph - k * x + q.phi); // incident moves LEFT; echo = r * psi_i(-x,t)
        inc.push([X(x), yc - A * a]); ref.push([X(x), yc - A * b]); sum.push([X(x), yc - A * (a + b)]);
      }
      if (st.parts) { line(ctx, inc, C.inc, 1.5, [5, 4]); line(ctx, ref, C.r, 1.5, [5, 4]); }
      line(ctx, sum, C.ink, 2.6);
      // nodes when everything reflects: 2kx - phi = pi (mod 2 pi)
      if (Math.abs(q.m - 1) < 1e-9) {
        const lam = TAU / k;
        let x = ((Math.PI + q.phi) / (2 * k)) % (lam / 2);
        for (; x <= xr + 1e-6; x += lam / 2) { ctx.save(); ctx.fillStyle = C.r; ctx.beginPath(); ctx.arc(X(x), yc, 4, 0, TAU); ctx.fill(); ctx.restore(); }
        label(ctx, tr('nodes every λ/2', 'צמתים כל ' + iso('λ/2')), X(0.5), yc + A * 2.05 + 4, C.r, { size: 11, halo: true });
      }
      const yEnd = yc - A * (Math.cos(ph) + q.m * Math.cos(ph + q.phi)); // the string's height at x = 0
      if (st.mode === 'wall') hatchWall(ctx, X(0), yc - A * 2.2, yc + A * 2.2, -1, C.muted);
      else if (st.mode === 'free') rodAndRing(ctx, X(0), yc - A * 2.3, yc + A * 2.3, yEnd, C.muted);
      else if (st.mode === 'spring') {
        rodAndRing(ctx, X(0), yc - A * 2.3, yc + A * 2.3, yEnd, C.muted);
        spring(ctx, X(0) - 22, yEnd, yc + A * 2.25, C.ten);
        line(ctx, [[X(0) - 22, yEnd], [X(0) - 4, yEnd]], C.ten, 1.8);
        label(ctx, tr('spring κ', 'קפיץ ' + iso('κ')), X(0) - 26, yc + A * 2.25 - 8, C.ten, { align: 'right', size: 11, halo: true });
      } else {
        // a second string on the left carries the transmitted part (equal tension: k2 = k * Z2/Z1)
        const Tt = 1 + q.R, k2 = k * Zr, trn = [];
        const lam2px = (TAU / k2) / (xr - xl) * (r - l);
        if (lam2px > 7) {
          for (let i = 0; i <= 160; i++) { const x = xl + (i / 160) * (0 - xl); trn.push([X(x), yc - A * Tt * Math.cos(ph + k2 * x)]); }
          line(ctx, trn, C.ink, Math.max(1.2, Math.min(7, 2.6 * Math.pow(Zr, 0.66))));
          if (st.parts) line(ctx, trn, C.t, 1.4, [5, 4]);
        } else {
          ctx.save(); ctx.fillStyle = C.t; ctx.globalAlpha = 0.25; ctx.fillRect(X(xl), yc - A * Tt, X(0) - X(xl), 2 * A * Tt + 1); ctx.restore();
          line(ctx, [[X(xl), yc], [X(0), yc]], C.ink, 6);
        }
        ctx.save(); ctx.fillStyle = C.bg; ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(0), yEnd, 4, 0, TAU); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      label(ctx, tr('← incident comes from the right', 'הגל הפוגע מגיע מימין ←'), X(xr) - 2, h * 0.07, C.inc, { align: 'right', size: 12, halo: true });
      label(ctx, 'x = 0', X(0), h - 8, C.muted, { size: 11 });
    }
    addWidget(box, (dt) => { if (st.playing) st.t += dt; draw(); });
  }

  /* ============ 8b. A middle string between two strings (recitation 6, example 4) ============ */
  function initQuarter() {
    const box = $('#sim-quarter');
    const cv = $('canvas', box);
    const S = setupCanvas(cv, (w) => Math.max(230, Math.min(300, w * 0.42)));
    const zs = $('#q-zm'), ls = $('#q-len');
    const Z2 = 3; // Z1 = 1, Z2 = 3 (rho2 = 9 rho1), as in recitation 6
    const rr = (a, b) => (a - b) / (a + b);
    // complex helpers
    const cx = (re, im) => ({ re, im }), add = (a, b) => cx(a.re + b.re, a.im + b.im), mul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
    const div = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
    function REof(Zm, Lfrac, wr) { // power reflection at omega = wr * omega0; Lfrac = L / lambda_m at omega0
      const r1m = rr(1, Zm), rm2 = rr(Zm, Z2), a = -4 * Math.PI * Lfrac * wr; // q = e^{-2 i k_m L}
      const q = cx(Math.cos(a), Math.sin(a));
      const num = add(cx(r1m, 0), mul(cx(rm2, 0), q)), den = add(cx(1, 0), mul(cx(r1m * rm2, 0), q));
      const r = div(num, den); return r.re * r.re + r.im * r.im;
    }
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const Zm = Math.pow(10, parseFloat(zs.value)), Lf = parseFloat(ls.value);
      $('#q-zm-out').textContent = fmt(Zm) + ' Z₁';
      $('#q-len-out').textContent = fmt(Lf) + ' λₘ';
      const tF = (4 * 1 * Zm) / ((1 + Zm) * (Zm + Z2)), first = Z2 * tF * tF;
      $('#q-first').textContent = pct(first);
      $('#q-at').textContent = pct(1 - REof(Zm, Lf, 1));
      const g = { l: 44, r: w - 14, t: 16, b: h - 34 }, wmax = 3, ymax = 0.4;
      const X = (u) => g.l + (u / wmax) * (g.r - g.l), Y = (v) => g.b - (v / ymax) * (g.b - g.t);
      for (const v of [0, 0.1, 0.2, 0.3, 0.4]) { line(ctx, [[g.l, Y(v)], [g.r, Y(v)]], C.line, 1, v ? [2, 4] : null); label(ctx, Math.round(v * 100) + '%', g.l - 6, Y(v), C.muted, { align: 'right', size: 11, mono: true }); }
      for (const u of [0, 1, 2, 3]) label(ctx, String(u), X(u), g.b + 13, C.muted, { size: 11, mono: true });
      label(ctx, tr('frequency ω / ω₀', 'תדירות ' + iso('ω / ω₀')), (g.l + g.r) / 2, h - 6, C.muted, { size: 11 });
      // direct junction: 25% at every frequency
      line(ctx, [[X(0), Y(0.25)], [X(wmax), Y(0.25)]], C.r, 2, [6, 4]);
      label(ctx, tr('direct junction: 25% back', 'חיבור ישיר: 25% חוזרים'), g.r - 4, Y(0.25) - 10, C.r, { align: 'right', size: 11, halo: true });
      const pts = [];
      for (let i = 0; i <= 400; i++) { const u = (i / 400) * wmax; pts.push([X(u), Y(Math.min(ymax, REof(Zm, Lf, u)))]); }
      line(ctx, pts, C.z, 2.6);
      line(ctx, [[X(1), g.t], [X(1), g.b]], C.ink, 1, [3, 3]);
      label(ctx, 'ω₀', X(1) + 4, g.t + 6, C.ink, { align: 'left', size: 11 });
      label(ctx, tr('power reflected R_E, with the middle string', 'הספק מוחזר ' + iso('R_E') + ' עם המיתר האמצעי'), HE ? g.r - 6 : g.l + 6, g.t + 6, C.z, { align: HE ? 'right' : 'left', size: 11, halo: true });
    }
    zs.addEventListener('input', draw); ls.addEventListener('input', draw);
    $$('[data-qpreset]', box).forEach((b) => b.addEventListener('click', () => { zs.value = Math.log10(Math.sqrt(Z2)); ls.value = 0.25; draw(); }));
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(cv);
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
    draw();
  }

  /* ============ 9. Normal modes of a string fixed at both ends (L10 p.3-4) ============ */
  function initModes() {
    const box = $('#sim-modes');
    const S = setupCanvas($('canvas', box), (w) => Math.max(190, Math.min(240, w * 0.34)));
    const st = { n: 1, t: 0, playing: !reduceMotion };
    if (!st.playing) st.t = 0.55;
    $$('[data-mode]', box).forEach((b) => b.addEventListener('click', () => { st.n = parseInt(b.dataset.mode, 10); upd(); }));
    function upd() {
      $$('[data-mode]', box).forEach((b) => b.setAttribute('aria-pressed', String(parseInt(b.dataset.mode, 10) === st.n)));
      $('#m-lam').textContent = st.n === 1 ? '2L' : st.n === 2 ? 'L' : '2L/' + st.n;
      $('#m-nu').textContent = st.n === 1 ? 'ν₁' : st.n + 'ν₁';
      $('#m-nodes').textContent = String(st.n + 1) + tr(' (counting both walls)', " (כולל שני הקירות)");
    }
    upd();
    playButton($('#m-play'), () => st.playing, (v) => { st.playing = v; });
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const l = 26, r = w - 26, yc = h * 0.5, A = h * 0.32, n = st.n;
      const X = (u) => l + u * (r - l);
      line(ctx, [[l, yc], [r, yc]], C.line, 1, [3, 4]);
      const env1 = [], env2 = [], s = [];
      const om1 = TAU * 0.35;
      for (let i = 0; i <= 300; i++) {
        const u = i / 300, sh = Math.sin(n * Math.PI * u);
        env1.push([X(u), yc - A * sh]); env2.push([X(u), yc + A * sh]);
        s.push([X(u), yc - A * sh * Math.sin(n * om1 * st.t + Math.PI / 2)]);
      }
      line(ctx, env1, C.muted, 1, [2, 3]); line(ctx, env2, C.muted, 1, [2, 3]);
      line(ctx, s, C.ink, 2.6);
      for (let m = 0; m <= n; m++) { ctx.save(); ctx.fillStyle = C.r; ctx.beginPath(); ctx.arc(X(m / n), yc, 4, 0, TAU); ctx.fill(); ctx.restore(); }
      hatchWall(ctx, l, yc - A - 10, yc + A + 10, -1, C.muted);
      hatchWall(ctx, r, yc - A - 10, yc + A + 10, 1, C.muted);
      label(ctx, 'x = 0', l, h - 8, C.muted, { size: 11 }); label(ctx, 'x = L', r, h - 8, C.muted, { size: 11 });
    }
    addWidget(box, (dt) => { if (st.playing) st.t += dt; draw(); });
  }

  /* ============ 10. Build a packet from single-frequency waves (L12 p.2-4, p.8-9) ============ */
  function initPacket() {
    const box = $('#sim-packet');
    const cv = $('canvas', box);
    const S = setupCanvas(cv, (w) => Math.max(200, Math.min(260, w * 0.38)));
    const sl = $('#p-n');
    function draw() {
      const { ctx, w, h } = S, C = pal();
      ctx.clearRect(0, 0, w, h);
      const N = parseInt(sl.value, 10);
      $('#p-n-out').textContent = String(N);
      const l = 12, r = w - 12, yc = h * 0.62, A = h * 0.3, yComp = h * 0.16, aComp = h * 0.08;
      const k0 = TAU * 6, sk = TAU * 0.9, dk = (6 * sk) / 40;
      const ks = [], ws = [];
      for (let j = 0; j < N; j++) { const q = (j - (N - 1) / 2) * dk; ks.push(k0 + q); ws.push(Math.exp(-(q * q) / (2 * sk * sk))); }
      const wsum = ws.reduce((a, b) => a + b, 0);
      const X = (x) => l + ((x + 1) / 2) * (r - l);
      // components (only a few, faint)
      if (N <= 9) {
        for (let j = 0; j < N; j++) {
          const pts = [];
          for (let i = 0; i <= 300; i++) { const x = -1 + (2 * i) / 300; pts.push([X(x), yComp - aComp * Math.cos(ks[j] * x)]); }
          line(ctx, pts, C.inc, 1, null);
        }
        label(ctx, N === 1 ? tr('one single-frequency wave', "גל אחד בתדירות אחת") : tr(N + ' single-frequency waves (top), their sum (below)', N + ' גלים בתדירות אחת כל אחד (למעלה), והסכום שלהם (למטה)'), HE ? r : l, 10, C.muted, { align: HE ? 'right' : 'left', size: 11 });
      } else label(ctx, tr(N + ' single-frequency waves added (too many to draw one by one)', 'חוברו ' + N + ' גלים בתדירות אחת (יותר מדי כדי לצייר כל אחד)'), HE ? r : l, 10, C.muted, { align: HE ? 'right' : 'left', size: 11 });
      const sum = [], env = [], envN = [];
      for (let i = 0; i <= 600; i++) {
        const x = -1 + (2 * i) / 600;
        let s = 0; for (let j = 0; j < N; j++) s += ws[j] * Math.cos(ks[j] * x);
        sum.push([X(x), yc - A * (s / wsum)]);
        const hx = Math.exp(-(x * x) * sk * sk / 2);
        env.push([X(x), yc - A * hx]); envN.push([X(x), yc + A * hx]);
      }
      line(ctx, [[l, yc], [r, yc]], C.line, 1, [3, 4]);
      if (N >= 15) { line(ctx, env, C.z, 1.4, [5, 4]); line(ctx, envN, C.z, 1.4, [5, 4]); label(ctx, tr('envelope h(x)', 'מעטפת ' + iso('h(x)')), X(0.38), yc - A * 0.55, C.z, { align: 'left', size: 11, halo: true }); }
      line(ctx, sum, C.ink, 2.2);
      $('#p-say').textContent = N === 1 ? tr('One frequency: a wave that never ends. It has an exact wavelength, but no position.', "תדירות אחת: גל שאין לו סוף. יש לו אורך גל מדויק, אבל אין לו מיקום.")
        : N === 2 ? tr('Two frequencies: beats. The sum is a fast carrier inside a slow envelope (L12 p.2–3).', "שתי תדירויות: פעימות. הסכום הוא גל נושא מהיר בתוך מעטפת איטית (הרצאה 12 עמ׳ 2–3).")
        : N < 15 ? tr('More frequencies: the bumps of the envelope move apart and the middle one stands out.', "יותר תדירויות: הבליטות של המעטפת מתרחקות זו מזו, והאמצעית בולטת.")
        : tr('Many frequencies with smoothly falling weights: one localized packet, a carrier cos(k₀x) inside the envelope h(x). A narrower spread of k gives a wider packet.', "הרבה תדירויות עם משקלים שיורדים בהדרגה: חבורה אחת ממוקמת, גל נושא cos(k₀x) בתוך המעטפת h(x). פיזור צר יותר של k נותן חבורה רחבה יותר.");
    }
    sl.addEventListener('input', draw);
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(cv);
    new MutationObserver(draw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', draw);
    draw();
    $$('[data-send-packet]').forEach((b) => b.addEventListener('click', () => {
      junctionAPI.setShape && junctionAPI.setShape('packet');
      document.getElementById('sim-junction').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));
  }

  /* buttons in the text that load a preset into the junction simulator */
  function initTryButtons() {
    $$('[data-try]').forEach((b) => b.addEventListener('click', () => {
      junctionAPI.preset && junctionAPI.preset(b.dataset.try);
      document.getElementById('sim-junction').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    }));
  }

  function start() {
    safeInit('sim-junction', initJunction);
    safeInit('sim-balance', initBalance);
    safeInit('sim-shake', initShake);
    safeInit('sim-curves', initCurves);
    safeInit('sim-circuit', initCircuit);
    safeInit('sim-taper', initTaper);
    safeInit('sim-energy', initEnergy);
    safeInit('sim-wallsum', initWallSum);
    safeInit('sim-standing', initStanding);
    safeInit('sim-quarter', initQuarter);
    safeInit('sim-fit', initFit);
    safeInit('sim-modes', initModes);
    safeInit('sim-packet', initPacket);
    safeInit('try-buttons', initTryButtons);
    window.__impedanceWidgets = widgets; // lets a test advance the figures when the page is in the background
    requestAnimationFrame(loop);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
