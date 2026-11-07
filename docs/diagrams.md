# ไดอะแกรมสำหรับรูปเล่ม (บทที่ 3)

ไฟล์นี้สร้างด้วย `pnpm docs:diagrams` อย่าแก้ไฟล์นี้โดยตรง ให้แก้ไฟล์ `.mmd` ใน `docs/diagrams` แล้วรันใหม่

**นำไปใส่รูปเล่ม:** เปิดไฟล์นี้บน GitHub (แสดงเป็นรูปให้เอง) หรือคัดลอกโค้ดของแต่ละไดอะแกรมไปวางที่ <https://mermaid.live> แล้วกด Export เป็น PNG หรือ SVG

## Use Case Diagram

ผู้ใช้ 3 ระดับและสิ่งที่ทำได้ ตามตารางสิทธิ์หัวข้อ 2.4 · ไฟล์ต้นฉบับ `docs/diagrams/use-case.mmd`

```mermaid
%% Use Case Diagram (หัวข้อ 2.4) Mermaid ไม่มีรูปแบบ Use Case จึงใช้ flowchart แทน: วงกลม = Use Case
flowchart LR
  guest([ผู้เยี่ยมชม])
  member([สมาชิก])
  admin([แอดมิน])
  member -. สืบทอดสิทธิ์ .-> guest
  admin -. สืบทอดสิทธิ์ .-> member

  subgraph BuildCheck
    direction TB
    uc1((ดูคลังอะไหล่))
    uc2((จัดสเปกและดูผลตรวจ))
    uc3((จัดสเปกตามงบ))
    uc4((เทียบสเปก))
    uc5((ดูสเปกสาธารณะ / ตลาดมือสอง))
    uc6((สมัคร / เข้าสู่ระบบ))
    uc7((บันทึก แชร์ ตั้งสาธารณะ))
    uc8((โหวต คอมเมนต์ รายการโปรด))
    uc9((Fork สเปก))
    uc10((รายงานเนื้อหา / รายงานราคามือสอง))
    uc11((รับแจ้งเตือน / ตั้งเตือนราคา))
    uc12((จัดการอะไหล่ / นำเข้า CSV))
    uc13((ตั้งค่ากฎและสัดส่วนงบ))
    uc14((จัดการผู้ใช้และรายงาน))
    uc15((อนุมัติราคามือสอง))
    uc16((ดู Dashboard และบันทึกการทำงาน))
  end

  guest --- uc1 & uc2 & uc3 & uc4 & uc5 & uc6
  member --- uc7 & uc8 & uc9 & uc10 & uc11
  admin --- uc12 & uc13 & uc14 & uc15 & uc16
```

## ผังเว็บไซต์

ทุกหน้าในหัวข้อ 5.1, 5.2 และ 5.4 สีบอกสิทธิ์การเข้าถึง · ไฟล์ต้นฉบับ `docs/diagrams/sitemap.mmd`

