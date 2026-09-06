/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()')
    },
    username: {
      type: 'text',
      notNull: true,
      unique: true
    },
    email: {
      type: 'text',
      notNull: true,
      unique: true
    },
    // Null for Google-only accounts (no password set).
    password_hash: {
      type: 'text',
      notNull: false
    },
    // Null for email/password-only accounts.
    google_id: {
      type: 'text',
      notNull: false,
      unique: true
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('now()')
    }
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropTable('users');
};
