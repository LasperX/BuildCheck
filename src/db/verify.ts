import { Client } from 'pg';

// ตรวจฐานข้อมูลของจริงว่าตรงกับหัวข้อ 6: จำนวนตาราง, Index, ข้อมูลตั้งต้น, ข้อจำกัด และ Trigger
// ส่วนที่ต้องเขียนข้อมูลทำใน Transaction แล้ว ROLLBACK จึงไม่ทิ้งข้อมูลทดสอบไว้ในฐานข้อมูล
// วิธีใช้: pnpm db:verify

const EXPECTED_TABLES = [
  // 6.1
  'users',
  'accounts',
  'sessions',
  'verifications',
  // 6.2
  'categories',
  'brands',
  'parts',
  'part_price_history',
  // 6.3
  'cpu_specs',
  'motherboard_specs',
  'ram_specs',
  'gpu_specs',
  'storage_specs',
  'psu_specs',
  'case_specs',
  'cooler_specs',
  // 6.4
  'builds',
  'build_items',
  'build_votes',
  'comments',
  'favorites',
  // 6.5
  'notifications',
  'reports',
  'settings',
  'admin_logs',
  'rate_limits', // มติเฟส 3
  // 6.8
  'part_used_prices',
  'used_price_reports',
  'part_used_stats',
  'price_alerts',
];

// Index ตามหัวข้อ 6.7 และ 6.8: ชื่อ -> ข้อความที่ต้องมีในคำสั่งสร้าง Index
const EXPECTED_INDEXES: Record<string, string> = {
  parts_category_active_price_idx: '(category_id, is_active, price)',
  parts_search_vector_idx: 'USING gin (search_vector)',
  cpu_specs_socket_idx: '(socket)',
  motherboard_specs_socket_idx: '(socket)',
  ram_specs_type_idx: '(type)',
  builds_visibility_votes_idx: '(visibility, vote_score DESC)',
  builds_visibility_created_idx: '(visibility, created_at DESC)',
  notifications_user_read_idx: '(user_id, read_at)',
  used_price_reports_calc_idx: '(part_id, grade, status, seen_at)',
};

