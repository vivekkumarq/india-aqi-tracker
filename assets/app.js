'use strict';

/* ================= constants ================= */
const CATS = [
  ['Good', '0–50', 'Minimal impact.', ['Great day to be outside', 'Open the windows and air out your home']],
  ['Satisfactory', '51–100', 'May cause minor breathing discomfort to sensitive people.', ['Fine for most outdoor activity', 'People with asthma should keep medicine handy']],
  ['Moderate', '101–200', 'May cause breathing discomfort to people with lung or heart disease, children and older adults.', ['Sensitive groups should cut long outdoor workouts', 'Avoid exercising near heavy traffic', 'Keep reliever inhalers handy']],
  ['Poor', '201–300', 'May cause breathing discomfort to most people on prolonged exposure.', ['Limit prolonged outdoor exertion', 'Wear an N95 mask outdoors', 'Keep windows shut at peak traffic hours']],
  ['Very Poor', '301–400', 'May cause respiratory illness on prolonged exposure.', ['Avoid outdoor exercise', 'Wear an N95 mask whenever you go out', 'Run an air purifier indoors']],
  ['Severe', '401–500', 'Affects healthy people and seriously impacts those with existing diseases.', ['Stay indoors as much as possible', 'An N95 mask is essential outside', 'Keep windows shut and run a purifier']],
];
const POL = {pm25: ['PM2.5', 'µg/m³', '24h'], pm10: ['PM10', 'µg/m³', '24h'], no2: ['NO₂', 'µg/m³', '24h'], so2: ['SO₂', 'µg/m³', '24h'], co: ['CO', 'mg/m³', '8h'], o3: ['O₃', 'µg/m³', '8h']};
const KEYS = Object.keys(POL);
// Same CPCB breakpoints as fetch.py; used to turn the live forecast into AQI in the browser.
const BANDS = {pm25: [0, 30, 60, 90, 120, 250, 380], pm10: [0, 50, 100, 250, 350, 430, 510], no2: [0, 40, 80, 180, 280, 400, 520], so2: [0, 40, 80, 380, 800, 1600, 2100], co: [0, 1, 2, 10, 17, 34, 46], o3: [0, 50, 100, 168, 208, 748, 1000]};
const INDEX = [0, 50, 100, 200, 300, 400, 500];
const HOURS = {pm25: 24, pm10: 24, no2: 24, so2: 24, co: 8, o3: 8};
const API_VARS = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide', 'ozone'];
const COLS = [['name', 'City'], ['state', 'State'], ['aqi', 'AQI'], ['cat', 'Category'], ['dom', 'Dominant'], ...KEYS.map(k => [k, POL[k][0]])];
const RANKS = {worst: 'Most polluted', clean: 'Cleanest', rise: 'Biggest rise since last reading', fall: 'Biggest improvement since last reading'};
const SLIDES = [
  {img: 'india-gate', place: 'India Gate', city: 'New Delhi'},
  {img: 'hawa-mahal', place: 'Hawa Mahal', city: 'Jaipur'},
  {img: 'vidhana-soudha', place: 'Vidhana Soudha', city: 'Bengaluru'},
  {img: 'golden-temple', place: 'Golden Temple', city: 'Amritsar'},
  {img: 'howrah-bridge', place: 'Howrah Bridge', city: 'Kolkata'},
  {img: 'taj-mahal', place: 'Taj Mahal', city: 'Agra'},
  {img: 'gateway-of-india', place: 'Gateway of India', city: 'Mumbai'},
];
const GALLERY = 12;   // biggest cities shown as photo cards
const TICKER = 40;    // cities in the scrolling ticker
const IST = {timeZone: 'Asia/Kolkata'};
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ================= helpers ================= */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const cat = a => a <= 50 ? 0 : a <= 100 ? 1 : a <= 200 ? 2 : a <= 300 ? 3 : a <= 400 ? 4 : 5;
const cv = i => `var(--c${i})`;
const pill = a => `<span class="pill" style="--c:${cv(cat(a))}"><span class="dot"></span>${CATS[cat(a)][0]}</span>`;
const fmt = v => v == null ? '–' : v >= 100 ? Math.round(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
const idTime = id => new Date(`${id.slice(0, 10)}T${id.slice(11, 13)}:${id.slice(13, 15)}:00+05:30`);
const timeLabel = t => (t instanceof Date ? t : idTime(t)).toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit', ...IST});
const dateLabel = d => new Date(d + 'T12:00:00+05:30').toLocaleDateString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', ...IST});
const dayKey = t => new Date(t).toLocaleDateString('en-CA', IST);
const istHour = t => +new Intl.DateTimeFormat('en-GB', {hour: '2-digit', hourCycle: 'h23', ...IST}).format(t);
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const signed = d => (d > 0 ? '▲ +' : d < 0 ? '▼ ' : '') + d;
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const store = {get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }};
const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2200); };
const memo = fn => { const m = new Map(); return k => { if (!m.has(k)) m.set(k, fn(k).catch(e => { m.delete(k); throw e; })); return m.get(k); }; };
const subIndex = (k, c) => { const bp = BANDS[k]; for (let i = 0; i < bp.length - 1; i++) if (c <= bp[i + 1]) return INDEX[i] + (c - bp[i]) * (INDEX[i + 1] - INDEX[i]) / (bp[i + 1] - bp[i]); return 500; };

