"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Droplets,
  PackageOpen,
  Send,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { shopInfo } from "../../data/mock";
import type { Claim } from "../../types/durian";
import { LineIcon } from "../../components/Icons";

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
      icon: AlertTriangle,
      title: "ทุเรียนอ่อน / เนื้อขาวแข็ง",
      desc: "เนื้อยังไม่สุกตามเกณฑ์ จืด ไม่หวาน",
    },
    {
      id: "overripe",
      icon: Droplets,
      title: "ทุเรียนสุกงอม / เละ / มีกลิ่นเปรี้ยว",
      desc: "สุกเกินไปจนแฉะหรือเสียระหว่างขนส่ง",
    },
    {
      id: "pest",
      icon: ShieldCheck,
      title: "พบหนอนเจาะ / เชื้อราในพู",
      desc: "มีสิ่งแปลกปลอมหรือจุดเสียด้านในเนื้อ",
    },
    {
      id: "transit",
      icon: PackageOpen,
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
    <div className="min-h-screen bg-[#FBF6E3]">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3">
            <img
              src={shopInfo.logo}
              alt={shopInfo.name}
              className="w-11 h-11 rounded-full border border-stone-200 bg-white object-cover"
            />
            <div>
              <h1 className="font-extrabold text-base text-[#1B4D31]">
                {shopInfo.name}
              </h1>
              <p className="text-[11px] text-stone-500 font-mono">
                ศูนย์แจ้งเคลมประกัน 100% • โทร. {shopInfo.phone}
              </p>
            </div>
          </a>
          <a
            href="/"
            className="text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 px-4 py-2 rounded-xl transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>กลับหน้าร้าน</span>
          </a>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        {/* Guarantee Banner */}
        <div className="bg-gradient-to-br from-[#11301F] to-[#1B4D31] text-white rounded-3xl p-6 sm:p-8 mb-8 border border-white/10 shadow-lg">
          <span className="inline-flex items-center gap-1.5 bg-white/10 text-amber-300 border border-white/15 text-[11px] font-bold px-3 py-1 rounded-full">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>รับประกันคุณภาพทุกลูก 100%</span>
          </span>
          <h2 className="text-2xl font-extrabold mt-3 mb-2 text-white">
            เจอทุเรียนอ่อน เนื้อขาว เละ หนอน —{" "}
            <span className="text-amber-300">เคลมฟรีทันที</span>
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100/85 leading-relaxed">
            ที่ร้าน <strong>{shopInfo.name}</strong> เราเข้าใจคนทานทุเรียนดีที่สุด
            เพียงกรอกรหัสออเดอร์และแนบภาพถ่ายหลักฐาน ระบบจะบันทึกเข้าหลังบ้านและแจ้งแอดมินทันที เพื่อเปลี่ยนลูกใหม่หรือโอนเงินคืนภายใน 24 ชม.
          </p>
        </div>

        {createdClaim ? (
          <div className="bg-white rounded-3xl p-8 border border-stone-200 text-center shadow-lg">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-[#1B4D31] border border-emerald-200 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold text-stone-900 mb-1">
              ส่งเรื่องแจ้งเคลมสำเร็จแล้ว
            </h3>
            <p className="text-xs text-stone-500 mb-5">
              รหัสคำร้องเคลม:{" "}
              <strong className="font-mono text-[#1B4D31] text-base">
                {createdClaim.claimId}
              </strong>
            </p>

            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-xs text-stone-700 max-w-md mx-auto mb-6 text-left space-y-1.5">
              <p className="font-bold text-stone-900">ขั้นตอนต่อไป:</p>
              <p>1. คำร้องของคุณถูกบันทึกลงฐานข้อมูลร้านเรียบร้อยแล้ว</p>
              <p>
                2. แอดมินจะตรวจสอบและติดต่อกลับที่เบอร์{" "}
                <strong>{createdClaim.phone}</strong> ภายใน 1-2 ชั่วโมง
              </p>
              <p>
                3. คุณสามารถส่งรูปเพิ่มเติมพร้อมแจ้งรหัส{" "}
                <strong>{createdClaim.claimId}</strong> ทาง LINE{" "}
                <strong>{shopInfo.lineOA}</strong> ได้เลยครับ
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <a
                href={`https://line.me/R/ti/p/${shopInfo.lineOA}`}
                target="_blank"
                rel="noreferrer"
                className="px-6 py-3 rounded-xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-bold transition shadow-sm inline-flex items-center justify-center gap-1.5"
              >
                <LineIcon className="w-4 h-4" />
                <span>ส่งรูปเพิ่มเติมทาง LINE</span>
              </a>
              <a
                href="/"
                className="px-6 py-3 rounded-xl bg-stone-100 text-stone-700 text-xs font-bold hover:bg-stone-200 transition"
              >
                กลับหน้าหลัก
              </a>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-3xl border border-stone-200 p-6 sm:p-8 space-y-5 shadow-xs"
          >
            <div className="border-b border-stone-100 pb-4">
              <h3 className="text-lg font-extrabold text-stone-900">
                แบบฟอร์มแจ้งปัญหา / ขอเคลมทุเรียน
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                กรุณากรอกข้อมูลตามคำสั่งซื้อเดิม เพื่อให้แอดมินตรวจสอบล็อตสินค้าได้ทันที
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  รหัสคำสั่งซื้อ (Order ID) *
                </label>
                <input
                  type="text"
                  required
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="เช่น WK-9521"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs focus:border-[#1B4D31] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  เบอร์โทรศัพท์ที่ใช้สั่งซื้อ *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08X-XXX-XXXX"
                  className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs focus:border-[#1B4D31] focus:outline-none"
                />
              </div>
            </div>

            {/* สาเหตุ */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-2">
                ปัญหาที่พบ *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {claimReasons.map((r) => {
                  const Icon = r.icon;
                  return (
                    <label
                      key={r.id}
                      className={`flex items-start gap-2.5 p-3.5 rounded-2xl border cursor-pointer text-xs transition ${
                        reason === r.id
                          ? "border-[#1B4D31] bg-emerald-50/50 font-semibold text-stone-900"
                          : "border-stone-200 text-stone-600 hover:border-stone-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="claimReason"
                        value={r.id}
                        checked={reason === r.id}
                        onChange={() => setReason(r.id)}
                        className="accent-[#1B4D31] mt-0.5"
                      />
                      <div>
                        <p className="font-bold text-stone-900 flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>{r.title}</span>
                        </p>
                        <p className="text-[11px] text-stone-500 font-normal mt-0.5">
                          {r.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* แนบรูป */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                แนบรูปถ่ายหลักฐาน (เห็นเนื้อทุเรียน / หน้ากล่องชัดเจน)
              </label>
              <div className="border-2 border-dashed border-stone-300 rounded-2xl p-6 text-center hover:bg-stone-50 transition cursor-pointer relative bg-stone-50/50">
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
                <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center mx-auto mb-2 text-[#1B4D31]">
                  <Upload className="w-5 h-5" />
                </div>
                {selectedFileName ? (
                  <p className="text-xs font-bold text-[#1B4D31] bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5" />
                    <span>เลือกไฟล์แล้ว: {selectedFileName}</span>
                  </p>
                ) : (
                  <div>
                    <p className="text-xs text-stone-700 font-bold">
                      คลิกเลือกรูปถ่ายหลักฐาน
                    </p>
                    <p className="text-[10px] text-stone-400 mt-0.5">
                      รองรับ JPG, PNG (ส่งรูปเพิ่มทาง LINE ได้ภายหลัง)
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* ข้อความเพิ่มเติม */}
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1.5">
                รายละเอียดเพิ่มเติม
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="เช่น เนื้อขาวทั้งพู ต้องการรับลูกใหม่ในรอบถัดไป หรือขอโอนเงินคืนครับ"
                className="w-full border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs focus:border-[#1B4D31] focus:outline-none resize-none"
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold p-3 rounded-xl">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1B4D31] hover:bg-[#143B25] disabled:opacity-60 text-white py-3.5 rounded-xl text-sm font-bold shadow-md transition inline-flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-amber-300" />
              <span>
                {submitting ? "กำลังส่งข้อมูล..." : "ส่งเรื่องแจ้งเคลม (รับประกัน 100%)"}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
