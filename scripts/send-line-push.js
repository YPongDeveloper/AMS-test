#!/usr/bin/env node
/**
 * ตัวอย่างส่งข้อความแจ้งเตือนถึงผู้ใช้ผ่าน LINE Messaging API (push message)
 *
 * ใช้งาน:
 *   node scripts/send-line-push.js <CHANNEL_ACCESS_TOKEN> <USER_ID> "ข้อความ"
 *   หรือ
 *   LINE_CHANNEL_ACCESS_TOKEN=xxx LINE_USER_ID=xxx node scripts/send-line-push.js "ข้อความ"
 *
 * หมายเหตุ:
 * - USER_ID ได้จาก LINE Login (profile.userId) หรือจาก webhook "follow" event
 * - ผู้ใช้ต้องเป็นเพื่อนกับ Official Account แล้วจึงจะ push ถึงได้
 * - LINE Notify ปิดให้บริการแล้ว (มี.ค. 2568) — ให้ใช้ Messaging API ตัวนี้แทน
 */
const token = process.env.LINE_CHANNEL_ACCESS_TOKEN || process.argv[2];
const userId = process.env.LINE_USER_ID || process.argv[3];
const text = process.argv[4] || process.argv[2];

if (!token || !userId || !text) {
  console.error("ใช้งาน: node scripts/send-line-push.js <TOKEN> <USER_ID> \"ข้อความ\"");
  process.exit(1);
}

(async () => {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text }],
    }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("❌ ส่งไม่สำเร็จ:", body);
    process.exit(1);
  }
  console.log("✅ ส่งข้อความสำเร็จ (sent)");
})();
