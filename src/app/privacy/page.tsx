import type { Metadata } from "next";
import Link from "next/link";
import { shopInfo } from "../../data/shop";

export const metadata: Metadata = {
  title: `นโยบายความเป็นส่วนตัว | ${shopInfo.name}`,
};

// หน้าที่ Google / LINE Login ต้องมีก่อนเปิดใช้งานจริง (Privacy Policy + วิธีขอลบข้อมูล)
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FBF6E3] px-4 py-10">
      <article className="max-w-2xl mx-auto bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 space-y-5 text-sm text-stone-700 leading-relaxed">
        <h1 className="text-2xl font-extrabold text-stone-900">นโยบายความเป็นส่วนตัว</h1>
        <p>
          ร้าน{shopInfo.name} เก็บข้อมูลเท่าที่จำเป็นต่อการรับจอง จัดส่ง และแจ้งสถานะคำสั่งซื้อเท่านั้น
        </p>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-stone-900">ข้อมูลที่เก็บ</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ชื่อ เบอร์โทร ที่อยู่จัดส่ง และตำแหน่งแผนที่ที่คุณกรอกหรือปักหมุดเอง</li>
            <li>
              รหัสบัญชี LINE ที่ใช้เข้าสู่ระบบ ชื่อที่แสดง และรูปโปรไฟล์
            </li>
            <li>ประวัติคำสั่งซื้อ น้ำหนักที่ชั่ง ยอดชำระ รูปสลิป และรายการแจ้งเคลม</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-stone-900">ใช้ข้อมูลเพื่อ</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>ยืนยันตัวตน และแสดงเฉพาะคำสั่งซื้อของคุณ</li>
            <li>ส่งยอดเงิน QR ชำระเงิน และสถานะจัดส่งทาง LINE Official Account ของร้าน</li>
            <li>จัดส่งสินค้า และดูแลการรับประกัน/เคลม</li>
          </ul>
          <p>ร้านไม่ขายหรือส่งต่อข้อมูลให้บุคคลอื่น นอกจากบริษัทขนส่งที่ต้องใช้ชื่อ เบอร์ และที่อยู่ในการส่งของ</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-stone-900">การเก็บรักษา</h2>
          <p>ข้อมูลเก็บในระบบหลังบ้านของร้าน เข้าถึงได้เฉพาะเจ้าของร้านและพนักงานที่ได้รับสิทธิ์</p>
        </section>

        <section id="delete" className="space-y-2">
          <h2 className="text-base font-bold text-stone-900">ขอดู แก้ไข หรือลบข้อมูล</h2>
          <p>
            แก้ชื่อ เบอร์ และที่อยู่ได้เองในเมนู &quot;บัญชีของฉัน&quot; หากต้องการให้ลบบัญชีและข้อมูลทั้งหมด
            (รวมถึงข้อมูลที่ได้จากการเข้าสู่ระบบด้วย LINE) แจ้งทาง LINE {shopInfo.lineOA} หรือโทร{" "}
            {shopInfo.phone} ร้านจะลบให้ภายใน 7 วัน ยกเว้นข้อมูลคำสั่งซื้อที่ต้องเก็บตามกฎหมายบัญชี
          </p>
        </section>

        <p className="text-xs text-stone-400">
          <Link href="/" className="underline">
            กลับหน้าร้าน
          </Link>
        </p>
      </article>
    </main>
  );
}
