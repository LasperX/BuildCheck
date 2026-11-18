import 'server-only';

// การยืนยันอีเมลก่อนใช้ฟีเจอร์ชุมชน (มติ Q4) ต้องส่งอีเมลได้ก่อน ถ้ายังไม่ได้ตั้งค่า Resend บนเว็บจริง
// ผู้สมัครด้วยอีเมลจะยืนยันไม่ได้เลยและติดอยู่แบบนั้น จึงงดการบังคับยืนยันไว้จนกว่าจะตั้งค่าส่งอีเมล
//   - เว็บจริงที่ตั้ง RESEND_API_KEY และ EMAIL_FROM แล้ว: บังคับยืนยันตามเดิม
//   - เว็บจริงที่ยังไม่ได้ตั้ง: ไม่บังคับ (ยังกันสแปมด้วยตัวจำกัดความถี่ทุกจุดเหมือนเดิม)
//   - ตอนพัฒนาและตอนทดสอบ: บังคับเสมอ เพราะระบบแสดงลิงก์ยืนยันในหน้าจอ Terminal ให้กดได้
// หน้าลืมรหัสผ่านใช้เงื่อนไขเดียวกัน ส่งอีเมลไม่ได้ก็แจ้งตามจริงแทนฟอร์ม
// (Better Auth ส่งอีเมลเป็นงานเบื้องหลัง ส่งไม่สำเร็จก็ยังตอบว่าสำเร็จ ผู้ใช้จึงเคยเห็นว่า "ส่งลิงก์แล้ว" ทั้งที่ไม่ได้ส่ง)

export function emailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** ส่งลิงก์ทางอีเมลถึงผู้ใช้ได้ไหม (ตอนพัฒนาและตอนทดสอบ ลิงก์แสดงในหน้าจอ Terminal แทน) */
export function canDeliverEmail(): boolean {
  return emailSendingConfigured() || process.env.NODE_ENV !== 'production';
}

export function isEmailVerificationRequired(): boolean {
  return canDeliverEmail();
}

/** ใช้ฟีเจอร์ชุมชน (โหวต คอมเมนต์ Fork รายงาน) ได้หรือยัง */
export function canUseCommunity(user: { emailVerified: boolean }): boolean {
  return user.emailVerified || !isEmailVerificationRequired();
}
