"use client";

import { useState } from "react";
import { shopInfo } from "../../data/mock";
import { GuaranteeShield } from "../../components/DurianGraphics";

export default function ClaimPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("unripe");
  const [description, setDescription] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const claimReasons = [
    { id: "unripe", title: "ทุเรียนอ่อน / เนื้อขาวแข็ง", desc: "เนื้อยังไม่สุกตามเกณฑ์มาตรฐาน ค่าความหวานต่ำกว่าเกณฑ์" },
    { id: "overripe", title: "ทุเรียนสุกงอม / มีกลิ่นเปรี้ยวหรือแฉะ", desc: "สภาพเนื้อสุกเกินไปหรือเกิดการหมักจากการขนส่ง" },
    { id: "pest", title: "พบหนอนเจาะหรือรอยเชื้อรา", desc: "มีตำหนิด้านสุขอนามัยในเนื้อทุเรียน" },
    { id: "transit", title: "กล่องพัสดุชำรุด / เนื้อช้ำเสียหาย", desc: "ความเสียหายที่เกิดจากระบบขนส่งระหว่างทาง" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      {/* Header */}
      <header className="bg-[#081c10] text-white border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img src={shopInfo.logo} alt={shopInfo.name} className="w-10 h-10 rounded-full border border-[#c5a059] bg-white object-cover" />
            <div>
              <h1 className="font-serif font-bold text-sm tracking-wider uppercase text-white">{shopInfo.name}</h1>
              <p className="text-[10px] text-[#c5a059] font-mono">โทร. {shopInfo.phone}</p>
            </div>
          </a>
          <a href="/" className="text-xs text-white/70 hover:text-white transition">
            ← กลับหน้าร้าน
          </a>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Policy Statement Box */}
        <div className="bg-[#0b1f13] text-white rounded-lg p-6 sm:p-8 mb-8 border border-[#c5a059]/30">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded bg-[#0f2a1b] border border-[#c5a059]/40 text-[#c5a059] shrink-0 mt-1">
              <GuaranteeShield className="w-6 h-6 text-[#c5a059]" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#c5a059] uppercase tracking-widest block mb-1">
                INTEGRITY & WARRANTY POLICY
              </span>
              <h2 className="font-serif text-xl sm:text-2xl font-normal text-white mb-2">
                นโยบายรับประกันคุณภาพผลผลิต 100%
              </h2>
              <p className="text-xs sm:text-sm text-white/70 leading-relaxed font-light">
                หากทุเรียนที่คุณได้รับไม่ตรงตามเกณฑ์มาตรฐาน ไม่ว่าจะเป็นเนื้ออ่อน เนื้อขาว หรือชำรุดเสียหายจากการขนส่ง 
                กรุณาระบุรหัสคำสั่งซื้อและแนบภาพถ่ายหลักฐาน 
                เจ้าหน้าที่จะพิจารณาเปลี่ยนผลใหม่ในรอบถัดไป หรือดำเนินการโอนคืนเงินเต็มจำนวนภายใน 24 ชั่วโมง
              </p>
            </div>
          </div>
        </div>

        {submitted ? (
          <div className="bg-white rounded-lg p-8 sm:p-10 border border-stone-200 text-center shadow-lg">
            <div className="w-12 h-12 rounded-full border border-[#c5a059] text-[#997a35] flex items-center justify-center mx-auto mb-4 font-serif text-xl font-bold">
              ✓
            </div>
            <h3 className="font-serif text-2xl font-bold text-stone-900 mb-2">
              บันทึกคำร้องขอรับประกันเรียบร้อย
            </h3>
            <p className="text-xs text-stone-500 mb-6">
              หมายเลขคำร้อง: <strong className="font-mono text-stone-900 text-sm">CLM-{Math.floor(10000 + Math.random() * 90000)}</strong>
            </p>
            
            <div className="bg-stone-50 border border-stone-200 rounded p-4 text-xs text-stone-600 max-w-md mx-auto mb-8 text-left space-y-1.5">
              <p className="font-semibold text-stone-900">ขั้นตอนการดำเนินงาน:</p>
              <p>1. ข้อมูลคำร้องถูกส่งไปยังฝ่ายตรวจสอบคุณภาพแล้ว</p>
              <p>2. เจ้าหน้าที่จะติดต่อกลับผ่านหมายเลข <strong>{phone}</strong> ภายในเวลาทำการ</p>
              <p>3. คุณสามารถส่งข้อความพร้อมแจ้งเลขคำร้องผ่าน LINE OA <strong>{shopInfo.lineOA}</strong> เพื่อความสะดวกรวดเร็ว</p>
            </div>

            <div className="flex justify-center gap-3">
              <a
                href="#"
                className="px-6 py-2.5 rounded bg-[#081c10] text-[#e6c875] text-xs font-semibold uppercase tracking-wider hover:bg-[#0f291a] transition"
              >
                ติดต่อผ่าน LINE OA
              </a>
              <a
                href="/"
                className="px-6 py-2.5 rounded border border-stone-300 text-stone-700 text-xs hover:bg-stone-50 transition"
              >
                กลับสู่หน้าหลัก
              </a>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-stone-200 p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-stone-200 pb-4">
              <h3 className="font-serif text-lg font-bold text-stone-900">
                แบบฟอร์มแจ้งปัญหาและขอเคลมผลผลิต
              </h3>
              <p className="text-xs text-stone-500 mt-1 font-light">
                กรุณาระบุข้อมูลตามคำสั่งซื้อจริงเพื่อความรวดเร็วในการตรวจสอบ
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  รหัสคำสั่งซื้อ (Order ID) *
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="เช่น ORD-9421"
                  className="w-full border border-stone-300 rounded px-3 py-2 text-xs focus:border-[#081c10] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full border border-stone-300 rounded px-3 py-2 text-xs focus:border-[#081c10] focus:outline-none"
                />
              </div>
            </div>

            {/* สาเหตุ */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                ลักษณะข้อผิดพลาดที่ตรวจพบ *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {claimReasons.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-3 p-3.5 rounded border cursor-pointer text-xs transition ${
                      reason === r.id
                        ? "border-[#081c10] bg-stone-50 font-semibold text-stone-900"
                        : "border-stone-200 text-stone-600 hover:border-stone-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="claimReason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="accent-[#081c10] mt-0.5"
                    />
                    <div>
                      <p className="font-semibold text-stone-900">{r.title}</p>
                      <p className="text-[11px] text-stone-500 font-light mt-0.5">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* แนบรูปถ่าย */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                ภาพถ่ายหลักฐาน (แสดงเนื้อทุเรียนและป้ายพัสดุหน้ากล่อง) *
              </label>
              <div className="border border-dashed border-stone-300 rounded p-6 text-center hover:border-stone-400 transition cursor-pointer relative bg-stone-50/50">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setSelectedFileName(e.target.files[0].name);
                    }
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                {selectedFileName ? (
                  <p className="text-xs font-semibold text-stone-900 bg-stone-200 px-3 py-1 rounded inline-block">
                    ✓ แนบไฟล์แล้ว: {selectedFileName}
                  </p>
                ) : (
                  <div>
                    <p className="text-xs text-stone-700 font-medium">คลิกเพื่ออัปโหลดภาพ หรือลากไฟล์มาวางที่นี่</p>
                    <p className="text-[10px] text-stone-400 mt-1">รองรับไฟล์ JPG, PNG ขนาดไม่เกิน 10MB</p>
                  </div>
                )}
              </div>
            </div>

            {/* ข้อความเพิ่มเติม */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                รายละเอียดเพิ่มเติม
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="ระบุรายละเอียดเพิ่มเติม หรือความประสงค์ในการเคลม (เช่น ขอรับผลใหม่ในรอบถัดไป หรือขอรับเงินคืน)"
                className="w-full border border-stone-300 rounded px-3 py-2 text-xs focus:border-[#081c10] focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#081c10] hover:bg-[#0f291a] text-[#e6c875] py-3.5 rounded text-xs font-semibold uppercase tracking-wider transition"
            >
              ส่งคำร้องขอรับประกันคุณภาพ
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