```mermaid
%% ผังเว็บไซต์ (หัวข้อ 5.1, 5.2, 5.4) สีบอกสิทธิ์: น้ำเงิน = ทุกคน · เขียว = สมาชิก · ส้ม = แอดมิน
flowchart TB
  home["หน้าแรก /"]
  home --> builder["จัดสเปก /builder"]
  home --> budget["จัดตามงบ /budget"]
  home --> parts["คลังอะไหล่ /parts"]
  parts --> partCat["หมวด /parts/[หมวด]"] --> partDetail["รายละเอียด /parts/[หมวด]/[slug]"]
  home --> used["ตลาดมือสอง /used"]
  used --> usedReport["รายงานราคา /used/report"]
  home --> builds["ชุมชน /builds"] --> buildDetail["รายละเอียดสเปก /builds/[id]"]
  buildDetail --> profile["โปรไฟล์ /u/[username]"]
  home --> compare["เทียบสเปก /compare"]
  home --> guide["คู่มือ /guide"]
  home --> about["เกี่ยวกับ /about"]
  home --> privacy["นโยบาย /privacy"]
  home --> auth["สมัคร / เข้าสู่ระบบ / ลืมรหัส"]

  home --> me["บัญชีของฉัน /me"]
  me --> meBuilds["สเปกของฉัน /me/builds"]
  me --> meFav["รายการโปรด /me/favorites"]
  me --> meNoti["การแจ้งเตือน /me/notifications"]
  me --> meAlerts["เตือนราคา /me/price-alerts"]
  me --> meSettings["ตั้งค่าบัญชี /me/settings"]

  home --> adminHome["Dashboard /admin"]
  adminHome --> aParts["จัดการอะไหล่ /admin/parts"] --> aPartForm["เพิ่ม/แก้ /admin/parts/new, [id]"]
  aParts --> aImport["นำเข้า CSV /admin/parts/import"]
  adminHome --> aUsed["ราคามือสอง /admin/used-prices"]
  adminHome --> aUsers["ผู้ใช้ /admin/users"]
  adminHome --> aReports["รายงาน /admin/reports"]
  adminHome --> aSettings["ตั้งค่าระบบ /admin/settings"]
  adminHome --> aLogs["บันทึกการทำงาน /admin/logs"]

  classDef all fill:#e8eefc,stroke:#2753d6,color:#0f1a3d
  classDef member fill:#e6f6ee,stroke:#0f7a4a,color:#0b3d26
  classDef admin fill:#fdf0e6,stroke:#b5530e,color:#4a2206
  class home,builder,budget,parts,partCat,partDetail,used,builds,buildDetail,profile,compare,guide,about,privacy,auth all
  class usedReport,me,meBuilds,meFav,meNoti,meAlerts,meSettings member
  class adminHome,aParts,aPartForm,aImport,aUsed,aUsers,aReports,aSettings,aLogs admin
```

## สถาปัตยกรรมระบบ

ส่วนประกอบและการเชื่อมต่อตามหัวข้อ 7 · ไฟล์ต้นฉบับ `docs/diagrams/architecture.mmd`

```mermaid
%% สถาปัตยกรรมระบบ (หัวข้อ 7, 8.1)
flowchart LR
  subgraph Browser["เบราว์เซอร์"]
    ui["หน้าเว็บ React<br/>(Next.js App Router)"]
    store["Zustand<br/>สเปกที่กำลังจัด<br/>(localStorage)"]
    engineC["Compatibility Engine<br/>(ฟังก์ชันล้วน)"]
    ui <--> store --> engineC --> ui
  end
  subgraph Vercel["Vercel (Next.js 16)"]
    rsc["Server Components<br/>+ แคช use cache"]
    actions["Server Actions<br/>ตรวจสิทธิ์ + Zod"]
    engineS["Compatibility Engine<br/>(โค้ดชุดเดียวกัน ตรวจซ้ำ)"]
    api["Route Handlers<br/>/api/auth · /api/notifications/stream (SSE)<br/>/api/og · /api/cron/used-stats"]
    auth["Better Auth"]
    actions --> engineS
  end
  db[("PostgreSQL 18<br/>Neon / Docker<br/>30 ตาราง (Drizzle)")]
  mail["Resend<br/>อีเมล"]
  s3["ที่เก็บรูป S3"]
  google["Google OAuth"]
  cron["Vercel Cron<br/>ทุกคืน 02:00"]

  ui -- "หน้าเว็บ / RSC" --> rsc
  ui -- "บันทึก โหวต คอมเมนต์" --> actions
  ui -- "EventSource" --> api
  rsc --> db
  actions --> db
  api --> db
  auth --> db
  api --> auth
  auth --> mail
  auth --> google
  actions --> s3
  cron --> api
```

## ER Diagram ภาพรวม 30 ตาราง

สร้างจาก Schema ของ Drizzle อัตโนมัติ แสดงเฉพาะ PK และ FK · ไฟล์ต้นฉบับ `docs/diagrams/er-overview.mmd`

