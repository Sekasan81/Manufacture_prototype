export const RESOURCES = {
  iron: { name: 'Железо', symbol: 'Fe', color: '#b8c6c4' },
  steel: { name: 'Сталь', symbol: 'St', color: '#8dabe1' },
  ironIngot: { name: 'Железный слиток', symbol: 'Fe▰', color: '#e1c49b' },
  steelIngot: { name: 'Стальной слиток', symbol: 'St▰', color: '#c8b6e9' },
};
export const RESONANCES = [
  { id: 'sun', name: 'Солнечный', symbol: '●', color: '#e5b04b' },
  { id: 'tide', name: 'Приливный', symbol: '≈', color: '#619ccf' },
  { id: 'spore', name: 'Споровый', symbol: '◆', color: '#bd80bd' },
];
export const RECIPES = {
  iron: { input: 'iron', output: 'ironIngot', amount: 1, yield: 1, cycle: 4 },
  steel: { input: 'steel', output: 'steelIngot', amount: 1, yield: 1, cycle: 4 },
};
export const SPECIES = {
  producer: { name: 'Производитель', nickname: 'Феррик', code: 'П', role: 'producer', color: '#dcac50', power: 10, cycle: 2, output: 'iron', yield: 1, description: 'Выращивает железо. Нужна связь с переработчиком или крафтером.' },
  processor: { name: 'Переработчик', nickname: 'Феррит', code: 'Р', role: 'processor', color: '#7aaabd', power: 10, cycle: 3, input: 'iron', amount: 1, output: 'steel', yield: 1, description: 'Превращает железо в сталь. Нужны одновременно производитель и крафтер.' },
  crafter: { name: 'Крафтер', nickname: 'Формер', code: 'К', role: 'crafter', color: '#b596cb', power: 10, recipes: ['iron', 'steel'], description: 'Формирует слитки. Рецепт должен соответствовать подключённому источнику.' },
  booster: { name: 'Усилитель', nickname: 'Спарк', code: 'У', role: 'booster', color: '#9fbd73', power: 10, effect: 'resonanceBoost', description: 'Усиливает каждого подходящего соседа: +1 выход или −2 секунды у крафтера. Бонусы не складываются.' },
};
export function createUnits() {
  return Object.keys(SPECIES).flatMap((species, group) => Array.from({ length: 3 }, (_, i) => ({
    id: `${group + 1}-${i + 1}`, species, cell: null,
    sides: [i % 3, (i + 1) % 3, (i + 2) % 3, (i + 1) % 3],
    progress: 0, recipe: 'iron', completed: 0,
  })));
}
