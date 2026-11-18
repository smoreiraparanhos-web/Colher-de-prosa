(() => {
  'use strict';
  const recipes = window.RECIPES;
  const $ = s => document.querySelector(s);
  const grid = $('#recipes-grid'), dialog = $('#recipe-dialog');
  let category = 'Todas', query = '', active = null, trigger = null, favorites = new Set(), toastTimer;
  try {
    const saved = JSON.parse(localStorage.getItem('colher-favoritas') || '[]');
    if (Array.isArray(saved)) favorites = new Set(saved.filter(id => recipes.some(r => r.id === id)));
  } catch {}

  const normalize = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = r => String(recipes.indexOf(r) + 1).padStart(2, '0');

  function notify(text) {
    $('#toast').textContent = text;
    $('#toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').hidden = true, 2600);
  }

  function render() {
    const found = recipes.filter(r =>
      (category === 'Todas' || (category === 'Favoritas' ? favorites.has(r.id) : r.category === category)) &&
      normalize(r.title + ' ' + r.groups.flatMap(g => g.items).join(' ')).includes(normalize(query)));
    grid.innerHTML = found.map(r => `<article class="recipe-card"><a class="card-picture" href="#receita-${r.id}" data-open="${r.id}" aria-label="Ver receita de ${escape(r.title)}"><img src="${r.image}" alt="${escape(r.title)} pronto para servir" width="600" height="420" loading="lazy"><span class="card-num" aria-hidden="true">Prova ${number(r)}</span></a><button class="save-card" data-save="${r.id}" aria-label="${favorites.has(r.id) ? 'Remover dos favoritos' : 'Guardar receita'}: ${escape(r.title)}" aria-pressed="${favorites.has(r.id)}">${favorites.has(r.id) ? '♥' : '♡'}</button><div class="card-copy"><span class="card-tag">${r.tag}</span><h3><a href="#receita-${r.id}" data-open="${r.id}">${r.title}</a></h3><p>${r.line}</p><div class="card-meta"><span>Preparo · ${r.prep}</span><span>${r.yield_}</span></div><a class="card-link" href="#receita-${r.id}" data-open="${r.id}">Encarar a prova <span aria-hidden="true">↗</span></a></div></article>`).join('');
    $('#empty').hidden = found.length > 0;
    $('#results-status').textContent = found.length === recipes.length
      ? recipes.length + ' provas na bancada. Escolha a sua e mãos na massa.'
      : found.length + ' prova' + (found.length !== 1 ? 's' : '') + ' na sua bancada';
    $('#saved-count').textContent = favorites.size;
    document.querySelectorAll('[data-category]').forEach(b => {
      const selected = b.dataset.category === category;
      b.classList.toggle('active', selected);
      b.setAttribute('aria-pressed', String(selected));
    });
  }

  function toggleSave(id) {
    if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
    try { localStorage.setItem('colher-favoritas', JSON.stringify([...favorites])); }
    catch { notify('Favoritos disponíveis apenas nesta sessão.'); }
    render();
    if (active) updateFavorite();
  }

  function updateFavorite() {
    const saved = favorites.has(active.id);
    $('#favorite-recipe').textContent = saved ? '♥ Guardada' : '♡ Guardar';
    $('#favorite-recipe').setAttribute('aria-pressed', String(saved));
  }

  /* Cronômetro da prova: conta regressiva com o tempo de preparo ativo da receita. */
  let timerTotal = 0, timerLeft = 0, timerEnd = 0, timerId = null;
  const prepSeconds = text => {
    const h = /(\d+)\s*h/.exec(text), m = /(\d+)\s*min/.exec(text);
    return ((h ? +h[1] : 0) * 60 + (m ? +m[1] : 0)) * 60;
  };
  const clock = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  function paintTimer(message) {
    if (!$('#timer')) return;
    $('#timer-display').textContent = clock(timerLeft);
    $('#timer-toggle').textContent = timerId ? 'Pausar' : timerLeft === 0 ? 'Tempo esgotado' : timerLeft < timerTotal ? 'Continuar' : 'Valendo!';
    $('#timer-toggle').disabled = timerLeft === 0;
    $('#timer').classList.toggle('running', !!timerId);
    $('#timer').classList.toggle('done', timerLeft === 0);
    if (message !== undefined) $('#timer-status').textContent = message;
  }
  function stopTimer() { clearInterval(timerId); timerId = null; }
  function tick() {
    timerLeft = Math.max(0, Math.round((timerEnd - Date.now()) / 1000));
    if (timerLeft === 0) { stopTimer(); paintTimer('Tempo esgotado! Mãos para cima.'); }
    else paintTimer();
  }
  function toggleTimer() {
    if (timerId) { stopTimer(); paintTimer('Cronômetro pausado.'); return; }
    if (timerLeft === 0) return;
    timerEnd = Date.now() + timerLeft * 1000;
    timerId = setInterval(tick, 250);
    paintTimer('Valendo! O tempo está correndo.');
  }
  function resetTimer(seconds) {
    stopTimer();
    if (seconds !== undefined) timerTotal = seconds;
    timerLeft = timerTotal;
    paintTimer('');
  }

  function openRecipe(id, source) {
    const r = recipes.find(r => r.id === id);
    if (!r) return;
    active = r;
    trigger = source || document.activeElement;
    $('#recipe-content').innerHTML = `<div class="recipe-hero"><div><p class="eyebrow">Prova ${number(r)} · ${r.tag}</p><h2 id="recipe-title">${r.title}</h2><p class="recipe-intro">${r.line}</p><dl class="recipe-facts"><div><dt>Preparo ativo</dt><dd>${r.prep}</dd></div><div><dt>Espera / cozimento</dt><dd>${r.wait}</dd></div><div><dt>Rendimento</dt><dd>${r.yield_}</dd></div><div><dt>Categoria</dt><dd>${r.category}</dd></div></dl><div class="timer" id="timer"><div><span class="timer-label">Cronômetro da prova</span><div class="timer-display" id="timer-display" role="timer" aria-label="Tempo restante de preparo"></div></div><div class="timer-actions"><button class="button" id="timer-toggle" data-timer="toggle"></button><button class="icon-button" data-timer="reset">Zerar</button></div><p class="sr-only" id="timer-status" role="status"></p></div></div><img src="${r.image}" alt="${escape(r.title)} pronto para servir" width="600" height="500"></div><div class="recipe-body"><aside><h3>Ingredientes</h3><p class="measurement-note">Monte a sua bancada: marque o que já separou. Xícara padrão: 240 ml.</p>${r.groups.map((g, gi) => `<div class="ingredient-group"><h4>${g.name}</h4><ul class="ingredient-list">${g.items.map((item, i) => `<li><label><input type="checkbox" id="ingredient-${gi}-${i}"><span>${escape(item)}</span></label></li>`).join('')}</ul></div>`).join('')}<div class="equipment"><strong>Na bancada</strong>${r.equipment}</div></aside><div><h3>Modo de preparo</h3><ol class="preparation">${r.steps.map(s => `<li><h4>${s.title}</h4><p>${s.text}</p></li>`).join('')}</ol><div class="finish"><h3>Empratamento</h3><p>${r.finish}</p></div><div class="recipe-tip"><strong>Dica de chef</strong>${r.tip}</div><p class="measurement-note">Tempos e rendimentos aproximados. Foto ilustrativa. O resultado varia conforme ingredientes e equipamentos.</p></div></div>`;
    resetTimer(prepSeconds(r.prep));
    updateFavorite();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add('modal-open');
    dialog.scrollTop = 0;
    $('#close-recipe').focus();
  }

  function closeRecipe() {
    stopTimer();
    if (dialog.open) dialog.close();
    document.body.classList.remove('modal-open');
    if (location.hash.startsWith('#receita-')) history.replaceState(null, '', location.pathname + location.search + '#caderno');
    if (trigger?.isConnected) trigger.focus(); else $('#search').focus();
  }

  document.addEventListener('click', e => {
    const timer = e.target.closest('[data-timer]');
    if (timer) { if (timer.dataset.timer === 'toggle') toggleTimer(); else resetTimer(); return; }
    const opener = e.target.closest('[data-open]');
    if (opener) {
      e.preventDefault();
      const id = opener.dataset.open;
      history.replaceState(null, '', '#receita-' + id);
      openRecipe(id, opener);
      return;
    }
    const save = e.target.closest('[data-save]');
    if (save) {
      toggleSave(save.dataset.save);
      const replacement = grid.querySelector(`[data-save="${save.dataset.save}"]`);
      (replacement || $('#search')).focus();
      return;
    }
    const filter = e.target.closest('[data-category]');
    if (filter) { category = filter.dataset.category; render(); }
  });
  $('#search').addEventListener('input', e => { query = e.target.value; render(); });
  $('#saved-nav').addEventListener('click', () => {
    category = 'Favoritas'; query = ''; $('#search').value = ''; render();
    $('#caderno').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
  $('#clear-filters').addEventListener('click', () => { category = 'Todas'; query = ''; $('#search').value = ''; render(); $('#search').focus(); });
  $('#close-recipe').addEventListener('click', closeRecipe);
  $('#back-recipe').addEventListener('click', e => { e.preventDefault(); closeRecipe(); });
  dialog.addEventListener('cancel', e => { e.preventDefault(); closeRecipe(); });
  dialog.addEventListener('click', e => {
    if (e.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeRecipe();
    }
  });
  $('#favorite-recipe').addEventListener('click', () => { if (active) toggleSave(active.id); });
  $('#print-recipe').addEventListener('click', () => window.print());
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('#receita-')) openRecipe(location.hash.slice(9));
    else if (dialog.open) closeRecipe();
  });
  render();
  if (location.hash.startsWith('#receita-')) openRecipe(location.hash.slice(9));
})();