```mermaid
erDiagram
  accounts {
    text id PK
    text user_id FK
  }
  sessions {
    text id PK
    text user_id FK
  }
  users {
    text id PK
  }
  verifications {
    text id PK
  }
  brands {
    serial id PK
  }
  categories {
    serial id PK
  }
  part_price_history {
    serial id PK
    integer part_id FK
    text changed_by FK
  }
  parts {
    serial id PK
    integer category_id FK
    integer brand_id FK
  }
  case_specs {
    integer part_id PK,FK
  }
  cooler_specs {
    integer part_id PK,FK
  }
  cpu_specs {
    integer part_id PK,FK
  }
  gpu_specs {
    integer part_id PK,FK
  }
  motherboard_specs {
    integer part_id PK,FK
  }
  psu_specs {
    integer part_id PK,FK
  }
  ram_specs {
    integer part_id PK,FK
  }
  storage_specs {
    integer part_id PK,FK
  }
  build_items {
    serial id PK
    text build_id FK
    integer part_id FK
  }
  build_votes {
    text build_id PK,FK
    text user_id PK,FK
  }
  builds {
    text id PK
    text user_id FK
    text forked_from_id FK
  }
  comments {
    serial id PK
    text build_id FK
    text user_id FK
    integer parent_id FK
  }
  favorites {
    text user_id PK,FK
    text build_id PK,FK
  }
  admin_logs {
    bigserial id PK
    text admin_id FK
  }
  notifications {
    serial id PK
    text user_id FK
    text actor_id FK
    text build_id FK
  }
  rate_limits {
    varchar key PK
  }
  reports {
    serial id PK
    text reporter_id FK
    text resolved_by FK
  }
  settings {
    varchar key PK
    text updated_by FK
  }
  part_used_prices {
    serial id PK
    integer part_id FK
    text updated_by FK
  }
  part_used_stats {
    integer part_id PK,FK
    used_grade grade PK
  }
  price_alerts {
    serial id PK
    text user_id FK
    integer part_id FK
  }
  used_price_reports {
    serial id PK
    integer part_id FK
    text user_id FK
    text reviewed_by FK
  }
  users ||--o{ accounts : "user_id"
  users ||--o{ sessions : "user_id"
  parts ||--o{ part_price_history : "part_id"
  users |o--o{ part_price_history : "changed_by"
  categories ||--o{ parts : "category_id"
  brands ||--o{ parts : "brand_id"
  parts ||--o| case_specs : "part_id"
  parts ||--o| cooler_specs : "part_id"
  parts ||--o| cpu_specs : "part_id"
  parts ||--o| gpu_specs : "part_id"
  parts ||--o| motherboard_specs : "part_id"
  parts ||--o| psu_specs : "part_id"
  parts ||--o| ram_specs : "part_id"
  parts ||--o| storage_specs : "part_id"
  builds ||--o{ build_items : "build_id"
  parts ||--o{ build_items : "part_id"
  builds ||--o{ build_votes : "build_id"
  users ||--o{ build_votes : "user_id"
  users ||--o{ builds : "user_id"
  builds |o--o{ builds : "forked_from_id"
  builds ||--o{ comments : "build_id"
  users ||--o{ comments : "user_id"
  comments |o--o{ comments : "parent_id"
  users ||--o{ favorites : "user_id"
  builds ||--o{ favorites : "build_id"
  users |o--o{ admin_logs : "admin_id"
  users ||--o{ notifications : "user_id"
  users |o--o{ notifications : "actor_id"
  builds |o--o{ notifications : "build_id"
  users |o--o{ reports : "reporter_id"
  users |o--o{ reports : "resolved_by"
  users |o--o{ settings : "updated_by"
  parts ||--o{ part_used_prices : "part_id"
  users |o--o{ part_used_prices : "updated_by"
  parts ||--o{ part_used_stats : "part_id"
  users ||--o{ price_alerts : "user_id"
  parts ||--o{ price_alerts : "part_id"
  parts ||--o{ used_price_reports : "part_id"
  users |o--o{ used_price_reports : "user_id"
  users |o--o{ used_price_reports : "reviewed_by"
```

## ER Diagram กลุ่มผู้ใช้

หัวข้อ 6.1 · ไฟล์ต้นฉบับ `docs/diagrams/er-users.mmd`

```mermaid
erDiagram
  accounts {
    text id PK
    text user_id FK
    varchar provider_id
    text account_id
    text password_hash
    text access_token
    text refresh_token
    text id_token
    timestamp_with_time_zone access_token_expires_at
    timestamp_with_time_zone refresh_token_expires_at
    text scope
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  sessions {
    text id PK
    text user_id FK
    text token
    timestamp_with_time_zone expires_at
    text ip_address
    text user_agent
    text impersonated_by
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  users {
    text id PK
    varchar email
    boolean email_verified
    varchar username
    varchar display_username
    varchar display_name
    text image
    varchar bio
    user_role role
    boolean banned
    text ban_reason
    timestamp_with_time_zone ban_expires
    jsonb muted_notifications
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  verifications {
    text id PK
    text identifier
    text value
    timestamp_with_time_zone expires_at
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  users ||--o{ accounts : "user_id"
  users ||--o{ sessions : "user_id"
```

