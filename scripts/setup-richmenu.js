#!/usr/bin/env node
/**
 * ตั้งค่า LINE Rich Menu สำหรับ Official Account ของโปรเจค AMS
 *
 * ใช้งาน (ใส่ token จากหน้า LINE Developers → Messaging API channel):
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx NEXT_PUBLIC_LIFF_ID=xxx node scripts/setup-richmenu.js
 *   หรือ
 *   node scripts/setup-richmenu.js <CHANNEL_ACCESS_TOKEN> <LIFF_ID>
 *
 * สคริปต์ทำ 3 อย่าง:
 *   1) สร้าง rich menu 3 ช่อง (หน้าแรก / สำรวจทรัพย์สิน / คำนวณภาษี)
 *   2) อัปโหลดภาพ public/richmenu.png (2500×843)
 *   3) ตั้งเป็น rich menu เริ่มต้นของผู้ใช้ทุกคนใน OA
 */
const fs = require("fs");
const path = require("path");

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.argv[2];
const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.argv[3];

if (!token) {
  console.error("❌ ต้องระบุ Channel access token ผ่าน env LINE_CHANNEL_ACCESS_TOKEN หรือ argument ตัวที่ 1");
  process.exit(1);
}
if (!liffId) {
  console.error("❌ ต้องระบุ LIFF ID ผ่าน env NEXT_PUBLIC_LIFF_ID หรือ argument ตัวที่ 2");
  process.exit(1);
}

const image = path.join(__dirname, "..", "public", "richmenu.png");
if (!fs.existsSync(image)) {
  console.error("❌ ไม่พบไฟล์ public/richmenu.png");
  process.exit(1);
}

const API = "https://api.line.me/v2/bot";
const liffUrl = (p) => `https://liff.line.me/${liffId}${p}`;

const richMenu = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: "SRT AMS Main Menu",
  chatBarText: "เมนู",
  areas: [
    { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: "uri", label: "หน้าแรก", uri: liffUrl("/") } },
    { bounds: { x: 833, y: 0, width: 833, height: 843 }, action: { type: "uri", label: "สำรวจทรัพย์สิน", uri: liffUrl("/land/") } },
    { bounds: { x: 1666, y: 0, width: 834, height: 843 }, action: { type: "uri", label: "คำนวณภาษี", uri: liffUrl("/tax/") } },
  ],
};

(async () => {
  // 1) สร้าง rich menu
  let res = await fetch(`${API}/richmenu`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(richMenu),
  });
  const created = await res.json();
  if (!res.ok) {
    console.error("❌ สร้าง rich menu ไม่สำเร็จ:", created);
    process.exit(1);
  }
  const richMenuId = created.richMenuId;
  console.log("✅ สร้าง rich menu แล้ว:", richMenuId);

  // 2) อัปโหลดภาพ
  res = await fetch(`${API}/richmenu/${richMenuId}/content`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/png" },
    body: fs.readFileSync(image),
  });
  if (!res.ok) {
    console.error("❌ อัปโหลดภาพไม่สำเร็จ:", await res.text());
    process.exit(1);
  }
  console.log("✅ อัปโหลดภาพ richmenu.png แล้ว");

  // 3) ตั้งเป็น default ของผู้ใช้ทุกคน
  res = await fetch(`${API}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.error("❌ ตั้ง rich menu เริ่มต้นไม่สำเร็จ:", await res.text());
    process.exit(1);
  }
  console.log("🎉 เสร็จสิ้น — ผู้ใช้ทุกคนใน OA จะเห็น Rich Menu นี้ (อาจใช้เวลาสักครู่ก่อนแสดง)");
})();
