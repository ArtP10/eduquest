const BASE_CORRECT_POINTS = 100;
const PLACEMENT_TABLE = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export function scoreAnswer({ isCorrect, remainingMs, totalMs }) {
    if (!isCorrect)
        return { correctness: 0, speed: 0 };
    const speed = Math.round(BASE_CORRECT_POINTS * (remainingMs / totalMs));
    return { correctness: BASE_CORRECT_POINTS, speed };
}
export function placementBonusForRank(rankIndex) {
    // Beyond the table, extend with 0 (matches README's "...0" tail).
    return rankIndex < PLACEMENT_TABLE.length ? PLACEMENT_TABLE[rankIndex] : 0;
}
export function rankPlayersByClimbProgress(players) {
    return [...players].sort((a, b) => b.climbProgress - a.climbProgress);
}
//# sourceMappingURL=scoring.js.map