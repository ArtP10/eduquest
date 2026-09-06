import { getPool } from '../db.js';

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  createdAt: Date;
}

export interface PublicUser {
  id: string;
  username: string;
  email: string;
}

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  created_at: Date;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    googleId: row.google_id,
    createdAt: row.created_at
  };
}

export function toPublicUser(user: User): PublicUser {
  return { id: user.id, username: user.username, email: user.email };
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE google_id = $1', [googleId]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await getPool().query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

export async function createUserWithPassword(params: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<User> {
  const { rows } = await getPool().query<UserRow>(
    `INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *`,
    [params.username, params.email, params.passwordHash]
  );
  return rowToUser(rows[0]!);
}

export async function createUserWithGoogle(params: {
  username: string;
  email: string;
  googleId: string;
}): Promise<User> {
  const { rows } = await getPool().query<UserRow>(
    `INSERT INTO users (username, email, google_id) VALUES ($1, $2, $3) RETURNING *`,
    [params.username, params.email, params.googleId]
  );
  return rowToUser(rows[0]!);
}
