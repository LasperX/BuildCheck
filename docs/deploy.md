# คู่มือ Deploy ขึ้น Vercel + Neon

ขั้นตอนนี้ต้องใช้บัญชีของเจ้าของโปรเจคเอง (Vercel, Neon, GitHub, Resend, Google Cloud, ที่เก็บรูป) จึงยังไม่ได้ทำให้ ทุกขั้นทำผ่านเว็บของผู้ให้บริการ และไม่ต้องแก้โค้ด

## 1. ฐานข้อมูล Neon

1. สร้างโปรเจคที่ <https://neon.tech> เลือก PostgreSQL เวอร์ชันเดียวกับในเครื่อง (18) และ Region ที่ใกล้ไทยที่สุด (Singapore)
2. คัดลอก Connection string แบบ **pooled** (มี `-pooler` ในชื่อโฮสต์) และต่อท้ายด้วย `?sslmode=require`
3. รัน Migration และ seed จากเครื่องตัวเอง โดยชี้ไปที่ Neon ชั่วคราว (ไม่ต้องแก้ไฟล์ `.env`):

```bash
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" pnpm db:migrate
```

```bash
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" pnpm db:seed
```

4. ถ้าต้องการอะไหล่ตัวอย่างสำหรับสาธิต รัน `pnpm db:seed:samples` แบบเดียวกัน (ข้อมูลตัวอย่างเป็นค่า "รอตรวจสอบ" ไม่ใช่สเปกจริง)

## 2. บริการที่ต้องตั้งก่อนเปิดใช้จริง

| บริการ | ใช้ทำอะไร | ถ้าไม่ตั้ง |
|---|---|---|
| Resend (`RESEND_API_KEY`, `EMAIL_FROM`) | อีเมลยืนยันบัญชีและรีเซ็ตรหัสผ่าน | สมัครได้ แต่ยืนยันอีเมลไม่ได้ จึงโหวต คอมเมนต์ Fork และรายงานราคาไม่ได้ (มติ Q4) และ Log ขึ้น "ยังไม่ได้ตั้งค่า RESEND_API_KEY" |
| Google OAuth (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | ปุ่มเข้าสู่ระบบด้วย Google | ระบบซ่อนปุ่ม Google |
| ที่เก็บรูปแบบ S3 (`STORAGE_*`) | รูปอะไหล่ รูปโปรไฟล์ รูปหลักฐานราคามือสอง | อัปโหลดรูปไม่ได้บน Production (ในเครื่องเก็บใน `public/uploads`) |

Google OAuth ต้องเพิ่ม Redirect URI เป็น `https://<โดเมน>/api/auth/callback/google`

## 3. Vercel

1. Push โค้ดขึ้น GitHub แล้ว Import Repository ที่ <https://vercel.com/new> (Framework: Next.js ตรวจให้อัตโนมัติ)
2. ตั้ง Environment Variables (Production) ตาม `.env.example`:

| ตัวแปร | ค่า |
|---|---|
| `DATABASE_URL` | Connection string ของ Neon จากข้อ 1 |
| `BETTER_AUTH_SECRET` | สุ่มใหม่ด้วย `openssl rand -base64 32` (อย่าใช้ค่าเดียวกับในเครื่อง) |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | `https://<โดเมน>` |
| `CRON_SECRET` | สุ่มใหม่ ยาวอย่างน้อย 16 ตัว Vercel ส่งค่านี้ให้ Cron เอง |
| `RESEND_API_KEY`, `EMAIL_FROM`, `GOOGLE_*`, `STORAGE_*` | ตามข้อ 2 |

3. Deploy แล้วตั้งแอดมินคนแรก (สมัครบนเว็บก่อน):

```bash
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" pnpm admin:promote <อีเมล>
```

4. Cron คำนวณราคากลางมือสองทุกคืน ตั้งไว้แล้วใน `vercel.json` (`/api/cron/used-stats` ตี 2 เวลาไทย) ดูผลได้ที่แท็บ Cron Jobs ของโปรเจคใน Vercel และตรวจขีดจำกัดจำนวน Cron ของแพ็กเกจที่ใช้
5. เซิร์ฟเวอร์ตั้งไว้ที่สิงคโปร์ (`"regions": ["sin1"]` ใน `vercel.json`) ให้อยู่ที่เดียวกับฐานข้อมูล Neon ถ้าเลือก Region ของ Neon เป็นที่อื่น ให้แก้ค่านี้ให้ตรงกัน ไม่เช่นนั้นทุกคำสั่งฐานข้อมูลจะข้ามทวีปและหน้าเว็บช้าลงมาก

## 4. ตรวจหลัง Deploy

- [ ] เปิดหน้าแรก จัดสเปก จัดตามงบ คลังอะไหล่ ได้ไม่มี Error
- [ ] Response มี Header `Content-Security-Policy` และ `Strict-Transport-Security` (เปิดเฉพาะบน Vercel)
- [ ] สมัคร → ได้อีเมลยืนยัน → ยืนยันแล้วคอมเมนต์ได้
- [ ] เปิดสองเบราว์เซอร์ คอมเมนต์สเปกของอีกบัญชี กระดิ่งขึ้นภายในไม่กี่วินาที (SSE บน Vercel)
- [ ] Lighthouse บนมือถือจริงหรือ PageSpeed Insights ทุกหมวดไม่ต่ำกว่า 90 (หัวข้อ 9.2)
- [ ] รัน E2E กับเว็บจริง (ต้องชี้ `DATABASE_URL` ไปที่ Neon เพราะเทสต์ยืนยันอีเมลบัญชีทดสอบในฐานข้อมูลโดยตรง และลบบัญชี `e2e…@example.test` หลังจบ):

```bash
E2E_BASE_URL="https://<โดเมน>" DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" pnpm test:e2e
```

- [ ] ตั้งสำรองข้อมูลอัตโนมัติรายวันใน Neon (หัวข้อ 9.2) และ export ก่อนวันสอบ:

```bash
pg_dump "postgresql://...neon.tech/neondb?sslmode=require" > buildcheck-backup.sql
```

## แผนสำรองวันสอบ (หัวข้อ 10.4)

รันในเครื่องได้เสมอด้วยฐานข้อมูล Docker: `pnpm db:up` → `pnpm build` → `pnpm start -p 3100` แล้วเปิด <http://localhost:3100>

## อัปเดตโครงสร้างฐานข้อมูล (เมื่อมี Migration ใหม่)

ทุกครั้งที่มีไฟล์ใหม่ใน `src/db/migrations` ให้รัน Migration กับ Neon **ก่อน** push โค้ดขึ้น GitHub (Vercel จะ Deploy ทันทีที่ push) ใช้ Connection string แบบไม่ pooling:

```bash
$env:DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=verify-full"
```
```bash
pnpm.cmd db:migrate
```
```bash
Remove-Item Env:DATABASE_URL
```

Migration ที่เพิ่มคอลัมน์ใหม่ในโปรเจคนี้มีค่าเริ่มต้นเสมอ โค้ดเวอร์ชันเดิมบนเว็บจริงจึงยังทำงานได้ระหว่างรอ Deploy
