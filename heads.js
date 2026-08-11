// Blink · «карта тусовок» — витрина вариантов шапки стартового экрана.
//
// Показывает пять композиций рядом, чтобы сравнить их вживую, и заодно
// проверить, сколько личных данных с шеринг-экрана имеет смысл поднимать
// на старт: напарник, любимое место, персентиль, архетип.
//
// Логика прототипа сюда не тянется: файл самодостаточный, из общего — только
// данные (nightlife-data.js) и стили nightlife2.css.

import { CITIES, person } from './nightlife-data.js';

const C = CITIES[0];                       // все варианты показываем на москве
const me = C.me;

const lc = (s) => String(s).toLowerCase();
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const CHEVRON = '<svg viewBox="0 0 6 10" aria-hidden="true"><path d="M1 1l4 4-4 4"/></svg>';
const num = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

function img(src, cls) {
  const n = el('img', cls);
  n.src = src;
  n.alt = '';
  n.setAttribute('aria-hidden', 'true');
  return n;
}
function xnum(text, i = 0) {
  const s = el('span', `xnum ${i % 2 ? 'xnum--r' : 'xnum--l'}`, text);
  s.dataset.t = text;
  return s;
}
function avatar(p, cls = '') {
  const box = el('span', `av ${cls}`.trim());
  const im = el('img', p.flip ? 'flip' : null);
  im.src = `avatars/p${p.photo}.png`;
  im.alt = '';
  im.setAttribute('aria-hidden', 'true');
  box.append(im);
  return box;
}
function stack(ids, max = 3) {
  const n = el('span', 'stack');
  for (const id of ids.slice(0, max)) n.append(avatar(person(id)));
  if (ids.length > max) n.append(el('span', 'stack-more', `+${ids.length - max}`));
  return n;
}

// ── те же выборки, что кормят шеринг-экран ──────────────────────────────
const been = C.venues.filter((v) => v.you > 0).sort((a, b) => b.you - a.you);
const fav = been[0] || null;

function nightBuddy() {
  const by = new Map();
  for (const v of been) for (const f of v.friends) by.set(f, (by.get(f) || 0) + 1);
  let best = null;
  for (const [id, n] of by) if (!best || n > best.n) best = { id, n };
  return best && best.n > 1 ? best : null;
}
const buddy = nightBuddy();
const pct = me.rank ? Math.max(1, Math.round((me.rank / me.total) * 100)) : null;

