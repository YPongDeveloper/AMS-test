# คู่มือ Deploy ระบบหลังบ้าน (Go) + Supabase — ฟรีทั้งหมด

สถาปัตยกรรม:

```
[เว็บ Vercel] ──HTTPS/WSS──> [Go backend บน Render] ──Postgres──> [Supabase]
                                   │
                                   └── LINE push (Flex Message) + LINE webhook อนาคต
```

## ขั้นตอนที่ 1 — สร้างฐานข้อมูลบน Supabase (5 นาที)

1. ไปที่ https://supabase.com → **Start your project** → สมัครด้วย GitHub/Email
2. **New project** → ตั้งชื่อ `ams` → ตั้งรหัสผ่าน DB (จดไว้) → Region: **Singapore** (ใกล้ไทยสุด)
3. รอจน project พร้อม แล้วไปที่ **Connect** (มุมบน) หรือ Project Settings → Database
4. คัดลอก **Transaction pooler** connection string (port **6543**):
   ```
   postgresql://postgres.<ref>:<password>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
   > ⚠️ ต้องใช้ pooler (6543) เพราะ direct connection (5432) ของ Supabase ฟรีเป็น IPv6-only — Render ออกเน็ตทาง IPv4
5. เก็บ string นี้ไว้เป็น `DATABASE_URL`

> ไม่ต้องสร้างตารางเองใน Supabase — **Go backend จะสร้าง schema ให้อัตโนมัติตอน boot** (ตาราง `users`, `tasks`)

## ขั้นตอนที่ 2 — Deploy Go backend บน Render (5 นาที)

1. ไปที่ https://render.com → สมัครด้วย **GitHub** (บัญชีเดียวกับ repo นี้)
2. **New → Web Service** → เลือก repo `YPongDeveloper/AMS-test`
3. ตั้งค่า:
   - **Root Directory**: `backend`
   - **Runtime**: Docker (จะหยิบ `backend/Dockerfile` อัตโนมัติ)
   - **Instance Type**: Free
4. **Environment Variables** (กด Add ทีละตัว):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | connection string จากขั้นตอนที่ 1 |
   | `JWT_SECRET` | ตัวอักษรสุ่มยาว ๆ เช่น `ams-secret-9f83ka01` |
   | `LINE_CHANNEL_ID` | `2011580808` (LINE Login channel — ใช้ตรวจ ID Token) |
   | `LINE_CHANNEL_ACCESS_TOKEN` | token ของ Messaging API (ที่ออกไว้แล้วใน console) |
   | `LIFF_ID` | `2011580808-H9tp0UHL` (ใช้ทำลิงก์ปุ่มใน Flex Message) |
   | `ALLOWED_ORIGIN` | `https://ams-test-sukanan.vercel.app` |

5. กด **Create Web Service** → รอ build ~2 นาที
6. ได้ URL เช่น `https://ams-backend-xxxx.onrender.com` — ทดสอบ:
   ```
   https://ams-backend-xxxx.onrender.com/health   →  {"status":"ok",...}
   ```

> ข้อจำกัดฟรี: ไม่มี traffic 15 นาที เครื่องจะหลับ (request แรกช้า ~30 วิ) และฟรี 750 ชม./เดือน = พอสำหรับ 1 service ตลอดเดือน

## ขั้นตอนที่ 3 — เชื่อมหน้าบ้าน (Vercel)

1. Vercel → โปรเจค `ams-test` → Settings → Environment Variables เพิ่ม:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | URL ของ Render จากขั้นตอนที่ 2 (เช่น `https://ams-backend-xxxx.onrender.com`) |
   | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | *(ไม่บังคับ)* Google Maps JS API key — มี = ได้แผนที่ปักหมุดในหน้าสั่งงาน; ไม่มี = กรอกพิกัดเอง |

2. **Redeploy** → เปิดเว็บจะเห็นเมนู **"งานสั่งงาน"** เพิ่มในแถบนำทาง

## วิธีใช้งานระบบสั่งงาน

1. **คนแรกที่ login ด้วย LINE** จะเป็น **หัวหน้างาน** อัตโนมัติ (คนอื่นที่ login ตามมา = ลูกน้อง)
2. หัวหน้า: เมนู "งานสั่งงาน" → ปุ่ม **สั่งงานใหม่** → กรอกชื่องาน/ประเภท (งานเก็บข้อมูล...)/เลือกผู้รับ/กำหนดส่ง/ปักพิกัดบนแผนที่ → **ส่งงาน**
3. ระบบทำ 3 อย่างพร้อมกัน: บันทึก DB → **WebSocket** ดันงานขึ้นหน้าเว็บลูกน้องทันที → ส่ง **LINE Flex Message** (การ์ดแดง "แจ้งงานใหม่" มีรหัสงาน/ผู้สั่ง/กำหนดส่ง/พิกัด + ปุ่มดูรายละเอียด) เข้า LINE ของผู้รับ
4. ลูกน้อง: กด รับงาน → เริ่มปฏิบัติงาน → เสร็จสิ้น (หัวหน้าเห็น realtime + ได้ LINE แจ้งเมื่อเสร็จ)
5. หัวหน้าจัดการบทบาทสมาชิก (หัวหน้า/ลูกน้อง) ได้ในกล่อง "สมาชิกในสังกัด"

## API สรุป (สำหรับอ้างอิง/ทดสอบ)

| Method | Path | ใครใช้ได้ | คำอธิบาย |
|---|---|---|---|
| POST | `/api/auth/line` | ทุกคน | body `{id_token}` จาก LIFF → ได้ JWT + user |
| GET | `/api/me` | login | ข้อมูลตัวเอง |
| GET | `/api/users` | หัวหน้า | รายชื่อสมาชิก (`?role=subordinate`) |
| PATCH | `/api/users/{id}/role` | หัวหน้า | `{role: "supervisor"\|"subordinate"}` |
| GET | `/api/tasks` | login | ลูกน้อง=งานตัวเอง, หัวหน้า=ทั้งหมด (`?status=`) |
| POST | `/api/tasks` | หัวหน้า | สั่งงาน → WS + LINE push |
| PATCH | `/api/tasks/{id}/status` | ผู้รับ/หัวหน้า | เปลี่ยนสถานะงาน |
| GET | `/ws?token=` | login | WebSocket realtime (`task.new`, `task.update`) |

## แก้ปัญหาเจอบ่อย

- **Render build fail** — ตรวจว่า Root Directory = `backend` และ runtime เป็น Docker
- **เว็บหน้า tasks ขึ้น "ยังไม่เชื่อมต่อหลังบ้าน"** — ยังไม่ได้ตั้ง/Redeploy `NEXT_PUBLIC_API_URL`
- **login แล้ว 401** — `LINE_CHANNEL_ID` บน backend ต้องตรงกับ channel ที่ออก ID Token
- **ไม่ได้รับ LINE** — ผู้รับต้องเป็นเพื่อนกับ OA แล้ว; ตรวจ `LINE_CHANNEL_ACCESS_TOKEN` ยังไม่ถูก Reissue ทิ้ง
- **WebSocket ตัดจบบ่อยบน Render ฟรี** — เพราะเครื่องหลับตอน idle; client reconnect เองอัตโนมัติ
