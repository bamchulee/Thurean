"use client";

// การเชื่อมต่อ: แก้ Token/Secret ทุกตัว (เก็บถาวรใน Apps Script), คอลัมน์ในชีต (เพิ่ม/ลบคอลัมน์ของตัวเอง), Rich menu
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Image as ImageIcon,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { LineIcon } from "../../../components/Icons";
import { Badge, ConfirmDialog, Field, inputCls, Section, Toast, usePageActions } from "./kit";

type FieldInfo = {
  key: string;
  group: "line" | "login" | "web";
  label: string;
  secret: boolean;
  value: string;
  masked: string;
  hasValue: boolean;
  source: "admin" | "env" | "default" | "none";
};
type Schema = Record<string, { file: string; idCol: string; headers: string[]; notes: string[] }>;
type RichButton = { type: "message" | "uri"; value: string };
type RichMenu = { chatBarText: string; buttons: RichButton[] };
type SettingsResp = {
  ok: boolean;
  error?: string;
  connected: boolean;
  sheetsWebAppUrl: string;
  userSheetUrl: string;
  thureanSheetUrl: string;
  isLiveNow: boolean;
  fields: FieldInfo[];
  richMenu: RichMenu | null;
  schema: Schema;
  customColumns: Record<string, string[]>;
};

const DEFAULT_MENU: RichMenu = {
  chatBarText: "เมนูทุเรียนวินคิน",
  buttons: ["สั่งซื้อ", "เช็กสต็อก", "โปรโมชั่น", "ดูไลฟ์สด", "แจ้งเคลม", "เพิ่มเติม"].map((v) => ({ type: "message" as const, value: v })),
};

const SOURCE: Record<FieldInfo["source"], { label: string; cls: string }> = {
  admin: { label: "ตั้งจากหน้านี้", cls: "bg-emerald-100 text-emerald-800" },
  env: { label: "จาก Vercel", cls: "bg-sky-100 text-sky-800" },
  default: { label: "ค่าเริ่มต้น", cls: "bg-stone-100 text-stone-600" },
  none: { label: "ยังไม่ตั้ง", cls: "bg-rose-100 text-rose-700" },
};

const GROUPS: { id: FieldInfo["group"]; title: string; desc: string }[] = [
  { id: "line", title: "LINE Official Account (บอท)", desc: "จาก LINE Developers → channel Messaging API" },
  { id: "login", title: "การเข้าสู่ระบบ", desc: "LINE Login / LIFF / Google — ดูวิธีขอคีย์ใน docs/LOGIN_SETUP.md" },
  { id: "web", title: "เว็บ & ไลฟ์สด", desc: "ที่อยู่เว็บที่ใช้ในลิงก์ข้อความ LINE และข้อมูลไลฟ์" },
];

