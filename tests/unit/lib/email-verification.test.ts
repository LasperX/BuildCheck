import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { canDeliverEmail, canUseCommunity, isEmailVerificationRequired } =
  await import('@/lib/email-verification');

const unverified = { emailVerified: false };
const verified = { emailVerified: true };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('การบังคับยืนยันอีเมลก่อนใช้ฟีเจอร์ชุมชน', () => {
  it('เว็บจริงที่ยังไม่ได้ตั้งระบบส่งอีเมล: ไม่บังคับ ผู้สมัครด้วยอีเมลใช้ได้ทันที', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    expect(isEmailVerificationRequired()).toBe(false);
    expect(canUseCommunity(unverified)).toBe(true);
  });

  it('เว็บจริงที่ตั้งระบบส่งอีเมลแล้ว: บังคับยืนยันตามเดิม', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'BuildCheck <noreply@example.test>');
    expect(isEmailVerificationRequired()).toBe(true);
    expect(canUseCommunity(unverified)).toBe(false);
    expect(canUseCommunity(verified)).toBe(true);
  });

  it('ตอนพัฒนาและทดสอบ: บังคับเสมอ เพราะกดลิงก์ยืนยันจากหน้าจอ Terminal ได้', () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('RESEND_API_KEY', '');
    expect(isEmailVerificationRequired()).toBe(true);
    expect(canUseCommunity(unverified)).toBe(false);
  });
});

// หน้าลืมรหัสผ่านแสดงฟอร์มเฉพาะเมื่อส่งลิงก์ถึงผู้ใช้ได้จริง
describe('ส่งลิงก์ทางอีเมลได้ไหม (หน้าลืมรหัสผ่าน)', () => {
  it('เว็บจริงที่ยังไม่ได้ตั้งระบบส่งอีเมล: ส่งไม่ได้', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    expect(canDeliverEmail()).toBe(false);
  });

  it('เว็บจริงที่ตั้งไว้ไม่ครบ (มี API key แต่ไม่มีอีเมลผู้ส่ง): ส่งไม่ได้', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', '');
    expect(canDeliverEmail()).toBe(false);
  });

  it('เว็บจริงที่ตั้งครบแล้ว: ส่งได้', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('RESEND_API_KEY', 'test-key');
    vi.stubEnv('EMAIL_FROM', 'BuildCheck <noreply@example.test>');
    expect(canDeliverEmail()).toBe(true);
  });

  it('ตอนพัฒนาและทดสอบ: ส่งได้ เพราะลิงก์แสดงในหน้าจอ Terminal', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('EMAIL_FROM', '');
    expect(canDeliverEmail()).toBe(true);
  });
});
