// วางรูปจาก clipboard (Ctrl+V) ในหน้าหลังบ้าน เช่นคัดลอกรูปจากเว็บผู้ผลิตแล้ววางในช่องรูปของอะไหล่
// ฟังก์ชันล้วน ไม่แตะ DOM เอง จึงทดสอบได้โดยไม่ต้องมีเบราว์เซอร์

type ClipboardItemLike = { kind: string; type: string; getAsFile(): File | null };

/** ข้อมูลที่วาง: DataTransfer จากเหตุการณ์ paste หรืออะไรก็ได้ที่มี items/files แบบเดียวกัน */
export type ClipboardLike = {
  items?: ArrayLike<ClipboardItemLike> | null;
  files?: ArrayLike<File> | null;
};

/** รูปแรกในสิ่งที่วาง (คัดลอกรูปจากเว็บหรือจับภาพหน้าจอ) ถ้าไม่มีรูปคืน null */
export function clipboardImage(data: ClipboardLike | null | undefined): File | null {
  if (!data) return null;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return Array.from(data.files ?? []).find((file) => file.type.startsWith('image/')) ?? null;
}

/** กำลังพิมพ์อยู่ในช่องกรอกไหม ถ้าใช่ ให้การวางเป็นการวางข้อความตามปกติ ไม่ใช่การวางรูป */
export function isTypingTarget(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  if (element.isContentEditable === true) return true;
  return (
    typeof element.tagName === 'string' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
  );
}
