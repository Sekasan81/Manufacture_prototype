export function resonanceBoost(stats, role) {
  if (role === 'producer' || role === 'processor') return { ...stats, yield: stats.yield + 1 };
  if (role === 'crafter') return { ...stats, cycle: Math.max(0.1, stats.cycle - 2) };
  return stats;
}
export const EFFECTS = { resonanceBoost };
