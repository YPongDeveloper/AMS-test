# PROJECT HANDOFF PROMPT — SRT Asset Management (AMS)

> คัดลอกเนื้อหาด้านล่างทั้งหมดไปวางใน AI session ใหม่ เพื่อทำงานต่อจากจุดปัจจุบันได้ทันที

---

## บทบาทของคุณ (AI)

คุณคือ AI ผู้ช่วยพัฒนาต่อโปรเจคนี้ เข้าใจสถานะปัจจุบันทั้งหมดด้านล่าง และทำงานโดยรักษากติกา/convention ที่กำหนดไว้อย่างเคร่งครัด ก่อนแก้โค้ดใด ให้อ่านไฟล์ที่เกี่ยวข้องก่อนเสมอ และหลังแก้ทุกครั้งต้อง `npm run build` (frontend) และ `go build ./...` + `go vet ./...` (backend) ให้ผ่านก่อน commit

## ภาพรวมโปรเจค

ระบบบริหารจัดการทรัพย์สินที่ดินและสิ่งปลูกสร้าง การรถไฟแห่งประเทศไทย (SRT) — เริ่มจาก mockup แล้วพัฒนาเป็นระบบจริง: PWA หน้าบ้าน (สำรวจที่ดิน/อาคาร, คำนวณภาษี, งานสั่งงาน) + Go backend + Postgres + ผสาน LINE (LIFF Login, Rich Menu, Flex Message push)

- **Repo**: https://github.com/YPongDeveloper/AMS-test (public, branch `main`, push = auto-deploy ทั้ง Vercel และ Render)
- **ภาษาผู้ใช้**: ไทยเป็นหลัก (i18n TH/EN ผ่าน `lib/i18n.tsx`)
- **ธีม**: ราชการไทย น้ำเงิน (govblue) - ทอง (govgold), โลโก้รถไฟลายเส้น (`components/Logo.tsx`)

## สถาปัตยกรรม & URL จริง

```
[LINE OA @178owwdo + Rich Menu 3 ช่อง]
   └─ LIFF (2011580808-H9tp0UHL) → เปิดเว็บใน LINE, login อัตโนมัติ
[Frontend] Vercel → https://ams-test-sukanan.vercel.app  (Next.js 14 static export + PWA)
   └─ HTTPS/WSS → [Go backend] Render → https://srt-ams-api.onrender.com
                      └─ Postgres → [Supabase] project "srt-ams" (Singapore, pooler :6543)
```

## บัญชีทดสอบ (seed อัตโนมัติใน DB ตอน backend boot)

- `admin/admin` → role **admin** (ผู้ดูแลระบบ — หน้า /admin จัดการผู้ใช้)
- `leader/leader` → role **supervisor** (หัวหน้างาน — สั่งงานได้, เมนู "งานสั่งงาน")
- `normal/normal` → role **subordinate** (เจ้าหน้าที่ — รับงาน)
- บัญชี LINE: ผู้ใช้ที่ login ผ่าน LIFF ครั้งแรกจะถูก **insert อัตโนมัติ** (คนแรกของระบบ = supervisor, คนถัดไป = subordinate) — admin เปลี่ยน role ย้อนหลังได้ในหน้า /admin

## โครงสร้างโค้ด

```
/ (repo root)
├── app/                    # Next.js App Router (static export)
│   ├── page.tsx            # Login (username/password + LINE button, routing ตาม role)
│   ├── dashboard/          # ดึงข้อมูลจาก GET /api/dashboard (fallback mock ในตัว)
│   ├── tasks/ + tasks/new/ # ระบบสั่งงาน (WS realtime, MapPicker Google Maps)
│   ├── admin/              # จัดการผู้ใช้ (admin/supervisor เท่านั้น)
│   └── land/ building/ tax/# แบบฟอร์มสำรวจ (ยังเป็น mock ฝั่งหน้าเว็บ — ยังไม่ต่อ DB)
├── components/             # Topbar (nav ตาม role + dropdown โปรไฟล์), Page, Logo, MapPicker, ui.tsx
├── lib/                    # api.ts (envelope + JWT AT/RT + auto-refresh), useMe.ts, liff.ts, ws.ts, usePwaInstall.ts, i18n.tsx
├── public/                 # sw.js (network-first), manifest.json, icons, richmenu.png
├── backend/                # Go 1.24 (module ams-backend)
│   ├── cmd/server/main.go  # entry point (wire ทุกชั้น)
│   └── internal/
│       ├── config/ model/  # env / domain structs (User, Task, Role)
│       ├── repository/     # SQL ล้วน (user, task, refresh_token, dashboard) + migrate + seed
│       ├── service/        # business logic (auth JWT, users, tasks, LINE notifier)
│       ├── handler/        # HTTP + response envelope {status, message, data}
│       ├── middleware/     # Auth(Bearer), RequireRole/RequireAnyRole, CORS, RequestLogging
│       ├── router/         # ประกาศ routes
│       └── ws/             # WebSocket hub (task.new / task.update)
├── scripts/                # setup-richmenu.js, send-line-push.js, richmenu.svg
├── DEPLOY-BACKEND.md       # คู่มือ deploy backend ครบทุกขั้น
└── LINE-SETUP.md           # คู่มือ LINE Login/LIFF + Rich Menu + Messaging
```

