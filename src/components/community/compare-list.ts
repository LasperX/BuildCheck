'use client';

import { MAX_COMPARE } from '@/lib/validators/community';

// รายการสเปกที่เลือกไว้เทียบ เก็บในเครื่องของผู้ใช้ (เปิดหน้าเทียบจากหลายหน้าได้โดยไม่ต้องล็อกอิน)

const KEY = 'buildcheck-compare';

export function readCompare(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function writeCompare(ids: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ids.slice(0, MAX_COMPARE)));
  } catch {
    // โหมดส่วนตัวบางเบราว์เซอร์เขียนไม่ได้ ใช้ได้เฉพาะจาก URL
  }
}

/** เพิ่มสเปกเข้ารายการเทียบ ถ้าเต็ม 3 ชุดแล้วจะแทนชุดที่เก่าที่สุด */
export function addToCompare(id: string): string[] {
  const list = [...readCompare().filter((item) => item !== id), id].slice(-MAX_COMPARE);
  writeCompare(list);
  return list;
}
