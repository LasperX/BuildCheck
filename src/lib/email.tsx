import 'server-only';

import { Resend } from 'resend';

import { ActionEmail } from '@/emails/action-email';

type LinkEmail = { to: string; url: string };

async function send(to: string, subject: string, react: React.ReactElement, devLink: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // ตอนพัฒนายังไม่ต้องมีบัญชี Resend แสดงลิงก์ในหน้าจอ Terminal แทน
    if (process.env.NODE_ENV !== 'production') {
      console.info(`[อีเมลจำลอง] ถึง ${to} | ${subject} | ${devLink}`);
      return;
    }
    throw new Error('ยังไม่ได้ตั้งค่า RESEND_API_KEY หรือ EMAIL_FROM');
  }

  const { error } = await new Resend(apiKey).emails.send({ from, to, subject, react });
  if (error) throw new Error(`ส่งอีเมลไม่สำเร็จ: ${error.message}`);
}

export function sendVerificationEmail({ to, url }: LinkEmail) {
  return send(
    to,
    'ยืนยันอีเมลของคุณ · BuildCheck',
    <ActionEmail
      preview="กดยืนยันอีเมลเพื่อเริ่มใช้ชุมชน BuildCheck"
      title="ยืนยันอีเมลของคุณ"
      body="กดปุ่มด้านล่างเพื่อยืนยันอีเมล จากนั้นคุณจะโหวต คอมเมนต์ และ Fork สเปกในชุมชนได้"
      actionLabel="ยืนยันอีเมล"
      actionUrl={url}
      note="ถ้าคุณไม่ได้สมัครสมาชิก BuildCheck ไม่ต้องทำอะไร"
    />,
    url,
  );
}

export function sendResetPasswordEmail({ to, url }: LinkEmail) {
  return send(
    to,
    'ตั้งรหัสผ่านใหม่ · BuildCheck',
    <ActionEmail
      preview="ลิงก์ตั้งรหัสผ่านใหม่ หมดอายุใน 1 ชั่วโมง"
      title="ตั้งรหัสผ่านใหม่"
      body="เราได้รับคำขอเปลี่ยนรหัสผ่านของบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่"
      actionLabel="ตั้งรหัสผ่านใหม่"
      actionUrl={url}
      note="ลิงก์นี้หมดอายุใน 1 ชั่วโมง ถ้าคุณไม่ได้ขอเปลี่ยนรหัสผ่าน ไม่ต้องทำอะไร รหัสเดิมยังใช้ได้"
    />,
    url,
  );
}