let failures = 0;
function report(ok: boolean, label: string, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'ผ่าน' : 'ไม่ผ่าน'}  ${label}${detail ? ` (${detail})` : ''}`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('ไม่พบ DATABASE_URL ใน .env');

  const client = new Client({ connectionString });
  await client.connect();

  // คำสั่งที่ต้องถูกฐานข้อมูลปฏิเสธ ใช้ SAVEPOINT เพื่อให้ Transaction ทำงานต่อได้หลัง Error
  const mustFail = async (label: string, sql: string, params: unknown[] = []) => {
    await client.query('SAVEPOINT attempt');
    try {
      await client.query(sql, params);
      report(false, label, 'ฐานข้อมูลยอมรับคำสั่งที่ควรถูกปฏิเสธ');
    } catch {
      report(true, label);
    }
    await client.query('ROLLBACK TO SAVEPOINT attempt');
  };

  try {
    const version = await client.query<{ server_version: string }>('SHOW server_version');
    const serverVersion = version.rows[0]?.server_version ?? '';
    report(serverVersion.startsWith('18'), 'PostgreSQL รุ่น 18', serverVersion);

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    );
    const names = tables.rows.map((r) => r.table_name);
    const missing = EXPECTED_TABLES.filter((t) => !names.includes(t));
    const extra = names.filter((t) => !EXPECTED_TABLES.includes(t));
    report(
      names.length === EXPECTED_TABLES.length && missing.length === 0,
      `มีครบ ${EXPECTED_TABLES.length} ตาราง`,
      `พบ ${names.length}`,
    );
    if (missing.length) report(false, 'ตารางที่ขาด', missing.join(', '));
    if (extra.length) report(false, 'ตารางเกิน', extra.join(', '));

    const indexes = await client.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public'`,
    );
    for (const [name, fragment] of Object.entries(EXPECTED_INDEXES)) {
      const def = indexes.rows.find((r) => r.indexname === name)?.indexdef ?? '';
      report(def.includes(fragment), `Index ${name}`, fragment);
    }

    const seeded = await client.query<{ categories: string; brands: string }>(
      `SELECT (SELECT count(*) FROM categories) AS categories,
              (SELECT count(*) FROM brands) AS brands`,
    );
    report(seeded.rows[0]?.categories === '8', 'Seed หมวดครบ 8', seeded.rows[0]?.categories);
    report(Number(seeded.rows[0]?.brands) > 0, 'Seed ยี่ห้อ', seeded.rows[0]?.brands);

    await client.query('BEGIN');

    // คำสั่งของหน้าชุมชนต้องเรียงจาก Index ได้เลย ไม่ต้องมีขั้นตอน Sort เพิ่ม
    // ปิด seqscan ชั่วคราว เพราะตารางว่างฐานข้อมูลจะเลือกอ่านทั้งตารางเสมอ
    await client.query('SET LOCAL enable_seqscan = off');
    for (const [column, indexName] of [
      ['vote_score', 'builds_visibility_votes_idx'],
      ['created_at', 'builds_visibility_created_idx'],
    ] as const) {
      const plan = await client.query<{ 'QUERY PLAN': string }>(
        `EXPLAIN SELECT id FROM builds WHERE visibility = 'public' ORDER BY ${column} DESC LIMIT 20`,
      );
      const text = plan.rows.map((r) => r['QUERY PLAN']).join('\n');
      report(
        text.includes(indexName) && !text.includes('Sort'),
        `หน้าชุมชนเรียงตาม ${column} จาก Index ได้`,
      );
    }
    await client.query('SET LOCAL enable_seqscan = on');

    await client.query(
      `INSERT INTO users (id, email, display_name) VALUES ('t-user', 't@example.test', 'ทดสอบ')`,
    );
    const category = await client.query<{ id: number }>(
      `INSERT INTO categories (slug, name_th, name_en, icon, sort_order)
       VALUES ('t-cat', 'ทดสอบ', 'Test', 'cpu', 99) RETURNING id`,
    );
    const brand = await client.query<{ id: number }>(
      `INSERT INTO brands (name) VALUES ('ยี่ห้อทดสอบ') RETURNING id`,
    );
    const categoryId = category.rows[0]?.id;
    const brandId = brand.rows[0]?.id;
    const part = await client.query<{ id: number; search_vector: string }>(
      `INSERT INTO parts (category_id, brand_id, model, slug, price)
       VALUES ($1, $2, 'TestModel X1', 't-slug', 100) RETURNING id, search_vector`,
      [categoryId, brandId],
    );
    const partId = part.rows[0]?.id;
    const vector = part.rows[0]?.search_vector ?? '';
    report(
      vector.includes('testmodel') && vector.includes('ยี่ห้อทดสอบ'),
      'Trigger เติม search_vector จากยี่ห้อและรุ่น',
      vector,
    );

    await client.query(`UPDATE brands SET name = 'renamedbrand' WHERE id = $1`, [brandId]);
    const renamed = await client.query<{ search_vector: string }>(
      `SELECT search_vector FROM parts WHERE id = $1`,
      [partId],
    );
    report(
      (renamed.rows[0]?.search_vector ?? '').includes('renamedbrand'),
      'แก้ชื่อยี่ห้อแล้ว search_vector ตาม',
    );

    const found = await client.query(
      `SELECT id FROM parts WHERE search_vector @@ to_tsquery('simple', 'testmod:*') AND id = $1`,
      [partId],
    );
    report(found.rowCount === 1, 'ค้นหาด้วยคำขึ้นต้นเจออะไหล่');

    await client.query(
      `INSERT INTO builds (id, user_id, title, usage_type) VALUES ('t-build', 't-user', 'ทดสอบ', 'gaming')`,
    );
    await client.query(
      `INSERT INTO build_items (build_id, part_id, price_at_add) VALUES ('t-build', $1, 100)`,
      [partId],
    );
    await client.query(
      `INSERT INTO build_votes (build_id, user_id, value) VALUES ('t-build', 't-user', 1)`,
    );
    await client.query(
      `INSERT INTO comments (build_id, user_id, body) VALUES ('t-build', 't-user', 'ทดสอบ')`,
    );

    const defaults = await client.query<{ condition: string; quantity: number }>(
      `SELECT condition, quantity FROM build_items WHERE build_id = 't-build'`,
    );
    report(
      defaults.rows[0]?.condition === 'new' && defaults.rows[0]?.quantity === 1,
      'build_items ค่าเริ่มต้นเป็นของใหม่ จำนวน 1',
    );

    await mustFail(
      'build_votes ห้ามโหวตซ้ำคนเดิม',
      `INSERT INTO build_votes (build_id, user_id, value) VALUES ('t-build', 't-user', -1)`,
    );
    await mustFail(
      'build_votes รับเฉพาะ +1 หรือ -1',
      `UPDATE build_votes SET value = 5 WHERE build_id = 't-build'`,
    );
    await mustFail(
      'users ห้ามอีเมลซ้ำ',
      `INSERT INTO users (id, email, display_name) VALUES ('t-2', 't@example.test', 'ซ้ำ')`,
    );
    await mustFail(
      'cpu_specs คะแนนต้องอยู่ใน 0–100',
      `INSERT INTO cpu_specs (part_id, socket, generation, cores, threads, tdp_watt, memory_types, perf_score)
       VALUES ($1, 'S', 'G', 1, 1, 1, '{DDR5}', 101)`,
      [partId],
    );
    await mustFail(
      'cooler_specs ซิงก์ลมต้องมีความสูง',
      `INSERT INTO cooler_specs (part_id, type, supported_sockets, max_tdp_watt)
       VALUES ($1, 'air', '{S}', 100)`,
      [partId],
    );
    await mustFail('build_items ห้ามลบอะไหล่ที่มีคนใช้', `DELETE FROM parts WHERE id = $1`, [
      partId,
    ]);
    await mustFail('ห้ามลบหมวดที่ยังมีอะไหล่', `DELETE FROM categories WHERE id = $1`, [
      categoryId,
    ]);

    await client.query(`DELETE FROM users WHERE id = 't-user'`);
    const leftover = await client.query<{ n: string }>(
      `SELECT (SELECT count(*) FROM builds WHERE id = 't-build')
            + (SELECT count(*) FROM build_items WHERE build_id = 't-build')
            + (SELECT count(*) FROM comments WHERE build_id = 't-build') AS n`,
    );
    report(leftover.rows[0]?.n === '0', 'ลบบัญชีแล้วสเปก อะไหล่ในสเปก คอมเมนต์ ลบตาม');
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    await client.end();
  }

  console.log(failures === 0 ? '\nผ่านทุกข้อ' : `\nไม่ผ่าน ${failures} ข้อ`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
