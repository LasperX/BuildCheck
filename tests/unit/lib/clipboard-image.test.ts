import { describe, expect, it } from 'vitest';

import { clipboardImage, isTypingTarget } from '@/lib/clipboard-image';

// วางรูปจาก clipboard ในหลังบ้าน: หยิบรูปจากสิ่งที่วาง และไม่แย่งการวางข้อความในช่องกรอก

const png = new File([new Uint8Array([137, 80, 78, 71])], 'image.png', { type: 'image/png' });
const text = new File(['hello'], 'note.txt', { type: 'text/plain' });
const item = (file: File | null, kind = 'file') => ({
  kind,
  type: file?.type ?? 'text/plain',
  getAsFile: () => file,
});

describe('clipboardImage', () => {
  it('หยิบรูปแรกจากรายการที่วาง (คัดลอกรูปจากเว็บ) ข้ามข้อความและไฟล์ที่ไม่ใช่รูป', () => {
    expect(clipboardImage({ items: [item(null, 'string'), item(text), item(png)] })).toBe(png);
  });

  it('เบราว์เซอร์ที่ให้มาแค่ files ก็ยังหยิบรูปได้', () => {
    expect(clipboardImage({ items: [], files: [text, png] })).toBe(png);
  });

  it('ไม่มีรูปหรือไม่มีข้อมูลเลย คืน null', () => {
    expect(clipboardImage({ items: [item(null, 'string')], files: [text] })).toBeNull();
    expect(clipboardImage(null)).toBeNull();
    expect(clipboardImage(undefined)).toBeNull();
  });
});

describe('isTypingTarget', () => {
  it('ช่องกรอกข้อความและช่องที่แก้ข้อความได้ ถือว่ากำลังพิมพ์ ให้วางข้อความตามปกติ', () => {
    expect(isTypingTarget({ tagName: 'INPUT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'TEXTAREA' })).toBe(true);
    expect(isTypingTarget({ tagName: 'SELECT' })).toBe(true);
    expect(isTypingTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it('ปุ่ม ช่องรูป และตัวหน้าเว็บ ไม่ใช่ช่องกรอก วางรูปได้', () => {
    expect(isTypingTarget({ tagName: 'BUTTON', isContentEditable: false })).toBe(false);
    expect(isTypingTarget({ tagName: 'BODY' })).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
