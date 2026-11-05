import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { users } from './schema';

// ตั้งบัญชีที่สมัครแล้วให้เป็นแอดมิน ใช้กับแอดมินคนแรกที่ยังไม่มีใครเปลี่ยนสิทธิ์ให้ได้
// วิธีใช้: pnpm admin:promote อีเมล

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) throw new Error('กรุณาระบุอีเมล เช่น pnpm admin:promote you@example.com');

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle(pool);
    const updated = await db
      .update(users)
      .set({ role: 'admin' })
      .where(eq(users.email, email))
      .returning({ email: users.email });
    console.log(updated.length ? `ตั้ง ${email} เป็นแอดมินแล้ว` : `ไม่พบบัญชี ${email}`);
    if (!updated.length) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
