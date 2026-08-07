// ═══════════════════════════════════════════════════════════════════════
// Blink · «места притяжения» — гид по заведениям, где тусуется молодёжь
//
// Как это считается (продуктовая логика, отражена в копирайте экрана):
//   1. берём чекины/гео-сигналы за ночи пятницы и субботы, 23:00–06:00;
//   2. ищем аномалии — клетки карты, где ночью пользователей в разы больше
//      обычного для этого места и часа;
//   3. накладываем аномалии на карту заведений и оставляем те, куда
//      скопление действительно «прилипло».
//
// ВНИМАНИЕ: всё ниже — моковые данные для прототипа. Названия заведений
// настоящие, но АДРЕСА И ЦИФРЫ ПРОСТАВЛЕНЫ ВРУЧНУЮ и не проверялись —
// перед публикацией их надо подтянуть из реальной базы POI.
// ═══════════════════════════════════════════════════════════════════════

export const PERIOD = 'за 3 месяца';
export const NIGHT_WINDOW = 'ночь пт и сб · 23:00–06:00';

// ── люди ─────────────────────────────────────────────────────────────────
// [id, имя, возраст, фото] — фотографий в /avatars всего пять (p1, p4 —
// девушки, p2, p3, p5 — парни). Номер фото задан руками так, чтобы одно
// лицо не оказалось в соседних строках ни одного из рейтингов.
const RAW_PEOPLE = [
  // твой круг — москва
  ['lera',   'Лера',   23, 1], ['seva',   'Сева',   26, 2],
  ['alisa',  'Алиса',  25, 1], ['yana',   'Яна',    24, 4],
  ['kirill', 'Кирилл', 27, 3], ['max',    'Макс',   25, 5],
  ['roma',   'Рома',   28, 2], ['denis',  'Денис',  26, 3],
  ['vika',   'Вика',   22, 1], ['polina', 'Полина', 24, 4],
  ['katya',  'Катя',   25, 1], ['artem',  'Артём',  27, 2],
  ['sonya',  'Соня',   23, 4], ['nikita', 'Никита', 26, 5],
  // тусовщики других городов — с тобой не знакомы
  ['ilya',   'Илья',   25, 2], ['nastya', 'Настя',  23, 4],
  ['timur',  'Тимур',  27, 3], ['asya',   'Ася',    22, 1],
  ['grisha', 'Гриша',  26, 5], ['zhenya', 'Женя',   24, 4],
  ['olya',   'Оля',    25, 1], ['stas',   'Стас',   28, 2],
  ['dina',   'Дина',   23, 4], ['mark',   'Марк',   26, 3],
];

export const PEOPLE = (() => {
  const out = {};
  const used = {};
  for (const [id, name, age, photo] of RAW_PEOPLE) {
    used[photo] = (used[photo] || 0) + 1;
    out[id] = {
      id, name, age, photo,
      // каждое второе использование одного и того же фото отражаем по
      // горизонтали — повтор перестаёт читаться как одно и то же лицо
      flip: used[photo] % 2 === 0,
    };
  }
  return out;
})();

export const YOU = { id: 'you', name: 'ты', age: 24, photo: 5, flip: false };

// твои друзья — только у них видно поимённо, где они были
export const FRIENDS = ['lera', 'yana', 'max', 'denis', 'polina', 'katya', 'artem', 'sonya'];

// ── чекины ───────────────────────────────────────────────────────────────
// Чекин привязан к конкретному месту и живёт в его карточке. Фото нарезаны
// из CheckinFeed.png (assets/checkin-*.jpg) — на прототипе их всего четыре,
// поэтому лента места собирается из общего пула детерминированно по id
// заведения: экран выглядит одинаково на каждой перезагрузке.
const CHECKIN_PHOTOS = [
  'assets/checkin-trachuk.jpg',
  'assets/checkin-maxklimchuk.jpg',
  'assets/checkin-margo.jpg',
  'assets/checkin-designer.jpg',
];
const NICKS = [
  'trachuk', 'maxklimchuk', 'margo', 'designer', 'bezai',
  'ksenia13437', 'melissa', 'irenn', 'linch', 'artemmm',
];

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// чем популярнее место, тем больше свежих фото из него
function checkinsFor(v) {
  const h = hash(v.id);
  const n = v.guests > 800 ? 4 : v.guests > 450 ? 3 : 2;
  return Array.from({ length: n }, (_, i) => ({
    user: NICKS[(h + i * 3) % NICKS.length],
    photo: CHECKIN_PHOTOS[(h + i) % CHECKIN_PHOTOS.length],
    fresh: i < 2,   // две первые карточки — этой ночью, у них цветная рамка
  }));
}

