import { SIZE, connections, rotate } from './connections.mjs';
import { SPECIES, RESOURCES, RECIPES, createUnits } from './data.mjs';
import { EFFECTS } from './effects.mjs';
export const LIMIT = 9999;
export const STEP = 0.05;
export function createState() {
  return { version: 1, units: createUnits(), stock: Object.fromEntries(Object.keys(RESOURCES).map(key => [key, 0])), capacity: 100, paused: false, elapsed: 0, remainder: 0, log: [] };
}
export function power(state) {
  const used = state.units.filter(u => u.cell !== null).reduce((sum, u) => sum + SPECIES[u.species].power, 0);
  return { used, capacity: state.capacity, remaining: state.capacity - used };
}
export function statsFor(unit, neighbors) {
  const def = SPECIES[unit.species];
  let stats = { ...def, ...(def.role === 'crafter' ? RECIPES[unit.recipe] : {}) };
  const effects = new Set(neighbors.filter(u => SPECIES[u.species].role === 'booster').map(u => SPECIES[u.species].effect));
  for (const effect of effects) if (EFFECTS[effect]) stats = EFFECTS[effect](stats, def.role);
  return { ...stats, boosted: effects.size > 0 && def.role !== 'booster' };
}
export function evaluate(state) {
  const links = connections(state.units), energy = power(state);
  const map = new Map(state.units.map(unit => [unit.id, unit]));
  const result = new Map();
  for (const unit of state.units) {
    const edges = links.get(unit.id);
    const neighbors = edges.map(edge => map.get(edge.id));
    const stats = statsFor(unit, neighbors);
    const compatibleSource = neighbors.some(n => ['producer', 'processor'].includes(SPECIES[n.species].role) && SPECIES[n.species].output === stats.input);
    let reason = '', kind = 'active';
    if (unit.cell === null) { kind = 'reserve'; reason = 'В каталоге'; }
    else if (energy.remaining < 0) { kind = 'power'; reason = 'Перегрузка генератора'; }
    else if (state.paused) { kind = 'paused'; reason = 'Общая пауза'; }
    else if (stats.role === 'producer' && !neighbors.some(n => {
      const other = SPECIES[n.species];
      return (other.role === 'processor' && other.input === stats.output) || (other.role === 'crafter' && other.recipes.some(r => RECIPES[r].input === stats.output));
    })) { kind = 'disconnected'; reason = 'Нужен переработчик или крафтер'; }
    else if (stats.role === 'processor' && !neighbors.some(n => SPECIES[n.species].role === 'producer' && SPECIES[n.species].output === stats.input)) { kind = 'disconnected'; reason = 'Нет связи с производителем'; }
    else if (stats.role === 'processor' && !neighbors.some(n => SPECIES[n.species].role === 'crafter' && SPECIES[n.species].recipes.some(r => RECIPES[r].input === stats.output))) { kind = 'disconnected'; reason = 'Нет связи с крафтером'; }
    else if (stats.role === 'crafter' && !compatibleSource) { kind = 'recipe'; reason = 'Нет источника для выбранного рецепта'; }
    else if (stats.role === 'booster' && !neighbors.some(n => SPECIES[n.species].role !== 'booster')) { kind = 'disconnected'; reason = 'Нет соседа для усиления'; }
    else if (stats.input && state.stock[stats.input] < stats.amount) { kind = 'waiting'; reason = `Ждёт: ${RESOURCES[stats.input].name.toLowerCase()}`; }
    else reason = stats.role === 'booster' ? 'Усиливает соседей' : 'Производство';
    result.set(unit.id, { kind, reason, stats, edges, neighbors, active: kind === 'active' });
  }
  return result;
}
export function advance(state, seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0 || state.paused) return;
  // Fixed simulation steps make speed and frame rate independent of contention order.
  state.remainder += seconds;
  const count = Math.floor((state.remainder + 1e-9) / STEP);
  state.remainder = Math.max(0, state.remainder - count * STEP);
  const ordered = [...state.units].sort((a, b) => a.id.localeCompare(b.id));
  for (let tick = 0; tick < count; tick++) {
    state.elapsed += STEP;
    if (power(state).remaining < 0) continue;
    const statuses = evaluate(state);
    for (const unit of ordered) {
      const status = statuses.get(unit.id), stats = status.stats;
      if (!status.active || !stats.cycle || !stats.output) continue;
      // Inputs remain in the shared store until completion, never in a private buffer.
      if (stats.input && state.stock[stats.input] < stats.amount) continue;
      unit.progress += STEP;
      if (unit.progress + 1e-9 < stats.cycle) continue;
      if (stats.input) state.stock[stats.input] -= stats.amount;
      state.stock[stats.output] = Math.min(LIMIT, state.stock[stats.output] + stats.yield);
      unit.progress = 0;
      unit.completed++;
      state.log.unshift({ time: state.elapsed, id: unit.id, resource: stats.output, amount: stats.yield });
      state.log.length = Math.min(state.log.length, 24);
    }
  }
}
export function place(state, id, cell) {
  const unit = state.units.find(u => u.id === id);
  if (!unit || !Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || state.units.some(u => u.id !== id && u.cell === cell)) return false;
  unit.cell = cell; return true;
}
export function remove(state, id) { const unit = state.units.find(u => u.id === id); if (unit) unit.cell = null; }
export function turn(state, id, clockwise = true) { const unit = state.units.find(u => u.id === id); if (unit) unit.sides = rotate(unit.sides, clockwise); }
export function setResonance(state, id, side, resonance) {
  const unit = state.units.find(u => u.id === id);
  if (unit && Number.isInteger(side) && side >= 0 && side < 4 && Number.isInteger(resonance) && resonance >= 0 && resonance < 3) unit.sides[side] = resonance;
}
export function setRecipe(state, id, recipe) {
  const unit = state.units.find(u => u.id === id);
  if (!unit || !SPECIES[unit.species].recipes?.includes(recipe)) return false;
  if (unit.recipe !== recipe) { unit.recipe = recipe; unit.progress = 0; }
  return true;
}
export function demoState() {
  const state = createState();
  const positions = { '1-1': 13, '2-1': 14, '3-1': 15, '4-1': 8, '1-2': 25, '3-2': 26 };
  for (const unit of state.units) if (positions[unit.id] !== undefined) {
    unit.cell = positions[unit.id]; unit.sides = [0, 1, 2, 1];
  }
  state.units.find(u => u.id === '4-1').sides[2] = 0;
  state.units.find(u => u.id === '3-1').recipe = 'steel';
  return state;
}
export function restore(text) {
  const saved = JSON.parse(text), clean = createState();
  if (saved.version !== 1 || !Array.isArray(saved.units) || saved.units.length !== 12) throw new Error('Неподдерживаемое сохранение');
  const cells = new Set(), ids = new Set();
  for (const unit of clean.units) {
    const source = saved.units.find(u => u.id === unit.id);
    if (!source || ids.has(source.id) || source.species !== unit.species || !Array.isArray(source.sides) || source.sides.length !== 4 || source.sides.some(s => !Number.isInteger(s) || s < 0 || s > 2)) throw new Error('Некорректный слизень');
    if (source.cell !== null && (!Number.isInteger(source.cell) || source.cell < 0 || source.cell > 35 || cells.has(source.cell))) throw new Error('Некорректная клетка');
    ids.add(source.id); if (source.cell !== null) cells.add(source.cell);
    unit.cell = source.cell; unit.sides = [...source.sides];
    unit.recipe = RECIPES[source.recipe] ? source.recipe : 'iron';
    unit.progress = Number.isFinite(source.progress) ? Math.max(0, Math.min(4, source.progress)) : 0;
    unit.completed = Number.isSafeInteger(source.completed) ? Math.max(0, source.completed) : 0;
  }
  for (const key of Object.keys(RESOURCES)) clean.stock[key] = Number.isFinite(saved.stock?.[key]) ? Math.max(0, Math.min(LIMIT, Math.floor(saved.stock[key]))) : 0;
  clean.capacity = [60, 80, 100, 120, 150].includes(saved.capacity) ? saved.capacity : 100;
  clean.elapsed = Number.isFinite(saved.elapsed) ? Math.max(0, saved.elapsed) : 0;
  clean.paused = saved.paused === true;
  return clean;
}