## ER Diagram กลุ่มอะไหล่และสเปก

หัวข้อ 6.2–6.3 ตารางสเปกแต่ละหมวดสัมพันธ์ 1:1 กับ parts · ไฟล์ต้นฉบับ `docs/diagrams/er-parts.mmd`

```mermaid
erDiagram
  brands {
    serial id PK
    varchar name
    text logo_url
  }
  categories {
    serial id PK
    varchar slug
    varchar name_th
    varchar name_en
    varchar icon
    integer sort_order
    boolean required
    boolean allow_multiple
  }
  part_price_history {
    serial id PK
    integer part_id FK
    numeric price
    text changed_by FK
    timestamp_with_time_zone changed_at
  }
  parts {
    serial id PK
    integer category_id FK
    integer brand_id FK
    varchar model
    varchar slug
    numeric price
    integer power_watt
    text image_url
    smallint release_year
    boolean is_active
    text spec_source_url
    boolean spec_verified
    tsvector search_vector
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  case_specs {
    integer part_id PK,FK
    varchar[]_array supported_form_factors
    smallint max_gpu_length_mm
    smallint max_cooler_height_mm
    smallint[]_array radiator_support_mm
    varchar[]_array psu_form_factors
    smallint included_fans
    case_side_panel side_panel
  }
  cooler_specs {
    integer part_id PK,FK
    cooler_type type
    varchar[]_array supported_sockets
    smallint height_mm
    smallint radiator_mm
    integer max_tdp_watt
  }
  cpu_specs {
    integer part_id PK,FK
    varchar socket
    varchar generation
    smallint cores
    smallint threads
    numeric base_clock_ghz
    numeric boost_clock_ghz
    integer tdp_watt
    boolean has_igpu
    boolean includes_cooler
    varchar[]_array memory_types
    smallint perf_score
  }
  gpu_specs {
    integer part_id PK,FK
    varchar chipset
    smallint vram_gb
    smallint length_mm
    numeric slot_width
    integer tbp_watt
    jsonb power_connectors
    smallint perf_score
  }
  motherboard_specs {
    integer part_id PK,FK
    varchar socket
    varchar chipset
    motherboard_form_factor form_factor
    memory_type memory_type
    smallint memory_slots
    smallint max_memory_gb
    integer max_memory_speed
    smallint m2_slots
    smallint sata_ports
    varchar[]_array supported_generations
    varchar[]_array bios_update_generations
    boolean wifi
  }
  psu_specs {
    integer part_id PK,FK
    integer wattage
    psu_efficiency efficiency
    psu_form_factor form_factor
    psu_modular modular
    jsonb pcie_connectors
  }
  ram_specs {
    integer part_id PK,FK
    memory_type type
    smallint capacity_per_stick_gb
    smallint sticks_in_kit
    integer speed_mts
    smallint cas_latency
    boolean rgb
  }
  storage_specs {
    integer part_id PK,FK
    storage_type type
    storage_interface interface
    integer capacity_gb
    integer read_mbps
    integer write_mbps
  }
  parts ||--o{ part_price_history : "part_id"
  categories ||--o{ parts : "category_id"
  brands ||--o{ parts : "brand_id"
  parts ||--o| case_specs : "part_id"
  parts ||--o| cooler_specs : "part_id"
  parts ||--o| cpu_specs : "part_id"
  parts ||--o| gpu_specs : "part_id"
  parts ||--o| motherboard_specs : "part_id"
  parts ||--o| psu_specs : "part_id"
  parts ||--o| ram_specs : "part_id"
  parts ||--o| storage_specs : "part_id"
```

## ER Diagram กลุ่มสเปกและชุมชน

หัวข้อ 6.4 · ไฟล์ต้นฉบับ `docs/diagrams/er-builds.mmd`

