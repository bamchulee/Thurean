# ตั้งค่าเข้าสู่ระบบ (LINE / Google / Facebook)

เว็บ: `https://durianwinkin.vercel.app` — ถ้าเปลี่ยนโดเมน ให้แทนที่ทุกจุดด้านล่าง

## ภาพรวมระบบ

| เรื่อง | ทำงานยังไง |
|---|---|
| เข้าสู่ระบบ | LINE, Google หรือ Facebook ก็ได้ (ไม่มี username/password) |
| ก่อนสั่งซื้อ | ต้องเชื่อม LINE ก่อนทุกคน เพื่อให้บอทส่งยอด/QR/สถานะจัดส่งได้ |
| บัญชีเดียวต่อคน | แถวเดียวในชีต `Users` เก็บ `lineUserId` `googleId` `facebookId` `email` และ `loginProviders` (เช่น `google,line`) |
| เชื่อม LINE ที่เคยมีบัญชีอยู่แล้ว | ระบบรวมเข้าบัญชี LINE เดิม บัญชีเก่าถูกปิด (`isActive=0`) |
| สิทธิ์ | `user` ลูกค้า — เห็นแค่ออเดอร์/เคลมของตัวเอง · `staff` พนักงาน — ชั่ง, ตรวจสลิป, ส่งของ, เคลม (ไม่เห็นต้นทุน/ยอดขาย/ตั้งค่า) · `admin` เจ้าของร้าน — ทุกอย่าง + ตั้งสิทธิ์คนอื่นในแท็บ "ผู้ใช้งาน" |
| เปลี่ยนสิทธิ์ | อ่านจากชีตทุกครั้ง ลดสิทธิ์แล้วมีผลทันที |

ปุ่ม Google / Facebook จะโผล่ในหน้าล็อกอินเองเมื่อใส่ค่า env ครบ — ยังไม่ใส่ก็ใช้ LINE อย่างเดียวได้

---

## 1. LINE Login (มีแล้ว — เช็คให้ครบ)

1. เข้า <https://developers.line.biz/console/> → Provider ของร้าน → channel **LINE Login**
2. แท็บ **LINE Login** → Callback URL ใส่:
   ```
   https://durianwinkin.vercel.app/api/auth/line/callback
   ```
3. แท็บ **Basic settings** → **Linked LINE Official Account** เลือก `@713imada`
   (ให้หน้า login มีปุ่ม "เพิ่มเพื่อน" — ไม่เป็นเพื่อนบอทจะส่งข้อความหาลูกค้าไม่ได้)
4. เปิด scope `profile` และ `openid`
5. Channel status ต้องเป็น **Published**
6. ใส่ Channel ID / Channel secret ใน Vercel (ข้อ 4) หรือในหน้าแอดมิน → เชื่อม Google Sheet

## 2. Google

1. เข้า <https://console.cloud.google.com/> → สร้างโปรเจกต์ใหม่ (เช่น `durianwinkin-login`)
2. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `ทุเรียนวินคิน`, support email: อีเมลร้าน
   - Authorized domain: `durianwinkin.vercel.app`
   - Privacy policy: `https://durianwinkin.vercel.app/privacy`
   - Scopes: `openid`, `email`, `profile` (ไม่ต้องขอสิทธิ์อื่น จึงไม่ต้องให้ Google ตรวจแอป)
   - กด **Publish app** (ถ้าค้างที่ Testing จะมีแค่อีเมลที่ใส่ใน Test users ที่ล็อกอินได้)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     https://durianwinkin.vercel.app/api/auth/google/callback
     http://localhost:3000/api/auth/google/callback
     ```
4. คัดลอก **Client ID** และ **Client secret** ไปใส่ Vercel (ข้อ 4)

## 3. Facebook

1. เข้า <https://developers.facebook.com/apps/> → **Create app**
   - Use case: **Authenticate and request data from users with Facebook Login**
2. **App settings → Basic**
   - App domains: `durianwinkin.vercel.app`
   - Privacy policy URL: `https://durianwinkin.vercel.app/privacy`
   - User data deletion → Data deletion instructions URL: `https://durianwinkin.vercel.app/privacy#delete`
   - Category + App icon (1024×1024) — ต้องมีถึงจะเปิด Live ได้
3. **Facebook Login → Settings**
   - Valid OAuth Redirect URIs:
     ```
     https://durianwinkin.vercel.app/api/auth/facebook/callback
     ```
   - เปิด Client OAuth login + Web OAuth login
4. **Permissions**: ใช้แค่ `public_profile` และ `email` (มีให้ทันที ไม่ต้องส่งตรวจ)
5. ด้านบนสลับ **App mode** จาก Development → **Live**
   (Development = ล็อกอินได้เฉพาะคนที่มี role ในแอป)
6. คัดลอก **App ID** และ **App secret** ไปใส่ Vercel (ข้อ 4)

## 4. ใส่ค่าใน Vercel

Vercel → project `durianwinkin` → **Settings → Environment Variables** (เลือก Production + Preview):

| ชื่อ | ค่า |
|---|---|
| `GOOGLE_CLIENT_ID` | Client ID จากข้อ 2 |
| `GOOGLE_CLIENT_SECRET` | Client secret จากข้อ 2 |
| `FACEBOOK_APP_ID` | App ID จากข้อ 3 |
| `FACEBOOK_APP_SECRET` | App secret จากข้อ 3 |
| `LINE_LOGIN_CHANNEL_ID` | (ถ้าไม่ได้ตั้งในหน้าแอดมิน) |
| `LINE_LOGIN_CHANNEL_SECRET` | (ถ้าไม่ได้ตั้งในหน้าแอดมิน) |
| `LINE_ADMIN_USER_ID` | LINE userId ของเจ้าของร้าน — ล็อกอินด้วย LINE แล้วได้สิทธิ์ admin อัตโนมัติ |

กด **Redeploy** หลังใส่ค่า (env ใหม่มีผลกับ deploy ถัดไปเท่านั้น)

> secret ทั้งหมดห้าม commit ลง git และห้ามส่งในแชท — ใส่ใน Vercel เท่านั้น

## 5. ตั้งเจ้าของร้านคนแรก

ทำอย่างใดอย่างหนึ่ง:
- ใส่ `LINE_ADMIN_USER_ID` ตามตารางข้างบน แล้วล็อกอินเว็บด้วย LINE
- หรือพิมพ์ `/admin <PIN>` ในแชทบอท (ตั้งไลน์นั้นเป็นแอดมิน) แล้วล็อกอินเว็บด้วย LINE เดียวกัน

จากนั้นตั้งพนักงานได้ที่ `/admin` → แท็บ **ผู้ใช้งาน** → เปลี่ยนสิทธิ์เป็น "พนักงาน"
(พนักงานต้องล็อกอินเว็บก่อนหนึ่งครั้งถึงจะมีชื่อในรายการ)

## เช็คว่าใช้ได้

1. เปิดเว็บแบบไม่ล็อกอิน → กดสั่งซื้อ → ต้องขึ้นให้เข้าสู่ระบบ
2. ล็อกอินด้วย Google → ขึ้นแถบ "เชื่อม LINE ก่อนสั่งซื้อ" → กดเชื่อม → สั่งได้
3. ชีต `Users` แถวนั้นมีทั้ง `googleId` และ `lineUserId`, `loginProviders` = `google,line`
4. หน้า `/tracking` เห็นเฉพาะออเดอร์ของตัวเอง
5. บัญชีพนักงานเข้า `/admin` เห็นแค่แท็บออเดอร์กับเคลม
