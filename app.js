/* Colher de Prosa — aplicação de página única, sem dependências.
   Rotas por hash: #/ · #/receitas · #/categoria/<id> · #/colecao/<id> · #/busca/<termo>
                   #/geladeira/<ing1,ing2> · #/favoritas · #/receita/<id> */
(() => {
  'use strict';

  /* ---------- utilitários ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* modo privado: segue só na sessão */ } }
  };

  /* ---------- categorias e coleções ---------- */
  const CATS = [
    { key: 'massas', name: 'Massas', tone: '#F4E4C4', ink: '#9A6B1F', desc: 'Do alho e óleo de quinze minutos à lasanha de domingo.' },
    { key: 'bebidas', name: 'Bebidas', tone: '#D7E7E2', ink: '#3E7366', desc: 'Sucos, cafés, drinques e jarras para dividir.' },
    { key: 'bolos', name: 'Bolos e tortas', tone: '#F3D9CF', ink: '#A65B45', desc: 'Bolos de café da tarde e tortas doces e salgadas.' },
    { key: 'natal', name: 'Ceia de Natal', tone: '#DDE7D6', ink: '#4D7848', desc: 'Assados, acompanhamentos e a rabanada que todo mundo espera.' },
    { key: 'pascoa', name: 'Ceia de Páscoa', tone: '#E6DEEE', ink: '#6C5A8B', desc: 'Bacalhau, cordeiro, colomba e ovo de colher.' },
    { key: 'carnes', name: 'Carnes', tone: '#F0D7CB', ink: '#9A4E37', desc: 'Panela de pressão, forno baixo e frigideira bem quente.' },
    { key: 'aves', name: 'Aves', tone: '#F5E7CF', ink: '#996822', desc: 'Frango para todo dia e para dia especial.' },
    { key: 'saladas', name: 'Saladas e molhos', tone: '#DFE9D5', ink: '#55773E', desc: 'Folhas, grãos e os molhos que salvam a semana.' },
    { key: 'doces', name: 'Doces e sobremesas', tone: '#F6DEE2', ink: '#A24D61', desc: 'Pudim, brigadeiro, quindim e outros clássicos de colher.' }
  ];
  const CAT = Object.fromEntries(CATS.map(c => [c.key, c]));
  const COLLECTIONS = [
    { key: 'rapidas', name: 'Prontas em até 30 min', desc: 'Do fogão à mesa em meia hora ou menos, contando tudo.', test: r => r.minutes <= 30 },
    { key: 'vegetarianas', name: 'Vegetarianas', desc: 'Sem carne, frango ou peixe. Confira o rótulo dos industrializados.', test: r => r.tags.includes('vegetariana') },
    { key: 'sem-forno', name: 'Sem forno', desc: 'Fogão, liquidificador ou geladeira. O forno pode descansar.', test: r => r.tags.includes('sem-forno') },
    { key: 'congelar', name: 'Boas para congelar', desc: 'Faça em dobro hoje e agradeça na quarta-feira.', test: r => r.tags.includes('congela') },
    { key: 'receber', name: 'Para receber', desc: 'Rendem 10 porções ou mais: mesa cheia, panela também.', test: r => r.serves >= 10 }
  ];
  const COLL = Object.fromEntries(COLLECTIONS.map(c => [c.key, c]));

  /* ---------- receitas: normalização dos dois formatos de dados ---------- */
  const order = Object.fromEntries(CATS.map((c, i) => [c.key, i]));
  const RECIPES = (window.RECIPES || []).map((r, i) => {
    const groups = r.groups
      ? r.groups.map(g => Array.isArray(g) ? { name: g[0], items: g[1] } : g)
      : [{ name: '', items: r.ing || [] }];
    const steps = r.steps.map(s => Array.isArray(s) ? { title: s[0], text: s[1] } : s);
    const items = groups.flatMap(g => g.items);
    const foto = (window.FOTOS || {})[r.id];
    return {
      ...r, groups, steps, tags: r.tags || [], i, foto, photo: foto?.src,
      ingText: norm(items.join(' | ')),
      haystack: norm([r.title, r.line, CAT[r.category]?.name, ...items].join(' ')),
      count: items.length
    };
  }).sort((a, b) => order[a.category] - order[b.category] || a.i - b.i);
  const BY_ID = Object.fromEntries(RECIPES.map(r => [r.id, r]));
  const inCat = key => RECIPES.filter(r => r.category === key);
  const curHash = () => location.hash || document.getElementById('app').dataset.rota || '#/';
  const routeArg = () => curHash().split('/')[2];
  // Endereço público e permanente de uma receita (página própria, indexável).
  const recipeURL = id => new URL(`receitas/${id}/`, document.baseURI).href;

  /* ---------- estado persistente ---------- */
  let favorites = new Set(store.get('cp-favoritas', []).filter(id => BY_ID[id]));
  let waNumber = store.get('cp-whatsapp', '');
  const servingsPref = store.get('cp-porcoes', {});

  /* ---------- ícones ---------- */
  const ICON = {
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.5" cy="8" r="2.5"/><path d="M15.5 13.2c2.6-.2 4.4 1.6 5 4.3"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-3.9 0-6.5-2.6-6.5-6 0-3.8 3.5-5.7 4-10 2.8 1.6 4.3 4.3 4 7 1-.6 1.8-1.7 2-3 1.8 1.6 3 3.7 3 6 0 3.4-2.6 6-6.5 6z"/></svg>',
    cart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h13l-1.5 9h-10z"/><path d="M6 7 5 4H3"/><circle cx="9" cy="20" r="1.3"/><circle cx="16" cy="20" r="1.3"/></svg>',
    print: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
    fridge: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M6 10h12M9 6v2M9 13v3"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 19.5 5.6 16A8 8 0 1 1 8.4 18.6z"/><path d="M9.2 8.6c.2-.5.6-.6 1-.5l.9 1.9-.6.8c.4.9 1.3 1.8 2.3 2.3l.8-.6 1.9.9c.1.4 0 .8-.5 1-1.6.9-5.5-2-5.8-5.8z"/></svg>',
    chef: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 0 1-.6-7.9A5 5 0 0 1 12 3a5 5 0 0 1 5.6 3.6 4 4 0 0 1-.6 7.9z"/><path d="M7 17h10"/></svg>'
  };

  /* ---------- formatação ---------- */
  const fmtTotal = m => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${Math.round(m / 60)} h`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  /* ---------- ilustrações geradas (substituem fotos até o ensaio fotográfico) ---------- */
  function seeded(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  }
  const PAPER = '#FFFDF8', LEAF = '#7F9C6C', BERRY = '#C9644F';
  const plate = ink => `<ellipse cx="200" cy="246" rx="112" ry="16" fill="${ink}" opacity=".10"/><circle cx="200" cy="150" r="104" fill="${PAPER}"/><circle cx="200" cy="150" r="104" fill="none" stroke="${ink}" stroke-opacity=".28" stroke-width="2"/><circle cx="200" cy="150" r="78" fill="none" stroke="${ink}" stroke-opacity=".14" stroke-width="2"/>`;
  const MOTIF = {
    massas(ink, rnd, uid) {
      let s = plate(ink) + `<clipPath id="c${uid}"><circle cx="200" cy="150" r="72"/></clipPath><g clip-path="url(#c${uid})" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round">`;
      for (let k = 0; k < 9; k++) {
        const y = 100 + k * 12 + rnd() * 6, a = 14 + rnd() * 10, o = rnd() * 40;
        s += `<path d="M${110 + o} ${y} c 20 ${-a} 40 ${a} 60 0 s 40 ${-a} 60 0 s 40 ${a} 60 0" opacity="${0.55 + rnd() * 0.45}"/>`;
      }
      s += `</g><circle cx="200" cy="150" r="30" fill="${BERRY}" opacity=".55"/>`;
      for (let k = 0; k < 3; k++) s += `<ellipse cx="${186 + k * 14}" cy="${140 + rnd() * 16}" rx="9" ry="5" fill="${LEAF}" transform="rotate(${rnd() * 180} ${186 + k * 14} 148)"/>`;
      return s;
    },
    bebidas(ink, rnd, uid) {
      const lvl = 115 + rnd() * 30;
      let s = `<ellipse cx="200" cy="256" rx="70" ry="10" fill="${ink}" opacity=".12"/><clipPath id="g${uid}"><path d="M152 70h96l-12 172q-2 12-14 12h-44q-12 0-14-12z"/></clipPath>`;
      s += `<path d="M152 70h96l-12 172q-2 12-14 12h-44q-12 0-14-12z" fill="${PAPER}"/><g clip-path="url(#g${uid})"><rect x="140" y="${lvl}" width="120" height="160" fill="${ink}" opacity=".32"/>`;
      for (let k = 0; k < 3; k++) { const x = 170 + rnd() * 44, y = lvl + 6 + rnd() * 50; s += `<rect x="${x}" y="${y}" width="22" height="22" rx="5" fill="${PAPER}" opacity=".7" transform="rotate(${rnd() * 40 - 20} ${x + 11} ${y + 11})"/>`; }
      s += `</g><path d="M152 70h96l-12 172q-2 12-14 12h-44q-12 0-14-12z" fill="none" stroke="${ink}" stroke-width="3"/>`;
      s += `<path d="M232 36 210 210" stroke="${BERRY}" stroke-width="7" stroke-linecap="round" opacity=".8"/>`;
      s += `<circle cx="248" cy="74" r="24" fill="#E8D77A" stroke="${ink}" stroke-width="2.5"/><circle cx="248" cy="74" r="16" fill="none" stroke="${ink}" stroke-opacity=".4" stroke-width="1.5"/><path d="M248 58v32M232 74h32" stroke="${ink}" stroke-opacity=".35" stroke-width="1.5"/>`;
      return s;
    },
    bolos(ink, rnd) {
      const c = ['#F7EBD9', ink];
      let s = `<ellipse cx="205" cy="232" rx="125" ry="26" fill="${PAPER}" stroke="${ink}" stroke-opacity=".25" stroke-width="2"/>`;
      s += `<path d="M110 150 230 118 300 150 180 184z" fill="${PAPER}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
      s += `<path d="M110 150 180 184v58l-70-32z" fill="${c[0]}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
      s += `<path d="M180 184 300 150v60l-120 32z" fill="${ink}" fill-opacity=".22" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/>`;
      s += `<path d="M110 170 180 204 300 170M110 190 180 224 300 190" fill="none" stroke="${ink}" stroke-width="5" stroke-opacity=".45"/>`;
      s += `<circle cx="${206 + rnd() * 20}" cy="${140 + rnd() * 6}" r="11" fill="${BERRY}"/><path d="M212 130q6-14 16-16" stroke="${LEAF}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
      return s;
    },
    natal(ink, rnd) {
      let s = plate(ink);
      for (let k = 0; k < 22; k++) {
        const a = (k / 22) * Math.PI * 2, x = 200 + Math.cos(a) * 60, y = 150 + Math.sin(a) * 60;
        s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="15" ry="6.5" fill="${k % 2 ? ink : LEAF}" opacity=".85" transform="rotate(${(a * 180 / Math.PI + 90 + rnd() * 30).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
      for (let k = 0; k < 7; k++) { const a = rnd() * Math.PI * 2, r = 50 + rnd() * 20; s += `<circle cx="${(200 + Math.cos(a) * r).toFixed(1)}" cy="${(150 + Math.sin(a) * r).toFixed(1)}" r="6" fill="${BERRY}"/>`; }
      s += `<path d="M186 140q14 10 28 0M200 146v22" stroke="${BERRY}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      return s;
    },
    pascoa(ink, rnd) {
      let s = `<ellipse cx="200" cy="200" rx="120" ry="44" fill="${ink}" opacity=".12"/>`;
      for (let k = 0; k < 9; k++) s += `<path d="M${88 + rnd() * 20} ${188 + k * 4} q 112 ${30 + rnd() * 20} 224 0" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width="2.5"/>`;
      const eggs = [[160, 150, -12], [205, 140, 6], [248, 156, 16]];
      eggs.forEach(([x, y, rot], k) => {
        s += `<g transform="rotate(${rot + rnd() * 6} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="30" ry="40" fill="${k === 1 ? PAPER : k ? '#F2D27E' : '#EFC1B6'}" stroke="${ink}" stroke-width="3"/>`;
        s += k === 1 ? `<path d="M${x - 29} ${y} q 10 -10 20 0 t 20 0 t 18 0" fill="none" stroke="${ink}" stroke-width="2.5"/>` : `<circle cx="${x - 10}" cy="${y - 12}" r="4" fill="${ink}" opacity=".5"/><circle cx="${x + 8}" cy="${y + 4}" r="4" fill="${ink}" opacity=".5"/><circle cx="${x - 4}" cy="${y + 20}" r="4" fill="${ink}" opacity=".5"/>`;
        s += '</g>';
      });
      return s;
    },
    carnes(ink, rnd) {
      let s = plate(ink);
      s += `<path d="M138 150c0-30 28-48 62-46 38 2 66 18 64 44-2 30-30 50-66 48-36-2-60-18-60-46z" fill="${ink}" fill-opacity=".5" stroke="${ink}" stroke-width="3"/>`;
      s += `<path d="M146 146c4-24 30-36 56-34" stroke="${PAPER}" stroke-opacity=".7" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      for (let k = 0; k < 3; k++) s += `<path d="M${168 + k * 26} 124l${-16} 54" stroke="${ink}" stroke-width="5" stroke-linecap="round" opacity=".55"/>`;
      s += `<path d="M232 206q26-16 40-46" stroke="${LEAF}" stroke-width="3" fill="none"/>`;
      for (let k = 0; k < 6; k++) { const t = k / 6, x = 232 + 40 * t, y = 206 - 46 * t; s += `<path d="M${x} ${y}l${8 + rnd() * 4} ${-2}M${x} ${y}l${-2} ${-10}" stroke="${LEAF}" stroke-width="2.5" stroke-linecap="round"/>`; }
      return s;
    },
    aves(ink, rnd) {
      let s = plate(ink);
      s += `<g transform="rotate(${-28 + rnd() * 10} 200 150)"><path d="M150 150c0-26 22-42 50-42 30 0 44 18 44 42s-14 42-44 42c-28 0-50-16-50-42z" fill="${ink}" fill-opacity=".42" stroke="${ink}" stroke-width="3"/>`;
      s += `<rect x="240" y="142" width="40" height="16" rx="6" fill="${PAPER}" stroke="${ink}" stroke-width="3"/><circle cx="284" cy="141" r="9" fill="${PAPER}" stroke="${ink}" stroke-width="3"/><circle cx="284" cy="159" r="9" fill="${PAPER}" stroke="${ink}" stroke-width="3"/>`;
      s += `<path d="M164 134c8-12 22-16 36-14" stroke="${PAPER}" stroke-opacity=".7" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
      s += `<path d="M150 214a26 26 0 0 1 44-6z" fill="#E8D77A" stroke="${ink}" stroke-width="2.5"/>`;
      return s;
    },
    saladas(ink, rnd) {
      let s = `<ellipse cx="200" cy="246" rx="110" ry="14" fill="${ink}" opacity=".12"/>`;
      for (let k = 0; k < 16; k++) {
        const x = 118 + rnd() * 164, y = 118 + rnd() * 50;
        s += `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${18 + rnd() * 10}" ry="${9 + rnd() * 4}" fill="${k % 3 ? LEAF : ink}" opacity="${0.6 + rnd() * 0.4}" transform="rotate(${rnd() * 180} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
      }
      for (let k = 0; k < 4; k++) s += `<circle cx="${140 + rnd() * 120}" cy="${132 + rnd() * 34}" r="9" fill="${BERRY}"/>`;
      s += `<path d="M96 160h208a104 84 0 0 1-208 0z" fill="${PAPER}" stroke="${ink}" stroke-width="3" stroke-linejoin="round"/><path d="M118 186q82 24 164 0" stroke="${ink}" stroke-opacity=".25" stroke-width="2" fill="none"/>`;
      return s;
    },
    doces(ink, rnd) {
      let s = plate(ink);
      const pos = [[200, 150], [158, 134], [242, 134], [168, 182], [232, 182]];
      pos.forEach(([x, y]) => {
        s += `<circle cx="${x}" cy="${y + 3}" r="21" fill="${ink}" opacity=".16"/><circle cx="${x}" cy="${y}" r="20" fill="#6F4A3C"/>`;
        for (let k = 0; k < 7; k++) { const a = rnd() * 6.28, r = rnd() * 14; const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; s += `<path d="M${px.toFixed(1)} ${py.toFixed(1)}l${(rnd() * 6 - 3).toFixed(1)} 3" stroke="${['#F2D27E', '#EFC1B6', PAPER][k % 3]}" stroke-width="2.5" stroke-linecap="round"/>`; }
      });
      return s;
    }
  };
  // Pratos de ceia e de outras categorias mistas usam o motivo que melhor descreve o prato (a cor segue a categoria).
  const MOTIF_FOR = {
    'peru-laranja': 'aves', 'tender-abacaxi': 'carnes', 'lombo-mostarda': 'carnes', 'salpicao': 'saladas', 'maionese-batata': 'saladas',
    'rabanada': 'bolos', 'pave-pessego': 'bolos', 'cordeiro-alecrim': 'carnes', 'colomba': 'bolos', 'salada-grao-bico': 'saladas',
    'batatas-murro': 'saladas', 'pescada-legumes': 'carnes', 'bolinho-bacalhau': 'doces', 'torta-frango': 'bolos', 'canja': 'saladas',
    'pudim': 'bolos', 'pave': 'bolos', 'bombom': 'bolos', 'manjar': 'bolos', 'arroz-bacalhau': 'massas', 'galinhada': 'massas',
    'molho-tomate': 'massas', 'pesto': 'saladas', 'feijoada': 'doces'
  };
  let uid = 0;
  function art(r, cls = '', alt = '') {
    if (r.photo) return `<img class="art ${cls}" src="${esc(r.photo)}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
    const c = CAT[r.category], rnd = seeded(r.id);
    const tilt = (rnd() * 8 - 4).toFixed(1);
    let deco = '';
    for (let k = 0; k < 14; k++) deco += `<circle cx="${(rnd() * 400).toFixed(0)}" cy="${(rnd() * 300).toFixed(0)}" r="${(1 + rnd() * 2.2).toFixed(1)}" fill="${c.ink}" opacity=".18"/>`;
    return `<svg class="art ${cls}" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="400" height="300" fill="${c.tone}"/>${deco}<g class="art-subject" transform="rotate(${tilt} 200 150)">${MOTIF[MOTIF_FOR[r.id] || r.category](c.ink, rnd, ++uid)}</g></svg>`;
  }

  /* ---------- ajuste de porções ---------- */
  const FRAC = { '½': .5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': .25, '¾': .75, '⅛': .125 };
  const NICE = [[0, ''], [.125, '⅛'], [.25, '¼'], [1 / 3, '⅓'], [.5, '½'], [2 / 3, '⅔'], [.75, '¾'], [1, '']];
  function fmtQty(v) {
    if (v >= 10) return String(Math.round(v));
    let whole = Math.floor(v), rest = v - whole, best = NICE[0];
    for (const n of NICE) if (Math.abs(n[0] - rest) < Math.abs(best[0] - rest)) best = n;
    if (best[0] === 1) { whole += 1; best = NICE[0]; }
    if (!whole && !best[1]) return '⅛';
    return [whole || '', best[1]].filter(Boolean).join(' ');
  }
  function fmtMeasure(v, unit) {
    if (unit === 'kg') { v *= 1000; unit = 'g'; }
    if (/^litros?$/.test(unit)) { v *= 1000; unit = 'ml'; }
    const dec = n => String(Math.round(n * 10) / 10).replace('.', ',');
    if (unit === 'g' && v >= 1000) return dec(v / 1000) + ' kg';
    if (unit === 'ml' && v >= 1000) return dec(v / 1000) + (v >= 2000 ? ' litros' : ' litro');
    const r = v >= 100 ? Math.round(v / 10) * 10 : v >= 20 ? Math.round(v / 5) * 5 : Math.max(1, Math.round(v));
    return r + ' ' + unit;
  }
  // Concordância: em receitas brasileiras, "1 ½ xícara" fica no singular; plural a partir de 2.
  const PLURAL = { lata: 'latas', xícara: 'xícaras', colher: 'colheres', caixa: 'caixas', pote: 'potes', vidro: 'vidros', pacote: 'pacotes', maço: 'maços', fatia: 'fatias', cebola: 'cebolas', cenoura: 'cenouras', maçã: 'maçãs', banana: 'bananas', laranja: 'laranjas', limão: 'limões', tomate: 'tomates', ovo: 'ovos', gema: 'gemas', clara: 'claras', folha: 'folhas', dente: 'dentes', ramo: 'ramos', pitada: 'pitadas', peça: 'peças', pé: 'pés', batata: 'batatas', abobrinha: 'abobrinhas', manga: 'mangas', pimentão: 'pimentões', pepino: 'pepinos', chuchu: 'chuchus', peru: 'perus', frango: 'frangos', pernil: 'pernis', abacaxi: 'abacaxis', pão: 'pães', filé: 'filés', bife: 'bifes', pedaço: 'pedaços', copo: 'copos', tubo: 'tubos', pau: 'paus', bananas: 'bananas' };
  const SINGULAR = Object.fromEntries(Object.entries(PLURAL).map(([a, b]) => [b, a]));
  function agree(body, value) {
    return body.replace(/^(\S+(?: [½⅓⅔¼¾⅛])?) (\S+)/, (all, q, word) => {
      const w = value >= 2 ? PLURAL[word] : SINGULAR[word];
      return w ? `${q} ${w}` : all;
    });
  }
  const LEAD = /^(\d+(?:,\d+)?)?(?:\s*([½⅓⅔¼¾⅛]))?(?=\s|$)/;
  function scaleItem(text, f) {
    if (Math.abs(f - 1) < 1e-6) return text;
    let out = text;
    const prefix = /^((?:Raspas e suco|Suco|Raspas|Folhas|Polpa)(?: de)?\s+)/.exec(out);
    const head = prefix ? prefix[1] : '';
    let body = out.slice(head.length);
    const m = LEAD.exec(body);
    const isMeasure = /^\d+(?:,\d+)?\s(?:kg|g|ml|litros?)\s/.test(body); // "500 g de …" é tratado abaixo
    if (m && (m[1] || m[2]) && !isMeasure) {
      const v = (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + (m[2] ? FRAC[m[2]] : 0);
      body = agree(fmtQty(v * f) + body.slice(m[0].length), v * f);
    }
    out = head + body;
    return out.replace(/\((\d+(?:,\d+)?)\s*(g|kg|ml|litros?)\)/g, (_, n, u) => '(' + fmtMeasure(parseFloat(n.replace(',', '.')) * f, u) + ')')
              .replace(/^(\d+(?:,\d+)?) (kg|g|ml|litros?) /, (_, n, u) => fmtMeasure(parseFloat(n.replace(',', '.')) * f, u) + ' ');
  }
  const servingsFor = r => Math.min(r.serves * 4, Math.max(1, servingsPref[r.id] || r.serves));

  /* Diálogos modais ficam na camada superior: avisos e cronômetros vão junto para continuarem visíveis. */
  function hoist() {
    const host = document.querySelector('dialog[open]') || document.body;
    ['#timers', '#toast'].forEach(s => { const el = $(s); if (el.parentNode !== host) host.appendChild(el); });
  }

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
  }

  /* ---------- cartões (sem tempo e sem numeração: esses dados aparecem só na receita aberta) ---------- */
  const favBtn = r => { const on = favorites.has(r.id); return `<button class="fav-btn" data-fav="${r.id}" aria-pressed="${on}" aria-label="${on ? 'Remover das favoritas' : 'Guardar nas favoritas'}: ${esc(r.title)}">${ICON.heart}</button>`; };
  function card(r) {
    const c = CAT[r.category];
    return `<article class="card" style="--tone:${c.tone};--cink:${c.ink}">
      <a class="card-link" href="#/receita/${r.id}">
        <div class="card-art">${art(r)}</div>
        <div class="card-body"><span class="tag">${esc(c.name)}</span><h3>${esc(r.title)}</h3></div>
      </a>${favBtn(r)}</article>`;
  }
  function mini(r) {
    const c = CAT[r.category];
    return `<a class="mini" href="#/receita/${r.id}" style="--tone:${c.tone};--cink:${c.ink}"><span class="mini-art">${art(r)}</span><span class="mini-copy"><span class="tag">${esc(c.name)}</span><strong>${esc(r.title)}</strong></span></a>`;
  }
  const grid = (rs, cls = '') => `<div class="grid ${cls}">${rs.map(card).join('')}</div>`;
  // Sorteio do dia, dando preferência às receitas que já têm foto.
  const daily = (arr, n, salt = '') => { const rnd = seeded(new Date().toDateString() + salt); return [...arr].map(r => [r, rnd()]).sort((a, b) => (!!b[0].photo - !!a[0].photo) || a[1] - b[1]).map(x => x[0]).slice(0, n); };

  /* ---------- navegação de categorias + mega menu ---------- */
  const nav = $('#catnav'), mega = $('#mega'), navList = $('#catnav-list');
  navList.innerHTML = CATS.map(c => `<li><a class="catnav-link" href="#/categoria/${c.key}" data-mega="${c.key}" aria-expanded="false" aria-controls="mega">${esc(c.name)}</a></li>`).join('')
    + `<li><a class="catnav-link more" href="#/receitas" data-mega="mais" aria-expanded="false" aria-controls="mega">E muito mais<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></a></li>`;
  $('#footer-links').innerHTML = CATS.map(c => `<a href="#/categoria/${c.key}">${esc(c.name)}</a>`).join('') + COLLECTIONS.map(c => `<a href="#/colecao/${c.key}">${esc(c.name)}</a>`).join('') + '<a href="#/sobre">Sobre o Colher de Prosa</a><a href="#/privacidade">Privacidade</a><a href="#/creditos">Créditos das fotos</a>';

  let megaKey = null, openTimer, closeTimer;
  function preview(r) {
    const c = CAT[r.category];
    return `<a class="mega-preview" href="#/receita/${r.id}" style="--tone:${c.tone}" tabindex="-1"><div class="mega-preview-art">${art(r)}</div><strong>${esc(r.title)}</strong><span>${esc(r.line)}</span></a>`;
  }
  function renderMega(key) {
    if (key === 'mais') {
      mega.innerHTML = `<div class="mega-inner mega-more">
        <div class="mega-intro"><h2>E muito mais</h2><p>Atalhos para o jeito como você cozinha de verdade.</p><a class="text-link" href="#/receitas">Ver todas as receitas ${ICON.arrow}</a></div>
        <ul class="mega-collections">${COLLECTIONS.map(c => `<li><a href="#/colecao/${c.key}"><strong>${esc(c.name)}</strong><span>${esc(c.desc)}</span></a></li>`).join('')}</ul>
        <ul class="mega-tools">
          <li><a href="#/geladeira">${ICON.fridge}<span><strong>O que tem na geladeira?</strong>Digite o que sobrou e veja o que dá para fazer.</span></a></li>
          <li><a href="#/favoritas">${ICON.heart}<span><strong>Minhas favoritas</strong>As receitas que você guardou.</span></a></li>
        </ul></div>`;
      return;
    }
    const c = CAT[key], rs = inCat(key);
    mega.innerHTML = `<div class="mega-inner" style="--tone:${c.tone};--cink:${c.ink}">
      <div class="mega-intro"><h2>${esc(c.name)}</h2><p>${esc(c.desc)}</p><a class="text-link" href="#/categoria/${key}">Ver todas ${ICON.arrow}</a></div>
      <ul class="mega-list">${rs.map((r, i) => `<li><a href="#/receita/${r.id}" data-preview="${r.id}"${i === 0 ? ' class="is-active"' : ''}>${esc(r.title)}</a></li>`).join('')}</ul>
      <div class="mega-side" id="mega-side">${preview(rs[0])}</div></div>`;
  }
  function openMega(key) {
    clearTimeout(closeTimer);
    if (megaKey !== key) { megaKey = key; renderMega(key); }
    mega.hidden = false;
    requestAnimationFrame(() => mega.classList.add('is-open'));
    $$('[data-mega]', navList).forEach(a => { const on = a.dataset.mega === key; a.setAttribute('aria-expanded', String(on)); a.classList.toggle('is-hover', on); });
  }
  function closeMega(now) {
    clearTimeout(openTimer);
    const done = () => { mega.classList.remove('is-open'); mega.hidden = true; megaKey = null; $$('[data-mega]', navList).forEach(a => { a.setAttribute('aria-expanded', 'false'); a.classList.remove('is-hover'); }); };
    if (now) done(); else closeTimer = setTimeout(done, 180);
  }
  const canHover = matchMedia('(hover: hover) and (pointer: fine)');
  navList.addEventListener('pointerover', e => {
    const a = e.target.closest('[data-mega]');
    if (!a || e.pointerType !== 'mouse' || !canHover.matches) return;
    clearTimeout(openTimer); clearTimeout(closeTimer);
    openTimer = setTimeout(() => openMega(a.dataset.mega), mega.hidden ? 90 : 0);
  });
  nav.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') closeMega(); });
  mega.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  navList.addEventListener('focusin', e => { const a = e.target.closest('[data-mega]'); if (a && a.matches(':focus-visible')) openMega(a.dataset.mega); });
  nav.addEventListener('focusout', e => { if (!nav.contains(e.relatedTarget)) closeMega(true); });
  nav.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !mega.hidden) { const k = megaKey; closeMega(true); $(`[data-mega="${k}"]`, navList)?.focus(); }
    if (e.key === 'ArrowDown' && e.target.matches('[data-mega]')) { e.preventDefault(); openMega(e.target.dataset.mega); $('a, button', mega)?.focus(); }
  });
  // Passar o mouse (ou o foco) sobre uma receita do menu atualiza a prévia ao lado.
  const showPreview = a => {
    const r = BY_ID[a.dataset.preview]; if (!r) return;
    $$('[data-preview]', mega).forEach(x => x.classList.toggle('is-active', x === a));
    const side = $('#mega-side'); if (side) side.innerHTML = preview(r);
  };
  mega.addEventListener('pointerover', e => { const a = e.target.closest('[data-preview]'); if (a) showPreview(a); });
  mega.addEventListener('focusin', e => { const a = e.target.closest('[data-preview]'); if (a) showPreview(a); });
  mega.addEventListener('click', e => { if (e.target.closest('a')) closeMega(true); });

  /* ---------- telas ---------- */
  const app = $('#app');
  const filters = { rapidas: false, veg: false, semforno: false, facil: false, sort: 'casa' };
  let currentListing = null;

  function applyFilters(rs) {
    let out = rs.filter(r => (!filters.rapidas || r.minutes <= 30) && (!filters.veg || r.tags.includes('vegetariana')) && (!filters.semforno || r.tags.includes('sem-forno')) && (!filters.facil || r.level === 'Fácil'));
    if (filters.sort === 'az') out = [...out].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
    if (filters.sort === 'ingredientes') out = [...out].sort((a, b) => a.count - b.count);
    return out;
  }
  const noResults = `<div class="empty"><h3>Nenhuma receita com esses filtros.</h3><p>Desmarque um dos filtros para ver mais opções.</p></div>`;
  function listingGrid(rs, emptyHtml) { const found = applyFilters(rs); return found.length ? grid(found, 'grid-3') : (emptyHtml || noResults); }
  function refreshListing() { const box = $('[data-listing]', app); if (box && currentListing) box.innerHTML = listingGrid(currentListing); }

  const crumbs = items => `<nav class="crumbs" aria-label="Você está em"><a href="#/">Início</a>${items.map(([href, label]) => href ? `<a href="${href}">${esc(label)}</a>` : `<span aria-current="page">${esc(label)}</span>`).join('')}</nav>`;
  function filterSide(activeCat) {
    const box = (k, label) => `<label class="check"><input type="checkbox" data-filter="${k}"${filters[k] ? ' checked' : ''}><span>${label}</span></label>`;
    return `<aside class="side">
      <div class="side-box"><h2>Filtrar</h2>${box('rapidas', 'Prontas em até 30 min')}${box('veg', 'Vegetarianas')}${box('semforno', 'Sem forno')}${box('facil', 'Fáceis')}</div>
      <div class="side-box side-cats"><h2>Categorias</h2><ul>${CATS.map(c => `<li><a href="#/categoria/${c.key}"${c.key === activeCat ? ' aria-current="page"' : ''} style="--cink:${c.ink}"><i></i>${esc(c.name)}</a></li>`).join('')}</ul></div>
      <a class="side-promo" href="#/geladeira">${ICON.fridge}<span><strong>O que tem na geladeira?</strong>Diga o que sobrou e veja o que dá para fazer.</span></a>
    </aside>`;
  }
  function listingPage({ trail, title, desc, rs, activeCat, emptyHtml, tone }) {
    currentListing = rs;
    return `<div class="wrap page">${crumbs(trail)}
      <header class="page-title"${tone ? ` style="--tone:${tone}"` : ''}><h1>${title}</h1>${desc ? `<p>${desc}</p>` : ''}</header>
      <div class="list-layout">${filterSide(activeCat)}
        <div class="list-main">
          <div class="list-top"><label class="sort">Ordenar por <select data-sort>
            <option value="casa"${filters.sort === 'casa' ? ' selected' : ''}>Destaques</option>
            <option value="az"${filters.sort === 'az' ? ' selected' : ''}>Nome (A–Z)</option>
            <option value="ingredientes"${filters.sort === 'ingredientes' ? ' selected' : ''}>Menos ingredientes</option></select></label></div>
          <div data-listing>${rs.length ? listingGrid(rs) : emptyHtml}</div>
        </div>
      </div></div>`;
  }

  function season() {
    const m = new Date().getMonth();
    if (m >= 10) return { key: 'natal', title: 'O Natal está chegando', desc: 'Monte o cardápio da ceia com antecedência: dá tempo de fazer um ensaio antes do grande dia.' };
    if (m >= 1 && m <= 3) return { key: 'pascoa', title: 'Para a mesa de Páscoa', desc: 'Bacalhau, cordeiro e chocolate para o almoço de domingo.' };
    return null;
  }

  function home() {
    currentListing = null;
    const s = season();
    const slides = [...(s ? daily(inCat(s.key), 1, 's') : []), ...daily(RECIPES.filter(r => !s || r.category !== s.key), s ? 3 : 4, 'c')];
    const highlights = daily(RECIPES.filter(r => !slides.includes(r)), 4, 'h');
    const shelf = c => `<section class="shelf" aria-labelledby="shelf-${c.key}"><div class="shelf-head"><h2 id="shelf-${c.key}"><i style="background:${c.ink}"></i>${esc(c.name)}</h2><a class="text-link" href="#/categoria/${c.key}">Ver todas ${ICON.arrow}</a></div>${grid(daily(inCat(c.key), 4, c.key), 'grid-4')}</section>`;
    const order = s ? [CAT[s.key], ...CATS.filter(c => c.key !== s.key)] : CATS;
    return `
    <section class="wrap top">
      <div class="carousel" data-carousel aria-roledescription="carrossel" aria-label="Receitas em destaque">
        ${slides.map((r, i) => { const c = CAT[r.category]; return `<a class="slide${i === 0 ? ' is-active' : ''}" href="#/receita/${r.id}" style="--tone:${c.tone};--cink:${c.ink}" aria-roledescription="slide"${i ? ' aria-hidden="true" tabindex="-1"' : ''}>
          <span class="slide-art">${art(r, 'big')}</span>
          <span class="slide-copy"><span class="tag">${esc(i === 0 && s ? s.title : c.name)}</span><strong>${esc(r.title)}</strong><span>${esc(r.line)}</span><em class="btn">Ver receita ${ICON.arrow}</em></span></a>`; }).join('')}
        <div class="carousel-ctrl"><button type="button" data-slide="-1" aria-label="Destaque anterior">‹</button><div class="dots">${slides.map((_, i) => `<button type="button" data-dot="${i}" aria-label="Ir para o destaque ${i + 1}"${i === 0 ? ' aria-current="true"' : ''}></button>`).join('')}</div><button type="button" data-slide="1" aria-label="Próximo destaque">›</button></div>
      </div>
      <aside class="top-side"><h2>Destaques de hoje</h2>${highlights.map(mini).join('')}</aside>
    </section>

    <section class="wrap round-cats" aria-label="Categorias">
      ${CATS.map(c => { const rs = inCat(c.key); return `<a href="#/categoria/${c.key}" style="--tone:${c.tone}"><span class="round">${art(rs.find(r => r.photo) || rs[0])}</span><span>${esc(c.name)}</span></a>`; }).join('')}
    </section>

    <div class="wrap home-cols">
      <div class="home-main">
        ${order.slice(0, 3).map(shelf).join('')}
        <section class="fridge-band">
          <div><h2>O que tem na geladeira?</h2><p>Digite o que sobrou e a gente mostra o que dá para fazer.</p></div>
          <form class="fridge-form" data-fridge-form><label class="sr-only" for="fridge-home">Ingredientes, separados por vírgula</label><input id="fridge-home" placeholder="ovo, tomate, queijo…" autocomplete="off"><button class="btn">Buscar</button></form>
        </section>
        ${order.slice(3).map(shelf).join('')}
      </div>
      <aside class="home-side">
        <div class="side-box"><h2>Coleções</h2><ul class="coll-list">${COLLECTIONS.map(c => `<li><a href="#/colecao/${c.key}"><strong>${esc(c.name)}</strong><span>${esc(c.desc)}</span></a></li>`).join('')}</ul></div>
        ${s ? `<a class="side-season" href="#/categoria/${s.key}" style="--tone:${CAT[s.key].tone}"><span class="side-season-art">${art(inCat(s.key).find(r => r.photo) || inCat(s.key)[0])}</span><strong>${s.title}</strong><span>${s.desc}</span><em>Ver a ceia completa ${ICON.arrow}</em></a>` : ''}
        <div class="side-box side-tools">
          <a href="#/favoritas">${ICON.heart}<span><strong>Minhas favoritas</strong>Toque no coração para guardar receitas.</span></a>
        </div>
      </aside>
    </div>`;
  }

  // Carrossel da página inicial: troca sozinho, pausa com o mouse em cima ou com foco dentro.
  let carouselTimer = null;
  function initCarousel() {
    clearInterval(carouselTimer);
    const root = $('[data-carousel]', app); if (!root) return;
    const slides = $$('.slide', root), dots = $$('[data-dot]', root);
    let i = 0, paused = false;
    const go = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => { const on = k === i; s.classList.toggle('is-active', on); s.toggleAttribute('aria-hidden', !on); on ? s.removeAttribute('tabindex') : s.setAttribute('tabindex', '-1'); });
      dots.forEach((d, k) => d.toggleAttribute('aria-current', k === i));
    };
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-slide]'), d = e.target.closest('[data-dot]');
      if (b) go(i + +b.dataset.slide); if (d) go(+d.dataset.dot);
    });
    root.addEventListener('pointerenter', () => { paused = true; });
    root.addEventListener('pointerleave', () => { paused = false; });
    root.addEventListener('focusin', () => { paused = true; });
    root.addEventListener('focusout', () => { paused = false; });
    if (!reduceMotion) carouselTimer = setInterval(() => { if (!paused && !document.hidden) go(i + 1); }, 6000);
  }

  function category(key) {
    const c = CAT[key]; if (!c) return notFound();
    return listingPage({ trail: [['#/receitas', 'Receitas'], [null, c.name]], title: esc(c.name), desc: esc(c.desc), rs: inCat(key), activeCat: key, tone: c.tone });
  }
  function collection(key) {
    const c = COLL[key]; if (!c) return notFound();
    return listingPage({ trail: [['#/receitas', 'Receitas'], [null, c.name]], title: esc(c.name), desc: esc(c.desc), rs: RECIPES.filter(c.test) });
  }
  function all() {
    return listingPage({ trail: [[null, 'Receitas']], title: 'Todas as receitas', desc: 'Massas, carnes, ceias, bolos, doces e muito mais.', rs: RECIPES });
  }
  function search(q) {
    const terms = norm(q).split(/\s+/).filter(Boolean);
    const rs = terms.length ? RECIPES.filter(r => terms.every(t => r.haystack.includes(t))) : RECIPES;
    return listingPage({ trail: [[null, 'Busca']], title: `Receitas com “${esc(q)}”`, rs,
      emptyHtml: `<div class="empty"><h3>Nada por aqui com “${esc(q)}”.</h3><p>Tente o nome de um ingrediente, como “frango” ou “coco”, ou explore as categorias.</p><a class="btn" href="#/receitas">Ver todas as receitas</a></div>` });
  }
  function favs() {
    return listingPage({ trail: [[null, 'Favoritas']], title: 'Minhas favoritas', desc: 'Guardadas neste navegador.', rs: RECIPES.filter(r => favorites.has(r.id)),
      emptyHtml: `<div class="empty"><h3>Nenhuma favorita ainda.</h3><p>Quando uma receita der vontade de repetir, toque no coração.</p><a class="btn" href="#/receitas">Explorar receitas</a></div>` });
  }
  function fridge(raw) {
    currentListing = null;
    const chips = (raw || '').split(',').map(s => s.trim()).filter(Boolean);
    const keys = chips.map(c => { const n = norm(c); return n.length > 3 ? n.replace(/(oes|aes|es|s)$/, '') : n; });
    const scored = keys.length ? RECIPES.map(r => ({ r, hit: keys.filter(k => r.ingText.includes(k)).length })).filter(x => x.hit).sort((a, b) => b.hit - a.hit || a.r.count - b.r.count) : [];
    return `<div class="wrap page">${crumbs([[null, 'O que tem na geladeira?']])}
      <header class="page-title" style="--tone:var(--sage-soft)"><h1>O que tem na geladeira?</h1><p>Adicione ingredientes um a um. Primeiro aparecem as receitas que usam mais deles.</p></header>
      <form class="fridge-tool" data-fridge-tool><div class="chip-input">${chips.map((c, i) => `<span class="ing-chip">${esc(c)}<button type="button" data-remove-chip="${i}" aria-label="Remover ${esc(c)}">×</button></span>`).join('')}
        <label class="sr-only" for="fridge-input">Adicionar ingrediente</label><input id="fridge-input" placeholder="${chips.length ? 'Mais um ingrediente…' : 'Ex.: ovo, depois Enter'}" autocomplete="off"></div>
        <button class="btn">Adicionar</button></form>
      <div class="fridge-suggest">Sugestões: ${['ovo', 'frango', 'tomate', 'batata', 'leite condensado', 'arroz', 'chocolate', 'limão', 'queijo', 'coco'].filter(x => !chips.includes(x)).map(x => `<button type="button" data-add-chip="${x}">${x}</button>`).join('')}</div>
      <div class="fridge-results">${!keys.length ? `<div class="empty soft"><h3>Comece por um ingrediente.</h3><p>Funciona melhor com o principal: “frango”, “banana”, “leite condensado”.</p></div>`
        : scored.length ? grid(scored.map(x => x.r), 'grid-4')
        : `<div class="empty"><h3>Nenhuma receita com esses ingredientes.</h3><p>Tente escrever de outro jeito (por exemplo, “queijo” em vez de “muçarela”).</p></div>`}</div>
    </div>`;
  }

  function recipePage(id) {
    const r = BY_ID[id]; if (!r) return notFound();
    currentListing = null;
    const c = CAT[r.category], fav = favorites.has(r.id), n = servingsFor(r), f = n / r.serves;
    const related = daily(inCat(r.category).filter(x => x.id !== r.id), 5, r.id);
    const other = daily(RECIPES.filter(x => x.category !== r.category), 3, 'o' + r.id);
    return `<div class="wrap page recipe" style="--tone:${c.tone};--cink:${c.ink}">${crumbs([['#/categoria/' + c.key, c.name], [null, r.title]])}
      <div class="recipe-layout">
        <article class="recipe-main">
          <header class="recipe-header">
            <a class="tag" href="#/categoria/${c.key}">${esc(c.name)}</a>
            <h1>${esc(r.title)}</h1>
            <p class="lede">${esc(r.line)}</p>
            <div class="recipe-actions">
              <button class="btn btn-wa" data-wa="${r.id}">${ICON.wa} Salvar no WhatsApp</button>
              <button class="btn btn-ghost" data-fav="${r.id}" aria-pressed="${fav}">${ICON.heart}<span>${fav ? 'Guardada' : 'Guardar'}</span></button>
              <button class="btn btn-ghost" data-share>${ICON.link}<span>Compartilhar</span></button>
              <button class="btn btn-ghost" data-print>${ICON.print}<span>Imprimir</span></button>
            </div>
            ${waNumber ? `<p class="wa-note">O WhatsApp abre direto na conversa com ${esc(fmtPhone(waNumber))}. <button type="button" class="link-btn" data-wa-change>Trocar número</button></p>` : ''}
          </header>
          <figure class="recipe-photo">${art(r, 'big', r.photo ? r.title : '')}${r.foto ? `<figcaption>${credit(r.foto)}</figcaption>` : ''}</figure>
          <ul class="info-bar">
            <li>${ICON.clock}<span>Preparo<strong>${esc(r.prep)}</strong></span></li>
            <li>${ICON.clock}<span>Tempo total<strong>${fmtTotal(r.minutes)}</strong></span></li>
            <li>${ICON.people}<span>Rendimento<strong>${esc(r.yield_)}</strong></span></li>
            <li>${ICON.flame}<span>Dificuldade<strong>${r.level}</strong></span></li>
          </ul>
          ${r.wait && r.wait !== '—' ? `<p class="wait">${ICON.clock}<span><strong>Planeje:</strong> ${esc(r.wait)}.</span></p>` : ''}

          <section class="box ingredients" aria-labelledby="ing-title">
            <div class="ing-head"><h2 id="ing-title">Ingredientes</h2>
              <div class="stepper" role="group" aria-label="Ajustar porções">
                <button type="button" data-serv="-1" aria-label="Diminuir porções"${n <= 1 ? ' disabled' : ''}>−</button>
                <output aria-live="polite"><strong>${n}</strong> ${n === 1 ? 'porção' : 'porções'}</output>
                <button type="button" data-serv="1" aria-label="Aumentar porções"${n >= r.serves * 4 ? ' disabled' : ''}>+</button>
              </div>
            </div>
            ${f !== 1 ? `<p class="scaled-note">Quantidades ajustadas de ${r.serves} para ${n} porções. <button type="button" class="link-btn" data-serv-reset>Voltar ao original</button></p>` : `<p class="scaled-note">Xícara de 240 ml · colheres medidoras rasas.</p>`}
            <div class="ing-cols${r.groups.length > 1 ? " multi" : ""}">${r.groups.map((g, gi) => `<div class="ing-group">${g.name ? `<h3>${esc(g.name)}</h3>` : ''}<ul>${g.items.map((it, ii) => `<li><label><input type="checkbox" data-check="${gi}-${ii}"><span>${esc(scaleItem(it, f))}</span></label></li>`).join('')}</ul></div>`).join('')}</div>
            ${r.equipment ? `<p class="equipment"><strong>Na bancada:</strong> ${esc(r.equipment)}</p>` : ''}
            <button class="btn btn-soft-wa" data-wa="${r.id}">${ICON.wa} Mandar esta receita pro WhatsApp</button>
          </section>

          <section class="box method" aria-labelledby="method-title">
            <div class="ing-head"><h2 id="method-title">Modo de preparo</h2><button class="btn" data-cook="${r.id}">${ICON.chef} Modo cozinhar</button></div>
            <ol class="steps">${r.steps.map(s => `<li><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join('')}</ol>
            ${r.finish ? `<div class="finish"><h3>Para servir</h3><p>${esc(r.finish)}</p></div>` : ''}
          </section>

          <aside class="tip"><h2>Dica da casa</h2><p>${esc(r.tip)}</p></aside>
          <p class="disclaimer">Tempos e rendimentos aproximados: fornos, fogões e ingredientes variam. Quando o ponto descrito e o relógio discordarem, confie no ponto.</p>
        </article>

        <aside class="side recipe-side">
          <div class="side-box"><h2>Mais em ${esc(c.name)}</h2>${related.map(mini).join('')}<a class="text-link" href="#/categoria/${c.key}">Ver todas ${ICON.arrow}</a></div>
          <div class="side-box"><h2>Você também pode gostar</h2>${other.map(mini).join('')}</div>
          <a class="side-promo" href="#/geladeira">${ICON.fridge}<span><strong>O que tem na geladeira?</strong>Diga o que sobrou e veja o que dá para fazer.</span></a>
        </aside>
      </div>
    </div>`;
  }

  const stripTags = h => { const d = document.createElement('div'); d.innerHTML = h; return d.textContent.trim(); };
  const credit = f => `Foto: ${esc(stripTags(f.autor) || 'autor desconhecido')} · <a href="${esc(f.fonte)}" target="_blank" rel="noopener">Wikimedia Commons</a> · ${f.licencaUrl ? `<a href="${esc(f.licencaUrl)}" target="_blank" rel="noopener">${esc(f.licenca)}</a>` : esc(f.licenca)}`;
  function credits() {
    currentListing = null;
    const rs = RECIPES.filter(r => r.foto);
    return `<div class="wrap page">${crumbs([[null, 'Créditos das fotos']])}
      <header class="page-title"><h1>Créditos das fotos</h1><p>As fotos vêm do Wikimedia Commons, sob licenças livres (Creative Commons ou domínio público), e foram redimensionadas para o site. Obrigado a cada fotógrafo.</p></header>
      <ul class="credits">${rs.map(r => `<li><a class="credits-thumb" href="#/receita/${r.id}">${art(r, '', r.title)}</a><div><a href="#/receita/${r.id}"><strong>${esc(r.title)}</strong></a><p>${credit(r.foto)}</p></div></li>`).join('')}</ul></div>`;
  }

  function about() {
    currentListing = null;
    const fotos = RECIPES.filter(r => r.foto).length;
    return `<div class="wrap page prose-page">${crumbs([[null, 'Sobre']])}
      <header class="page-title"><h1>Receitas de casa, com tempo para a prosa</h1><p>O Colher de Prosa é um caderno de receitas brasileiras feito para quem cozinha de verdade: no celular apoiado na bancada, com a mão suja de farinha e gente chegando para o almoço.</p></header>
      <div class="prose">
        <h2>O que você encontra aqui</h2>
        <p>${RECIPES.length} receitas em ${CATS.length} categorias, do arroz de todo dia à ceia de Natal, ${fotos} delas com foto. Cada uma traz medidas claras (com o peso em gramas sempre que ajuda), o ponto certo descrito em palavras e uma dica da casa para não errar.</p>
        <h2>Feito para usar na cozinha</h2>
        <ul>
          <li><strong>Porções que se ajustam:</strong> mude o número de pessoas e as quantidades são recalculadas.</li>
          <li><strong>Modo cozinhar:</strong> um passo por vez, letras grandes e timers que avisam quando tirar do fogo.</li>
          <li><strong>O que tem na geladeira?</strong> Diga o que sobrou e veja o que dá para fazer.</li>
          <li><strong>Salvar no WhatsApp:</strong> a receita chega inteira na sua conversa, pronta para guardar.</li>
        </ul>
        <h2>Sem pop-up no meio do preparo</h2>
        <p>Nada de janela pulando na tela enquanto você mexe a panela. A receita vem primeiro.</p>
        <p><a class="btn" href="#/receitas">Ver todas as receitas</a></p>
      </div></div>`;
  }
  function privacy() {
    currentListing = null;
    return `<div class="wrap page prose-page">${crumbs([[null, 'Privacidade']])}
      <header class="page-title"><h1>Privacidade</h1><p>Resumo honesto: o Colher de Prosa não tem cadastro, não pede login e não recebe os seus dados.</p></header>
      <div class="prose">
        <h2>O que fica guardado no seu aparelho</h2>
        <p>Suas receitas favoritas, as porções que você ajustou e, se você pedir, o seu número de WhatsApp ficam salvos apenas no armazenamento local do seu navegador. Eles não são enviados ao site nem a terceiros. Para apagar, basta limpar os dados de navegação deste site.</p>
        <h2>Salvar no WhatsApp</h2>
        <p>Ao tocar em “Salvar no WhatsApp”, o site abre o próprio WhatsApp com a receita escrita na mensagem. O envio acontece só quando você aperta enviar, dentro do aplicativo, e segue a política de privacidade do WhatsApp.</p>
        <h2>Fontes e fotos</h2>
        <p>As fontes tipográficas são carregadas do Google Fonts, que pode registrar o acesso técnico (endereço IP e navegador). As fotos ficam hospedadas junto com o site.</p>
        <h2>Alergias e restrições</h2>
        <p>Tempos, rendimentos e conversões de porção são aproximados. Confira sempre os rótulos dos ingredientes em caso de alergia ou restrição alimentar.</p>
      </div></div>`;
  }

  function notFound() {
    currentListing = null;
    return `<div class="wrap page">${crumbs([[null, 'Página não encontrada']])}<header class="page-title"><h1>Essa receita saiu do forno e sumiu.</h1><p>O endereço pode estar errado ou a receita mudou de lugar.</p></header><a class="btn" href="#/">Voltar ao início</a></div>`;
  }

  /* ---------- roteador ----------
     As páginas estáticas geradas (receitas/<id>/, categorias/<id>/ …) trazem a rota em
     <main data-rota>, para abrir já na tela certa mesmo sem # no endereço. */
  let lastRoute = '';
  function route() {
    const hash = curHash();
    if (!hash.startsWith('#/')) return; // âncoras internas (ex.: pular para o conteúdo)
    const [, view = '', ...rest] = hash.slice(1).split('/');
    const arg = decodeURIComponent(rest.join('/'));
    const changedPage = hash !== lastRoute;
    lastRoute = hash;
    let html, title = 'Colher de Prosa';
    switch (view) {
      case '': html = home(); break;
      case 'receitas': html = all(); title = 'Todas as receitas · Colher de Prosa'; break;
      case 'categoria': html = category(arg); title = (CAT[arg]?.name || 'Categoria') + ' · Colher de Prosa'; break;
      case 'colecao': html = collection(arg); title = (COLL[arg]?.name || 'Coleção') + ' · Colher de Prosa'; break;
      case 'busca': html = search(arg); title = `Busca: ${arg} · Colher de Prosa`; break;
      case 'favoritas': html = favs(); title = 'Favoritas · Colher de Prosa'; break;
      case 'geladeira': html = fridge(arg); title = 'O que tem na geladeira? · Colher de Prosa'; break;
      case 'creditos': html = credits(); title = 'Créditos das fotos · Colher de Prosa'; break;
      case 'sobre': html = about(); title = 'Sobre · Colher de Prosa'; break;
      case 'privacidade': html = privacy(); title = 'Privacidade · Colher de Prosa'; break;
      case 'receita': html = recipePage(arg); title = (BY_ID[arg]?.title || 'Receita') + ' · Colher de Prosa'; break;
      default: html = notFound();
    }
    clearInterval(carouselTimer);
    app.innerHTML = html;
    document.title = title;
    if (view === '') initCarousel();
    $$('[data-mega]', navList).forEach(a => a.classList.toggle('is-current', view === 'categoria' && a.dataset.mega === arg));
    if (view !== 'busca' && document.activeElement !== $('#search')) $('#search').value = '';
    if (changedPage) {
      window.scrollTo({ top: 0, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
      if (view !== 'busca' && view !== 'geladeira') app.focus({ preventScroll: true });
    }
    if (view === 'geladeira' && changedPage && arg !== undefined) $('#fridge-input')?.focus();
    updateCounts();
  }

  /* ---------- favoritas ---------- */
  function toggleFav(id, silent) {
    favorites.has(id) ? favorites.delete(id) : favorites.add(id);
    store.set('cp-favoritas', [...favorites]);
    const on = favorites.has(id);
    $$(`[data-fav="${id}"]`).forEach(b => {
      b.setAttribute('aria-pressed', String(on));
      if (b.classList.contains('fav-btn')) b.setAttribute('aria-label', `${on ? 'Remover das favoritas' : 'Guardar nas favoritas'}: ${BY_ID[id].title}`);
      const label = $('span', b); if (label) label.textContent = on ? 'Guardada' : 'Guardar';
    });
    if (!silent) toast(on ? 'Guardada nas favoritas.' : 'Removida das favoritas.');
    updateCounts();
    if (lastRoute === '#/favoritas' && !on) route();
  }
  function updateCounts() {
    // Os contadores só aparecem quando há algo guardado.
    const fc = $('#fav-count');
    fc.textContent = favorites.size; fc.hidden = !favorites.size;
  }

  /* ---------- salvar no WhatsApp ----------
     O WhatsApp não permite envio sem toque: o site monta a mensagem com a receita
     (nas porções escolhidas) e abre a conversa pronta; a pessoa só aperta "enviar".
     Com o número salvo, abre direto na conversa consigo mesma, sem escolher contato. */
  const fmtPhone = n => { const d = n.replace(/^55/, ''); return d.length >= 10 ? `(${d.slice(0, 2)}) ${d.slice(2, -4)}-${d.slice(-4)}` : n; };
  function recipeText(r) {
    const f = servingsFor(r) / r.serves, n = servingsFor(r);
    const lines = [`*${r.title}*`, `_${r.line}_`, '', `Rende: ${n === r.serves ? r.yield_ : n + (n === 1 ? ' porção' : ' porções')} · Tempo total: ${fmtTotal(r.minutes)}`];
    if (r.wait && r.wait !== '—') lines.push(`Planeje: ${r.wait}`);
    lines.push('', '*Ingredientes*');
    r.groups.forEach(g => { if (g.name) lines.push(`_${g.name}_`); g.items.forEach(it => lines.push('• ' + scaleItem(it, f))); });
    lines.push('', '*Modo de preparo*');
    r.steps.forEach((s, i) => lines.push(`${i + 1}. *${s.title}:* ${s.text}`));
    if (r.finish) lines.push('', `*Para servir:* ${r.finish}`);
    lines.push('', `*Dica:* ${r.tip}`, '', `Receita completa no Colher de Prosa: ${recipeURL(r.id)}`);
    return lines.join('\n');
  }
  function sendWhatsApp(r, number) {
    const url = (number ? `https://wa.me/${number}` : 'https://wa.me/') + '?text=' + encodeURIComponent(recipeText(r));
    window.open(url, '_blank', 'noopener');
    if (!favorites.has(r.id)) toggleFav(r.id, true);
    toast('Receita guardada nas favoritas e pronta no WhatsApp. É só tocar em enviar.');
  }
  const waDialog = $('#wa-dialog');
  let waRecipe = null;
  function askWhatsApp(r) {
    waRecipe = r;
    $('#wa-number').value = waNumber ? fmtPhone(waNumber) : '';
    $('#wa-error').hidden = true;
    waDialog.showModal(); document.body.classList.add('locked'); hoist();
    $('#wa-number').focus();
  }
  waDialog.addEventListener('close', () => { document.body.classList.remove('locked'); hoist(); });
  waDialog.addEventListener('click', e => {
    if (e.target === waDialog || e.target.closest('[data-close]')) return waDialog.close();
    if (e.target.closest('[data-wa-any]')) { waDialog.close(); if (waRecipe) sendWhatsApp(waRecipe, ''); }
  });
  $('#wa-form').addEventListener('submit', e => {
    e.preventDefault();
    let d = $('#wa-number').value.replace(/\D/g, '');
    if (d.length === 10 || d.length === 11) d = '55' + d;
    if (d.length < 12 || d.length > 13) { $('#wa-error').hidden = false; $('#wa-number').focus(); return; }
    if ($('#wa-remember').checked) { waNumber = d; store.set('cp-whatsapp', d); }
    waDialog.close();
    if (waRecipe) sendWhatsApp(waRecipe, d); else toast('Número salvo.');
    const y = window.scrollY; route(); window.scrollTo(0, y);
  });

  /* ---------- cronômetros (seguem visíveis em qualquer tela) ---------- */
  const timers = [];
  let timerLoop = null, audio;
  function beep() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      [0, .35, .7].forEach(t => { const o = audio.createOscillator(), g = audio.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(.0001, audio.currentTime + t); g.gain.exponentialRampToValueAtTime(.3, audio.currentTime + t + .02); g.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + t + .25); o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + .3); });
    } catch { /* sem áudio */ }
    navigator.vibrate?.([200, 100, 200]);
  }
  function startTimer(seconds, label) {
    timers.push({ id: Date.now() + Math.random(), label, end: Date.now() + seconds * 1000, done: false });
    toast(`Cronômetro de ${fmtClock(seconds)} iniciado.`);
    if (!timerLoop) timerLoop = setInterval(paintTimers, 500);
    paintTimers();
  }
  const fmtClock = s => { const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(ss).padStart(2, '0'); };
  function paintTimers() {
    const box = $('#timers');
    timers.forEach(t => { if (!t.done && t.end <= Date.now()) { t.done = true; beep(); toast(`Tempo! ${t.label}`); } });
    box.innerHTML = timers.map(t => { const left = Math.max(0, Math.round((t.end - Date.now()) / 1000)); return `<div class="timer${t.done ? ' is-done' : ''}"><span class="timer-clock" role="timer">${t.done ? 'Tempo!' : fmtClock(left)}</span><span class="timer-label">${esc(t.label)}</span><button data-timer-stop="${t.id}" aria-label="${t.done ? 'Dispensar' : 'Cancelar'} cronômetro: ${esc(t.label)}">×</button></div>`; }).join('');
    if (!timers.length) { clearInterval(timerLoop); timerLoop = null; }
  }
  $('#timers').addEventListener('click', e => { const b = e.target.closest('[data-timer-stop]'); if (b) { const i = timers.findIndex(t => String(t.id) === b.dataset.timerStop); if (i > -1) timers.splice(i, 1); paintTimers(); } });
  // Encontra tempos no texto do passo: "por 40 minutos", "1 hora", "25 a 30 minutos" (usa o menor).
  function findTimes(text) {
    const out = [], re = /(\d+)(?:\s*(?:a|ou)\s*\d+)?\s*(minutos?|min\b|horas?|h\b)(?:\s*(\d+))?/gi;
    let m;
    while ((m = re.exec(text)) && out.length < 2) {
      const n = +m[1], unit = m[2].toLowerCase(), extra = m[3] ? +m[3] : 0;
      const sec = unit.startsWith('h') ? n * 3600 + extra * 60 : n * 60;
      if (sec >= 60 && sec <= 6 * 3600 && !out.some(o => o.sec === sec)) out.push({ sec, label: m[0].trim() });
    }
    return out;
  }

  /* ---------- modo cozinhar ---------- */
  const cook = $('#cook');
  let cookState = null, wakeLock = null;
  async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; } }
  document.addEventListener('visibilitychange', () => { if (cook.open && document.visibilityState === 'visible') keepAwake(); });
  function openCook(id) {
    const r = BY_ID[id];
    cookState = { r, step: 0, showIng: false };
    paintCook();
    cook.showModal(); document.body.classList.add('locked');
    hoist(); keepAwake();
  }
  function paintCook() {
    const { r, step, showIng } = cookState, total = r.steps.length, done = step >= total, f = servingsFor(r) / r.serves;
    const s = r.steps[step];
    ['#timers', '#toast'].forEach(sel => document.body.appendChild($(sel))); // não apagar junto com o innerHTML
    cook.innerHTML = `<div class="cook-top"><div><span class="eyebrow">Modo cozinhar</span><h2 id="cook-title">${esc(r.title)}</h2></div>
      <div class="cook-top-actions"><button class="btn btn-ghost small" data-cook-ing aria-pressed="${showIng}">Ingredientes</button><button class="icon-btn" data-cook-close aria-label="Sair do modo cozinhar">×</button></div></div>
      <div class="cook-progress" aria-hidden="true"><span style="width:${Math.min(100, (step / total) * 100)}%"></span></div>
      <div class="cook-main${showIng ? ' with-ing' : ''}">
        <div class="cook-step" aria-live="polite">${done
          ? `<span class="cook-count">Pronto!</span><h3>Bom apetite.</h3><p>Agora é servir e puxar uma cadeira. ${r.finish ? esc(r.finish) : ''}</p><button class="btn" data-cook-close>Fechar</button>`
          : `<span class="cook-count">Passo ${step + 1} de ${total}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>${findTimes(s.text).map(t => `<button class="btn btn-soft" data-start-timer="${t.sec}" data-label="${esc(s.title)}">${ICON.clock} Iniciar ${esc(t.label)}</button>`).join(' ')}`}</div>
        ${showIng ? `<aside class="cook-ing"><h3>Ingredientes · ${servingsFor(r)} porções</h3>${r.groups.map(g => `${g.name ? `<h4>${esc(g.name)}</h4>` : ''}<ul>${g.items.map(it => `<li>${esc(scaleItem(it, f))}</li>`).join('')}</ul>`).join('')}</aside>` : ''}
      </div>
      <div class="cook-nav"><button class="btn btn-ghost" data-cook-step="-1"${step === 0 ? ' disabled' : ''}>← Anterior</button><span class="cook-hint">Use as setas do teclado · a tela fica acesa</span><button class="btn" data-cook-step="1"${done ? ' disabled' : ''}>${step === total - 1 ? 'Concluir' : 'Próximo →'}</button></div>`;
    hoist();
  }
  function closeCook() { if (cook.open) cook.close(); }
  cook.addEventListener('close', () => { document.body.classList.remove('locked'); hoist(); wakeLock?.release?.(); wakeLock = null; $('[data-cook]', app)?.focus(); });
  cook.addEventListener('click', e => {
    if (e.target.closest('[data-cook-close]')) return closeCook();
    const st = e.target.closest('[data-cook-step]');
    if (st) { cookState.step = Math.max(0, Math.min(cookState.r.steps.length, cookState.step + +st.dataset.cookStep)); paintCook(); $('[data-cook-step="1"]:not([disabled])', cook)?.focus() || $('[data-cook-close]', cook)?.focus(); return; }
    if (e.target.closest('[data-cook-ing]')) { cookState.showIng = !cookState.showIng; paintCook(); $('[data-cook-ing]', cook).focus(); return; }
    const t = e.target.closest('[data-start-timer]');
    if (t) startTimer(+t.dataset.startTimer, t.dataset.label);
  });
  document.addEventListener('keydown', e => {
    if (!cook.open || /input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      cookState.step = Math.max(0, Math.min(cookState.r.steps.length, cookState.step + (e.key === 'ArrowRight' ? 1 : -1)));
      paintCook();
    }
  });

  /* ---------- eventos globais ---------- */
  document.addEventListener('click', e => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav); return; }
    const wa = e.target.closest('[data-wa]');
    if (wa) { const r = BY_ID[wa.dataset.wa]; if (waNumber) sendWhatsApp(r, waNumber); else askWhatsApp(r); return; }
    if (e.target.closest('[data-wa-change]')) { waRecipe = BY_ID[routeArg()] || null; askWhatsApp(waRecipe); return; }
    const serv = e.target.closest('[data-serv]'), reset = e.target.closest('[data-serv-reset]');
    if (serv || reset) {
      const id = routeArg(), r = BY_ID[id]; if (!r) return;
      const n = reset ? r.serves : Math.max(1, Math.min(r.serves * 4, servingsFor(r) + +serv.dataset.serv));
      servingsPref[id] = n; store.set('cp-porcoes', servingsPref);
      const checked = $$('[data-check]:checked', app).map(x => x.dataset.check);
      const y = window.scrollY;
      route();
      checked.forEach(k => { const c = $(`[data-check="${k}"]`, app); if (c) c.checked = true; });
      window.scrollTo(0, y);
      (serv ? $(`[data-serv="${serv.dataset.serv}"]:not([disabled])`, app) || $('[data-serv]:not([disabled])', app) : $('[data-serv="1"]', app))?.focus();
      return;
    }
    const ck = e.target.closest('[data-cook]');
    if (ck) { openCook(ck.dataset.cook); return; }
    if (e.target.closest('[data-print]')) { window.print(); return; }
    if (e.target.closest('[data-share]')) {
      const r = BY_ID[curHash().startsWith('#/receita/') && routeArg()];
      const url = r ? recipeURL(r.id) : location.href, title = document.title;
      if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ title, url }).catch(() => {});
      else (navigator.clipboard?.writeText(url) || Promise.reject()).then(() => toast('Link da receita copiado.'), () => toast(url));
      return;
    }
    const addChip = e.target.closest('[data-add-chip]');
    if (addChip) { setFridge([...fridgeChips(), addChip.dataset.addChip]); return; }
    const rmChip = e.target.closest('[data-remove-chip]');
    if (rmChip) { const c = fridgeChips(); c.splice(+rmChip.dataset.removeChip, 1); setFridge(c); }
  });
  document.addEventListener('change', e => {
    if (e.target.matches('[data-sort]')) { filters.sort = e.target.value; refreshListing(); }
    if (e.target.matches('[data-filter]')) { filters[e.target.dataset.filter] = e.target.checked; refreshListing(); }
  });

  const fridgeChips = () => decodeURIComponent(routeArg() || '').split(',').map(s => s.trim()).filter(Boolean);
  function setFridge(chips) {
    const uniq = [...new Set(chips.map(c => c.trim().toLowerCase()).filter(Boolean))];
    history.replaceState(null, '', '#/geladeira/' + encodeURIComponent(uniq.join(',')));
    lastRoute = location.hash; route(); $('#fridge-input')?.focus();
  }
  document.addEventListener('submit', e => {
    if (e.target.matches('[data-fridge-tool]')) {
      e.preventDefault();
      const v = $('#fridge-input').value; if (!v.trim()) return;
      setFridge([...fridgeChips(), ...v.split(',')]);
    } else if (e.target.matches('[data-fridge-form]')) {
      e.preventDefault();
      const v = $('#fridge-home').value.split(',').map(s => s.trim()).filter(Boolean).join(',');
      location.hash = '#/geladeira/' + encodeURIComponent(v);
    }
  });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'fridge-input' && e.key === 'Backspace' && !e.target.value) { const c = fridgeChips(); if (c.length) { c.pop(); setFridge(c); } }
  });

  // Busca no cabeçalho: resultados ao vivo, sem empilhar o histórico a cada tecla.
  const searchInput = $('#search');
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = searchInput.value.trim();
      if (!q) { if (location.hash.startsWith('#/busca')) location.hash = '#/receitas'; return; }
      const h = '#/busca/' + encodeURIComponent(q);
      if (location.hash.startsWith('#/busca')) { history.replaceState(null, '', h); lastRoute = h; route(); }
      else location.hash = h;
    }, 180);
  });
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); searchInput.dispatchEvent(new Event('input')); });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); searchInput.focus(); }
  });

  $('.skip').addEventListener('click', e => { e.preventDefault(); app.focus(); });

  window.addEventListener('hashchange', route);
  route();
  if (reduceMotion) document.documentElement.classList.add('reduce-motion');
})();
