import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { saveBuild, shareBuild } from '@/server/actions/builds';
import { listCommunityBuilds } from '@/server/queries/community';

import { actAs, cleanupAccounts, createAccount, partsByCategory, type TestAccount } from './helpers';

// หน้าชุมชน: กรองสเปกที่มีอะไหล่มือสอง และนับจำนวนชิ้นมือสองบนการ์ด

let owner: TestAccount;
let usedBuildId = '';
let newBuildId = '';

const meta = { description: '', usageType: 'gaming' as const, budget: 30000 };

beforeAll(async () => {
  owner = await createAccount();
  const { pick } = await partsByCategory();
  // ใช้รุ่นที่มีขายมือหนึ่ง สภาพจะตรงกับที่ส่งไปจริง (รุ่นที่มีแต่มือสองถูกนับเป็นมือสองเสมอ)
  const cpu = pick('cpu').find((part) => part.availability !== 'used_only');
  const board = pick('motherboard').find((part) => part.availability !== 'used_only');
  if (!cpu || !board) throw new Error('อะไหล่ตัวอย่างไม่พอ');

  actAs(owner);
  const used = await saveBuild({
    ...meta,
    title: 'ทดสอบสเปกมือสอง',
    items: [
      { partId: cpu.id, quantity: 1, condition: 'B' },
      { partId: board.id, quantity: 1, condition: 'new' },
    ],
  });
  const fresh = await saveBuild({
    ...meta,
    title: 'ทดสอบสเปกมือหนึ่ง',
    items: [
      { partId: cpu.id, quantity: 1, condition: 'new' },
      { partId: board.id, quantity: 1, condition: 'new' },
    ],
  });
  if (!used.ok || !fresh.ok) throw new Error('บันทึกสเปกทดสอบไม่สำเร็จ');
  usedBuildId = used.id;
  newBuildId = fresh.id;
  expect((await shareBuild(usedBuildId, 'public')).ok).toBe(true);
  expect((await shareBuild(newBuildId, 'public')).ok).toBe(true);
});

afterAll(async () => {
  await cleanupAccounts();
});

describe('listCommunityBuilds ตัวกรองสภาพอะไหล่', () => {
  it('มีอะไหล่มือสอง: เห็นสเปกที่มีชิ้นมือสอง ไม่เห็นสเปกมือหนึ่งทั้งชุด และนับชิ้นถูก', async () => {
    const { items } = await listCommunityBuilds({ tab: 'new', condition: 'used', page: 1 });
    const used = items.find((build) => build.id === usedBuildId);
    expect(used).toBeDefined();
    expect(used?.usedCount).toBe(1);
    expect(used?.itemCount).toBe(2);
    expect(items.some((build) => build.id === newBuildId)).toBe(false);
  });

  it('มือหนึ่งทั้งชุด: กลับกัน', async () => {
    const { items } = await listCommunityBuilds({ tab: 'new', condition: 'new', page: 1 });
    expect(items.some((build) => build.id === newBuildId)).toBe(true);
    expect(items.some((build) => build.id === usedBuildId)).toBe(false);
  });

  it('ไม่ระบุสภาพ: เห็นทั้งสองชุด', async () => {
    const { items } = await listCommunityBuilds({ tab: 'new', page: 1 });
    const ids = items.map((build) => build.id);
    expect(ids).toContain(usedBuildId);
    expect(ids).toContain(newBuildId);
  });
});
