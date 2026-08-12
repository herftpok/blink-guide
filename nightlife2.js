// Blink · «карта тусовок» — места притяжения ночью, ВАРИАНТ «ЛЕНТА».
// Всё одним скроллом, без вкладок. Второй вариант — nightlife.js («вкладки»),
// данные у них общие (nightlife-data.js), верстка и логика — раздельные.

import {
  CITIES, FRIENDS, YOU, person, city as findCity,
} from './nightlife-data.js';

// ═══════════════════════════════════════════════════════════════════════
// helpers
// ═══════════════════════════════════════════════════════════════════════

// Blink пишет имена и интерфейс в нижнем регистре — см. экраны друзей и чатов
const lc = (s) => String(s).toLowerCase();

function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
const places = (n) => `${n} ${plural(n, 'место', 'места', 'мест')}`;
const visits = (n) => plural(n, 'посещение', 'посещения', 'посещений');
const num    = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const $ = (id) => document.getElementById(id);

const CHECK = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.4L9.5 3.6"/></svg>';
const CHEVRON = '<svg viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4"/></svg>';

// 3D-стикер из /react
function sticker(file, cls) {
  const img = el('img', cls);
  img.src = `react/${file}`;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  return img;
}

// стикер-число «x12»: чёрная заливка + белая обводка, лёгкий поворот;
// соседние строки заваливаются в разные стороны
function xnum(text, i = 0) {
  const s = el('span', `xnum ${i % 2 ? 'xnum--r' : 'xnum--l'}`, text);
  s.dataset.t = text;
  return s;
}

// ── аватар: голая PNG-вырезка поверх лёгкого свечения ───────────────────
function avatar(p, cls = '') {
  const box = el('span', `av ${cls}`.trim());
  const img = el('img', p.flip ? 'flip' : null);
  img.src = `avatars/p${p.photo}.png`;
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  box.append(img);
  return box;
}

// стопка лиц; кто не влез — плиткой «+N» в хвосте
function stack(ids, max = 3) {
  const n = el('span', 'stack');
  for (const id of ids.slice(0, max)) {
    n.append(avatar(person(id), id === 'you' ? 'av--me' : ''));
  }
  if (ids.length > max) n.append(el('span', 'stack-more', `+${ids.length - max}`));
  return n;
}

// ── toast ────────────────────────────────────────────────────────────────
const toastEl = $('toast');
let toastTimer;
function toast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add('in'));
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('in');
    setTimeout(() => { toastEl.hidden = true; }, 220);
  }, 1900);
}

// ═══════════════════════════════════════════════════════════════════════
// состояние
// ═══════════════════════════════════════════════════════════════════════
let C = CITIES[0];      // текущий город
let scope = 'city';     // рейтинг: весь город / друзья

// Архетип по доле открытых мест. Ровно этот ярлык люди присваивают себе и
// шерят — в Wrapped самым расшариваемым элементом оказалась именно
// «listening personality», а не цифры. Две строки: так он читается крупно.
const ARCHETYPES = [
  [0.00, ['наблюдатель', 'ночи']],
  [0.01, ['новичок', 'ночи']],
  [0.20, ['разведчик', 'города']],
  [0.40, ['ночной', 'турист']],
  [0.60, ['ночной', 'житель']],
  [0.85, ['легенда', 'ночи']],
];
function archetype(spots, guide) {
  const p = guide ? spots / guide : 0;
  let out = ARCHETYPES[0][1];
  for (const [edge, words] of ARCHETYPES) if (p >= edge) out = words;
  return out;
}
// цвет типа места — из той же семьи, что свечения секций
const KIND_COLOR = {
  'бар': '#ff75e1',
  'клуб': '#9d7bff',
  'ресторан': '#6fd2ff',
  'рюмочная': '#a4ef51',
};

