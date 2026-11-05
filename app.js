/* ================= НАСТРОЙКИ =================
   На сайте их задаёт файл config.js (window.ZVEZDNY_CONFIG); здесь — значения по умолчанию (демо). */
const CONFIG = Object.assign({
  twitchClientId: '',        // Client ID приложения Twitch
  channel: 'zvezdny_kanal',  // логин канала маленькими буквами
  supabaseUrl: '',           // https://xxxx.supabase.co
  supabaseAnonKey: ''        // публичный anon / publishable ключ
}, window.ZVEZDNY_CONFIG || {});
const TWITCH = {clientId: CONFIG.twitchClientId, channel: String(CONFIG.channel).toLowerCase(), scopes: []};
const SUPABASE = {url: String(CONFIG.supabaseUrl).replace(/\/$/, ''), anonKey: CONFIG.supabaseAnonKey};
const LIVE = !!(SUPABASE.url && SUPABASE.anonKey);
const CHAT_AUTH = LIVE && !TWITCH.clientId; // без приложения Twitch: вход кодом в чате
const ADMIN_KEY_LS = 'zvezdny-admin-key';
let ADMIN_KEY = ''; try { ADMIN_KEY = localStorage.getItem(ADMIN_KEY_LS) || ''; } catch(e){}
let ADMIN_OK = false; // ключ стримера подтверждён сервером
const IMG = {"cry": "img/cry.webp", "oops": "img/oops.webp", "love": "img/love.webp", "smug": "img/smug.webp", "surf": "img/surf.webp", "sun": "img/sun.webp", "moon": "img/moon.webp", "gaze": "img/gaze.webp", "shades": "img/shades.webp", "bunny": "img/bunny.webp"};
const STAR = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1 7.3 4.7 11 6 7.3 7.3 6 11 4.7 7.3 1 6 4.7 4.7Z" fill="currentColor"/></svg>';
const RAR = {
  common:   {label:'Обычная',     w:50, dust:10,  craft:60,   hex:'#9CA3AF'},
  rare:     {label:'Редкая',      w:30, dust:25,  craft:150,  hex:'#3B82F6'},
  epic:     {label:'Эпическая',   w:15, dust:100, craft:500,  hex:'#A855F7'},
  legendary:{label:'Легендарная', w:5,  dust:400, craft:1600, hex:'#F59E0B'}
};
const DEFAULT_CARDS = [
  {id:'cry',    no:1,  name:'Слёзы счастья',   r:'common',    flavor:'Когда донат пришёл в самый нужный момент'},
  {id:'oops',   no:2,  name:'Ой-ой',           r:'rare',      flavor:'Чат, я ничего не видела. Совсем ничего.'},
  {id:'love',   no:3,  name:'Мяу-любовь',      r:'epic',      flavor:'Рейд на двести человек. Сердечко на максимум.'},
  {id:'smug',   no:4,  name:'Хитрый план',     r:'legendary', flavor:'Всё идёт по плану. По какому — секрет.'},
  {id:'gaze',   no:5,  name:'Взгляд в упор',   r:'common',    flavor:'Смотрит в самую душу. И в чат заодно.', tall:true},
  {id:'sun',    no:6,  name:'Солнечный зайчик',r:'common',    flavor:'Улыбка, от которой в лесу светлеет.', tall:true},
  {id:'surf',   no:7,  name:'Летний заплыв',   r:'rare',      flavor:'Плюшевый друг не утонет. Проверено.', tall:true},
  {id:'shades', no:8,  name:'Через очки',      r:'rare',      flavor:'Один взгляд поверх оправы — и чат замолкает.', tall:true},
  {id:'bunny',  no:9,  name:'Хмурый кролик',   r:'epic',      flavor:'Не дуется. Просто думает. Очень сердито.', tall:true},
  {id:'moon',   no:10, name:'Лунная демоница', r:'legendary', flavor:'Появляется только в полнолуние над лесом.', tall:true}
];
const SET_KEY = 'zvezdny-set-v1';
const DEFAULT_ODDS = {common:50, rare:30, epic:15, legendary:5};
let CARDS, COST = 5000, PITY = 10, FOIL = 0.12;
function loadSet(){ // набор и настройки, которые стример меняет в панели
  let d = null;
  try { if (!LIVE) d = JSON.parse(localStorage.getItem(SET_KEY)); } catch(e){}
  CARDS = (d && Array.isArray(d.cards) && d.cards.length ? d.cards : DEFAULT_CARDS).map(c => ({...c}));
  const o = (d && d.odds) || DEFAULT_ODDS;
  Object.keys(RAR).forEach(r => RAR[r].w = +o[r] >= 0 ? +o[r] : DEFAULT_ODDS[r]);
  COST = d && d.cost > 0 ? +d.cost : 5000; PITY = d && d.pity > 0 ? +d.pity : 10; FOIL = d && d.foil >= 0 ? d.foil / 100 : .12;
  renumber();
}
function saveSet(){
  const data = {cards: CARDS.map(({no, ...c}) => c), odds: Object.fromEntries(Object.keys(RAR).map(r => [r, RAR[r].w])), cost: COST, pity: PITY, foil: Math.round(FOIL * 100)};
  try { localStorage.setItem(SET_KEY, JSON.stringify(data)); return true; }
  catch(e){ toast('Не хватает места в браузере: удали пару карточек или уменьши картинки'); return false; }
}
const renumber = () => CARDS.forEach((c, i) => c.no = i + 1);
const imgOf = c => c.img || IMG[c.id] || '';
loadSet();
const BOTS = ['mur_mur','kot_v_ochkah','zelenaya_zvezda','lavanda_42','nochnoy_chat','pixel_dusha','sonya_sleep','glitch_tyan'];
const KEY = 'zvezdny-pak-v1';
const fresh = () => ({bal:20000, dust:10, pulls:3, since:3, dupes:1, owned:{cry:2, oops:1}, first:{cry:Date.now()-864e5*3, oops:Date.now()-864e5}});
let S;
let SKEY = KEY; // ключ сохранения: свой у каждого вошедшего зрителя
try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch(e){ S = fresh(); }
if (!S.first) S.first = {};
let recent = []; // выпадения этой сессии: {k, dupe, t}
const save = () => { if (LIVE) return; try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch(e){} };
const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString('ru-RU');
const byId = id => CARDS.find(c => c.id === id);
const no = c => String(c.no).padStart(3,'0');
const rarityPill = r => `<span class="rarity r-${r}">${STAR}<span>${RAR[r].label}</span></span>`;

/* ---- вкладки ---- */
function setTab(t){
  if (!['pack','album','stream','admin'].includes(t)) t = 'pack';
  if (t !== 'pack'){ // ушли со вкладки пака — снимаем затемнение, ждущую карточку переворачиваем
    document.body.classList.remove('suspense'); $('veil').classList.remove('on');
    if (typeof packState !== 'undefined' && packState === 'waiting' && revealNow) revealNow();
  }
  document.querySelectorAll('nav a').forEach(a => a.toggleAttribute('aria-current', a.dataset.tab === t));
  ['pack','album','stream','admin'].forEach(k => { $('tab-' + k).hidden = k !== t; });
  if (t === 'admin') renderAdminGate();
  window.scrollTo(0, 0);
}
document.querySelector('nav').addEventListener('click', e => {
  const a = e.target.closest('a[data-tab]'); if (!a) return;
  e.preventDefault(); setTab(a.dataset.tab);
  try { history.replaceState(null, '', '#' + a.dataset.tab); } catch(_){}
});
$('toAlbum').addEventListener('click', () => setTab('album'));
$('toStream').addEventListener('click', () => setTab('stream'));

/* ---- карточка ---- */
// слои толщины: от -d до +d пикселей
function edgeHTML(hex, d){
  let h = '';
  for (let z = -d + 1; z <= d - 1; z += 1) h += `<i class="edge" style="--ec:${hex};transform:translateZ(${z}px)"></i>`;
  return h;
}
// «псевдотолщина» для плоских карточек альбома: стопка теней в сторону, противоположную наклону
function fakeEdge(card, x, y, hex){
  const n = 6, ox = -x * 1.3, oy = -y * 1.3, c = `color-mix(in srgb,${hex} 50%,#0b0b10)`;
  let s = [];
  for (let i = 1; i <= n; i++) s.push(`${(ox * i).toFixed(1)}px ${(oy * i).toFixed(1)}px 0 ${i === n ? '#05080690' : c}`);
  card.style.setProperty('--edge3d', s.join(','));
}
function cardHTML(c, foil){
  return `<div class="cardbox"><div class="card r-${c.r}${foil ? ' foil' : ''}${c.tall ? ' tall' : ''}">
    <i class="gloss"></i>
    <div class="art"><img class="fill" src="${imgOf(c)}" alt="" draggable="false"><img class="main" src="${imgOf(c)}" alt="${c.name}" draggable="false"></div>
    <div class="num"><span>${no(c)}/${String(CARDS.length).padStart(3,'0')}</span><span>${'★'.repeat(TIER[c.r] + 1)}</span></div>
    <span class="holo-tag">HOLO</span>
    <div class="meta">${rarityPill(c.r)}<div class="name">${c.name}</div><div class="flavor">${c.flavor}</div></div>
  </div></div>`;
}

function setInfo(html){
  const el = $('info'); el.classList.remove('in'); void el.offsetWidth; el.innerHTML = html; el.classList.add('in');
}
function setNote(t){
  const b = $('notebox'); b.classList.remove('in'); void b.offsetWidth; $('note').textContent = t; b.classList.add('in');
}
function idleInfo(){
  setInfo(`<div class="info-row"><span class="cat">Сезон 1 · Ночной лес</span><span class="cat">${CARDS.length} карточек · ${CARDS.length * 2} с холо</span></div><h1 class="title grad">Звёздный пак</h1>`);
}

function renderOdds(){
  const live = Object.keys(RAR).filter(r => RAR[r].w > 0 && CARDS.some(c => c.r === r)), sum = live.reduce((a, r) => a + RAR[r].w, 0) || 1;
  $('odds').innerHTML = live.map(r => `<span class="rarity r-${r}">${STAR}${RAR[r].label} · ${+(RAR[r].w / sum * 100).toFixed(1)}%</span>`).join('') +
    `<span class="holo-tag">Холо · ${Math.round(FOIL * 100)}%</span>`;
}

function renderTop(){
  $('bal').textContent = fmt(LIVE ? (S.packs || 0) : S.bal);
  $('dust').textContent = fmt(S.dust);
  updateOpenBtn();
  $('pityTxt').textContent = `Гарантия эпической: ${S.since} из ${PITY}`;
  $('pityBar').style.width = (S.since / PITY * 100) + '%';
  const have = Object.keys(S.owned).filter(k => S.owned[k] > 0 && byId(k.replace('*', ''))).length;
  $('sCol').textContent = `${have} / ${CARDS.length * 2}`;
  $('sPulls').textContent = S.pulls;
  $('sDup').textContent = S.dupes;
  $('colBar').style.width = (have / (CARDS.length * 2) * 100) + '%';
}

/* ---- альбом ---- */
let filter = 'all';
function renderFilters(){
  const opts = [['all','Все']].concat(Object.keys(RAR).map(r => [r, RAR[r].label]));
  $('filters').innerHTML = opts.map(([k, l]) =>
    `<button class="fchip${k === 'all' ? '' : ' r-' + k}" data-f="${k}" aria-pressed="${filter === k}">${k === 'all' ? '' : '<i class="dot"></i>'}${l}</button>`).join('');
}
$('filters').addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  filter = b.dataset.f; renderFilters(); renderAlbum();
});

function renderAlbum(){
  let h = '';
  [false, true].forEach(foil => {
    const list = CARDS.filter(c => filter === 'all' || c.r === filter);
    h += `<div class="sect">${foil ? 'Голографические · шанс 12%' : 'Обычные'}</div><div class="grid">`;
    if (!list.length) h += '<div class="empty">Нет карточек этой редкости</div>';
    list.forEach(c => {
      const k = c.id + (foil ? '*' : ''), n = S.owned[k] || 0, R = RAR[c.r];
      if (n > 0){
        h += `<button class="tile full r-${c.r}${foil ? ' foil' : ''}" data-k="${k}" aria-label="Рассмотреть ${c.name}">
          ${n > 1 ? `<span class="badge">×${n}</span>` : ''}${cardHTML(c, foil)}</button>`;
      } else {
        const cost = R.craft * (foil ? 3 : 1), can = S.dust >= cost;
        h += `<div class="tile locked r-${c.r}">
          <div class="ghost"><span class="tnum">${no(c)}</span><span class="q">?</span>${rarityPill(c.r)}</div>
          <button class="craft${can ? ' can' : ''}" data-craft="${k}" ${can ? '' : 'disabled'}>Создать · ${fmt(cost)} пыльцы</button></div>`;
      }
    });
    h += '</div>';
  });
  $('album').innerHTML = h;
}

/* ---- розыгрыш ---- */
function roll(){ // сначала редкость по шансам из панели, потом случайная карточка этой редкости
  let rs = Object.keys(RAR).filter(r => RAR[r].w > 0 && CARDS.some(c => c.r === r));
  if (S.since >= PITY - 1){ const hi = rs.filter(r => r === 'epic' || r === 'legendary'); if (hi.length) rs = hi; }
  if (!rs.length) rs = [...new Set(CARDS.map(c => c.r))];
  const total = rs.reduce((a, r) => a + (RAR[r].w || 1), 0);
  let x = Math.random() * total, pick = rs[0];
  for (const r of rs){ x -= (RAR[r].w || 1); if (x <= 0){ pick = r; break; } }
  const pool = CARDS.filter(c => c.r === pick);
  return {c: pool[Math.floor(Math.random() * pool.length)], foil: Math.random() < FOIL};
}

function burst(color, n){
  const st = $('stage');
  for (let i = 0; i < n; i++){
    const s = document.createElement('i');
    s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 130 + Math.random() * 140;
    s.style.cssText = `--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;--c:${['#5fd68a','#d9ef6b',color][i % 3]};animation-delay:${Math.random()*0.15}s`;
    st.appendChild(s);
    setTimeout(() => s.remove(), 1400);
  }
}

