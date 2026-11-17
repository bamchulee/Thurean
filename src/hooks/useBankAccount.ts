"use client";

// บัญชีรับเงินที่ร้านตั้งไว้ในหลังบ้าน (โหลดจาก /api/shop) — ระหว่างโหลดใช้ค่าใน data/shop.ts
import { useEffect, useState } from "react";
import { shopInfo } from "../data/shop";

export type BankAccount = { bank: string; number: string; name: string; promptPay: string };

let cache: BankAccount | null = null;

export function useBankAccount(): BankAccount {
  const [bank, setBank] = useState<BankAccount>(cache || shopInfo.bankAccount);
  useEffect(() => {
    if (cache) return;
    let cancelled = false;
    fetch("/api/shop")
      .then((r) => r.json())
      .then((j: { bankAccount?: BankAccount }) => {
        if (j.bankAccount && !cancelled) {
          cache = j.bankAccount;
          setBank(j.bankAccount);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return bank;
}
