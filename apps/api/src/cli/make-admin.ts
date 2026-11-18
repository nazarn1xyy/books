import { createDatabase } from '../core/db';
import { UserRepository } from '../modules/auth/user.repository';

const nickname = process.argv[2];
const url = process.env.DATABASE_URL;
if (!nickname || !url) {
  console.error('Usage: DATABASE_URL=... make-admin <nickname>');
  process.exit(1);
}

const { db, close } = createDatabase(url, 1);
try {
  const ok = await new UserRepository(db).setRole(nickname, 'admin');
  console.log(ok ? `User "${nickname}" is now admin` : `User "${nickname}" not found`);
  process.exitCode = ok ? 0 : 2;
} finally {
  await close();
}