let busy = false, alertTimer;
function nick(){ return ((USER && USER.name) || $('nick').value.trim() || 'зритель').replace(/[<>&"]/g, ''); }

function showAlert(who, c, foil){
  const R = RAR[c.r], a = $('alert');
  a.className = 'alert r-' + c.r;
  $('alertPic').innerHTML = `<img src="${imgOf(c)}" alt="">`;
  $('alertT1').textContent = `@${who} открыл(а) звёздный пак`;
  $('alertT2').textContent = `${R.label}${foil ? ' · HOLO' : ''}: ${c.name}`;
  void a.offsetWidth; a.classList.add('on');
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => a.classList.remove('on'), 4200);
}

function addFeed(who, c, foil, prepend = true){
  const R = RAR[c.r], li = document.createElement('li');
  li.className = 'r-' + c.r;
  li.innerHTML = `<i class="dot"></i><span class="who">@${who}</span><span class="what">${R.label.toLowerCase()}${foil ? ' holo' : ''} · ${c.name}</span>`;
  const ul = $('feed');
  prepend ? ul.prepend(li) : ul.append(li);
  while (ul.children.length > 12) ul.lastChild.remove();
}

const STAR_SVG = '<svg viewBox="0 0 24 24"><defs><linearGradient id="sg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fd68a"/><stop offset="1" stop-color="#d9ef6b"/></linearGradient></defs><path d="M12 1.5 14.6 9.4 22.5 12 14.6 14.6 12 22.5 9.4 14.6 1.5 12 9.4 9.4Z" fill="url(#sg)"/></svg>';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const TIER = {common:0, rare:1, epic:2, legendary:3};

/* ---------- пакетик: появление, надрыв, открытие ---------- */
let TEAR_Y = 12, TEAR_DIR = 1, TEAR_SIDE = 'top', tearSet = false; // где и куда рвём
document.addEventListener('dragstart', e => e.preventDefault()); // без нативного перетаскивания картинок
let packState = 'sealed', pending = null, tearP = 0, tearEdge = [];

function zigEdge(y, amp, n, dir){ // зубчики по краю шва
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(`${(i / n * 100).toFixed(2)}% ${(y + (i % 2 ? amp * dir : 0)).toFixed(2)}%`);
  return pts;
}
const FACE_CLIP = (() => { // зубчатые швы + бока, сужающиеся к швам («подушка»)
  const pinch = y => 3.4 * Math.pow(1 - Math.sin(Math.PI * y / 100), 1.6);
  const P = 3.4, n = 24, pts = [];
  for (let i = 0; i <= n; i++) pts.push(`${(P + i / n * (100 - 2 * P)).toFixed(2)}% ${(i % 2 ? 1.4 : 0)}%`);
  for (let y = 6; y <= 94; y += 4) pts.push(`${(100 - pinch(y)).toFixed(2)}% ${y}%`);
  for (let i = n; i >= 0; i--) pts.push(`${(P + i / n * (100 - 2 * P)).toFixed(2)}% ${(100 - (i % 2 ? 1.4 : 0))}%`);
  for (let y = 94; y >= 6; y -= 4) pts.push(`${pinch(y).toFixed(2)}% ${y}%`);
  return `polygon(${pts.join(',')})`;
})();

function boosterFace(){
  return `<div class="bface" style="clip-path:${FACE_CLIP}">
    <div class="bseal top"></div>
    <div class="bbody">
      <svg class="bpines" viewBox="0 0 200 60" preserveAspectRatio="none"><path d="M0 60V40l10-14 6 8 8-20 9 18 6-10 10 22 8-16 10 14 7-24 9 20 6-8 10 18 9-22 8 16 7-10 10 20 8-14 9 12 10-20 10 16 10-8V60Z"/></svg><img class="bart" src="${IMG.smug}" alt="" draggable="false">
      <div class="blogo"><b>ЗВЁЗДНЫЙ</b><b>ПАК</b><small>Коллекционные карточки канала</small></div>
      <div class="bband"><span>Ночной лес</span><span>1 карточка</span>${STAR_SVG}</div>
      <i class="bcrease t"></i><i class="bcrease b"></i><div class="bshade"></div><div class="bsheen"></div>
    </div>
    <div class="bseal bot"></div></div>`;
}

function makeTearEdge(){ // неровный край разрыва на высоте TEAR_Y
  tearEdge = [];
  for (let i = 0; i <= 40; i++) tearEdge.push([i * 2.5, TEAR_Y + (Math.random() - .5) * 1.6]);
}
const pt = p => `${p[0].toFixed(2)}% ${p[1].toFixed(2)}%`;
let trace = [], wander = 12, autoMode = false, PH = null, pullNow = null;
function setTearGeometry(yPct, dir){
  TEAR_Y = Math.max(9, Math.min(91, yPct)); TEAR_DIR = dir < 0 ? -1 : 1;
  TEAR_SIDE = TEAR_Y <= 50 ? 'top' : 'bot'; tearSet = true;
  trace = [[TEAR_DIR > 0 ? 0 : 100, TEAR_Y]]; wander = TEAR_Y;
  makeTearEdge();
}
// линия разрыва «ползёт» за рукой: каждый новый шаг тянется к wander, плюс мелкая рваность
function traceTo(u){
  let [lx, ly] = trace[trace.length - 1];
  while (TEAR_DIR > 0 ? lx + 2.5 <= u : lx - 2.5 >= u){
    lx += TEAR_DIR * 2.5;
    ly += (wander - ly) * .35 + (Math.random() - .5) * 1.3;
    ly = Math.max(TEAR_Y - 8, Math.min(TEAR_Y + 8, Math.max(8, Math.min(92, ly))));
    trace.push([lx, ly]);
  }
  const lastY = trace[trace.length - 1][1], rest = [];
  for (let x = lx + TEAR_DIR * 2.5; TEAR_DIR > 0 ? x <= 100.01 : x >= -.01; x += TEAR_DIR * 2.5) rest.push([Math.max(0, Math.min(100, x)), lastY]);
  tearEdge = [...trace, ...rest].sort((a, b) => a[0] - b[0]);
}
// кусок малой части (над линией для top, под линией для bot) в диапазоне x0..x1
function piece(x0, x1){
  if (x1 - x0 < .01) return 'polygon(0 0,0 0,0 0)';
  const yAt = x => { let best = tearEdge[0]; for (const e of tearEdge) if (Math.abs(e[0] - x) < Math.abs(best[0] - x)) best = e; return best[1]; };
  const mid = tearEdge.filter(e => e[0] > x0 && e[0] < x1);
  const line = [[x0, yAt(x0)], ...mid, [x1, yAt(x1)]];
  return TEAR_SIDE === 'top'
    ? `polygon(${x0}% 0,${x1}% 0,${line.slice().reverse().map(pt).join(',')})`
    : `polygon(${line.map(pt).join(',')},${x1}% 100%,${x0}% 100%)`;
}

// стабильная «случайность» по координате: волокна разрыва не дрожат от кадра к кадру
const jit = (x, k) => { const v = Math.sin(x * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
// полоска вдоль линии разрыва на отрезке x0..x1: dir = +1 вниз от линии, -1 вверх; w — ширина в % высоты
function band(x0, x1, dir, w0, w1, k){
  if (x1 - x0 < .3) return 'polygon(0 0,0 0,0 0)';
  const yAt = x => { let best = tearEdge[0]; for (const e of tearEdge) if (Math.abs(e[0] - x) < Math.abs(best[0] - x)) best = e; return best[1]; };
  const line = [[x0, yAt(x0)], ...tearEdge.filter(e => e[0] > x0 && e[0] < x1), [x1, yAt(x1)]];
  const fine = []; // мелкие зубчики-волокна между точками линии
  for (let i = 0; i < line.length; i++){
    fine.push(line[i]);
    if (i < line.length - 1){ const a = line[i], b = line[i + 1]; for (const f of [.33, .66]) fine.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); }
  }
  const inner = fine.map(([x, y]) => [x, y - dir * .15]);
  const outer = fine.map(([x, y]) => [x, y + dir * (w0 + (w1 - w0) * Math.pow(jit(x, k), 1.7))]).reverse();
  return `polygon(${[...inner, ...outer].map(pt).join(',')})`;
}

function setTear(p){
  const dp = Math.max(0, Math.min(1, p)) - tearP;
  tearP = p = Math.max(0, Math.min(1, p));
  if (dp > 0) tearCrackle(dp);
  const b = $('booster'); if (!b) return;
  const P = p * 100, u = TEAR_DIR > 0 ? P : 100 - P; // точка разрыва по x
  if (tearSet && trace.length) traceTo(u);
  const edge = tearEdge.map(pt).join(',');
  b.querySelector('.bmain').style.clipPath = TEAR_SIDE === 'top'
    ? `polygon(${edge},100% 100%,0 100%)`
    : `polygon(0 0,100% 0,${tearEdge.slice().reverse().map(pt).join(',')})`;
  // слои толщины повторяют оставшуюся часть, чтобы за оторванным краем не торчал «призрак»
  if (p > 0) b.querySelectorAll('.bslice').forEach(s => s.style.clipPath = b.querySelector('.bmain').style.clipPath);
  const [t0, t1, r0, r1] = TEAR_DIR > 0 ? [0, u, u, 100] : [u, 100, 0, u];
  b.querySelector('.brest').style.clipPath = piece(r0, r1);
  const torn = b.querySelector('.btorn');
  torn.style.clipPath = p > 0 ? piece(t0, t1) : 'polygon(0 0,0 0,0 0)';
  torn.style.transformOrigin = `${u}% ${TEAR_Y}%`;
  // край разрыва: серебристый внутренний слой фольги на обеих сторонах и тёмная щель внутрь пакета
  const down = TEAR_SIDE === 'top' ? 1 : -1; // в какую сторону от линии лежит сам пакет
  b.querySelector('.bfoil.m').style.clipPath = p > 0 ? band(t0, t1, down, .35, 1.5, 1) : 'polygon(0 0,0 0,0 0)';
  b.querySelector('.bgap').style.clipPath = p > 0 ? band(t0, t1, down, .9, 2.6, 2) : 'polygon(0 0,0 0,0 0)';
  b.querySelector('.bfoil.t').style.clipPath = p > 0 ? band(t0, t1, -down, .3, 1.3, 3) : 'polygon(0 0,0 0,0 0)';
  // изгиб: у линии надрыва полоска заламывается (тень), дальше ловит свет
  const y = TEAR_Y, g = down > 0
    ? [`linear-gradient(180deg,transparent ${y - 9}%,#0000 ${y - 5}%,#00000070 ${y - .5}%)`, `linear-gradient(180deg,transparent ${y - 8}%,#ffffff40 ${y - 4.5}%,transparent ${y - 2}%)`]
    : [`linear-gradient(0deg,transparent ${100 - y - 9}%,#0000 ${100 - y - 5}%,#00000070 ${100 - y - .5}%)`, `linear-gradient(0deg,transparent ${100 - y - 8}%,#ffffff40 ${100 - y - 4.5}%,transparent ${100 - y - 2}%)`];
  const cu = b.querySelector('.bcurl'), ch = b.querySelector('.bcurlhi');
  cu.style.background = g[0]; ch.style.background = g[1];
  cu.style.opacity = Math.min(1, p * 2.2); ch.style.opacity = Math.min(1, p * 1.6);
  const leak = b.querySelector('.leak');
  leak.querySelector('polyline').setAttribute('points', (tearSet ? trace : []).map(e => e.join(',')).join(' '));
  leak.style.opacity = p > 0 ? 1 : 0;
  if (pending){
    const R = RAR[pending.c.r], tier = tierOf(pending);
    $('rays').style.opacity = p * .2;
    $('glow').style.setProperty('--g1', '#5fd68a');
    $('glow').classList.toggle('on', p > .3);
  }
}

/* ---------- физика пакетика: пружины, маятник полоски, гравитация ---------- */
function makePhys(b){
  const P = {b, rx:0, ry:0, rz:0, tx:0, ty:0, vrx:0, vry:0, vrz:0, vtx:0, vty:0,
    tRx:0, tRy:0, tRz:0, tTx:0, tTy:0, s:0, sT:0, th:0, vth:0, strip:null, fall:null};
  const spring = (x, v, target, k, c, dt) => { const a = k * (target - x) - c * v; v += a * dt; return [x + v * dt, v]; };
  let last = performance.now();
  const loop = now => {
    if (!b.isConnected || PH !== P) return;
    const dt = Math.min(.033, (now - last) / 1000); last = now;
    const pvtx = P.vtx;
    [P.rx, P.vrx] = spring(P.rx, P.vrx, P.tRx, 90, 9, dt);
    [P.ry, P.vry] = spring(P.ry, P.vry, P.tRy, 90, 9, dt);
    [P.rz, P.vrz] = spring(P.rz, P.vrz, P.tRz, 110, 8, dt);
    if (!P.fall){
      [P.tx, P.vtx] = spring(P.tx, P.vtx, P.tTx, 140, 13, dt);
      [P.ty, P.vty] = spring(P.ty, P.vty, P.tTy, 140, 13, dt);
    } else { // пустой пакет падает
      P.fall.vy += P.fall.g * dt; P.ty += P.fall.vy * dt; P.tx += P.fall.vx * dt; P.rz += P.fall.w * dt; P.tRz = P.rz;
      const op = Math.max(0, 1 - Math.max(0, Math.abs(P.ty) - 140) / 260); b.style.opacity = op;
      if (op <= 0){ b.remove(); return; }
    }
    P.s += (P.sT - P.s) * Math.min(1, dt * 18);
    b.style.transform = `translate3d(${P.tx.toFixed(2)}px,${P.ty.toFixed(2)}px,0) rotateX(${P.rx.toFixed(2)}deg) rotateY(${P.ry.toFixed(2)}deg) rotateZ(${P.rz.toFixed(2)}deg) scale(${1 - .025 * P.s},${1 - .015 * P.s})`;
    const torn = b.querySelector('.btorn'), up = TEAR_SIDE === 'top' ? -1 : 1;
    if (P.strip){ // оторванная полоска летит и кувыркается
      const S2 = P.strip; S2.t += dt;
      S2.vy += 2600 * dt; S2.x += S2.vx * dt; S2.y += S2.vy * dt; S2.th += S2.w * dt;
      torn.style.transform = `translate(${S2.x.toFixed(1)}px,${S2.y.toFixed(1)}px) rotate(${S2.th.toFixed(1)}deg) rotateX(${(Math.sin(S2.t * 13) * 55).toFixed(1)}deg) rotateY(${(Math.cos(S2.t * 8) * 35).toFixed(1)}deg)`; // фольга трепыхается в полёте
      torn.style.opacity = Math.max(0, 1 - Math.max(0, S2.t - .5) * 1.6);
    } else if (tearP > 0){ // надорванная полоска висит маятником: свисает сильнее, чем больше оторвано
      const target = -up * TEAR_DIR * (1 + tearP * 7); // жёсткая фольга: не висит, а чуть отгибается от пакета по мере разрыва
      [P.th, P.vth] = spring(P.th, P.vth, target, 220, 30, dt); // тугая пружина без раскачки
      const peel = up * (2 + tearP * 10); // полоска отгибается к зрителю и чуть дышит
      torn.style.transform = `rotate(${P.th.toFixed(2)}deg) translate(${(-TEAR_DIR * tearP * 2).toFixed(2)}%, ${(up * tearP * 2.5).toFixed(2)}%) rotateX(${peel.toFixed(2)}deg)`;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  P.detachStrip = () => {
    const up = TEAR_SIDE === 'top' ? -1 : 1;
    P.strip = {x:0, y:0, th:P.th, t:0, vx: -TEAR_DIR * (160 + Math.random() * 140), vy: up < 0 ? -420 - Math.random() * 200 : 120, w: up * TEAR_DIR * (180 + Math.random() * 220)};
    P.vtx += TEAR_DIR * 120; P.vrz += -TEAR_DIR * 60; // отдача от рывка
  };
  P.drop = up => { // карта ушла вверх — пакет падает вниз; карта ушла вниз — пакет улетает вверх и не возвращается
    P.fall = up < 0 ? {vx: (Math.random() - .5) * 120, vy: 450, g: 2600, w: (Math.random() - .5) * 160}
                    : {vx: (Math.random() - .5) * 120, vy: -1500, g: 0, w: (Math.random() - .5) * 160};
  };
  return P;
}

function spawnPack(){
  const st = $('stage');
  st.querySelectorAll('.flip,.booster,.pack,.pullmask').forEach(e => e.remove());
  const b = document.createElement('div');
  b.className = 'booster drop idle'; b.id = 'booster';
  b.setAttribute('aria-label', 'Пакетик с карточкой: потяни верхний край вправо, чтобы открыть');
  const slices = [2, 4, 6, 8, 10, 12].map((z, i, a) => `<i class="bslice${i === a.length - 1 ? ' back' : ''}" style="clip-path:${FACE_CLIP};transform:translateZ(-${z}px)"></i>`).join('');
  b.innerHTML = `<i class="bglow"></i><i class="bdropsh"></i>${slices}<div class="bpart bmain">${boosterFace()}<i class="bgap"></i><i class="bfoil m"></i></div><div class="bpart brest">${boosterFace()}</div><div class="btornw"><div class="bpart btorn">${boosterFace()}<i class="bcurl"></i><i class="bcurlhi"></i><i class="bfoil t"></i></div></div>
    <svg class="leak" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points=""/></svg><i class="tearguide"></i><i class="bdent" style="clip-path:${FACE_CLIP}"></i>
    <div class="bhint"><svg viewBox="0 0 24 24" style="animation-direction:reverse"><path d="M19 12H5M11 6l-6 6 6 6"/></svg><span>Рви в любом месте</span><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></div>`;
  st.insertBefore(b, st.querySelector('.shadow'));
  tearSet = false; TEAR_Y = 12; TEAR_DIR = 1; TEAR_SIDE = 'top'; makeTearEdge(); pending = null; packState = 'sealed'; setTear(0);
  $('rays').style.opacity = 0; $('glow').classList.remove('on');
  $('glow').style.setProperty('--g1', '#5fd68a'); $('glow').style.setProperty('--g2', '#d9ef6b');
  $('inspect').hidden = true;
  idleInfo();
  setNote('Зажми пакетик в любом месте и протяни вбок, чтобы надорвать. Или нажми «Открыть сразу».');
  autoMode = false; trace = []; pullNow = null; $('stage').classList.remove('pulling', 'grab');
  PH = makePhys(b);
  bindBooster(b); updateOpenBtn();
  if (AC) setTimeout(() => rustle(.6, .2), 120);
}

let revealNow = null, sound = true;
try { sound = localStorage.getItem('zvezdny-sound') !== '0'; } catch(e){}
let AC = null;
function beep(freq, dur, vol){
  if (!sound) return;
  try {
    if (!audio()) return;
    const o = AC.createOscillator(), g = AC.createGain(), now = AC.currentTime;
    o.type = 'triangle'; o.frequency.setValueAtTime(freq, now); o.frequency.exponentialRampToValueAtTime(freq * 1.5, now + dur);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(vol, now + .015); g.gain.exponentialRampToValueAtTime(.0001, now + dur);
    o.connect(g).connect(AC.destination); o.start(now); o.stop(now + dur + .02);
  } catch(e){}
}
/* ---- шуршание фольги: синтез шума, без звуковых файлов ---- */
let NOISE = null, lastRustle = 0;
function audio(){
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    if (!NOISE){
      NOISE = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
      const d = NOISE.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return AC;
  } catch(e){ return null; }
}
function grain(at, dur, freq, q, vol){ // одна «крупинка» хруста
  const ac = AC, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = NOISE; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + .003); g.gain.exponentialRampToValueAtTime(.0001, at + dur);
  s.connect(f).connect(g).connect(ac.destination);
  s.start(at, Math.random() * .9, dur + .02);
}
function rustle(power = .5, spread = .12){ // шелест/хруст фольги, сила 0..1
  if (!sound || !audio() || !NOISE) return;
  const now = AC.currentTime, n = Math.round(4 + power * 22);
  for (let i = 0; i < n; i++){
    const at = now + Math.random() * spread * (0.6 + power);
    grain(at, .008 + Math.random() * .035, 1800 + Math.random() * 6500, .8 + Math.random() * 2.5, (.015 + Math.random() * .05) * (.4 + power));
  }
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; f.type = 'highpass'; f.frequency.value = 2500;
  const d = .08 + power * .18;
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.025 * power, now + .02); g.gain.exponentialRampToValueAtTime(.0001, now + d);
  s.connect(f).connect(g).connect(AC.destination); s.start(now, Math.random() * .8, d + .02);
}
function tearCrackle(dp){ // треск надрыва: гуще при быстром рывке
  if (!sound || !audio() || !NOISE || dp <= 0) return;
  const now = AC.currentTime, n = Math.min(14, Math.ceil(dp * 90));
  for (let i = 0; i < n; i++){
    const at = now + Math.random() * .05;
    grain(at, .004 + Math.random() * .02, 2500 + Math.random() * 5000, 1.5 + Math.random() * 4, .03 + Math.random() * .07);
    if (Math.random() < .25) grain(at, .02 + Math.random() * .03, 700 + Math.random() * 900, 2, .05);
  }
}
function ripSound(){ // финальный «рип»
  if (!sound || !audio() || !NOISE) return;
  const now = AC.currentTime;
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = NOISE; f.type = 'bandpass'; f.Q.value = .9;
  f.frequency.setValueAtTime(1200, now); f.frequency.exponentialRampToValueAtTime(5500, now + .22);
  g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.16, now + .01);
  for (let i = 1; i < 10; i++) g.gain.setValueAtTime(.06 + Math.random() * .12, now + i * .022);
  g.gain.exponentialRampToValueAtTime(.0001, now + .3);
  s.connect(f).connect(g).connect(AC.destination); s.start(now, Math.random() * .6, .35);
  rustle(.8, .25);
}
const tierOf = ({c, foil}) => Math.min(3, TIER[c.r] + (foil ? 1 : 0));

function beginTear(){
  if (packState === 'tearing') return true;
  if (packState !== 'sealed') return false;
  if (!USER){ openLogin('Чтобы открыть пак, войди через Twitch: баллы и коллекция привязаны к твоему аккаунту.'); return false; }
  if (LIVE){
    if (!(S.packs > 0)){
      setNote(`Пакетиков нет. Купи награду «Звёздный пак» за баллы канала на twitch.tv/${TWITCH.channel} — пакетик появится здесь сам.`);
      toast('Нет пакетиков'); return false;
    }
    S.packs--; pending = null; liveOpenRequest();
  } else {
    if (S.bal < COST){ // в демо не блокируем: подкидываем баллы
      S.bal += 20000; toast('Баллы закончились: демо добавило +20 000');
    }
    S.bal -= COST; save();
    pending = roll();
  }
  packState = 'tearing';
  const b = $('booster');
  b.classList.remove('idle', 'drop');
  b.querySelector('.bhint').classList.add('off');
  b.style.setProperty('--lc', '#ffffff');
  $('rays').style.setProperty('--ray', '#5fd68a');
  setInfo(`<div class="info-row"><span class="cat">Сезон 1</span></div><h1 class="title grad">Открываем…</h1>`);
  setNote('Тяни дальше! Что же там внутри…');
  renderTop(); updateOpenBtn();
  return true;
}

function autoTear(){
  if (packState !== 'tearing') return;
  packState = 'auto'; updateOpenBtn();
  if (!tearSet) setTearGeometry(12, 1);
  const wob = setInterval(() => { wander = TEAR_Y + (Math.random() - .5) * 7; }, 140); // рука «гуляет»
  const from = tearP, dur = (1 - from) * 850 * (RM ? .4 : 1), t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 2);
    setTear(from + (1 - from) * e);
    if (k < 1) requestAnimationFrame(step); else { clearInterval(wob); finishTear(); }
  };
  requestAnimationFrame(step);
}

