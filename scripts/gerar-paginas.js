#!/usr/bin/env node
/* Colher de Prosa — gerador de páginas estáticas para buscadores e compartilhamento.

   O site é uma aplicação de página única (index.html + app.js). Este script cria, a partir
   dos mesmos dados, uma página HTML de verdade para cada receita, categoria e página
   institucional, com o conteúdo já escrito no HTML, título e descrição próprios, imagem
   para WhatsApp/redes sociais e dados estruturados de receita (schema.org/Recipe).
   Também gera sitemap.xml, robots.txt e 404.html.

   Uso:   node scripts/gerar-paginas.js
          SITE_URL=https://www.seudominio.com.br/ node scripts/gerar-paginas.js

   Rode de novo sempre que adicionar ou alterar receitas, ou ao trocar de domínio. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = (process.env.SITE_URL || 'https://smoreiraparanhos-web.github.io/Colher-de-prosa/').replace(/\/?$/, '/');
const SITE_NAME = 'Colher de Prosa';
const OUT_DIRS = ['receitas', 'categorias', 'sobre', 'privacidade', 'creditos'];

/* ---------- dados ---------- */
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter(f => f.endsWith('.js')).sort()) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'), ctx, { filename: f });
}
// Mesmos textos de app.js (CATS); manter os dois em sincronia ao criar uma categoria.
const CATS = [
  ['massas', 'Massas', 'Do alho e óleo de quinze minutos à lasanha de domingo.'],
  ['bebidas', 'Bebidas', 'Sucos, cafés, drinques e jarras para dividir.'],
  ['bolos', 'Bolos e tortas', 'Bolos de café da tarde e tortas doces e salgadas.'],
  ['natal', 'Ceia de Natal', 'Assados, acompanhamentos e a rabanada que todo mundo espera.'],
  ['pascoa', 'Ceia de Páscoa', 'Bacalhau, cordeiro, colomba e ovo de colher.'],
  ['carnes', 'Carnes', 'Panela de pressão, forno baixo e frigideira bem quente.'],
  ['aves', 'Aves', 'Frango para todo dia e para dia especial.'],
  ['saladas', 'Saladas e molhos', 'Folhas, grãos e os molhos que salvam a semana.'],
  ['doces', 'Doces e sobremesas', 'Pudim, brigadeiro, quindim e outros clássicos de colher.']
].map(([key, name, desc]) => ({ key, name, desc }));
const CAT = Object.fromEntries(CATS.map(c => [c.key, c]));
const FOTOS = ctx.window.FOTOS || {};
const RECIPES = ctx.window.RECIPES.map(r => ({
  ...r,
  groups: r.groups ? r.groups.map(g => Array.isArray(g) ? { name: g[0], items: g[1] } : g) : [{ name: '', items: r.ing || [] }],
  steps: r.steps.map(s => Array.isArray(s) ? { title: s[0], text: s[1] } : s),
  tags: r.tags || [],
  foto: FOTOS[r.id]
}));
for (const r of RECIPES) if (!CAT[r.category]) throw new Error(`Receita "${r.id}" com categoria desconhecida: ${r.category}`);

/* ---------- utilitários ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const abs = rel => new URL(rel, SITE_URL).href;
const iso = min => min > 0 ? `PT${Math.floor(min / 60) ? Math.floor(min / 60) + 'H' : ''}${min % 60 ? (min % 60) + 'M' : ''}` : 'PT0M';
const parseMin = t => { let m = 0; const h = /(\d+)\s*h/.exec(t); const mm = /(\d+)\s*min/.exec(t); if (h) m += +h[1] * 60; if (mm) m += +mm[1]; return m || null; };
const fmtTotal = m => m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${Math.round(m / 60)} h`;
const clip = (s, n = 155) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
const jsonLd = obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
const recipeHref = (r, depth) => `${'../'.repeat(depth)}receitas/${r.id}/`;
const defaultImage = abs((RECIPES.find(r => r.id === 'pudim' && r.foto) || RECIPES.find(r => r.foto)).foto.src);

/* ---------- molde ---------- */
const template = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SEO = /<!-- seo -->[\s\S]*?<!-- \/seo -->/;
const MAIN = /<main id="app"[^>]*>[\s\S]*?<\/main>/;
if (!SEO.test(template) || !MAIN.test(template)) throw new Error('index.html precisa dos marcadores <!-- seo --> … <!-- /seo --> e de <main id="app">.');

function seoBlock({ title, desc, url, image = defaultImage, type = 'website', ld = [] }) {
  return `<!-- seo -->
<meta name="description" content="${esc(desc)}">
<title>${esc(title)}</title>
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
${ld.map(jsonLd).join('\n')}
<!-- /seo -->`;
}

