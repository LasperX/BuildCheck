// สร้าง ER Diagram (Mermaid) จาก Schema ของ Drizzle โดยตรง ไดอะแกรมจึงตรงกับฐานข้อมูลจริงทุกคอลัมน์
// วิธีใช้: pnpm docs:er → เขียนไฟล์ docs/diagrams/er-overview.mmd และ er-<กลุ่ม>.mmd
// แก้ Schema แล้วรันคำสั่งนี้ใหม่ ไม่ต้องวาดเอง

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';

import * as schema from '../src/db/schema';

type Column = ReturnType<typeof getTableConfig>['columns'][number];

// เลือกเฉพาะตาราง (ไฟล์ schema export ทั้ง enum และ relations ด้วย)
const tables: PgTable[] = (Object.values(schema) as unknown[]).filter((value): value is PgTable =>
  is(value, PgTable),
);

// กลุ่มตามหัวข้อ 6 ของเอกสาร ใช้แบ่งไดอะแกรมย่อยให้อ่านง่ายในรูปเล่ม
const GROUPS: Record<string, string[]> = {
  users: ['users', 'accounts', 'sessions', 'verifications'],
  parts: [
    'categories',
    'brands',
    'parts',
    'part_price_history',
    'cpu_specs',
    'motherboard_specs',
    'ram_specs',
    'gpu_specs',
    'storage_specs',
    'psu_specs',
    'case_specs',
    'cooler_specs',
  ],
  builds: ['builds', 'build_items', 'build_votes', 'comments', 'favorites', 'users', 'parts'],
  system: ['notifications', 'reports', 'settings', 'admin_logs', 'rate_limits', 'users'],
  used: [
    'part_used_prices',
    'used_price_reports',
    'part_used_stats',
    'price_alerts',
    'parts',
    'users',
  ],
};

function typeOf(column: Column): string {
  const raw = column
    .getSQLType()
    .replace(/\(.*\)/, '')
    .replace(/\s+/g, '_');
  return column.dataType === 'array' ? `${raw}_array` : raw;
}

function entity(table: PgTable, compact: boolean): string {
  const config = getTableConfig(table);
  const fkColumns = new Set(
    config.foreignKeys.flatMap((fk) => fk.reference().columns.map((c) => c.name)),
  );
  const pkColumns = new Set([
    ...config.columns.filter((c) => c.primary).map((c) => c.name),
    ...config.primaryKeys.flatMap((pk) => pk.columns.map((c) => c.name)),
  ]);
  const columns = compact
    ? config.columns.filter((c) => pkColumns.has(c.name) || fkColumns.has(c.name))
    : config.columns;
  const lines = columns.map((column) => {
    const keys = [pkColumns.has(column.name) ? 'PK' : '', fkColumns.has(column.name) ? 'FK' : '']
      .filter(Boolean)
      .join(',');
    return `    ${typeOf(column)} ${column.name}${keys ? ` ${keys}` : ''}`;
  });
  return `  ${config.name} {\n${lines.join('\n')}\n  }`;
}

function relations(include: Set<string>): string[] {
  const lines: string[] = [];
  for (const table of tables) {
    const config = getTableConfig(table);
    if (!include.has(config.name)) continue;
    for (const fk of config.foreignKeys) {
      const ref = fk.reference();
      const target = getTableConfig(ref.foreignTable).name;
      if (!include.has(target)) continue;
      const column = ref.columns[0];
      // คอลัมน์ FK ที่เป็น PK ด้วย (ตารางสเปก 1:1 กับ parts) = หนึ่งต่อหนึ่ง นอกนั้นหนึ่งต่อหลาย
      const oneToOne =
        ref.columns.length === 1 &&
        column !== undefined &&
        (column.primary ||
          config.primaryKeys.some(
            (pk) => pk.columns.length === 1 && pk.columns[0]?.name === column.name,
          ));
      const optional = column !== undefined && !column.notNull;
      const left = optional ? '|o' : '||';
      const right = oneToOne ? 'o|' : 'o{';
      lines.push(
        `  ${target} ${left}--${right} ${config.name} : "${ref.columns.map((c) => c.name).join(', ')}"`,
      );
    }
  }
  return lines;
}

function diagram(names: string[] | null, compactNames: Set<string> = new Set()): string {
  const include = new Set(names ?? tables.map((t) => getTableConfig(t).name));
  const entities = tables
    .filter((t) => include.has(getTableConfig(t).name))
    .map((t) => entity(t, compactNames.has(getTableConfig(t).name)));
  return ['erDiagram', ...entities, ...relations(include), ''].join('\n');
}

const outDir = path.join(process.cwd(), 'docs', 'diagrams');
mkdirSync(outDir, { recursive: true });

// ภาพรวมทุกตาราง แสดงเฉพาะ PK/FK (ทั้งหมดแสดงคอลัมน์ครบจะใหญ่เกินหน้ากระดาษ)
const all = tables.map((t) => getTableConfig(t).name);
writeFileSync(path.join(outDir, 'er-overview.mmd'), diagram(all, new Set(all)));

for (const [group, names] of Object.entries(GROUPS)) {
  // ตารางจากกลุ่มอื่นที่ดึงมาให้เห็นความสัมพันธ์ แสดงแค่ PK/FK
  const own = new Set(
    names.filter(
      (name) =>
        !(group !== 'users' && name === 'users') && !(group !== 'parts' && name === 'parts'),
    ),
  );
  const borrowed = new Set(names.filter((name) => !own.has(name)));
  writeFileSync(path.join(outDir, `er-${group}.mmd`), diagram(names, borrowed));
}

console.log(`เขียน ER Diagram ${tables.length} ตาราง ลง ${outDir}`);