function bindBooster(b){
  let drag = null;
  const rel = e => { const r = b.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  const dent = e => { const [x, y] = rel(e); b.style.setProperty('--px', (x * 100).toFixed(1) + '%'); b.style.setProperty('--py', (y * 100).toFixed(1) + '%'); };
  b.addEventListener('pointerdown', e => {
    if (e.button || !(packState === 'sealed' || packState === 'tearing')) return;
    if (!beginTear()) return;
    const r = b.getBoundingClientRect(), [rx, ry] = rel(e);
    drag = {x: e.clientX, y0: e.clientY, y: ry * 100, rx, p0: tearP, w: r.width, armed: tearSet};
    b.setPointerCapture(e.pointerId); b.classList.add('grabbing', 'pressed'); dent(e);
    PH.sT = 1; PH.vry += (rx - .5) * -60; PH.vrx += (ry - .5) * 50; // палец продавливает фольгу
    rustle(.85); drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = performance.now();
    b.querySelector('.tearguide').style.opacity = 0;
  });
  b.addEventListener('pointermove', e => {
    const now = performance.now();
    if (!drag){ // пружинящий наклон, раскачка от резких движений, блик и пунктир
      if (e.pointerType !== 'mouse' || packState !== 'sealed') return;
      const [x0, y0] = rel(e), x = x0 - .5, y = y0 - .5;
      PH.tRy = x * 22; PH.tRx = -y * 14;
      b.style.setProperty('--lx', (-x * 50).toFixed(1));
      if (b._lx != null){
        const dtm = Math.max(1, now - b._lt), vx = (e.clientX - b._lx) / dtm * 1000, vy = (e.clientY - b._ly) / dtm * 1000, sp = Math.hypot(vx, vy);
        PH.vrz += Math.max(-90, Math.min(90, vx * .012)); PH.vtx += Math.max(-140, Math.min(140, vx * .05)); PH.vty += Math.max(-90, Math.min(90, vy * .03));
        if (sp > 250 && now - lastRustle > 90){ lastRustle = now; rustle(Math.min(1, sp / 2200) * .45, .08); }
        if (sp > 2200 && now - lastRustle > 60){ lastRustle = now; rustle(.9, .1); } // трясут — фольга шумит сильнее
      }
      b._lx = e.clientX; b._ly = e.clientY; b._lt = now;
      b.querySelectorAll('.bsheen').forEach(s => s.style.setProperty('--mx', (50 - x * 120) + '%'));
      const g = b.querySelector('.tearguide'); g.style.top = Math.max(9, Math.min(91, (y + .5) * 100)) + '%'; g.style.opacity = .7;
      return;
    }
    dent(e);
    const spd = Math.hypot(e.clientX - drag.lx, e.clientY - drag.ly) / Math.max(1, now - drag.lt) * 1000;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    if (spd > 200 && now - lastRustle > 110){ lastRustle = now; rustle(Math.min(1, spd / 2500) * .5, .07); }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y0;
    // пакет тянется за рукой и сопротивляется
    PH.tTx = Math.max(-26, Math.min(26, dx * .12)); PH.tTy = Math.max(-16, Math.min(16, dy * .1)); PH.tRz = Math.max(-6, Math.min(6, dx * .025));
    if (!drag.armed){ // направление по первому движению; если тянут вверх/вниз — рвём от ближнего края
      if (Math.hypot(dx, dy) < 5) return;
      const dir = Math.abs(dx) >= Math.abs(dy) * .6 ? Math.sign(dx) : (drag.rx < .5 ? 1 : -1);
      setTearGeometry(drag.y, dir); drag.armed = true;
    }
    wander = TEAR_Y + Math.max(-7, Math.min(7, (rel(e)[1] * 100 - drag.y) * .4)); // разрыв уводит туда, куда ведёт рука
    const along = dx * TEAR_DIR, dist = Math.hypot(dx, dy) * .8;
    const p = Math.max(tearP, drag.p0 + Math.max(along, dist) / (drag.w * .85));
    if (p > tearP + .02){ PH.tTx *= .6; PH.vtx -= TEAR_DIR * 40; } // фольга поддалась — натяжение отпускает
    setTear(p);
    if (p >= 1){ release(); finishTear(); }
  });
  const release = () => { drag = null; b.classList.remove('grabbing', 'pressed'); PH.sT = 0; PH.tTx = PH.tTy = PH.tRz = 0; };
  const up = () => {
    if (!drag) return; release();
    if (tearP > .75) autoTear();
    else if (packState === 'tearing') setNote(tearSet ? `Почти! Тяни дальше ${TEAR_DIR > 0 ? 'вправо' : 'влево'} или нажми «Дорвать за меня».` : 'Зажми и протяни вбок, чтобы надорвать.');
  };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
  b.addEventListener('pointerleave', () => { b._lx = null; if (!drag && packState === 'sealed'){ PH.tRx = PH.tRy = 0; b.querySelector('.tearguide').style.opacity = ''; } });
}

/* вытаскивание карты из пакета рукой */
const CS = .72; // карта внутри уже пакета
function pullCard(f, t0, tOut, up, H){
  return new Promise(res => {
    const st = $('stage'); let t = t0, drag = null, done = false, lastR = 0;
    st.classList.add('pulling');
    const apply = (rot = 0) => { f.style.transform = `translateY(${(t * 100).toFixed(2)}%) rotate(${rot.toFixed(2)}deg) scale(${CS})`; if (PH) PH.tTy = (t - t0) * H * .12; };
    const prog = () => (t - t0) / (tOut - t0);
    const cleanup = () => { st.removeEventListener('pointerdown', down); st.removeEventListener('pointermove', move); st.removeEventListener('pointerup', upH); st.removeEventListener('pointercancel', upH); st.classList.remove('pulling', 'grab'); pullNow = null; };
    const finish = () => {
      if (done) return; done = true; cleanup();
      const from = t, t1 = performance.now();
      const anim = now => { const k = Math.min(1, (now - t1) / 220); t = from + (tOut - from) * (1 - Math.pow(1 - k, 2)); apply(); if (k < 1) requestAnimationFrame(anim); else { if (PH) PH.tTy = 0; res(); } };
      rustle(.6, .15); requestAnimationFrame(anim);
    };
    const down = e => { if (packState !== 'pull' || done) return; drag = {y: e.clientY, x: e.clientX, t}; st.setPointerCapture(e.pointerId); st.classList.add('grab'); rustle(.35, .06); };
    const move = e => {
      if (!drag) return;
      let nt = drag.t + (e.clientY - drag.y) / H * .85; // трение: карта идёт чуть медленнее руки
      nt = up < 0 ? Math.min(t0 + .03, Math.max(tOut, nt)) : Math.max(t0 - .03, Math.min(tOut, nt));
      const now = performance.now();
      if (Math.abs(nt - t) > .003 && now - lastR > 90){ lastR = now; rustle(.25, .05); } // карта шуршит о фольгу
      t = nt; apply(Math.max(-6, Math.min(6, (e.clientX - drag.x) * .03)));
      if (prog() > .7) finish();
    };
    const upH = () => { if (!drag) return; drag = null; st.classList.remove('grab'); apply(0); };
    st.addEventListener('pointerdown', down); st.addEventListener('pointermove', move); st.addEventListener('pointerup', upH); st.addEventListener('pointercancel', upH);
    pullNow = () => { // «вытащи за меня»
      if (done) return; drag = null;
      const from = t, t1 = performance.now(), d = 650 * (RM ? .4 : 1);
      const anim = now => { if (done) return; const k = Math.min(1, (now - t1) / d); t = from + (tOut - from) * .72 * (k * k * (3 - 2 * k)); apply(Math.sin(k * 6) * 2);
        if (k > .3 && now - lastR > 110){ lastR = now; rustle(.3, .05); } if (k < 1) requestAnimationFrame(anim); else finish(); };
      requestAnimationFrame(anim);
    };
    apply();
  });
}

function updateOpenBtn(){
  const btn = $('open'); if (!btn) return;
  const cost = `<span class="cost">${fmt(COST)}</span>`;
  if (packState === 'sealed'){ btn.innerHTML = !USER ? 'Войти, чтобы открыть' : LIVE ? (S.packs > 0 ? `Открыть пакетик <span class="cost">${S.packs}</span>` : 'Нет пакетиков') : 'Открыть сразу ' + cost; btn.disabled = false; }
  else if (packState === 'tearing'){ btn.innerHTML = 'Дорвать за меня'; btn.disabled = false; }
  else if (packState === 'revealed'){ btn.innerHTML = 'Следующий пакетик'; btn.disabled = false; }
  else if (packState === 'waiting'){ btn.innerHTML = 'Перевернуть'; btn.disabled = false; }
  else if (packState === 'pull'){ btn.innerHTML = 'Вытащить за меня'; btn.disabled = false; }
  else { btn.innerHTML = 'Открываем…'; btn.disabled = true; }
}

function onOpenBtn(){
  if (packState === 'revealed') return spawnPack();
  if (packState === 'sealed'){ if (beginTear()){ autoMode = true; autoTear(); } return; }
  if (packState === 'pull' && pullNow) return pullNow();
  if (packState === 'tearing') autoTear();
  if (packState === 'waiting' && revealNow) revealNow();
}

async function finishTear(){
  if (packState === 'opening' || packState === 'revealed') return;
  if (LIVE && !pending){ // ждём ответ сервера о выпавшей карте
    packState = 'opening'; busy = true; updateOpenBtn();
    await livePending;
    if (!pending){ busy = false; if (packState === 'opening') spawnPack(); return; }
  }
  if (!pending) return;
  packState = 'opening'; busy = true; updateOpenBtn();
  const st = $('stage'), glow = $('glow'), rays = $('rays'), flash = $('flash'), b = $('booster');
  const {c, foil} = pending, R = RAR[c.r], tier = tierOf(pending), k = c.id + (foil ? '*' : '');
  const T = RM ? .35 : 1;

  // 1. полоска отрывается и падает с кувырком, из пакета вспышка
  ripSound();
  const up = TEAR_SIDE === 'top' ? -1 : 1;
  PH.detachStrip();
  b.querySelector('.brest').animate([{opacity:1}, {opacity:0}], {duration: 200, fill:'forwards'});
  b.querySelector('.leak').animate([{opacity:1}, {opacity:0}], {duration: 600 * T, fill:'forwards'});
  flash.style.setProperty('--fc', '#5fd68a');
  const fy = (TEAR_Y - 50) * .9;
  flash.animate([{opacity:0, transform:`translateY(${fy}%) scale(.5)`}, {opacity:.55, transform:`translateY(${fy}%) scale(1)`, offset:.3}, {opacity:0, transform:`translateY(${fy}%) scale(1.2)`}],
    {duration: 600 * T, easing:'ease-out'});
  burst('#5fd68a', 10);
  rays.style.setProperty('--ray', '#5fd68a'); rays.style.opacity = .15;

  // 2. карта рубашкой вверх торчит из пакета — её вытаскивают рукой
  const f = document.createElement('div');
  f.className = 'flip';
  f.innerHTML = `<div class="inner">${edgeHTML(R.hex, 4)}<div class="face">${cardHTML(c, foil)}</div><div class="back">${PACK_STAR}</div></div>`;
  const mask = document.createElement('div'); mask.className = 'pullmask'; mask.appendChild(f);
  st.insertBefore(mask, b);
  const H = st.offsetHeight, avgY = trace.length ? trace.reduce((a, e) => a + e[1], 0) / trace.length : TEAR_Y;
  const yOpen = -.07 + avgY / 100 * 1.14; // где край отверстия, в долях высоты сцены
  const hh = CS / 2; // половина высоты карты в долях сцены
  const t0 = up < 0 ? yOpen - .09 - (.5 - hh) : yOpen + .09 - (.5 + hh), tOut = up < 0 ? yOpen - .04 - (.5 + hh) : yOpen + .04 - (.5 - hh);
  f.animate([{transform:`translateY(${(t0 - up * .14) * 100}%) scale(${CS})`}, {transform:`translateY(${t0 * 100}%) scale(${CS})`}],
    {duration: 520 * T, delay: 120 * T, easing:'cubic-bezier(.2,1.5,.4,1)', fill:'backwards'});
  packState = 'pull'; busy = false; updateOpenBtn();
  setInfo(`<div class="info-row"><span class="cat">Сезон 1</span></div><h1 class="title grad">Карта внутри!</h1>`);
  setNote(`Карта торчит из пакета — зажми и потяни её ${up < 0 ? 'вверх' : 'вниз'}, чтобы вытащить.`);
  // карту видно только по ту сторону разрыва — внутри пакета она скрыта
  // маска идёт точно по рваной линии разрыва с учётом наклона и качания пакета
  const W = st.offsetWidth;
  const clipAt = () => {
    const bk = $('booster');
    if (!bk || !tearEdge.length){
      const yPx = (yOpen + (up < 0 ? .012 : -.012)) * H + (PH ? PH.ty : 0);
      mask.style.clipPath = up < 0 ? `inset(-300% -60% ${(H - yPx).toFixed(1)}px -60%)` : `inset(${yPx.toFixed(1)}px -60% -300% -60%)`;
      return;
    }
    const cs = getComputedStyle(bk), m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform);
    const [ox, oy] = cs.transformOrigin.split(' ').map(parseFloat);
    const bw = bk.offsetWidth, bh = bk.offsetHeight, bl = bk.offsetLeft, bt = bk.offsetTop, sh = (up < 0 ? 1 : -1) * .012 * H;
    const pts = tearEdge.map(([x, y]) => { const q = m.transformPoint(new DOMPoint(x / 100 * bw - ox, y / 100 * bh - oy)); return [bl + ox + q.x, bt + oy + q.y + sh]; });
    const L = pts[0], R = pts[pts.length - 1], f = ([x, y]) => `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    const poly = up < 0
      ? [[-W, -3 * H], [2 * W, -3 * H], [2 * W, R[1]], ...pts.slice().reverse(), [-W, L[1]]]
      : [[-W, L[1]], ...pts, [2 * W, R[1]], [2 * W, 4 * H], [-W, 4 * H]];
    mask.style.clipPath = `polygon(${poly.map(f).join(',')})`;
  };
  clipAt(); const clipLoop = () => { if (mask.isConnected && packState === 'pull'){ clipAt(); requestAnimationFrame(clipLoop); } }; requestAnimationFrame(clipLoop);
  const pulled = pullCard(f, t0, tOut, up, H);
  if (autoMode) setTimeout(() => pullNow && pullNow(), 650 * T);
  await pulled;
  packState = 'opening'; busy = true; updateOpenBtn();
  st.insertBefore(f, mask); mask.remove(); // карта целиком снаружи — маска больше не нужна
  rustle(.55, .3);
  PH.drop(up); // пустой пакет уходит первым
  const outT = f.style.transform, lift = outT.replace(/scale\([^)]*\)/, `scale(${CS + .08})`);
  await f.animate([{transform: outT}, {transform: lift}], {duration: 420 * T, easing:'cubic-bezier(.2,.8,.3,1)', fill:'forwards'}).finished;
  f.style.zIndex = 3; // пакета под картой уже нет — можно выходить вперёд
  const glide = f.animate([{transform: lift}, {transform:`translateY(${up * -4}%) scale(1.04)`, offset:.75}, {transform:'none'}],
    {duration: 600 * T, easing:'cubic-bezier(.25,1,.35,1)', fill:'forwards'});
  await glide.finished; f.style.transform = ''; glide.cancel();
  f.getAnimations().forEach(a => a.cancel());

  // 3. ИНТРИГА: свечение рубашки поднимается по ступеням редкости
  document.body.classList.add('suspense'); $('tab-pack').classList.add('suspense'); $('veil').classList.add('on');
  const ORDER = ['common', 'rare', 'epic', 'legendary'];
  const LBL = ['Обычная?', 'Редкая?!', 'Эпическая?!', 'ЛЕГЕНДАРНАЯ!!!'];
  const top = TIER[c.r];
  const fake = top === 3 && Math.random() < .45; // обманка: «всего лишь редкая»… и вдруг
  const step = async (i, hold) => {
    const hex = RAR[ORDER[i]].hex;
    f.style.setProperty('--tc', hex); f.style.setProperty('--tl', [.25, .5, .8, 1.1][i]);
    rays.style.setProperty('--ray', hex); rays.style.opacity = [.12, .22, .38, .55][i];
    glow.style.setProperty('--g1', hex); glow.style.setProperty('--g2', i >= 2 ? hex : '#d9ef6b'); glow.classList.toggle('on', i >= 1);
    setInfo(`<p class="tease pop" style="--tc:${hex}">${i === top && i < 3 ? LBL[i].replace(/[?!]+$/, '') + '…' : LBL[i]}</p>`);
    f.animate([{scale:1}, {scale:1.07}, {scale:1}], {duration: 380 * T, easing:'cubic-bezier(.2,1.4,.4,1)'});
    if (i) burst(hex, 6 + i * 6);
    beep(330 * Math.pow(1.26, i), .14, i === 3 ? .09 : .06);
    if (i === 3){
      flash.style.setProperty('--fc', hex);
      flash.animate([{opacity:0}, {opacity:.8, offset:.25}, {opacity:0}], {duration: 600 * T});
      if (!RM) st.animate([{transform:'none'}, {transform:'translate(-7px,3px)'}, {transform:'translate(6px,-4px)'}, {transform:'translate(-4px,-2px)'}, {transform:'translate(3px,4px)'}, {transform:'none'}], {duration: 450});
      beep(660, .35, .08); setTimeout(() => beep(990, .4, .07), 120);
    }
    await sleep(hold * T);
  };
  setNote('Свечение растёт… где оно остановится?');
  for (let i = 0; i <= top; i++){
    if (fake && i === 2){ // замираем на «редкой», будто всё
      setInfo(`<p class="tease" style="--tc:${RAR.rare.hex}">Редкая…</p>`);
      setNote('Кажется, всего лишь редкая…');
      await sleep(1400 * T);
      if (!RM) f.animate([{rotate:'0deg'}, {rotate:'-3deg'}, {rotate:'3deg'}, {rotate:'-2deg'}, {rotate:'0deg'}], {duration: 380});
      beep(180, .25, .08);
      setNote('Стоп. Что-то происходит!');
      await sleep(380 * T);
      await step(2, 380); // рывок без паузы
      continue;
    }
    await step(i, i === top ? 500 : [650, 780, 900][i] || 700);
  }
  if (foil){
    f.classList.add('holo');
    setInfo(`<div class="info-row"><span class="holo-tag" style="font-size:1rem;padding:4px 14px">+ HOLO</span></div><p class="tease pop" style="--tc:${R.hex}">${LBL[top].replace(/[?!…]+$/, '')}${top === 3 ? '!!!' : '!'}</p>`);
    burst('#d9ef6b', 18); beep(1180, .3, .05);
    await sleep(600 * T);
  }

  // ждём, пока игрок сам перевернёт (или через 8 секунд перевернём сами)
  packState = 'waiting'; updateOpenBtn();
  f.classList.add('waiting');
  setNote('Нажми на карточку, чтобы перевернуть');
  await new Promise(res => {
    revealNow = res;
    const tm = setTimeout(res, $('tab-pack').hidden ? 0 : 8000);
    const prev = res; revealNow = () => { clearTimeout(tm); prev(); };
  });
  revealNow = null; f.classList.remove('waiting');
  document.body.classList.remove('suspense'); $('tab-pack').classList.remove('suspense'); $('veil').classList.remove('on');
  packState = 'opening'; updateOpenBtn();
  beep(523, .12, .05); setTimeout(() => beep(784, .25, .06), 90);

  // 3. переворот; эпическая и легендарная крутятся
  const inner = f.querySelector('.inner');
  const turns = tier >= 3 ? 900 : tier === 2 ? 540 : 180;
  const dur = (tier >= 3 ? 1400 : tier === 2 ? 1050 : 750) * T;
  f.classList.add('shown');
  const flipAnim = inner.animate([{transform:`rotateY(${turns}deg) scale(1)`}, {transform:'rotateY(0deg) scale(1.06)', offset:.8}, {transform:'rotateY(0deg) scale(1)'}],
    {duration: dur, easing:'cubic-bezier(.3,.9,.35,1)', fill:'forwards'});
  flipAnim.finished.then(() => flipAnim.cancel());
  for (let i = 0; i <= (tier >= 2 ? 1 : 0); i++) setTimeout(() => {
    const ring = document.createElement('i'); ring.className = 'ring'; ring.style.setProperty('--c', R.hex); ring.style.top = '50%';
    st.appendChild(ring);
    ring.animate([{opacity:.9, transform:'translate(-50%,-50%) scale(.2)'}, {opacity:0, transform:'translate(-50%,-50%) scale(3.2)'}],
      {duration: 800 * T, easing:'cubic-bezier(.2,.8,.3,1)', fill:'both'}).finished.then(() => ring.remove());
  }, dur * .55 + i * 160);
  await sleep(dur * .62);

  // 4. результат
  glow.style.setProperty('--g1', R.hex); glow.style.setProperty('--g2', foil ? '#d9ef6b' : R.hex);
  glow.classList.add('on');
  rays.style.setProperty('--ray', R.hex); rays.style.opacity = [.12, .22, .4, .55][TIER[c.r]];
  if (tier >= 1) burst(R.hex, [0, 14, 24, 40][tier]);
  if (tier >= 2){ beep(784, .3, .06); setTimeout(() => beep(1046, .45, .06), 140); }
  if (tier >= 2) flash.animate([{opacity:0}, {opacity:.45, offset:.3}, {opacity:0}], {duration: 500 * T});

  const big = c.r === 'epic' || c.r === 'legendary';
  const dupe = LIVE ? !!pending.dupe : (S.owned[k] || 0) > 0;
  if (!LIVE){ // в живом режиме всё это уже посчитал сервер
    S.owned[k] = (S.owned[k] || 0) + 1;
    if (!S.first[k]) S.first[k] = Date.now();
    S.pulls++;
    S.since = big ? 0 : S.since + 1;
    if (dupe){ S.dust += R.dust * (foil ? 2 : 1); S.dupes++; }
  }
  recent.unshift({k, dupe, t: Date.now()}); if (recent.length > 12) recent.pop();
  setInfo(`<div class="info-row">${rarityPill(c.r)}${foil ? '<span class="holo-tag">HOLO</span>' : ''}<span class="cat">${dupe ? 'Дубль' : 'Новая!'}</span></div><h1 class="title">${c.name}</h1>`);
  setNote(dupe ? `Дубль: +${R.dust * (foil ? 2 : 1)} лесной пыльцы. ${c.flavor}` : `Новая карточка в альбоме. ${c.flavor}`);
  showAlert(nick(), c, foil);
  if (!LIVE) addFeed(nick(), c, foil); // в живом режиме лента придёт с сервера
  pending = null; packState = 'revealed'; busy = false;
  save(); renderTop(); renderAlbum(); renderRecent(); updateOpenBtn();
  $('inspect').hidden = false;
}

function craft(k){
  if (LIVE){
    const foil = k.endsWith('*'), id = k.replace('*', '');
    api('craft', {card_id: id, foil}).then(d => { applyMe(d); toast(`Выращено: ${byId(id).name}${foil ? ' (holo)' : ''}`); }).catch(e => toast(e.message));
    return;
  }
  const foil = k.endsWith('*'), c = byId(k.replace('*', '')), cost = RAR[c.r].craft * (foil ? 3 : 1);
  if (S.dust < cost) return;
  S.dust -= cost; S.owned[k] = 1; if (!S.first[k]) S.first[k] = Date.now(); save(); renderTop(); renderAlbum();
  toast(`Выращено: ${c.name}${foil ? ' (holo)' : ''}`);
}

function toast(t){
  const el = $('toast'); el.textContent = t; el.classList.add('on');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 2200);
}

/* ---------- просмотрщик ---------- */
const PACK_STAR = STAR_SVG;
const BACK_HTML = c => `<div class="cback">${PACK_STAR}<b>ЗВЁЗДНЫЙ ПАК</b><small>${no(c)} · Ночной лес</small></div>`;
const fmtDate = ts => new Date(ts).toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
const V = {list: [], i: 0, rx: 0, ry: 0, side: 0, from: 'album'};

function renderRecent(){
  $('recent').hidden = !recent.length;
  $('rlist').innerHTML = recent.map((p, i) => {
    const foil = p.k.endsWith('*'), c = byId(p.k.replace('*', ''));
    return `<button class="rthumb r-${c.r}${foil ? ' foil' : ''}" data-ri="${i}" title="${c.name}${foil ? ' (holo)' : ''}" aria-label="Рассмотреть ${c.name}">
      <img src="${imgOf(c)}" alt="">${p.dupe ? '' : '<span class="nw">NEW</span>'}</button>`;
  }).join('');
}

function setV3d(ease){
  const v = $('v3d');
  v.classList.toggle('ease', !!ease);
  v.style.transform = `rotateX(${V.rx}deg) rotateY(${V.ry}deg)`;
  const card = $('vfront').querySelector('.card');
  if (card){ // блик холо следует за поворотом
    card.style.setProperty('--mx', (50 + ((V.ry % 360 + 540) % 360 - 180) * .6) + '%');
    card.style.setProperty('--my', (50 - V.rx * 1.2) + '%');
  }
}

function showV(i, dir){
  const n = V.list.length; V.i = (i + n) % n;
  const it = V.list[V.i], k = it.k, foil = k.endsWith('*'), c = byId(k.replace('*', '')), R = RAR[c.r];
  $('vfront').innerHTML = cardHTML(c, foil);
  $('vedge').innerHTML = edgeHTML(R.hex, 5);
  $('vrear').innerHTML = BACK_HTML(c);
  const own = S.owned[k] || 0;
  $('vinfo').innerHTML = `<div class="info-row">${rarityPill(c.r)}${foil ? '<span class="holo-tag">HOLO</span>' : ''}<span class="cat">В коллекции ×${own}</span></div><h2 class="title">${c.name}</h2>`;
  $('vinfo').classList.remove('in'); void $('vinfo').offsetWidth; $('vinfo').classList.add('in');
  const parts = [];
  if (it.t) parts.push(it.dupe ? `Выбита только что, это дубль: +${R.dust * (foil ? 2 : 1)} пыльцы.` : 'Выбита только что: новая карточка!');
  if (S.first[k]) parts.push(`Впервые получена ${fmtDate(S.first[k])}.`);
  if (!parts.length) parts.push(foil ? 'Голографическая версия: блик переливается, когда поворачиваешь карточку.' : 'Поверни карточку, чтобы рассмотреть её со всех сторон.');
  $('vnote').textContent = parts.join(' ');
  $('vcount').textContent = V.from === 'recent' ? `${V.i + 1} из ${n} · выбито за сессию` : `${V.i + 1} из ${n} · в коллекции`;
  $('vprev').disabled = $('vnext').disabled = n < 2;
  const g = $('vglow'); g.style.setProperty('--g1', R.hex); g.style.setProperty('--g2', foil ? '#d9ef6b' : R.hex);
  V.side = 0; V.rx = 0; V.ry = dir ? dir * -40 : -18; setV3d(false);
  requestAnimationFrame(() => requestAnimationFrame(() => { V.ry = 0; setV3d(true); }));
}

function openViewer(list, i, from){
  if (!list.length) return;
  V.list = list; V.from = from;
  $('modal').hidden = false; document.body.style.overflow = 'hidden';
  showV(i, 0); $('mclose').focus();
}
function closeModal(){ $('modal').hidden = true; document.body.style.overflow = ''; $('viewer').classList.remove('zoom'); $('vzoom').setAttribute('aria-pressed', 'false'); }
function flipV(){ V.side = V.side ? 0 : 1; V.rx = 0; V.ry = V.side * 180; setV3d(true); }
function zoomV(){ const z = $('viewer').classList.toggle('zoom'); $('vzoom').setAttribute('aria-pressed', z); }

// вращение перетаскиванием (мышь и палец)
(() => {
  const el = $('viewer'); let drag = null;
  el.addEventListener('pointerdown', e => {
    if (e.button) return;
    drag = {x: e.clientX, y: e.clientY, rx: V.rx, ry: V.ry, moved: false};
    el.setPointerCapture(e.pointerId); el.classList.add('grabbing');
  });
  el.addEventListener('pointermove', e => {
    if (!drag){ // лёгкий наклон под курсором, пока не тянем
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      V.rx = -y * 16; V.ry = V.side * 180 + x * 20; setV3d(false); return;
    }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    V.ry = drag.ry + dx * .6; V.rx = Math.max(-40, Math.min(40, drag.rx - dy * .4)); setV3d(false);
  });
  const end = () => {
    if (!drag) return; drag = null; el.classList.remove('grabbing');
    V.side = ((Math.round(V.ry / 180) % 2) + 2) % 2; // докрутили дальше 90° — карточка перевернётся
    V.ry = Math.round(V.ry / 180) * 180; V.rx = 0; setV3d(true);
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('pointerleave', () => { if (!drag){ V.rx = 0; V.ry = Math.round(V.ry / 180) * 180; setV3d(true); } });
  el.addEventListener('dblclick', flipV);
})();

$('vprev').addEventListener('click', () => showV(V.i - 1, -1));
$('vnext').addEventListener('click', () => showV(V.i + 1, 1));
$('vflip').addEventListener('click', flipV);
$('vzoom').addEventListener('click', zoomV);
$('modal').addEventListener('click', e => { if (e.target.id === 'modal' || e.target.closest('#mclose')) closeModal(); });
document.addEventListener('keydown', e => {
  if ($('modal').hidden) return;
  if (e.key === 'Escape') closeModal();
  else if (e.key === 'ArrowLeft' && V.list.length > 1) showV(V.i - 1, -1);
  else if (e.key === 'ArrowRight' && V.list.length > 1) showV(V.i + 1, 1);
  else if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') flipV();
  else if (e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я') zoomV();
});

// список коллекции в порядке альбома (с учётом фильтра)
function albumList(){
  const out = [];
  [false, true].forEach(foil => CARDS.forEach(c => {
    const k = c.id + (foil ? '*' : '');
    if ((S.owned[k] || 0) > 0 && (filter === 'all' || c.r === filter)) out.push({k});
  }));
  return out;
}
// просмотр только что выбитой: открываем ленту сессии с первой
$('inspect').addEventListener('click', () => openViewer(recent, 0, 'recent'));
$('stage').addEventListener('click', e => {
  if (packState === 'waiting' && revealNow && e.target.closest('.flip')) return revealNow();
  if (packState === 'revealed' && e.target.closest('.flip.shown') && recent.length) openViewer(recent, 0, 'recent');
});
$('rlist').addEventListener('click', e => { const b = e.target.closest('[data-ri]'); if (b) openViewer(recent, +b.dataset.ri, 'recent'); });
// наклон выбитой карточки прямо на сцене
$('stage').addEventListener('pointermove', e => {
  if (packState !== 'revealed' || e.pointerType !== 'mouse') return;
  const inner = $('stage').querySelector('.flip.shown .inner'), card = inner && inner.querySelector('.face .card'); if (!card) return;
  const r = $('stage').getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  if (x < -.1 || x > 1.1 || y < -.1 || y > 1.1) return;
  inner.style.transition = 'transform .15s ease-out';
  inner.style.transform = `rotateY(${(x - .5) * 34}deg) rotateX(${(.5 - y) * 24}deg)`; // крутим карточку целиком, вместе с гранью
  card.style.setProperty('--mx', x * 100 + '%'); card.style.setProperty('--my', y * 100 + '%');
});
$('stage').addEventListener('pointerleave', () => { const i = $('stage').querySelector('.flip.shown .inner'); if (i){ i.style.transition = 'transform .5s ease'; i.style.transform = ''; } });

$('open').addEventListener('click', onOpenBtn);
const sndBtn = () => { $('snd').textContent = 'Звук: ' + (sound ? 'вкл' : 'выкл'); $('snd').setAttribute('aria-pressed', sound); };
$('snd').addEventListener('click', () => { sound = !sound; try { localStorage.setItem('zvezdny-sound', sound ? '1' : '0'); } catch(e){} sndBtn(); if (sound) beep(660, .12, .05); });
sndBtn();
$('earn').addEventListener('click', () => { S.bal += 5000; save(); renderTop(); toast('+5 000 баллов за просмотр'); });
$('reset').addEventListener('click', () => { if (busy || ['tearing','auto','waiting','pull'].includes(packState)) return; S = fresh(); recent = []; renderRecent(); save(); renderAll(); spawnPack(); toast('Демо сброшено'); });
$('album').addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const tile = e.target.closest('.tile.full'); if (!tile) return;
  const card = tile.querySelector('.card'), r = tile.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
  card.style.transform = `rotateY(${x * 26}deg) rotateX(${-y * 20}deg) translateZ(10px)`;
  card.style.setProperty('--mx', (x + .5) * 100 + '%'); card.style.setProperty('--my', (y + .5) * 100 + '%');
  const k = tile.dataset.k.replace('*', ''); fakeEdge(card, x * 2, y * 2, RAR[byId(k).r].hex);
});
$('album').addEventListener('pointerout', e => {
  const tile = e.target.closest('.tile.full'); if (!tile || tile.contains(e.relatedTarget)) return;
  const card = tile.querySelector('.card'); card.style.transform = ''; card.style.removeProperty('--edge3d');
});
$('album').addEventListener('click', e => {
  const cr = e.target.closest('[data-craft]'); if (cr) return craft(cr.dataset.craft);
  const h = e.target.closest('[data-k]'); if (h){ const L = albumList(); openViewer(L, Math.max(0, L.findIndex(x => x.k === h.dataset.k)), 'album'); }
});

/* чужие выпадения, чтобы лента жила */
if (!LIVE){
  for (let i = 0; i < 5; i++){ const {c, foil} = roll(); addFeed(BOTS[i], c, foil, false); }
  setInterval(() => { const {c, foil} = roll(); addFeed(BOTS[Math.floor(Math.random() * BOTS.length)], c, foil); }, 7000);
}

/* частицы на фоне, как у образца */
(() => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const host = document.querySelector('.bg'), cv = document.createElement('canvas'); host.appendChild(cv);
  const g = cv.getContext('2d'); let W, H;
  const size = () => { W = cv.width = innerWidth; H = cv.height = innerHeight; }; size(); addEventListener('resize', size);
  const P = Array.from({length: innerWidth < 700 ? 28 : 55}, () => ({
    x: Math.random() * innerWidth, y: innerHeight * (.25 + Math.random() * .75), r: .8 + Math.random() * 1.6, v: 6 + Math.random() * 10, ax: Math.random() * 6.28, ay: Math.random() * 6.28,
    dx: (Math.random() - .5) * 6, ph: Math.random() * 6.28, c: Math.random() < .5 ? '217,239,107' : '150,255,140'}));
  let last = 0;
  const f = t => {
    requestAnimationFrame(f); if (document.hidden){ last = t; return; }
    const dt = Math.min((t - last) / 1000, .1); last = t; g.clearRect(0, 0, W, H);
    for (const p of P){
      p.ax += dt * .6; p.ay += dt * .45; p.ph += dt * 1.3; // светлячки бродят и мерцают
      p.x += (Math.cos(p.ax) * p.v + p.dx) * dt; p.y += Math.sin(p.ay) * p.v * .7 * dt;
      if (p.x < -10) p.x = W + 10; if (p.x > W + 10) p.x = -10; if (p.y < H * .15) p.y = H * .15; if (p.y > H + 10) p.y = H * .3;
      const a = Math.max(0, Math.sin(p.ph)) * .9 + .05;
      g.fillStyle = `rgba(${p.c},${a * .22})`; g.beginPath(); g.arc(p.x, p.y, p.r * 5, 0, 6.283); g.fill();
      g.fillStyle = `rgba(${p.c},${a})`; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
    }
  };
  requestAnimationFrame(f);
})();

/* ---------- НЛО над лесом ---------- */
(() => {
  const el = $('ufo'); let st = null;
  const hum = (dur) => { // тихий «инопланетный» гул
    if (!sound || !AC) return;
    try {
      const o = AC.createOscillator(), l = AC.createOscillator(), lg = AC.createGain(), g = AC.createGain(), now = AC.currentTime;
      o.type = 'sine'; o.frequency.value = 340; l.frequency.value = 5; lg.gain.value = 40;
      l.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(.018, now + .6); g.gain.setValueAtTime(.018, now + dur - .8); g.gain.linearRampToValueAtTime(0, now + dur);
      o.connect(g).connect(AC.destination); o.start(now); l.start(now); o.stop(now + dur); l.stop(now + dur);
    } catch(e){}
  };
  function fly(){
    if (st || document.hidden){ schedule(); return; }
    const dir = Math.random() < .5 ? 1 : -1, W = innerWidth, w = el.offsetWidth || 90;
    st = {dir, x: dir > 0 ? -w - 20 : W + 20, y0: innerHeight * (.05 + Math.random() * .22), t: 0,
          v: W / (8 + Math.random() * 5), hover: Math.random() < .4 ? .35 + Math.random() * .3 : -1, hovering: 0, caught: false};
    el.hidden = false; el.classList.remove('beaming');
    hum(Math.min(14, (W + 2 * w) / st.v + (st.hover > 0 ? 2 : 0)));
    let last = performance.now();
    const step = now => {
      if (!st) return;
      const dt = Math.min(.05, (now - last) / 1000); last = now; st.t += dt;
      if (st.caught){ // улетает вверх с ускорением
        st.vy = (st.vy || -40) * 1.07; st.y0 += st.vy * dt; st.x += st.dir * 60 * dt;
        if (st.y0 < -120) return end();
      } else if (st.hover > 0 && st.hovering < 2.2 && Math.abs(st.x / W - st.hover) < .01){ // зависает и светит лучом в лес
        st.hovering += dt; el.classList.toggle('beaming', st.hovering > .25 && st.hovering < 1.9);
      } else {
        st.x += st.dir * st.v * dt;
        if (st.hovering >= 2.2) st.hover = -1;
        if ((st.dir > 0 && st.x > W + 40) || (st.dir < 0 && st.x < -w - 40)) return end();
      }
      const y = st.y0 + Math.sin(st.t * 2.2) * 10, tilt = st.caught ? 0 : Math.sin(st.t * 1.6) * 6 + st.dir * 4;
      el.style.transform = `translate(${st.x}px, ${y}px) rotate(${tilt}deg)`;
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function end(){ st = null; el.hidden = true; el.classList.remove('beaming'); schedule(); }
  let tm;
  // редкое событие: проверка раз в 40–90 с, и только в 25% случаев НЛО действительно прилетает
  function schedule(){ clearTimeout(tm); tm = setTimeout(() => Math.random() < .25 ? fly() : schedule(), 40000 + Math.random() * 50000); }
  el.addEventListener('click', e => {
    if (!st || st.caught) return;
    st.caught = true; el.classList.add('beaming');
    S.bal += 1000; save(); renderTop();
    const r = el.getBoundingClientRect(), b = document.createElement('div');
    b.className = 'bonus'; b.textContent = '+1 000 баллов'; b.style.left = (r.left + r.width / 2) + 'px'; b.style.top = (r.bottom + 6) + 'px';
    document.body.appendChild(b); setTimeout(() => b.remove(), 1500);
    beep(880, .12, .05); setTimeout(() => beep(1320, .18, .05), 90); setTimeout(() => beep(1760, .3, .04), 180);
    toast('Тебя похитило НЛО! +1 000 баллов');
    setTimeout(() => el.classList.remove('beaming'), 700);
  });
  if (!RM) schedule();
  window._ufo = fly; // для проверки
})();

/* ---------- панель стримера ---------- */
const ADM = {img: null, src: null, x: 50, y: 30, r: 'common', edit: null};
const ICO = {
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>', down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>', del: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>'
};
function admRarPick(){
  $('admRar').innerHTML = Object.keys(RAR).map(r => `<button type="button" class="rarity r-${r}" data-r="${r}" aria-pressed="${ADM.r === r}">${STAR}${RAR[r].label}</button>`).join('');
}
function admCrop(){ // режем загруженную картинку в 5:7 с выбранным кадром
  if (!ADM.src) return ADM.img;
  const im = ADM.src, W = 600, H = 840, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const sc = Math.max(W / im.naturalWidth, H / im.naturalHeight), dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
  cv.getContext('2d').drawImage(im, -(dw - W) * ADM.x / 100, -(dh - H) * ADM.y / 100, dw, dh);
  let url = cv.toDataURL('image/webp', .82);
  if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/jpeg', .85);
  return url;
}
let admT;
function admPreview(){
  clearTimeout(admT);
  admT = setTimeout(() => {
    const img = admCrop();
    if (!img){ $('admPrev').innerHTML = '<div class="empty-prev">Здесь появится карточка</div>'; return; }
    ADM.img = img;
    const c = {id: '_prev', no: ADM.edit ? byId(ADM.edit).no : CARDS.length + 1, name: $('admName').value.trim() || 'Название', r: ADM.r,
               flavor: $('admFlavor').value.trim() || 'Описание карточки', tall: true, img};
    $('admPrev').innerHTML = cardHTML(c, false);
  }, 40);
}
function admLoadFile(file){
  if (!file || !file.type.startsWith('image/')) return toast('Это не картинка');
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => { ADM.src = im; ADM.x = 50; ADM.y = 30; $('admX').value = 50; $('admY').value = 30; $('admPos').hidden = false; $('admDropTxt').textContent = 'Картинка загружена. Нажми, чтобы заменить'; admPreview(); };
    im.onerror = () => toast('Не получилось открыть картинку');
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function admResetForm(){
  Object.assign(ADM, {img: null, src: null, x: 50, y: 30, r: 'common', edit: null});
  $('admName').value = ''; $('admFlavor').value = ''; $('admFile').value = '';
  $('admPos').hidden = true; $('admDropTxt').textContent = 'Перетащи картинку сюда или нажми, чтобы выбрать';
  $('admFormTitle').textContent = 'Новая карточка'; $('admSave').textContent = 'Добавить в набор'; $('admCancel').hidden = true;
  admRarPick(); admPreview(); renderAdminList();
}
function admStartEdit(id){
  const c = byId(id); if (!c) return;
  Object.assign(ADM, {img: imgOf(c), src: null, r: c.r, edit: id});
  $('admName').value = c.name; $('admFlavor').value = c.flavor || ''; $('admPos').hidden = true;
  $('admDropTxt').textContent = 'Нажми, чтобы заменить картинку';
  $('admFormTitle').textContent = 'Редактирование: ' + c.name; $('admSave').textContent = 'Сохранить'; $('admCancel').hidden = false;
  admRarPick(); admPreview(); renderAdminList();
  $('admForm').scrollIntoView({behavior: 'smooth', block: 'start'});
}
async function liveAdmSave(){
  const name = $('admName').value.trim();
  if (!ADM.img && !ADM.src) return toast('Добавь картинку');
  if (!name) return toast('Напиши название карточки');
  const old = ADM.edit ? byId(ADM.edit) : null;
  const body = {id: ADM.edit || undefined, name, flavor: $('admFlavor').value.trim(), rarity: ADM.r, tall: ADM.src ? true : (old ? old.tall : true)};
  if (ADM.src) body.image = admCrop();
  $('admSave').disabled = true;
  try { await api('card_save', body); toast(ADM.edit ? 'Карточка обновлена' : `Карточка «${name}» добавлена в набор`); admResetForm(); await liveReload(); }
  catch(e){ toast(e.message); }
  $('admSave').disabled = false;
}
function admSave(){
  if (LIVE) return liveAdmSave();
  const name = $('admName').value.trim();
  if (!ADM.img && !ADM.src) return toast('Добавь картинку');
  if (!name) return toast('Напиши название карточки');
  const img = admCrop(), flavor = $('admFlavor').value.trim();
  if (ADM.edit){
    const c = byId(ADM.edit);
    Object.assign(c, {name, flavor, r: ADM.r});
    if (ADM.src){ c.img = img; c.tall = true; }
  } else {
    CARDS.push({id: 'c' + Date.now().toString(36), name, flavor, r: ADM.r, tall: true, img});
  }
  renumber();
  if (!saveSet()) return;
  toast(ADM.edit ? 'Карточка обновлена' : `Карточка «${name}» добавлена в набор`);
  admResetForm(); renderAll();
}
function renderAdminList(){
  $('admCount').textContent = `${CARDS.length} шт.`;
  $('admCards').innerHTML = CARDS.map((c, i) => `<div class="arow r-${c.r}${ADM.edit === c.id ? ' editing' : ''}" data-id="${c.id}">
      <img src="${imgOf(c)}" alt="">
      <div style="min-width:0"><div class="anum">${no(c)}</div><div class="an">${c.name}</div>
        <select data-rar aria-label="Редкость">${Object.keys(RAR).map(r => `<option value="${r}"${r === c.r ? ' selected' : ''}>${RAR[r].label}</option>`).join('')}</select></div>
      <div class="abtns">
        <div class="pair"><button class="ib" data-act="up" title="Выше" ${i ? '' : 'disabled'}>${ICO.up}</button><button class="ib" data-act="down" title="Ниже" ${i < CARDS.length - 1 ? '' : 'disabled'}>${ICO.down}</button></div>
        <div class="pair"><button class="ib" data-act="edit" title="Редактировать">${ICO.edit}</button><button class="ib del" data-act="del" title="Удалить" ${CARDS.length > 1 ? '' : 'disabled'}>${ICO.del}</button></div>
      </div></div>`).join('');
}
function renderOddsEditor(){
  const sum = Object.keys(RAR).reduce((a, r) => a + RAR[r].w, 0) || 1;
  $('admOdds').innerHTML = Object.keys(RAR).map(r => `<div class="orow r-${r}">
      <span class="rarity r-${r}">${STAR}${RAR[r].label}</span>
      <input type="range" min="0" max="100" value="${RAR[r].w}" data-w="${r}" aria-label="Вес ${RAR[r].label}">
      <input type="number" min="0" max="1000" value="${RAR[r].w}" data-wn="${r}" aria-label="Вес ${RAR[r].label}">
      <span class="pct" data-pct="${r}">${+(RAR[r].w / sum * 100).toFixed(1)}%</span></div>`).join('');
  $('admFoil').value = Math.round(FOIL * 100); $('admPity').value = PITY; $('admCost').value = COST;
}
function oddsLive(){
  const w = {}; Object.keys(RAR).forEach(r => w[r] = Math.max(0, +$('admOdds').querySelector(`[data-wn="${r}"]`).value || 0));
  const sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  Object.keys(RAR).forEach(r => $('admOdds').querySelector(`[data-pct="${r}"]`).textContent = +(w[r] / sum * 100).toFixed(1) + '%');
  return w;
}
function renderAdmin(){ admRarPick(); admPreview(); renderAdminList(); renderOddsEditor(); if (LIVE) renderLiveAdmin(); }

$('admFile').addEventListener('change', e => admLoadFile(e.target.files[0]));
['dragenter','dragover'].forEach(ev => $('admDrop').addEventListener(ev, e => { e.preventDefault(); $('admDrop').classList.add('over'); }));
['dragleave','drop'].forEach(ev => $('admDrop').addEventListener(ev, e => { e.preventDefault(); $('admDrop').classList.remove('over'); }));
$('admDrop').addEventListener('drop', e => admLoadFile(e.dataTransfer.files[0]));
$('admX').addEventListener('input', e => { ADM.x = +e.target.value; admPreview(); });
$('admY').addEventListener('input', e => { ADM.y = +e.target.value; admPreview(); });
['admName','admFlavor'].forEach(id => $(id).addEventListener('input', admPreview));
$('admRar').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; ADM.r = b.dataset.r; admRarPick(); admPreview(); });
$('admSave').addEventListener('click', admSave);
$('admCancel').addEventListener('click', admResetForm);
$('admCards').addEventListener('change', e => {
  const s = e.target.closest('[data-rar]'); if (!s) return;
  const c = byId(s.closest('[data-id]').dataset.id); c.r = s.value;
  if (LIVE){ api('card_save', {id: c.id, name: c.name, flavor: c.flavor, rarity: c.r, tall: c.tall}).then(() => { toast(`«${c.name}» теперь ${RAR[c.r].label.toLowerCase()}`); liveReload(); }).catch(err => { toast(err.message); liveReload(); }); return; }
  if (saveSet()){ renderAdminList(); renderAll(); toast(`«${c.name}» теперь ${RAR[c.r].label.toLowerCase()}`); }
});
$('admCards').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('[data-id]').dataset.id, i = CARDS.findIndex(c => c.id === id), act = b.dataset.act;
  if (act === 'edit') return admStartEdit(id);
  if (act === 'up' || act === 'down'){
    const j = act === 'up' ? i - 1 : i + 1; if (j < 0 || j >= CARDS.length) return;
    [CARDS[i], CARDS[j]] = [CARDS[j], CARDS[i]];
  }
  if (act === 'del'){
    if (!b.classList.contains('sure')){ b.classList.add('sure'); b.title = 'Нажми ещё раз, чтобы удалить'; toast('Нажми ещё раз, чтобы удалить'); setTimeout(() => b.classList.remove('sure'), 2500); return; }
    const name = CARDS[i].name; CARDS.splice(i, 1);
    recent = recent.filter(p => byId(p.k.replace('*', ''))); renderRecent();
    if (ADM.edit === id) admResetForm();
    toast(`«${name}» удалена из набора`);
  }
  if (LIVE){ (act === 'del' ? api('card_delete', {id}) : api('card_order', {ids: CARDS.map(c => c.id)})).then(liveReload).catch(err => { toast(err.message); liveReload(); }); return; }
  renumber(); if (saveSet()){ renderAdminList(); renderAll(); }
});
$('admOdds').addEventListener('input', e => {
  const r = e.target.dataset.w || e.target.dataset.wn; if (!r) return;
  const v = e.target.value; $('admOdds').querySelectorAll(`[data-w="${r}"],[data-wn="${r}"]`).forEach(i => { if (i !== e.target) i.value = v; });
  oddsLive();
});
$('admOddsSave').addEventListener('click', () => {
  const w = oddsLive();
  if (!Object.values(w).some(v => v > 0)) return toast('Хотя бы у одной редкости шанс должен быть больше нуля');
  Object.keys(RAR).forEach(r => RAR[r].w = w[r]);
  FOIL = Math.min(100, Math.max(0, +$('admFoil').value || 0)) / 100;
  PITY = Math.min(100, Math.max(2, Math.round(+$('admPity').value || 10)));
  COST = Math.max(1, Math.round(+$('admCost').value || 5000));
  if (LIVE){ api('settings_save', {odds: w, foil: FOIL * 100, pity: PITY, cost: COST}).then(() => { toast('Шансы и цена сохранены на сервере'); liveReload(); }).catch(err => toast(err.message)); return; }
  if (saveSet()){ renderOddsEditor(); renderAll(); toast('Шансы и цена сохранены'); }
});
$('admResetSet').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!b.dataset.sure){ b.dataset.sure = 1; b.textContent = 'Точно? Нажми ещё раз'; setTimeout(() => { delete b.dataset.sure; b.textContent = 'Вернуть стандартный набор'; }, 2500); return; }
  try { localStorage.removeItem(SET_KEY); } catch(_){}
  loadSet(); admResetForm(); renderAdmin(); renderAll(); toast('Набор и шансы сброшены к стандартным');
  delete b.dataset.sure; b.textContent = 'Вернуть стандартный набор';
});

function renderAll(){ renderOdds(); renderFilters(); renderTop(); renderAlbum(); }
/* ================= ВХОД ЧЕРЕЗ TWITCH =================
   Настройка для рабочей версии (Nekoweb):
   1. dev.twitch.tv/console/apps → «Зарегистрировать приложение»
      · OAuth Redirect URL: точный адрес страницы, например https://ИМЯ.nekoweb.org/
      · Категория: Website Integration · Тип клиента: Confidential (неявный вход публичным клиентам недоступен)
   2. Скопируй Client ID в TWITCH.clientId, ник канала — в TWITCH.channel.
   Секрет клиента в браузер НЕ кладём — он нужен только серверу (Supabase).
   Роль стримера здесь — только интерфейс; настоящую проверку токена делает сервер (/oauth2/validate). */
const AUTH_KEY = 'zvezdny-auth-v1';
let USER = null; // {login, name, avatar, id, token, demo}
const realAuth = () => !!TWITCH.clientId;
const redirectUri = () => location.origin + location.pathname;
const isStreamer = () => ADMIN_OK || (!!USER && USER.login === TWITCH.channel.toLowerCase());
const BUSY_STATES = ['tearing', 'auto', 'pull', 'waiting', 'opening'];

function openLogin(reason){
  $('lgTxt').textContent = reason || 'Войди, чтобы открывать паки за баллы канала и собирать свою коллекцию.';
  $('lgReal').hidden = !realAuth(); $('lgChat').hidden = !CHAT_AUTH; $('lgDemo').hidden = realAuth() || CHAT_AUTH;
  if (CHAT_AUTH){ $('lgTitle').textContent = 'Вход через чат Twitch'; chatLoginReset(); }
  $('loginModal').hidden = false; document.body.style.overflow = 'hidden';
  setTimeout(() => (CHAT_AUTH ? $('lgChatNick') : realAuth() ? $('lgGo') : $('lgNick')).focus(), 50);
}
function closeLogin(){ $('loginModal').hidden = true; if ($('modal').hidden) document.body.style.overflow = ''; }

function twitchAuthorize(){
  const state = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  try { sessionStorage.setItem('zvezdny-oauth-state', state); localStorage.setItem('zvezdny-oauth-state', state); } catch(e){}
  const url = 'https://id.twitch.tv/oauth2/authorize?' + new URLSearchParams({
    client_id: TWITCH.clientId, redirect_uri: redirectUri(), response_type: 'token', scope: (loginScopes || TWITCH.scopes).join(' '), state
  });
  if (window.top !== window){ // страница внутри фрейма — вход в отдельном окне
    const w = window.open(url, 'twitch-login', 'width=520,height=720');
    if (!w) location.href = url;
  } else location.href = url;
}

async function twitchFetchUser(token){
  const v = await fetch('https://id.twitch.tv/oauth2/validate', {headers: {Authorization: 'OAuth ' + token}});
  if (!v.ok) throw new Error('token');
  const info = await v.json();
  if (info.client_id !== TWITCH.clientId) throw new Error('client');
  const u = await fetch('https://api.twitch.tv/helix/users', {headers: {Authorization: 'Bearer ' + token, 'Client-Id': TWITCH.clientId}});
  const d = u.ok ? (await u.json()).data[0] : null;
  return {scopes: info.scopes || [], login: info.login, id: info.user_id, name: d ? d.display_name : info.login, avatar: d ? d.profile_image_url : '', token,
          exp: Date.now() + (info.expires_in || 3600) * 1000, demo: false};
}

function setUser(u){
  USER = u;
  try { u ? localStorage.setItem(AUTH_KEY, JSON.stringify(u)) : localStorage.removeItem(AUTH_KEY); } catch(e){}
  // у каждого аккаунта своя коллекция
  SKEY = u ? KEY + ':' + u.login : KEY;
  let loaded = null;
  try { loaded = JSON.parse(localStorage.getItem(SKEY)); } catch(e){}
  if (u && !loaded){ try { loaded = JSON.parse(localStorage.getItem(KEY)); } catch(e){} } // первый вход: забираем демо-коллекцию
  S = loaded || fresh(); if (!S.first) S.first = {};
  if (LIVE){ S = emptyState(); if (u) liveMe(); }
  if (u) save();
  recent = []; renderRecent();
  renderUser(); renderAll();
  if (!BUSY_STATES.includes(packState)) spawnPack();
  if (!$('tab-admin').hidden) renderAdminGate();
}

function renderUser(){
  const box = $('userbox');
  if (!USER && ADMIN_OK){
    box.innerHTML = `<span class="uchip"><span class="ava">★</span><b>${TWITCH.channel}</b><span class="role">стример</span><button id="logout">Выйти</button></span>`;
  } else if (!USER){
    box.innerHTML = `<button class="twbtn" data-login><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3 3.5 7v12h4v2.5h2.5l2.5-2.5h3.5l5-5V3H5Zm14.5 10-3 3h-4L10 18.5V16H6.5V5h13v8Z" fill="currentColor"/><path d="M15 7.5h2v5h-2zM10.5 7.5h2v5h-2z" fill="currentColor"/></svg>Войти через Twitch</button>`;
    $('nick').disabled = false;
  } else {
    const esc = s => String(s).replace(/[<>&"]/g, '');
    const ava = USER.avatar ? `<img src="${esc(USER.avatar)}" alt="">` : `<span class="ava">${esc(USER.name[0] || '?').toUpperCase()}</span>`;
    box.innerHTML = `<span class="uchip">${ava}<b>${esc(USER.name)}</b>${isStreamer() ? '<span class="role">стример</span>' : ''}${USER.demo ? '<span class="demo">демо</span>' : ''}<button id="logout">Выйти</button></span>`;
    $('nick').value = USER.name; $('nick').disabled = true;
  }
  updateOpenBtn();
}

async function logout(){
  if (BUSY_STATES.includes(packState)) return toast('Сначала доделай открытие пака');
  if (ADMIN_OK){ ADMIN_OK = false; ADMIN_KEY = ''; try { localStorage.removeItem(ADMIN_KEY_LS); } catch(_){} if (!USER){ renderUser(); renderAdminGate(); return toast('Вышел из панели стримера'); } }
  const u = USER;
  if (u && !u.demo && realAuth()){ // отзываем токен у Twitch
    try { await fetch('https://id.twitch.tv/oauth2/revoke', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: TWITCH.clientId, token: u.token})}); } catch(e){}
  }
  if (LIVE && u && u.via === 'chat') api('logout').catch(() => {});
  setUser(null); toast('Ты вышел из аккаунта');
}

