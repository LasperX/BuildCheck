'use client';

import { useEffect, useRef, useState } from 'react';

// ตัวช่วยอนิเมชั่นฝั่งหน้าเว็บ เคารพการตั้งค่า "ลดการเคลื่อนไหว" ของผู้ใช้เสมอ

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * ตัวเลขค่อยๆ วิ่งจากค่าเดิมไปค่าใหม่ (ราคารวม วัตต์) ภายใน duration มิลลิวินาที
 * ครั้งแรกแสดงค่าจริงทันที ไม่วิ่งจาก 0 เพื่อไม่ให้หน้าเว็บดูกระพริบตอนเปิด
 */
export function useAnimatedNumber(value: number, duration = 500): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const start = from.current;
    if (start === value || prefersReducedMotion()) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const next = start + (value - start) * eased;
      from.current = next;
      setShown(k < 1 ? next : value);
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, duration]);

  return shown;
}

/**
 * คืนตัวนับที่เพิ่มขึ้นทุกครั้งที่ค่าเปลี่ยน (ไม่นับครั้งแรก) ใช้เป็น key ให้อนิเมชั่น CSS เล่นใหม่
 * เช่น ตัวเลขจำนวนชิ้นเด้งทุกครั้งที่เพิ่มอะไหล่ แต่ไม่เด้งตอนเปิดหน้า
 */
export function useChangeKey(value: unknown): number {
  const [key, setKey] = useState(0);
  const previous = useRef(value);
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setKey((k) => k + 1);
  }, [value]);
  return key;
}
