const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const ID_LENGTH = 10;

/**
 * รหัสสเปกแบบสุ่ม 10 ตัว ใช้เป็นทั้ง Primary Key และลิงก์แชร์
 * ตัดตัวที่สับสนง่าย (0/O, 1/l/I) ออก เหลือ 56 ตัว จึงมีรหัสได้ 56^10 ≈ 3 × 10^17 แบบ เดาไม่ได้
 * ใช้ crypto.getRandomValues และทิ้งค่าที่เกิน 224 (56 × 4) เพื่อให้ทุกตัวอักษรมีโอกาสเท่ากัน
 */
export function newBuildId(): string {
  let id = '';
  while (id.length < ID_LENGTH) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < ALPHABET.length * 4 && id.length < ID_LENGTH)
        id += ALPHABET[byte % ALPHABET.length];
    }
  }
  return id;
}