function renderAdminGate(){
  const ok = isStreamer();
  $('admLock').hidden = ok; $('admBody').hidden = !ok;
  $('admLockTxt').textContent = USER
    ? `Ты вошёл как ${USER.name}. Панель открывается только владельцу канала ${TWITCH.channel}.`
    : `Войди через Twitch-аккаунт канала ${TWITCH.channel}, чтобы добавлять карточки и настраивать шансы.`;
  const lb = $('admLock').querySelector('[data-login]'); lb.lastChild.textContent = CHAT_AUTH ? 'Войти через чат' : USER ? 'Войти аккаунтом канала' : 'Войти через Twitch';
  $('admKeyToggle').hidden = !LIVE || !$('admKeyRow').hidden;
  if (LIVE && !ok) $('admLockTxt').textContent = `Войди так же, как зрители: нажми «Войти через чат», впиши ник ${TWITCH.channel} и напиши код в своём чате. Панель откроется сама.`;
  renderClaim(ok);
  if (ok) renderAdmin();
}
function claimOpen(){ return LIVE && LIVESET && LIVESET.claim_until && Date.parse(LIVESET.claim_until) > Date.now(); }
function renderClaim(ok){
  const open = !ok && claimOpen();
  $('admClaim').hidden = !open;
  if (open){ const m = Math.max(1, Math.round((Date.parse(LIVESET.claim_until) - Date.now()) / 60000)); $('clLeft').textContent = `Окно открыто ещё ~${m} мин.`; }
}

