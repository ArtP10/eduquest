/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.addColumn('match_players', {
    // The player's climb height (Room.players[].climbProgress) at match end
    // — this, not final_score, is what actually decided final_placement
    // (see rankPlayersByClimbProgress in server/src/scoring.ts): two players
    // can tie on score but still rank differently by height. Nullable
    // because it wasn't captured for matches recorded before this column
    // existed.
    final_height: {
      type: 'real'
    }
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn('match_players', 'final_height');
};