function page({ dir, depth, base, rota, seo, body }) {
  let html = template.replace(SEO, () => seoBlock(seo));
  if (base) html = html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n<base href="${base}">`);
  html = html.replace(MAIN, () => `<main id="app" tabindex="-1"${rota ? ` data-rota="${esc(rota)}"` : ''}>\n${body}\n</main>`);
  const file = path.join(ROOT, dir, 'index.html');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  return dir;
}

const crumbsLd = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url }))
});
const ORG = { '@type': 'Organization', name: SITE_NAME, url: SITE_URL };

/* ---------- limpeza das páginas geradas anteriormente ---------- */
for (const d of OUT_DIRS) fs.rmSync(path.join(ROOT, d), { recursive: true, force: true });

const urls = [{ loc: SITE_URL, priority: '1.0' }];

/* ---------- página inicial (atualiza o próprio index.html) ---------- */
fs.writeFileSync(path.join(ROOT, 'index.html'), template.replace(SEO, () => seoBlock({
  title: `${SITE_NAME} · Receitas de casa, com tempo para a prosa`,
  desc: `${RECIPES.length} receitas brasileiras organizadas com cuidado: medidas claras, porções que se ajustam, modo cozinhar passo a passo e receitas salvas direto no WhatsApp.`,
  url: SITE_URL,
  ld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE_URL, inLanguage: 'pt-BR',
    potentialAction: { '@type': 'SearchAction', target: `${SITE_URL}#/busca/{search_term_string}`, 'query-input': 'required name=search_term_string' } }]
})));

/* ---------- receitas ---------- */
for (const r of RECIPES) {
  const c = CAT[r.category], url = abs(`receitas/${r.id}/`);
  const items = r.groups.flatMap(g => g.items);
  const image = r.foto ? abs(r.foto.src) : defaultImage;
  const prep = parseMin(r.prep);
  const related = RECIPES.filter(x => x.category === r.category && x.id !== r.id).slice(0, 6);
  const ld = {
    '@context': 'https://schema.org', '@type': 'Recipe',
    name: r.title, description: r.line, image: [image], url,
    author: ORG, publisher: ORG,
    recipeCategory: c.name, recipeCuisine: 'Brasileira', inLanguage: 'pt-BR',
    keywords: [r.title, c.name, ...r.tags.map(t => ({ vegetariana: 'vegetariana', 'sem-forno': 'sem forno', congela: 'pode congelar' }[t] || t))].join(', '),
    recipeYield: [String(r.serves), r.yield_],
    totalTime: iso(r.minutes),
    ...(prep ? { prepTime: iso(prep), cookTime: iso(Math.max(0, r.minutes - prep)) } : {}),
    ...(r.tags.includes('vegetariana') ? { suitableForDiet: 'https://schema.org/VegetarianDiet' } : {}),
    recipeIngredient: items,
    recipeInstructions: r.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.text, url: `${url}#passo-${i + 1}` }))
  };
  const desc = clip(`${r.title}: ${r.line} Rende ${r.yield_}, pronto em ${fmtTotal(r.minutes)}. Ingredientes, modo de preparo e dica da casa.`);
  const body = `<article class="pre">
  <p><a href="../../">Início</a> › <a href="../../categorias/${c.key}/">${esc(c.name)}</a></p>
  <h1>${esc(r.title)}</h1>
  <p>${esc(r.line)}</p>
  ${r.foto ? `<img src="${esc(r.foto.src)}" alt="${esc(r.title)}">` : ''}
  <p><strong>Preparo:</strong> ${esc(r.prep)} · <strong>Tempo total:</strong> ${fmtTotal(r.minutes)} · <strong>Rendimento:</strong> ${esc(r.yield_)} · <strong>Dificuldade:</strong> ${esc(r.level)}</p>
  ${r.wait && r.wait !== '—' ? `<p><strong>Planeje:</strong> ${esc(r.wait)}.</p>` : ''}
  <h2>Ingredientes</h2>
  ${r.groups.map(g => `${g.name ? `<h3>${esc(g.name)}</h3>` : ''}<ul>${g.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>`).join('\n  ')}
  ${r.equipment ? `<p><strong>Na bancada:</strong> ${esc(r.equipment)}</p>` : ''}
  <h2>Modo de preparo</h2>
  <ol>${r.steps.map((s, i) => `<li id="passo-${i + 1}"><strong>${esc(s.title)}.</strong> ${esc(s.text)}</li>`).join('')}</ol>
  ${r.finish ? `<h2>Para servir</h2><p>${esc(r.finish)}</p>` : ''}
  <h2>Dica da casa</h2>
  <p>${esc(r.tip)}</p>
  ${r.foto ? `<p><small>Foto: ${esc(stripTags(r.foto.autor) || 'autor desconhecido')}, Wikimedia Commons (${esc(r.foto.licenca)}).</small></p>` : ''}
  <h2>Mais em ${esc(c.name)}</h2>
  <ul>${related.map(x => `<li><a href="${recipeHref(x, 2)}">${esc(x.title)}</a></li>`).join('')}</ul>
</article>`;
  page({
    dir: `receitas/${r.id}`, base: '../../', rota: `#/receita/${r.id}`, body,
    seo: { title: `${r.title} · ${SITE_NAME}`, desc, url, image, type: 'article',
      ld: [ld, crumbsLd([[SITE_NAME, SITE_URL], [c.name, abs(`categorias/${c.key}/`)], [r.title, url]])] }
  });
  urls.push({ loc: url, priority: '0.8' });
}