function demoLogin(asStreamer){
  if (BUSY_STATES.includes(packState)) return toast('Сначала доделай открытие пака');
  let login = asStreamer ? TWITCH.channel.toLowerCase() : $('lgNick').value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (!asStreamer && login.length < 3) return toast('Ник на Twitch — от 3 символов: латиница, цифры, _');
  if (!asStreamer && login === TWITCH.channel.toLowerCase()) login += '_fan';
  closeLogin();
  setUser({login, id: 'demo-' + login, name: asStreamer ? TWITCH.channel : ($('lgNick').value.trim() || login), avatar: '', token: '', demo: true});
  toast(asStreamer ? 'Вошёл как стример канала (демо)' : `Привет, ${USER.name}!`);
}

// обработка возврата от Twitch
async function handleOAuthReturn(){
  const q = new URLSearchParams(location.search), h = new URLSearchParams(location.hash.slice(1));
  if (q.get('error')){
    history.replaceState(null, '', redirectUri());
    toast(q.get('error') === 'access_denied' ? 'Вход отменён' : 'Twitch вернул ошибку входа');
    return;
  }
  const token = h.get('access_token'); if (!token) return;
  let expected = null; try { expected = sessionStorage.getItem('zvezdny-oauth-state') || localStorage.getItem('zvezdny-oauth-state'); } catch(e){}
  history.replaceState(null, '', redirectUri());
  if (!expected || h.get('state') !== expected){ toast('Ошибка проверки входа, попробуй ещё раз'); return; }
  try { localStorage.removeItem('zvezdny-oauth-state'); } catch(e){}
  if (window.opener && window.opener !== window){ // мы во всплывающем окне — передаём токен основной странице
    try { window.opener.postMessage({zvezdnyToken: token}, location.origin); } catch(e){}
    window.close(); return;
  }
  try { setUser(await twitchFetchUser(token)); toast(`Привет, ${USER.name}!`); }
  catch(e){ toast('Не получилось войти через Twitch'); }
}
addEventListener('message', async e => {
  if (e.origin !== location.origin || !e.data || !e.data.zvezdnyToken) return;
  try { setUser(await twitchFetchUser(e.data.zvezdnyToken)); toast(`Привет, ${USER.name}!`); } catch(_){ toast('Не получилось войти через Twitch'); }
});

