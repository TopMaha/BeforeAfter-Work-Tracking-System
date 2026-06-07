# Before/After Work Tracking System

ระบบติดตามงานแก้ไข/ปรับปรุงในโรงงานด้วยรูป **Before / After** — PWA mobile-first
ติดตั้งบนมือถือได้ ใช้ได้ทั้งแบบ **Demo (ออฟไลน์)** และ **Online (Cloudflare Workers + D1 + R2)**

![tech](https://img.shields.io/badge/PWA-mobile--first-2563eb) ![cf](https://img.shields.io/badge/Cloudflare-Workers%20%7C%20D1%20%7C%20R2-f38020)

## ✨ ฟีเจอร์ (MVP รอบนี้)
- 🔐 **Login แบบ whitelist** + แยกสิทธิ์ หัวหน้างาน / พนักงาน (ฟอร์ม animated)
- 📸 **เปิดงาน (Before)** → หัวหน้าถ่ายรูปจุดที่ต้องแก้ + กำหนดผู้รับผิดชอบ + due date
- 🛠️ **ส่งงาน (After)** → พนักงานถ่ายรูปหลังแก้ไข → สถานะ "รอตรวจ"
- 🖼️ **รวมรูป Before|After อัตโนมัติ** ด้วย Canvas (มีป้ายกำกับ + ชื่องาน + หมวด + วันที่)
- ✅ **ปิดงาน** โดยหัวหน้า + เก็บ audit trail (ใครเปิด/ส่ง/ปิด เวลาเป๊ะทุกขั้น)
- 📊 **Dashboard + Report**: งานค้าง/ปิดแล้ว/เกินกำหนด, สรุปตามหมวด, ค้นหา/กรอง, มุมมองคอมพิวเตอร์
- 📤 **Export**: Excel (.xlsx จริง, ไม่ใช้ไลบรารี), PDF/พิมพ์ (เรนเดอร์ไทยสมบูรณ์), CSV
- 📨 **ส่งรายงานเข้า LINE** (Messaging API) จากปุ่มในงาน + ทดสอบส่งในหน้าตั้งค่า
- 🌗 Light/Dark mode, 🧭 Magic floating nav, ⚡ SPA ลื่นไม่รีโหลด
- 🗜️ บีบอัดรูปก่อนอัปโหลด, 💬 คอมเมนต์ในแต่ละงาน, 🇹🇭 ภาษาไทยเต็มระบบ

- 🌐 **Online mode**: ใส่ `CONFIG.API_BASE` = สลับจาก Demo → เก็บข้อมูลบน **D1 + R2** ทุกคนเห็นชุดเดียวกัน real-time

> โหมดการทำงานสลับอัตโนมัติด้วยบรรทัดเดียว: `CONFIG.API_BASE` ว่าง = **Demo** (เก็บในเครื่อง),
> ใส่ URL ของ Worker = **Online** (D1+R2, ส่ง LINE จริง) — ดู [DEPLOY.md](DEPLOY.md)

## 🚀 ใช้งานแบบ Demo (ไม่ต้องตั้ง server)
เปิด `index.html` ผ่านเว็บเซิร์ฟเวอร์ (PWA ต้องการ http/https ไม่ใช่ `file://`):

```bash
npx serve .
# หรือ
python -m http.server 8080
```

แล้วเปิด `http://localhost:8080` → login ด้วยบัญชีตัวอย่าง:

| รหัส | สิทธิ์ |
|------|--------|
| `1234` | หัวหน้างาน (เปิด/ปิดงาน, ตั้งค่า) |
| `5678` | พนักงาน (ส่งงาน After) |

ข้อมูล Demo เก็บใน `localStorage` + รูปใน `IndexedDB` ของเครื่อง (กดรีเซ็ตได้ในหน้าตั้งค่า)

### Deploy หน้าเว็บฟรีบน GitHub Pages
push โฟลเดอร์นี้ขึ้น repo แล้วเปิด **Settings → Pages → Deploy from branch** (root)

## ☁️ ต่อ Cloudflare (Online จริง) + LINE
ดูขั้นตอนละเอียดใน **[DEPLOY.md](DEPLOY.md)** — สรุป:
1. `wrangler d1 create ba-track` → ใส่ `database_id` ใน `wrangler.toml`
2. `wrangler d1 execute ba-track --remote --file=./schema.sql`
3. `wrangler r2 bucket create ba-track-images`
4. `wrangler secret put LINE_CHANNEL_ACCESS_TOKEN` (+ `LINE_CHANNEL_SECRET`)
5. `wrangler deploy`
6. ใส่ URL ของ Worker ลงใน `CONFIG.API_BASE` (บนสุดของ `<script>` ใน `index.html`)

## 📁 โครงสร้างไฟล์
```
index.html           SPA + PWA ทั้งแอป (HTML/CSS/JS รวมไฟล์เดียว)
manifest.webmanifest PWA manifest
sw.js                Service worker (cache offline shell)
icon.svg             ไอคอนแอป
worker.js            Cloudflare Worker (REST API + R2 + LINE webhook/push)
schema.sql           โครงฐานข้อมูล D1
wrangler.toml        คอนฟิก Worker + binding D1/R2
DEPLOY.md            คู่มือ deploy + ตั้งค่า LINE
```

## 🗄️ ตาราง D1
`users` · `categories` · `tasks` · `task_logs` (audit + comment) · `app_config` · `line_groups`

---
สร้างด้วย ❤️ — vanilla JS, ไม่มี build step
