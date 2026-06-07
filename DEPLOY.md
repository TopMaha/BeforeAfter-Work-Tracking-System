# คู่มือ Deploy — Before/After Work Tracking

มี 2 ส่วน: **(A) Cloudflare** (Worker + D1 + R2) และ **(B) LINE Messaging API**

---

## A. Cloudflare (Backend)

### 0. เตรียม
```bash
npm install -g wrangler      # ต้องใช้ Node 18+
wrangler login
```

### 1. สร้าง D1 (ฐานข้อมูล)
```bash
wrangler d1 create ba-track
```
คัดลอก `database_id` ที่ได้ ไปใส่ใน `wrangler.toml` (บรรทัด `database_id = "..."`)

สร้างตาราง + ข้อมูลตั้งต้น:
```bash
wrangler d1 execute ba-track --remote --file=./schema.sql
```

### 2. สร้าง R2 (เก็บรูป)
```bash
wrangler r2 bucket create ba-track-images
```
ถ้าต้องการให้ LINE แสดงรูปเปรียบเทียบได้ ต้องเปิด **public access** ของ bucket
(หรือผูก custom domain) แล้วตั้ง env `PUBLIC_IMG_BASE` เป็น URL สาธารณะของ bucket
```bash
wrangler secret put PUBLIC_IMG_BASE     # เช่น https://img.yourdomain.com
```

### 3. ตั้งค่า secret
```bash
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put LINE_CHANNEL_SECRET
```

### 4. Deploy
```bash
wrangler deploy
```
ได้ URL เช่น `https://ba-track.<subdomain>.workers.dev`

### 5. ต่อ Frontend
แก้บนสุดของ `<script>` ใน `index.html`:
```js
const CONFIG = { API_BASE: "https://ba-track.<subdomain>.workers.dev", ... };
```
> หมายเหตุ: โค้ด frontend รอบ MVP นี้ทำงานเต็มรูปแบบใน **Demo mode**
> ส่วนการสลับไปเรียก API จริงทำได้ผ่าน `CONFIG.API_BASE` (เลเยอร์ fetch จะเติมในรอบถัดไป)

---

## B. LINE Messaging API
> ❗ **LINE Notify ปิดบริการแล้ว (มี.ค. 2025)** — ใช้ **Messaging API** ผ่าน Official Account แทน

### 1. สร้าง Official Account + Channel
1. ไปที่ <https://developers.line.biz/console/>
2. สร้าง **Provider** → สร้าง **Messaging API channel**
3. ในแท็บ **Messaging API**:
   - กด **Issue** เพื่อสร้าง **Channel access token (long-lived)** → เก็บไว้ใส่ `wrangler secret put LINE_CHANNEL_ACCESS_TOKEN`
   - คัดลอก **Channel secret** (แท็บ Basic settings) → `wrangler secret put LINE_CHANNEL_SECRET`
   - ปิด **Auto-reply / Greeting** ตามต้องการ

### 2. ตั้ง Webhook
1. ในแท็บ Messaging API → **Webhook URL** ใส่:
   ```
   https://ba-track.<subdomain>.workers.dev/api/line/webhook
   ```
2. กด **Verify** แล้วเปิด **Use webhook = ON**

### 3. เชิญบอทเข้ากลุ่ม + ดัก Group ID
1. เปิด **Allow bot to join group chats = ON** (ในแท็บ Messaging API)
2. เพิ่มบอท (สแกน QR ในแท็บ Messaging API) แล้ว **เชิญเข้ากลุ่ม** ที่ต้องการให้ส่งรายงาน
3. พอบอทเข้ากลุ่ม Worker จะรับ event แล้ว **บันทึก groupId อัตโนมัติ** ลง `line_groups`
   และตั้งกลุ่มแรกเป็นปลายทางให้เอง (แก้ได้ในหน้าตั้งค่า)

### 4. ผูกชื่อพนักงาน → LINE userId (ไว้ @mention)
ให้พนักงานพิมพ์ในกลุ่มว่า `ผูก <รหัสพนักงาน>` เช่น `ผูก 5678`
→ Worker จะดึง `userId` จาก event มาบันทึกใน `users.line_user_id` ให้อัตโนมัติ

### 5. ทดสอบ
- หน้า **ตั้งค่า → ทดสอบส่งข้อความ** (หรือเรียก `POST /api/line/test`)
- เมื่อ **ปิดงาน** ระบบจะ push ข้อความ + รูปเปรียบเทียบ + @mention ผู้รับผิดชอบเข้ากลุ่ม

---

## ตรวจสอบด่วน (Checklist)
- [ ] `wrangler.toml` ใส่ `database_id` แล้ว
- [ ] รัน `schema.sql` กับ D1 (`--remote`) แล้ว
- [ ] สร้าง R2 bucket `ba-track-images` แล้ว
- [ ] ตั้ง secret token/secret ของ LINE แล้ว
- [ ] Webhook URL verify ผ่าน + Use webhook = ON
- [ ] เชิญบอทเข้ากลุ่ม → เห็น groupId ในหน้าตั้งค่า
- [ ] `CONFIG.API_BASE` ใน index.html ชี้มาที่ Worker
