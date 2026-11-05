import { adminClient, usernameClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

// ตัวเรียก API ล็อกอินจากฝั่งหน้าเว็บ ใช้ URL เดียวกับเว็บที่เปิดอยู่
export const authClient = createAuthClient({
  plugins: [usernameClient(), adminClient()],
});

// แปลงรหัสข้อผิดพลาดของ Better Auth เป็นภาษาไทย
const THAI_ERRORS: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  USER_ALREADY_EXISTS: 'อีเมลนี้ถูกใช้สมัครแล้ว',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'อีเมลนี้ถูกใช้สมัครแล้ว',
  USERNAME_IS_ALREADY_TAKEN: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว',
  USERNAME_TOO_SHORT: 'ชื่อผู้ใช้สั้นเกินไป',
  USERNAME_TOO_LONG: 'ชื่อผู้ใช้ยาวเกินไป',
  INVALID_USERNAME: 'ชื่อผู้ใช้ไม่ถูกต้อง',
  INVALID_PASSWORD: 'รหัสผ่านไม่ถูกต้อง',
  PASSWORD_TOO_SHORT: 'รหัสผ่านสั้นเกินไป',
  INVALID_TOKEN: 'ลิงก์ไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอลิงก์ใหม่',
  SESSION_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้งก่อนทำรายการนี้',
  CREDENTIAL_ACCOUNT_NOT_FOUND: 'บัญชีนี้ไม่มีรหัสผ่าน เพราะสมัครด้วย Google',
};

type AuthError = { code?: string | undefined; message?: string | undefined; status?: number };

export function authErrorMessage(error: AuthError | null | undefined): string {
  if (!error) return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  if (error.code && THAI_ERRORS[error.code]) return THAI_ERRORS[error.code] ?? '';
  // ข้อความจากกฎตรวจของเราเป็นภาษาไทยอยู่แล้ว
  if (error.message && /[฀-๿]/.test(error.message)) return error.message;
  if (error.status === 429) return 'ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่';
  return 'เกิดข้อผิดพลาด กรุณาลองใหม่';
}