/* ---------- categorias ---------- */
const listBody = (title, desc, rs, depth) => `<section class="pre">
  <p><a href="${'../'.repeat(depth)}">Início</a></p>
  <h1>${esc(title)}</h1>
  <p>${esc(desc)}</p>
  <ul>${rs.map(r => `<li><a href="${recipeHref(r, depth)}">${esc(r.title)}</a>: ${esc(r.line)}</li>`).join('')}</ul>
</section>`;
const itemList = rs => ({ '@context': 'https://schema.org', '@type': 'ItemList',
  itemListElement: rs.map((r, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`receitas/${r.id}/`) })) });

for (const c of CATS) {
  const rs = RECIPES.filter(r => r.category === c.key), url = abs(`categorias/${c.key}/`);
  page({
    dir: `categorias/${c.key}`, base: '../../', rota: `#/categoria/${c.key}`,
    body: listBody(c.name, c.desc, rs, 2),
    seo: { title: `${c.name}: ${rs.length} receitas · ${SITE_NAME}`, desc: clip(`${c.desc} ${rs.length} receitas explicadas passo a passo: ${rs.slice(0, 4).map(r => r.title.toLowerCase()).join(', ')} e mais.`), url,
      image: rs.find(r => r.foto) ? abs(rs.find(r => r.foto).foto.src) : defaultImage,
      ld: [itemList(rs), crumbsLd([[SITE_NAME, SITE_URL], [c.name, url]])] }
  });
  urls.push({ loc: url, priority: '0.9' });
}

page({
  dir: 'receitas', base: '../', rota: '#/receitas',
  body: listBody('Todas as receitas', `${RECIPES.length} receitas brasileiras em ${CATS.length} categorias.`, RECIPES, 1),
  seo: { title: `Todas as receitas · ${SITE_NAME}`, desc: `As ${RECIPES.length} receitas do ${SITE_NAME}: massas, carnes, aves, bolos, doces, bebidas, saladas e as ceias de Natal e Páscoa.`, url: abs('receitas/'), ld: [itemList(RECIPES)] }
});
urls.push({ loc: abs('receitas/'), priority: '0.9' });

/* ---------- institucionais ---------- */
const simple = (dir, rota, title, desc, text) => {
  page({ dir, base: '../', rota, body: `<section class="pre"><p><a href="../">Início</a></p><h1>${esc(title)}</h1><p>${esc(text)}</p></section>`,
    seo: { title: `${title} · ${SITE_NAME}`, desc, url: abs(dir + '/') } });
  urls.push({ loc: abs(dir + '/'), priority: '0.3' });
};
simple('sobre', '#/sobre', 'Sobre o Colher de Prosa', `Um caderno de receitas brasileiras feito para usar na cozinha: porções que se ajustam, modo cozinhar e receitas no WhatsApp.`,
  `O Colher de Prosa é um caderno de ${RECIPES.length} receitas brasileiras feito para quem cozinha de verdade, com medidas claras, porções que se ajustam e nenhum pop-up no meio do preparo.`);
simple('privacidade', '#/privacidade', 'Privacidade', 'O Colher de Prosa não tem cadastro e não recebe os seus dados: favoritas e preferências ficam só no seu navegador.',
  'O Colher de Prosa não tem cadastro, não pede login e não recebe os seus dados. Favoritas, porções e número de WhatsApp ficam apenas no seu navegador.');
simple('creditos', '#/creditos', 'Créditos das fotos', 'Fotos do Wikimedia Commons sob licenças livres, com autoria e licença de cada imagem.',
  'As fotos vêm do Wikimedia Commons, sob licenças livres (Creative Commons ou domínio público). Autoria e licença de cada imagem aparecem nesta página.');

/* ---------- 404 (GitHub Pages e a maioria das hospedagens estáticas) ---------- */
{
  const basePath = new URL(SITE_URL).pathname;
  let html = template.replace(SEO, () => `<!-- seo -->\n<title>Página não encontrada · ${SITE_NAME}</title>\n<meta name="robots" content="noindex">\n<!-- /seo -->`)
    .replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n<base href="${basePath}">`)
    .replace(MAIN, () => '<main id="app" tabindex="-1" data-rota="#/404"></main>');
  fs.writeFileSync(path.join(ROOT, '404.html'), html);
}

/* ---------- sitemap e robots ---------- */
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u.loc)}</loc><lastmod>${today}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(ROOT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);

console.log(`${SITE_NAME}: ${urls.length} páginas geradas para ${SITE_URL}`);