document.addEventListener('click', e => {
  const lg = e.target.closest('[data-login]');
  if (lg){ loginScopes = lg.dataset.login === 'streamer' ? STREAMER_SCOPES : null; openLogin(lg.dataset.login === 'streamer' ? 'Войди аккаунтом канала: сайт попросит доступ к наградам за баллы, чтобы создать «Звёздный пак».' : undefined); }
  if (e.target.closest('#logout')) logout();
});
$('lgClose').addEventListener('click', closeLogin);
$('loginModal').addEventListener('click', e => { if (e.target.id === 'loginModal') closeLogin(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('loginModal').hidden) closeLogin(); });
$('lgGo').addEventListener('click', twitchAuthorize);
$('lgViewer').addEventListener('click', () => demoLogin(false));
$('lgStreamer').addEventListener('click', () => demoLogin(true));
$('lgNick').addEventListener('keydown', e => { if (e.key === 'Enter') demoLogin(false); });

// восстановление сессии
(() => {
  let saved = null; try { saved = JSON.parse(localStorage.getItem(AUTH_KEY)); } catch(e){}
  if (saved && (saved.demo ? !realAuth() && !LIVE : saved.exp > Date.now() && (saved.via === 'chat') === CHAT_AUTH)){
    USER = saved; SKEY = KEY + ':' + saved.login;
    try { const l = JSON.parse(localStorage.getItem(SKEY)); if (l){ S = l; if (!S.first) S.first = {}; } } catch(e){}
    if (!saved.demo && saved.via !== 'chat') twitchFetchUser(saved.token).then(u => { USER = u; try { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); } catch(_){} renderUser(); }).catch(() => { setUser(null); toast('Сессия Twitch истекла, войди снова'); });
  }
  renderUser();
  handleOAuthReturn();
})();