// Animate a number from its last shown value to the new one.
function countUp(el, to) {
  const from = el.dataset.v === undefined ? 0 : +el.dataset.v, token = {};
  el.dataset.v = to; el._cu = token;
  if (reduced || !Number.isFinite(from) || from === to) { el.textContent = to; return; }
  const t0 = performance.now();
  const step = now => {
    if (el._cu !== token) return;
    const p = Math.min(1, (now - t0) / 800);
    el.textContent = Math.round(from + (to - from) * (1 - (1 - p) ** 3));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ================= state & data ================= */
let cities, index, rows = [], byId = new Map(), cur, selId, shown = {};
let rankMode = 'worst', sortKey = 'aqi', sortDir = -1, histDays = 7, cmpDays = 7, cityTab = 'forecast';
const favs = new Set(store.get('favs') || []);
let compare = (store.get('compare') || []).filter(c => Number.isInteger(c?.id) && [1, 2, 3].includes(c.slot));

const getJSON = u => fetch(u, {cache: 'no-cache'}).then(r => { if (!r.ok) throw Error(u); return r.json(); });
const snap = memo(id => getJSON(`data/snapshots/${id}.json`));
const month = memo(m => getJSON(`data/history/${m}.json`).catch(() => ({ids: [], aqi: []})));

// AQI readings of some cities between two times, read from the monthly history files.
async function readings(ids, from, to) {
  const months = [...new Set(index.filter(i => { const t = idTime(i); return t >= from && t <= to; }).map(i => i.slice(0, 7)))];
  const out = [];
  for (const f of await Promise.all(months.map(month))) {
    f.ids.forEach((id, k) => { const t = idTime(id); if (t >= from && t <= to) out.push({id, t, v: ids.map(c => f.aqi[k][c])}); });
  }
  return out.sort((a, b) => a.t - b.t);
}

/* ================= theme ================= */
const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
if (store.get('theme')) document.documentElement.dataset.theme = store.get('theme');
function applyTheme(t) {
  document.documentElement.dataset.theme = t; store.set('theme', t);
  document.querySelector('meta[name=theme-color]').content = css('--bg');
  setTiles(); renderMap(); particles.recolor();
}
$('theme').onclick = e => {
  const next = isDark() ? 'light' : 'dark';
  if (!document.startViewTransition || reduced) return applyTheme(next);
  const x = e.clientX, y = e.clientY, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  document.startViewTransition(() => applyTheme(next)).ready.then(() => document.documentElement.animate(
    {clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`]},
    {duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)'}));
};

/* ================= hero slideshow ================= */
const slides = (() => {
  const box = $('slides');
  let at = 0, timer;
  box.innerHTML = SLIDES.map((s, i) => `<div class="slide${i ? '' : ' on'}" style="--kb:${i % 2 ? 1 : -1}"><img alt="" decoding="async" ${i ? 'data-src' : 'src'}="assets/img/${s.img}.jpg"></div>`).join('');
  $('dots').innerHTML = SLIDES.map((s, i) => `<button data-i="${i}" aria-label="Show ${esc(s.place)}"></button>`).join('');
  const img = i => box.children[i].querySelector('img');
  const load = i => { const el = img(i); if (el.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; } return el; };
  function show(n) {
    n = (n + SLIDES.length) % SLIDES.length;
    if (n === at) return;
    const el = load(n), go = () => {
      const old = box.children[at];
      old.classList.replace('on', 'was'); setTimeout(() => old.classList.remove('was'), 1700);
      box.children[n].classList.add('on'); at = n; caption(); load((n + 1) % SLIDES.length);
    };
    el.complete && el.naturalWidth ? go() : el.addEventListener('load', go, {once: true});
  }
  function caption() {
    const s = SLIDES[at], r = rows.find(x => x.name === s.city);
    $('slideCap').innerHTML = `<svg class="i"><use href="#i-pin"/></svg><span>${esc(s.place)}, ${esc(s.city)}</span>` +
      (r ? `<span class="cap-aqi" style="--c:${cv(r.cat)}"><span class="dot"></span>AQI ${r.aqi} · ${CATS[r.cat][0]}</span>` : '');
    $('slideCap').dataset.id = r ? r.id : '';
    [...$('dots').children].forEach((b, i) => b.setAttribute('aria-current', i === at));
  }
  function start() { clearInterval(timer); if (!reduced) timer = setInterval(() => !document.hidden && show(at + 1), 7000); }
  $('dots').onclick = e => { const b = e.target.closest('button'); if (b) { show(+b.dataset.i); start(); } };
  $('slideCap').onclick = () => $('slideCap').dataset.id !== '' && pick(+$('slideCap').dataset.id);
  load(1);
  return {start, caption};
})();

/* ================= clock ================= */
const clock = (() => {
  const el = $('clock'), svg = $('ckAnalog'), secBar = $('secBar');
  let mode = store.get('ckMode') === 'analog' ? 'analog' : 'digital';
  let theme = ['aurora', 'neon', 'sunset', 'ocean', 'classic'].includes(store.get('ckTheme')) ? store.get('ckTheme') : 'aurora';
  let h24 = store.get('ck24') === true, raf = 0, lastS = -1, visible = true, rolls = {};
  const tz = new Intl.DateTimeFormat('en-IN', {timeZoneName: 'long'}).formatToParts(new Date()).find(p => p.type === 'timeZoneName')?.value || '';

  // A digit that rolls like an odometer; the strip ends with an extra 0 so 9 → 0 keeps rolling forward.
  function roll(max) {
    const box = document.createElement('span'), strip = document.createElement('span');
    box.className = 'roll'; strip.className = 'strip';
    for (let d = 0; d <= max + 1; d++) strip.append(Object.assign(document.createElement('span'), {textContent: d % (max + 1)}));
    box.append(strip);
    let now = 0;
    box.set = d => {
      if (d === now) return;
      const wrap = d === 0 && now === max, n = max + 2;
      strip.style.transition = '';
      strip.style.transform = `translateY(${-(wrap ? max + 1 : d) * 100 / n}%)`;
      if (wrap) setTimeout(() => { strip.style.transition = 'none'; strip.style.transform = 'translateY(0)'; }, 700);
      now = d;
    };
    return box;
  }
  function buildDigits() {
    for (const [k, max] of [['H', h24 ? 2 : 1], ['M', 5], ['S', 5]]) {
      rolls[k] = [roll(max), roll(9)];
      $('d' + k).replaceChildren(...rolls[k]);
    }
    $('ckFmt').textContent = h24 ? '24h' : '12h';
    lastS = -1;
  }
  function buildAnalog() {
    let s = `<defs>
      <radialGradient id="ckFace" cx="50%" cy="32%" r="75%"><stop offset="0" style="stop-color:var(--ck-face1)"/><stop offset="1" style="stop-color:var(--ck-face2)"/></radialGradient>
      <linearGradient id="ckArc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--ck-accent)"/><stop offset="1" style="stop-color:var(--ck-accent2)"/></linearGradient>
    </defs>
    <circle class="face" cx="100" cy="100" r="98"/>
    <circle class="arc-bg" cx="100" cy="100" r="92"/>
    <circle class="arc" id="ckArcC" cx="100" cy="100" r="92" transform="rotate(-90 100 100)" stroke-dasharray="578.05" stroke-dashoffset="578.05"/>`;
    for (let i = 0; i < 60; i++) {
      const a = i * Math.PI / 30, major = i % 5 === 0, r2 = major ? 73 : 81;
      s += `<line class="tick${major ? ' major' : ''}" x1="${(100 + 86 * Math.sin(a)).toFixed(2)}" y1="${(100 - 86 * Math.cos(a)).toFixed(2)}" x2="${(100 + r2 * Math.sin(a)).toFixed(2)}" y2="${(100 - r2 * Math.cos(a)).toFixed(2)}"/>`;
    }
    for (let n = 1; n <= 12; n++) {
      const a = n * Math.PI / 6;
      s += `<text class="num${n % 3 ? '' : ' q'}" x="${(100 + 61 * Math.sin(a)).toFixed(2)}" y="${(100 - 61 * Math.cos(a)).toFixed(2)}">${n}</text>`;
    }
    s += `<rect class="h-hour" id="hHour" x="96.5" y="50" width="7" height="58" rx="3.5"/>
      <rect class="h-min" id="hMin" x="98" y="24" width="4" height="84" rx="2"/>
      <g class="h-sec" id="hSec"><line x1="100" y1="122" x2="100" y2="20"/><circle class="swiss" cx="100" cy="33" r="6.5"/><circle class="tail" cx="100" cy="116" r="3"/></g>
      <circle class="cap" cx="100" cy="100" r="4.5"/>`;
    svg.innerHTML = s;
  }
  // Readings are scheduled at 06:00 and 18:00 IST.
  function nextReading(now) {
    const w = new Date(+now + 198e5), y = w.getUTCFullYear(), m = w.getUTCMonth(), d = w.getUTCDate(), h = w.getUTCHours();
    const at = (h < 6 ? Date.UTC(y, m, d, 6) : h < 18 ? Date.UTC(y, m, d, 18) : Date.UTC(y, m, d + 1, 6)) - 198e5;
    return {at, prev: at - 432e5};
  }
  const hms = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return [s / 3600, s / 60 % 60, s % 60].map(v => String(Math.floor(v)).padStart(2, '0')).join(':'); };
  function second(now) {
    let h = now.getHours();
    const ap = h < 12 ? 'AM' : 'PM';
    if (!h24) h = h % 12 || 12;
    const set = (k, v) => { rolls[k][0].set(Math.floor(v / 10)); rolls[k][1].set(v % 10); };
    set('H', h); set('M', now.getMinutes()); set('S', now.getSeconds());
    $('dAp').textContent = h24 ? '' : ap;
    $('ckDate').textContent = now.toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'});
    const nx = nextReading(now);
    $('ckNext').textContent = hms(nx.at - now);
    $('ckNextAt').textContent = `· ${timeLabel(new Date(nx.at))} IST`;
    $('ckBar').style.width = ((now - nx.prev) / 432e5 * 100).toFixed(2) + '%';
    if (now.getSeconds() === 0 || !$('ckSr').textContent) $('ckSr').textContent = `Time ${now.toLocaleTimeString('en-IN', {hour: 'numeric', minute: '2-digit'})}`;
  }
  function hands(now) {
    const s = now.getSeconds() + (reduced ? 0 : now.getMilliseconds() / 1000), m = now.getMinutes(), h = now.getHours() % 12;
    const swiss = theme === 'classic';
    // The classic face copies the Swiss railway clock: the second hand sweeps in 58.5 s, pauses, and the minute hand jumps.
    const sec = swiss ? Math.min(360, s * 6 * 60 / 58.5) : s * 6;
    const min = swiss ? m * 6 : (m + s / 60) * 6;
    $('hHour').setAttribute('transform', `rotate(${((h + m / 60) * 30).toFixed(2)} 100 100)`);
    $('hMin').setAttribute('transform', `rotate(${min.toFixed(2)} 100 100)`);
    $('hSec').setAttribute('transform', `rotate(${sec.toFixed(2)} 100 100)`);
    $('ckArcC').setAttribute('stroke-dashoffset', (578.05 * (1 - s / 60)).toFixed(1));
  }
  function frame() {
    const now = new Date();
    if (now.getSeconds() !== lastS) { lastS = now.getSeconds(); second(now); }
    if (mode === 'analog') hands(now);
    else secBar.style.transform = `scaleX(${((now.getSeconds() + now.getMilliseconds() / 1000) / 60).toFixed(4)})`;
    raf = requestAnimationFrame(frame);
  }
  function run() { cancelAnimationFrame(raf); if (visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function setMode(m) {
    mode = m; el.dataset.mode = m; store.set('ckMode', m);
    el.querySelectorAll('.ck-seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m));
    if (m === 'analog') hands(new Date());
  }
  function setTheme(t) {
    theme = t; el.dataset.ck = t; store.set('ckTheme', t);
    el.querySelectorAll('.swatches button').forEach(b => b.setAttribute('aria-checked', b.dataset.ck === t));
  }
  el.querySelector('.ck-seg').onclick = e => { const b = e.target.closest('button'); b && setMode(b.dataset.mode); };
  el.querySelector('.swatches').onclick = e => { const b = e.target.closest('button'); b && setTheme(b.dataset.ck); };
  $('ckFmt').onclick = () => { h24 = !h24; store.set('ck24', h24); buildDigits(); };
  buildDigits(); buildAnalog(); setMode(mode); setTheme(theme);
  $('ckTz').textContent = tz;
  // A plain timer keeps the digits ticking even where the browser pauses animation frames.
  setInterval(() => {
    const now = new Date();
    if (now.getSeconds() !== lastS) { lastS = now.getSeconds(); second(now); if (mode === 'analog') hands(now); }
  }, 250);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(el);
  document.addEventListener('visibilitychange', run);
  return {run};
})();

/* ================= map ================= */
const map = L.map('map', {zoomSnap: .5, attributionControl: false, scrollWheelZoom: false}).setView([22.8, 80.5], 4.5);
map.on('focus', () => map.scrollWheelZoom.enable());
map.on('blur', () => map.scrollWheelZoom.disable());
let tiles, pulse, markers = L.layerGroup().addTo(map);
function setTiles() {
  if (tiles) map.removeLayer(tiles);
  tiles = L.tileLayer(`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_${isDark() ? 'Dark' : 'Light'}_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {maxZoom: 12}).addTo(map);
}
setTiles();
new ResizeObserver(() => map.invalidateSize()).observe($('map'));

function renderMap() {
  if (!rows.length) return;
  markers.clearLayers();
  const ring = css('--surface'), pal = CATS.map((_, i) => css(`--c${i}`));
  const v = [...view()].sort((a, b) => a.aqi - b.aqi); // worst drawn on top
  for (const r of v) {
    L.circleMarker([r.lat, r.lon], {radius: Math.min(4 + Math.sqrt(r.pop / 1e6) * 3, 14), color: ring, weight: 2, fillColor: pal[r.cat], fillOpacity: .92})
      .bindTooltip(`<strong style="font-size:15px">${r.aqi}</strong> · ${CATS[r.cat][0]}<br>${esc(r.name)}, <span style="color:var(--ink2)">${esc(r.state)}</span><br><span style="color:var(--ink2)">Dominant: ${POL[r.dom][0]}</span>`, {direction: 'top', offset: [0, -6]})
      .on('click', () => select(r.id, true))
      .addTo(markers);
  }
  drawPulse();
  if ($('state').value && v.length) map.fitBounds(L.latLngBounds(v.map(r => [r.lat, r.lon])).pad(.3), {maxZoom: 8});
}
function drawPulse() {
  const r = byId.get(selId); if (!r) return;
  if (pulse) pulse.setLatLng([r.lat, r.lon]);
  else pulse = L.marker([r.lat, r.lon], {icon: L.divIcon({className: 'pulse', html: '<span></span><span></span>', iconSize: [44, 44]}), interactive: false, keyboard: false}).addTo(map);
}

/* ================= loading a reading ================= */
function view() { const st = $('state').value; return st ? rows.filter(r => r.state === st) : rows; }

async function load(id) {
  document.body.classList.add('loading');
  try {
    const k = index.indexOf(id);
    const [s, p] = await Promise.all([snap(id), k > 0 ? snap(index[k - 1]).catch(() => null) : null]);
    cur = id;
    rows = cities.map((c, i) => {
      const v = s.v[i]; if (!v) return null;
      const r = {...c, aqi: v[0], dom: v[1]};
      s.cols.slice(2).forEach((key, j) => r[key] = v[j + 2]);
      r.cat = cat(r.aqi);
      r.delta = p?.v[i] ? r.aqi - p.v[i][0] : null;
      return r;
    }).filter(Boolean);
    byId = new Map(rows.map(r => [r.id, r]));
    $('stamp').textContent = 'Recorded ' + new Date(s.t).toLocaleString('en-IN', {dateStyle: 'medium', timeStyle: 'short', ...IST}) + ' IST';
    renderPicker(); renderAll(); renderTicker(); renderGallery(); slides.caption(); renderCompare();
    window.history.replaceState(null, '', `#${cur}${selId != null ? '/' + selId : ''}`);
  } catch (e) {
    console.error(e);
    $('stamp').textContent = 'Could not load this reading.';
  } finally {
    document.body.classList.remove('loading');
  }
}

// The hero always describes the latest reading, whichever reading is browsed below.
async function renderHero() {
  const last = index.at(-1), aqis = (await snap(last)).v.filter(Boolean).map(v => v[0]), med = median(aqis);
  countUp($('hMedian'), med);
  $('hMedianCat').textContent = `national median · ${CATS[cat(med)][0]}`;
  countUp($('hClean'), aqis.filter(a => a <= 100).length);
  $('hUpdated').textContent = `${dateLabel(last.slice(0, 10)).replace(/, \d{4}$/, '').replace(/^\w+, /, '')}, ${timeLabel(last)}`;
}

function renderPicker() {
  const dates = [...new Set(index.map(i => i.slice(0, 10)))].reverse();
  $('date').innerHTML = dates.map(d => `<option value="${d}"${d === cur.slice(0, 10) ? ' selected' : ''}>${dateLabel(d)}</option>`).join('');
  $('times').innerHTML = index.filter(i => i.startsWith(cur.slice(0, 10))).map(i => `<button data-id="${i}" aria-pressed="${i === cur}">${timeLabel(i)}</button>`).join('');
  const k = index.indexOf(cur);
  $('prev').disabled = k <= 0; $('next').disabled = k >= index.length - 1;
}

function renderAll() {
  const v = view(), by = [...v].sort((a, b) => b.aqi - a.aqi), n = v.length;
  const med = n ? median(v.map(r => r.aqi)) : 0;
  countUp($('tMedian'), med);
  $('tMedianTile').style.setProperty('--c', cv(cat(med)));
  $('tMedianCat').innerHTML = n ? pill(med) : '';
  const clean = v.filter(r => r.cat <= 1).length, bad = v.filter(r => r.cat >= 3).length;
  countUp($('tClean'), clean); $('tCleanNote').textContent = `${n ? Math.round(clean / n * 100) : 0}% of ${n} cities`;
  countUp($('tBad'), bad); $('tBadNote').textContent = `${n ? Math.round(bad / n * 100) : 0}% of ${n} cities`;
  if (n) { countUp($('tWorst'), by[0].aqi); $('tWorstTile').style.setProperty('--c', cv(by[0].cat)); }
  $('tWorstNote').textContent = n ? `${by[0].name}, ${by[0].state} · ${POL[by[0].dom][0]}` : '';
  const counts = CATS.map((_, i) => v.filter(r => r.cat === i).length);
  $('distNote').textContent = $('state').value || 'All India';
  $('dist').innerHTML = counts.map((c, i) => c ? `<div style="--c:${cv(i)};flex:${c}" title="${CATS[i][0]}: ${c} cities"></div>` : '').join('');
  $('legend').innerHTML = counts.map((c, i) => `<span class="pill" style="--c:${cv(i)};font-weight:400;color:var(--ink2)"><span class="dot"></span>${CATS[i][0]} <b>${c}</b></span>`).join('');
  if (selId == null || !byId.has(selId)) selId = by[0]?.id ?? rows[0]?.id;
  renderMap(); renderRank(); renderStates(); renderTable(); renderFavs(); renderCity();
}

/* ================= ticker & gallery ================= */
function renderTicker() {
  const list = [...rows].sort((a, b) => b.pop - a.pop).slice(0, TICKER);
  const item = r => `<button class="tk" data-id="${r.id}" tabindex="-1"><span class="dot" style="--c:${cv(r.cat)}"></span>${esc(r.name)} <b>${r.aqi}</b>${r.delta ? `<span class="tkd ${r.delta > 0 ? 'up' : 'down'}">${r.delta > 0 ? '▲' : '▼'}${Math.abs(r.delta)}</span>` : ''}</button>`;
  const html = list.map(item).join('');
  $('tickerTrack').innerHTML = `<div style="display:flex">${html}</div><div style="display:flex" aria-hidden="true">${html}</div>`;
}

function renderGallery() {
  const g = $('gallery'), list = cities.slice(0, GALLERY).map(c => byId.get(c.id)).filter(Boolean);
  if (!g.children.length) {
    g.innerHTML = list.map(r => `<button class="gcard" data-id="${r.id}"><img alt=""><span class="gbadge"><span class="dot"></span><span class="gcat"></span></span>
      <span class="gbody"><span class="gname">${esc(r.name)}</span><span class="gstate">${esc(r.state)}</span>
      <span class="gaqi"><span><small>AQI</small><span class="gnum">–</span></span><svg class="spark" viewBox="0 0 86 30" preserveAspectRatio="none" aria-hidden="true"><polyline/></svg></span></span></button>`).join('');
    const obs = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { obs.disconnect(); galleryPhotos(); } }, {rootMargin: '300px'});
    obs.observe(g);
  }
  for (const r of list) {
    const card = g.querySelector(`[data-id="${r.id}"]`);
    card.querySelector('.dot').style.setProperty('--c', cv(r.cat));
    card.querySelector('.gcat').textContent = CATS[r.cat][0];
    countUp(card.querySelector('.gnum'), r.aqi);
    card.setAttribute('aria-label', `${r.name}, AQI ${r.aqi}, ${CATS[r.cat][0]}`);
  }
  sparklines(list);
}
function galleryPhotos() {
  for (const card of $('gallery').children) {
    wikiSummary(+card.dataset.id).then(d => {
      if (!d?.thumbnail) return;
      const img = card.querySelector('img');
      img.onload = () => img.classList.add('ld');
      img.onerror = () => { img.onerror = null; img.src = d.thumbnail.source; };
      img.src = sized(d.thumbnail.source, 500);
    });
  }
}
async function sparklines(list) {
  const last = index.slice(Math.max(0, index.indexOf(cur) - 13), index.indexOf(cur) + 1);
  if (last.length < 2) return;
  const pts = await readings(list.map(r => r.id), idTime(last[0]), idTime(last.at(-1)));
  list.forEach((r, j) => {
    const vs = pts.map(p => p.v[j]).filter(v => v != null);
    const poly = $('gallery').querySelector(`[data-id="${r.id}"] polyline`);
    if (!poly || vs.length < 2) return;
    const lo = Math.min(...vs), span = Math.max(...vs) - lo || 1;
    poly.setAttribute('points', vs.map((v, i) => `${(i / (vs.length - 1) * 84 + 1).toFixed(1)},${(28 - (v - lo) / span * 26).toFixed(1)}`).join(' '));
  });
}

/* ================= rankings, states, table, favourites ================= */
function renderRank() {
  let list = [...view()];
  if (rankMode === 'worst') list.sort((a, b) => b.aqi - a.aqi);
  if (rankMode === 'clean') list.sort((a, b) => a.aqi - b.aqi);
  if (rankMode === 'rise') list = list.filter(r => r.delta > 0).sort((a, b) => b.delta - a.delta);
  if (rankMode === 'fall') list = list.filter(r => r.delta < 0).sort((a, b) => a.delta - b.delta);
  const trendMode = rankMode === 'rise' || rankMode === 'fall';
  $('rankTitle').textContent = RANKS[rankMode];
  $('rank').innerHTML = list.slice(0, 12).map((r, i) => `<li style="--i:${i}"><button data-id="${r.id}"><span class="n">${i + 1}</span><span>${esc(r.name)}<span class="st">${esc(r.state)}</span></span><span class="v" style="--c:${cv(r.cat)}">${trendMode ? `<span class="delta ${r.delta > 0 ? 'up' : 'down'}">${signed(r.delta)}</span>` : ''}<span class="dot"></span>${r.aqi}</span></button></li>`).join('')
    || `<li class="empty">${!trendMode ? 'No cities' : rows.some(r => r.delta != null) ? 'No city changed since the last reading.' : 'Needs an earlier reading to compare against.'}</li>`;
}

function renderStates() {
  const groups = {};
  rows.forEach(r => (groups[r.state] ||= []).push(r.aqi));
  const list = Object.entries(groups).map(([s, a]) => [s, median(a), a.length]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...list.map(l => l[1]), 1), active = $('state').value;
  $('bars').innerHTML = list.map(([s, m, n], i) => `<button data-state="${esc(s)}" title="${esc(s)}: median AQI ${m} across ${n} ${n > 1 ? 'cities' : 'city'}"${active && active !== s ? ' style="opacity:.45"' : ''}><span class="name">${esc(s)}</span><span class="track"><span class="fill" style="--c:${cv(cat(m))};--i:${i};width:${m / max * 100}%"></span></span><span class="val">${m}</span></button>`).join('');
}

function renderTable() {
  $('thead').innerHTML = COLS.map(([k, l]) => `<th><button data-k="${k}"${k === sortKey ? ` aria-sort="${sortDir < 0 ? 'descending' : 'ascending'}"` : ''}>${l}</button></th>`).join('');
  const q = $('q').value.trim().toLowerCase();
  const list = view().filter(r => !q || r.name.toLowerCase().includes(q) || r.state.toLowerCase().includes(q))
    .sort((a, b) => { const x = a[sortKey], y = b[sortKey]; return (typeof x === 'string' ? x.localeCompare(y) : (x ?? -1) - (y ?? -1)) * sortDir; });
  $('tbody').innerHTML = list.map(r => `<tr data-id="${r.id}" tabindex="0"><td>${esc(r.name)}</td><td>${esc(r.state)}</td><td class="aqi">${r.aqi}</td><td>${pill(r.aqi)}</td><td>${POL[r.dom][0]}</td>${KEYS.map(k => `<td>${fmt(r[k])}</td>`).join('')}</tr>`).join('')
    || `<tr><td colspan="${COLS.length}" class="empty">No matching cities</td></tr>`;
}

function renderFavs() {
  const list = [...favs].map(id => byId.get(id)).filter(Boolean);
  $('favs').innerHTML = list.length
    ? `<span class="lbl">Your cities</span>` + list.map(r => `<button class="chip" data-id="${r.id}" style="--c:${cv(r.cat)}"><span class="dot"></span>${esc(r.name)} <b>${r.aqi}</b></button>`).join('')
    : `<span class="sub">Tip: press “Save city” on any city and it stays pinned here on every visit.</span>`;
}

$('scale').innerHTML = CATS.map((c, i) => `<tr><td><span class="pill" style="--c:${cv(i)}"><span class="dot"></span>${c[0]}</span></td><td>${c[1]}</td><td>${c[2]}</td></tr>`).join('');

/* ================= city panel ================= */
function select(id, scroll) {
  selId = id; renderCity(); drawPulse();
  window.history.replaceState(null, '', `#${cur}/${id}`);
  if (scroll) $('city').scrollIntoView({behavior: reduced ? 'auto' : 'smooth', block: 'start'});
}

function renderCity() {
  const r = byId.get(selId); if (!r) return;
  const newCity = shown.id !== r.id, newReading = newCity || shown.cur !== cur;
  $('cName').textContent = r.name;
  $('cMeta').textContent = `${r.state} · population ${r.pop.toLocaleString('en-IN')}`;
  countUp($('cAqi'), r.aqi);
  $('cCat').innerHTML = pill(r.aqi);
  $('city').style.setProperty('--cc', cv(r.cat));
  $('cGauge').style.left = Math.min(r.aqi, 500) / 5 + '%';
  $('cDelta').innerHTML = r.delta == null ? '' : r.delta === 0 ? 'No change since last reading' : `<span class="delta ${r.delta > 0 ? 'up' : 'down'}">${signed(r.delta)}</span> since last reading`;
  $('cRank').textContent = `#${rows.filter(x => x.aqi > r.aqi).length + 1} most polluted of ${rows.length}`;
  $('cHealthTitle').textContent = `Health advice · ${CATS[r.cat][0]}`;
  $('cAdvice').innerHTML = `<li>${esc(CATS[r.cat][2])}</li>` + CATS[r.cat][3].map(t => `<li><svg class="i"><use href="#i-check"/></svg>${esc(t)}</li>`).join('');
  const cig = (r.pm25 ?? 0) / 22;
  $('cCig').textContent = cig < 0.1 ? 'Almost nothing' : `${cig.toFixed(1)} cigarette${cig >= 1.05 ? 's' : ''}`;
  $('cCigNote').textContent = r.pm25 == null ? '' : `24-hour average PM2.5 here is ${fmt(r.pm25)} µg/m³.`;
  $('cPols').innerHTML = KEYS.map(k => `<div class="pol${k === r.dom ? ' dom' : ''}"><div class="k"><span>${POL[k][0]}</span><span>${k === r.dom ? 'dominant' : POL[k][2]}</span></div><div class="x">${fmt(r[k])} <small>${POL[k][1]}</small></div></div>`).join('');
  updateStar(); updateCmpBtn();
  if (newReading) particles.set(r.pm25);
  if (newCity) { loadWiki(r); loadWeather(r); }
  if (newReading) renderCityTab();
  shown = {id: r.id, cur};
}
function updateStar() {
  const on = favs.has(selId);
  $('star').setAttribute('aria-pressed', on); $('star').querySelector('span').textContent = on ? 'Saved' : 'Save city';
}
function updateCmpBtn() {
  const on = compare.some(c => c.id === selId);
  $('cmpBtn').setAttribute('aria-pressed', on); $('cmpBtn').querySelector('span').textContent = on ? 'Comparing' : 'Compare';
}

// Wikimedia serves only some thumbnail widths; 500 and 960 are among them.
const sized = (src, w) => src.replace(/\/\d+px-/, `/${w}px-`);
const wikiSummary = memo(async id => {
  const c = cities[id];
  const get = t => fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`).then(r => r.ok ? r.json() : null).catch(() => null);
  const ok = d => d && d.type === 'standard' && /India/.test((d.description || '') + d.extract);
  let d = await get(c.name);
  if (!ok(d)) d = await get(`${c.name}, ${c.state}`);
  return ok(d) ? d : null;
});
const wiki = c => wikiSummary(c.id);
async function loadWiki(c) {
  const box = $('cPhoto');
  box.textContent = ''; $('cWiki').textContent = ''; $('cWikiLink').hidden = true;
  const d = await wiki(c);
  if (c.id !== selId) return;
  if (d?.thumbnail) {
    const img = new Image(); img.alt = `Photo of ${c.name}`;
    img.src = sized(d.thumbnail.source, 960);
    img.onerror = () => { img.onerror = null; img.src = d.thumbnail.source; };
    box.append(img);
  } else box.textContent = 'No photo available';
  if (d) { $('cWiki').textContent = d.extract; $('cWikiLink').href = d.content_urls.desktop.page; $('cWikiLink').hidden = false; }
}

/* ---- weather ---- */
function wmo(code, day) {
  const sun = day ? '☀️' : '🌙';
  if (code === 0) return ['Clear sky', sun];
  if (code <= 2) return [code === 1 ? 'Mainly clear' : 'Partly cloudy', day ? '⛅' : '☁️'];
  if (code === 3) return ['Overcast', '☁️'];
  if (code <= 48) return ['Fog', '🌫️'];
  if (code <= 57) return ['Drizzle', '🌦️'];
  if (code <= 67) return [code <= 61 ? 'Light rain' : code === 65 ? 'Heavy rain' : 'Rain', '🌧️'];
  if (code <= 77) return ['Snow', '🌨️'];
  if (code <= 82) return ['Rain showers', '🌦️'];
  if (code <= 86) return ['Snow showers', '🌨️'];
  return ['Thunderstorm', '⛈️'];
}
const compass = d => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(d / 22.5) % 16];
const weather = memo(id => {
  const c = cities[id];
  return getJSON(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day,uv_index&timezone=auto`).then(d => d.current);
});
async function loadWeather(r) {
  const box = $('cWx');
  box.innerHTML = '';
  try {
    const w = await weather(r.id);
    if (r.id !== selId) return;
    const [txt, icon] = wmo(w.weather_code, w.is_day);
    box.innerHTML = `<span>${icon} <b>${Math.round(w.temperature_2m)}°C</b> ${txt}</span>
      <span>Feels <b>${Math.round(w.apparent_temperature)}°</b></span>
      <span>💧 <b>${w.relative_humidity_2m}%</b></span>
      <span>🌬️ <b>${Math.round(w.wind_speed_10m)} km/h</b> <span class="arrow" style="transform:rotate(${(w.wind_direction_10m + 180) % 360}deg)">↑</span> ${compass(w.wind_direction_10m)}</span>
      ${w.uv_index != null ? `<span>UV <b>${Math.round(w.uv_index)}</b></span>` : ''}`;
  } catch { /* weather is a nice-to-have; the panel works without it */ }
}

/* ---- tabs ---- */
function renderCityTab() {
  document.querySelectorAll('#ctabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === cityTab));
  for (const t of ['forecast', 'history', 'calendar']) $(`tab-${t}`).hidden = t !== cityTab;
  const r = byId.get(selId);
  ({forecast: loadForecast, history: loadHistory, calendar: loadCalendar})[cityTab](r);
}

/* ---- 48-hour forecast ---- */
const forecast = memo(async id => {
  const c = cities[id];
  const d = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${c.lat}&longitude=${c.lon}&hourly=${API_VARS.join(',')}&past_hours=24&forecast_hours=48&timezone=Asia%2FKolkata`);
  const h = d.hourly, pts = [];
  for (let i = 24; i < h.time.length; i++) {
    const subs = [];
    KEYS.forEach((k, j) => {
      const vals = h[API_VARS[j]].slice(i - HOURS[k] + 1, i + 1).filter(v => v != null);
      if (!vals.length) return;
      let mean = vals.reduce((a, b) => a + b) / vals.length;
      if (k === 'co') mean /= 1000;
      subs.push(subIndex(k, mean));
    });
    // hv: this hour's particulate AQI (no averaging), which is what matters for timing a walk.
    const pm = [['pm25', h.pm2_5[i]], ['pm10', h.pm10[i]]].filter(([, c]) => c != null).map(([k, c]) => subIndex(k, c));
    pts.push({t: new Date(h.time[i] + ':00+05:30'), v: subs.length ? Math.round(Math.max(...subs)) : null, hv: pm.length ? Math.max(...pm) : null});
  }
  return pts;
});
// Cleanest and dirtiest two-hour daylight window (6 AM to 8 PM) in the next 24 hours, by hourly particulate AQI.
function windows(pts) {
  const now = Date.now(), soon = pts.filter(p => p.t >= now - 36e5 && p.t <= now + 864e5);
  let best = null, worst = null;
  for (let i = 0; i < soon.length - 1; i++) {
    const hr = istHour(soon[i].t), a = soon[i].hv, b = soon[i + 1].hv;
    if (hr < 6 || hr > 19 || a == null || b == null) continue;
    const w = {aqi: Math.round((a + b) / 2), from: soon[i].t, to: new Date(+soon[i].t + 72e5)};
    if (!best || w.aqi < best.aqi) best = w;
    if (!worst || w.aqi > worst.aqi) worst = w;
  }
  return {best, worst};
}
const winLabel = w => {
  const day = dayKey(w.from) === dayKey(Date.now()) ? 'Today' : 'Tomorrow';
  const h = t => t.toLocaleTimeString('en-IN', {hour: 'numeric', ...IST});
  return `${day}, ${h(w.from)} – ${h(w.to)}`;
};
async function loadForecast(r) {
  const box = $('fChart');
  box.classList.add('busy');
  try {
    const pts = await forecast(r.id);
    if (r.id !== selId || cityTab !== 'forecast') return;
    const {best, worst} = windows(pts);
    const vals = pts.map(p => p.v).filter(v => v != null), peak = Math.max(...vals);
    $('fBest').innerHTML = best ? `<div class="good"><div class="k">🌿 Best time to be outdoors</div><div class="v">${winLabel(best)}</div><div class="s">Hourly AQI around ${best.aqi} (${CATS[cat(best.aqi)][0]})</div></div>
      <div class="bad"><div class="k">😷 Most polluted hours ahead</div><div class="v">${winLabel(worst)}</div><div class="s">Hourly AQI around ${worst.aqi} (${CATS[cat(worst.aqi)][0]}) · 24-hour AQI peaks at ${peak}</div></div>` : '';
    lineChart(box, [{name: r.name, color: 'var(--ink2)', pts}], {dotsByCat: true, now: true, label: `${r.name} AQI forecast for the next 48 hours`,
      bands: best ? [{from: best.from, to: best.to, label: 'Cleanest'}] : []});
  } catch {
    if (r.id === selId) { $('fBest').innerHTML = ''; lineChart(box, [], {empty: 'The forecast is unavailable right now. Please try again in a minute.'}); }
  } finally {
    box.classList.remove('busy');
  }
}

/* ---- history ---- */
async function loadHistory(r) {
  const end = idTime(cur), start = histDays ? new Date(+end - histDays * 864e5) : new Date(0);
  const pts = (await readings([r.id], start, end)).map(p => ({id: p.id, t: p.t, v: p.v[0]})).filter(p => p.v != null);
  if (r.id !== selId || cityTab !== 'history') return;
  lineChart($('hChart'), [{name: r.name, color: 'var(--ink2)', pts}], {dotsByCat: true, label: `${r.name} AQI history`,
    empty: 'History fills in as new readings arrive at 6 AM and 6 PM IST each day.'});
  $('hReadings').innerHTML = [...pts].reverse().map(p => `<tr><td>${esc(dateLabel(p.id.slice(0, 10)))}, ${timeLabel(p.id)}</td><td>${p.v}</td><td>${CATS[cat(p.v)][0]}</td></tr>`).join('');
}

/* ---- calendar heatmap ---- */
const WEEKS = 20;
async function loadCalendar(r) {
  const now = new Date(), wall = new Date(+now + 198e5), dow = (wall.getUTCDay() + 6) % 7; // 0 = Monday, in IST
  const start = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() - dow - (WEEKS - 1) * 7);
  const pts = await readings([r.id], new Date(start - 198e5), now);
  if (r.id !== selId || cityTab !== 'calendar') return;
  const days = new Map();
  for (const p of pts) {
    const v = p.v[0]; if (v == null) continue;
    const k = dayKey(p.t), d = days.get(k) || {max: 0, n: 0};
    d.max = Math.max(d.max, v); d.n++; days.set(k, d);
  }
  const today = dayKey(now);
  let cells = '', months = '', prevMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const monday = new Date(start + w * 7 * 864e5), mo = monday.getUTCMonth();
    months += `<span>${mo !== prevMonth && w < WEEKS - 1 ? monday.toLocaleDateString('en-IN', {month: 'short', timeZone: 'UTC'}) : ''}</span>`;
    prevMonth = mo;
    for (let d = 0; d < 7; d++) {
      const key = new Date(start + (w * 7 + d) * 864e5).toISOString().slice(0, 10), v = days.get(key);
      cells += key > today ? `<span class="cell future" style="--w:${w}"></span>`
        : v ? `<span class="cell data" style="--w:${w};--c:${cv(cat(v.max))}" data-k="${key}" data-v="${v.max}" data-n="${v.n}"></span>`
        : `<span class="cell" style="--w:${w}" data-k="${key}"></span>`;
    }
  }
  $('calScroll').innerHTML = `<div class="cal" role="img" aria-label="Worst AQI of each day for ${esc(r.name)} over the last ${WEEKS} weeks">
    <span></span><div class="cal-months">${months}</div>
    <div class="cal-days"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span></span></div>
    <div class="cal-grid">${cells}</div></div>`;
  $('calScroll').scrollLeft = $('calScroll').scrollWidth;
  $('calLegend').innerHTML = `<span>Worst AQI of the day:</span>` + CATS.map((c, i) => `<span><i style="--c:${cv(i)}"></i>${c[0]}</span>`).join('') + `<span><i style="--c:var(--hover)"></i>No reading</span>`;
  const list = [...days.entries()], worst = list.sort((a, b) => b[1].max - a[1].max)[0];
  $('calSum').innerHTML = list.length
    ? `<span>Days tracked <b>${list.length}</b></span><span>Good or satisfactory days <b>${list.filter(([, d]) => d.max <= 100).length}</b></span><span>Worst day <b>${esc(dateLabel(worst[0]))}</b> · AQI <b>${worst[1].max}</b></span>`
    : '<span>The calendar fills in as readings arrive.</span>';
}
$('calScroll').addEventListener('pointerover', e => {
  const c = e.target.closest('.cell[data-k]'), tip = $('calTip');
  if (!c) { tip.style.opacity = 0; return; }
  tip.innerHTML = c.dataset.v ? `<strong>${c.dataset.v}</strong>${pill(+c.dataset.v)}<span class="t">${esc(dateLabel(c.dataset.k))} · worst of ${c.dataset.n} reading${c.dataset.n > 1 ? 's' : ''}</span>` : `<span class="t">${esc(dateLabel(c.dataset.k))} · no reading</span>`;
  const b = c.getBoundingClientRect(), w = $('calScroll').parentElement.getBoundingClientRect();
  tip.style.opacity = 1;
  tip.style.left = Math.min(Math.max(b.left - w.left - tip.offsetWidth / 2 + 7, 0), w.width - tip.offsetWidth) + 'px';
  tip.style.top = (b.top - w.top - tip.offsetHeight - 8) + 'px';
});
$('calScroll').addEventListener('pointerleave', () => $('calTip').style.opacity = 0);

/* ---- air particles (density follows PM2.5) ---- */
const particles = (() => {
  const cvs = $('air'), ctx = cvs.getContext('2d');
  let ps = [], color = '#888', raf = 0, visible = false, w = 0, h = 0, pm = 0;
  function size() {
    const b = cvs.getBoundingClientRect(), d = devicePixelRatio || 1;
    w = b.width; h = b.height; cvs.width = Math.round(w * d); cvs.height = Math.round(h * d); ctx.setTransform(d, 0, 0, d, 0, 0);
  }
  function seed() {
    const n = Math.round(Math.min(320, Math.max(12, pm * 2.2)));
    ps = Array.from({length: n}, () => ({x: Math.random() * w, y: Math.random() * h, r: .6 + Math.random() * 1.8, vx: (Math.random() - .5) * .3, vy: -.05 - Math.random() * .25, a: .25 + Math.random() * .6}));
  }
  function draw() {
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = color;
    for (const p of ps) { ctx.globalAlpha = p.a; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function step() {
    for (const p of ps) {
      p.vx = Math.max(-.4, Math.min(.4, p.vx + (Math.random() - .5) * .03));
      p.x += p.vx; p.y += p.vy;
      if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
      if (p.x < -4) p.x = w + 4; else if (p.x > w + 4) p.x = -4;
    }
    draw(); raf = requestAnimationFrame(step);
  }
  function run() { cancelAnimationFrame(raf); if (visible && !reduced && !document.hidden) raf = requestAnimationFrame(step); }
  const recolor = () => { color = css(`--c${cat(subIndex('pm25', pm))}`); draw(); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; run(); }).observe(cvs);
  document.addEventListener('visibilitychange', run);
  return {
    set(v) { pm = v || 0; size(); seed(); recolor(); run(); },
    recolor,
    resize() { size(); seed(); draw(); },
  };
})();

/* ================= compare ================= */
function toggleCompare(id) {
  const i = compare.findIndex(c => c.id === id);
  if (i >= 0) compare.splice(i, 1);
  else {
    if (compare.length >= 3) { toast('You can compare up to 3 cities. Remove one first.'); return; }
    const used = new Set(compare.map(c => c.slot));
    compare.push({id, slot: [1, 2, 3].find(s => !used.has(s))});
    toast(`${cities[id].name} added to the comparison`);
  }
  store.set('compare', compare); updateCmpBtn(); renderCompare();
}
async function renderCompare() {
  const list = compare.map(c => ({...c, r: byId.get(c.id)})).filter(c => c.r);
  $('compare').hidden = !list.length;
  if (!list.length) return;
  const maxes = Object.fromEntries(KEYS.map(k => [k, Math.max(1e-9, ...list.map(c => c.r[k] ?? 0))]));
  $('cmpCards').innerHTML = list.map(({r, slot}) => `<article class="cmp" style="--sc:var(--s${slot})">
      <div class="bar"></div><div class="ph" data-ph="${r.id}"></div>
      <button class="x" data-rm="${r.id}" aria-label="Remove ${esc(r.name)} from comparison">×</button>
      <div class="bd"><div class="nm"><span class="key"></span>${esc(r.name)}</div><div class="sub">${esc(r.state)}</div>
        <div class="aq"><b>${r.aqi}</b>${pill(r.aqi)}</div>
        ${KEYS.map(k => `<div class="pbar"><span>${POL[k][0]}</span><span class="tr"><i style="width:${(r[k] ?? 0) / maxes[k] * 100}%"></i></span><span class="vv">${fmt(r[k])}</span></div>`).join('')}
      </div></article>`).join('')
    + (list.length < 3 ? `<div class="cmp-empty">Open another city and press <b>Compare</b> to add it here.</div>` : '');
  list.forEach(({r}) => wiki(r).then(d => { const ph = $('cmpCards').querySelector(`[data-ph="${r.id}"]`); if (ph && d?.thumbnail) ph.style.backgroundImage = `url("${sized(d.thumbnail.source, 500)}")`; }));
  $('cmpLegend').innerHTML = list.map(({r, slot}) => `<span class="lg" style="--sc:var(--s${slot})"><i></i>${esc(r.name)}</span>`).join('');
  const end = idTime(cur), start = cmpDays ? new Date(+end - cmpDays * 864e5) : new Date(0);
  const pts = await readings(list.map(c => c.id), start, end);
  lineChart($('cmpChart'), list.map(({r, slot}, j) => ({name: r.name, color: `var(--s${slot})`, pts: pts.map(p => ({id: p.id, t: p.t, v: p.v[j]}))})),
    {label: 'AQI of the compared cities over time', empty: 'The comparison chart fills in as readings arrive.'});
}

/* ================= line chart ================= */
// series: [{name, color, pts: [{t: Date, v}]}]. Hover, touch and arrow keys move a crosshair.
function lineChart(box, series, opt = {}) {
  const tip = box.querySelector('.tip');
  box.querySelector('svg')?.remove(); box.querySelector('.empty')?.remove();
  tip.style.opacity = 0;
  const clean = series.map(s => ({...s, pts: s.pts.filter(p => p.v != null)}));
  const all = clean.flatMap(s => s.pts);
  if (new Set(all.map(p => +p.t)).size < 2) { box.insertAdjacentHTML('beforeend', `<div class="empty">${opt.empty || 'Not enough data yet.'}</div>`); return; }
  const multi = clean.length > 1, W = box.clientWidth || 600, H = 250;
  const m = {l: 36, r: multi ? 90 : 12, t: 14, b: 26};
  const t0 = Math.min(...all.map(p => +p.t)), t1 = Math.max(...all.map(p => +p.t)), span = t1 - t0;
  const top = [100, 200, 300, 400, 500].find(b => b >= Math.max(...all.map(p => p.v))) || 500;
  const x = t => m.l + (t - t0) / (span || 1) * (W - m.l - m.r), y = v => m.t + (1 - v / top) * (H - m.t - m.b);
  const tf = span <= 3 * 864e5 ? {weekday: 'short', hour: 'numeric'} : {day: 'numeric', month: 'short'};
  const xl = t => new Date(t).toLocaleString('en-IN', {...tf, ...IST});
  const n = Math.max(1, Math.min(6, Math.floor((W - m.l - m.r) / 100))), ticks = [];
  for (let i = 0; i <= n; i++) { const t = t0 + span * i / n; if (!ticks.length || xl(t) !== xl(ticks.at(-1))) ticks.push(t); }
  const bands = (opt.bands || []).map(b => `<rect class="band" x="${x(+b.from)}" y="${m.t}" width="${Math.max(3, x(+b.to) - x(+b.from))}" height="${H - m.t - m.b}"/><text class="bandlbl" x="${x(+b.from) + 4}" y="${m.t + 12}">${esc(b.label)}</text>`).join('');
  const nowT = Date.now(), now = opt.now && nowT > t0 && nowT < t1 ? `<line class="nowline" x1="${x(nowT)}" x2="${x(nowT)}" y1="${m.t}" y2="${H - m.b}"/><text class="nowlbl" x="${x(nowT) + 4}" y="${H - m.b - 6}">Now</text>` : '';
  const paths = clean.map(s => `<path class="ln" pathLength="1" stroke="${s.color}" d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(+p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')}"/>`).join('');
  const dots = opt.dotsByCat && clean[0].pts.length <= 120 ? clean[0].pts.map((p, i) => `<circle class="pt" style="animation-delay:${500 + i * 14}ms" cx="${x(+p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="4" fill="${cv(cat(p.v))}"/>`).join('') : '';
  let labels = '';
  if (multi) {
    const ends = clean.map(s => s.pts.length && {s, y: y(s.pts.at(-1).v)}).filter(Boolean).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 15);
    labels = ends.map(e => `<text class="endlbl" x="${W - m.r + 8}" y="${(e.y + 4).toFixed(1)}">${esc(e.s.name)}</text>`).join('');
  }
  box.insertAdjacentHTML('beforeend', `<svg viewBox="0 0 ${W} ${H}" height="${H}" tabindex="0" role="img" aria-label="${esc(opt.label || 'AQI chart')}. Use the arrow keys to step through readings.">
    ${bands}<g class="axis">${INDEX.filter(g => g <= top).map(g => `<line x1="${m.l}" x2="${W - m.r}" y1="${y(g)}" y2="${y(g)}"/><text x="${m.l - 8}" y="${y(g) + 4}" text-anchor="end">${g}</text>`).join('')}
    ${ticks.map((t, i) => `<text x="${x(t)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle'}">${xl(t)}</text>`).join('')}</g>
    ${now}${paths}${dots}${labels}
    <line class="xh" y1="${m.t}" y2="${H - m.b}" opacity="0"/>
    ${clean.map((s, i) => `<circle class="xp" data-s="${i}" r="5.5" stroke="${s.color}" opacity="0"/>`).join('')}
    <rect x="${m.l}" y="0" width="${W - m.l - m.r}" height="${H}" fill="transparent"/>
  </svg>`);
  const svg = box.querySelector('svg'), xh = svg.querySelector('.xh'), xps = svg.querySelectorAll('.xp');
  const times = [...new Set(all.map(p => +p.t))].sort((a, b) => a - b);
  const at = clean.map(s => new Map(s.pts.map(p => [+p.t, p])));
  let k = times.length - 1;
  const when = t => new Date(t).toLocaleString('en-IN', {weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', ...IST});
  const show = i => {
    k = Math.max(0, Math.min(times.length - 1, i));
    const t = times[k], px = x(t);
    xh.setAttribute('x1', px); xh.setAttribute('x2', px); xh.setAttribute('opacity', 1);
    let py = H;
    xps.forEach((c, j) => { const p = at[j].get(t); c.setAttribute('opacity', p ? 1 : 0); if (p) { c.setAttribute('cx', px); c.setAttribute('cy', y(p.v)); py = Math.min(py, y(p.v)); } });
    if (multi) {
      tip.innerHTML = `<span class="t" style="margin:0 0 4px">${esc(when(t))}</span>` + clean.map((s, j) => { const p = at[j].get(t); return p ? `<div class="r" style="--sc:${s.color}"><i></i><b>${p.v}</b><span>${esc(s.name)} · ${CATS[cat(p.v)][0]}</span></div>` : ''; }).join('');
    } else {
      const p = at[0].get(t);
      tip.innerHTML = `<strong>${p.v}</strong>${pill(p.v)}<span class="t">${esc(when(t))}</span>`;
    }
    tip.style.opacity = 1;
    const tw = tip.offsetWidth;
    tip.style.left = Math.min(Math.max(px - tw / 2, 0), W - tw) + 'px';
    tip.style.top = Math.max(py - tip.offsetHeight - 14, -10) + 'px';
  };
  const hide = () => { tip.style.opacity = 0; xh.setAttribute('opacity', 0); xps.forEach(c => c.setAttribute('opacity', 0)); };
  svg.addEventListener('pointermove', e => {
    const b = svg.getBoundingClientRect(), t = t0 + ((e.clientX - b.left) * W / b.width - m.l) / (W - m.l - m.r) * span;
    let best = 0; times.forEach((tt, i) => { if (Math.abs(tt - t) < Math.abs(times[best] - t)) best = i; }); show(best);
  });
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('focus', () => show(k)); svg.addEventListener('blur', hide);
  svg.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') { show(k - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { show(k + 1); e.preventDefault(); } });
}

/* ================= search & near me ================= */
const find = $('find'), results = $('results');
let hits = [], active = 0;
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function mark(name, q) {
  const i = norm(name).indexOf(q);
  return i < 0 ? esc(name) : esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
}
function openResults() {
  const q = norm(find.value.trim());
  if (!q || !rows.length) { closeResults(); return; }
  hits = rows.map(r => { const n = norm(r.name), s = norm(r.state); return [r, n.startsWith(q) ? 0 : n.includes(q) ? 1 : s.startsWith(q) ? 2 : 9]; })
    .filter(h => h[1] < 9).sort((a, b) => a[1] - b[1] || b[0].pop - a[0].pop).slice(0, 8).map(h => h[0]);
  active = 0;
  results.innerHTML = hits.length
    ? hits.map((r, i) => `<li role="option" id="opt${i}" data-id="${r.id}" aria-selected="${i === 0}"><span>${mark(r.name, q)} <span class="st">${esc(r.state)}</span></span><span class="pill" style="--c:${cv(r.cat)}"><span class="dot"></span>${r.aqi} · ${CATS[r.cat][0]}</span></li>`).join('')
    : `<li class="none">No city matches “${esc(find.value.trim())}”</li>`;
  results.hidden = false; find.setAttribute('aria-expanded', 'true');
  find.setAttribute('aria-activedescendant', hits.length ? 'opt0' : '');
}
function closeResults() { results.hidden = true; find.setAttribute('aria-expanded', 'false'); }
function moveActive(d) {
  if (!hits.length) return;
  active = (active + d + hits.length) % hits.length;
  results.querySelectorAll('li').forEach((li, i) => li.setAttribute('aria-selected', i === active));
  results.children[active].scrollIntoView({block: 'nearest'});
  find.setAttribute('aria-activedescendant', 'opt' + active);
}
function pick(id) {
  const r = byId.get(id); if (!r) return;
  if ($('state').value && $('state').value !== r.state) { $('state').value = ''; renderAll(); }
  find.value = r.name; closeResults();
  map.flyTo([r.lat, r.lon], 7, {duration: reduced ? 0 : .9});
  select(id, true);
}
find.addEventListener('input', openResults);
find.addEventListener('focus', () => find.value && openResults());
find.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown') { e.preventDefault(); results.hidden ? openResults() : moveActive(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
  else if (e.key === 'Enter' && hits[active] && !results.hidden) { e.preventDefault(); pick(hits[active].id); }
  else if (e.key === 'Escape') closeResults();
});
results.addEventListener('mousedown', e => { const li = e.target.closest('li[data-id]'); if (li) { e.preventDefault(); pick(+li.dataset.id); } });
find.addEventListener('blur', () => setTimeout(closeResults, 120));
addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); find.focus(); } });