const ARCHETYPES = [
  [0.00, ['наблюдатель', 'ночи']], [0.01, ['новичок', 'ночи']],
  [0.20, ['разведчик', 'города']], [0.40, ['ночной', 'турист']],
  [0.60, ['ночной', 'житель']],   [0.85, ['легенда', 'ночи']],
];
function archetype() {
  const p = C.guide ? me.spots / C.guide : 0;
  let out = ARCHETYPES[0][1];
  for (const [edge, words] of ARCHETYPES) if (p >= edge) out = words;
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// кирпичи, из которых собираются варианты
// ═══════════════════════════════════════════════════════════════════════

// шапка: вордмарк + пилюля города
function topBar() {
  const head = el('header', 'nl-head');
  head.append(img('logo.png', 'nl-logo'));
  const pill = el('button', 'city-pill');
  pill.type = 'button';
  pill.append(el('span', null, 'москва'));
  const sv = document.createElement('span');
  sv.innerHTML = '<svg viewBox="0 0 10 6" aria-hidden="true"><path d="M1 1.2 5 4.8 9 1.2"/></svg>';
  pill.append(sv.firstChild);
  head.append(pill);
  return head;
}

// карточка входа в личный экран — как сейчас в прототипе
function entryCard({ seg = true, label = 'посещённые места', sub = 'узнать больше' } = {}) {
  const box = el('button', 'you you--lit');
  box.type = 'button';

  const row = el('span', 'you-row');
  const badge = el('span', 'you-badge');
  badge.append(xnum(String(me.spots)), el('em', null, `/ ${C.guide}`));
  row.append(badge);

  const txt = el('span', 'you-txt');
  txt.append(el('b', null, label), el('i', null, sub));
  row.append(txt);

  const go = el('span', 'you-go');
  go.innerHTML = CHEVRON;
  row.append(go);
  box.append(row);

  if (seg) {
    const s = el('span', 'you-seg');
    for (let i = 0; i < C.guide; i++) s.append(el('i', i < me.spots ? 'on' : null));
    box.append(s);
  }
  return box;
}

// напарник и любимое место — ровно тот блок, что живёт на шеринге
function duo(cls = '') {
  const box = el('div', `sh2-duo ${cls}`.trim());

  if (buddy) {
    const item = el('div', 'sh2-duo-i');
    item.append(avatar(person(buddy.id)));
    const t = el('div', 'sh2-duo-t');
    t.append(el('b', null, lc(person(buddy.id).name)),
             el('i', null, `${buddy.n} общих места`));
    item.append(t);
    box.append(item);
  }
  if (fav) {
    const item = el('div', 'sh2-duo-i');
    item.append(xnum(`x${fav.you}`, 1));
    const t = el('div', 'sh2-duo-t');
    t.append(el('b', null, fav.name), el('i', null, 'любимое место'));
    item.append(t);
    box.append(item);
  }
  return box;
}

// персентиль оторванным голографическим стикером
function pctChip() {
  const chip = el('div', 'sh2-pct hv-pct');
  chip.append(el('span', null, 'ты в топ'), el('b', null, `${pct}%`),
              el('span', null, `тусовщиков ${C.gen}`));
  return chip;
}

// три строки топа — чтобы шапка не висела в пустоте
function listPreview(n = 3) {
  const sec = el('section', 'sec');
  sec.append(el('h2', 'h2', `топ мест ${C.gen}`));
  const list = el('div', 'vlist');
  C.venues.slice(0, n).forEach((v, i) => {
    const row = el('div', 'vrow');
    row.append(el('span', 'vrank', String(i + 1)));

    const body = el('span', 'vbody');
    const name = el('span', 'vname');
    name.append(el('span', null, v.name));
    body.append(name);
    if (v.friends.length) {
      const line = el('span', 'vwho');
      line.append(stack(v.friends, 3));
      line.append(el('span', 'vwho-t', v.friends.length === 1 ? 'был(а) здесь' : 'были здесь'));
      body.append(line);
    }
    row.append(body);

    const val = el('span', 'vcount');
    val.append(xnum(num(v.guests), i), el('i', null, 'посещений'));
    row.append(val);
    list.append(row);
  });
  sec.append(list);
  return sec;
}

// ═══════════════════════════════════════════════════════════════════════
// варианты
// ═══════════════════════════════════════════════════════════════════════
const VARIANTS = [
  {
    n: 1,
    name: 'как сейчас',
    note: 'титул в две строки, шар за краем, карточка со шкалой по местам. личного минимум — только счёт',
    build() {
      const box = document.createDocumentFragment();
      const hero = el('div', 'nl-hero');
      hero.append(img('assets/disco-ball.png', 'nl-disco'));
      const h = el('h1', 'nl-title');
      h.append(el('span', null, 'карта'), el('span', null, 'тусовок'));
      hero.append(h, el('p', 'nl-sub', 'собрали самые популярные ночные места твоего города'));
      box.append(hero, entryCard());
      return box;
    },
  },
  {
    n: 2,
    name: 'с напарником и любимым местом',
    note: 'то же плюс два личных факта с шеринга: с кем чаще пересекаешься и куда ходишь чаще всего',
    build() {
      const box = document.createDocumentFragment();
      const hero = el('div', 'nl-hero');
      hero.append(img('assets/disco-ball.png', 'nl-disco'));
      const h = el('h1', 'nl-title');
      h.append(el('span', null, 'карта'), el('span', null, 'тусовок'));
      hero.append(h, el('p', 'nl-sub', 'собрали самые популярные ночные места твоего города'));
      box.append(hero, entryCard(), duo('hv-duo'));
      return box;
    },
  },
  {
    n: 3,
    name: 'с персентилем',
    note: 'голографический стикер «ты в топ 4%» плюс напарник и любимое место: и статус, и живые лица сразу на старте',
    build() {
      const box = document.createDocumentFragment();
      const hero = el('div', 'nl-hero');
      hero.append(img('assets/disco-ball.png', 'nl-disco'));
      const h = el('h1', 'nl-title');
      h.append(el('span', null, 'карта'), el('span', null, 'тусовок'));
      hero.append(h);
      if (pct) hero.append(pctChip());
      box.append(hero, entryCard(), duo('hv-duo'));
      return box;
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════
// сборка витрины
// ═══════════════════════════════════════════════════════════════════════
const rail = document.getElementById('rail');

for (const v of VARIANTS) {
  const item = el('div', 'hv-item');
  item.dataset.variant = `${v.n} · ${v.name}`;   // подписи не показываем, но в разметке они есть

  const phone = el('div', 'phone');
  const shell = el('div', 'nl-shell');

  const sb = el('div', 'status-bar');
  sb.append(el('span', 'sb-time', '4:20'));
  const island = el('span', 'island');
  island.append(img('assets/blink-logo.png'));
  sb.append(island, el('span', 'sb-icons'));
  shell.append(sb);

  const scroll = el('main', 'nl-scroll');
  scroll.append(topBar());
  scroll.append(v.build());
  scroll.append(listPreview());
  shell.append(scroll);
  shell.append(el('span', 'home-bar'));

  phone.append(shell);
  item.append(phone);
  rail.append(item);
}
