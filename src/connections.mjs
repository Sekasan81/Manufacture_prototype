export const SIZE = 6;
export const DIRECTIONS = [
  { name: 'Верх', dx: 0, dy: -1, opposite: 2 },
  { name: 'Право', dx: 1, dy: 0, opposite: 3 },
  { name: 'Низ', dx: 0, dy: 1, opposite: 0 },
  { name: 'Лево', dx: -1, dy: 0, opposite: 1 },
];

export function rotate(sides, clockwise = true) {
  return clockwise ? [sides[3], ...sides.slice(0, 3)] : [...sides.slice(1), sides[0]];
}

// Each matched edge is independent; a match never lights other sides.
export function connections(units) {
  const placed = units.filter(unit => unit.cell !== null);
  const cells = new Map(placed.map(unit => [unit.cell, unit]));
  const result = new Map(units.map(unit => [unit.id, []]));
  for (const unit of placed) {
    const x = unit.cell % SIZE;
    const y = Math.floor(unit.cell / SIZE);
    DIRECTIONS.forEach(({ dx, dy, opposite }, side) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) return;
      const neighbor = cells.get(ny * SIZE + nx);
      if (neighbor && unit.sides[side] === neighbor.sides[opposite]) {
        result.get(unit.id).push({ id: neighbor.id, side, opposite });
      }
    });
  }
  return result;
}
