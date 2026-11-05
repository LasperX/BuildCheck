# BuildCheck

เว็บไซต์จัดสเปกคอมพิวเตอร์พร้อมระบบตรวจสอบความเข้ากันได้ของอุปกรณ์ (โปรเจคจบ ปวส.2)

- สเปกโปรเจค: [docs/spec.md](docs/spec.md)
- มติและจุดที่แก้จากสเปก: [docs/spec-review.md](docs/spec-review.md) (มีผลเหนือสเปกในจุดที่ระบุ)
- งานออกแบบเฟส 0: [design/README.md](design/README.md)

## เครื่องมือที่ต้องมี

- Node.js 24 LTS
- pnpm 12 ขึ้นไป (`npm i -g pnpm`)
- Docker Desktop สำหรับ PostgreSQL ในเครื่อง

## เริ่มใช้งาน

```bash
pnpm install
```

คัดลอกไฟล์ค่าตั้งค่า แล้วแก้รหัสผ่านใน `.env` ทั้ง `POSTGRES_PASSWORD` และใน `DATABASE_URL` ให้ตรงกัน

```bash
cp .env.example .env
```

เปิดฐานข้อมูล (ต้องเปิด Docker Desktop ก่อน)

```bash
pnpm db:up
```

สร้างตารางและใส่ข้อมูลตั้งต้น (ทำครั้งแรก และทุกครั้งที่มี Migration ใหม่) แล้วตรวจผล

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

```bash
pnpm db:verify
```

เปิดเว็บ (ปกติอยู่ที่ <http://localhost:3000> ถ้าพอร์ตไม่ว่างดูพอร์ตจริงในหน้าจอ Terminal)

```bash
pnpm dev
```

## คำสั่ง

| คำสั่ง             | ใช้ทำอะไร                                   |
| ------------------ | ------------------------------------------- |
| `pnpm dev`         | เปิดเว็บสำหรับพัฒนา                         |
| `pnpm build`       | สร้างเว็บสำหรับใช้งานจริง                   |
| `pnpm check`       | ตรวจ ESLint, Prettier และ TypeScript รวมกัน |
| `pnpm lint:fix`    | แก้ปัญหา ESLint ที่แก้อัตโนมัติได้          |
| `pnpm format`      | จัดรูปแบบโค้ดด้วย Prettier                  |
| `pnpm db:up`       | เปิด PostgreSQL และรอจนพร้อมใช้             |
| `pnpm db:down`     | ปิด PostgreSQL (ข้อมูลยังอยู่)              |
| `pnpm db:logs`     | ดู Log ของ PostgreSQL                       |
| `pnpm db:generate` | สร้างไฟล์ Migration หลังแก้ Schema          |
| `pnpm db:migrate`  | รัน Migration ที่ยังไม่เคยรัน               |
| `pnpm db:seed`     | ใส่หมวดและยี่ห้อตั้งต้น รันซ้ำได้           |
| `pnpm db:verify`   | ตรวจตาราง Index ข้อจำกัด และ Trigger        |
| `pnpm db:studio`   | เปิดหน้าเว็บดูข้อมูลในฐานข้อมูล             |

## โครงสร้างหลัก

ตามหัวข้อ 8.2 ของสเปก

```text
src/
  app/          หน้าเว็บ แยกเป็น (public) (auth) me admin api
  components/   ui = shadcn/ui, builder, parts, community, admin
  lib/compat/   Compatibility Engine ฟังก์ชันล้วน ไม่แตะฐานข้อมูล
  lib/validators/  Zod schema
  server/       actions = Server Actions, queries = คำสั่งอ่านข้อมูล
  db/           schema, migrations, seed
  stores/       Zustand
tests/          unit/compat, e2e
```

## ค่าออกแบบ

สีทุกค่าอยู่ใน `src/app/globals.css` ชื่อตรงกับ Variable ใน Figma เรียกใช้ผ่าน class เช่น `bg-surface`, `text-err-fg`, `border-ok-border`

- สีสถานะ (`err`, `warn`, `ok`, `info`) ใช้คู่กับไอคอนเสมอ
- สีม่วง (`used`) ใช้กับเรื่องมือสองเท่านั้น
- ปรับ shadcn/ui ใน `src/components/ui` ให้ตรงขนาดใน Design System แล้ว ถ้าสั่ง `shadcn add --overwrite` ทับ ต้องปรับใหม่