```mermaid
erDiagram
  users {
    text id PK
  }
  parts {
    serial id PK
    integer category_id FK
    integer brand_id FK
  }
  build_items {
    serial id PK
    text build_id FK
    integer part_id FK
    smallint quantity
    numeric price_at_add
    build_item_condition condition
    numeric offered_price
    smallint warranty_months_left
  }
  build_votes {
    text build_id PK,FK
    text user_id PK,FK
    smallint value
    timestamp_with_time_zone created_at
  }
  builds {
    text id PK
    text user_id FK
    text forked_from_id FK
    varchar title
    text description
    usage_type usage_type
    numeric budget
    build_visibility visibility
    numeric total_price
    numeric total_new_price
    integer total_watt
    smallint perf_score
    compat_status compat_status
    integer vote_score
    integer view_count
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  comments {
    serial id PK
    text build_id FK
    text user_id FK
    integer parent_id FK
    varchar body
    boolean is_hidden
    timestamp_with_time_zone created_at
    timestamp_with_time_zone updated_at
  }
  favorites {
    text user_id PK,FK
    text build_id PK,FK
    timestamp_with_time_zone created_at
  }
  builds ||--o{ build_items : "build_id"
  parts ||--o{ build_items : "part_id"
  builds ||--o{ build_votes : "build_id"
  users ||--o{ build_votes : "user_id"
  users ||--o{ builds : "user_id"
  builds |o--o{ builds : "forked_from_id"
  builds ||--o{ comments : "build_id"
  users ||--o{ comments : "user_id"
  comments |o--o{ comments : "parent_id"
  users ||--o{ favorites : "user_id"
  builds ||--o{ favorites : "build_id"
```

## ER Diagram กลุ่มระบบ

หัวข้อ 6.5 · ไฟล์ต้นฉบับ `docs/diagrams/er-system.mmd`

```mermaid
erDiagram
  users {
    text id PK
  }
  admin_logs {
    bigserial id PK
    text admin_id FK
    varchar action
    varchar target_type
    varchar target_id
    jsonb changes
    timestamp_with_time_zone created_at
  }
  notifications {
    serial id PK
    text user_id FK
    notification_type type
    text actor_id FK
    text build_id FK
    varchar message
    timestamp_with_time_zone read_at
    timestamp_with_time_zone created_at
  }
  rate_limits {
    varchar key PK
    integer count
    timestamp_with_time_zone window_start
  }
  reports {
    serial id PK
    text reporter_id FK
    report_target_type target_type
    text target_id
    report_reason reason
    text detail
    report_status status
    text resolved_by FK
    timestamp_with_time_zone created_at
    timestamp_with_time_zone resolved_at
  }
  settings {
    varchar key PK
    jsonb value
    text updated_by FK
    timestamp_with_time_zone updated_at
  }
  users |o--o{ admin_logs : "admin_id"
  users ||--o{ notifications : "user_id"
  users |o--o{ notifications : "actor_id"
  users |o--o{ reports : "reporter_id"
  users |o--o{ reports : "resolved_by"
  users |o--o{ settings : "updated_by"
```

## ER Diagram กลุ่มมือสอง

หัวข้อ 6.8 · ไฟล์ต้นฉบับ `docs/diagrams/er-used.mmd`

```mermaid
erDiagram
  users {
    text id PK
  }
  parts {
    serial id PK
    integer category_id FK
    integer brand_id FK
  }
  part_used_prices {
    serial id PK
    integer part_id FK
    used_grade grade
    numeric min_price
    numeric max_price
    date surveyed_at
    text source_note
    text updated_by FK
  }
  part_used_stats {
    integer part_id PK,FK
    used_grade grade PK
    numeric median_price
    numeric p25_price
    numeric p75_price
    smallint report_count
    used_price_source source
    used_price_confidence confidence
    timestamp_with_time_zone computed_at
  }
  price_alerts {
    serial id PK
    text user_id FK
    integer part_id FK
    used_grade grade
    numeric target_price
    timestamp_with_time_zone triggered_at
    timestamp_with_time_zone created_at
  }
  used_price_reports {
    serial id PK
    integer part_id FK
    text user_id FK
    numeric price
    used_grade grade
    used_report_type report_type
    used_report_channel channel
    varchar province
    smallint warranty_months_left
    date seen_at
    text proof_image_url
    used_report_status status
    text reviewed_by FK
    timestamp_with_time_zone created_at
  }
  parts ||--o{ part_used_prices : "part_id"
  users |o--o{ part_used_prices : "updated_by"
  parts ||--o{ part_used_stats : "part_id"
  users ||--o{ price_alerts : "user_id"
  parts ||--o{ price_alerts : "part_id"
  parts ||--o{ used_price_reports : "part_id"
  users |o--o{ used_price_reports : "user_id"
  users |o--o{ used_price_reports : "reviewed_by"
```