## กติกาที่ต้องรักษา (สำคัญ — ห้ามฝืน)

1. **Response envelope ทุก API**: `{"status": <http code>, "message": "<ข้อความ>", "data": <object|null>}` — ใช้ `handler.WriteOK / handler.WriteErr`
2. **ห้าม expose id ตัวเลข** — ทุก entity ใช้ `public_id` (UUID) ใน API และหน้าเว็บ; id ตัวเลขเป็น `json:"-"`
3. **ตัวตนมาจาก Bearer token เสมอ** — uid/role อ่านจาก JWT claims (middleware.Auth) ห้ามรับ id จาก client
4. **JWT**: access token 15 นาที + refresh token 30 วัน (เก็บ sha256 hash ในตาราง refresh_tokens, rotate ทุกครั้ง); frontend auto-refresh เมื่อโดน 401 และก่อนเชื่อม WS (`ensureFreshAccessToken`)
5. **Layer**: handler → service → repository (SQL อยู่ชั้น repository เท่านั้น)
6. **Supabase pooler**: DSN ต้องเป็น transaction pooler port 6543 และ `repository.Open` บังคับ `QueryExecModeSimpleProtocol` เมื่อ host มีคำว่า pooler.supabase.com (ห้ามลอง direct :5432 — IPv6 only)
7. **LINE users ไม่มี username**: คอลัมน์ `line_user_id`/`username` เป็น NULL ได้ — query ต้อง COALESCE ก่อน scan เป็น string
8. **Insert ผู้ใช้ LINE ใหม่ทันที** เมื่อ verify ID token ผ่านแล้วไม่เจอในระบบ (ห้ามพาไปหน้า login) — ผู้ใช้ LINE ต้องเข้า dashboard ได้เลย
9. **CORS**: `ALLOWED_ORIGIN` env (มือถือ/LIFF เรียกข้าม origin) — middleware.CORS ต้อง passthrough Hijacker/Flush (WebSocket)
10. **หน้าใหม่ต้องครอบ `<Page>`** (มี Topbar/footer) และ nav ใน Topbar กรองตาม role

## สิ่งที่ทำเสร็จแล้ว (สถานะ ณ วันที่ 14 ก.ย. 2569)

- ✅ PWA หน้าบ้าน 5 หน้า (Login/Dashboard/Land/Building/Tax) + โลโก้รถไฟลายเส้น + sw.js network-first (แก้ CSS ไม่โหลดครั้งแรก)
- ✅ LINE Login ผ่าน LIFF (channel 2011580808, Published แล้ว) + Rich Menu 3 ช่อง + Flex push (แจ้งงานใหม่/อัปเดตสถานะ)
- ✅ Go backend โครงสร้างมืออาชีพ + JWT AT/RT + envelope + public UUID
- ✅ ระบบสั่งงาน: หัวหน้าสั่ง (เลือกลูกน้อง/ประเภทงาน/กำหนดส่ง/pิกัด Google Maps) → WS realtime + LINE push → ลูกน้อง รับงาน→เริ่ม→เสร็จ
- ✅ หน้า /admin จัดการ role ผู้ใช้ (popup) — เมนูตาม role ใน Topbar
- ✅ Dashboard ดึงข้อมูลจาก `/api/dashboard` (mock data seed ใน DB, PUT ได้โดย admin)
- ✅ PWA install ย้ายไปเมนูโปรไฟล์ "ติดตั้งบนมือถือ" (มือถือเท่านั้น)

## ปัญหาค้าง / สิ่งที่ต้องทำต่อ (เรียงตามความสำคัญ)

