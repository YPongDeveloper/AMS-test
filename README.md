# SRT Asset Management System (Mockup)

> **ระบบบริหารจัดการทรัพย์สินที่ดินและสิ่งปลูกสร้าง** — การรถไฟแห่งประเทศไทย

Mockup UI สำหรับงานสำรวจข้อมูลภาคสนาม เพื่อนำไปคำนวณภาษีที่ดินและสิ่งปลูกสร้าง

## ✨ Features

- 🏛️ **Government Style** — โทนน้ำเงิน-ทอง (ราชการไทย)
- 🌐 **สองภาษา** TH / EN สลับได้บน header
- 📱 **PWA** — ติดตั้งเป็นแอป, ใช้งานได้แม้ไม่มีเน็ต (offline cache)
- 📋 **5 หน้า**:
  - Login
  - Dashboard (ภาพรวมทรัพย์สิน)
  - Land Survey (ฟอร์มแปลงที่ดิน 9 fields)
  - Building Survey (ฟอร์มอาคาร 51 fields + 10 ชั้น)
  - Tax Calculation (คำนวณภาษี พ.ร.บ. 2562)

## 🚀 Run locally

```bash
npm install
npm run dev
```

## 🏗️ Build

```bash
npm run build
# Output ใน /out เป็น static site
```

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **PWA**: Service Worker + Web App Manifest
- **i18n**: Custom React Context
- **Icons**: Lucide React

## 📂 Project Structure

```
srt-asset-mockup/
├── app/              # Next.js app router pages
│   ├── page.tsx       # Login
│   ├── dashboard/     # Dashboard
│   ├── land/          # Land survey
│   ├── building/      # Building survey
│   └── tax/           # Tax calculation
├── components/       # Shared components
│   ├── Topbar.tsx
│   ├── Page.tsx
│   ├── ui.tsx
│   ├── InstallPWA.tsx
│   └── RegisterSW.tsx
├── lib/
│   └── i18n.tsx       # TH/EN translations
├── public/           # Static assets
│   ├── manifest.json
│   ├── sw.js
│   └── icons
└── ...
```

## 📄 License

MIT — for demo purposes only.