$('near').onclick = () => {
  const msg = $('geoMsg');
  if (!navigator.geolocation) { msg.textContent = 'Your browser does not share location.'; return; }
  msg.textContent = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(pos => {
    const {latitude: la, longitude: lo} = pos.coords, k = Math.cos(la * Math.PI / 180);
    let best, bd = Infinity;
    for (const r of rows) { const d = (r.lat - la) ** 2 + ((r.lon - lo) * k) ** 2; if (d < bd) { bd = d; best = r; } }
    const km = Math.round(Math.sqrt(bd) * 111);
    msg.textContent = km > 300 ? `The nearest tracked city is ${best.name}, about ${km} km away.` : '';
    pick(best.id);
  }, () => { msg.textContent = 'Location permission was denied. Search for your city instead.'; }, {timeout: 10000, maximumAge: 6e5});
};

/* ================= actions & events ================= */
$('star').onclick = () => {
  favs.has(selId) ? favs.delete(selId) : favs.add(selId);
  store.set('favs', [...favs]); updateStar(); renderFavs();
  toast(favs.has(selId) ? 'City saved to your list' : 'City removed from your list');
};
$('cmpBtn').onclick = () => toggleCompare(selId);
$('cmpCards').onclick = e => { const b = e.target.closest('[data-rm]'); b && toggleCompare(+b.dataset.rm); };
$('cmpClear').onclick = () => { compare = []; store.set('compare', compare); updateCmpBtn(); renderCompare(); };
$('share').onclick = async () => {
  const r = byId.get(selId), url = location.href, text = `Air quality in ${r.name}: AQI ${r.aqi} (${CATS[r.cat][0]})`;
  if (navigator.share) { try { await navigator.share({title: document.title, text, url}); } catch {} return; }
  try { await navigator.clipboard.writeText(`${text} ${url}`); toast('Link copied'); } catch { toast('Copy failed'); }
};
$('csv').onclick = () => {
  const q = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
  const lines = [['City', 'State', 'AQI', 'Category', 'Dominant', ...KEYS.map(k => `${POL[k][0]} (${POL[k][1]})`)].join(',')];
  [...view()].sort((a, b) => b.aqi - a.aqi).forEach(r => lines.push([r.name, r.state, r.aqi, CATS[r.cat][0], POL[r.dom][0], ...KEYS.map(k => r[k] ?? '')].map(q).join(',')));
  const a = Object.assign(document.createElement('a'), {href: URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], {type: 'text/csv'})), download: `india-aqi-${cur}.csv`});
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('date').onchange = e => load(index.filter(i => i.startsWith(e.target.value)).at(-1));
$('times').onclick = e => e.target.dataset.id && load(e.target.dataset.id);
$('prev').onclick = () => load(index[index.indexOf(cur) - 1]);
$('next').onclick = () => load(index[index.indexOf(cur) + 1]);
$('state').onchange = () => { if (!view().some(r => r.id === selId)) selId = null; if (!$('state').value) map.setView([22.8, 80.5], 4.5); renderAll(); };
$('q').oninput = renderTable;
$('thead').onclick = e => { const k = e.target.dataset.k; if (!k) return; sortDir = k === sortKey ? -sortDir : (['name', 'state', 'dom'].includes(k) ? 1 : -1); sortKey = k; renderTable(); };
$('tbody').onclick = e => { const tr = e.target.closest('tr[data-id]'); tr && select(+tr.dataset.id, true); };
$('tbody').onkeydown = e => { const tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') select(+tr.dataset.id, true); };
$('rank').onclick = e => { const b = e.target.closest('button'); b && select(+b.dataset.id, true); };
$('favs').onclick = e => { const b = e.target.closest('button[data-id]'); b && pick(+b.dataset.id); };
$('gallery').onclick = e => { const b = e.target.closest('.gcard'); b && pick(+b.dataset.id); };
$('tickerTrack').onclick = e => { const b = e.target.closest('.tk'); b && pick(+b.dataset.id); };
document.querySelector('.gnav').onclick = e => { const b = e.target.closest('[data-g]'); b && $('gallery').scrollBy({left: +b.dataset.g * 480, behavior: reduced ? 'auto' : 'smooth'}); };
$('bars').onclick = e => { const b = e.target.closest('button[data-state]'); if (!b) return; $('state').value = $('state').value === b.dataset.state ? '' : b.dataset.state; $('state').onchange(); };
$('rankTabs').onclick = e => { const d = e.target.dataset.rank; if (!d) return; rankMode = d; e.currentTarget.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.target)); renderRank(); };
$('ctabs').onclick = e => { const b = e.target.closest('button'); if (!b || b.dataset.tab === cityTab) return; cityTab = b.dataset.tab; renderCityTab(); };
$('ctabs').onkeydown = e => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tabs = [...$('ctabs').children], i = tabs.findIndex(b => b.dataset.tab === cityTab), n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  cityTab = n.dataset.tab; n.focus(); renderCityTab();
};
const rangeTabs = (id, set) => $(id).onclick = e => { const d = e.target.dataset.days; if (d == null) return; set(+d); $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b === e.target)); };
rangeTabs('hRange', d => { histDays = d; loadHistory(byId.get(selId)); });
rangeTabs('cmpRange', d => { cmpDays = d; renderCompare(); });
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { particles.resize(); if (rows.length) { renderCityTab(); renderCompare(); } }, 200); });

