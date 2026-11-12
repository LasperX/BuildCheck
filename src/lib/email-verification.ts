import 'server-only';

// การยืนยันอีเมลก่อนใช้ฟีเจอร์ชุมชน (มติ Q4) ต้องส่งอีเมลได้ก่อน ถ้ายังไม่ได้ตั้งค่า Resend บนเว็บจริง
// ผู้สมัครด้วยอีเมลจะยืนยันไม่ได้เลยและติดอยู่แบบนั้น จึงงดการบังคับยืนยันไว้จนกว่าจะตั้งค่าส่งอีเมล
//   - เว็บจริงที่ตั้ง RESEND_API_KEY และ EMAIL_FROM แล้ว: บังคับยืนยันตามเดิม
//   - เว็บจริงที่ยังไม่ได้ตั้ง: ไม่บังคับ (ยังกันสแปมด้วยตัวจำกัดความถี่ทุกจุดเหมือนเดิม)
//   - ตอนพัฒนาและตอนทดสอบ: บังคับเสมอ เพราะระบบแสดงลิงก์ยืนยันในหน้าจอ Terminal ให้กดได้

export function emailSendingConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function isEmailVerificationRequired(): boolean {
  return emailSendingConfigured() || process.env.NODE_ENV !== 'production';
}

/** ใช้ฟีเจอร์ชุมชน (โหวต คอมเมนต์ Fork รายงาน) ได้หรือยัง */
export function canUseCommunity(user: { emailVerified: boolean }): boolean {
  return user.emailVerified || !isEmailVerificationRequired();
}
