# 🚆 Asset & Tax Management System (AMS)
### ระบบบริหารจัดการทรัพย์สินที่ดิน สิ่งปลูกสร้าง และคำนวณภาษี

[![Next.js](https://img.shields.io/badge/Next.js-14_App_Router-black?style=flat&logo=next.js)](https://nextjs.org/)
[![Go](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Offline_First-5A0FC8?style=flat&logo=pwa)](https://web.dev/progressive-web-apps/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat&logo=postgresql)](https://supabase.com/)

---

## 📖 เกี่ยวกับระบบ (Overview)

**Asset & Tax Management System (AMS)** เป็นเว็บแอปพลิเคชันและ Progressive Web App (PWA) ระดับองค์กร สำหรับสนับสนุนการปฏิบัติงานสำรวจภาคสนาม การจัดเก็บฐานข้อมูลแปลงที่ดิน อาคารสิ่งปลูกสร้าง และการคำนวณภาษีตาม **พ.ร.บ. ภาษีที่ดินและสิ่งปลูกสร้าง พ.ศ. 2562** 

ออกแบบตามแนวคิด **Offline-First & Mobile-First** เพื่อให้เจ้าหน้าที่ภาคสนามสามารถสำรวจและบันทึกข้อมูลได้ต่อเนื่องแม้ในพื้นที่อับสัญญาณ พร้อมระบบคำนวณภาษีและจัดทำเอกสารแบบรวมแปลงอัตโนมัติ

---

## 🌟 ฟีเจอร์หลัก (Key Features)

### 1. 📱 Offline-First & Background Sync (ระบบภาคสนามออฟไลน์)
- **ทำงานได้ 100% แม้ไม่มีสัญญาณอินเทอร์เน็ต**: สามารถบันทึกผลสำรวจ อัปเดตสถานะงาน และจัดการข้อมูลผ่าน Local IndexedDB Cache
- **Auto Background Sync**: เมื่ออุปกรณ์เชื่อมต่อสัญญาณอินเทอร์เน็ต ระบบ Service Worker จะส่งข้อมูลที่ค้างอยู่ขึ้นเซิร์ฟเวอร์ให้อัตโนมัติทันที แม้ออกจากแอปพลิเคชัน
- **System Notification**: แจ้งเตือนสถานะการซิงค์ข้อมูลผ่าน Web Push Notifications ของระบบปฏิบัติการ

### 2. 📋 Field Task Management & Multi-Assignee (ระบบบริหารงานสำรวจ)
- **การมอบหมายงานแบบกลุ่ม (Multi-Assignee)**: หัวหน้างานสามารถกำหนดผู้รับผิดชอบงานสำรวจได้มากกว่า 1 คนต่องาน
- **สถานะงานเรียลไทม์**: ติดตามงานในสถานะต่าง ๆ เช่น รอดำเนินการ, กำลังสำรวจ, สำรวจเสร็จสิ้น และส่งข้อมูล
- **Compact Status Indicator**: แสดงสถานะออนไลน์/ออฟไลน์อย่างกะทัดรัด สบายตา ไม่รบกวนหน้าจอทำงาน

### 3. 🗺️ Land & GIS Parcel Survey (ระบบสำรวจแปลงที่ดิน)
- บันทึกและสืบค้นข้อมูลแปลงที่ดิน เลขระวาง เลขที่ดิน หน้าสำรวจ และเนื้อที่ (ไร่-งาน-ตร.ว.)
- รองรับการเชื่อมต่อแผนที่และระบุพิกัดแปลงที่ดินภาคสนาม
- ตรวจสอบประเภทการถือครองและประเภทการใช้ประโยชน์ที่ดิน

### 4. 🏢 Multi-story Building Survey (ระบบสำรวจอาคารและสิ่งปลูกสร้าง)
- รองรับการสำรวจอาคารแบบจำแนกชั้น (Multi-story/Multi-unit)
- จำแนกประเภทการใช้ประโยชน์: เกษตรกรรม, อยู่อาศัย, พาณิชยกรรม/อื่นๆ และที่รกร้างว่างเปล่า
- คำนวณอายุอาคาร อัตราค่าเสื่อมราคา และมูลค่าประเมินสุทธิ

### 5. 💰 Tax Calculation Engine (เครื่องมือคำนวณภาษี พ.ร.บ. 2562)
- คำนวณภาษีที่ดินและสิ่งปลูกสร้างตามสูตรและอัตราภาษีตามกฎหมายกำหนด
- หักลดหย่อนภาษีตามสิทธิ (เช่น ฐานภาษีมูลค่า 50 ล้านบาทแรกสำหรับบ้านหลัก)
- **รวมการประเมินหลายแปลงในใบเสร็จเดียว (Consolidated Invoice)**: จัดกลุ่มผู้เสียภาษีคนเดียวกัน เพื่อออกใบแจ้งประเมินยอดรวมและพิมพ์ใบเสร็จได้อย่างรวดเร็ว

### 6. 🎨 Design & Experience
- **PWA Experience**: ติดตั้งลงหน้าจอมือถือ (iOS / Android / Windows / macOS) ไร้แถบ URL เสมือน Native App พร้อม Railway Logo Splash Screen
- **Thai Government Design**: โทนสีน้ำเงิน-ทอง สุภาพ น่าเชื่อถือ ถูกต้องตามมาตรฐานราชการ
- **Bilingual (TH/EN)**: สลับภาษาไทย-อังกฤษได้ทันทีทั้งระบบ

---

## 🏗️ โครงสร้างสถาปัตยกรรม (Architecture & Tech Stack)

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide Icons
- **Offline & Storage**: Service Worker Cache API, IndexedDB API, Background Sync API
- **Backend**: Go (Golang) REST API, Structured Routing & Middleware
- **Database & Auth**: PostgreSQL (Supabase), Row-Level Security (RLS)
- **Styling & UI**: Custom Design System with Tailwind CSS

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```
ams-app/
├── app/                      # Next.js App Router
│   ├── admin/                # ผู้ดูแลระบบและการจัดการสิทธิ์
│   ├── building/             # ฟอร์มสำรวจอาคารและสิ่งปลูกสร้าง
│   ├── dashboard/            # สรุปภาพรวมและสถิติทรัพย์สิน
│   ├── land/                 # แบบสำรวจแปลงที่ดิน
│   ├── tasks/                # ระบบมอบหมายงานสำรวจภาคสนาม (Offline-ready)
│   ├── tax/                  # ระบบคำนวณภาษีและออกเอกสารประเมิน
│   ├── page.tsx              # หน้าเข้าสู่ระบบ (Authentication)
│   └── layout.tsx            # Global Layout & Providers
├── backend/                  # Go (Golang) Backend Service
│   ├── cmd/                  # Application Entrypoints
│   ├── internal/             # Handlers, Models & Database services
│   └── Dockerfile            # Container definition
├── components/               # Shared UI Components
│   ├── Topbar.tsx            # Header bar with compact status indicator
│   ├── InstallPWA.tsx        # PWA Install Prompt
│   ├── RegisterSW.tsx        # Service Worker & Background Sync registrar
│   └── ui.tsx                # Reusable UI primitives
├── lib/                      # Core Utilities & State
│   ├── i18n.tsx              # Internationalization (TH / EN)
│   ├── supabase.ts           # Database client helper
│   └── taskOfflineSync.ts    # IndexedDB & Offline sync engine
├── public/                   # Static Assets
│   ├── icons/                # PWA application icons
│   ├── manifest.json         # Web App Manifest
│   └── sw.js                 # Service worker with offline caching & background sync
└── package.json
```

---

## 🚀 การติดตั้งและรันในเครื่อง (Local Development)

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. ตั้งค่า Environment Variables
คัดลอกไฟล์ตัวอย่าง `.env.example` ไปเป็น `.env.local` แล้วใส่ค่า Configuration ของคุณ:
```bash
cp .env.example .env.local
```

### 3. เริ่มต้นรันเซิร์ฟเวอร์ (Development Server)
```bash
npm run dev
```
เปิดบราวเซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

### 4. Build สำหรับ Production
```bash
npm run build
npm start
```

---

## 🔒 นโยบายความปลอดภัย (Security & Compliance)
- ข้อมูลการเข้าถึง รหัสผ่าน และการเชื่อมต่อฐานข้อมูลถูกแยกเก็บใน Environment Variables
- เอกสารภายในและการตั้งค่าระบบเฉพาะทางถูกจัดเก็บใน Local Storage ภายนอกพื้นที่เผยแพร่สาธารณะ
- รองรับสิทธิ์ผู้ใช้งานแบบแบ่งแยกตามบทบาท (Role-Based Access Control)

---

## 📄 License
This project is developed for asset and tax surveying demonstration and enterprise management showcase.