1. **Render ฟรีหลับทุก 15 นาที** (cold start ~30-50 วิ — ต้นตอที่ผู้ใช้เจอ "login ค้าง/เด้ง") — ทางแก้ที่รอตัดสินใจ: (ก) cron-job.org ยิง `GET /health` ทุก 10 นาที ฟรี (ข) ย้ายไป Koyeb ฟรี (ไม่หลับ, 1 service, build minutes จำกัด) (ค) Google Cloud Run (ฟรีเยอะ, ต้องบัตร) — โค้ดพร้อมย้ายแล้ว (มี Dockerfile)
2. **ทดสอบ LINE login บนมือถือให้สำเร็จครบวงจร** — backend auto-insert พร้อม, frontend retry ~2.4 นาทีพร้อม — รอผู้ใช้เปิด LIFF ใหม่แล้วยืนยันว่า บัญชี LINE โผล่ในหน้า /admin
3. **แบบฟอร์มสำรวจ (land/building) ยังไม่บันทึกลง DB** — ต่อไป: เพิ่มตาราง `land_parcels`/`buildings` + API + หน้าเว็บเรียก (โครง handler→service→repository ตามตัวอย่าง tasks)
4. **บอทตอบแชท (webhook)** — ต้องมี public endpoint รับ POST จาก LINE: ทำได้โดยเลิก static export แล้วยุบ API เข้า Next.js หรือเพิ่ม route ใน Go backend (`POST /api/line/webhook` + signature verify) แล้วชี้ webhook URL ใน LINE console — ตัวอย่างโค้ดใน LINE-SETUP.md
5. **Google Maps picker** — ใส่ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` บน Vercel เพื่อเปิดแผนที่ปักหมุดในหน้าสั่งงาน (ตอนนี้ไม่มี key = กรอกพิกัดเองได้อยู่)
6. ** LINE Notify เลิกให้บริการแล้ว** — แจ้งเตือนใช้ Messaging API push (`scripts/send-line-push.js`) เท่านั้น

## Deploy & env vars

- **Vercel** (project `ams-test`): `NEXT_PUBLIC_API_URL=https://srt-ams-api.onrender.com`, `NEXT_PUBLIC_LIFF_ID=2011580808-H9tp0UHL`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (optional) — เปลี่ยน env แล้วต้อง Redeploy (static export bake ตอน build)
- **Render** (service `srt-ams-api`, root `backend`, Docker, Free): `DATABASE_URL` (Supabase pooler 6543 + sslmode=require), `JWT_SECRET`, `LINE_CHANNEL_ID=2011580808`, `LINE_CHANNEL_ACCESS_TOKEN`, `LIFF_ID=2011580808-H9tp0UHL`, `ALLOWED_ORIGIN=https://ams-test-sukanan.vercel.app`, `PORT=10000`
- **Supabase** (project ref `maymctkogrdsvyzdgtmq`, org "YPongDeveloper's OrgSRT AMS"): DB password ถูก rotate แล้วหลังมี credential หลุดเข้า git history (commit 148092b — ตัวเก่าใช้ไม่ได้แล้ว) — DSN ปัจจุบันอยู่ใน Render env เท่านั้น ห้าม commit ลง repo
- **LINE**: Login channel `AMS Login` (2011580808, Published — Developing จะโดน 400 "User need to have developer role"), Messaging API channel 2011580974 (OA @178owwdo "sukananDEV"), Rich Menu ID `richmenu-18218320b476fc268f565114ee36b52f` (ตั้ง default ทุก user แล้ว)

## คำสั่งที่ใช้บ่อย

```bash
npm run build                                   # build frontend (ต้องผ่านก่อน push)
cd backend && go build ./... && go vet ./...    # build backend (ต้องผ่านก่อน push)
node scripts/setup-richmenu.js <TOKEN> <LIFF_ID> # ตั้งค่า Rich Menu ใหม่
node scripts/send-line-push.js <TOKEN> <USER_ID> "ข้อความ"  # push แจ้งเตือน
```

## บริบทสำคัญอื่น ๆ

- LINE user ของเจ้าของโปรเจค: แอป LINE ชื่อ **deVP** (ยังไม่เคยลงทะเบียบใน backend สำเร็จ — รอทดสอบครั้งแรกหลังแก้ retry แล้ว)
- ตอน deploy ใหม่ทุกครั้ง frontend ต้องบอกผู้ใช้ "ปิดหน้า LIFF แล้วเปิดใหม่" เพื่อโหลดโค้ดใหม่ (Service Worker + webview cache)
- ผู้ใช้โปรเจค: นายพงศกร (GitHub YPongDeveloper, LINE Business ID sukananDEV) — ติดต่อผ่านเจ้าของเครื่อง