## Flowchart การตรวจความเข้ากันได้

checkBuild() หัวข้อ 4.2 · ไฟล์ต้นฉบับ `docs/diagrams/flow-check.mmd`

```mermaid
%% ขั้นตอนตรวจสเปก checkBuild() (หัวข้อ 4.2)
flowchart TD
  start([รับรายการอะไหล่และจำนวน]) --> ctx["แยกอะไหล่ตามหมวด<br/>(buildContext)"]
  ctx --> calc["คำนวณวัตต์ ราคา คะแนน"]
  calc --> loop{{"รันกฎทีละข้อ<br/>R01–R18 · I01–I04 · U01–U06"}}
  loop --> need{"อะไหล่ที่กฎนี้ต้องใช้<br/>เลือกครบแล้ว?"}
  need -- ไม่ครบ --> skip["ข้ามกฎนี้"] --> more
  need -- ครบ --> test{"ผิดเงื่อนไข?"}
  test -- ไม่ --> more
  test -- ใช่ --> add["เพิ่มปัญหา: รหัส ระดับ สาเหตุ วิธีแก้<br/>และอะไหล่ที่แนะนำ"] --> more
  more{"ยังมีกฎ?"} -- มี --> loop
  more -- หมด --> sort["เรียง ผิดพลาด → เตือน → ข้อมูล"]
  sort --> status{"มีผิดพลาด?"}
  status -- ใช่ --> red["สถานะแดง"]
  status -- ไม่ --> warn{"มีเตือน?"}
  warn -- ใช่ --> yellow["สถานะเหลือง"]
  warn -- ไม่ --> green["สถานะเขียว"]
```

## Flowchart อัลกอริทึมจัดสเปกตามงบ

หัวข้อ 4.5 · ไฟล์ต้นฉบับ `docs/diagrams/flow-budget.mmd`

```mermaid
%% อัลกอริทึมจัดสเปกตามงบ (หัวข้อ 4.5) ตามโค้ดใน src/lib/compat/budget.ts
flowchart TD
  input([งบ · ประเภทการใช้งาน · ยี่ห้อ CPU · ยอมมือสอง?]) --> used{"ยอมใช้มือสอง?"}
  used -- ใช่ --> swap["หมวดที่ยอม: ใช้ราคากลางมือสอง<br/>แทนราคาใหม่ (ถ้าถูกกว่า)"] --> split
  used -- ไม่ --> split["แบ่งงบตามสัดส่วนของประเภท"]
  split --> gpu["การ์ดจอคะแนนสูงสุดในงบหมวด<br/>(ออฟฟิศ + CPU มีกราฟิกในตัว = ข้าม)"]
  gpu --> cpu["CPU คะแนนสูงสุดในงบหมวด"]
  cpu --> rest["เมนบอร์ด (R01–R02, M.2 ≥ 1) → แรม (R04–R06)<br/>→ SSD NVMe → PSU (วัตต์ ≥ ค่าแนะนำ)<br/>→ เคส (R08, R09, R15) → ชุดระบายความร้อน (R10–R13)"]
  rest --> check{"checkBuild()<br/>ไม่มีผิดพลาด?"}
  check -- มีผิดพลาด --> fail{"ลดรุ่นได้อีก?"}
  check -- ผ่าน --> over{"เกินงบ?"}
  over -- เกิน --> fail
  fail -- ได้ --> down["ลดรุ่นหมวดที่เกินงบหมวดมากสุด<br/>ทีละขั้น แล้วประกอบใหม่"] --> rest
  fail -- ไม่ได้ --> min["บอกงบขั้นต่ำที่จัดได้จริง<br/>(ลองจัดเพิ่มทีละ 1,000 บาท)"]
  over -- ไม่เกิน --> left{"เหลือเกิน 5%?"}
  left -- ใช่ --> up["อัปเกรดการ์ดจอหรือ CPU<br/>ทีละขั้นตามน้ำหนักการใช้งาน"] --> check
  left -- ไม่ --> three["สร้าง 3 ตัวเลือก<br/>ประหยัด 85% · สมดุล ~100% · คุ้มสุด"]
```

