import { SPECIES, RESOURCES, RESONANCES, RECIPES } from './data.mjs';
import { DIRECTIONS } from './connections.mjs';
import { createState, demoState, restore, power, evaluate, advance, place, remove, turn, setResonance, setRecipe } from './engine.mjs';
const $ = id => document.getElementById(id);
const SAVE = 'manufacture-v1';
let state = demoState(), selected = '2-1', speed = 1, lastTime = performance.now(), lastSave = 0, pendingAction = null;
try { const saved = localStorage.getItem(SAVE); if (saved) state = restore(saved); } catch { $('save-state').textContent = 'Сохранение недоступно — можно сохранить файл'; }
const fmtTime = time => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.floor(time % 60)).padStart(2, '0')}`;
function slime(species) {
  const shapes = {
    producer: 'M12 65 Q7 44 23 34 Q24 13 43 15 Q64 10 72 34 Q90 44 86 65 Q83 79 49 78 Q16 81 12 65Z',
    processor: 'M13 66 Q9 38 26 29 L31 13 Q36 7 42 20 Q52 15 62 22 Q73 8 77 18 L77 35 Q90 45 86 66 Q82 80 51 77 Q19 80 13 66Z',
    crafter: 'M11 64 Q7 45 23 35 Q23 19 38 18 Q41 7 52 13 Q68 12 72 32 Q93 43 86 64 Q85 80 51 78 Q17 81 11 64Z',
    booster: 'M12 65 Q6 44 27 34 Q27 20 40 20 L44 5 L53 20 Q70 16 73 34 Q90 46 86 65 Q86 79 51 77 Q17 81 12 65Z',
  };
  return `<span class="slime" style="--slime:${SPECIES[species].color}"><svg viewBox="0 0 100 90" aria-hidden="true"><path class="body" d="${shapes[species]}"/><ellipse class="shine" cx="32" cy="34" rx="9" ry="5" transform="rotate(-30 32 34)"/><ellipse class="eye" cx="38" cy="51" rx="3.5" ry="5"/><ellipse class="eye" cx="63" cy="51" rx="3.5" ry="5"/><path class="mouth" d="M46 59 Q51 63 55 58"/><ellipse fill="#e483752e" cx="29" cy="58" rx="6" ry="3"/><ellipse fill="#e483752e" cx="72" cy="58" rx="6" ry="3"/>${species === 'processor' ? '<path d="M30 45h16v12H30zM55 45h16v12H55zM46 49h9" stroke="#426567" stroke-width="2" fill="none"/>' : ''}${species === 'crafter' ? '<path d="M76 22l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#faf6da"/>' : ''}</svg></span>`;
}
function save() {
  try { localStorage.setItem(SAVE, JSON.stringify(state)); $('save-state').textContent = 'Сохранено в этом браузере · без офлайн-производства'; }
  catch { $('save-state').textContent = 'Автосохранение недоступно — сохраните файл'; }
}
function change(fn, message) { fn(); render(); save(); if (message) $('hint').textContent = message; }
function selectedUnit() { return state.units.find(u => u.id === selected); }
function renderCatalog() {
  $('available').textContent = `${state.units.filter(u => u.cell === null).length} / 12`;
  $('catalog').innerHTML = Object.entries(SPECIES).map(([key, def]) => `<div class="catalog-group"><div class="catalog-label">${def.name}<span>${state.units.filter(u => u.species === key && u.cell === null).length} из 3</span></div><div class="catalog-units">${state.units.filter(u => u.species === key).map(u => `<button class="catalog-item ${u.id === selected ? 'selected' : ''} ${u.cell !== null ? 'placed' : ''}" data-unit="${u.id}" draggable="true" aria-label="${def.name} ${u.id}${u.cell !== null ? ', на поле' : ', в каталоге'}" aria-pressed="${u.id === selected}">${slime(key)}<small>${u.cell !== null ? 'на поле' : '№ ' + u.id.split('-')[1]}</small></button>`).join('')}</div></div>`).join('');
}
function renderBoard(statuses) {
  $('board').classList.toggle('selecting', !!selected);
  $('board').innerHTML = Array.from({ length: 36 }, (_, cell) => {
    const u = state.units.find(unit => unit.cell === cell);
    const coord = `${'ABCDEF'[cell % 6]}${Math.floor(cell / 6) + 1}`;
    if (!u) return `<button class="cell empty" data-cell="${cell}" aria-label="Клетка ${coord}, свободна"></button>`;
    const s = statuses.get(u.id), d = SPECIES[u.species];
    return `<button class="cell occupied ${u.id === selected ? 'selected' : ''}" data-cell="${cell}" data-unit="${u.id}" data-kind="${s.kind}" draggable="true" aria-label="Клетка ${coord}: ${d.name} ${u.id}. ${s.reason}" aria-pressed="${u.id === selected}"><span class="unit-code">${d.code}·${u.id.split('-')[1]}</span><span class="unit-status ${s.kind}"></span>${slime(u.species)}${u.sides.map((r, side) => `<span class="side side-${side} ${s.edges.some(e => e.side === side) ? 'connected' : ''}" style="--res:${RESONANCES[r].color}" title="${DIRECTIONS[side].name}: ${RESONANCES[r].name}${s.edges.some(e => e.side === side) ? ' — соединён' : ''}">${RESONANCES[r].symbol}</span>`).join('')}${s.stats.cycle ? '<span class="unit-progress"><i></i></span>' : ''}${s.stats.boosted ? '<span class="boost-mark">✧</span>' : ''}</button>`;
  }).join('');
}
function renderInspector(statuses) {
  const u = selectedUnit();
  if (!u) { $('inspector').innerHTML = '<div class="inspector-empty"><span class="empty-art">◎</span>Выберите организм.<br>Здесь появятся его состояние,<br>резонаторы и параметры.</div>'; return; }
  const def = SPECIES[u.species], s = statuses.get(u.id), stats = s.stats;
  $('inspector').innerHTML = `<div class="inspector-top"><div class="specimen"><span class="specimen-id">ОБРАЗЕЦ ${u.id}</span>${slime(u.species)}</div><div class="organism-title"><h3>${def.nickname}</h3><span>ϟ 10</span></div><div class="role-name">${def.name}</div><p class="inspector-desc">${def.description}</p></div><div class="inspector-details"><div id="unit-state" class="status-box ${s.kind}">${s.reason}</div><div class="stats"><div class="stat"><small>ЦИКЛ</small><b id="stat-cycle">${stats.cycle ? stats.cycle + ' секунды' : 'Постоянный эффект'}</b></div><div class="stat"><small>ВЫХОД ЗА ЦИКЛ</small><b id="stat-yield">${stats.output ? `${stats.yield} ${RESOURCES[stats.output].name.toLowerCase()}` : 'Нет продукции'}</b></div><div class="stat"><small>СЫРЬЁ</small><b>${stats.input ? stats.amount + ' ' + RESOURCES[stats.input].name.toLowerCase() : 'Не требуется'}</b></div><div class="stat"><small>ПРОГРЕСС</small><b id="stat-progress"></b></div></div>${def.role === 'crafter' ? `<label class="recipe-label">Рецепт крафтера<select class="recipe-select" id="recipe">${def.recipes.map(r => `<option value="${r}" ${u.recipe === r ? 'selected' : ''}>${RESOURCES[RECIPES[r].input].name} → ${RESOURCES[RECIPES[r].output].name.toLowerCase()}</option>`).join('')}</select></label>` : ''}<div class="rotations"><button class="button subtle" id="rotate-left" aria-label="Повернуть против часовой стрелки">↶ 90°</button><button class="button subtle" id="rotate-right" aria-label="Повернуть по часовой стрелке">↷ 90°</button></div></div><div class="inspector-settings"><div class="divider-label">РЕЗОНАТОРЫ СТОРОН</div><div class="resonator-grid">${DIRECTIONS.map((d, i) => `<label>${['↑','→','↓','←'][i]} ${d.name}<select data-side="${i}" style="--res:${RESONANCES[u.sides[i]].color}" aria-label="Резонанс: ${d.name}">${RESONANCES.map((r, index) => `<option value="${index}" ${u.sides[i] === index ? 'selected' : ''}>${r.symbol} ${r.name}</option>`).join('')}</select></label>`).join('')}</div><button class="button subtle remove-button" id="remove" ${u.cell === null ? 'disabled' : ''}>↗ Вернуть в каталог</button></div>`;
  $('rotate-left').onclick = () => change(() => turn(state, u.id, false));
  $('rotate-right').onclick = () => change(() => turn(state, u.id));
  $('remove').onclick = () => change(() => remove(state, u.id));
  $('recipe')?.addEventListener('change', e => change(() => setRecipe(state, u.id, e.target.value), 'Рецепт изменён. Прогресс крафтера сброшен.'));
  $('inspector').querySelectorAll('[data-side]').forEach(select => select.onchange = e => change(() => setResonance(state, u.id, +select.dataset.side, +e.target.value)));
}
function render() {
  const statuses = evaluate(state);
  renderCatalog(); renderBoard(statuses); renderInspector(statuses);
  const u = selectedUnit();
  $('hint').textContent = u ? `${SPECIES[u.species].name} ${u.id}: нажмите свободную клетку${u.cell !== null ? ' для переноса' : ' для размещения'}.` : 'Выберите организм в каталоге или на поле.';
  $('capacity').value = state.capacity;
  update(statuses);
}
function update(statuses = evaluate(state)) {
  $('warehouse').innerHTML = Object.entries(RESOURCES).map(([key, r]) => `<div class="resource"><span class="resource-icon" style="--resource:${r.color}">${r.symbol}</span><div><span class="resource-name">${r.name}</span><strong data-resource="${key}">${state.stock[key]}</strong><small>/ 9999</small></div></div>`).join('');
  const energy = power(state);
  $('power-value').textContent = `${energy.remaining} / ${energy.capacity}`;
  $('power-caption').textContent = `свободно · занято ${energy.used}`;
  $('power-fill').style.width = `${Math.min(100, energy.used / energy.capacity * 100)}%`;
  $('power-fill').style.background = energy.remaining < 0 ? '#e99374' : '#c2d696';
  $('overload').hidden = energy.remaining >= 0;
  $('clock').textContent = fmtTime(state.elapsed);
  $('pause').textContent = state.paused ? '▶ Продолжить' : 'Ⅱ Пауза';
  document.body.classList.toggle('paused', state.paused);
  $('link-count').textContent = `${[...statuses.values()].reduce((n, s) => n + s.edges.length, 0) / 2} связей`;
  for (const u of state.units) {
    if (u.cell === null) continue;
    const s = statuses.get(u.id), el = $('board').querySelector(`[data-unit="${u.id}"]`);
    if (!el) continue;
    el.dataset.kind = s.kind;
    el.setAttribute('aria-label', `Клетка ${'ABCDEF'[u.cell % 6]}${Math.floor(u.cell / 6) + 1}: ${SPECIES[u.species].name} ${u.id}. ${s.reason}`);
    el.querySelector('.unit-status').className = `unit-status ${s.kind}`;
    const progress = el.querySelector('.unit-progress i');
    if (progress) progress.style.width = `${Math.min(100, u.progress / s.stats.cycle * 100)}%`;
  }
  const u = selectedUnit();
  if (u && $('unit-state')) {
    const s = statuses.get(u.id);
    $('unit-state').className = `status-box ${s.kind}`;
    $('unit-state').textContent = `${s.stats.boosted ? '✧ ' : ''}${s.reason}`;
    $('stat-progress').textContent = s.stats.cycle ? `${u.progress.toFixed(1)} / ${s.stats.cycle} с` : '—';
  }
  $('events').innerHTML = state.log.length ? state.log.slice(0, 4).map(e => `<div class="event"><b>+${e.amount} ${RESOURCES[e.resource].name.toLowerCase()}</b><small>${SPECIES[state.units.find(u => u.id === e.id).species].nickname} ${e.id} · ${fmtTime(e.time)}</small></div>`).join('') : '<span class="event-placeholder">Первые образцы скоро поступят на склад…</span>';
}
$('catalog').onclick = e => { const item = e.target.closest('[data-unit]'); if (item) { selected = item.dataset.unit; render(); } };
$('board').onclick = e => {
  const cell = e.target.closest('[data-cell]'); if (!cell) return;
  if (cell.dataset.unit) { selected = cell.dataset.unit; render(); }
  else if (selected) change(() => place(state, selected, +cell.dataset.cell));
  else $('hint').textContent = 'Сначала выберите организм в каталоге.';
};
document.addEventListener('dragstart', e => {
  const unit = e.target.closest('[data-unit]'); if (!unit) return;
  selected = unit.dataset.unit; e.dataTransfer.setData('text/plain', selected); e.dataTransfer.effectAllowed = 'move';
});
$('board').addEventListener('dragover', e => { const cell = e.target.closest('.cell.empty'); if (cell) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; cell.classList.add('drop-target'); } });
$('board').addEventListener('dragleave', e => e.target.closest('.cell')?.classList.remove('drop-target'));
$('board').addEventListener('drop', e => { e.preventDefault(); const cell = e.target.closest('[data-cell]'); const id = e.dataTransfer.getData('text/plain'); if (cell && state.units.some(u => u.id === id)) { selected = id; change(() => place(state, id, +cell.dataset.cell)); } });
$('pause').onclick = () => change(() => { state.paused = !state.paused; });
$('speed').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; $('speed').textContent = `×${speed}`; };
$('capacity').onchange = e => change(() => { state.capacity = +e.target.value; });
function confirmChange(title, action) { pendingAction = action; $('confirm-title').textContent = title; $('confirmation').showModal(); }
$('cancel-confirm').onclick = () => { pendingAction = null; $('confirmation').close(); };
$('accept-confirm').onclick = () => { $('confirmation').close(); const action = pendingAction; pendingAction = null; if (action) change(action); };
$('demo').onclick = () => confirmChange('Загрузить пример цепочек?', () => { state = demoState(); selected = '2-1'; });
$('clear').onclick = () => confirmChange('Начать с пустого поля?', () => { state = createState(); selected = null; });
$('help').onclick = () => $('guide').showModal();
$('close-help').onclick = $('start-help').onclick = () => $('guide').close();
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'manufacture-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('import').onclick = () => $('file').click();
$('file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  try { if (file.size > 1000000) throw new Error('Файл слишком большой'); const loaded = restore(await file.text()); confirmChange('Загрузить сохранение?', () => { state = loaded; selected = null; }); }
  catch { $('hint').textContent = 'Не удалось загрузить файл: это не сохранение Manufacture.'; }
  e.target.value = '';
};
document.addEventListener('keydown', e => {
  if (e.target.matches('input,select,textarea') || document.querySelector('dialog[open]')) return;
  if (e.code === 'Space') { e.preventDefault(); $('pause').click(); }
  if (e.code === 'Escape') { selected = null; render(); }
  if (e.code === 'KeyR' && selected) { e.preventDefault(); change(() => turn(state, selected, !e.shiftKey)); }
  if (e.code === 'Delete' && selected) { e.preventDefault(); change(() => remove(state, selected)); }
});
document.addEventListener('visibilitychange', () => { lastTime = performance.now(); save(); });
window.addEventListener('pagehide', save);
render();
setInterval(() => {
  const now = performance.now();
  if (!document.hidden && !document.querySelector('dialog[open]')) advance(state, Math.min((now - lastTime) / 1000, 0.25) * speed);
  lastTime = now; update();
  if (now - lastSave > 3000) { save(); lastSave = now; }
}, 100);
