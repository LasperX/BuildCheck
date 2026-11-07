import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { cache } from 'react';

import { auth } from '@/lib/auth';

// จุดเดียวที่อ่าน Session ฝั่งเซิร์ฟเวอร์ (Data Access Layer)
// หน้าเว็บและ Server Action ทุกตัวตรวจสิทธิ์ผ่านไฟล์นี้ ไม่เชื่อค่าที่ส่งมาจากหน้าเว็บ
// cache() ทำให้อ่านฐานข้อมูลครั้งเดียวต่อหนึ่งคำขอ แม้หลายคอมโพเนนต์จะเรียกซ้ำ

// connection(): Session เป็นข้อมูลเฉพาะคำขอ และ Better Auth อ่านเวลาปัจจุบัน (new Date()) ตอนตรวจวันหมดอายุ
// ถ้าไม่บอก Next.js ว่าต้องรอคำขอจริง ตอนสร้างหน้าล่วงหน้าจะฟ้อง "unstable value new Date()"
export const getSession = cache(async () => {
  const requestHeaders = await headers();
  await connection();
  return auth.api.getSession({ headers: requestHeaders });
});

/** สำหรับหน้าเว็บ: ถ้ายังไม่ล็อกอินให้ไปหน้า login */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect('/login');
  return session.user;
}

/** สำหรับหน้าเว็บฝั่งแอดมิน: ถ้าไม่ใช่แอดมินให้กลับหน้าแรก */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

export type ActionResult = { ok: true } | { ok: false; error: string };

// ตัวตรวจสิทธิ์สำหรับ Server Action: คืนข้อความแทนการ redirect เพื่อให้ฟอร์มแสดงผลได้
// สิทธิ์ตามตาราง 2.4 และมติ Q4

export async function authorizeMember() {
  const session = await getSession();
  if (!session) return { ok: false as const, error: 'กรุณาเข้าสู่ระบบก่อน' };
  return { ok: true as const, user: session.user };
}

/** โหวต คอมเมนต์ Fork รายงานเนื้อหา และรายงานราคา ต้องยืนยันอีเมลก่อน (มติ Q4) */
export async function authorizeVerifiedMember() {
  const result = await authorizeMember();
  if (!result.ok) return result;
  if (!result.user.emailVerified) {
    return { ok: false as const, error: 'กรุณายืนยันอีเมลก่อนใช้งานฟีเจอร์ชุมชน' };
  }
  return result;
}

export async function authorizeAdmin() {
  const result = await authorizeMember();
  if (!result.ok) return result;
  if (result.user.role !== 'admin') return { ok: false as const, error: 'ไม่มีสิทธิ์ทำรายการนี้' };
  return result;
}