// «из чего сделана твоя ночь» — доли по типам мест, где ты был
function kindMix(been) {
  const by = new Map();
  for (const v of been) by.set(v.kind, (by.get(v.kind) || 0) + 1);
  return [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, n]) => ({
      kind, n,
      share: n / been.length,
      color: KIND_COLOR[kind] || '#ff8a3d',
    }));
}

// ночной напарник: друг, с которым больше всего общих мест. Социальный
// инсайт вытягивает шеринг — на карточке появляется живое лицо, а другу
// есть повод открыть свою.
function nightBuddy(been) {
  const by = new Map();
  for (const v of been) for (const f of v.friends) by.set(f, (by.get(f) || 0) + 1);
  let best = null;
  for (const [id, n] of by) if (!best || n > best.n) best = { id, n };
  return best && best.n > 1 ? best : null;
}

// какая ночь твоя: пятница или суббота — взвешиваем по числу посещений
function ownNight(been) {
  let fr = 0, sa = 0;
  for (const v of been) (v.night === 'сб' ? (sa += v.you) : (fr += v.you));
  return sa >= fr ? 'сб' : 'пт';
}

// счётчик, который докручивается до значения — цифрам нужно «оживать»
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(node, to, delay = 0, dur = 850) {
  if (REDUCED) { node.textContent = String(to); return; }
  node.textContent = '0';
  const t0 = performance.now() + delay;
  const step = (t) => {
    const p = Math.min(1, Math.max(0, (t - t0) / dur));
    node.textContent = String(Math.round(to * (1 - Math.pow(1 - p, 3))));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

const beenOf = () => C.venues.filter((v) => v.you > 0).sort((a, b) => b.you - a.you);
const missingOf = () => C.venues
  .filter((v) => v.you === 0 && v.friends.length > 0)
  .sort((a, b) => b.friends.length - a.friends.length || b.guests - a.guests);

const PCT_BRAG = 25;          // до какого персентиля статус ещё звучит как достижение

// доля города: 4% значит «ты выше 96% тусовщиков»
const pctOf = (me) => (me.rank ? Math.max(1, Math.round((me.rank / me.total) * 100)) : null);

// персентиль оторванным голографическим стикером. На шеринге он про ярлык
// («топ 4%»), в шапке — обращение к самому человеку («ты в топ 4%»)
function pctChip(pct, { lead = 'топ', cls = '' } = {}) {
  const chip = el('div', `sh2-pct ${cls}`.trim());
  chip.append(el('span', null, lead), el('b', null, `${pct}%`),
              el('span', null, `тусовщиков ${C.gen}`));
  return chip;
}

// две личные подписи: с кем чаще пересекаешься и куда ходишь чаще всего
function duoRow(been, fav, cls = '') {
  const buddy = nightBuddy(been);
  if (!buddy && !fav) return null;

  const duo = el('div', `sh2-duo ${cls}`.trim());
  if (buddy) {
    const p = person(buddy.id);
    const item = el('div', 'sh2-duo-i');
    item.append(avatar(p));
    const t = el('div', 'sh2-duo-t');
    t.append(el('b', null, lc(p.name)));
    t.append(el('i', null, `${buddy.n} общих ${plural(buddy.n, 'место', 'места', 'мест')}`));
    item.append(t);
    duo.append(item);
  }
  if (fav) {
    const item = el('div', 'sh2-duo-i');
    item.append(xnum(`x${fav.you}`, 1));
    const t = el('div', 'sh2-duo-t');
    t.append(el('b', null, fav.name), el('i', null, 'любимое место'));
    item.append(t);
    duo.append(item);
  }
  return duo;
}

// ═══════════════════════════════════════════════════════════════════════
// 0 · шапка: персентиль под титулом и личная пара под карточкой
// ═══════════════════════════════════════════════════════════════════════
function renderHero() {
  const me = C.me;

  const slot = $('hero-pct');
  slot.textContent = '';
  const pct = pctOf(me);
  // «ты в топ 71%» — не повод для гордости: в шапке стикер только тем,
  // кто реально в верхней четверти города
  if (me.spots && pct && pct <= PCT_BRAG) {
    slot.append(pctChip(pct, { lead: 'ты в топ', cls: 'nl-pct' }));
  }

  const duoSlot = $('you-duo');
  duoSlot.textContent = '';
  if (me.spots) {
    const been = beenOf();
    const duo = duoRow(been, been[0] || null, 'nl-duo');
    if (duo) duoSlot.append(duo);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 1 · «твоя ночь» — тёмная карточка, тап открывает личную сводку
// ═══════════════════════════════════════════════════════════════════════
function renderYou() {
  const box = $('you-card');
  box.textContent = '';
  const me = C.me;

  // в этом городе тебя ещё не было
  if (!me.spots) {
    box.className = 'you you--empty';
    box.append(sticker('star.png', 'you-star'));
    box.append(el('div', 'you-t', `${C.loc} ты ещё нигде не отметился`));
    box.append(el('div', 'you-n',
      `на карте ${places(C.guide)} — сходи хотя бы в одно, и здесь появится твоя ночная статистика`));
    return;
  }

  box.className = 'you';

  const row = el('span', 'you-row');

  // число — тем же стикером, что и счётчики посещений в списках
  const badge = el('span', 'you-badge');
  badge.append(xnum(String(me.spots)), el('em', null, `/ ${C.guide}`));
  row.append(badge);

  const txt = el('span', 'you-txt');
  txt.append(el('b', null, 'посещённые места'), el('i', null, 'узнать больше'));
  row.append(txt);

  const go = el('span', 'you-go');
  go.innerHTML = CHEVRON;
  row.append(go);
  box.append(row);

  // шкала по местам гида: одно деление — одно место, свои закрашены
  const seg = el('span', 'you-seg');
  for (let i = 0; i < C.guide; i++) seg.append(el('i', i < me.spots ? 'on' : null));
  box.append(seg);
  requestAnimationFrame(() => box.classList.add('you--lit'));
}

// ═══════════════════════════════════════════════════════════════════════
// 2 · строка заведения — общий кирпич списков
// ═══════════════════════════════════════════════════════════════════════
function venueRow(v, { rank = null, trailing = null, idx = 0 } = {}) {
  const row = el('button', 'vrow');
  row.type = 'button';
  row.dataset.id = v.id;

  if (rank != null) row.append(el('span', 'vrank', String(rank)));

  const body = el('span', 'vbody');
  const name = el('span', 'vname');
  name.append(el('span', null, v.name));
  body.append(name);
  // адрес в списке не показываем — он живёт в карточке места

  // только лица друзей и «были здесь»; имена и своя отметка — в карточке
  if (v.friends.length) {
    const line = el('span', 'vwho');
    line.append(stack(v.friends, 3));
    line.append(el('span', 'vwho-t',
      v.friends.length === 1 ? 'был(а) здесь' : 'были здесь'));
    body.append(line);
  }
  row.append(body);

  const t = trailing ?? { t: num(v.guests), label: 'посещений' };
  const val = el('span', 'vcount');
  val.append(xnum(t.t, idx));
  if (t.label) val.append(el('i', null, t.label));
  row.append(val);

  row.addEventListener('click', () => openVenue(v));
  return row;
}

function renderVenues() {
  const list = $('vlist');
  list.textContent = '';
  C.venues.forEach((v, i) => list.append(venueRow(v, { rank: i + 1, idx: i })));

  $('top-title').textContent = `топ мест ${C.gen}`;
}

// ═══════════════════════════════════════════════════════════════════════
// 3 · тусовщики — лента карточек без номеров мест
// ═══════════════════════════════════════════════════════════════════════
function partierCard(entry, rank, idx) {
  const first = rank === 1 && !entry.isMe;
  const card = el('div',
    `pcard${first ? ' pcard--first' : ''}${entry.isMe ? ' pcard--me' : ''}`);

  if (first) card.append(sticker('fire.png', 'pcard-fire'));

  // своё лицо — без обводки, «ты» и так отмечен розовой карточкой
  const p = entry.isMe ? YOU : person(entry.id);
  card.append(avatar(p));
  card.append(el('div', 'pcard-name', entry.isMe ? 'ты' : lc(p.name)));
  card.append(xnum(`x${entry.visits}`, idx));
  card.append(el('div', 'pcard-lab', visits(entry.visits)));
  return card;
}

function renderPartiers() {
  const rail = $('prail');
  rail.textContent = '';
  const me = { id: 'you', isMe: true, visits: C.me.visits, spots: C.me.spots };
  const note = $('scope-note');

  if (scope === 'city') {
    C.partiers.slice(0, 10).forEach((e, i) => rail.append(partierCard(e, i + 1, i)));
    if (C.me.rank) rail.append(partierCard(me, C.me.rank, 10));
    note.hidden = true;
  } else {
    const rows = C.partiers.filter((e) => FRIENDS.includes(e.id));
    if (C.me.visits > 0) rows.push(me);
    rows.sort((a, b) => b.visits - a.visits);
    rows.forEach((e, i) => rail.append(partierCard(e, i + 1, i)));
    // подпись показываем только когда показывать нечего
    note.hidden = rows.length > 0;
    note.textContent = `${C.loc} никто из твоих друзей ещё не отмечался`;
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 4 · друзья ходят, а ты — нет
// ═══════════════════════════════════════════════════════════════════════
function renderMissing() {
  const missing = missingOf().slice(0, 4);
  $('miss-sec').hidden = !missing.length;
  if (!missing.length) return;

  const list = $('missing');
  list.textContent = '';
  missing.forEach((v, i) => {
    list.append(venueRow(v, {
      idx: i,
      trailing: {
        t: `x${v.friends.length}`,
        label: plural(v.friends.length, 'друг', 'друга', 'друзей'),
      },
    }));
  });
}

// ═══════════════════════════════════════════════════════════════════════
// шторка
// ═══════════════════════════════════════════════════════════════════════
const sheet = $('sheet'), sheetBack = $('sheet-back'), sheetBody = $('sheet-body');

function openSheet(build) {
  sheetBody.textContent = '';
  build(sheetBody);
  sheet.scrollTop = 0;
  sheet.hidden = false;
  sheetBack.hidden = false;
  requestAnimationFrame(() => {
    sheet.classList.add('in');
    sheetBack.classList.add('in');
  });
}

function closeSheet() {
  sheet.classList.remove('in');
  sheetBack.classList.remove('in');
  setTimeout(() => { sheet.hidden = true; sheetBack.hidden = true; }, 320);
}
sheetBack.addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheet.hidden) closeSheet();
});

// ── карточка заведения ───────────────────────────────────────────────────
function openVenue(v) {
  openSheet((box) => {
    // название слева, число посещений стикером справа — как в списке мест
    const head = el('div', 'sh-title-row');
    head.append(el('div', 'sh-name', v.name));
    const count = el('span', 'sh-count');
    count.append(xnum(num(v.guests), 0), el('i', null, 'посещений'));
    head.append(count);
    box.append(head);
    box.append(el('div', 'sh-meta', v.addr));

    // чекины, снятые в этом месте
    if (v.checkins?.length) {
      box.append(el('div', 'sh-label', 'чекины отсюда'));
      const feed = el('div', 'feed');
      for (const c of v.checkins) {
        const card = el('button', `feed-card${c.fresh ? ' feed-card--fresh' : ''}`);
        card.type = 'button';
        const ph = el('span', 'feed-ph');
        const img = el('img');
        img.src = c.photo;
        img.alt = '';
        img.loading = 'lazy';
        ph.append(img);
        card.append(ph, el('span', 'feed-name', c.user));
        card.addEventListener('click', () => toast(`чекин @${c.user}`));
        feed.append(card);
      }
      box.append(feed);
    }

    // здесь были — все друзья лицами и именами, без «+N» и без себя
    box.append(el('div', 'sh-label', 'здесь были'));
    if (v.friends.length) {
      const rail = el('div', 'who-rail');
      for (const id of v.friends) {
        const p = person(id);
        const item = el('div', 'who-item');
        item.append(avatar(p), el('span', 'who-name', lc(p.name)));
        rail.append(item);
      }
      box.append(rail);
    } else {
      box.append(el('div', 'who-empty',
        'из твоих тут ещё никого не было — есть шанс быть первым'));
    }

    const actions = el('div', 'sh-actions');
    const go = el('button', 'btn-white', 'ПОСТРОИТЬ МАРШРУТ');
    go.type = 'button';
    go.addEventListener('click', () => { closeSheet(); toast('строим маршрут'); });
    const call = el('button', 'btn-dark', 'ПОЗВАТЬ');
    call.type = 'button';
    call.addEventListener('click', () => { closeSheet(); toast('зовём друзей сюда'); });
    actions.append(go, call);
    box.append(actions);
  });
}

// ── шеринг-экран «ночная личность» ──────────────────────────────────────
// Не отчёт, а портрет: архетип крупнее всего, персентиль даёт статус,
// список мест — то, ради чего экран интересен ЗРИТЕЛЮ, а не только автору.
const shareEl = $('share'), shareBody = $('share-body');

function closeShare() {
  shareEl.classList.remove('in');
  setTimeout(() => { shareEl.hidden = true; }, 400);
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !shareEl.hidden) closeShare();
});

function img(src, cls) {
  const n = el('img', cls);
  n.src = src;
  n.alt = '';
  n.setAttribute('aria-hidden', 'true');
  return n;
}

function openYou() {
  const me = C.me;
  const been = beenOf();
  const fav = been[0] || null;              // где был чаще всего
  const [w1, w2] = archetype(me.spots, C.guide);
  const pct = pctOf(me);

  shareBody.textContent = '';
  if (!shareEl.querySelector('.sh2-map')) {
    shareEl.insertBefore(el('span', 'sh2-map'), shareEl.firstChild);
  }

  // ── шапка ──
  const top = el('div', 'sh2-top');
  const brand = el('div', 'sh2-brand');
  brand.append(img('assets/blink-logo.png'), el('span', null, 'карта тусовок'));
  const x = el('button', 'sh2-x');
  x.type = 'button';
  x.setAttribute('aria-label', 'Закрыть');
  x.innerHTML = '<svg viewBox="0 0 14 14"><path d="M2 2l10 10M12 2L2 12"/></svg>';
  x.addEventListener('click', closeShare);
  top.append(brand, x);
  shareBody.append(top);

  // шар нарочно не влезает в кадр — часть уходит за правый край
  shareBody.append(img('assets/disco-ball.png', 'sh2-disco'));

  // ── архетип: главное, что уносят на скриншоте ──
  shareBody.append(el('div', 'sh2-eyebrow', 'моя ночная личность'));
  const longest = Math.max(w1.length, w2.length);
  const title = el('h2', `sh2-title${longest > 9 ? ' sh2-title--long' : ''}`);
  title.append(el('span', null, w1), el('span', null, w2));
  shareBody.append(title);

  // ── персентиль наклонным стикером ──
  if (pct) shareBody.append(pctChip(pct));

  // ── прогресс по гиду ──
  const prog = el('div', 'sh2-prog');
  const n = el('div', 'sh2-prog-num');
  const nb = el('b');
  n.append(nb, el('em', null, ` / ${C.guide}`));
  prog.append(n, el('div', 'sh2-prog-t', 'мест открыто'));
  const bar = el('div', 'sh2-bar');
  const fill = el('b');
  fill.style.width = '0%';
  bar.append(fill);
  prog.append(bar);
  shareBody.append(prog);
  countUp(nb, me.spots, 700);
  setTimeout(() => {
    fill.style.width = `${Math.max(4, Math.round((me.spots / C.guide) * 100))}%`;
  }, REDUCED ? 0 : 780);

  // ── две личные подписи: с кем ходишь и куда чаще всего ──
  const duo = duoRow(been, fav);
  if (duo) shareBody.append(duo);

  // ── нечего шерить: показываем, с чего начать ночь ──
  if (!been.length) {
    shareBody.append(el('div', 'sh2-label', `с чего начать в ${C.name}`));
    const chips = el('div', 'sh2-chips');
    C.venues.slice(0, 6).forEach((v, i) => {
      const chip = el('span', `sh2-chip${i === 0 ? ' sh2-chip--top' : ''}`, v.name);
      chip.style.animationDelay = `${1.0 + i * 0.05}s`;
      chips.append(chip);
    });
    shareBody.append(chips);
  }

  // ── сами места: ради этого списка экран и смотрят со стороны ──
  if (been.length) {
    shareBody.append(el('div', 'sh2-label', 'посещённые места'));
    const chips = el('div', 'sh2-chips');
    const MAX = 10;
    been.slice(0, MAX).forEach((v, i) => {
      // любимое место уже подписано выше — в списке его не выделяем
      const chip = el('span', 'sh2-chip', v.name);
      chip.style.animationDelay = `${1.34 + i * 0.05}s`;
      chips.append(chip);
    });
    if (been.length > MAX) {
      const rest = el('span', 'sh2-chip', `+${been.length - MAX}`);
      rest.style.animationDelay = `${1.34 + MAX * 0.05}s`;
      chips.append(rest);
    }
    shareBody.append(chips);
  }

  shareBody.append(el('div', 'sh2-fill'));

  const btn = el('button', 'sh2-btn', been.length ? 'ПОДЕЛИТЬСЯ' : 'ОТКРЫТЬ КАРТУ');
  btn.type = 'button';
  btn.addEventListener('click', () => {
    if (been.length) return toast('карточка ушла в шеринг');
    closeShare();
  });
  shareBody.append(btn);

  shareEl.hidden = false;
  shareEl.classList.remove('in');
  requestAnimationFrame(() => shareEl.classList.add('in'));
}

// ── выбор города ─────────────────────────────────────────────────────────
function openCityPicker() {
  openSheet((box) => {
    box.append(el('div', 'sh-name', 'город'));
    box.append(el('div', 'sh-meta', 'карта собирается там, где у блинка хватает ночных данных'));

    const list = el('div', 'city-list');
    for (const c of CITIES) {
      const row = el('button', `city-row${c.id === C.id ? ' on' : ''}`);
      row.type = 'button';
      const body = el('div', 'city-row-body');
      body.append(el('div', 'city-row-name', c.name));
      body.append(el('div', 'city-row-meta',
        `${places(c.guide)} · ${num(c.me.total)} тусовщиков`));
      row.append(body);
      if (c.id === C.id) {
        const tick = el('span', 'city-tick');
        tick.innerHTML = CHECK;
        row.append(tick);
      }
      row.addEventListener('click', () => {
        closeSheet();
        if (c.id !== C.id) setCity(c.id);
      });
      list.append(row);
    }
    box.append(list);
  });
}

function setCity(id) {
  C = findCity(id);
  $('city-label').textContent = C.short;
  renderAll();
  $('scroll').scrollTo({ top: 0, behavior: 'smooth' });
  toast(`карта тусовок: ${C.name}`);
}

// ═══════════════════════════════════════════════════════════════════════
// сборка
// ═══════════════════════════════════════════════════════════════════════
function renderAll() {
  renderHero();
  renderYou();
  renderVenues();
  renderPartiers();
  renderMissing();
}

{
  const box = $('scope');
  box.querySelectorAll('.scope-btn').forEach((b) => {
    b.addEventListener('click', () => {
      scope = b.dataset.scope;
      box.querySelectorAll('.scope-btn').forEach((x) => x.classList.toggle('on', x === b));
      renderPartiers();
    });
  });
}

$('you-card').addEventListener('click', openYou);
$('city-btn').addEventListener('click', openCityPicker);

renderAll();
