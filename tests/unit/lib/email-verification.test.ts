import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { canUseCommunity, isEmailVerificationRequired } = await import('@/lib/email-verification');

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