export function person(id) {
  return id === 'you' ? YOU : PEOPLE[id];
}

// ── города ───────────────────────────────────────────────────────────────
// guests    — гостей блинка за период (агрегат, не список людей)
// friends   — только твои друзья с открытыми чекинами
// you       — сколько раз ты сам тут был
// night     — какая ночь собирает больше, пятница или суббота
// me.rank   — твоё место в рейтинге города (null — тебя в нём ещё нет)

export const CITIES = [
  {
    id: 'msk',
    name: 'москва',
    short: 'москва',   // как влезает в пилюлю в шапке
    loc: 'в москве',    // предложный падеж — для фраз в копирайте
    gen: 'москвы',      // родительный — «топ мест москвы»
    venues: [
      { id: 'mutabor', name: 'mutabor', kind: 'клуб',
        addr: 'южнопортовая ул., 5с10', guests: 1284, peak: '02:10', night: 'сб',
        you: 1, lastYou: 'в апреле', friends: ['lera', 'max', 'denis', 'yana', 'katya'] },
      { id: 'powerhouse', name: 'powerhouse', kind: 'клуб',
        addr: 'бережковская наб., 28', guests: 1106, peak: '01:50', night: 'сб',
        you: 0, lastYou: null, friends: ['katya', 'sonya'] },
      { id: 'rovesnik', name: 'ровесник', kind: 'бар',
        addr: 'большой каретный пер., 4с3', guests: 968, peak: '00:40', night: 'пт',
        you: 6, lastYou: 'в субботу', friends: ['yana', 'lera', 'polina'] },
      { id: 'depo', name: 'депо', kind: 'ресторан',
        addr: 'лесная ул., 20с3', guests: 902, peak: '23:40', night: 'пт',
        you: 4, lastYou: '2 недели назад', friends: ['lera', 'artem', 'katya'] },
      { id: 'propaganda', name: 'propaganda', kind: 'клуб',
        addr: 'большой златоустинский пер., 7', guests: 861, peak: '01:20', night: 'сб',
        you: 2, lastYou: 'в марте', friends: ['denis'] },
      { id: 'simachev', name: 'симачёв', kind: 'бар',
        addr: 'столешников пер., 10', guests: 744, peak: '01:10', night: 'пт',
        you: 0, lastYou: null, friends: ['polina', 'max'] },
      { id: 'noor', name: 'noor', kind: 'бар',
        addr: 'тверская ул., 23/12', guests: 690, peak: '00:30', night: 'пт',
        you: 1, lastYou: 'в феврале', friends: ['yana'] },
      { id: 'jagger', name: 'jagger', kind: 'бар',
        addr: 'рождественский бул., 9', guests: 655, peak: '01:00', night: 'сб',
        you: 3, lastYou: 'в пятницу', friends: ['lera', 'denis'] },
      { id: 'chainaya', name: 'chainaya', kind: 'бар',
        addr: 'ул. покровка, 2/1с2', guests: 612, peak: '00:20', night: 'пт',
        you: 0, lastYou: null, friends: ['sonya'] },
      { id: 'strelka', name: 'стрелка', kind: 'ресторан',
        addr: 'берсеневская наб., 14с5', guests: 588, peak: '23:50', night: 'пт',
        you: 1, lastYou: 'в мае', friends: ['katya', 'artem'] },
      { id: 'klava', name: 'клава', kind: 'бар',
        addr: 'ул. малая бронная, 24/4', guests: 540, peak: '00:50', night: 'сб',
        you: 0, lastYou: null, friends: ['yana', 'polina', 'max', 'sonya'] },
      { id: 'krasny', name: 'красный', kind: 'клуб',
        addr: 'болотная наб., 9с2', guests: 502, peak: '02:30', night: 'сб',
        you: 0, lastYou: null, friends: ['artem', 'lera'] },
      { id: 'ryumochnaya', name: 'рюмочная 15', kind: 'рюмочная',
        addr: '1-я тверская-ямская ул., 15', guests: 455, peak: '22:50', night: 'пт',
        you: 2, lastYou: 'в субботу', friends: ['denis', 'max'] },
      { id: 'dorogaya', name: 'дорогая, я перезвоню', kind: 'бар',
        addr: 'цветной бул., 15с1', guests: 431, peak: '01:30', night: 'пт',
        you: 0, lastYou: null, friends: ['katya'] },
      { id: 'tsurtsum', name: 'цурцум', kind: 'ресторан',
        addr: '4-й сыромятнический пер., 1с6', guests: 402, peak: '23:20', night: 'пт',
        you: 0, lastYou: null, friends: [] },
      { id: 'pinch', name: 'pinch', kind: 'бар',
        addr: 'большой козихинский пер., 12', guests: 361, peak: '00:10', night: 'сб',
        you: 1, lastYou: 'в апреле', friends: ['polina'] },
      { id: 'entuziast', name: 'энтузиаст', kind: 'бар',
        addr: 'столешников пер., 7с5', guests: 348, peak: '00:40', night: 'пт',
        you: 0, lastYou: null, friends: ['sonya'] },
      { id: 'letchik', name: 'китайский лётчик', kind: 'клуб',
        addr: 'лубянский пр., 25с1', guests: 322, peak: '01:20', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'dom12', name: 'дом 12', kind: 'бар',
        addr: 'мансуровский пер., 12', guests: 296, peak: '23:50', night: 'пт',
        you: 0, lastYou: null, friends: ['artem', 'polina'] },
      { id: 'underdog', name: 'underdog', kind: 'бар',
        addr: 'трёхпрудный пер., 11/13', guests: 271, peak: '00:20', night: 'сб',
        you: 0, lastYou: null, friends: [] },
    ],
    partiers: [
      { id: 'lera',   visits: 68, spots: 21 },
      { id: 'seva',   visits: 64, spots: 20 },
      { id: 'alisa',  visits: 61, spots: 19 },
      { id: 'yana',   visits: 55, spots: 18 },
      { id: 'kirill', visits: 53, spots: 17 },
      { id: 'max',    visits: 51, spots: 17 },
      { id: 'roma',   visits: 48, spots: 16 },
      { id: 'denis',  visits: 46, spots: 15 },
      { id: 'vika',   visits: 45, spots: 15 },
      { id: 'polina', visits: 44, spots: 14 },
      { id: 'katya',  visits: 37, spots: 12 },
      { id: 'nikita', visits: 33, spots: 11 },
      { id: 'artem',  visits: 18, spots: 8 },
      { id: 'sonya',  visits: 16, spots: 7 },
    ],
    me: { visits: 21, spots: 9, rank: 412, total: 9840, favourite: 'rovesnik', betterThan: 88 },
  },

  {
    id: 'spb',
    name: 'санкт-петербург',
    short: 'спб',
    loc: 'в петербурге',
    gen: 'петербурга',
    venues: [
      { id: 'tsokol', name: 'цоколь', kind: 'клуб',
        addr: '3-я советская ул., 2/3', guests: 812, peak: '01:40', night: 'сб',
        you: 0, lastYou: null, friends: ['lera'] },
      { id: 'griboedov', name: 'грибоедов', kind: 'клуб',
        addr: 'воронежская ул., 2а', guests: 764, peak: '01:20', night: 'сб',
        you: 1, lastYou: 'в январе', friends: [] },
      { id: 'hroniki', name: 'хроники', kind: 'бар',
        addr: 'ул. некрасова, 26', guests: 703, peak: '00:30', night: 'пт',
        you: 2, lastYou: 'в январе', friends: ['max'] },
      { id: 'fidel', name: 'фидель', kind: 'бар',
        addr: 'думская ул., 9', guests: 668, peak: '02:00', night: 'сб',
        you: 0, lastYou: null, friends: ['max', 'lera'] },
      { id: 'bekitzer', name: 'бекицер', kind: 'бар',
        addr: 'ул. рубинштейна, 40', guests: 596, peak: '23:40', night: 'пт',
        you: 0, lastYou: null, friends: [] },
      { id: 'terminal', name: 'терминал', kind: 'бар',
        addr: 'кожевенная линия, 40', guests: 541, peak: '01:10', night: 'сб',
        you: 0, lastYou: null, friends: ['denis'] },
      { id: 'blank', name: 'blank', kind: 'клуб',
        addr: 'ул. марата, 5', guests: 498, peak: '02:20', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'union', name: 'union', kind: 'бар',
        addr: 'литейный пр., 55', guests: 452, peak: '00:50', night: 'пт',
        you: 0, lastYou: null, friends: [] },
      { id: 'redrum', name: 'redrum', kind: 'бар',
        addr: 'ул. некрасова, 26', guests: 411, peak: '00:20', night: 'пт',
        you: 0, lastYou: null, friends: ['lera'] },
      { id: 'mansarda', name: 'мансарда', kind: 'ресторан',
        addr: 'почтамтская ул., 3-5', guests: 377, peak: '23:20', night: 'пт',
        you: 0, lastYou: null, friends: [] },
    ],
    partiers: [
      { id: 'ilya',   visits: 51, spots: 17 },
      { id: 'nastya', visits: 47, spots: 16 },
      { id: 'timur',  visits: 44, spots: 15 },
      { id: 'asya',   visits: 41, spots: 14 },
      { id: 'grisha', visits: 38, spots: 13 },
      { id: 'zhenya', visits: 35, spots: 12 },
      { id: 'olya',   visits: 32, spots: 12 },
      { id: 'stas',   visits: 29, spots: 11 },
      { id: 'dina',   visits: 26, spots: 10 },
      { id: 'mark',   visits: 24, spots: 9 },
    ],
    me: { visits: 3, spots: 2, rank: 2940, total: 4120, favourite: 'hroniki', betterThan: 41 },
  },

  {
    id: 'ekb',
    name: 'екатеринбург',
    short: 'екб',
    loc: 'в екатеринбурге',
    gen: 'екатеринбурга',
    venues: [
      { id: 'dompechati', name: 'дом печати', kind: 'клуб',
        addr: 'пр. ленина, 49', guests: 486, peak: '01:30', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'selfedge', name: 'self edge', kind: 'бар',
        addr: 'ул. малышева, 21/1', guests: 412, peak: '00:40', night: 'пт',
        you: 0, lastYou: null, friends: [] },
      { id: 'nelson', name: 'нельсон совин', kind: 'бар',
        addr: 'ул. малышева, 44', guests: 358, peak: '00:20', night: 'пт',
        you: 0, lastYou: null, friends: ['artem'] },
      { id: 'kabinet', name: 'кабинет', kind: 'бар',
        addr: 'ул. 8 марта, 8', guests: 311, peak: '01:00', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'gastroli', name: 'гастроли', kind: 'ресторан',
        addr: 'ул. толмачёва, 23', guests: 274, peak: '23:30', night: 'пт',
        you: 0, lastYou: null, friends: [] },
      { id: 'fanat', name: 'фанат', kind: 'бар',
        addr: 'ул. вайнера, 16', guests: 236, peak: '00:50', night: 'сб',
        you: 0, lastYou: null, friends: [] },
    ],
    partiers: [
      { id: 'grisha', visits: 34, spots: 13 },
      { id: 'olya',   visits: 31, spots: 12 },
      { id: 'mark',   visits: 28, spots: 11 },
      { id: 'nastya', visits: 25, spots: 10 },
      { id: 'stas',   visits: 22, spots: 9 },
      { id: 'asya',   visits: 19, spots: 8 },
    ],
    me: { visits: 0, spots: 0, rank: null, total: 1870, favourite: null, betterThan: 0 },
  },

  {
    id: 'kzn',
    name: 'казань',
    short: 'казань',
    loc: 'в казани',
    gen: 'казани',
    venues: [
      { id: 'sol', name: 'соль', kind: 'бар',
        addr: 'ул. профсоюзная, 11', guests: 421, peak: '01:10', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'rocknroll', name: 'rock&roll', kind: 'клуб',
        addr: 'ул. профсоюзная, 21', guests: 388, peak: '01:50', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'piatoe', name: 'пятое солнце', kind: 'бар',
        addr: 'ул. профсоюзная, 3', guests: 342, peak: '00:30', night: 'пт',
        you: 0, lastYou: null, friends: ['sonya'] },
      { id: 'hanuma', name: 'ханума', kind: 'ресторан',
        addr: 'ул. профсоюзная, 19', guests: 296, peak: '23:20', night: 'пт',
        you: 0, lastYou: null, friends: [] },
      { id: 'kto', name: 'кто?', kind: 'клуб',
        addr: 'ул. островского, 26', guests: 251, peak: '02:00', night: 'сб',
        you: 0, lastYou: null, friends: [] },
      { id: 'paper', name: 'паперть', kind: 'бар',
        addr: 'ул. профсоюзная, 11', guests: 218, peak: '00:40', night: 'пт',
        you: 0, lastYou: null, friends: [] },
    ],
    partiers: [
      { id: 'dina',   visits: 29, spots: 11 },
      { id: 'ilya',   visits: 26, spots: 10 },
      { id: 'zhenya', visits: 24, spots: 10 },
      { id: 'timur',  visits: 21, spots: 9 },
      { id: 'olya',   visits: 18, spots: 8 },
      { id: 'grisha', visits: 15, spots: 7 },
    ],
    me: { visits: 0, spots: 0, rank: null, total: 1240, favourite: null, betterThan: 0 },
  },
];

// гид — это ровно те места, что показаны: «9 из 20» не должно расходиться
// с длиной списка. Поэтому размер гида считаем, а не проставляем руками.
for (const c of CITIES) c.guide = c.venues.length;

// у каждого места — своя лента чекинов
for (const c of CITIES) for (const v of c.venues) v.checkins = checkinsFor(v);

export function city(id) {
  return CITIES.find((c) => c.id === id) ?? CITIES[0];
}