## Flowchart เลือกแหล่งราคากลางมือสอง

หัวข้อ 4.6 · ไฟล์ต้นฉบับ `docs/diagrams/flow-used-price.mmd`

```mermaid
%% เลือกแหล่งราคากลางมือสอง (หัวข้อ 4.6) ตามโค้ดใน src/lib/compat/used-price.ts
flowchart TD
  s([รุ่น + เกรด]) --> r["รายงานที่อนุมัติ 60 วันล่าสุด"]
  r --> iqr["ตัดค่าผิดปกติด้วย IQR"]
  iqr --> n{"เหลือ ≥ 3 รายงาน?"}
  n -- ใช่ --> med["มัธยฐานถ่วงน้ำหนัก (อายุ × ประเภท)<br/>ช่วง P25–P75 · ปัดหลัก 50"]
  med --> conf{"≥ 10 รายงาน?"}
  conf -- ใช่ --> high["ป้าย: ความน่าเชื่อถือสูง"]
  conf -- ไม่ --> mid["ป้าย: ความน่าเชื่อถือกลาง"]
  n -- ไม่ --> sv{"มีราคาสำรวจของแอดมิน<br/>ไม่เกิน 90 วัน?"}
  sv -- มี --> svp["จุดกึ่งกลางของช่วงราคาสำรวจ<br/>ป้าย: กลาง"]
  sv -- ไม่มี --> est["P_used = P_new × r^t × k<br/>ป้าย: ประมาณการ"]
```

## Sequence Diagram เลือกอะไหล่และบันทึกอัตโนมัติ

หัวข้อ 8.1 · ไฟล์ต้นฉบับ `docs/diagrams/seq-save.mmd`

```mermaid
%% ลำดับการทำงานเมื่อเลือกอะไหล่และบันทึกอัตโนมัติ (หัวข้อ 8.1)
sequenceDiagram
  actor U as ผู้ใช้
  participant P as หน้าต่างเลือกอะไหล่
  participant Z as Zustand
  participant E as Engine (เบราว์เซอร์)
  participant A as Server Action saveBuild
  participant D as PostgreSQL
  U->>P: กดเลือกอะไหล่
  P->>Z: addPart / replacePart
  Z->>E: checkBuild(สเปกใหม่)
  E-->>U: ผลตรวจ วัตต์ ราคา ขึ้นทันที
  Note over Z,A: หยุดแก้ 2 วินาที (debounce) และล็อกอินอยู่
  Z->>A: saveBuild(รหัสอะไหล่ จำนวน สภาพ)
  A->>A: ตรวจสิทธิ์ + Zod + จำกัด 60 ครั้ง/นาที
  A->>D: อ่านสเปกและราคาจริงของอะไหล่
  A->>A: checkBuild ซ้ำด้วยข้อมูลจากฐานข้อมูล
  A->>D: บันทึก builds + build_items (Transaction)
  A-->>U: บันทึกแล้ว
```

## Sequence Diagram แจ้งเตือนแบบสด

SSE หัวข้อ 3.8 · ไฟล์ต้นฉบับ `docs/diagrams/seq-notify.mmd`

```mermaid
%% แจ้งเตือนแบบสดด้วย SSE (หัวข้อ 3.8) ตามโค้ดใน src/app/api/notifications/stream/route.ts
sequenceDiagram
  actor B as สมาชิก B
  participant A1 as Server Action addComment
  participant D as ตาราง notifications
  participant S as /api/notifications/stream
  actor O as เจ้าของสเปก (เปิดเว็บอยู่)
  O->>S: EventSource เชื่อมต่อ
  S->>D: นับที่ยังไม่อ่าน + รายการล่าสุด
  S-->>O: event: snapshot
  B->>A1: คอมเมนต์
  A1->>D: INSERT comment + notification (ไม่แจ้งตัวเอง ข้ามประเภทที่ปิด)
  loop ทุก 3 วินาที
    S->>D: แถวที่ id > ตัวล่าสุด
  end
  S-->>O: event: notification (id = รหัสแถว)
  Note over S,O: ครบ 50 วินาทีปิดเอง เบราว์เซอร์ต่อใหม่พร้อม Last-Event-ID
```
