"use client";

import { useEffect, useState } from "react";
import { shopInfo } from "../../data/mock";
import type { Claim } from "../../types/durian";

export default function ClaimPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("unripe");
  const [description, setDescription] = useState("");
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [createdClaim, setCreatedClaim] = useState<Claim | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idParam = params.get("orderId");
    if (idParam) setOrderId(idParam);
  }, []);

  const claimReasons = [
    {
      id: "unripe",
      icon: "🤍",
      title: "ทุเรียนอ่อน / เนื้อขาวแข็ง",
      desc: "เนื้อยังไม่สุกตามเกณฑ์ จืด ไม่หวาน",
    },
    {
      id: "overripe",
      icon: "💧",
      title: "ทุเรียนสุกงอม / เละ / มีกลิ่นเปรี้ยว",
      desc: "สุกเกินไปจนแฉะหรือเสียระหว่างขนส่ง",
    },
    {
      id: "pest",
      icon: "🐛",
      title: "พบหนอนเจาะ / เชื้อราในพู",
      desc: "มีสิ่งแปลกปลอมหรือจุดเสียด้านในเนื้อ",
    },
    {
      id: "transit",
      icon: "📦",
      title: "กล่องพัสดุแตก / เนื้อช้ำเสียหาย",
      desc: "เสียหายจากระบบขนส่งระหว่างเดินทาง",
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          phone,
          reason,
          description,
          evidenceName: selectedFileName || undefined,
        }),
      });
      const json = (await res.json()) as {
        ok: boolean;
        claim?: Claim;
        error?: string;
      };
      if (!res.ok || !json.ok || !json.claim) {
        setErrorMsg(json.error || "บันทึกคำร้องไม่สำเร็จ กรุณาลองใหม่");
      } else {
        setCreatedClaim(json.claim);
      }
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf6eb]">
      {/* Header */}
      <header className="bg-white border-b-2 border-yellow-400 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-11 h-11 rounded-full border-2 border-yellow-400 bg-white object-cover"
            />
            <div>
              <h1 className="font-black text-base text-green-800">{shopInfo.name}</h1>
              <p className="text-[11px] text-amber-700 font-mono font-bold">
                ศูนย์แจ้งเคลมประกัน 100% • โทร. {shopInfo.phone}
              </p>
            </div>
          </a>
          <a
            href="/"
            className="text-xs font-bold bg-green-800 text-yellow-300 px-4 py-2 rounded-full hover:bg-green-700 transition"
          >
            ← กลับหน้าร้าน
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Guarantee Banner */}
        <div className="bg-gradient-to-br from-green-800 to-green-900 text-white rounded-3xl p-6 sm:p-8 mb-8 border-2 border-yellow-400 shadow-xl">
          <span className="bg-yellow-400 text-green-950 text-[10px] font-black px-3 py-1 rounded-full uppercase">
            🛡️ รับประกันคุณภาพทุกลูก 100%
          </span>
          <h2 className="text-2xl font-black mt-3 mb-2 text-yellow-300">
            เจอทุเรียนอ่อน เนื้อขาว เละ หนอน — เคลมฟรีทันที!
          </h2>
          <p className="text-xs sm:text-sm text-green-100 leading-relaxed">
            ที่ร้าน <strong>{shopInfo.name}</strong> เราเข้าใจคนทานทุเรียนดีที่สุด 
            เพียงกรอกรหัสออเดอร์และแนบภาพถ่ายหลักฐาน ระบบจะบันทึกเข้าหลังบ้านและแจ้งแอดมินทันที เพื่อเปลี่ยนลูกใหม่หรือโอนเงินคืนภายใน 24 ชม.
          </p>
        </div>

        {createdClaim ? (
          <div className="bg-white rounded-3xl p-8 border-4 border-yellow-400 text-center shadow-xl">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-16 h-16 rounded-full border-2 border-yellow-400 mx-auto mb-3 object-cover"
            />
            <h3 className="text-2xl font-black text-green-800 mb-1">
              ส่งเรื่องแจ้งเคลมสำเร็จแล้วครับ!
            </h3>
            <p className="text-xs text-gray-500 mb-5">
              รหัสคำร้องเคลม:{" "}
              <strong className="font-mono text-green-900 text-base">
                {createdClaim.claimId}
              </strong>
            </p>

            <div className="bg-amber-50 border-2 border-yellow-300 rounded-2xl p-4 text-xs text-gray-700 max-w-md mx-auto mb-6 text-left space-y-1.5">
              <p className="font-black text-amber-900">📌 ขั้นตอนต่อไป:</p>
              <p>1. คำร้องของคุณถูกบันทึกลงฐานข้อมูลร้านเรียบร้อยแล้ว</p>
              <p>
                2. แอดมินจะตรวจสอบและติดต่อกลับที่เบอร์ <strong>{createdClaim.phone}</strong> ภายใน 1-2 ชั่วโมง
              </p>
              <p>
                3. คุณสามารถส่งรูปเพิ่มเติมพร้อมแจ้งรหัส <strong>{createdClaim.claimId}</strong> ทาง LINE{" "}
                <strong>{shopInfo.lineOA}</strong> ได้เลยครับ
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-full bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-black transition shadow"
              >
                💬 ส่งรูปเพิ่มเติมทาง LINE
              </a>
              <a
                href="/"
                className="px-6 py-3 rounded-full bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 transition"
              >
                กลับหน้าหลัก
              </a>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl border-2 border-yellow-300 p-6 sm:p-8 space-y-5 shadow-md"
          >
            <div className="border-b border-gray-100 pb-4">
              <h3 className="text-lg font-black text-gray-900">
                📝 แบบฟอร์มแจ้งปัญหา / ขอเคลมทุเรียน
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                กรุณากรอกข้อมูลตามคำสั่งซื้อเดิม เพื่อให้แอดมินตรวจสอบล็อตสินค้าได้ทันที
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5">
                  รหัสคำสั่งซื้อ (Order ID) *
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="เช่น WK-9521"
                  className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-green-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5">
                  เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-green-700 focus:outline-none"
                />
              </div>
            </div>

            {/* สาเหตุ */}
            <div>
              <label className="block text-xs font-black text-gray-700 mb-2">
                ปัญหาที่พบ *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {claimReasons.map((r) => (
                  <label
                    key={r.id}
                    className={`flex items-start gap-2.5 p-3.5 rounded-2xl border-2 cursor-pointer text-xs transition ${
                      reason === r.id
                        ? "border-green-700 bg-green-50 font-bold text-green-950"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="claimReason"
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="accent-green-700 mt-0.5"
                    />
                    <div>
                      <p className="font-black text-gray-900">
                        {r.icon} {r.title}
                      </p>
                      <p className="text-[11px] text-gray-500 font-normal mt-0.5">
                        {r.desc}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* แนบรูป */}
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1.5">
                แนบรูปถ่ายหลักฐาน (เห็นเนื้อทุเรียน / หน้ากล่องชัดเจน)
              </label>
              <div className="border-2 border-dashed border-yellow-400 rounded-2xl p-6 text-center hover:bg-amber-50/50 transition cursor-pointer relative bg-amber-50/30">
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
                <span className="text-3xl block mb-1">📸</span>
                {selectedFileName ? (
                  <p className="text-xs font-black text-green-800 bg-green-100 px-3 py-1 rounded-full inline-block">
                    ✓ เลือกไฟล์แล้ว: {selectedFileName}
                  </p>
                ) : (
                  <div>
                    <p className="text-xs text-gray-700 font-bold">
                      คลิกเลือกรูปถ่ายหลักฐาน
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      รองรับ JPG, PNG (ส่งรูปเพิ่มทาง LINE ได้ภายหลัง)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ข้อความเพิ่มเติม */}
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1.5">
                รายละเอียดเพิ่มเติม
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น เนื้อขาวทั้งพู ต้องการรับลูกใหม่ในรอบถัดไป หรือขอโอนเงินคืนครับ"
                className="w-full border-2 border-gray-200 rounded-xl px-3.5 py-2.5 text-xs focus:border-green-700 focus:outline-none resize-none"
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-bold p-3 rounded-xl">
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-60 text-green-950 py-4 rounded-full text-sm font-black shadow-lg transition"
            >
              {submitting ? "⏳ กำลังส่งข้อมูล..." : "🚀 ส่งเรื่องแจ้งเคลม (รับประกัน 100%)"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