// Reveal cards as they scroll into view.
const revealObs = 'IntersectionObserver' in window && new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), {rootMargin: '0px 0px -6% 0px'});
document.querySelectorAll('.reveal').forEach(el => revealObs ? revealObs.observe(el) : el.classList.add('in'));
new IntersectionObserver(([e]) => $('fab').classList.toggle('show', !e.isIntersecting)).observe($('top'));
$('fab').onclick = () => scrollTo({top: 0, behavior: reduced ? 'auto' : 'smooth'});

// Installable app.
let installEvt;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; $('install').hidden = false; });
$('install').onclick = async () => { if (!installEvt) return; installEvt.prompt(); await installEvt.userChoice; installEvt = null; $('install').hidden = true; };
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ================= boot ================= */
(async () => {
  clock.run(); slides.start();
  try {
    [cities, index] = await Promise.all([getJSON('data/cities.json'), getJSON('data/index.json')]);
  } catch {
    $('stamp').textContent = 'Could not load data.'; document.body.classList.remove('loading'); return;
  }
  $('cityCount').textContent = cities.length;
  [...new Set(cities.map(c => c.state))].sort().forEach(s => $('state').add(new Option(s, s)));
  const [h, c] = location.hash.slice(1).split('/');
  if (c) selId = +c;
  load(index.includes(h) ? h : index.at(-1));
  renderHero().catch(() => {});
})();