/* ================= SUPABASE: живой режим =================
   Включается сам, когда в config.js заданы supabaseUrl, supabaseAnonKey и twitchClientId.
   Пакетики приходят с Twitch (награда за баллы канала), розыгрыш и коллекции — на сервере. */
let livePending = null, LIVESET = null, lastPullId = 0, loginScopes = null;
const STREAMER_SCOPES = ['channel:manage:redemptions'];
const emptyState = () => ({bal: 0, packs: 0, dust: 0, pulls: 0, since: 0, dupes: 0, owned: {}, first: {}});
function sbHeaders(){
  const h = {apikey: SUPABASE.anonKey};
  if (SUPABASE.anonKey.startsWith('eyJ')) h.Authorization = 'Bearer ' + SUPABASE.anonKey; // старый anon-ключ (JWT)
  return h;
}
async function api(action, payload = {}){
  if ((!USER || !USER.token) && !ADMIN_KEY && !action.startsWith('login_') && action !== 'admin_claim') throw new Error('Сначала войди');
  const auth = !USER || !USER.token ? {} : USER.via === 'chat' ? {'x-session': USER.token} : {'x-twitch-token': USER.token};
  if (ADMIN_KEY) auth['x-admin-key'] = ADMIN_KEY;
  let r;
  try {
    r = await fetch(`${SUPABASE.url}/functions/v1/api`, {
      method: 'POST',
      headers: {...sbHeaders(), 'Content-Type': 'application/json', ...auth},
      body: JSON.stringify({action, ...payload})
    });
  } catch(e){ throw new Error('Сервер недоступен, проверь интернет'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && USER){ setUser(null); openLogin('Сессия истекла — войди снова.'); }
  if (!r.ok) throw new Error(d.error || 'Ошибка сервера');
  return d;
}
async function rest(path){
  const r = await fetch(`${SUPABASE.url}/rest/v1/${path}`, {headers: sbHeaders()});
  if (!r.ok) throw new Error('Не удалось загрузить данные');
  return r.json();
}
async function liveLoadSet(){
  const [cards, sets] = await Promise.all([
    rest('cards?select=id,sort,name,flavor,rarity,img,tall&active=eq.true&order=sort.asc'),
    rest('settings?select=odds,foil,pity,cost,reward_id,bridge_seen_at,channel,claim_until,follow_only&id=eq.1')
  ]);
  const s = sets[0] || {};
  CARDS = cards.map(c => ({id: c.id, name: c.name, flavor: c.flavor, r: c.rarity, img: c.img, tall: c.tall}));
  renumber();
  Object.keys(RAR).forEach(r => RAR[r].w = s.odds && s.odds[r] != null ? +s.odds[r] : RAR[r].w);
  FOIL = (s.foil ?? 12) / 100; PITY = s.pity || 10; COST = s.cost || 5000; LIVESET = s;
  if (s.channel) TWITCH.channel = s.channel;
}
async function liveReload(){
  try { await liveLoadSet(); } catch(e){ toast(e.message); }
  renderAll(); if (!$('tab-admin').hidden) renderAdminGate();
}
function applyMe(d){ // ответ сервера → локальное состояние для отрисовки
  const p = d.profile || {};
  S = {...emptyState(), packs: p.packs || 0, dust: p.dust || 0, pulls: p.pulls || 0, since: p.since || 0, dupes: p.dupes || 0};
  (d.owned || []).forEach(o => { const k = o.card_id + (o.foil ? '*' : ''); S.owned[k] = o.count; S.first[k] = Date.parse(o.first_at); });
  if (USER && d.scopes) USER.scopes = d.scopes;
  renderTop(); renderAlbum();
}
async function liveMe(){
  try { applyMe(await api('me')); if (packState === 'sealed') updateOpenBtn(); }
  catch(e){ toast(e.message); }
}
function liveOpenRequest(){ // розыгрыш на сервере, пока зритель рвёт пакетик
  livePending = api('open').then(async d => {
    applyMe(d);
    let c = byId(d.result.card_id);
    if (!c){ await liveLoadSet(); c = byId(d.result.card_id); renderAll(); }
    if (!c) throw new Error('Карточка не найдена, обнови страницу');
    pending = {c, foil: d.result.foil, dupe: d.result.dupe};
  }).catch(e => {
    pending = null; toast(e.message);
    if (packState === 'tearing' || packState === 'auto') spawnPack();
  });
}
async function pollFeed(first){
  if (document.hidden && !first) return;
  try {
    const rows = await rest(`pulls?select=id,login,name,card_id,foil&id=gt.${lastPullId}&order=id.desc&limit=${first ? 8 : 20}`);
    rows.reverse().forEach(r => {
      lastPullId = Math.max(lastPullId, r.id);
      const c = byId(r.card_id); if (!c) return;
      addFeed((r.name || r.login).replace(/[<>&"]/g, ''), c, r.foil);
      if (!first && !(USER && r.login === USER.login)) showAlert((r.name || r.login).replace(/[<>&"]/g, ''), c, r.foil);
    });
  } catch(e){}
}
function bridgeOnline(){ return !!(LIVESET && LIVESET.bridge_seen_at) && Date.now() - Date.parse(LIVESET.bridge_seen_at) < 3 * 60 * 1000; }
let BRIDGE_KEY = '';
function overlayUrl(withKey){
  const base = location.origin + location.pathname.replace(/[^/]*$/, '') + 'overlay.html';
  const k = BRIDGE_KEY || ADMIN_KEY;
  return withKey && k ? `${base}?key=${encodeURIComponent(k)}` : base;
}
function renderLiveAdmin(){
  const box = $('admLive'); if (!box) return;
  $('admFollow').hidden = !LIVE;
  if (LIVE && document.activeElement !== $('flOn')) $('flOn').value = LIVESET && LIVESET.follow_only ? '1' : '0';
  box.hidden = !LIVE; if (!LIVE) return;
  const bound = !!(LIVESET && LIVESET.reward_id);
  if (CHAT_AUTH){
    const online = bridgeOnline();
    $('admLiveTxt').innerHTML = `
      <b>Мост чата:</b> ${online ? '<span style="color:#5fd68a">на связи</span>' : '<span style="color:#ffb35c">не запущен</span>'} — это оверлей в OBS со ссылкой ниже. Пока он открыт, зрители получают пакетики за награду. Входить на сайт можно и без него.<br><br>
      <b>Награда:</b> ${bound
        ? `привязана. Каждая покупка «Звёздного пака» даёт зрителю пакетик.`
        : `создай на Twitch награду <b>«Звёздный пак»</b> (Панель управления автора → Награды зрителей → Баллы канала → Управление наградами), включи <b>«Попросить зрителя ввести текст»</b>. Потом при запущенном оверлее купи её сам и напиши в поле: <b>привязать</b>.`}`;
    $('admReward').hidden = true; $('admUnbind').hidden = !bound;
    const obs = $('admObs');
    obs.hidden = false;
    obs.innerHTML = BRIDGE_KEY || ADMIN_KEY
      ? `<b>Ссылка для OBS со встроенным мостом</b> (никому не показывай — в ней ключ):<br><code id="obsKeyUrl">${overlayUrl(true).replace(/key=.*/, 'key=••••••••')}</code> <button class="cat" id="obsKeyCopy">Скопировать ссылку</button> <a class="cat" href="${overlayUrl(true)}&status=1" target="_blank" rel="noopener">Открыть во вкладке</a>`
      : '<button class="pill" id="obsGetKey">Получить ссылку для OBS</button>';
    $('obsGetKey')?.addEventListener('click', async () => {
      try { BRIDGE_KEY = (await api('bridge_key')).key; renderLiveAdmin(); } catch(e){ toast(e.message); }
    });
    $('obsKeyCopy')?.addEventListener('click', () => navigator.clipboard?.writeText(overlayUrl(true)).then(() => toast('Ссылка скопирована')).catch(() => toast('Не получилось скопировать')));
    return;
  }
  const hasScope = USER && (USER.scopes || []).includes('channel:manage:redemptions');
  $('admLiveTxt').innerHTML = !hasScope
    ? 'Чтобы создать награду на канале, войди заново с доступом к наградам: <button class="twbtn" data-login="streamer">Перевойти</button>'
    : bound
      ? `Награда «Звёздный пак» подключена: каждая покупка за ${fmt(COST)} баллов даёт зрителю пакетик. Кнопка ниже обновит цену и подписку.`
      : 'Награды пока нет. Кнопка создаст на канале награду «Звёздный пак» и подпишет сервер на её покупки.';
  $('admReward').disabled = !hasScope;
  $('admReward').textContent = bound ? 'Обновить награду на Twitch' : 'Создать награду «Звёздный пак»';
}
async function liveBoot(){
  // интерфейс под настоящие пакетики
  const balChip = $('bal').parentElement;
  balChip.title = 'Неоткрытые пакетики: покупаются как награда за баллы канала на Twitch';
  balChip.lastChild.textContent = ' пакетиков';
  $('earn').hidden = true; $('reset').hidden = true; $('admResetSet').hidden = true;
  $('admHeadTxt').textContent = 'Добавляй карточки, выставляй редкость и шансы. Изменения сразу сохраняются на сервере и видны всем зрителям.';
  const obs = $('obsLink');
  if (obs){
    const url = location.origin + location.pathname.replace(/[^/]*$/, '') + 'overlay.html';
    obs.hidden = false;
    obs.innerHTML = `Ссылка для OBS (Источник браузера, 1920×1080): <code>${url}</code> <button class="cat" id="obsCopy">Копировать</button>`;
    $('obsCopy').addEventListener('click', () => { navigator.clipboard?.writeText(url).then(() => toast('Ссылка скопирована')).catch(() => toast(url)); });
  }
  try { await liveLoadSet(); } catch(e){ toast('Сервер недоступен: показываю стандартный набор'); }
  renderAll(); spawnPack();
  if (USER && !USER.demo) await liveMe();
  if (ADMIN_KEY && !ADMIN_OK){ adminKeyLogin.silent = true; await adminKeyLogin(ADMIN_KEY).catch(() => {}); adminKeyLogin.silent = false; }
  setInterval(async () => { if (!$('tab-admin').hidden && LIVE){ try { await liveLoadSet(); renderLiveAdmin(); } catch(_){} } }, 30000); // статус моста
  await pollFeed(true);
  setInterval(() => pollFeed(false), 4000);
  setInterval(() => { if (USER && !document.hidden && packState === 'sealed') liveMe(); }, 30000); // пакетики, купленные на стриме
}

$('admReward')?.addEventListener('click', async e => {
  const b = e.currentTarget; b.disabled = true;
  try { const d = await api('reward_setup'); await liveLoadSet(); toast(d.status === 'already_exists' ? 'Награда обновлена' : 'Награда создана, подписка оформлена'); }
  catch(err){ toast(err.message); }
  renderLiveAdmin();
});
$('flSave').addEventListener('click', async () => {
  try {
    const d = await api('follow_save', {token: $('flToken').value.trim(), follow_only: $('flOn').value === '1'});
    $('flToken').value = ''; await liveLoadSet(); renderLiveAdmin();
    toast($('flOn').value === '1' ? 'Готово: паки открывают только фолловеры' : 'Сохранено: паки открывают все');
    $('flRes').textContent = d.has_token ? 'Токен decapi сохранён.' : 'Токен ещё не вставлен.';
  } catch(e){ toast(e.message); }
});
$('flTest').addEventListener('click', async () => {
  const login = $('flTestLogin').value.trim(); if (!login) return toast('Впиши ник зрителя');
  try {
    const d = await api('follow_test', {login});
    $('flRes').textContent = !d.has_token ? 'Сначала вставь токен decapi и нажми «Сохранить».'
      : d.follows === true ? `✅ ${login} отслеживает канал` : d.follows === false ? `❌ ${login} не отслеживает канал` : `Не получилось проверить: ${d.detail || 'decapi не ответил'}`;
  } catch(e){ toast(e.message); }
});
$('admGrant')?.addEventListener('click', async () => {
  const login = $('admGrantLogin').value.trim(), n = +$('admGrantN').value || 1;
  if (!login) return toast('Впиши ник зрителя');
  try { const d = await api('grant', {login, n}); toast(`Выдано: ${n}. Теперь у зрителя ${d.packs}`); if (USER && login.toLowerCase().replace(/^@/, '') === USER.login) liveMe(); }
  catch(err){ toast(err.message); }
});


/* ---------- вход через чат Twitch (без приложения) ---------- */
let chatPoll = null;
function chatLoginReset(){
  clearInterval(chatPoll); chatPoll = null;
  $('lgChatStart').hidden = false; $('lgChatCode').hidden = true;
}
async function chatLoginStart(){
  const nick = $('lgChatNick').value.trim().replace(/^@/, '');
  if (!/^[A-Za-z0-9_]{3,25}$/.test(nick)) return toast('Ник на Twitch — 3–25 символов: латиница, цифры, _');
  $('lgChatGo').disabled = true;
  try {
    const d = await api('login_start', {login: nick});
    const ch = d.channel || TWITCH.channel, cmd = `!пак ${d.code}`;
    $('lgChatHow').innerHTML = `Напиши в чате канала <b>twitch.tv/${ch}</b> с аккаунта <b>${nick.replace(/[<>&"]/g, '')}</b>:`;
    $('lgChatCmd').textContent = cmd;
    $('lgChatOpen').href = `https://www.twitch.tv/popout/${ch}/chat`;
    $('lgChatState').textContent = 'Жду сообщение в чате… Код действует 10 минут. Если не сработало за минуту — напиши его ещё раз.';
    $('lgChatStart').hidden = true; $('lgChatCode').hidden = false;
    $('lgChatCopy').onclick = () => navigator.clipboard?.writeText(cmd).then(() => toast('Скопировано')).catch(() => {});
    const t0 = Date.now();
    clearInterval(chatPoll);
    let done = false;
    const onPoll = r => {
        if (done) return;
        if (r.ok){
          done = true;
          clearInterval(chatPoll); closeLogin();
          const p = r.user || {};
          setUser({login: p.login || nick.toLowerCase(), id: p.twitch_id, name: p.name || nick, avatar: p.avatar || '', token: r.token, via: 'chat', demo: false, exp: Date.now() + 59 * 864e5});
          toast(`Привет, ${USER.name}!`);
        } else if (r.expired || Date.now() - t0 > 10.5 * 60 * 1000){
          done = true; clearInterval(chatPoll); $('lgChatState').textContent = 'Код истёк. Нажми «Другой ник» и получи новый.';
        }
    };
    // сервер сам слушает чат ~22 с на каждый запрос; запускаем новый с перекрытием, чтобы не было «дыр»
    let lastWait = 0;
    const tick = () => {
      if (done || $('loginModal').hidden || chatPoll !== myPoll){ if (chatPoll === myPoll) clearInterval(chatPoll); return; }
      if (Date.now() - lastWait > 17000){ lastWait = Date.now(); api('login_poll', {request_id: d.request_id, wait: true}).then(onPoll).catch(() => {}); }
      else api('login_poll', {request_id: d.request_id}).then(onPoll).catch(() => {}); // вход через мост OBS, если он запущен
    };
    const myPoll = chatPoll = setInterval(tick, 3000); tick();
  } catch(e){ toast(e.message); }
  $('lgChatGo').disabled = false;
}
$('lgChatGo').addEventListener('click', chatLoginStart);
$('lgChatNick').addEventListener('keydown', e => { if (e.key === 'Enter') chatLoginStart(); });
$('lgChatBack').addEventListener('click', chatLoginReset);

/* ---------- панель по ключу стримера ---------- */
async function adminKeyLogin(key){
  ADMIN_KEY = key;
  try {
    const d = await api('me');
    if (!d.is_streamer) throw new Error('Неверный ключ');
    ADMIN_OK = true; try { localStorage.setItem(ADMIN_KEY_LS, key); } catch(_){}
    if (d.profile) applyMe(d);
    if (!adminKeyLogin.silent) toast('Панель стримера открыта'); renderUser(); renderAdminGate();
  } catch(e){
    ADMIN_KEY = ''; ADMIN_OK = false; try { localStorage.removeItem(ADMIN_KEY_LS); } catch(_){}
    toast(e.message === 'no_session' || e.message === 'Сначала войди' ? 'Неверный ключ' : e.message);
  }
}
$('admKeyGo').addEventListener('click', () => { const k = $('admKeyIn').value.trim(); if (k.length < 16) return toast('Ключ — от 16 символов'); adminKeyLogin(k); });
$('admKeyToggle').addEventListener('click', () => { $('admKeyRow').hidden = false; $('admKeyToggle').hidden = true; $('admKeyIn').focus(); });
$('clGen').addEventListener('click', () => {
  const w = ['лес','луна','звезда','мох','сова','папоротник','светлячок','роса','шишка','туман'];
  const b = crypto.getRandomValues(new Uint32Array(4));
  $('clKey').value = [...b].slice(0, 3).map(x => w[x % w.length]).join('-') + '-' + (b[3] % 9000 + 1000);
});
$('clGo').addEventListener('click', async () => {
  const k = $('clKey').value.trim();
  if (k.length < 16) return toast('Ключ — от 16 символов');
  try { await api('admin_claim', {key: k}); }
  catch(e){ return toast(e.message); }
  if (LIVESET) LIVESET.claim_until = null;
  $('clKey').value = '';
  await adminKeyLogin(k);
  toast('Ключ сохранён. Запиши его!');
});
$('admKeyIn').addEventListener('keydown', e => { if (e.key === 'Enter') $('admKeyGo').click(); });
$('admUnbind')?.addEventListener('click', async () => {
  try { await api('reward_unbind'); await liveLoadSet(); renderLiveAdmin(); toast('Награда отвязана — привяжи новую'); } catch(e){ toast(e.message); }
});

if (LIVE) liveBoot(); else { renderAll(); spawnPack(); }
setTab((location.hash || '').slice(1));
setTimeout(() => showAlert('lavanda_42', CARDS[2], false), 600);
