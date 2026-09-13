# คู่มือเชื่อมต่อ LINE (LINE Login / LIFF + Rich Menu + Messaging)

เว็บนี้รองรับการเปิดในฐานะ **LIFF app (LINE Frontend Framework)** — เปิดผ่านแชท LINE Official Account แล้วจะ login อัตโนมัติด้วย **LINE Login** และมี **Rich Menu** 3 ช่องเปิดหน้าต่างๆ ของแอป

```
ผู้ใช้เปิดแชท OA ใน LINE
   └─ แตะ Rich Menu (ภาพ 3 ช่อง)
        └─ เปิด LIFF URL → https://liff.line.me/{LIFF_ID}/...
             └─ เว็บ AMS เปิดในหน้าใน LINE + login อัตโนมัติด้วย LINE
```

โค้ดฝั่งเว็บเตรียมไว้หมดแล้ว ขาดแค่ค่าตั้งค่าจาก LINE Developers Console (ต้องใช้บัญชี LINE ของคุณเท่านั้น)

---

## ขั้นตอนที่ 1 — สร้าง LINE Login channel + LIFF app

1. เข้า https://developers.line.biz/ → สร้าง **Provider** (เช่น `SRT AMS`)
2. กด **Create a new channel** → เลือก **LINE Login**
3. ใน channel นั้น → แท็บ **LIFF** → **Add**
   - **Endpoint URL**: `https://ams-test-sukanan.vercel.app/`
   - **Scope**: `profile`, `openid`
   - **Module mode**: ปิด
4. คัดลอก **LIFF ID** (รูป `1234567890-abcdefgh`)

> ถ้าใช้ domain อื่น ให้เปลี่ยน Endpoint URL เป็น domain นั้น

## ขั้นตอนที่ 2 — ใส่ LIFF ID ใน Vercel

1. Vercel Dashboard → โปรเจค `ams-test` → **Settings → Environment Variables**
2. เพิ่ม: **Key** = `NEXT_PUBLIC_LIFF_ID`, **Value** = LIFF ID จากขั้นตอนที่ 1
3. **Deployments → Redeploy** (env ของ static export ถูกแปะตอน build ต้อง build ใหม่)

จากนั้น:
- เปิด `https://liff.line.me/{LIFF_ID}` ในแอป LINE → จะ login อัตโนมัติและพาไป Dashboard
- เปิดในเบราว์เซอร์ทั่วไป → จะ redirect ไปหน้า login ของ LINE (external browser flow)
- ถ้าไม่ตั้งค่านี้ เว็บกลับไปเป็น "โหมดสาธิต" (ฟอร์ม login ปลอม) เหมือนเดิม — ไม่พัง

## ขั้นตอนที่ 3 — Rich Menu (เมนู 3 ช่องในแชท)

1. สร้าง **Messaging API channel** ผูกกับ Official Account (ถ้ายังไม่มี OA: สร้างที่ https://www.linebiz.com/th-th/ ก่อน)
2. แท็บ **Messaging API** → กด **Issue** เพื่อออก **Channel access token** (ค่ายาว ๆ)
3. รันสคริปต์ (สร้างเมนู + อัปโหลดภาพ `public/richmenu.png` + ตั้งเป็นเมนูของผู้ใช้ทุกคนในครั้งเดียว):

```bash
node scripts/setup-richmenu.js <CHANNEL_ACCESS_TOKEN> <LIFF_ID>
```

ช่องของเมนู: **หน้าแรก** → `/` , **สำรวจทรัพย์สิน** → `/land/` , **คำนวณภาษี** → `/tax/`
(อยากแก้ช่อง/ภาพ: แก้ `scripts/richmenu.svg` แล้ว render ใหม่ และแก้ `areas` ใน `scripts/setup-richmenu.js`)

## ขั้นตอนที่ 4 — ส่งข้อความ LINE (แจ้งเตือน)

สคริปต์ตัวอย่างส่ง push message ถึงผู้ใช้คนหนึ่ง:

```bash
node scripts/send-line-push.js <CHANNEL_ACCESS_TOKEN> <USER_ID> "สำรวจแปลง LP-2569-0042 เสร็จแล้ว"
```

- `USER_ID` ได้จาก LINE Login (`profile.userId`) หรือจาก webhook event `follow` (เมื่อคนกดเพิ่มเพื่อน OA)
- ผู้ใช้ต้องเป็นเพื่อนกับ OA แล้วจึง push ถึงได้
- อยาก "รับข้อความจากผู้ใช้" (บอทตอบกลับ) ต้องมี webhook server — ตอนนี้เว็บเป็น static export จึงยังไม่มี backend ถ้าต้องใช้จริง ให้เพิ่ม Vercel Function (ต้องเปลี่ยน `output: 'export'` ใน `next.config.js` ออก หรือทำ service แยก) โดย handler หลัก ๆ มีหน้าตาประมาณนี้:

```js
// api/line-webhook.js (ตัวอย่างสำหรับอนาคต)
export default async function handler(req, res) {
  const event = req.body.events[0];
  if (event?.type === "message") {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `รับทราบ: ${event.message.text}` }],
      }),
    });
  }
  res.status(200).end();
}
```

> หมายเหตุ: LINE Notify ปิดให้บริการแล้ว (มี.ค. 2568) — ใช้ Messaging API แทน

---

## เช็คลิสต์สรุป

| # | งาน | ที่ไหน | ผู้ทำ |
|---|------|--------|-------|
| 1 | สร้าง LINE Login channel + LIFF app (endpoint = URL เว็บ) | developers.line.biz | คุณ |
| 2 | ตั้ง env `NEXT_PUBLIC_LIFF_ID` + Redeploy | Vercel | คุณ |
| 3 | สร้าง Messaging API channel + Issue token | developers.line.biz | คุณ |
| 4 | รัน `node scripts/setup-richmenu.js <TOKEN> <LIFF_ID>` | เครื่องตัวเอง | คุณ |
| 5 | ทดสอบเปิด `https://liff.line.me/{LIFF_ID}` ใน LINE | มือถือ | คุณ |

## ปัญหาที่เจอบ่อย

- **เปิด LIFF แล้วขึ้น error `Could not authenticate`** — LIFF ID ผิด หรือ endpoint ต่างจาก domain จริง
- **Login วนลูปไม่จบ** — LIFF endpoint กับเว็บที่เปิดต่าง URL กัน (ต้องเป็น domain เดียวกัน)
- **ปุ่ม Rich Menu กดแล้วเปิดเบราว์เซอร์แทนที่จะเปิดใน LINE** — ปกติถ้าเป็นลิงก์ `liff.line.me` จะเปิดในหน้าใน LINE เอง ตรวจว่า URL สะกดถูก
- **แก้ env แล้วไม่มีผล** — static export ต้อง **Redeploy** ทุกครั้งที่เปลี่ยน env
