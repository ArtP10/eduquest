export function rankPlayersByClimbProgress<T extends { climbProgress: number }>(
  players: T[]
): T[] {
  return [...players].sort((a, b) => b.climbProgress - a.climbProgress);
}