export function Settings() {
  const [data, setData] = useState<SettingsResp | null>(null);
  const [loadError, setLoadError] = useState("");
  // ค่าที่แก้: string = ค่าใหม่, null = ล้าง (กลับไปใช้ค่าจาก Vercel/ค่าเริ่มต้น)
  const [edits, setEdits] = useState<Record<string, string | null>>({});
  const [live, setLive] = useState<boolean | null>(null);
  const [menu, setMenu] = useState<RichMenu | null>(null);
  const [menuImage, setMenuImage] = useState<string>("");
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [newCol, setNewCol] = useState<Record<string, string>>({});
  const [colConfirm, setColConfirm] = useState<{ table: string; columns: string[]; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/settings", { cache: "no-store" });
    const j = (await r.json()) as SettingsResp;
    if (!r.ok || !j.ok) {
      setLoadError(j.error || "โหลดการตั้งค่าไม่สำเร็จ");
      return;
    }
    setData(j);
    setLoadError("");
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/settings", { cache: "no-store" })
      .then(async (r) => ({ r, j: (await r.json()) as SettingsResp }))
      .then(({ r, j }) => {
        if (cancelled) return;
        if (!r.ok || !j.ok) setLoadError(j.error || "โหลดการตั้งค่าไม่สำเร็จ");
        else setData(j);
      })
      .catch((e) => !cancelled && setLoadError(String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const savedMenu = data?.richMenu || DEFAULT_MENU;
  const currentMenu = menu || savedMenu;
  const dirty = Object.keys(edits).length + (live !== null ? 1 : 0) + (menu ? 1 : 0);

  const save = useCallback(async () => {
    const values: Record<string, unknown> = { ...edits };
    if (live !== null) values.isLiveNow = live;
    if (menu) values.richMenu = menu;
    const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "save", values }) });
    const j = await res.json();
    if (!res.ok || !j.ok) {
      setToast({ msg: j.error || "บันทึกไม่สำเร็จ", ok: false });
      return;
    }
    setEdits({});
    setLive(null);
    setMenu(null);
    setReveal({});
    setToast({ msg: "บันทึกการตั้งค่าแล้ว — มีผลทันทีทุกเครื่องภายใน 1 นาที", ok: true });
    await load();
  }, [edits, live, menu, load]);

  const clear = useCallback(() => {
    setEdits({});
    setLive(null);
    setMenu(null);
    setMenuImage("");
  }, []);
  usePageActions({ dirty, onSave: save, onClear: clear, clearLabel: "ล้างค่า", clearConfirm: "ทิ้งค่าที่แก้ในหน้านี้ทั้งหมด (ยังไม่บันทึก) แล้วกลับไปใช้ค่าที่บันทึกไว้?" });

  const applyColumns = async () => {
    if (!colConfirm) return;
    setBusy("cols");
    try {
      const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "columns", table: colConfirm.table, columns: colConfirm.columns }) });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "ปรับคอลัมน์ไม่สำเร็จ");
      setToast({ msg: j.message || "ปรับคอลัมน์แล้ว", ok: true });
      setNewCol((p) => ({ ...p, [colConfirm.table]: "" }));
      await load();
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setBusy("");
      setColConfirm(null);
    }
  };

  const deployMenu = async () => {
    setBusy("menu");
    try {
      const res = await fetch("/api/line/richmenu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...currentMenu, image: menuImage || undefined }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || "ส่งเมนูขึ้น LINE ไม่สำเร็จ");
      setToast({ msg: j.message, ok: true });
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setBusy("");
    }
  };

  const pickImage = (file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) return setToast({ msg: "รูปต้องไม่เกิน 1 MB", ok: false });
    const reader = new FileReader();
    reader.onload = () => setMenuImage(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  if (loadError) return <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl p-4 text-sm">{loadError}</div>;
  if (!data)
    return (
      <div className="flex items-center gap-2 text-sm text-stone-500 py-10 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" /> กำลังโหลดการตั้งค่า...
      </div>
    );

  const fieldInput = (f: FieldInfo) => {
    const edited = f.key in edits;
    const v = edits[f.key];
    const show = reveal[f.key];
    return (
      <div key={f.key} className="py-3 border-b border-stone-100 last:border-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-xs font-bold text-stone-700">{f.label}</span>
          {edited ? (
            <Badge className="bg-amber-100 text-amber-900">{v === null ? "จะล้าง" : "แก้แล้ว ยังไม่บันทึก"}</Badge>
          ) : (
            <Badge className={SOURCE[f.source].cls}>{SOURCE[f.source].label}</Badge>
          )}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={f.secret && !show ? "password" : "text"}
              autoComplete="off"
              className={`${inputCls} ${edited ? "ring-2 ring-amber-300" : ""} ${f.secret ? "pr-9" : ""}`}
              placeholder={f.secret ? (f.hasValue ? `${f.masked} — พิมพ์ค่าใหม่เพื่อเปลี่ยน` : "ยังไม่ได้ใส่") : ""}
              value={edited ? v ?? "" : f.secret ? "" : f.value}
              onChange={(e) => setEdits((p) => ({ ...p, [f.key]: e.target.value }))}
            />
            {f.secret && (
              <button type="button" onClick={() => setReveal((p) => ({ ...p, [f.key]: !show }))} className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400" aria-label="แสดง/ซ่อน">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            )}
          </div>
          {f.source === "admin" && !edited && (
            <button
              type="button"
              onClick={() => setEdits((p) => ({ ...p, [f.key]: null }))}
              className="px-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-50"
              title="ล้างค่าที่ตั้งจากหน้านี้ กลับไปใช้ค่าจาก Vercel/ค่าเริ่มต้น"
            >
              ล้าง
            </button>
          )}
          {edited && (
            <button
              type="button"
              onClick={() =>
                setEdits((p) => {
                  const n = { ...p };
                  delete n[f.key];
                  return n;
                })
              }
              className="px-2.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-600 hover:bg-stone-50"
            >
              ยกเลิก
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <Section
        title="Google Sheets (ฐานข้อมูล)"
        desc="URL และ API key ของ Apps Script ตั้งใน Vercel เท่านั้น (ใช้ปลดล็อกการตั้งค่าทั้งหมดในหน้านี้)"
        right={<Badge className={data.connected ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-700"}>{data.connected ? "เชื่อมแล้ว" : "ยังไม่เชื่อม"}</Badge>}
      >
        <p className="text-xs font-mono text-stone-500 break-all mb-3">{data.sheetsWebAppUrl || "-"}</p>
        <div className="flex flex-wrap gap-2">
          {[
            ["ไฟล์ USER (สมาชิก)", data.userSheetUrl],
            ["ไฟล์ THUREAN (ร้าน)", data.thureanSheetUrl],
          ].map(([label, url]) => (
            <a key={label} href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> {label}
            </a>
          ))}
          <button
            type="button"
            disabled={busy === "sheet"}
            onClick={async () => {
              setBusy("sheet");
              try {
                const res = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "syncSheet" }) });
                const j = await res.json();
                setToast({ msg: j.message || j.error || "อัปเดตไม่สำเร็จ", ok: Boolean(j.ok) });
              } finally {
                setBusy("");
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            {busy === "sheet" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 text-amber-700" />} อัปเดตแท็บ Settings
          </button>
        </div>
        <p className="text-[11px] text-stone-400 mt-2">แท็บ Settings ในไฟล์ USER สรุปค่าทั้งหมดในหน้านี้ — ค่าลับ (token/secret) แสดงแบบปิดบังเท่านั้น ค่าจริงเก็บใน Apps Script Script Properties ซึ่งดูจากชีตไม่ได้</p>
      </Section>

      {GROUPS.map((g) => (
        <Section key={g.id} title={g.title} desc={g.desc}>
          <div className="-my-3">{data.fields.filter((f) => f.group === g.id).map(fieldInput)}</div>
          {g.id === "web" && (
            <label className="flex items-center gap-2 text-sm font-semibold mt-4">
              <input type="checkbox" checked={live ?? data.isLiveNow} onChange={(e) => setLive(e.target.checked)} />
              กำลังไลฟ์อยู่ตอนนี้ (ปุ่ม &ldquo;ดูไลฟ์สด&rdquo; ในบอทจะส่งลิงก์ไลฟ์)
            </label>
          )}
        </Section>
      ))}

      <Section title="Rich menu (เมนูล่างแชท LINE)" desc="แก้ข้อความ/ลิงก์ 6 ปุ่ม (เรียงตามรูป ซ้าย→ขวา บน→ล่าง) → กด บันทึก แล้วกด ส่งขึ้น LINE">
        <div className="space-y-3">
          <Field label="ข้อความบนแถบเมนู (ไม่เกิน 14 ตัว)">
            <input className={inputCls} maxLength={14} value={currentMenu.chatBarText} onChange={(e) => setMenu({ ...currentMenu, chatBarText: e.target.value })} />
          </Field>
          <div className="grid sm:grid-cols-3 gap-2">
            {currentMenu.buttons.map((b, i) => (
              <div key={i} className="border border-stone-200 rounded-xl p-2.5 space-y-1.5 bg-stone-50">
                <div className="text-[11px] font-bold text-stone-500">ปุ่ม {i + 1}</div>
                <select
                  className={`${inputCls} py-1 text-xs`}
                  value={b.type}
                  onChange={(e) => setMenu({ ...currentMenu, buttons: currentMenu.buttons.map((x, j) => (j === i ? { ...x, type: e.target.value === "uri" ? "uri" : "message" } : x)) })}
                >
                  <option value="message">ส่งข้อความ</option>
                  <option value="uri">เปิดลิงก์</option>
                </select>
                <input
                  className={`${inputCls} py-1 text-xs`}
                  placeholder={b.type === "uri" ? "https://..." : "ข้อความที่ส่งเข้าบอท"}
                  value={b.value}
                  onChange={(e) => setMenu({ ...currentMenu, buttons: currentMenu.buttons.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })}
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-300 text-xs font-bold text-stone-700 cursor-pointer hover:bg-stone-50">
              เปลี่ยนรูปเมนู (2500×1686, ไม่เกิน 1 MB)
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
            </label>
            {menuImage && (
              <span className="inline-flex items-center gap-1 text-xs text-stone-600">
                เลือกรูปใหม่แล้ว
                <button type="button" onClick={() => setMenuImage("")} aria-label="เอารูปออก">
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}
            <button type="button" disabled={busy === "menu" || dirty > 0} onClick={deployMenu} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#06C755] text-white text-xs font-bold disabled:opacity-40" title={dirty > 0 ? "กด บันทึก ก่อน" : ""}>
              {busy === "menu" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} ส่งขึ้น LINE
            </button>
          </div>
          {dirty > 0 && <p className="text-[11px] text-amber-700">มีค่าที่ยังไม่บันทึก — กด บันทึก ด้านบนก่อนส่งเมนูขึ้น LINE</p>}
        </div>
      </Section>

      <Section title="คอลัมน์ในชีต" desc="คอลัมน์ระบบเปลี่ยนไม่ได้ — เพิ่มคอลัมน์ของร้านเองได้ (ภาษาอังกฤษ/ตัวเลข/_) จะไปต่อท้ายก่อนคอลัมน์ระบบ และโชว์ในฟอร์มสินค้า">
        <div className="space-y-4">
          {Object.entries(data.schema).map(([table, s]) => {
            const custom = data.customColumns[table] || [];
            return (
              <details key={table} className="border border-stone-200 rounded-xl">
                <summary className="px-3 py-2 cursor-pointer text-sm font-bold flex items-center gap-2">
                  {table}
                  <span className="text-[11px] font-normal text-stone-400">
                    ไฟล์ {s.file} · {s.headers.length} คอลัมน์{custom.length ? ` · เพิ่มเอง ${custom.length}` : ""}
                  </span>
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {s.headers.map((h, i) => (
                      <span key={h} title={s.notes[i] || ""} className={`text-[11px] font-mono px-2 py-0.5 rounded-md border ${custom.includes(h) ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-stone-50 border-stone-200 text-stone-600"}`}>
                        {h}
                        {custom.includes(h) && (
                          <button
                            type="button"
                            className="ml-1 text-amber-700"
                            onClick={() => setColConfirm({ table, columns: custom.filter((c) => c !== h), text: `ลบคอลัมน์ ${h} ออกจากโครง (ถ้าในชีตมีข้อมูล คอลัมน์จะถูกย้ายไปท้ายตาราง ไม่ลบข้อมูล)` })}
                            aria-label={`ลบ ${h}`}
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      className={`${inputCls} py-1.5 text-xs font-mono`}
                      placeholder="ชื่อคอลัมน์ใหม่ เช่น harvestFarm"
                      value={newCol[table] || ""}
                      onChange={(e) => setNewCol((p) => ({ ...p, [table]: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") }))}
                    />
                    <button
                      type="button"
                      disabled={!newCol[table] || busy === "cols"}
                      onClick={() => setColConfirm({ table, columns: [...custom, newCol[table]], text: `เพิ่มคอลัมน์ ${newCol[table]} ในชีต ${table} (มีผลกับชีตจริงทันที)` })}
                      className="inline-flex items-center gap-1 px-3 rounded-xl bg-[#1B4D31] text-white text-xs font-bold disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" /> เพิ่ม
                    </button>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </Section>

      {colConfirm && (
        <ConfirmDialog title="ปรับคอลัมน์ในชีต" message={colConfirm.text} confirmLabel={busy === "cols" ? "กำลังทำ..." : "ยืนยัน"} onCancel={() => setColConfirm(null)} onConfirm={applyColumns} />
      )}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}
    </div>
  );
}
