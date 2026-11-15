# ทุเรียนวินคิน

ระบบร้านทุเรียนออนไลน์: หน้าร้าน + ตะกร้า + PromptPay QR, หลังบ้านแอดมิน, LINE OA (webhook / LIFF / LINE Login) และฐานข้อมูลบน Google Sheets

## โครงสร้าง

| ส่วน | ที่อยู่ |
| --- | --- |
| หน้าร้าน / เช็กพัสดุ / แจ้งเคลม | `src/app/page.tsx`, `src/app/tracking`, `src/app/claim` |
| หลังบ้าน | `src/app/admin` (เข้าด้วย PIN หรือบัญชี LINE ที่เป็นแอดมิน) |
| API | `src/app/api/*` |
| ชั้นข้อมูล (Sheets + ไฟล์สำรองในเครื่อง) | `src/lib/sheets-db.ts` |
| สร้างออเดอร์ / เคลม | `src/lib/order-service.ts` |
| Apps Script ที่ต้องนำไปวางใน Google Sheet | `google-apps-script/` (7 ไฟล์ `1_Config.gs` … `7_Migrate.gs`) |
| หน้า LIFF แบบ HTML ล้วน / ใบเสร็จ | `public/liff`, `public/receipt` |

## รันในเครื่อง

```bash
npm install
cp .env.example .env.local   # แล้วเติมค่า
npm run dev                  # http://localhost:3000
```

ถ้าไม่ตั้ง `GOOGLE_SHEETS_WEBAPP_URL` ระบบจะเก็บข้อมูลใน `data/local-db.json` (ไม่ขึ้น git)

## ตัวแปรที่ต้องตั้ง (Vercel > Settings > Environment Variables)

ดูรายการเต็มใน `.env.example` — ระบบไม่มีค่าลับเริ่มต้นฝังในโค้ด ตัวที่ต้องตั้งเอง:

- `ADMIN_PIN` — รหัสเข้าหลังบ้าน ไม่ตั้งจะเข้าด้วย PIN ไม่ได้
- `SESSION_SECRET` — ข้อความสุ่มยาว ๆ ใช้เซ็น session
- `LINE_LOGIN_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` — จาก LINE Developers Console
- `LINE_CHANNEL_SECRET` — Channel secret ของ Messaging API ใช้ตรวจลายเซ็น webhook (ไม่ตั้ง = ใครก็ยิงข้อความปลอมเข้า bot ได้)
- `GOOGLE_SHEETS_API_KEY` — key ของ Apps Script (ดูหัวข้อถัดไป)

## ติดตั้ง / อัปเดต Google Sheets

1. เปิด Google Sheet หลัก > Extensions > Apps Script ลบไฟล์ `Code.gs` เดิมทิ้ง แล้วกด **+ > Script** สร้างไฟล์ตามชื่อในโฟลเดอร์ `google-apps-script/` ทีละไฟล์ (`1_Config` … `7_Migrate`) วางโค้ดให้ตรงไฟล์ แล้วบันทึก
   (หรือในหน้าแอดมิน > ตั้งค่า กด "คัดลอกโค้ดทั้งหมด" แล้ววางเป็นไฟล์เดียวก็ได้ ผลเหมือนกัน — อย่าเหลือโค้ดเก่าไว้ ชื่อฟังก์ชันจะชนกัน)
2. เลือกฟังก์ชัน `generateApiKey` แล้วกด Run หนึ่งครั้ง คัดลอก key จาก Execution log
3. ใส่ key เป็น `GOOGLE_SHEETS_API_KEY` ที่ Vercel (และ `.env.local`) แล้ว redeploy เว็บ
4. กลับมาที่ Apps Script: Deploy > Manage deployments > แก้ไข > Version: **New version** > Deploy (URL เดิม)
5. เลือกฟังก์ชัน `migrateToRunningIds` แล้วกด Run หนึ่งครั้ง เพื่อจัดระเบียบข้อมูลเก่า (ลบแถวซ้ำ, เปลี่ยนรหัสสมาชิกเป็นเลขรัน, แก้ userId ในออเดอร์/เคลมให้ตรง) รันซ้ำได้ไม่เสียหาย

> ตั้งการแชร์ของชีตทั้งสองไฟล์เป็น **Restricted** (Share > General access) — สคริปต์รันในนามเจ้าของชีตจึงยังทำงานได้ปกติ

### รูปแบบรหัส (เลขรัน ออกโดย Apps Script ภายใต้ล็อก ไม่ชนกัน)

| ตาราง | รูปแบบ | หมายเหตุ |
| --- | --- | --- |
| Users | `USR-00001` | สมาชิกเดิมถูกเปลี่ยนเลขตอนรัน `migrateToRunningIds` |
| Orders | `WK-9523` | ต่อจากเลขสูงสุดเดิม เลขเก่าไม่เปลี่ยนเพราะลูกค้าถือไว้ |
| Claims | `CLM-40813` | ต่อจากเลขสูงสุดเดิม |
| Products / Rounds / Promotions / Lots_Cost | `WK-07`, `WK-ROUND-47`, `PROMO-02`, `LOT-001` | ถ้าแอดมินพิมพ์รหัสเองจะใช้รหัสนั้น |

ชีต Users มีคอลัมน์ `lastLoginAt` บันทึกเวลาล็อกอินล่าสุดทุกช่องทาง (รหัสผ่าน, ปุ่ม LINE, ในแอป LINE)

ทำตามลำดับนี้เว็บจะไม่ล่มระหว่างทาง: เว็บรุ่นนี้ยังอ่านข้อมูลจากสคริปต์รุ่นเก่าได้ แต่สคริปต์รุ่นใหม่จะปฏิเสธทุกคำขอที่ไม่มี key

สคริปต์จะสร้างชีตและเติมคอลัมน์ที่ขาดให้เอง ไม่ลบหรือย้ายคอลัมน์เดิม

### พฤติกรรมการบันทึกข้อมูล

- ทุกการเขียนทำทีละคำขอภายใต้ล็อก ออเดอร์สองรายการที่เข้ามาพร้อมกันจะไม่ตัดสต็อกทับกัน
- สร้างออเดอร์: เช็กรหัสซ้ำและสต็อกก่อน ถ้าของไม่พอจะไม่บันทึกอะไรเลย (ช่องสต็อกที่เว้นว่าง = ไม่นับสต็อก)
- สมาชิกบันทึกแบบ upsert และเก็บ `username` / `passwordHash` ในชีต Users
- ปุ่ม "ซิงก์" ในหลังบ้านกดซ้ำได้ ไม่เกิดแถวซ้ำและไม่ตัดสต็อกซ้ำ
- เบอร์โทร รหัสไปรษณีย์ เลขพัสดุ เก็บเป็นข้อความเสมอ เลข 0 นำหน้าไม่หาย
