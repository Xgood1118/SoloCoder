import bcrypt from 'bcryptjs';

const DEFAULT_ROUNDS = Number(process.env.BCRYPT_ROUNDS || 12);

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, DEFAULT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
